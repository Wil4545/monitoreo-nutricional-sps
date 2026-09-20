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
export function generarSugerencia(macroIds) {
  const seleccionados = MACRONUTRIENTES.filter((m) => macroIds.includes(m.id))

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

  return { alimentosPorMacro, menu }
}

export function etiquetasDeMacros(macroIds) {
  return MACRONUTRIENTES.filter((m) => macroIds.includes(m.id)).map((m) => m.etiqueta)
}
