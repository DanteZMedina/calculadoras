import { $, bindMoney, esc, mxn, money, num, parse, fecha } from '../util.js';
import { panelFuentes, tabla, enlaces } from '../componentes.js';

const CLAVE = 'calculadoras-mx:cotizaciones-seguro:v1';
const SEGURO_KEY = 'calculadoras-mx:seguro-elegido';
const PAGOS = { anual: 1, semestral: 2, trimestral: 4, mensual: 12 };

const cargarCot = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) ?? []; } catch { return []; } };
const guardarCot = (l) => localStorage.setItem(CLAVE, JSON.stringify(l));

export function render(root, { fiscal, catalogo }) {
  const iva = fiscal.iva;
  const aseg = catalogo.aseguradoras;
  let cot = cargarCot();
  if (!cot.length) cot = [nueva(aseg[0].nombre), nueva(aseg[1].nombre)];

  root.innerHTML = `
  <header class="page-head">
    <h1>Seguro de auto</h1>
    <p>Compara las cotizaciones que obtengas en los cotizadores oficiales: costo anual, pago por periodo y cuánto pagarías de deducible en un siniestro.</p>
  </header>

  <section class="card">
    <h2>Tu vehículo</h2>
    <div class="grid">
      <label>Vehículo
        <select id="veh">${catalogo.vehiculos.map((v) => `<option>${esc(v.nombre)}</option>`).join('')}<option>Otro</option></select>
      </label>
      <label>Suma asegurada (valor factura o comercial)<span class="input-money"><input class="money" id="suma" inputmode="decimal" placeholder="0.00"></span></label>
      <label>Las primas que capturo
        <select id="modo"><option value="desglose">Vienen desglosadas (prima neta + gastos)</option><option value="total">Son la prima total con IVA</option></select>
      </label>
    </div>
    <p class="hint">Cotiza con tu código postal de la CDMX en: ${aseg.map((a) => `<a href="${a.url}" target="_blank" rel="noopener">${esc(a.nombre)}</a>`).join(' · ')}</p>
  </section>

  <section class="card">
    <div class="row-between"><h2>Cotizaciones</h2><button class="btn" id="add" type="button">Agregar cotización</button></div>
    <div id="cots" class="cots"></div>
  </section>

  <section class="card results" aria-live="polite">
    <h2>Comparación</h2>
    <div id="out"></div>
  </section>

  ${panelFuentes([iva.fuente], { generado: fiscal.generado, avisos: fiscal.avisos, extra: `
    <p class="nota">Este sitio no es agente ni intermediario de seguros: no vende pólizas, no recibe comisiones y no envía tus datos a ninguna aseguradora. Los resultados se ordenan solo por los montos que capturas.</p>
    <p class="nota">Las primas de seguro se calculan con el perfil del conductor, código postal y modelo; no existen tarifas públicas, por eso se capturan desde el cotizador oficial de cada aseguradora. El IVA se aplica con la tasa general vigente de la LIVA.</p>
    ${enlaces([...aseg, ...catalogo.referencias.filter((r) => /AMIS|CONDUSEF/.test(r.nombre))])}` })}
  `;

  const suma = $('#suma', root);
  bindMoney(suma.closest('section'));
  const modo = $('#modo', root);

  const pintarCots = () => {
    const desglose = modo.value === 'desglose';
    $('#cots', root).innerHTML = cot.map((c, i) => `
      <fieldset class="cot" data-i="${i}">
        <div class="row-between">
          <legend>Cotización ${i + 1}</legend>
          <button type="button" class="btn-link" data-del="${i}">Quitar</button>
        </div>
        <div class="grid">
          <label>Aseguradora<select data-k="aseguradora">${[...aseg.map((a) => a.nombre), 'Otra'].map((n) => `<option ${n === c.aseguradora ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
          <label>Cobertura<select data-k="cobertura">${['Amplia', 'Limitada', 'Responsabilidad civil'].map((n) => `<option ${n === c.cobertura ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>${desglose ? 'Prima neta anual' : 'Prima total anual (con IVA)'}<span class="input-money"><input class="money" data-k="prima" inputmode="decimal" value="${c.prima ? num(c.prima) : ''}" placeholder="0.00"></span></label>
          ${desglose ? `
          <label>Gastos de expedición<span class="input-money"><input class="money" data-k="expedicion" inputmode="decimal" value="${c.expedicion ? num(c.expedicion) : ''}" placeholder="0.00"></span></label>
          <label>Recargo por pago fraccionado (%)<input type="number" step="0.01" min="0" data-k="recargo" value="${c.recargo ?? ''}" placeholder="0"></label>` : ''}
          <label>Forma de pago<select data-k="pago">${Object.keys(PAGOS).map((p) => `<option value="${p}" ${p === c.pago ? 'selected' : ''}>${p[0].toUpperCase() + p.slice(1)}</option>`).join('')}</select></label>
          <label>Deducible daños materiales (%)<input type="number" step="0.5" min="0" data-k="dedDM" value="${c.dedDM ?? ''}" placeholder="p. ej. 5"></label>
          <label>Deducible robo total (%)<input type="number" step="0.5" min="0" data-k="dedRT" value="${c.dedRT ?? ''}" placeholder="p. ej. 10"></label>
          <label>Fecha de la cotización<input type="date" data-k="fecha" value="${esc(c.fecha ?? '')}"></label>
        </div>
      </fieldset>`).join('');
    bindMoney($('#cots', root));
  };

  const calcular = () => {
    guardarCot(cot);
    const S = suma.value.trim() === '' ? NaN : parse(suma.value);
    const desglose = modo.value === 'desglose';
    const errores = [];
    if (suma.value.trim() !== '' && !(S > 0)) errores.push('Suma asegurada: escribe un monto mayor a cero, por ejemplo 450,000.00.');
    cot.forEach((c, i) => {
      const n = `Cotización ${i + 1}`;
      for (const [k, et, max] of [['prima', 'la prima', Infinity], ['expedicion', 'los gastos de expedición', Infinity], ['recargo', 'el recargo', 100], ['dedDM', 'el deducible de daños', 100], ['dedRT', 'el deducible de robo', 100]]) {
        const v = c[k];
        if (v == null || v === '' ) continue;
        if (!Number.isFinite(v)) errores.push(`${n}: ${et} debe ser un número.`);
        else if (v < 0) errores.push(`${n}: ${et} no puede ser negativo.`);
        else if (v > max) errores.push(`${n}: ${et} no puede ser mayor a ${max}%.`);
      }
    });
    if (errores.length) { $('#out', root).innerHTML = errores.map((e) => `<p class="aviso">${esc(e)}</p>`).join(''); return; }
    const filas = cot.map((c) => {
      const prima = c.prima || 0;
      let subtotal, ivaMonto, total;
      if (desglose) {
        subtotal = prima + (c.expedicion || 0) + prima * (c.recargo || 0) / 100;
        ivaMonto = subtotal * iva.tasaGeneral / 100;
        total = subtotal + ivaMonto;
      } else {
        total = prima;
        ivaMonto = total - total / (1 + iva.tasaGeneral / 100);
      }
      const dm = Number.isFinite(S) && c.dedDM ? S * c.dedDM / 100 : NaN;
      const rt = Number.isFinite(S) && c.dedRT ? S * c.dedRT / 100 : NaN;
      return { ...c, total, ivaMonto, periodo: total / PAGOS[c.pago], dm, rt, conDM: total + (dm || 0) };
    }).filter((r) => r.total > 0);

    if (!filas.length) { $('#out', root).innerHTML = '<p class="empty">Captura al menos una prima para comparar.</p>'; return; }
    const min = (k) => Math.min(...filas.map((r) => r[k]).filter(Number.isFinite));
    const mejor = { total: min('total'), conDM: min('conDM'), dm: min('dm'), rt: min('rt') };
    const marca = (v, k) => (Number.isFinite(v) && v === mejor[k] && filas.length > 1 ? ' <span class="tag">mejor</span>' : '');
    const ganador = filas.find((r) => r.total === mejor.total);
    const coberturas = new Set(filas.map((r) => r.cobertura));
    const dedDistintos = new Set(filas.map((r) => `${r.dedDM}|${r.dedRT}`)).size > 1;

    $('#out', root).innerHTML = `
      ${coberturas.size > 1 ? '<p class="aviso">Estás comparando coberturas distintas: la prima más baja puede cubrir menos. Compara Amplia con Amplia, Limitada con Limitada.</p>' : ''}
      ${dedDistintos && filas.length > 1 ? '<p class="hint">Los deducibles son distintos entre cotizaciones; revisa la columna «Año con 1 siniestro».</p>' : ''}
      ${tabla([
        { titulo: 'Aseguradora', valor: (r) => `${r.aseguradora} · ${r.cobertura}${r.fecha ? ` · ${fecha(r.fecha)}` : ''}` },
        { titulo: 'Prima anual total', num: 1, html: (r) => money(r.total) + marca(r.total, 'total') },
        { titulo: 'IVA incluido', num: 1, valor: (r) => money(r.ivaMonto) },
        { titulo: 'Pago por periodo', num: 1, valor: (r) => `${money(r.periodo)} ${r.pago}` },
        { titulo: 'Deducible daños', num: 1, html: (r) => (Number.isFinite(r.dm) ? money(r.dm) + marca(r.dm, 'dm') : '—') },
        { titulo: 'Deducible robo', num: 1, html: (r) => (Number.isFinite(r.rt) ? money(r.rt) + marca(r.rt, 'rt') : '—') },
        { titulo: 'Año con 1 siniestro', num: 1, html: (r) => (Number.isFinite(r.dm) ? money(r.conDM) + marca(r.conDM, 'conDM') : '—') },
        { titulo: '', html: (r) => `<button class="btn-link" data-usar="${esc(r.aseguradora)}|${r.total}">Usar en crédito</button>` },
      ], filas)}
      <p class="hint">Costo anual más bajo: <strong>${esc(ganador.aseguradora)}</strong> con ${mxn(ganador.total)}. Compara también la cobertura y el deducible: una prima baja con deducible alto puede salir más cara si tienes un siniestro.${PAGOS[ganador.pago] > 1 ? ' En pagos fraccionados el primer recibo suele incluir los gastos de expedición; el pago por periodo mostrado es un promedio.' : ''}</p>`;
  };

  $('#cots', root).addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    const i = +e.target.closest('.cot').dataset.i;
    cot[i][k] = e.target.tagName === 'SELECT' || e.target.type === 'date' ? e.target.value : parse(e.target.value);
    calcular();
  });
  $('#cots', root).addEventListener('click', (e) => {
    if (e.target.dataset.del == null) return;
    cot.splice(+e.target.dataset.del, 1);
    pintarCots(); calcular();
  });
  $('#add', root).addEventListener('click', () => { cot.push(nueva(aseg[cot.length % aseg.length].nombre)); pintarCots(); calcular(); });
  $('#out', root).addEventListener('click', (e) => {
    const u = e.target.dataset.usar;
    if (!u) return;
    const [aseguradora, total] = u.split('|');
    sessionStorage.setItem(SEGURO_KEY, JSON.stringify({ aseguradora, primaAnual: +total }));
    location.hash = '#/auto';
  });
  suma.addEventListener('input', calcular);
  modo.addEventListener('change', () => { pintarCots(); calcular(); });

  pintarCots();
  calcular();
}

const nueva = (aseguradora) => ({ aseguradora, cobertura: 'Amplia', prima: null, expedicion: null, recargo: null, pago: 'anual', dedDM: null, dedRT: null });
