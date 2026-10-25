import { jsPDF } from 'jspdf'
import { fechaCorta } from './formato.js'

/**
 * PDF del plan alimentario — para entregar impreso al tutor del paciente.
 * Se genera en el navegador (sin backend) a partir de los mismos datos
 * que se guardaron en `plan_alimentario`, así que un plan creado antes de
 * que existiera `menu_sugerido` (o sin costo, descripción o fecha de fin)
 * también se puede descargar: las secciones sin datos simplemente no se
 * dibujan.
 *
 * Diseño: banner verde con el nombre del paciente, tarjeta de datos,
 * "etiquetas" de color por nutriente, tarjetas de alimentos y un menú
 * numerado. El contenido fluye: si no cabe en una página, continúa en la
 * siguiente con un encabezado delgado.
 */

// ---- Paleta (la misma de la app: estilos.css) ----------------------------
const JADE = [20, 112, 92]
const JADE_OSCURO = [13, 79, 65]
const TINTA = [20, 38, 46]
const GRIS = [74, 96, 104]
const LINEA = [204, 214, 216]
const PAPEL = [244, 247, 246]
const BLANCO = [255, 255, 255]

// Un color por nutriente, para reconocerlo en todo el documento.
const COLOR_MACRO = {
  'Energía (calorías)': [176, 125, 10],
  'Proteína': [20, 112, 92],
  'Hierro': [155, 60, 50],
  'Zinc': [59, 91, 140],
  'Vitamina A': [192, 86, 33],
  'Calcio': [100, 90, 150],
}
const colorDe = (macro) => COLOR_MACRO[macro] ?? JADE
const tinte = (c, t = 0.86) => c.map((v) => Math.round(v + (255 - v) * t))

// ---- Geometría (hoja carta, en puntos) -----------------------------------
const ANCHO_PAG = 612
const MARGEN = 40
const ANCHO = ANCHO_PAG - MARGEN * 2
const LIMITE_Y = 735 // por debajo de esto va el pie de página

