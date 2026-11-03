// Carga de datos oficiales generados por scripts/actualizar_datos.py.

const cache = {};
const cargar = (nombre) => (cache[nombre] ??= fetch(`data/${nombre}.json`, { cache: 'no-cache' })
  .then((r) => { if (!r.ok) throw new Error(`No se pudo cargar data/${nombre}.json`); return r.json(); }));

export const fiscal = () => cargar('fiscal');
export const mercado = () => cargar('mercado').catch(() => ({}));
export const catalogo = () => cargar('catalogo');

export const todos = () => Promise.all([fiscal(), mercado(), catalogo()]).then(([f, m, c]) => ({ fiscal: f, mercado: m, catalogo: c }));
