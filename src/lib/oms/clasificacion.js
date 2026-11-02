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

/**
 * Valoración según la norma nacional (MSPAS) — se calcula al leer, no se
 * guarda, para no alterar los registros ni la clasificación de la OMS.
 *
 * La desnutrición aguda se define por peso/talla < −2 DE; con ≥ −2 DE el
 * niño se considera estable y lleva control preventivo (entrevista a la
 * nutricionista, noviembre de 2026). La talla baja (retardo de
 * crecimiento) no es una urgencia: se vigila el ritmo de crecimiento.
 * La aplicación no registra signos clínicos (edema, deshidratación,
 * respiración agitada), por lo que nunca declara un "caso crítico":
 * solo avisa que con P/T < −3 DE se requiere valoración clínica.
 *
 * @returns {{sinAguda:boolean|null, mensaje:string}|null}
 */
export function valoracionNormativa({ zPesoTalla, zTallaEdad }) {
  const pt = zPesoTalla == null ? null : Number(zPesoTalla)
  const te = zTallaEdad == null ? null : Number(zTallaEdad)
  if (pt == null || Number.isNaN(pt)) return null
  if (pt < -3) {
    return {
      sinAguda: false,
      mensaje: 'Desnutrición aguda severa por antropometría: requiere valoración clínica (signos de deshidratación, respiración agitada, edema) para decidir la referencia.',
    }
  }
  if (pt < -2) {
    return { sinAguda: false, mensaje: 'Desnutrición aguda moderada: seguimiento según el protocolo de desnutrición aguda.' }
  }
  const retardo = te != null && !Number.isNaN(te) && te < -2
  return {
    sinAguda: true,
    mensaje: retardo
      ? 'Sin desnutrición aguda (P/T ≥ −2 DE): control preventivo según la norma nacional. La talla baja se vigila por su ritmo de crecimiento, no es una urgencia.'
      : 'Sin desnutrición aguda (P/T ≥ −2 DE): control preventivo según la norma nacional.',
  }
}
