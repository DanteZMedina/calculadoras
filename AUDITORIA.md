# Auditoría · Calculadoras financieras CDMX

**Fecha:** 2 de noviembre de 2026 · **Ejercicio fiscal:** 2026 · **Versión auditada:** código local (rama `main`), servido en `http://127.0.0.1:8765`
**Backend / APIs:** no tiene backend. Los datos oficiales se generan con un script que se ejecuta en GitHub Actions. Solo Banxico SIE usa API, con token guardado como secreto del servidor y nunca expuesto en el front-end.

**Método.** Se escribió un modelo de referencia independiente en Python con los parámetros transcritos de los documentos oficiales, sin reutilizar el JavaScript del sitio. Luego un navegador Edge sin interfaz, controlado por el protocolo de depuración (CDP), capturó los mismos casos en el sitio real y leyó los resultados en pantalla. Se compararon 99 valores con tolerancia de $1 MXN (0.01 puntos para el CAT). Además se probaron entradas inválidas, 5 anchos de pantalla, la consola y las etiquetas de accesibilidad.

---

## 1. Resumen ejecutivo

**Estado: Aprobado con observaciones.**

- **Exactitud.** Los 99 valores comparados coinciden con el modelo independiente; la diferencia máxima es de $0.005.
- **Parámetros fiscales.** Todos están vigentes para 2026 y se extraen de su fuente oficial.
- **Entradas y pantalla.** No aparece NaN, Infinity ni undefined en ningún caso. No hay errores de consola ni scroll horizontal en 360, 390, 768, 1280 y 1920 px.
- **Correcciones durante la auditoría.** Se corrigieron los hallazgos críticos y altos: validación de entradas, aviso legal y de privacidad, comparación de coberturas distintas, campos desalineados y enganche en pesos.

**Riesgo principal pendiente.** El tope de ingreso del subsidio para el empleo en periodos menores a un mes (semanal, quincenal) se calcula proporcional a 30.4 días. Es un supuesto sin verificar contra el texto completo del decreto (H-01).

---

## 2. Casos de prueba por calculadora

### 2.1 Crédito automotriz
Supuestos del modelo:
- Pago fijo con tasa mensual × (1 + IVA).
- Interés calculado sobre saldo insoluto.
- IVA del 16% sobre intereses.
- CAT = TIR anualizada sin IVA, con el neto recibido (monto − comisión).

| Caso | Datos de entrada | Esperado | Mostrado | Dif. | ¿Pasa? |
|---|---|---|---|---|---|
| A1 | Precio $489,900, desc. $25,000, enganche $150,000, 48 m, 12.99%, comisión 2% contado, seguro $18,500 contado | Mensualidad $8,774.82 · Intereses $91,630.68 · IVA $14,660.91 · Pago inicial $174,798.00 · CAT 15.02% | Igual | ≤ $0.005 | ✅ |
| A2 | $300,000, enganche $60,000, 24 m, **tasa 0%** | Mensualidad $10,000.00 · Intereses $0.00 · CAT 0.00% | Igual | 0 | ✅ |
| A3 | $650,000, enganche $130,000, 72 m, 15.5%, **sin IVA** | Mensualidad $11,137.09 · Intereses $281,870.76 | Igual | ≤ $0.004 | ✅ |
| A4 | $420,000, desc. $10,000, enganche $100,000, 48 m, 11%, seguro $18,500 **financiado** (4 años) | Monto financiado $384,000.00 · Mensualidad $10,256.08 | Igual | ≤ $0.005 | ✅ |
| A6 | Precio escrito **"1.000.000"**, enganche **"200,000"**, 60 m, 10% | Mensualidad $17,634.27 · Monto $800,000.00 | Igual | 0 | ✅ |
| A12 | $350,000, enganche $70,000, 36 m, 10%, comisión 2% **financiada**, seguro de vida $450/mes | Monto $285,600.00 · Mensualidad $9,881.54 · CAT 15.70% | Igual | ≤ $0.004 | ✅ |
| A5 | Enganche = precio neto | Mensaje de error | «El enganche debe ser menor que el precio neto…» | — | ✅ |
| A7 / A8 / A11 | Precio −5,000 / precio «abc» / tasa −3 | Mensaje de error | Mensajes en español, sin cálculo | — | ✅ |
| A9 | Descuento mayor que el precio | Mensaje de error | «El descuento no puede ser mayor que el precio de lista.» | — | ✅ |
| A10 | Precio 999,999,999,999,999 | Rechazo | «el máximo es $999,999,999.99» | — | ✅ |

