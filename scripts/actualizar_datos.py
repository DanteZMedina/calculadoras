"""Actualiza data/fiscal.json y data/mercado.json desde fuentes oficiales.

Descarga los documentos publicados por SAT, DOF, Cámara de Diputados (leyes vigentes)
y Banxico, y extrae de su texto los valores que usan las calculadoras. Ningún valor
numérico se escribe a mano: si un documento cambia de formato y no se puede leer,
se conserva el último valor extraído y se registra un aviso visible en la página.

Uso:
    python scripts/actualizar_datos.py
    BANXICO_TOKEN=xxxx python scripts/actualizar_datos.py   (para tasas de Banxico)
"""

import datetime as dt
import io
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request

from pypdf import PdfReader

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RAIZ, "data")
FUENTES = json.load(open(os.path.join(RAIZ, "scripts", "fuentes.json"), encoding="utf-8"))
HOY = dt.datetime.now(dt.timezone.utc).astimezone(dt.timezone(dt.timedelta(hours=-6)))
UA = {"User-Agent": "Mozilla/5.0 (calculadoras-mx; actualizador de datos oficiales)"}

avisos = []


# ---------------------------------------------------------------- utilidades

def descargar(url, headers=None):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def texto_pdf(url):
    lector = PdfReader(io.BytesIO(descargar(url)))
    return "\n".join(p.extract_text() or "" for p in lector.pages)


