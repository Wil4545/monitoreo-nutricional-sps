/**
 * Clasificación del estado nutricional — RF-04 (Sección 4.2.1)
 *
 * Los tres indicadores responden preguntas distintas y no son
 * intercambiables (Sección 2.5.1):
 *
 *   · Talla para la edad  → desnutrición CRÓNICA (retardo del crecimiento,
 *                           consecuencia de privación prolongada)
 *   · Peso para la talla  → desnutrición AGUDA (emaciación reciente,
 *                           es la que exige respuesta inmediata)
 *   · Peso para la edad   → bajo peso, indicador mixto de tamizaje
 *
 * La severidad va de 0 a 3 y ordena la prioridad de intervención; es el
 * valor que alimentará el mapa de calor de la segunda entrega (RF-07).
 */

export const SEVERIDAD = {
  NORMAL: 0,
  RIESGO: 1,
  MODERADA: 2,
  SEVERA: 3,
}

export const ETIQUETA_SEVERIDAD = {
  0: 'Normal',
  1: 'En riesgo',
  2: 'Moderada',
  3: 'Severa',
}

function nivel(etiqueta, severidad) {
  return { etiqueta, severidad }
}

/** Talla para la edad → desnutrición crónica. */
export function clasificarTallaEdad(z) {
  if (z == null) return nivel('Sin dato', 0)
  if (z < -3) return nivel('Desnutrición crónica severa', SEVERIDAD.SEVERA)
  if (z < -2) return nivel('Desnutrición crónica', SEVERIDAD.MODERADA)
  if (z < -1) return nivel('Riesgo de talla baja', SEVERIDAD.RIESGO)
  return nivel('Talla adecuada', SEVERIDAD.NORMAL)
}

/** Peso para la talla → desnutrición aguda, sobrepeso y obesidad. */
export function clasificarPesoTalla(z) {
  if (z == null) return nivel('Sin dato', 0)
  if (z < -3) return nivel('Desnutrición aguda severa', SEVERIDAD.SEVERA)
  if (z < -2) return nivel('Desnutrición aguda moderada', SEVERIDAD.MODERADA)
  if (z < -1) return nivel('Riesgo de desnutrición aguda', SEVERIDAD.RIESGO)
  if (z <= 1) return nivel('Peso adecuado para la talla', SEVERIDAD.NORMAL)
  if (z <= 2) return nivel('Riesgo de sobrepeso', SEVERIDAD.RIESGO)
  if (z <= 3) return nivel('Sobrepeso', SEVERIDAD.MODERADA)
  return nivel('Obesidad', SEVERIDAD.MODERADA)
}

/** Peso para la edad → bajo peso. */
export function clasificarPesoEdad(z) {
  if (z == null) return nivel('Sin dato', 0)
  if (z < -3) return nivel('Bajo peso severo', SEVERIDAD.SEVERA)
  if (z < -2) return nivel('Bajo peso', SEVERIDAD.MODERADA)
  if (z < -1) return nivel('Riesgo de bajo peso', SEVERIDAD.RIESGO)
  if (z <= 2) return nivel('Peso adecuado para la edad', SEVERIDAD.NORMAL)
  return nivel('Peso elevado para la edad', SEVERIDAD.RIESGO)
}

/**
 * Clasificación consolidada de una medición.
 *
 * @param {{zPesoEdad:number|null, zTallaEdad:number|null, zPesoTalla:number|null}} z
 * @returns {{pesoEdad:object, tallaEdad:object, pesoTalla:object,
 *            clasificacion:string, severidad:number}}
 */
export function clasificar({ zPesoEdad, zTallaEdad, zPesoTalla }) {
  const pesoEdad = clasificarPesoEdad(zPesoEdad)
  const tallaEdad = clasificarTallaEdad(zTallaEdad)
  const pesoTalla = clasificarPesoTalla(zPesoTalla)

  const severidad = Math.max(
    pesoEdad.severidad,
    tallaEdad.severidad,
    pesoTalla.severidad,
  )

  // El resumen nombra únicamente los hallazgos con alteración, empezando
  // por la desnutrición aguda por ser la de respuesta más urgente.
  const hallazgos = [pesoTalla, tallaEdad, pesoEdad]
    .filter((d) => d.severidad > 0)
    .map((d) => d.etiqueta)

  const clasificacion = hallazgos.length
    ? hallazgos.join(' · ')
    : 'Estado nutricional normal'

  return { pesoEdad, tallaEdad, pesoTalla, clasificacion, severidad }
}
