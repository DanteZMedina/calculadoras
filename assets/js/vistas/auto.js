import { $, bindMoney, esc, mxn, money, pct, setMoney, mesNombre, fecha, lector, listaErrores } from '../util.js';
import { amortizar, catEstimado } from '../finanzas.js';
import { panelFuentes, tabla, resultado, enlaces } from '../componentes.js';
import * as hist from '../historial.js';

const SEGURO_KEY = 'calculadoras-mx:seguro-elegido';

export function render(root, { fiscal, mercado, catalogo }) {
  const iva = fiscal.iva;
  const vehiculos = catalogo.vehiculos;
  const bancos = catalogo.bancos.filter((b) => !b.soloHipoteca);
  const seguroElegido = JSON.parse(sessionStorage.getItem(SEGURO_KEY) || 'null');

  root.innerHTML = `
  <header class="page-head">
    <h1>Crédito de auto</h1>
    <p>Calcula mensualidad, costo total y CAT estimado. Captura el precio y la tasa vigentes desde los sitios oficiales de la marca y la financiera.</p>
  </header>

  <div class="layout">
    <form class="card form" id="f" autocomplete="off">
      <h2>Vehículo</h2>
      <div class="grid">
        <label>Modelo
          <select name="vehiculo">
            ${vehiculos.map((v) => `<option value="${v.id}">${esc(v.nombre)}</option>`).join('')}
            <option value="otro">Otro</option>
          </select>
        </label>
        <label class="hide" data-otro>Nombre del vehículo<input name="otroNombre" type="text" placeholder="Marca y modelo"></label>
        <label>Versión<input name="version" type="text" placeholder="p. ej. FR, Xcellence…"></label>
      </div>
      <div class="links-inline" id="linksVehiculo"></div>
      <div class="grid">
        <label>Precio de lista<span class="input-money"><input class="money" name="precio" inputmode="decimal" placeholder="0.00" required></span></label>
        <label>Descuento o bono vigente<span class="input-money"><input class="money" name="descuento" inputmode="decimal" placeholder="0.00"></span></label>
      </div>

      <h2>Crédito</h2>
      <div class="grid">
        <label>Financiera
          <select name="financiera">
            ${bancos.map((b) => `<option>${esc(b.nombre)}</option>`).join('')}
            <option>Financiera de la agencia</option><option>Otra</option>
          </select>
        </label>
        <label>Enganche<span class="input-money"><input class="money" name="enganche" inputmode="decimal" placeholder="p. ej. 150,000.00"></span></label>
        <label>Plazo
          <select name="plazo">${[12, 24, 36, 48, 60, 72].map((m) => `<option value="${m}" ${m === 48 ? 'selected' : ''}>${m} meses</option>`).join('')}</select>
        </label>
        <label>Tasa de interés anual fija (%)<input name="tasa" type="number" min="0" step="0.01" placeholder="de la cotización" required></label>
        <label>Comisión por apertura (%)<input name="comision" type="number" min="0" step="0.01" placeholder="0"></label>
        <label>La comisión se paga
          <select name="comisionModo"><option value="contado">De contado</option><option value="financiada">Financiada</option></select>
        </label>
      </div>
      <div class="links-inline" id="linksBanco"></div>

      <h2>Seguros</h2>
      <div class="grid">
        <label>Seguro de auto anual (prima total)<span class="input-money"><input class="money" name="seguro" inputmode="decimal" placeholder="0.00"></span></label>
        <label>Forma de pago del seguro
          <select name="seguroModo">
            <option value="contado">De contado cada año</option>
            <option value="financiado">Financiado en el crédito (todo el plazo)</option>
          </select>
        </label>
        <label>Seguro de vida / desempleo mensual<span class="input-money"><input class="money" name="seguroVida" inputmode="decimal" placeholder="0.00"></span></label>
      </div>
      ${seguroElegido ? `<p class="hint">Hay una cotización elegida en el comparador de seguros: <strong>${esc(seguroElegido.aseguradora)}</strong> por ${mxn(seguroElegido.primaAnual)} al año. <button type="button" class="btn-link" id="usarSeguro">Usarla</button></p>` : `<p class="hint">¿Aún no tienes la prima? Compárala en <a href="#/seguro">Seguro de auto</a>.</p>`}

      <label class="check"><input type="checkbox" name="ivaInt" checked> Cobrar IVA sobre intereses (${pct(iva.tasaGeneral, 0)})</label>
      <p class="hint">Los intereses de créditos automotrices a personas físicas causan IVA a la tasa general del art. 1o. de la LIVA; solo los créditos hipotecarios para casa habitación están exentos (art. 15, fr. X, inciso d). La mensualidad se fija con la tasa mensual más IVA (tasa anual ÷ 12 × ${(1 + iva.tasaGeneral / 100).toFixed(2)}); la tabla separa interés e IVA de cada mes. Tasa fija durante todo el plazo.</p>
    </form>

    <section class="card results" aria-live="polite">
      <h2>Resultado</h2>
      <div id="out"><p class="empty">Captura el precio y la tasa para calcular.</p></div>
    </section>
  </div>

  <section class="card">
    <div class="row-between">
      <h2>Histórico de ofertas</h2>
      <div class="btns">
        <button class="btn" id="guardar" disabled>Guardar oferta de este mes</button>
        <button class="btn btn-ghost" id="csv">Exportar CSV</button>
        <button class="btn btn-ghost" id="json">Exportar JSON</button>
        <label class="btn btn-ghost">Importar JSON<input type="file" id="imp" accept="application/json" hidden></label>
      </div>
    </div>
    <label class="full">¿De dónde salió la oferta? (URL o agencia)<input id="fuenteOferta" type="text" placeholder="https://… o Agencia Polanco, asesor…"></label>
    <label class="full">Notas<input id="notas" type="text" placeholder="Opcional"></label>
    <p class="hint">Las ofertas se guardan solo en este navegador. Exporta el JSON cada mes como respaldo; en noviembre de 2027 importa todo para ver qué mes tuvo la mejor oferta.</p>
    <div id="hist"></div>
  </section>

  ${panelFuentes([iva.fuente, mercado.banxico?.fuente], { generado: fiscal.generado, avisos: [...(fiscal.avisos ?? []), ...(mercado.avisos ?? [])], extra: `
    <p class="nota">Precios, descuentos y tasas no tienen API pública: se capturan desde los sitios oficiales de cada marca y financiera.</p>
    ${enlaces([...vehiculos.map((v) => ({ nombre: `${v.nombre} – sitio oficial`, url: v.url })), ...bancos, ...catalogo.referencias.filter((r) => /CONDUSEF|Banco de México/.test(r.nombre))])}
    ${referenciaBanxico(mercado)}` })}
  `;

  const f = $('#f', root);
  bindMoney(root);
  let ultimo = null;

  const actualizarLinks = () => {
    const v = vehiculos.find((x) => x.id === f.vehiculo.value);
    root.querySelector('[data-otro]').classList.toggle('hide', !!v);
    $('#linksVehiculo', root).innerHTML = v ? `Consulta precio vigente: <a href="${v.url}" target="_blank" rel="noopener">sitio oficial ${esc(v.marca)}</a> · <a href="${v.promociones}" target="_blank" rel="noopener">promociones</a>` : '';
    const b = bancos.find((x) => x.nombre === f.financiera.value);
    $('#linksBanco', root).innerHTML = b ? `Consulta la tasa en <a href="${b.url}" target="_blank" rel="noopener">${esc(b.nombre)}</a>` : '';
  };

  const calcular = () => {
    actualizarLinks();
    const { leer, errores, error } = lector(f);
    const precio = leer('precio', { etiqueta: 'el precio de lista', requerido: true, min: 0.01, moneda: true });
    const descuento = leer('descuento', { etiqueta: 'el descuento', moneda: true });
    const enganche = leer('enganche', { etiqueta: 'el enganche', moneda: true });
    const tasa = leer('tasa', { etiqueta: 'la tasa de interés anual', requerido: true, max: 200, pct: true });
    const comPct = leer('comision', { etiqueta: 'la comisión por apertura', max: 100, pct: true });
    const seguro = leer('seguro', { etiqueta: 'el seguro de auto', moneda: true });
    const vida = leer('seguroVida', { etiqueta: 'el seguro de vida/desempleo', moneda: true });
    const neto = precio - descuento;
    if (descuento > precio) error('El descuento no puede ser mayor que el precio de lista.');
    else if (enganche >= neto) error(`El enganche debe ser menor que el precio neto (${mxn(neto)}).`);
    if (errores.length) {
      $('#out', root).innerHTML = errores.length === 2 && f.precio.value === '' && f.tasa.value === ''
        ? '<p class="empty">Captura el precio y la tasa para calcular.</p>' : listaErrores(errores);
      $('#guardar', root).disabled = true; ultimo = null; return;
    }
    const engPct = enganche / neto * 100;
    const plazo = +f.plazo.value;
    const anios = Math.ceil(plazo / 12);
    const seguroFin = f.seguroModo.value === 'financiado';
    const ivaInt = f.ivaInt.checked ? iva.tasaGeneral : 0;

    const base = neto - enganche + (seguroFin ? seguro * anios : 0);
    const comision = base * comPct / 100;
    const comFin = f.comisionModo.value === 'financiada';
    const principal = base + (comFin ? comision : 0);
    const am = amortizar(principal, tasa, plazo, { ivaIntereses: ivaInt, cargoMensual: vida });
    // financiada o de contado, el acreditado recibe en neto (principal − comisión)
    const cat = catEstimado(principal, comision, am.filas, vida);
    const desembolso = enganche + (comFin ? 0 : comision) + (seguroFin ? 0 : seguro);
    const totalPagos = am.filas.reduce((s, r) => s + r.pago, 0);
    const segurosContado = seguroFin ? 0 : seguro * anios;
    const costoCredito = am.totalInteres + am.totalIva + comision;
    const totalFinal = enganche + (comFin ? 0 : comision) + totalPagos + segurosContado;

    ultimo = {
      vehiculo: vehiculos.find((x) => x.id === f.vehiculo.value)?.nombre ?? (f.otroNombre.value || 'Otro'),
      version: f.version.value, financiera: f.financiera.value,
      precioLista: precio, descuento, precioNeto: neto, enganche, plazo, tasa, comision: comPct,
      mensualidad: am.pago, cat, totalPagado: totalFinal, costoCredito,
    };
    $('#guardar', root).disabled = false;

    $('#out', root).innerHTML = `
      <div class="kpis">
        ${resultado('Mensualidad', mxn(am.pago), { grande: true, nota: `${plazo} pagos fijos${vida ? ', incluye seguro de vida/desempleo' : ''}` })}
        ${resultado('Pago inicial', mxn(desembolso), { nota: `Enganche ${mxn(enganche)} (${pct(engPct)} del precio neto)${!comFin && comision ? ` + comisión ${mxn(comision)}` : ''}${!seguroFin && seguro ? ` + seguro año 1 ${mxn(seguro)}` : ''}` })}
        ${resultado('Monto financiado', mxn(principal))}
        ${resultado('CAT estimado (sin IVA)', pct(cat), { nota: 'Informativo. El CAT oficial lo publica cada institución.' })}
        ${resultado('Intereses', mxn(am.totalInteres))}
        ${resultado('IVA de intereses', mxn(am.totalIva))}
        ${resultado('Costo del crédito', mxn(costoCredito), { nota: 'Intereses + IVA + comisión' })}
        ${resultado('Total desembolsado', mxn(totalFinal), { nota: `Precio neto ${mxn(neto)} + costo del crédito${segurosContado ? ' + seguros de contado' : ''}${vida ? ' + seguro de vida' : ''}` })}
      </div>
      <details class="amort">
        <summary>Tabla de amortización</summary>
        ${tabla([
          { titulo: 'Mes', valor: (r) => r.mes },
          { titulo: 'Pago', num: 1, valor: (r) => money(r.pago) },
          { titulo: 'Capital', num: 1, valor: (r) => money(r.capital) },
          { titulo: 'Interés', num: 1, valor: (r) => money(r.interes) },
          { titulo: 'IVA', num: 1, valor: (r) => money(r.iva) },
          ...(vida ? [{ titulo: 'Seguro', num: 1, valor: (r) => money(r.cargo) }] : []),
          { titulo: 'Saldo', num: 1, valor: (r) => money(r.saldo) },
        ], am.filas)}
      </details>`;
  };

  const pintarHistorial = () => {
    const lista = hist.listar();
    if (!lista.length) { $('#hist', root).innerHTML = '<p class="empty">Aún no hay ofertas guardadas.</p>'; return; }
    const analisis = hist.analisis(lista);
    $('#hist', root).innerHTML = `
      <div class="analisis">
        ${analisis.map((a) => {
          const max = Math.max(...a.meses.filter((m) => m.mejorPrecio).map((m) => m.mejorPrecio.precioNeto));
          return `
          <div class="analisis-item">
            <h3>${esc(a.vehiculo)}</h3>
            <p>Mejor precio: ${a.mejorMesPrecio ? `<strong>${mesNombre(a.mejorMesPrecio.mes)}</strong> · ${mxn(a.mejorMesPrecio.mejorPrecio.precioNeto)}` : '—'}<br>
               Menor costo total: ${a.mejorMesTotal ? `<strong>${mesNombre(a.mejorMesTotal.mes)}</strong> · ${mxn(a.mejorMesTotal.mejorTotal.totalPagado)} (${esc(a.mejorMesTotal.mejorTotal.financiera)})` : '—'}</p>
            <div class="bars">
              ${a.meses.filter((m) => m.mejorPrecio).map((m) => `
                <div class="bar-row"><span>${mesNombre(m.mes)}</span>
                  <span class="bar"><i style="width:${(m.mejorPrecio.precioNeto / max) * 100}%"></i></span>
                  <span class="n">${money(m.mejorPrecio.precioNeto)}</span></div>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
      <details class="amort"><summary>Todas las ofertas (${lista.length})</summary>
      ${tabla([
        { titulo: 'Fecha', valor: (o) => fecha(o.fecha) },
        { titulo: 'Vehículo', valor: (o) => `${o.vehiculo} ${o.version ?? ''}` },
        { titulo: 'Financiera', valor: (o) => o.financiera },
        { titulo: 'Precio neto', num: 1, valor: (o) => money(o.precioNeto) },
        { titulo: 'Tasa', num: 1, valor: (o) => pct(o.tasa) },
        { titulo: 'Mensualidad', num: 1, valor: (o) => money(o.mensualidad) },
        { titulo: 'Total', num: 1, valor: (o) => money(o.totalPagado) },
        { titulo: '', html: (o) => `<button class="btn-link" data-del="${esc(o.id)}">Eliminar</button>` },
      ], [...lista].reverse())}
      </details>`;
  };

  f.addEventListener('input', calcular);
  f.addEventListener('change', calcular);
  $('#usarSeguro', root)?.addEventListener('click', () => { setMoney(f.seguro, seguroElegido.primaAnual); calcular(); });
  $('#guardar', root).addEventListener('click', () => {
    if (!ultimo) return;
    hist.agregar({ ...ultimo, fuenteOferta: $('#fuenteOferta', root).value, notas: $('#notas', root).value });
    pintarHistorial();
  });
  $('#csv', root).addEventListener('click', hist.exportarCSV);
  $('#json', root).addEventListener('click', hist.exportarJSON);
  $('#imp', root).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { const n = await hist.importarJSON(file); pintarHistorial(); $('#hist', root).insertAdjacentHTML('afterbegin', `<p class="ok">Se importaron ${n} ofertas.</p>`); }
    catch (err) { $('#hist', root).insertAdjacentHTML('afterbegin', `<p class="aviso">${esc(err.message)}</p>`); }
    e.target.value = '';
  });
  $('#hist', root).addEventListener('click', (e) => {
    const id = e.target.dataset?.del;
    if (id) { hist.eliminar(id); pintarHistorial(); }
  });

  calcular();
  pintarHistorial();
}

export function referenciaBanxico(mercado) {
  const ind = mercado.banxico?.indicadores;
  if (!ind) return '<p class="nota">Indicadores de Banxico (TIIE, tasa objetivo, UDI) disponibles al configurar el token de la API SIE.</p>';
  return `<p class="nota">Referencia de mercado (Banxico SIE):</p><ul class="links">${Object.values(ind).map((s) => `<li>${esc(s.titulo)}: <strong>${s.valor ?? 'N/E'}</strong> <span class="fuente-meta">(${esc(s.fecha)}, serie ${esc(s.serie)})</span></li>`).join('')}</ul>`;
}