def texto_html(url):
    raw = descargar(url)
    for enc in ("utf-8", "latin-1"):
        try:
            t = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    t = re.sub(r"(?is)<(script|style).*?</\1>", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    import html
    return re.sub(r"\s+", " ", html.unescape(t))


def espacios(t):
    return re.sub(r"\s+", " ", t)


def compacto(t):
    """Minúsculas, sin acentos y sin espacios: tolera palabras partidas por la extracción del PDF."""
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", "", t)


def num(s):
    return float(s.replace(",", "").replace("$", ""))


def buscar(patron, texto, desc):
    m = re.search(patron, texto, re.S)
    if not m:
        raise ValueError(f"No se encontró en la fuente: {desc}")
    return m


def ultima_reforma(texto):
    m = re.search(r"[ÚU]ltima [Rr]eforma (?:publicada )?DOF (\d{2}-\d{2}-\d{4})", texto)
    return m.group(1) if m else None


# Números escritos con letra, como aparecen en las leyes ("cero punto seiscientos veinticinco").
_PALABRAS = {
    "cero": 0, "uno": 1, "una": 1, "un": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
    "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "once": 11, "doce": 12,
    "trece": 13, "catorce": 14, "quince": 15, "dieciseis": 16, "diecisiete": 17,
    "dieciocho": 18, "diecinueve": 19, "veinte": 20, "veintiuno": 21, "veintidos": 22,
    "veintitres": 23, "veinticuatro": 24, "veinticinco": 25, "veintiseis": 26,
    "veintisiete": 27, "veintiocho": 28, "veintinueve": 29, "treinta": 30, "cuarenta": 40,
    "cincuenta": 50, "sesenta": 60, "setenta": 70, "ochenta": 80, "noventa": 90,
    "cien": 100, "ciento": 100, "doscientos": 200, "trescientos": 300,
    "cuatrocientos": 400, "quinientos": 500, "seiscientos": 600, "setecientos": 700,
    "ochocientos": 800, "novecientos": 900, "y": None, "punto": "."
}
_ORDEN = sorted(_PALABRAS, key=len, reverse=True)


def _tokens(s):
    out, i = [], 0
    while i < len(s):
        for w in _ORDEN:
            if s.startswith(w, i):
                out.append(w)
                i += len(w)
                break
        else:
            raise ValueError(f"Número con letra no reconocido: '{s}'")
    return out


def palabras_a_numero(s):
    """'ceropuntoseiscientosveinticinco' -> 0.625 (entrada en formato compacto)."""
    toks = _tokens(s)
    if "punto" in toks:
        k = toks.index("punto")
        entero, dec = toks[:k], toks[k + 1:]
    else:
        entero, dec = toks, []
    e = sum(_PALABRAS[t] for t in entero if _PALABRAS[t] is not None)
    if not dec:
        return float(e)
    ceros = 0
    while dec and dec[0] == "cero":
        ceros += 1
        dec = dec[1:]
    d = sum(_PALABRAS[t] for t in dec if _PALABRAS[t] is not None)
    return round(e + d / 10 ** (len(str(d)) + ceros), 6)


def fuente(nombre, url, **extra):
    return {"nombre": nombre, "url": url, "consultado": HOY.strftime("%Y-%m-%d"), **extra}


# ---------------------------------------------------------------- ISR (Anexo 8 RMF)

def url_anexo8():
    for anio in (HOY.year + 1, HOY.year):
        try:
            html = descargar(FUENTES["sat_normatividad"].format(anio=anio)).decode("utf-8", "ignore")
        except Exception:
            continue
        m = re.search(r'href="([^"]*rmf/anexos/Anexo-8[^"]*\.pdf)"', html, re.I)
        if m:
            return urllib.parse.urljoin(FUENTES["sat_base"], m.group(1))
    avisos.append("No se pudo localizar el Anexo 8 en el portal del SAT; se usó la URL de respaldo.")
    return FUENTES["anexo8_respaldo"]


FILA = re.compile(r"(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2}|En adelante)\s+(\d[\d,]*(?:\.\d{1,2})?)\s+(\d{1,2}\.\d{2})")


def leer_tarifa(texto, marcador, desc):
    ocurrencias = list(re.finditer(marcador, texto))
    if not ocurrencias:
        raise ValueError(f"No se encontró la tarifa {desc} en el Anexo 8")
    filas = []
    for m in FILA.finditer(texto, ocurrencias[-1].end()):
        li, ls, cuota, tasa = m.groups()
        filas.append({
            "limiteInferior": num(li),
            "limiteSuperior": None if ls == "En adelante" else num(ls),
            "cuotaFija": num(cuota),
            "tasa": num(tasa),
        })
        if ls == "En adelante":
            break
    # validación: tramos contiguos y tasas crecientes
    ok = len(filas) >= 5 and filas[-1]["limiteSuperior"] is None
    for a, b in zip(filas, filas[1:]):
        ok = ok and a["limiteSuperior"] is not None and abs(b["limiteInferior"] - a["limiteSuperior"] - 0.01) < 0.005 and b["tasa"] >= a["tasa"]
    if not ok:
        raise ValueError(f"La tarifa {desc} del Anexo 8 no pasó la validación")
    return filas


def isr():
    url = url_anexo8()
    t = espacios(texto_pdf(url))
    anio = int(buscar(r"ANEXO 8 DE LA RESOLUCI.N MISCEL.NEA FISCAL PARA (\d{4})", t, "año del Anexo 8").group(1))
    pub = re.search(r"DIARIO OFICIAL \w+ (\d{1,2} de \w+ de \d{4})", t)
    marcadores = {
        "diaria": (r"I\. Tarifa aplicable en funci.n de la cantidad de trabajo realizado", "diaria (art. 96 LISR y 175 RLISR)", 1),
        "semanal": (r"periodo de 7 d.as", "semanal (7 días)", 7),
        "decenal": (r"periodo de 10 d.as", "decenal (10 días)", 10),
        "quincenal": (r"periodo de 15 d.as", "quincenal (15 días)", 15),
        "mensual": (r"V\. Tarifa aplicable durante \d{4} para el c.lculo de los pagos provisionales mensuales", "mensual (art. 96 LISR)", 30.4),
        "anual": (rf"II\. Tarifa para el c.lculo del impuesto correspondiente al ejercicio de {anio}", f"anual {anio} (arts. 97 y 152 LISR)", 365),
    }
    tarifas = {}
    for clave, (pat, desc, dias) in marcadores.items():
        tarifas[clave] = {"descripcion": desc, "dias": dias, "tramos": leer_tarifa(t, pat, desc)}
    return {
        "anio": anio,
        "tarifas": tarifas,
        "fuente": fuente(f"Anexo 8 de la Resolución Miscelánea Fiscal para {anio} (SAT)", url,
                         publicacion=f"DOF {pub.group(1)}" if pub else None,
                         fundamento="Arts. 96, 97 y 152 de la LISR; art. 175 RLISR; regla 3.12.2 RMF"),
    }


# ---------------------------------------------------------------- Subsidio para el empleo

def subsidio():
    url = FUENTES["dof_subsidio_empleo"]
    t = texto_html(url)
    pct = num(buscar(r"valor mensual de la Unidad de Medida y Actualizaci.n por (\d+\.\d+)%", t, "porcentaje UMA del subsidio").group(1))
    lim = num(buscar(r"no excedan de \$\s?([\d,]+\.\d{2})", t, "límite de ingresos del subsidio").group(1))
    div = num(buscar(r"entre (\d+\.\d+)\. El resultado as. obtenido se multiplicar. por el n.mero de d.as", t, "divisor diario").group(1))
    trans = re.search(r"multiplicar por (\d+\.\d+)%, en sustituci.n del porcentaje", t)
    fecha = urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("fecha", [None])[0]
    return {
        "porcentajeUmaMensual": pct,
        "limiteIngresoMensual": lim,
        "divisorDiario": div,
        "porcentajeTransitorioEnero": num(trans.group(1)) if trans else None,
        "fuente": fuente("Decreto que modifica el diverso que otorga el subsidio para el empleo (DOF)", url,
                         publicacion=f"DOF {fecha}" if fecha else None,
                         fundamento="Artículo Segundo del Decreto y transitorios"),
    }


# ---------------------------------------------------------------- UMA y salario mínimo

def uma():
    url = FUENTES["dof_uma"]
    t = texto_html(url)
    m = buscar(r"valor diario de la Unidad de Medida y Actualizaci.n es de \$([\d,]+\.\d{2}).{0,40}?mensual es de \$([\d,]+\.\d{2}).{0,60}?anual \$([\d,]+\.\d{2}).{0,80}?a partir del 1\S* de (\w+) de (\d{4})", t, "valores de la UMA")
    return {
        "diaria": num(m.group(1)), "mensual": num(m.group(2)), "anual": num(m.group(3)),
        "vigenteDesde": f"1 de {m.group(4)} de {m.group(5)}",
        "fuente": fuente("Unidad de Medida y Actualización, INEGI (publicación en DOF)", url,
                         fundamento="Ley para Determinar el Valor de la UMA, art. 5"),
    }


def salario_minimo():
    url = FUENTES["dof_salario_minimo"]
    t = texto_html(url)
    g = buscar(r"\(ZSMG\), con lo que ser. de (\d[\d,]*\.\d{2}) pesos", t, "salario mínimo general")
    f = buscar(r"\(ZLFN\), con lo que ser. de (\d[\d,]*\.\d{2}) pesos", t, "salario mínimo frontera norte")
    a = re.search(r"vigencia a partir del 1\S* de enero de (\d{4})", t)
    return {
        "general": num(g.group(1)), "fronteraNorte": num(f.group(1)),
        "anio": int(a.group(1)) if a else None,
        "zonaCdmx": "general",
        "fuente": fuente("Resolución del Consejo de Representantes de la CONASAMI (DOF)", url,
                         fundamento="Art. 94 y 570 LFT; CDMX pertenece a la Zona del Salario Mínimo General"),
    }


# ---------------------------------------------------------------- IVA

def iva():
    url = FUENTES["liva"]
    t = espacios(texto_pdf(url))
    tasa = num(buscar(r"El impuesto se calcular. aplicando a los valores que se.ala esta Ley, la tasa del (\d+(?:\.\d+)?)%", t, "tasa general de IVA").group(1))
    url_r = FUENTES["rliva"]
    c = compacto(texto_pdf(url_r))
    m = buscar(r"laretencionseharaporlas([a-z]+)(terceras|cuartas|quintas)partesdelimpuesto", c, "fracción de IVA retenido (RLIVA art. 3)")
    den = {"terceras": 3, "cuartas": 4, "quintas": 5}[m.group(2)]
    fraccion = palabras_a_numero(m.group(1)) / den
    return {
        "tasaGeneral": tasa,
        "retencionPersonasFisicasFraccion": fraccion,
        "interesesHipotecariosExentos": True,
        "fuente": fuente("Ley del Impuesto al Valor Agregado (Cámara de Diputados, texto vigente)", url,
                         ultimaReforma=ultima_reforma(t), fundamento="Art. 1o. LIVA (tasa); art. 15 fr. X inciso d) (intereses hipotecarios exentos)"),
        "fuenteRetencion": fuente("Reglamento de la Ley del IVA", url_r, fundamento="Art. 3, fracción I RLIVA"),
    }


# ---------------------------------------------------------------- LISR: honorarios y RESICO

def lisr():
    url = FUENTES["lisr"]
    raw = texto_pdf(url)
    t, c = espacios(raw), compacto(raw)
    ret10 = num(buscar(r"serviciosprofesionalesalaspersonasmorales.{0,60}?pagoprovisional.{0,80}?tasadel(\d+(?:\.\d+)?)%", c, "retención ISR honorarios (art. 106)").group(1))
    ini = buscar(r"TABLA MENSUAL", t, "tabla mensual RESICO (art. 113-E)").end()
    tabla = [{"hasta": num(h), "tasa": num(p)} for h, p in re.findall(r"Hasta ([\d,]+\.\d{2}) (\d+\.\d{2})%", t[ini:ini + 600])]
    if len(tabla) < 3 or any(b["hasta"] <= a["hasta"] for a, b in zip(tabla, tabla[1:])):
        raise ValueError("La tabla RESICO (art. 113-E) no pasó la validación")
    ret_resico = num(buscar(r"articulo113-j\.cuando.{0,500}?tasadel(\d+(?:\.\d+)?)%", c, "retención RESICO (art. 113-J)").group(1))
    return {
        "honorarios": {
            "retencionIsrPersonaMoral": ret10,
            "fuente": fuente("Ley del Impuesto sobre la Renta (texto vigente)", url, ultimaReforma=ultima_reforma(t), fundamento="Art. 106, último párrafo LISR"),
        },
        "resico": {
            "tablaMensual": tabla,
            "retencionPersonaMoral": ret_resico,
            "fuente": fuente("Ley del Impuesto sobre la Renta (texto vigente)", url, ultimaReforma=ultima_reforma(t), fundamento="Arts. 113-E y 113-J LISR"),
        },
    }


# ---------------------------------------------------------------- IMSS (Ley del Seguro Social)

def imss():
    url = FUENTES["lss"]
    raw = texto_pdf(url)
    c = compacto(raw)
    w = palabras_a_numero
    art25 = w(buscar(r"alostrabajadoresel([a-z]+?)porcientoyalestado", c, "art. 25 LSS (gastos médicos pensionados)").group(1))
    art107_total = w(buscar(r"prestacionesendinerodelsegurodeenfermedadesymaternidadsefinanciaranconunacuotadel([a-z]+?)porciento", c, "art. 107 LSS").group(1))
    art107_trab = w(buscar(r"alostrabajadoreslescorresponderapagarel([a-z]+?)porcientodelamisma", c, "art. 107 fr. II LSS").group(1))
    m106 = buscar(r"salariobasedecotizacionseamayora([a-z]+?)veceselsalariominimo.{0,200}?otraadicionalobreradel([a-z]+?)porciento", c, "art. 106 fr. II LSS")
    veces = w(m106.group(1))
    obrera106 = w(m106.group(2))
    tr = buscar(r"fraccioniidelarticulo106,?sereduciran.{0,200}?yen([a-z]+?)centesimasdepuntoporcentuallaquecorrespondepagaralostrabajadores\.estasmodificacionescomenzaranenelanode(\d{4})yterminaranenelano(\d{4})", c, "transitorio décimo noveno LSS")
    reduccion = w(tr.group(1)) / 100 * (int(tr.group(3)) - int(tr.group(2)) + 1)
    m147 = buscar(r"invalidezyvidael([a-z]+?)porcientoyel([a-z]+?)porcientosobreelsalariobasedecotizacion,respectivamente", c, "art. 147 LSS")
    cyv = w(buscar(r"lostrabajadorescubriranunacuotadel([a-z]+?)porcientosobreelsalariobasedecotizacion", c, "art. 168 fr. II b) LSS").group(1))
    tope = w(buscar(r"limitesuperiorelequivalentea([a-z]+?)vecesel", c, "art. 28 LSS (tope SBC)").group(1))
    return {
        "obrero": [
            {"concepto": "Enfermedades y maternidad – excedente de 3 UMA", "tasa": round(obrera106 - reduccion, 4), "base": "excedente", "fundamento": "Art. 106 fr. II LSS y art. Décimo Noveno transitorio"},
            {"concepto": "Enfermedades y maternidad – prestaciones en dinero", "tasa": round(art107_total * art107_trab / 100, 4), "base": "sbc", "fundamento": "Art. 107 fr. II LSS"},
            {"concepto": "Gastos médicos de pensionados", "tasa": art25, "base": "sbc", "fundamento": "Art. 25 LSS"},
            {"concepto": "Invalidez y vida", "tasa": w(m147.group(2)), "base": "sbc", "fundamento": "Art. 147 LSS"},
            {"concepto": "Cesantía en edad avanzada y vejez", "tasa": cyv, "base": "sbc", "fundamento": "Art. 168 fr. II b) LSS"},
        ],
        "umbralExcedenteVeces": veces,
        "topeSbcVeces": tope,
        "salarioMinimoExento": True,
        "fuente": fuente("Ley del Seguro Social (Cámara de Diputados, texto vigente)", url,
                         ultimaReforma=ultima_reforma(espacios(raw)),
                         fundamento="Arts. 25, 28, 36, 106, 107, 147 y 168 LSS. Las referencias a salario mínimo se aplican en UMA (reforma constitucional DOF 27-01-2016)"),
    }


# ---------------------------------------------------------------- LFT (factor de integración mínimo)

def lft():
    url = FUENTES["lft"]
    raw = texto_pdf(url)
    c = compacto(raw)
    w = palabras_a_numero
    aguinaldo = w(buscar(r"aguinaldoanual.{0,80}?equivalentea([a-z]+?)diasdesalario", c, "art. 87 LFT").group(1))
    vacaciones = w(buscar(r"enningun?casopodraserinferiora([a-z]+?)diaslaborables", c, "art. 76 LFT").group(1))
    prima = w(buscar(r"unaprimanomenorde([a-z]+?)porcientosobrelossalarios", c, "art. 80 LFT").group(1))
    return {
        "aguinaldoDias": aguinaldo, "vacacionesPrimerAnio": vacaciones, "primaVacacional": prima,
        "fuente": fuente("Ley Federal del Trabajo (Cámara de Diputados, texto vigente)", url,
                         ultimaReforma=ultima_reforma(espacios(raw)), fundamento="Arts. 76, 80 y 87 LFT"),
    }


# ---------------------------------------------------------------- Banxico SIE

def banxico():
    token = os.environ.get("BANXICO_TOKEN", "").strip()
    if not token:
        raise ValueError("Sin BANXICO_TOKEN: configura el secreto del repositorio para obtener tasas de Banxico")
    series = FUENTES["banxico_series"]
    url = FUENTES["banxico_sie"].format(series=",".join(series))
    data = json.loads(descargar(url, {"Bmx-Token": token, "Accept": "application/json"}))
    out = {}
    for s in data["bmx"]["series"]:
        d = (s.get("datos") or [{}])[-1]
        dato = d.get("dato", "N/E")
        out[series[s["idSerie"]]] = {
            "serie": s["idSerie"], "titulo": s.get("titulo"),
            "fecha": d.get("fecha"), "valor": None if dato in ("N/E", "") else num(dato),
            "url": f"https://www.banxico.org.mx/SieInternet/consultarDirectorioInternetAction.do?sector=18&accion=consultarCuadro&idCuadro=CF101&locale=es&serie={s['idSerie']}",
        }
    return {"indicadores": out, "fuente": fuente("Banco de México – Sistema de Información Económica (API SIE)", "https://www.banxico.org.mx/SieAPIRest/service/v1/")}


# ---------------------------------------------------------------- principal

def cargar(nombre):
    p = os.path.join(DATA, nombre)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}