Tabla de amortización: la suma de capital es igual al monto financiado, el saldo final es $0.00 y los intereses decrecen. Se verificó en el modelo y en la tabla mostrada.

### 2.2 Crédito hipotecario
Intereses sin IVA (art. 15, fr. X, inciso d, LIVA).

| Caso | Datos de entrada | Esperado | Mostrado | Dif. | ¿Pasa? |
|---|---|---|---|---|---|
| H1 | $3,500,000, enganche 10%, 20 años, 10.5%, comisión 1%, seguros $1,200/mes, gastos 6%, avalúo $8,000, abono extra $3,000 | Mensualidad $32,648.97 · Intereses $4,397,751.95 · Pago inicial $599,500.00 · CAT 11.81% · termina en 185 meses · ahorro $1,181,739.31 | Igual | ≤ $0.005 | ✅ |
| H2 | $2,000,000, sin enganche, 20 años, 10% | Mensualidad $19,300.43 · Intereses $2,632,103.90 | Igual | ≤ $0.004 | ✅ |
| H3 | $1,200,000, enganche 20%, 10 años, **0%** | Mensualidad $8,000.00 | Igual | 0 | ✅ |
| H4 | $5,000,000, enganche 20%, 30 años, 9.25%, seguros $2,500 | Mensualidad $35,407.02 · Seguros $900,000.00 | Igual | ≤ $0.003 | ✅ |
| H6 | Valor **"1000000.50"**, enganche 10%, 15 años, 11%, ingreso $40,000 | Crédito $900,000.45 · Mensualidad/ingreso 25.57% | Igual | — | ✅ |
| H5 | Enganche 100% | Error | «Revisa el enganche: el máximo es 99.99%.» | — | ✅ |

### 2.3 ISR e IMSS (asalariados)

| Caso | Datos de entrada | Esperado (ISR / IMSS / neto) | Mostrado | Dif. | ¿Pasa? |
|---|---|---|---|---|---|
| S1 | $20,000 mensual, 30 días | $2,383.65 / $540.14 / $17,076.21 | Igual | ≤ $0.003 | ✅ |
| S2 | $10,000 mensual (con subsidio) | $193.37 / $249.21 / $9,557.42 | Igual | ≤ $0.003 | ✅ |
| S3 | Salario mínimo $9,451.20 mensual | $0.00 / $0.00 / $9,451.20 (arts. 96 LISR y 36 LSS) | Igual | 0 | ✅ |
| S4 | $5,000 quincenal (subsidio proporcional) | $102.61 / $124.61 / $4,772.79 | Igual | ≤ $0.004 | ✅ |
| S5 | $150,000 mensual (**SBC topado a 25 UMA**) | $39,770.26 / $2,399.28 / $107,830.46 | Igual | ≤ $0.005 | ✅ |
| S6 | $3,000 semanal | $248.82 / $77.50 / $2,673.68 | Igual | ≤ $0.002 | ✅ |
| S7 | $35,000 mensual, SBC capturado $1,500 | $5,587.65 / $1,206.52 / $28,205.83 | Igual | ≤ $0.003 | ✅ |
| S8 / S9 | Días = 0 / sueldo −100 | Error | «Revisa los días cotizados: el mínimo es 1.» / «el mínimo es $0.01» | — | ✅ |

Salario neto = bruto − ISR retenido − IMSS: la suma se validó en todos los casos. No hay cálculo inverso (de neto a bruto) ni cuotas patronales, así que no aplica revisarlos.

### 2.4 Otros regímenes

| Caso | Datos de entrada | Esperado | Mostrado | ¿Pasa? |
|---|---|---|---|---|
| HO1 | Honorarios $20,000 a persona moral | Factura $23,200.00 · Recibes $19,066.67 (retiene ISR 10% e IVA 2/3) | Igual | ✅ |
| HO2 | Honorarios $15,000 a persona física | Factura y neto $17,400.00 | Igual | ✅ |
| R1 | RESICO $45,000, de ellos $20,000 a persona moral (servicios) | ISR a pagar $245.00 · IVA retenido $2,133.33 · Recibes $49,816.67 | Igual | ✅ |
| R2 | RESICO $250,000, sin persona moral | ISR 2.5% = $6,250.00 | Igual | ✅ |
| R3 | Cobrado a persona moral mayor que el total | Error | Mensaje claro | ✅ |
| I1 / I2 | Desglosar $1,160 / agregar a $2,500 | $1,000 + $160 / $2,500 + $400 = $2,900 | Igual | ✅ |

Arrendamiento y plataformas digitales **no están implementados** (H-05).

