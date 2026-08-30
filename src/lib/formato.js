/** Utilidades de presentación. */

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

/** '2025-03-14' → '14 mar 2025' (sin desfase por zona horaria). */
export function fechaCorta(iso) {
  if (!iso) return '—'
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${Number(d)} ${MESES[Number(m) - 1]} ${a}`
}

/** Edad legible: '8 meses', '1 año 3 meses'. */
export function edadLegible(meses) {
  if (meses == null) return '—'
  const total = Math.floor(meses)
  const anios = Math.floor(total / 12)
  const resto = total % 12
  if (anios === 0) return `${total} ${total === 1 ? 'mes' : 'meses'}`
  const parteA = `${anios} ${anios === 1 ? 'año' : 'años'}`
  return resto === 0 ? parteA : `${parteA} ${resto} ${resto === 1 ? 'mes' : 'meses'}`
}

/** Puntaje Z con signo explícito, para que el signo no se pierda al ojear. */
export function formatoZ(z) {
  if (z == null || !Number.isFinite(z)) return '—'
  return (z > 0 ? '+' : '') + z.toFixed(2)
}

export const hoyISO = () => new Date().toISOString().slice(0, 10)

/** Código correlativo legible para el paciente: SPS-2026-0001 */
export function generarCodigo(consecutivo) {
  const anio = new Date().getFullYear()
  return `SPS-${anio}-${String(consecutivo).padStart(4, '0')}`
}
