/**
 * Generador de sugerencias para planes alimentarios — RF-10.
 *
 * Esto NO reemplaza el criterio de la nutricionista. Es una guía rápida:
 * a partir de los macronutrientes que se marcan como necesarios, propone
 * alimentos accesibles en comunidades rurales de San Pedro Sacatepéquez
 * (Sección 2.2.1) y arma un menú de 5 tiempos con ellos. La nutricionista
 * revisa, ajusta las indicaciones en texto libre si hace falta, y recién
 * entonces se guarda el plan — el menú generado queda fijo en ese
 * momento (columna `menu_sugerido`), no se recalcula después.
 *
 * La lista de alimentos es deliberadamente corta: el objetivo es
 * orientar con opciones realistas para la zona, no simular una consulta
 * nutricional completa con múltiples alternativas por comida.
 */

export const MACRONUTRIENTES = [
  {
    id: 'energia',
    etiqueta: 'Energía (calorías)',
    alimentos: ['Tortilla de maíz', 'Atol de incaparina', 'Plátano', 'Papa', 'Arroz'],
  },
  {
    id: 'proteina',
    etiqueta: 'Proteína',
    alimentos: ['Huevo', 'Frijol', 'Incaparina', 'Queso fresco', 'Leche'],
  },
  {
    id: 'hierro',
    etiqueta: 'Hierro',
    alimentos: ['Frijol', 'Hierba de bledo o chipilín', 'Hígado de pollo o res', 'Incaparina fortificada'],
  },
  {
    id: 'zinc',
    etiqueta: 'Zinc',
    alimentos: ['Frijol', 'Semilla de ayote tostada', 'Huevo', 'Carne de res'],
  },
  {
    id: 'vitaminaA',
    etiqueta: 'Vitamina A',
    alimentos: ['Zanahoria', 'Papaya', 'Ayote sazón', 'Hoja de chipilín'],
  },
  {
    id: 'calcio',
    etiqueta: 'Calcio',
    alimentos: ['Leche', 'Queso fresco', 'Tortilla (nixtamal con cal)', 'Hierba de bledo'],
  },
]

/**
 * Reglas por edad. Son criterios clínicos de seguridad, así que viven en
 * una tabla para que la nutricionista las pueda revisar y ajustar sin
 * tocar el algoritmo. PENDIENTE de validar con ella antes de usarlas con
 * pacientes reales.
 *
 *  - hastaMeses: la regla aplica a pacientes con menos de esa edad (en
 *    meses); se usa la primera que cumpla.
 *  - sinAlimentos: no se sugieren alimentos (lactancia materna exclusiva).
 *  - excluir: alimentos que no se ofrecen a esa edad.
 *  - sustituir: alimento → versión segura para esa edad.
 *  - nota: texto que se muestra en pantalla y en el PDF.
 */
const SEMILLA_SEGURA = { 'Semilla de ayote tostada': 'Semilla de ayote tostada y molida' }
export const REGLAS_POR_EDAD = [
  {
    hastaMeses: 6,
    sinAlimentos: true,
    nota: 'Menor de 6 meses: lactancia materna exclusiva y a libre demanda; no se sugieren alimentos complementarios.',
  },
  {
    hastaMeses: 12,
    excluir: ['Leche', 'Semilla de ayote tostada'],
    nota: 'De 6 a 11 meses: continuar la lactancia materna y ofrecer los alimentos suaves, en puré o bien machacados, en porciones pequeñas. No dar leche de vaca como bebida principal antes del año ni semillas enteras.',
  },
  {
    hastaMeses: 24,
    sustituir: SEMILLA_SEGURA,
    nota: 'De 12 a 23 meses: continuar la lactancia materna; alimentos blandos en trozos pequeños. Las semillas siempre molidas, por el riesgo de atragantamiento.',
  },
  {
    hastaMeses: 60,
    sustituir: SEMILLA_SEGURA,
    nota: 'De 2 a 4 años: alimentos en trozos pequeños; las semillas siempre molidas, por el riesgo de atragantamiento.',
  },
]

/** Regla que corresponde a una edad en meses (o null si no hay una). */
export function reglaPorEdad(edadMeses) {
  if (edadMeses == null || Number.isNaN(edadMeses)) return null
  return REGLAS_POR_EDAD.find((r) => edadMeses < r.hastaMeses) ?? null
}

const COMIDAS = ['Desayuno', 'Refacción matutina', 'Almuerzo', 'Refacción vespertina', 'Cena']

/**
 * A partir del dictamen de `clasificar()` (Sección 4.2.1, RF-04), sugiere
 * qué macronutrientes marcar por defecto. La nutricionista puede
 * cambiar la selección antes de generar el plan; esto es solo un punto
 * de partida, no una prescripción automática.
 *
 *  - Desnutrición aguda (peso/talla) o bajo peso (peso/edad) → refuerzo
 *    de energía y proteína, la respuesta más inmediata.
 *  - Desnutrición crónica (talla/edad) → proteína, hierro, zinc y
 *    vitamina A, asociados a privación prolongada (Sección 2.5.1).
 */
export function sugerirMacronutrientes(dictamen) {
  if (!dictamen) return []
  const s = new Set()
  if (dictamen.pesoTalla?.severidad > 0 || dictamen.pesoEdad?.severidad > 0) {
    s.add('energia')
    s.add('proteina')
  }
  if (dictamen.tallaEdad?.severidad > 0) {
    s.add('proteina')
    s.add('hierro')
    s.add('zinc')
    s.add('vitaminaA')
  }
  return [...s]
}

/**
 * Arma el listado de alimentos por macronutriente y un menú-guía de 5
 * tiempos, repartiendo los alimentos elegidos sin repetir mientras
 * alcancen; si sobran tiempos de comida, se vuelve a empezar la lista.
 */
export function generarSugerencia(macroIds, edadMeses = null) {
  const regla = reglaPorEdad(edadMeses)
  if (regla?.sinAlimentos) {
    return { alimentosPorMacro: [], menu: [], nota: regla.nota }
  }

  // Adapta la lista a la edad: quita lo que no se ofrece y sustituye por
  // la versión segura. Si un nutriente se queda sin alimentos, se omite.
  const adaptar = (lista) => lista
    .filter((a) => !regla?.excluir?.includes(a))
    .map((a) => regla?.sustituir?.[a] ?? a)

  const seleccionados = MACRONUTRIENTES
    .filter((m) => macroIds.includes(m.id))
    .map((m) => ({ ...m, alimentos: adaptar(m.alimentos) }))
    .filter((m) => m.alimentos.length > 0)

  const alimentosPorMacro = seleccionados.map((m) => ({
    macro: m.etiqueta,
    alimentos: m.alimentos,
  }))

  // Pool para el menú: un alimento por macro, sin repetir nombre.
  const vistos = new Set()
  const pool = []
  seleccionados.forEach((m) => {
    m.alimentos.forEach((alimento) => {
      if (!vistos.has(alimento)) {
        vistos.add(alimento)
        pool.push({ alimento, macro: m.etiqueta })
      }
    })
  })

  const menu = COMIDAS.map((comida, i) => {
    if (pool.length === 0) return { comida, alimento: '—', macro: '' }
    const item = pool[i % pool.length]
    return { comida, alimento: item.alimento, macro: item.macro }
  })

  return { alimentosPorMacro, menu, ...(regla ? { nota: regla.nota } : {}) }
}

export function etiquetasDeMacros(macroIds) {
  return MACRONUTRIENTES.filter((m) => macroIds.includes(m.id)).map((m) => m.etiqueta)
}
