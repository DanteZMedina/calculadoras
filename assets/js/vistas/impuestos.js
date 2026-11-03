import { $, bindMoney, esc, mxn, money, pct, pct4, val } from '../util.js';
import { panelFuentes, tabla, resultado } from '../componentes.js';
import { sueldo, honorarios, resico, ivaCalc, PERIODOS } from '../impuestos.js';

const TABS = [
  { id: 'sueldo', nombre: 'Sueldo (ISR + IMSS)' },
  { id: 'honorarios', nombre: 'Honorarios' },
  { id: 'resico', nombre: 'RESICO' },
  { id: 'iva', nombre: 'IVA' },
];

export function render(root, { fiscal: F }, sub = 'sueldo') {
  if (!TABS.some((t) => t.id === sub)) sub = 'sueldo';
  root.innerHTML = `
  <header class="page-head">
    <h1>Retención de impuestos</h1>
    <p>ISR ${F.isr.anio} con las tarifas del Anexo 8 de la RMF, subsidio para el empleo, cuotas obreras del IMSS, IVA y RESICO. Ciudad de México.</p>
  </header>
  <nav class="subtabs" aria-label="Tipo de cálculo">
    ${TABS.map((t) => `<a href="#/impuestos/${t.id}" class="${t.id === sub ? 'active' : ''}">${t.nombre}</a>`).join('')}
  </nav>
  <div id="sub"></div>`;
  ({ sueldo: vSueldo, honorarios: vHonorarios, resico: vResico, iva: vIva })[sub]($('#sub', root), F);
}

function marco(root, F, formHTML, fuentes, calcular) {
  root.innerHTML = `
    <div class="layout">
      <form class="card form" autocomplete="off">${formHTML}</form>
      <section class="card results" aria-live="polite"><h2>Resultado</h2><div class="out"></div></section>
    </div>
    ${panelFuentes(fuentes, { generado: F.generado, avisos: F.avisos })}`;
  const f = $('form', root);
  bindMoney(root);
  const run = () => { $('.out', root).innerHTML = calcular(f); };
  f.addEventListener('input', run);
  f.addEventListener('change', run);
  run();
  return f;
}

