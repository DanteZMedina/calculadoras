import { esc, fecha, money } from '../util.js';

export const CALCULADORAS = [
  { ruta: 'auto', tema: 'auto', corto: 'Auto', titulo: 'Crédito de auto', desc: 'Mensualidad, CAT estimado e histórico de ofertas de tus autos.', icono: '<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M5 11h14M5 11a2 2 0 0 0-2 2v3h2m14-5a2 2 0 0 1 2 2v3h-2M5 16v2m14-2v2M7.5 14h.01M16.5 14h.01"/>' },
  { ruta: 'hipoteca', tema: 'hipoteca', corto: 'Hipoteca', titulo: 'Crédito hipotecario', desc: 'Mensualidad, gastos iniciales y ahorro con abonos a capital.', icono: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/>' },
  { ruta: 'seguro', tema: 'seguro', corto: 'Seguro', titulo: 'Seguro de auto', desc: 'Compara cotizaciones: prima con IVA, deducibles y siniestros.', icono: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>' },
  { ruta: 'impuestos', tema: 'impuestos', corto: 'Impuestos', titulo: 'Retención de impuestos', desc: 'ISR, subsidio, IMSS, honorarios, RESICO e IVA.', icono: '<path d="M7 3h10v18l-2-1.5L13 21l-1-1.5L11 21l-2-1.5L7 21V3z"/><path d="M10 8h4M10 12h4"/>' },
];

export const icono = (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${c.icono}</svg>`;

export function render(root, { fiscal }) {
  root.innerHTML = `
  <section class="hero">
    <h1>Calculadoras financieras</h1>
    <p>Cálculos rápidos para la Ciudad de México con datos de fuentes oficiales: SAT, DOF, INEGI, CONASAMI, Cámara de Diputados y Banxico.</p>
  </section>
  <div class="cards">
    ${CALCULADORAS.map((c) => `
      <a class="calc-card" data-tema="${c.tema}" href="#/${c.ruta}">
        <span class="calc-icon">${icono(c)}</span>
        <span class="calc-title">${c.titulo}</span>
        <span class="calc-desc">${c.desc}</span>
      </a>`).join('')}
  </div>
  <section class="datos-clave">
    <h2>Datos vigentes</h2>
    <dl>
      <div><dt>IVA tasa general</dt><dd>${fiscal.iva.tasaGeneral}%</dd></div>
      <div><dt>UMA diaria</dt><dd>${money(fiscal.uma.diaria)}</dd></div>
      <div><dt>Salario mínimo CDMX</dt><dd>${money(fiscal.salarioMinimo.general)}</dd></div>
      <div><dt>Tarifas ISR</dt><dd>${esc(fiscal.isr.anio)}</dd></div>
    </dl>
    <p class="nota">Actualizado el ${esc(fecha(fiscal.generado))}. <a href="#/fuentes">Ver todas las fuentes</a></p>
  </section>`;
}
