// Matemática financiera: amortización francesa (pagos fijos) y costo anual total estimado.

/**
 * Tabla de amortización con pagos fijos.
 * @param {number} principal  monto financiado
 * @param {number} tasaAnual   tasa anual fija en % (sin IVA)
 * @param {number} meses       plazo
 * @param {object} op
 *   ivaIntereses: tasa de IVA en % que se cobra sobre intereses (0 si exento)
 *   extraMensual: abono adicional a capital cada mes
 *   cargoMensual: cargos fijos mensuales fuera del cálculo de interés (seguros)
 */
export function amortizar(principal, tasaAnual, meses, op = {}) {
  const iva = (op.ivaIntereses ?? 0) / 100;
  const extra = op.extraMensual ?? 0;
  const cargo = op.cargoMensual ?? 0;
  const i = tasaAnual / 100 / 12;
  const ie = i * (1 + iva); // tasa efectiva con IVA para fijar el pago
  const pago = ie === 0 ? principal / meses : (principal * ie) / (1 - (1 + ie) ** -meses);

  const filas = [];
  let saldo = principal;
  let totInt = 0, totIva = 0, totCargo = 0;
  for (let k = 1; k <= meses && saldo > 0.005; k++) {
    const interes = saldo * i;
    const ivaInt = interes * iva;
    let capital = pago - interes - ivaInt + extra;
    if (capital > saldo) capital = saldo;
    saldo -= capital;
    totInt += interes; totIva += ivaInt; totCargo += cargo;
    filas.push({ mes: k, pago: capital + interes + ivaInt + cargo, capital, interes, iva: ivaInt, cargo, saldo: Math.max(saldo, 0) });
  }
  return { pago: pago + cargo, pagoSinCargos: pago, filas, totalInteres: totInt, totalIva: totIva, totalCargos: totCargo, mesesReales: filas.length };
}

/** Tasa interna de retorno mensual para flujos [f0, f1, …] (f0 negativo = monto neto recibido; f1… = pagos). */
export function tirMensual(flujos) {
  const npv = (r) => flujos.reduce((s, f, t) => s + f / (1 + r) ** t, 0);
  let lo = -0.99, hi = 1;
  if (npv(lo) * npv(hi) > 0) return NaN;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * CAT estimado sin IVA (metodología de la Circular 21/2009 de Banxico: TIR anualizada de
 * todos los flujos del crédito, excluyendo el IVA).
 */
export function catEstimado(principal, comisionApertura, filas, cargoMensualSinIva = 0) {
  const flujos = [-(principal - comisionApertura), ...filas.map((f) => f.capital + f.interes + cargoMensualSinIva)];
  const r = tirMensual(flujos);
  return Number.isFinite(r) ? ((1 + r) ** 12 - 1) * 100 : NaN;
}