### 2.5 Comparador de seguro de auto

| Caso | Datos de entrada | Esperado | Mostrado | ¿Pasa? |
|---|---|---|---|---|
| SG1 | Quálitas: neta $14,200 + expedición $650 · GNP: neta $12,800 + expedición $700, cobertura Limitada | $17,226.00 / $15,660.00 con IVA. Debe avisar que se comparan coberturas distintas | Igual y muestra el aviso | ✅ |
| SG2 | Suma asegurada −1 | Error | «Suma asegurada: escribe un monto mayor a cero…» | ✅ |

- **Origen de las cotizaciones:** el usuario las captura desde el cotizador oficial de cada aseguradora; no hay API ni tarifas fijas. Cada cotización tiene campo de fecha.
- **Orden:** solo por los montos capturados, sin patrocinio ni comisiones. El sitio declara que no es intermediario y no envía datos, por lo que no aplica razón social ni registro ante la CNSF.
- **Enlaces:** los enlaces a aseguradoras apuntan a sus dominios oficiales y respondieron HTTP 200.

---

## 3. Parámetros fiscales y financieros

| Parámetro | Valor en el sitio | Valor vigente | Fuente oficial | ¿Correcto? |
|---|---|---|---|---|
| Tarifa ISR mensual 2026 (11 tramos, 1.92% a 35%) | Tramo 1: 0.01–844.59 · Tramo 11: desde 425,642.00, cuota $133,488.54 | Igual | Anexo 8 RMF 2026, DOF 28-12-2025 (SAT) | ✅ |
| Tarifas diaria, semanal, decenal, quincenal y anual 2026 | 11 tramos cada una, extraídas y validadas | Igual | Anexo 8 RMF 2026 | ✅ |
| UMA diaria / mensual / anual | $117.31 / $3,566.22 / $42,794.64, desde 1-feb-2026 | Igual | INEGI, DOF 09-01-2026 | ✅ |
| Salario mínimo general (CDMX) | $315.04 diario | Igual | CONASAMI, DOF 09-12-2025 | ✅ |
| Subsidio para el empleo | 15.02% de la UMA mensual = $535.65; ingreso ≤ $11,492.66; enero 15.59% | Igual | Decreto DOF 31-12-2025 | ✅ |
| IVA tasa general | 16% | Igual | Art. 1o. LIVA | ✅ |
| Retención IVA persona física | 2/3 del IVA | Igual | Art. 3 fr. I RLIVA | ✅ |
| Retención ISR honorarios | 10% | Igual | Art. 106 LISR | ✅ |
| RESICO tabla mensual / retención | 1.00%–2.50% · 1.25% | Igual | Arts. 113-E y 113-J LISR | ✅ |
| IMSS obrero: excedente de 3 UMA | 0.40% | 2% − 10 × 0.16 = 0.40% | Art. 106 fr. II LSS y Décimo Noveno transitorio | ✅ |
| IMSS obrero: prestaciones en dinero / gastos médicos de pensionados / invalidez y vida / cesantía y vejez | 0.25% / 0.375% / 0.625% / 1.125% | Igual | Arts. 107, 25, 147 y 168 LSS (última reforma DOF 15-01-2026) | ✅ |
| Tope SBC / piso | 25 UMA / salario mínimo | Igual | Art. 28 LSS | ✅ |
| Factor de integración mínimo | 1.0493 (15 días de aguinaldo, 12 de vacaciones, prima del 25%) | Igual | Arts. 87, 76 y 80 LFT (reforma vacaciones DOF 27-12-2022) | ✅ |
| TIIE, tasa objetivo, UDI, FIX, inflación | No se muestran (falta el token) | — | Banxico SIE | ⏳ Pendiente de configurar |

---

## 4. Hallazgos

### Corregidos durante la auditoría

| ID | Módulo | Descripción | Severidad | Estado |
|---|---|---|---|---|
| C-01 | Todas | Valores negativos, letras o "1.000.000" se interpretaban en silencio (por ejemplo, "1.000.000" se leía como 1) | Crítica | ✅ Validación con mensajes en español |
| C-02 | Auto | El enganche era un porcentaje; se pidió capturarlo en pesos | Alta | ✅ Ahora es un monto; el resultado muestra el % equivalente |
| C-03 | Auto | No se validaba enganche ≥ precio ni descuento > precio | Alta | ✅ |
| C-04 | General | No había aviso de privacidad ni aclaración de que no es oferta ni asesoría | Alta | ✅ Pie de página |
| C-05 | Seguro | Se podían comparar coberturas distintas sin advertencia; no había fecha de cotización | Alta | ✅ |
| C-06 | Impuestos | Campos desalineados cuando una etiqueta ocupa dos renglones (SBC) | Media | ✅ |
| C-07 | RESICO | No mostraba la retención de IVA (2/3) de personas morales | Media | ✅ Opción activable |
| C-08 | Hipoteca | No aclaraba seguros sobre saldo ni reglas de Infonavit/Fovissste; no tenía relación pago/ingreso | Media | ✅ |
| C-09 | Todas | Montos gigantes mostraban imprecisión de punto flotante | Baja | ✅ Tope de $999,999,999.99 |
| C-10 | Móvil | Tablas de dos columnas repetían «Concepto/Importe» en cada fila y el menú ocupaba 3 renglones | Baja | ✅ |