def guardar(nombre, obj):
    os.makedirs(DATA, exist_ok=True)
    with open(os.path.join(DATA, nombre), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def ejecutar(destino, previo, clave, fn):
    try:
        destino[clave] = fn()
        print(f"  ok  {clave}")
    except Exception as e:  # conserva el último valor válido
        msg = f"{clave}: {e}"
        avisos.append(msg)
        print(f"  !!  {msg}", file=sys.stderr)
        if clave in previo:
            destino[clave] = previo[clave]
            destino[clave]["desactualizado"] = True


def main():
    prev_f, prev_m = cargar("fiscal.json"), cargar("mercado.json")
    fiscal, mercado = {}, {}
    print("Actualizando datos fiscales…")
    for clave, fn in [("isr", isr), ("subsidio", subsidio), ("uma", uma), ("salarioMinimo", salario_minimo),
                      ("iva", iva), ("imss", imss), ("lft", lft)]:
        ejecutar(fiscal, prev_f, clave, fn)
    prev_lisr = {k: prev_f[k] for k in ("honorarios", "resico") if k in prev_f}
    ejecutar(fiscal, {"lisr": prev_lisr} if prev_lisr else {}, "lisr", lisr)
    bloque = fiscal.pop("lisr", {})
    if bloque.pop("desactualizado", False):
        for v in bloque.values():
            v["desactualizado"] = True
    fiscal.update(bloque)
    print("Actualizando indicadores de mercado…")
    ejecutar(mercado, prev_m, "banxico", banxico)

    stamp = HOY.strftime("%Y-%m-%dT%H:%M:%S-06:00")
    fiscal["generado"] = stamp
    fiscal["avisos"] = [a for a in avisos if not a.startswith("banxico")]
    mercado["generado"] = stamp
    mercado["avisos"] = [a for a in avisos if a.startswith("banxico")]
    guardar("fiscal.json", fiscal)
    guardar("mercado.json", mercado)
    print(f"Listo. Avisos: {len(avisos)}")


if __name__ == "__main__":
    main()
