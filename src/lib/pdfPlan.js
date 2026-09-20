import { jsPDF } from 'jspdf'
import { fechaCorta } from './formato.js'

/**
 * PDF de una página con el plan alimentario — para entregar impreso al
 * tutor del paciente. Se genera en el navegador (sin backend) a partir
 * de los mismos datos que se guardaron en `plan_alimentario`, así que un
 * plan creado antes de esta actualización (sin `menu_sugerido`) también
 * se puede descargar, solo que sin la sección de menú.
 */
export function descargarPlanPdf({ paciente, plan }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const margen = 48
  let y = margen

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Plan alimentario', margen, y)
  y += 20

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Sistema de Monitoreo Nutricional · San Pedro Sacatepéquez', margen, y)
  y += 24

  doc.setDrawColor(20, 112, 92)
  doc.setLineWidth(1)
  doc.line(margen, y, 612 - margen, y)
  y += 24

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`Paciente: ${paciente.nombre} ${paciente.apellido}`, margen, y)
  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Código: ${paciente.codigo}${paciente.comunidad?.nombre ? ' · ' + paciente.comunidad.nombre : ''}`, margen, y)
  y += 24

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(plan.nombre, margen, y)
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const vigencia = plan.fecha_fin
    ? `Del ${fechaCorta(plan.fecha_inicio)} al ${fechaCorta(plan.fecha_fin)}`
    : `Desde ${fechaCorta(plan.fecha_inicio)} · en curso`
  doc.text(vigencia + (plan.costo_diario ? ` · Costo estimado Q${Number(plan.costo_diario).toFixed(2)}/día` : ''), margen, y)
  y += 20

  if (plan.descripcion) {
    doc.setFont('helvetica', 'italic')
    const lineas = doc.splitTextToSize(plan.descripcion, 612 - margen * 2)
    doc.text(lineas, margen, y)
    y += lineas.length * 13 + 10
    doc.setFont('helvetica', 'normal')
  }

  if (plan.macronutrientes?.length) {
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Necesidades reforzadas', margen, y)
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(plan.macronutrientes_etiquetas?.join(' · ') ?? plan.macronutrientes.join(' · '), margen, y)
    y += 20
  }

  const alimentos = plan.sugerencia?.alimentosPorMacro
  if (alimentos?.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Alimentos sugeridos', margen, y)
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    alimentos.forEach(({ macro, alimentos: lista }) => {
      const texto = `${macro}: ${lista.join(', ')}`
      const lineas = doc.splitTextToSize(texto, 612 - margen * 2)
      doc.text(lineas, margen, y)
      y += lineas.length * 13 + 4
    })
    y += 10
  }

  const menu = plan.sugerencia?.menu
  if (menu?.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Menú-guía sugerido', margen, y)
    y += 18

    menu.forEach((item) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(item.comida, margen, y)
      doc.setFont('helvetica', 'normal')
      doc.text(`${item.alimento}${item.macro ? '  (' + item.macro + ')' : ''}`, margen + 140, y)
      y += 16
    })
    y += 8
  }

  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(
    'Guía orientativa, no sustituye una valoración nutricional individual.',
    margen,
    782,
  )

  const archivo = `plan-alimentario-${paciente.codigo}-${plan.fecha_inicio}.pdf`
  doc.save(archivo)
}
