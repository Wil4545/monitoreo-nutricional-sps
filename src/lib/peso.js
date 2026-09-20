/**
 * Conversión kilogramos ↔ libras/onzas — a pedido de la nutricionista:
 * la medición clínica y las tablas de la OMS usan kilogramos, pero en
 * Guatemala el personal suele pesar y pensar en libras y onzas. Ambos
 * campos en `NuevaMedicion.jsx` representan el mismo dato; esta es la
 * única fuente de verdad para la conversión entre ellos.
 *
 * 1 libra = 0.45359237 kg exactos (definición internacional de la
 * libra avoirdupois); 1 libra = 16 onzas.
 */
export const KG_POR_LIBRA = 0.45359237

/** kg → { libras, onzas } — onzas con un decimal, sin llegar a 16 (se acarrea a libras). */
export function kgALibraOnza(kg) {
  if (!Number.isFinite(kg) || kg < 0) return { libras: '', onzas: '' }
  const totalLibras = kg / KG_POR_LIBRA
  let libras = Math.floor(totalLibras)
  let onzas = Math.round((totalLibras - libras) * 16 * 10) / 10
  if (onzas >= 16) { libras += 1; onzas -= 16 }
  return { libras: String(libras), onzas: String(onzas) }
}

/** libras/onzas → kg, con dos decimales (misma precisión que la columna `peso_kg`). */
export function libraOnzaAKg(libras, onzas) {
  const lb = Number(libras)
  const oz = Number(onzas)
  const lbValida = libras !== '' && Number.isFinite(lb)
  const ozValida = onzas !== '' && Number.isFinite(oz)
  if (!lbValida && !ozValida) return ''

  const totalLibras = (lbValida ? lb : 0) + (ozValida ? oz : 0) / 16
  if (totalLibras <= 0) return ''
  return (totalLibras * KG_POR_LIBRA).toFixed(2)
}
