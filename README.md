# Calculadoras financieras · CDMX

Sitio estático (HTML, CSS y JavaScript sin dependencias) con cuatro calculadoras:

| Calculadora | Qué calcula |
|---|---|
| Crédito de auto | Mensualidad, IVA de intereses, CAT estimado, amortización e histórico mensual de ofertas (exporta e importa CSV/JSON) |
| Crédito hipotecario | Mensualidad, gastos iniciales, CAT estimado y ahorro con abonos a capital |
| Seguro de auto | Comparador de cotizaciones: prima con IVA, pago por periodo y deducibles |
| Retención de impuestos | ISR de sueldos con subsidio para el empleo, cuotas obreras IMSS, honorarios, RESICO e IVA |

## De dónde salen los datos

En el código no hay ningún número fiscal escrito a mano. `scripts/actualizar_datos.py` descarga los documentos oficiales, extrae los valores de su texto y genera `data/fiscal.json` y `data/mercado.json`:

| Dato | Documento oficial |
|---|---|
| Tarifas ISR (diaria, semanal, decenal, quincenal, mensual, anual) | Anexo 8 de la RMF, portal del SAT (se localiza automáticamente cada año) |
| Subsidio para el empleo | Decreto publicado en el DOF |
| UMA | Publicación del INEGI en el DOF |
| Salario mínimo | Resolución de la CONASAMI en el DOF |
| IVA y retención de 2/3 | LIVA y su Reglamento (texto vigente, Cámara de Diputados) |
| Cuotas obreras IMSS y tope del SBC | Ley del Seguro Social (texto vigente) |
| Honorarios y RESICO | Ley del ISR, arts. 106, 113-E y 113-J |
| Aguinaldo, vacaciones y prima vacacional | Ley Federal del Trabajo |
| TIIE, tasa objetivo, UDI, tipo de cambio, inflación | API SIE de Banxico (requiere token) |

Si una fuente cambia de formato y no se puede leer, se conserva el último valor válido y la página muestra un aviso.

Los precios de autos, las tasas de los bancos y las primas de seguro no tienen API pública. Se capturan desde los enlaces oficiales de `data/catalogo.json`.

### Mantenimiento anual

Cuando el DOF publique valores nuevos, cambia la URL de la nota correspondiente en `scripts/fuentes.json` y ejecuta el workflow:

- UMA: cada enero
- Salario mínimo: cada diciembre
- Subsidio para el empleo: cuando se publique un nuevo decreto

El Anexo 8 del SAT se localiza solo.

## Publicación

El workflow `.github/workflows/publicar.yml` corre en cada push a `main`, cada lunes y de forma manual:

1. Actualiza los datos oficiales.
2. Hace commit si hubo cambios.
3. Publica en GitHub Pages.

Configuración del repositorio en GitHub:

1. **Settings → Pages → Source:** GitHub Actions.
2. **Opcional, Settings → Secrets and variables → Actions:** crea el secreto `BANXICO_TOKEN` con tu token gratuito de <https://www.banxico.org.mx/SieAPIRest/service/v1/token>.

## Desarrollo local

```bash
pip install -r scripts/requirements.txt
python scripts/actualizar_datos.py      # refresca data/*.json
python -m http.server 8000              # abre http://localhost:8000
```

El histórico de ofertas y las cotizaciones de seguro se guardan solo en el navegador (`localStorage`). Exporta el JSON cada mes como respaldo.