### Pendientes

| ID | Módulo | Descripción | Pasos para reproducir | Severidad | Recomendación |
|---|---|---|---|---|---|
| H-01 | ISR | Para periodos menores a un mes, el tope del subsidio se compara con ingreso ÷ días × 30.4. Es un supuesto **pendiente de verificar** contra el texto íntegro del decreto | Sueldo quincenal de $5,700: equivale a $11,552 al mes y no recibe subsidio | Media | Confirmar con el Art. Segundo del decreto o con un contador |
| H-02 | ISR | En enero se aplica 15.02% en lugar del 15.59% transitorio (solo se informa) | Cálculo de una nómina de enero 2026 | Baja | Agregar selector de mes si se calcularán nóminas de enero |
| H-03 | Datos | La UMA, el salario mínimo y el decreto del subsidio requieren actualizar a mano la URL de la nota del DOF cada año | Cambio de año | Media | Recordatorio anual o búsqueda automática en el DOF |
| H-04 | Mercado | Sin token de Banxico no hay tasas de referencia | Ver «Fuentes» | Media | Registrar el token y crear el secreto `BANXICO_TOKEN` |
| H-05 | Impuestos | Arrendamiento y plataformas digitales no están implementados | — | Media | Agregarlos si se necesitan, con fuente en LISR y LIVA |
| H-06 | Hipoteca / auto | ISAI y tenencia de la CDMX no se calculan; el ISAI entra en el % de gastos que se captura | — | Media | Extraer tarifas del Código Fiscal CDMX |
| H-07 | Hipoteca | Los seguros se capturan como monto fijo; algunos bancos los calculan sobre el saldo (ya se aclara en pantalla) | — | Baja | Opción de % sobre saldo |
| H-08 | General | Google Fonts envía la IP del visitante a Google | Ver peticiones de red | Baja | Alojar Roboto en el propio sitio |
| H-09 | Técnico | No se ejecutó Lighthouse (**pendiente**) | — | Baja | Correrlo con la URL de GitHub Pages ya publicada |
| H-10 | ISR | Se asume que todo el sueldo es gravado; no hay partidas exentas ni cálculo inverso (neto → bruto). Ya se aclara en pantalla | — | Baja | Agregar campos de exentos y cálculo inverso si se requieren |

### Verificaciones técnicas
- **Responsivo:** sin scroll horizontal en 360, 390, 768, 1280 y 1920 px, en todas las rutas y con las tablas de amortización abiertas.
- **Consola:** 0 errores y 0 advertencias.
- **Formularios:** todos los campos tienen etiqueta y todos los montos usan `inputmode="decimal"`.
- **Llaves de API:** no hay ninguna en el front-end.
- **HTTPS:** GitHub Pages lo sirve por HTTPS. Todos los recursos externos (Google Fonts) usan HTTPS, así que no hay contenido mixto.
- **Logotipos:** no se usan logotipos de bancos ni aseguradoras, solo su nombre como texto.

---

## 5. Top 10 de correcciones prioritarias
1. Verificar el criterio del tope del subsidio en periodos semanales y quincenales (H-01).
2. Configurar el token de Banxico (H-04).
3. Crear un recordatorio anual para actualizar las URL del DOF en `scripts/fuentes.json` (H-03).
4. Calcular el ISAI de la CDMX en la hipoteca (H-06).
5. Agregar tenencia y refrendo de la CDMX al costo del auto (H-06).
6. Ejecutar Lighthouse en móvil y escritorio una vez publicado (H-09).
7. Agregar arrendamiento si se va a usar (H-05).
8. Ofrecer la opción de seguros hipotecarios como % sobre saldo (H-07).
9. Alojar la fuente Roboto en el propio sitio (H-08).
10. Agregar selector de mes para el transitorio de enero y cálculo inverso de neto a bruto (H-02, H-10).