export function descargarPlanPdf({ paciente, plan }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })

  // ---- utilidades de dibujo ----------------------------------------------
  const relleno = (c) => doc.setFillColor(...c)
  const trazo = (c) => doc.setDrawColor(...c)
  const rect = (x, y, w, h, r, fill, line) => {
    if (fill) relleno(fill)
    if (line) trazo(line)
    doc.setLineWidth(0.8)
    doc.roundedRect(x, y, w, h, r, r, fill && line ? 'FD' : fill ? 'F' : 'S')
  }
  const texto = (t, x, y, { size = 10, bold = false, italic = false, color = TINTA, align = 'left' } = {}) => {
    doc.setFont('helvetica', bold ? (italic ? 'bolditalic' : 'bold') : italic ? 'italic' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.text(t, x, y, { align })
  }
  const ancho = (t, size, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    return doc.getTextWidth(t)
  }
  const partir = (t, w, size, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    return doc.splitTextToSize(String(t), w)
  }
  // Etiqueta redondeada ("chip"); devuelve su ancho.
  const chip = (x, y, t, c, { size = 9, h = 18, solid = false } = {}) => {
    const w = ancho(t, size, true) + 16
    rect(x, y, w, h, h / 2, solid ? c : tinte(c, 0.85))
    texto(t, x + 8, y + h / 2 + size * 0.35, { size, bold: true, color: solid ? BLANCO : c })
    return w
  }
  // Coloca etiquetas en renglones; devuelve la y donde terminan.
  const etiquetas = (x, y, maxW, items, { gap = 5, h = 18, size = 9, solid = false } = {}) => {
    let cx = x
    let cy = y
    for (const [t, c] of items) {
      const w = ancho(t, size, true) + 16
      if (cx + w > x + maxW && cx > x) { cx = x; cy += h + gap }
      chip(cx, cy, t, c, { size, h, solid })
      cx += w + gap
    }
    return cy + h
  }
  // Ícono: bowl con hojas (el mismo del favicon). `ruta` recibe puntos
  // absolutos en un espacio de 192x192 y los convierte a lo que pide jsPDF.
  const ruta = (cmds, ox, oy, s, color) => {
    let cx = 0, cy = 0, sx = 0, sy = 0
    const seg = []
    for (const c of cmds) {
      if (c[0] === 'M') { sx = ox + c[1] * s; sy = oy + c[2] * s; cx = sx; cy = sy }
      else if (c[0] === 'L') { const x = ox + c[1] * s, y = oy + c[2] * s; seg.push([x - cx, y - cy]); cx = x; cy = y }
      else {
        const p = [ox + c[1] * s, oy + c[2] * s, ox + c[3] * s, oy + c[4] * s, ox + c[5] * s, oy + c[6] * s]
        seg.push([p[0] - cx, p[1] - cy, p[2] - cx, p[3] - cy, p[4] - cx, p[5] - cy])
        cx = p[4]; cy = p[5]
      }
    }
    relleno(color)
    doc.lines(seg, sx, sy, [1, 1], 'F', true)
  }
  const bowl = (x, y, size, color) => {
    const s = size / 192
    ruta([['M', 94, 104], ['C', 66, 100, 56, 72, 66, 50], ['C', 92, 54, 104, 80, 94, 104]], x, y, s, color)
    ruta([['M', 98, 104], ['C', 102, 78, 122, 58, 148, 62], ['C', 148, 86, 130, 102, 98, 104]], x, y, s, color)
    ruta([['M', 96, 104], ['C', 80, 82, 86, 58, 98, 36], ['C', 116, 58, 116, 84, 96, 104]], x, y, s, color)
    ruta([['M', 34, 108], ['L', 158, 108], ['C', 158, 140, 132, 160, 96, 160], ['C', 60, 160, 34, 140, 34, 108]], x, y, s, color)
    rect(x + 74 * s, y + 156 * s, 44 * s, 10 * s, 5 * s, color)
  }

  const nombreCompleto = `${paciente.nombre} ${paciente.apellido}`
  const comunidad = paciente.comunidad?.nombre ?? null

  // ---- páginas -------------------------------------------------------------
  let y = 0
  const nuevaPagina = () => {
    doc.addPage()
    relleno(JADE)
    doc.rect(0, 0, ANCHO_PAG, 34, 'F')
    texto(`Plan alimentario · ${nombreCompleto}`, MARGEN, 21, { size: 9.5, bold: true, color: BLANCO })
    texto(paciente.codigo, ANCHO_PAG - MARGEN, 21, { size: 9.5, color: [200, 230, 222], align: 'right' })
    y = 62
  }
  // Si lo que sigue no cabe, pasa a una página nueva.
  const asegurar = (alto) => { if (y + alto > LIMITE_Y) nuevaPagina() }
  const titulo = (t) => { texto(t, MARGEN, y, { size: 11.5, bold: true }); y += 10 }

  // ---- banner ----------------------------------------------------------------
  relleno(JADE)
  doc.rect(0, 0, ANCHO_PAG, 128, 'F')
  relleno(JADE_OSCURO)
  doc.rect(0, 0, ANCHO_PAG, 6, 'F')
  texto('PLAN ALIMENTARIO', MARGEN, 50, { size: 9.5, bold: true, color: [190, 226, 216] })
  // El nombre se achica si es largo, para no chocar con el ícono.
  const anchoNombre = 440
  let tam = 24
  while (tam > 14 && ancho(nombreCompleto, tam, true) > anchoNombre) tam -= 1
  const lineasNombre = partir(nombreCompleto, anchoNombre, tam, true).slice(0, 2)
  texto(lineasNombre, MARGEN, 78, { size: tam, bold: true, color: BLANCO })
  texto('Sistema de Monitoreo Nutricional · San Pedro Sacatepéquez', MARGEN, 98 + (lineasNombre.length - 1) * tam * 1.1, { size: 9.5, color: [200, 230, 222] })
  relleno(BLANCO)
  doc.circle(540, 62, 34, 'F')
  bowl(512, 34, 56, JADE)

  // ---- tarjeta de datos ----------------------------------------------------------
  const vigencia = plan.fecha_fin
    ? `${fechaCorta(plan.fecha_inicio)} – ${fechaCorta(plan.fecha_fin)}`
    : `Desde ${fechaCorta(plan.fecha_inicio)}`
  const datos = [['CÓDIGO', paciente.codigo]]
  if (comunidad) datos.push(['COMUNIDAD', comunidad])
  datos.push([plan.fecha_fin ? 'VIGENCIA' : 'VIGENCIA (EN CURSO)', vigencia])
  if (plan.costo_diario) datos.push(['COSTO ESTIMADO', `Q${Number(plan.costo_diario).toFixed(2)} / día`])
  rect(MARGEN, 112, ANCHO, 60, 8, BLANCO, LINEA)
  const cw = ANCHO / datos.length
  datos.forEach(([etiqueta, valor], i) => {
    const x = MARGEN + 14 + i * cw
    texto(etiqueta, x, 134, { size: 7.5, bold: true, color: GRIS })
    // Si el valor no cabe en su columna, se reduce un poco el tamaño.
    let t = 10.5
    while (t > 8 && ancho(valor, t, true) > cw - 22) t -= 0.5
    texto(valor, x, 152, { size: t, bold: true })
    if (i) { trazo(LINEA); doc.setLineWidth(0.8); doc.line(x - 8, 124, x - 8, 160) }
  })
  y = 204

  // ---- nombre y descripción del plan -----------------------------------------------
  const lineasPlan = partir(plan.nombre, ANCHO, 15, true)
  texto(lineasPlan, MARGEN, y, { size: 15, bold: true, color: JADE_OSCURO })
  y += (lineasPlan.length - 1) * 17 + 12
  if (plan.descripcion) {
    const ls = partir(plan.descripcion, ANCHO - 32, 10)
    const h = Math.max(46, ls.length * 13 + 20)
    asegurar(h + 20)
    rect(MARGEN, y, ANCHO, h, 6, PAPEL)
    relleno(JADE)
    doc.rect(MARGEN, y + 6, 3, h - 12, 'F')
    texto(ls, MARGEN + 16, y + 18, { size: 10, color: GRIS })
    y += h + 22
  } else {
    y += 10
  }

  // ---- indicación según la edad del paciente -----------------------------------------
  const nota = plan.sugerencia?.nota
  if (nota) {
    const ls = partir(nota, ANCHO - 32, 9.5)
    const h = ls.length * 12.5 + 20
    asegurar(h + 16)
    rect(MARGEN, y, ANCHO, h, 6, tinte(COLOR_MACRO['Energía (calorías)'], 0.88))
    relleno(COLOR_MACRO['Energía (calorías)'])
    doc.rect(MARGEN, y + 6, 3, h - 12, 'F')
    texto(ls, MARGEN + 16, y + 17, { size: 9.5, color: TINTA })
    y += h + 20
  }

  // ---- necesidades reforzadas ----------------------------------------------------------
  const macros = plan.macronutrientes_etiquetas ?? plan.macronutrientes ?? []
  if (macros.length) {
    asegurar(70)
    titulo('Necesidades reforzadas')
    y = etiquetas(MARGEN, y, ANCHO, macros.map((m) => [m, colorDe(m)]), { solid: true, h: 20, size: 9.5 }) + 24
  }

  // ---- alimentos sugeridos (tarjetas de dos columnas) --------------------------------------
  const grupos = plan.sugerencia?.alimentosPorMacro ?? []
  if (grupos.length) {
    asegurar(110)
    titulo('Alimentos sugeridos')
    const gw = (ANCHO - 12) / 2
    // Alto de una tarjeta según cuántos renglones de etiquetas ocupa.
    const altoTarjeta = (g) => {
      let cx = 0, filas = 1
      for (const a of g.alimentos) {
        const w = ancho(a, 8.5, true) + 16
        if (cx + w > gw - 30 && cx > 0) { cx = 0; filas++ }
        cx += w + 5
      }
      return 36 + filas * 22
    }
    for (let i = 0; i < grupos.length; i += 2) {
      const par = grupos.slice(i, i + 2)
      const h = Math.max(...par.map(altoTarjeta))
      asegurar(h + 10)
      par.forEach((g, j) => {
        const x = MARGEN + j * (gw + 12)
        const c = colorDe(g.macro)
        rect(x, y, gw, h, 6, BLANCO, LINEA)
        relleno(c)
        doc.rect(x, y + 8, 3.5, h - 16, 'F')
        texto(g.macro, x + 16, y + 20, { size: 10, bold: true, color: c })
        etiquetas(x + 16, y + 30, gw - 30, g.alimentos.map((a) => [a, c]), { h: 17, size: 8.5 })
      })
      y += h + 10
    }
    y += 14
  }

  // ---- menú-guía ---------------------------------------------------------------------------------
  const menu = plan.sugerencia?.menu ?? []
  if (menu.length) {
    // El menú (5 filas) se mantiene junto: si no cabe completo, pasa entero
    // a la página siguiente en vez de dejar una sola fila suelta.
    asegurar(10 + menu.length * 36)
    titulo('Menú-guía sugerido')
    menu.forEach((it, i) => {
      asegurar(36)
      const c = colorDe(it.macro)
      rect(MARGEN, y, ANCHO, 32, 6, i % 2 ? BLANCO : PAPEL, i % 2 ? LINEA : null)
      relleno(c)
      doc.circle(MARGEN + 20, y + 16, 10, 'F')
      texto(String(i + 1), MARGEN + 20, y + 19.5, { size: 10, bold: true, color: BLANCO, align: 'center' })
      texto(it.comida, MARGEN + 40, y + 14, { size: 8.5, bold: true, color: GRIS })
      texto(it.alimento, MARGEN + 40, y + 26, { size: 11, bold: true })
      if (it.macro) {
        const w = ancho(it.macro, 8.5, true) + 16
        chip(MARGEN + ANCHO - w - 12, y + 7, it.macro, c, { size: 8.5, h: 18 })
      }
      y += 36
    })
  }

  // ---- pie de página en todas las hojas -----------------------------------------------------------
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    trazo(LINEA)
    doc.setLineWidth(0.6)
    doc.line(MARGEN, 752, MARGEN + ANCHO, 752)
    texto('Guía orientativa, no sustituye una valoración nutricional individual.', MARGEN, 768, { size: 8, color: GRIS })
    texto(
      paginas > 1 ? `Página ${p} de ${paginas}` : 'Sistema de Monitoreo Nutricional · San Pedro Sacatepéquez',
      MARGEN + ANCHO, 768, { size: 8, color: GRIS, align: 'right' },
    )
  }

  doc.save(`plan-alimentario-${paciente.codigo}-${plan.fecha_inicio}.pdf`)
}
