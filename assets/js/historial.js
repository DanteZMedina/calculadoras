// Histórico de ofertas de autos: se guarda solo en este navegador (localStorage) y se exporta/importa como archivo.
import { aCSV, descargar, mesClave } from './util.js';

const CLAVE = 'calculadoras-mx:ofertas-auto:v1';

export const listar = () => {
  try { return JSON.parse(localStorage.getItem(CLAVE)) ?? []; } catch { return []; }
};
const guardarTodo = (lista) => localStorage.setItem(CLAVE, JSON.stringify(lista));

export function agregar(oferta) {
  const lista = listar();
  const ahora = new Date();
  lista.push({ id: crypto.randomUUID?.() ?? String(ahora.getTime()), fecha: ahora.toISOString(), mes: mesClave(ahora), ...oferta });
  guardarTodo(lista);
}

export function eliminar(id) { guardarTodo(listar().filter((o) => o.id !== id)); }

export const COLUMNAS = [
  { titulo: 'Fecha', valor: (o) => o.fecha.slice(0, 10) },
  { titulo: 'Mes', valor: 'mes' },
  { titulo: 'Vehículo', valor: 'vehiculo' },
  { titulo: 'Versión', valor: 'version' },
  { titulo: 'Financiera', valor: 'financiera' },
  { titulo: 'Precio lista', valor: 'precioLista' },
  { titulo: 'Descuento', valor: 'descuento' },
  { titulo: 'Precio neto', valor: 'precioNeto' },
  { titulo: 'Enganche', valor: 'enganche' },
  { titulo: 'Plazo (meses)', valor: 'plazo' },
  { titulo: 'Tasa anual %', valor: 'tasa' },
  { titulo: 'Comisión apertura %', valor: 'comision' },
  { titulo: 'Mensualidad', valor: 'mensualidad' },
  { titulo: 'CAT estimado %', valor: (o) => (Number.isFinite(o.cat) ? o.cat.toFixed(2) : '') },
  { titulo: 'Total pagado', valor: 'totalPagado' },
  { titulo: 'Costo del crédito', valor: 'costoCredito' },
  { titulo: 'Fuente de la oferta', valor: 'fuenteOferta' },
  { titulo: 'Notas', valor: 'notas' },
];

export function exportarCSV() {
  descargar(`ofertas-autos-${mesClave()}.csv`, aCSV(listar(), COLUMNAS), 'text/csv;charset=utf-8');
}

export function exportarJSON() {
  descargar(`ofertas-autos-${mesClave()}.json`, JSON.stringify({ version: 1, exportado: new Date().toISOString(), ofertas: listar() }, null, 2), 'application/json');
}

/** Importa un JSON exportado previamente; combina por id sin duplicar. Devuelve cuántas se agregaron. */
export async function importarJSON(file) {
  const data = JSON.parse(await file.text());
  const nuevas = Array.isArray(data) ? data : data.ofertas;
  if (!Array.isArray(nuevas)) throw new Error('El archivo no contiene ofertas');
  const lista = listar();
  const ids = new Set(lista.map((o) => o.id));
  let n = 0;
  for (const o of nuevas) if (o?.id && o.mes && !ids.has(o.id)) { lista.push(o); ids.add(o.id); n++; }
  guardarTodo(lista);
  return n;
}

/** Para cada vehículo: mejor oferta por mes (menor precio neto y menor total pagado) y el mejor mes global. */
export function analisis(lista = listar()) {
  const porVehiculo = {};
  for (const o of lista) {
    const v = (porVehiculo[o.vehiculo] ??= {});
    const m = (v[o.mes] ??= { mes: o.mes, mejorPrecio: null, mejorTotal: null, n: 0 });
    m.n++;
    if (Number.isFinite(o.precioNeto) && (!m.mejorPrecio || o.precioNeto < m.mejorPrecio.precioNeto)) m.mejorPrecio = o;
    if (Number.isFinite(o.totalPagado) && (!m.mejorTotal || o.totalPagado < m.mejorTotal.totalPagado)) m.mejorTotal = o;
  }
  return Object.entries(porVehiculo).map(([vehiculo, meses]) => {
    const filas = Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes));
    const conPrecio = filas.filter((f) => f.mejorPrecio);
    const conTotal = filas.filter((f) => f.mejorTotal);
    return {
      vehiculo,
      meses: filas,
      mejorMesPrecio: conPrecio.reduce((a, b) => (!a || b.mejorPrecio.precioNeto < a.mejorPrecio.precioNeto ? b : a), null),
      mejorMesTotal: conTotal.reduce((a, b) => (!a || b.mejorTotal.totalPagado < a.mejorTotal.totalPagado ? b : a), null),
    };
  });
}
