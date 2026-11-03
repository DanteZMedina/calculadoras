// Cálculos fiscales puros. Todos los parámetros vienen de data/fiscal.json (fuentes oficiales).

/** Aplica una tarifa del Anexo 8 (límite inferior, cuota fija, % sobre excedente). */
export function aplicarTarifa(base, tramos) {
  if (!(base > 0)) return { isr: 0, tramo: null };
  let tramo = tramos[0];
  for (const t of tramos) if (base >= t.limiteInferior) tramo = t;
  const excedente = base - tramo.limiteInferior;
  const marginal = excedente * tramo.tasa / 100;
  return { isr: tramo.cuotaFija + marginal, tramo, excedente, marginal };
}

export const PERIODOS = {
  diario: { tarifa: 'diaria', dias: 1, etiqueta: 'Diario' },
  semanal: { tarifa: 'semanal', dias: 7, etiqueta: 'Semanal' },
  decenal: { tarifa: 'decenal', dias: 10, etiqueta: 'Decenal' },
  quincenal: { tarifa: 'quincenal', dias: 15, etiqueta: 'Quincenal' },
  mensual: { tarifa: 'mensual', dias: 30, etiqueta: 'Mensual' },
};

/**
 * Retención de ISR e IMSS para sueldos y salarios.
 * @param {object} F  fiscal.json
 * @param {object} p  { ingreso, periodo, diasImss, sbcDiario? }
 */
export function sueldo(F, { ingreso, periodo, diasImss, sbcDiario }) {
  const per = PERIODOS[periodo];
  const tarifa = F.isr.tarifas[per.tarifa];
  const diasIsr = periodo === 'mensual' ? F.subsidio.divisorDiario : per.dias;
  const salarioDiario = ingreso / diasImss;
  const sm = F.salarioMinimo.general;
  const esMinimo = salarioDiario <= sm + 0.005;

  // ISR (art. 96 LISR, tarifa del Anexo 8)
  const t = aplicarTarifa(ingreso, tarifa.tramos);
  // Subsidio para el empleo (decreto DOF): % de UMA mensual, proporcional por días si el periodo es menor a un mes
  const mensualEquivalente = periodo === 'mensual' ? ingreso : (ingreso / per.dias) * F.subsidio.divisorDiario;
  const subsidioMensual = F.uma.mensual * F.subsidio.porcentajeUmaMensual / 100;
  const aplicaSubsidio = mensualEquivalente <= F.subsidio.limiteIngresoMensual;
  const subsidio = aplicaSubsidio ? (periodo === 'mensual' ? subsidioMensual : Math.min(subsidioMensual / F.subsidio.divisorDiario * per.dias, subsidioMensual)) : 0;
  const isrRetener = esMinimo ? 0 : Math.max(t.isr - subsidio, 0);

  // IMSS cuota obrera (LSS). Referencias a salario mínimo del DF se leen en UMA.
  const umaD = F.uma.diaria;
  const factor = 1 + (F.lft.aguinaldoDias + F.lft.vacacionesPrimerAnio * F.lft.primaVacacional / 100) / 365;
  const sbcSinTope = sbcDiario > 0 ? sbcDiario : salarioDiario * factor;
  const sbc = Math.min(Math.max(sbcSinTope, sm), F.imss.topeSbcVeces * umaD);
  const excedente = Math.max(sbc - F.imss.umbralExcedenteVeces * umaD, 0);
  const cuotas = F.imss.obrero.map((c) => ({
    ...c,
    monto: esMinimo ? 0 : (c.base === 'excedente' ? excedente : sbc) * diasImss * c.tasa / 100,
  }));
  const imss = cuotas.reduce((s, c) => s + c.monto, 0);

  return {
    tarifa, t, subsidio, subsidioMensual, aplicaSubsidio, mensualEquivalente, isrRetener, esMinimo, diasIsr,
    factor, sbc, sbcTopado: sbcSinTope > sbc, excedente, cuotas, imss,
    neto: ingreso - isrRetener - imss,
  };
}

/** Servicios profesionales (honorarios) facturados por persona física. */
export function honorarios(F, { monto, clientePM }) {
  const iva = monto * F.iva.tasaGeneral / 100;
  const retIsr = clientePM ? monto * F.honorarios.retencionIsrPersonaMoral / 100 : 0;
  const retIva = clientePM ? iva * F.iva.retencionPersonasFisicasFraccion : 0;
  return { iva, retIsr, retIva, total: monto + iva, neto: monto + iva - retIsr - retIva };
}

/** Régimen Simplificado de Confianza, persona física: pago mensual (art. 113-E) y retención (113-J). */
export function resico(F, { ingresos, facturadoPM, retieneIva = false }) {
  const tabla = F.resico.tablaMensual;
  const tramo = tabla.find((t) => ingresos <= t.hasta) ?? null;
  const isr = tramo ? ingresos * tramo.tasa / 100 : NaN;
  const pm = Math.min(facturadoPM || 0, ingresos);
  const retenido = pm * F.resico.retencionPersonaMoral / 100;
  const iva = ingresos * F.iva.tasaGeneral / 100;
  const ivaRetenido = retieneIva ? pm * F.iva.tasaGeneral / 100 * F.iva.retencionPersonasFisicasFraccion : 0;
  return { tramo, isr, retenido, aPagar: Math.max(isr - retenido, 0), iva, ivaRetenido, neto: ingresos + iva - retenido - ivaRetenido, excede: !tramo };
}

export function ivaCalc(F, { monto, modo }) {
  const r = F.iva.tasaGeneral / 100;
  if (modo === 'agregar') return { base: monto, iva: monto * r, total: monto * (1 + r) };
  const base = monto / (1 + r);
  return { base, iva: monto - base, total: monto };
}