function vSueldo(root, F) {
  const f = marco(root, F, `
    <h2>Sueldo</h2>
    <div class="grid">
      <label>Periodo de pago
        <select name="periodo">${Object.entries(PERIODOS).map(([k, p]) => `<option value="${k}" ${k === 'mensual' ? 'selected' : ''}>${p.etiqueta}</option>`).join('')}</select>
      </label>
      <label>Sueldo bruto del periodo<span class="input-money"><input class="money" name="ingreso" inputmode="decimal" placeholder="0.00"></span></label>
      <label>Días cotizados al IMSS en el periodo<input name="dias" type="number" min="1" max="31" step="1" value="30"></label>
      <label>Salario base de cotización diario (opcional)<span class="input-money"><input class="money" name="sbc" inputmode="decimal" placeholder="se estima"></span></label>
    </div>
    <p class="hint">Si no capturas el SBC, se estima con el factor de integración mínimo de ley: aguinaldo de ${F.lft.aguinaldoDias} días (art. 87 LFT), ${F.lft.vacacionesPrimerAnio} días de vacaciones (art. 76 LFT) y prima vacacional de ${pct(F.lft.primaVacacional, 0)} (art. 80 LFT). Se asume que todo el sueldo es gravado.</p>
  `, [F.isr.fuente, F.subsidio.fuente, F.uma.fuente, F.salarioMinimo.fuente, F.imss.fuente, F.lft.fuente], (f) => {
    const ingreso = val(f, 'ingreso');
    if (!(ingreso > 0)) return '<p class="empty">Captura el sueldo bruto del periodo.</p>';
    const r = sueldo(F, { ingreso, periodo: f.periodo.value, diasImss: val(f, 'dias') || PERIODOS[f.periodo.value].dias, sbcDiario: val(f, 'sbc') });
    const tr = r.t.tramo;
    return `
      <div class="kpis">
        ${resultado('Sueldo neto', mxn(r.neto), { grande: true, nota: `Periodo ${PERIODOS[f.periodo.value].etiqueta.toLowerCase()}` })}
        ${resultado('ISR a retener', mxn(r.isrRetener), { nota: r.esMinimo ? 'Salario mínimo: no se retiene ISR (art. 96 LISR)' : '' })}
        ${resultado('Cuotas IMSS del trabajador', mxn(r.imss), { nota: r.esMinimo ? 'Salario mínimo: las paga el patrón (art. 36 LSS)' : '' })}
        ${resultado('Tasa efectiva total', pct((ingreso - r.neto) / ingreso * 100))}
      </div>
      <h3>Cálculo del ISR</h3>
      ${tabla([{ titulo: 'Concepto', valor: (x) => x[0] }, { titulo: 'Importe', num: 1, html: (x) => x[1] }], [
        ['Ingreso gravable', money(ingreso)],
        ['(−) Límite inferior', money(tr.limiteInferior)],
        ['(=) Excedente', money(r.t.excedente)],
        ['(×) % sobre excedente', pct(tr.tasa)],
        ['(=) Impuesto marginal', money(r.t.marginal)],
        ['(+) Cuota fija', money(tr.cuotaFija)],
        ['(=) ISR según tarifa ' + r.tarifa.descripcion, money(r.t.isr)],
        [`(−) Subsidio para el empleo ${r.aplicaSubsidio ? '' : '(no aplica: ingreso mensual mayor a ' + money(F.subsidio.limiteIngresoMensual) + ')'}`, money(r.subsidio)],
        ['(=) ISR a retener', `<strong>${money(r.isrRetener)}</strong>`],
      ], { simple: true })}
      <p class="hint">Subsidio: ${pct(F.subsidio.porcentajeUmaMensual)} de la UMA mensual (${money(F.uma.mensual)}) = ${money(r.subsidioMensual)} al mes, para ingresos de hasta ${money(F.subsidio.limiteIngresoMensual)} mensuales.${F.subsidio.porcentajeTransitorioEnero ? ` En enero de ${F.isr.anio} el decreto aplicó ${pct(F.subsidio.porcentajeTransitorioEnero)}.` : ''} El subsidio no puede generar saldo a favor.</p>
      <h3>Cuotas obreras IMSS</h3>
      <p class="hint">SBC diario ${money(r.sbc)}${r.sbcTopado ? ` (topado a ${F.imss.topeSbcVeces} UMA)` : ''} · factor de integración ${r.factor.toFixed(4)} · UMA diaria ${money(F.uma.diaria)} (vigente desde ${esc(F.uma.vigenteDesde)})</p>
      ${tabla([
        { titulo: 'Rama', valor: (c) => c.concepto },
        { titulo: 'Base', valor: (c) => (c.base === 'excedente' ? `Excedente de ${F.imss.umbralExcedenteVeces} UMA: ${money(r.excedente)}/día` : 'SBC') },
        { titulo: 'Tasa', num: 1, valor: (c) => pct4(c.tasa) },
        { titulo: 'Importe', num: 1, valor: (c) => money(c.monto) },
        { titulo: 'Fundamento', valor: (c) => c.fundamento },
      ], r.cuotas, { pie: ['Total', '', '', `<strong>${money(r.imss)}</strong>`, ''] })}`;
  });
  // ajusta días IMSS sugeridos al cambiar de periodo
  f.periodo.addEventListener('change', () => { f.dias.value = PERIODOS[f.periodo.value].dias; f.dispatchEvent(new Event('input')); });
}

