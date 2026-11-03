// Utilidades compartidas: formato es-MX, lectura de campos y helpers de DOM.

const fmtMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum4 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** $37,000.00 MXN */
export const mxn = (v) => (Number.isFinite(v) ? `${fmtMXN.format(v).replace('MX$', '$')} MXN` : '—');
/** $37,000.00 (sin sufijo, para tablas) */
export const money = (v) => (Number.isFinite(v) ? fmtMXN.format(v).replace('MX$', '$') : '—');
export const num = (v) => (Number.isFinite(v) ? fmtNum.format(v) : '—');
export const pct = (v, dec = 2) => (Number.isFinite(v) ? `${v.toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec })}%` : '—');
export const pct4 = (v) => (Number.isFinite(v) ? `${fmtNum4.format(v)}%` : '—');

export const parse = (s) => {
  if (typeof s === 'number') return s;
  const n = parseFloat(String(s ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Lee el valor numérico de un campo por name dentro de un formulario. */
export const val = (form, name) => parse(form.elements[name]?.value);

/** Da formato con separador de miles a los campos .money al salir del campo. */
export function bindMoney(root) {
  $$('input.money', root).forEach((inp) => {
    inp.addEventListener('blur', () => {
      const n = parse(inp.value);
      inp.value = Number.isFinite(n) ? num(n) : '';
    });
    inp.addEventListener('focus', () => {
      const n = parse(inp.value);
      inp.value = Number.isFinite(n) ? String(n) : '';
    });
  });
}

export const setMoney = (inp, v) => { if (inp) inp.value = Number.isFinite(v) ? num(v) : ''; };

export function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nombre });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

export function aCSV(filas, columnas) {
  const q = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columnas.map((c) => q(c.titulo)).join(',');
  const body = filas.map((f) => columnas.map((c) => q(typeof c.valor === 'function' ? c.valor(f) : f[c.valor])).join(','));
  return '﻿' + [head, ...body].join('\n');
}

export const fecha = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const mesClave = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const mesNombre = (clave) => {
  const [y, m] = clave.split('-').map(Number);
  const t = new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return t[0].toUpperCase() + t.slice(1);
};
