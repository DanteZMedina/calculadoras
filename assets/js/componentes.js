// Piezas de interfaz reutilizables: panel de fuentes, avisos y tablas responsivas.
import { esc, fecha } from './util.js';

/** Bloque "Fuentes de este cálculo" a partir de objetos {nombre,url,consultado,publicacion,fundamento,ultimaReforma}. */
export function panelFuentes(fuentes, { generado, avisos = [], extra = '' } = {}) {
  const items = fuentes.filter(Boolean).map((f) => `
    <li>
      <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nombre)}</a>
      ${f.desactualizado ? '<span class="tag tag-warn">no se pudo refrescar</span>' : ''}
      <div class="fuente-meta">
        ${f.fundamento ? `<span>${esc(f.fundamento)}</span>` : ''}
        ${f.publicacion ? `<span>Publicación: ${esc(f.publicacion)}</span>` : ''}
        ${f.ultimaReforma ? `<span>Última reforma: DOF ${esc(f.ultimaReforma)}</span>` : ''}
        ${f.consultado ? `<span>Consultado: ${esc(fecha(f.consultado))}</span>` : ''}
      </div>
    </li>`).join('');
  return `
    <details class="fuentes">
      <summary>Fuentes oficiales de este cálculo</summary>
      <ul>${items}</ul>
      ${extra}
      ${generado ? `<p class="nota">Datos extraídos automáticamente de los documentos oficiales el ${esc(fecha(generado))}.</p>` : ''}
      ${avisos.map((a) => `<p class="aviso">${esc(a)}</p>`).join('')}
    </details>`;
}

/** Tabla que en móvil se apila en tarjetas (evita scroll horizontal). */
export function tabla(columnas, filas, { clase = '', pie, simple = false } = {}) {
  if (simple) clase += ' tabla-simple';
  const th = columnas.map((c) => `<th class="${c.num ? 'n' : ''}">${esc(c.titulo)}</th>`).join('');
  const tr = filas.map((f) => `<tr>${columnas.map((c) => `<td class="${c.num ? 'n' : ''}" data-label="${esc(c.titulo)}">${c.html ? c.html(f) : esc(c.valor(f))}</td>`).join('')}</tr>`).join('');
  const tf = pie ? `<tfoot><tr>${pie.map((p, i) => `<td class="${columnas[i]?.num ? 'n' : ''}" data-label="${esc(columnas[i]?.titulo ?? '')}">${p}</td>`).join('')}</tr></tfoot>` : '';
  return `<table class="tabla ${clase}"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody>${tf}</table>`;
}

export const resultado = (titulo, valor, { grande = false, nota = '' } = {}) => `
  <div class="kpi ${grande ? 'kpi-big' : ''}">
    <span class="kpi-label">${esc(titulo)}</span>
    <span class="kpi-value">${valor}</span>
    ${nota ? `<span class="kpi-note">${nota}</span>` : ''}
  </div>`;

export const enlaces = (lista) => `<ul class="links">${lista.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.nombre)}</a></li>`).join('')}</ul>`;