function vHonorarios(root, F) {
  marco(root, F, `
    <h2>Recibo de honorarios</h2>
    <div class="grid">
      <label>Importe de los servicios (sin IVA)<span class="input-money"><input class="money" name="monto" inputmode="decimal" placeholder="0.00"></span></label>
    </div>
    <label class="check"><input type="checkbox" name="pm" checked> El cliente es persona moral (debe retener ISR e IVA)</label>
  `, [F.honorarios.fuente, F.iva.fuente, F.iva.fuenteRetencion], (f) => {
    const monto = val(f, 'monto');
    if (!(monto > 0)) return '<p class="empty">Captura el importe de tus servicios.</p>';
    const r = honorarios(F, { monto, clientePM: f.pm.checked });
    return `
      <div class="kpis">
        ${resultado('Recibes', mxn(r.neto), { grande: true })}
        ${resultado('Total de la factura', mxn(r.total))}
      </div>
      ${tabla([{ titulo: 'Concepto', valor: (x) => x[0] }, { titulo: 'Importe', num: 1, html: (x) => x[1] }], [
        ['Subtotal', money(monto)],
        [`(+) IVA trasladado ${pct(F.iva.tasaGeneral, 0)}`, money(r.iva)],
        ['(=) Total', money(r.total)],
        [`(−) Retención ISR ${pct(F.honorarios.retencionIsrPersonaMoral, 0)} (art. 106 LISR)`, money(r.retIsr)],
        [`(−) Retención IVA (dos terceras partes, art. 3 RLIVA)`, money(r.retIva)],
        ['(=) Neto a recibir', `<strong>${money(r.neto)}</strong>`],
      ], { simple: true })}
      <p class="hint">La retención de ISR es un pago provisional acreditable contra tu pago mensual; el IVA retenido se acredita en tu declaración mensual de IVA.</p>`;
  });
}

function vResico(root, F) {
  marco(root, F, `
    <h2>RESICO persona física</h2>
    <div class="grid">
      <label>Ingresos cobrados del mes (sin IVA)<span class="input-money"><input class="money" name="ingresos" inputmode="decimal" placeholder="0.00"></span></label>
      <label>De ellos, cobrados a personas morales<span class="input-money"><input class="money" name="pm" inputmode="decimal" placeholder="0.00"></span></label>
    </div>
  `, [F.resico.fuente, F.iva.fuente], (f) => {
    const ingresos = val(f, 'ingresos');
    if (!(ingresos > 0)) return '<p class="empty">Captura tus ingresos cobrados del mes.</p>';
    const r = resico(F, { ingresos, facturadoPM: val(f, 'pm') });
    if (r.excede) return `<p class="aviso">Los ingresos superan el límite de la tabla del art. 113-E (${money(F.resico.tablaMensual.at(-1).hasta)}).</p>`;
    return `
      <div class="kpis">
        ${resultado('ISR a pagar del mes', mxn(r.aPagar), { grande: true })}
        ${resultado('ISR causado', mxn(r.isr), { nota: `Tasa ${pct(r.tramo.tasa)} sobre ingresos de hasta ${money(r.tramo.hasta)}` })}
        ${resultado('ISR retenido por personas morales', mxn(r.retenido), { nota: `${pct(F.resico.retencionPersonaMoral)} (art. 113-J LISR)` })}
        ${resultado(`IVA trasladado ${pct(F.iva.tasaGeneral, 0)}`, mxn(r.iva))}
      </div>
      <h3>Tabla mensual art. 113-E LISR</h3>
      ${tabla([{ titulo: 'Ingresos mensuales hasta', num: 1, valor: (t) => money(t.hasta) }, { titulo: 'Tasa', num: 1, html: (t) => (t === r.tramo ? `<strong>${pct(t.tasa)}</strong>` : pct(t.tasa)) }], F.resico.tablaMensual, { simple: true })}`;
  });
}

function vIva(root, F) {
  marco(root, F, `
    <h2>IVA</h2>
    <div class="grid">
      <label>Monto<span class="input-money"><input class="money" name="monto" inputmode="decimal" placeholder="0.00"></span></label>
      <label>Operación
        <select name="modo"><option value="agregar">Agregar IVA a un precio sin IVA</option><option value="desglosar">Desglosar IVA de un precio con IVA</option></select>
      </label>
    </div>
  `, [F.iva.fuente], (f) => {
    const monto = val(f, 'monto');
    if (!(monto > 0)) return '<p class="empty">Captura un monto.</p>';
    const r = ivaCalc(F, { monto, modo: f.modo.value });
    return `<div class="kpis">
      ${resultado('Subtotal', mxn(r.base))}
      ${resultado(`IVA ${pct(F.iva.tasaGeneral, 0)}`, mxn(r.iva))}
      ${resultado('Total', mxn(r.total), { grande: true })}
    </div>
    <p class="hint">Tasa general del art. 1o. de la LIVA, leída del texto vigente publicado por la Cámara de Diputados (última reforma DOF ${esc(F.iva.fuente.ultimaReforma)}).</p>`;
  });
}
