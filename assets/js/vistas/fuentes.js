import { esc, fecha, money, pct } from '../util.js';
import { tabla, enlaces } from '../componentes.js';
import { referenciaBanxico } from './auto.js';

export function render(root, { fiscal: F, mercado, catalogo }) {
  const fuentes = [
    ['ISR – tarifas', F.isr], ['Subsidio para el empleo', F.subsidio], ['UMA', F.uma], ['Salario mínimo', F.salarioMinimo],
    ['IVA', F.iva], ['IMSS – cuotas obreras', F.imss], ['LFT – prestaciones mínimas', F.lft],
    ['Honorarios – retención ISR', F.honorarios], ['RESICO', F.resico],
  ];
  root.innerHTML = `
  <header class="page-head">
    <h1>Fuentes oficiales</h1>
    <p>Cada dato se extrae automáticamente de los documentos oficiales publicados. Si una fuente cambia de formato y no se puede leer, se conserva el último valor y aparece un aviso.</p>
  </header>
  <section class="card">
    <p>Última actualización: <strong>${esc(fecha(F.generado))}</strong></p>
    ${(F.avisos ?? []).map((a) => `<p class="aviso">${esc(a)}</p>`).join('')}
    ${tabla([
      { titulo: 'Dato', valor: (x) => x[0] },
      { titulo: 'Documento', html: (x) => `<a href="${esc(x[1].fuente.url)}" target="_blank" rel="noopener">${esc(x[1].fuente.nombre)}</a>${x[1].desactualizado ? ' <span class="tag tag-warn">no se pudo refrescar</span>' : ''}` },
      { titulo: 'Fundamento', valor: (x) => x[1].fuente.fundamento ?? '' },
      { titulo: 'Publicación / reforma', valor: (x) => x[1].fuente.publicacion ?? (x[1].fuente.ultimaReforma ? `DOF ${x[1].fuente.ultimaReforma}` : '') },
    ], fuentes)}
  </section>

  <section class="card">
    <h2>Valores en uso</h2>
    ${tabla([{ titulo: 'Concepto', valor: (x) => x[0] }, { titulo: 'Valor', num: 1, valor: (x) => x[1] }], [
      ['IVA tasa general', pct(F.iva.tasaGeneral, 0)],
      ['UMA diaria / mensual / anual', `${money(F.uma.diaria)} / ${money(F.uma.mensual)} / ${money(F.uma.anual)}`],
      ['Salario mínimo general (CDMX)', money(F.salarioMinimo.general)],
      ['Subsidio para el empleo', `${pct(F.subsidio.porcentajeUmaMensual)} UMA mensual, ingresos ≤ ${money(F.subsidio.limiteIngresoMensual)}`],
      ['Tope SBC IMSS', `${F.imss.topeSbcVeces} UMA`],
      ['Retención ISR honorarios (PM)', pct(F.honorarios.retencionIsrPersonaMoral, 0)],
      ['Retención IVA honorarios (PM)', `${(F.iva.retencionPersonasFisicasFraccion * 100).toFixed(4)}% del IVA`],
      ['Retención RESICO (PM)', pct(F.resico.retencionPersonaMoral)],
    ], { simple: true })}
    <details class="amort"><summary>Tarifa mensual ISR ${esc(F.isr.anio)} (Anexo 8 RMF)</summary>
      ${tabla([
        { titulo: 'Límite inferior', num: 1, valor: (t) => money(t.limiteInferior) },
        { titulo: 'Límite superior', num: 1, valor: (t) => (t.limiteSuperior == null ? 'En adelante' : money(t.limiteSuperior)) },
        { titulo: 'Cuota fija', num: 1, valor: (t) => money(t.cuotaFija) },
        { titulo: '% excedente', num: 1, valor: (t) => pct(t.tasa) },
      ], F.isr.tarifas.mensual.tramos)}
    </details>
  </section>

  <section class="card">
    <h2>Mercado y referencias</h2>
    ${referenciaBanxico(mercado)}
    ${(mercado.avisos ?? []).map((a) => `<p class="aviso">${esc(a)}</p>`).join('')}
    ${enlaces(catalogo.referencias)}
  </section>`;
}
