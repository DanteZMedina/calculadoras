import { $, bindMoney, esc, mxn, money, pct, val } from '../util.js';
import { amortizar, catEstimado } from '../finanzas.js';
import { panelFuentes, tabla, resultado, enlaces } from '../componentes.js';
import { referenciaBanxico } from './auto.js';

export function render(root, { fiscal, mercado, catalogo }) {
  const bancos = catalogo.bancos.filter((b) => !b.soloAuto);

  root.innerHTML = `
  <header class="page-head">
    <h1>Crédito hipotecario</h1>
    <p>Mensualidad, gastos iniciales y efecto de los abonos a capital. Usa la tasa y los seguros de la cotización oficial de tu banco.</p>
  </header>

  <div class="layout">
    <form class="card form" id="f" autocomplete="off">
      <h2>Vivienda</h2>
      <div class="grid">
        <label>Valor de la vivienda<span class="input-money"><input class="money" name="valor" inputmode="decimal" placeholder="0.00" required></span></label>
        <label>Enganche (%)<input name="enganche" type="number" min="0" max="90" step="0.5" placeholder="p. ej. 10"></label>
      </div>

      <h2>Crédito</h2>
      <div class="grid">
        <label>Banco
          <select name="banco">${bancos.map((b) => `<option>${esc(b.nombre)}</option>`).join('')}<option>Otro</option></select>
        </label>
        <label>Plazo
          <select name="plazo">${[5, 7, 10, 15, 20, 25, 30].map((a) => `<option value="${a}" ${a === 20 ? 'selected' : ''}>${a} años</option>`).join('')}</select>
        </label>
        <label>Tasa de interés anual fija (%)<input name="tasa" type="number" min="0" step="0.01" placeholder="de la cotización" required></label>
        <label>Comisión por apertura (%)<input name="comision" type="number" min="0" step="0.01" placeholder="0"></label>
        <label>Seguros mensuales (vida + daños)<span class="input-money"><input class="money" name="seguros" inputmode="decimal" placeholder="0.00"></span></label>
        <label>Abono extra a capital mensual<span class="input-money"><input class="money" name="extra" inputmode="decimal" placeholder="0.00"></span></label>
      </div>
      <div class="links-inline" id="linksBanco"></div>

      <h2>Gastos de compra</h2>
      <div class="grid">
        <label>Avalúo<span class="input-money"><input class="money" name="avaluo" inputmode="decimal" placeholder="0.00"></span></label>
        <label>Gastos notariales, ISAI y registro (%)<input name="gastos" type="number" min="0" step="0.01" placeholder="cotización del notario"></label>
      </div>
      <p class="hint">Los intereses de créditos hipotecarios para casa habitación están exentos de IVA (art. 15, fr. X, inciso d, LIVA). El ISAI de la CDMX lo determina la Secretaría de Administración y Finanzas; inclúyelo en el porcentaje que te cotice el notario.</p>
    </form>

    <section class="card results" aria-live="polite">
      <h2>Resultado</h2>
      <div id="out"><p class="empty">Captura el valor de la vivienda y la tasa para calcular.</p></div>
    </section>
  </div>

  ${panelFuentes([fiscal.iva.fuente, mercado.banxico?.fuente], { generado: fiscal.generado, avisos: [...(fiscal.avisos ?? []), ...(mercado.avisos ?? [])], extra: `
    <p class="nota">Las tasas hipotecarias varían por banco y perfil; captúralas del simulador oficial de cada institución.</p>
    ${enlaces([...bancos, ...catalogo.referencias])}
    ${referenciaBanxico(mercado)}` })}
  `;

  const f = $('#f', root);
  bindMoney(root);

  const calcular = () => {
    const b = bancos.find((x) => x.nombre === f.banco.value);
    $('#linksBanco', root).innerHTML = b ? `Consulta la tasa en <a href="${b.url}" target="_blank" rel="noopener">${esc(b.nombre)}</a>` : '';
    const valor = val(f, 'valor');
    const tasa = val(f, 'tasa');
    if (!(valor > 0) || f.tasa.value === '' || !(tasa >= 0)) {
      $('#out', root).innerHTML = '<p class="empty">Captura el valor de la vivienda y la tasa para calcular.</p>'; return;
    }
    const enganche = valor * (val(f, 'enganche') || 0) / 100;
    const credito = valor - enganche;
    const meses = +f.plazo.value * 12;
    const comision = credito * (val(f, 'comision') || 0) / 100;
    const seguros = val(f, 'seguros') || 0;
    const extra = val(f, 'extra') || 0;
    const gastos = valor * (val(f, 'gastos') || 0) / 100;
    const avaluo = val(f, 'avaluo') || 0;

    const base = amortizar(credito, tasa, meses, { cargoMensual: seguros });
    const conExtra = extra > 0 ? amortizar(credito, tasa, meses, { cargoMensual: seguros, extraMensual: extra }) : null;
    const cat = catEstimado(credito, comision, base.filas, seguros);
    const inicial = enganche + comision + gastos + avaluo;
    const totalPagos = base.filas.reduce((s, r) => s + r.pago, 0);

    $('#out', root).innerHTML = `
      <div class="kpis">
        ${resultado('Mensualidad', mxn(base.pago), { grande: true, nota: `${meses} pagos${seguros ? ', incluye seguros' : ''}` })}
        ${resultado('Monto del crédito', mxn(credito))}
        ${resultado('Pago inicial', mxn(inicial), { nota: `Enganche ${mxn(enganche)}${comision ? ` + comisión ${mxn(comision)}` : ''}${gastos ? ` + gastos ${mxn(gastos)}` : ''}${avaluo ? ` + avalúo ${mxn(avaluo)}` : ''}` })}
        ${resultado('CAT estimado (sin IVA)', pct(cat), { nota: 'Informativo. El CAT oficial lo publica cada banco.' })}
        ${resultado('Intereses totales', mxn(base.totalInteres), { nota: 'Exentos de IVA' })}
        ${resultado('Seguros totales', mxn(base.totalCargos))}
        ${resultado('Total pagado al banco', mxn(totalPagos + comision))}
        ${resultado('Costo total de la vivienda', mxn(inicial + totalPagos), { nota: 'Pago inicial + todas las mensualidades' })}
      </div>
      ${conExtra ? `
      <div class="callout">
        <h3>Con abono extra de ${mxn(extra)} al mes</h3>
        <p>Terminas en <strong>${conExtra.mesesReales} meses</strong> (${(conExtra.mesesReales / 12).toFixed(1)} años) en lugar de ${meses}: ahorras <strong>${meses - conExtra.mesesReales} mensualidades</strong> y <strong>${mxn(base.totalInteres - conExtra.totalInteres)}</strong> de intereses, más ${mxn(base.totalCargos - conExtra.totalCargos)} de seguros.</p>
      </div>` : ''}
      <details class="amort">
        <summary>Tabla de amortización${conExtra ? ' (con abono extra)' : ''}</summary>
        ${tabla([
          { titulo: 'Mes', valor: (r) => r.mes },
          { titulo: 'Pago', num: 1, valor: (r) => money(r.pago) },
          { titulo: 'Capital', num: 1, valor: (r) => money(r.capital) },
          { titulo: 'Interés', num: 1, valor: (r) => money(r.interes) },
          ...(seguros ? [{ titulo: 'Seguros', num: 1, valor: (r) => money(r.cargo) }] : []),
          { titulo: 'Saldo', num: 1, valor: (r) => money(r.saldo) },
        ], (conExtra ?? base).filas)}
      </details>`;
  };

  f.addEventListener('input', calcular);
  f.addEventListener('change', calcular);
  calcular();
}
