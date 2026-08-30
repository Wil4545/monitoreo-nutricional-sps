/**
 * Cálculo de puntajes Z antropométricos — Patrones de Crecimiento Infantil OMS
 * Requerimiento funcional RF-03 (Sección 4.2.1)
 *
 * Método LMS (Cole & Green):
 *
 *        ((X / M)^L − 1) / (L · S)      cuando L ≠ 0
 *   z =
 *        ln(X / M) / S                  cuando L = 0
 *
 * Fuera del rango ±3 DE la OMS reemplaza la curva por una extrapolación
 * lineal, porque el ajuste LMS pierde precisión en las colas y produce
 * valores inverosímiles en niños con desnutrición severa. Ese ajuste está
 * implementado en `ajustarExtremos` y es indispensable: sin él, los casos
 * más graves —justamente los que el sistema debe detectar— quedan mal
 * clasificados.
 *
 * Las tablas L, M, S provienen de los documentos oficiales de la OMS
 * (0–60 meses). Ver src/lib/oms/lms.json.
 */

import tablas from './lms.js'

/** Días promedio por mes que usa WHO Anthro para convertir edad. */
const DIAS_POR_MES = 30.4375

/** Diferencia entre talla acostado y de pie según la OMS. */
const AJUSTE_POSICION_CM = 0.7

/**
 * Edad en meses decimales entre dos fechas.
 * @param {string|Date} fechaNacimiento
 * @param {string|Date} fechaMedicion
 * @returns {number} edad en meses
 */
export function edadEnMeses(fechaNacimiento, fechaMedicion) {
  const nac = new Date(fechaNacimiento)
  const med = new Date(fechaMedicion)
  const dias = (med - nac) / 86400000
  return dias / DIAS_POR_MES
}

/**
 * Interpola linealmente los parámetros L, M, S de una tabla para una
 * clave que puede caer entre dos filas (edad en meses, o talla en cm).
 * Devuelve null si la clave queda fuera del rango cubierto por la OMS.
 */
function buscarLMS(tabla, clave) {
  const claves = Object.keys(tabla).map(Number).sort((a, b) => a - b)
  const min = claves[0]
  const max = claves[claves.length - 1]
  if (clave < min || clave > max) return null

  // Coincidencia exacta
  const exacta = tabla[clave] ?? tabla[clave.toFixed(1)]
  if (exacta) return { L: exacta[0], M: exacta[1], S: exacta[2] }

  // Filas que encierran la clave
  let i = 0
  while (i < claves.length - 1 && claves[i + 1] < clave) i++
  const k0 = claves[i]
  const k1 = claves[i + 1]
  const a = tabla[k0] ?? tabla[k0.toFixed(1)]
  const b = tabla[k1] ?? tabla[k1.toFixed(1)]
  if (!a || !b) return null

  const t = (clave - k0) / (k1 - k0)
  return {
    L: a[0] + (b[0] - a[0]) * t,
    M: a[1] + (b[1] - a[1]) * t,
    S: a[2] + (b[2] - a[2]) * t,
  }
}

/** Valor de la medida correspondiente a un número dado de desviaciones. */
function valorEnDE(L, M, S, de) {
  return L === 0
    ? M * Math.exp(S * de)
    : M * Math.pow(1 + L * S * de, 1 / L)
}

/**
 * Extrapolación lineal de la OMS para |z| > 3.
 */
function ajustarExtremos(z, valor, L, M, S) {
  if (z > 3) {
    const sd3 = valorEnDE(L, M, S, 3)
    const sd2 = valorEnDE(L, M, S, 2)
    return 3 + (valor - sd3) / (sd3 - sd2)
  }
  if (z < -3) {
    const sd3 = valorEnDE(L, M, S, -3)
    const sd2 = valorEnDE(L, M, S, -2)
    return -3 + (valor - sd3) / (sd2 - sd3)
  }
  return z
}

/** Puntaje Z crudo por LMS, con ajuste de colas. */
function calcularZ(valor, { L, M, S }) {
  const z = L === 0
    ? Math.log(valor / M) / S
    : (Math.pow(valor / M, L) - 1) / (L * S)
  return redondear(ajustarExtremos(z, valor, L, M, S))
}

function redondear(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/**
 * Convierte la talla medida a la base que espera cada tabla de la OMS:
 * longitud (acostado) antes de los 24 meses, estatura (de pie) después.
 *
 * Cuando no se registró la posición (`medidoAcostado === null`) se asume
 * que se usó la posición estándar para la edad y no se aplica corrección.
 * Suponer lo contrario introduciría un sesgo sistemático de 0.7 cm en
 * todos los lactantes, suficiente para desplazar la clasificación de
 * talla para la edad en un tercio de desviación estándar.
 */
function normalizarTalla(tallaCm, edadMeses, medidoAcostado) {
  if (medidoAcostado === null || medidoAcostado === undefined) return tallaCm
  if (edadMeses < 24 && !medidoAcostado) return tallaCm + AJUSTE_POSICION_CM
  if (edadMeses >= 24 && medidoAcostado) return tallaCm - AJUSTE_POSICION_CM
  return tallaCm
}

/**
 * Calcula los tres indicadores antropométricos de una medición.
 *
 * @param {object} m
 * @param {'M'|'F'} m.sexo
 * @param {string|Date} m.fechaNacimiento
 * @param {string|Date} m.fechaMedicion
 * @param {number} m.pesoKg
 * @param {number} m.tallaCm
 * @param {boolean} [m.medidoAcostado]
 * @returns {{edadMeses:number, zPesoEdad:number|null, zTallaEdad:number|null,
 *            zPesoTalla:number|null, fueraDeRango:string[]}}
 */
export function calcularIndicadores({
  sexo,
  fechaNacimiento,
  fechaMedicion,
  pesoKg,
  tallaCm,
  medidoAcostado = null,
}) {
  const edadMeses = edadEnMeses(fechaNacimiento, fechaMedicion)
  const fueraDeRango = []

  const tallaOms = normalizarTalla(tallaCm, edadMeses, medidoAcostado)

  // Peso para la edad
  const lmsPE = buscarLMS(tablas.pe[sexo], edadMeses)
  const zPesoEdad = lmsPE ? calcularZ(pesoKg, lmsPE) : null
  if (!lmsPE) fueraDeRango.push('peso para la edad')

  // Talla para la edad
  const lmsTE = buscarLMS(tablas.te[sexo], edadMeses)
  const zTallaEdad = lmsTE ? calcularZ(tallaOms, lmsTE) : null
  if (!lmsTE) fueraDeRango.push('talla para la edad')

  // Peso para la talla — la tabla depende del grupo de edad
  const tablaPT = edadMeses < 24 ? tablas.pt_long[sexo] : tablas.pt_tall[sexo]
  const lmsPT = buscarLMS(tablaPT, Math.round(tallaOms * 10) / 10)
  const zPesoTalla = lmsPT ? calcularZ(pesoKg, lmsPT) : null
  if (!lmsPT) fueraDeRango.push('peso para la talla')

  return {
    edadMeses: Math.round(edadMeses * 100) / 100,
    zPesoEdad,
    zTallaEdad,
    zPesoTalla,
    fueraDeRango,
  }
}
