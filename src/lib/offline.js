/**
 * Cola de mediciones sin conexión — RF-11 (registro sin conexión) y
 * RF-12 (sincronización), alcance acotado para esta entrega.
 *
 * Qué SÍ resuelve: si al guardar una medición no hay red, el registro
 * no se pierde — se guarda en este dispositivo (localStorage) y se
 * reintenta automáticamente en cuanto vuelve la conexión, o con el
 * botón "Sincronizar ahora".
 *
 * Qué NO resuelve (documentado también en el README): no hay
 * resolución de conflictos. Si el mismo paciente recibiera dos
 * mediciones distintas guardadas sin conexión en dos dispositivos
 * distintos, ambas se sincronizan tal cual, como citas separadas — no
 * se detecta ni se fusiona el conflicto. Con la realidad operativa de
 * este distrito (una o dos personas cubriendo todo el municipio, ver
 * 07_revertir_alcance_comunidad.sql) esa colisión es poco probable,
 * pero sigue siendo una limitación real de este alcance, no un caso
 * cubierto silenciosamente.
 *
 * Además de la cola de escritura, este módulo guarda una copia de
 * lectura (`guardarEnCache`/`leerDeCache`): cada vez que la lista de
 * pacientes o la ficha de uno se cargan con éxito estando en línea, se
 * deja una copia en este dispositivo. Si luego se abre esa misma
 * pantalla sin conexión, se muestra esa copia en vez de una pantalla en
 * blanco, con aviso de que es la última que se pudo guardar — no se
 * refresca sola ni se mezcla con nada nuevo mientras no haya señal.
 */

const CLAVE = 'mnsps_mediciones_pendientes'
const PREFIJO_CACHE = 'mnsps_cache_'

function leer() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '[]')
  } catch {
    return []
  }
}

function escribir(lista) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista))
  } catch {
    // Almacenamiento no disponible (modo privado, cuota llena, etc.) —
    // la medición ya se intentó guardar en línea antes de llegar aquí;
    // no hay una segunda red de seguridad posible en ese caso.
  }
}

/** Guarda una medición en la cola local para reintentar más tarde. */
export function encolarMedicionPendiente({ paciente, medicion, usuarioId }) {
  const lista = leer()
  lista.push({
    idLocal: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    guardadoEn: new Date().toISOString(),
    paciente,
    medicion,
    usuarioId,
  })
  escribir(lista)
}

export function contarPendientes() {
  return leer().length
}

/**
 * Lista completa de mediciones en cola (no solo el conteo), para
 * mostrar qué queda pendiente — por ejemplo cuando se guardaron varias
 * mediciones distintas sin conexión antes de recuperar la señal.
 */
export function listaPendientes() {
  return leer()
}

/**
 * Distingue un error de red (sin conexión, o la petición nunca llegó al
 * servidor) de un error de validación que Supabase sí alcanzó a
 * responder. Solo el primero debería mandar la medición a la cola —
 * el segundo es un dato mal formado y hay que corregirlo, no encolarlo.
 */
export function esErrorDeRed(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = String(err?.message ?? err ?? '').toLowerCase()
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('conexión') ||
    msg.includes('failed to') ||
    msg.includes('tiempo de espera')
  )
}

const TIEMPO_LIMITE_MS = 8000

/**
 * Pone un límite de tiempo a una petición de red.
 *
 * En campo, una señal débil (el caso real de una brigada rural) no
 * siempre falla rápido con un error claro como "Failed to fetch" — a
 * veces la petición se queda esperando una respuesta que nunca llega, o
 * tarda mucho más de lo razonable. `navigator.onLine` tampoco es
 * confiable ahí: puede seguir marcando "en línea" porque el teléfono
 * sigue asociado a una red, aunque esa red no tenga salida real a
 * internet. Sin este límite, esas pantallas se quedarían en
 * "Cargando…" indefinidamente en vez de caer al dato cacheado o avisar
 * con claridad que no hay conexión — que es exactamente el síntoma que
 * se ve sin este tiempo límite.
 */
export function conTiempoLimite(promesa, ms = TIEMPO_LIMITE_MS) {
  return Promise.race([
    promesa,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new TypeError('Failed to fetch (tiempo de espera agotado)')),
        ms,
      ),
    ),
  ])
}

/**
 * Reintenta cada medición en cola, en el orden en que se guardaron.
 * Se detiene en el primer error de red (no tiene caso seguir probando
 * las demás si la conexión sigue caída) pero continúa si el error es
 * de otro tipo, para no bloquear la cola completa por un solo registro
 * problemático.
 *
 * @param {(args: {paciente, medicion, usuarioId}) => Promise} guardarMedicion
 */
export async function sincronizarPendientes(guardarMedicion) {
  const lista = leer()
  if (lista.length === 0) return { sincronizadas: 0, restantes: 0 }

  let sincronizadas = 0
  const restantes = [...lista]

  for (const item of lista) {
    try {
      await guardarMedicion({ paciente: item.paciente, medicion: item.medicion, usuarioId: item.usuarioId })
      sincronizadas++
      const i = restantes.findIndex((r) => r.idLocal === item.idLocal)
      if (i !== -1) restantes.splice(i, 1)
    } catch (err) {
      if (esErrorDeRed(err)) break
      // Error no relacionado con la red: se deja en la cola (queda en
      // `restantes`, que ya la incluye) y se sigue con la siguiente.
    }
  }

  escribir(restantes)
  return { sincronizadas, restantes: restantes.length }
}

/**
 * Guarda una copia de datos ya obtenidos en línea (lista de pacientes,
 * ficha de uno) para poder mostrarlos si luego se abre la misma
 * pantalla sin conexión. No reemplaza al servidor: solo guarda la
 * última respuesta exitosa por `clave`.
 */
export function guardarEnCache(clave, datos) {
  try {
    localStorage.setItem(
      PREFIJO_CACHE + clave,
      JSON.stringify({ datos, guardadoEn: new Date().toISOString() }),
    )
  } catch {
    // Sin espacio o almacenamiento no disponible: la pantalla ya cargó
    // en línea de todas formas, simplemente no queda copia para luego.
  }
}

/**
 * Lee la última copia cacheada bajo `clave`.
 * Devuelve `{ datos, guardadoEn }` o `null` si nunca se guardó una.
 */
export function leerDeCache(clave) {
  try {
    const crudo = localStorage.getItem(PREFIJO_CACHE + clave)
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

/**
 * Mensaje para pantallas que SÍ necesitan red y no tienen copia en
 * caché que mostrar (Mapa, Reportes, Auditoría, Planes alimentarios,
 * Registrar paciente nuevo): evita mostrar el "TypeError: Failed to
 * fetch" crudo del navegador, y explica con honestidad que esa pantalla
 * en particular está fuera del alcance acotado de RF-11/RF-12 — no
 * todo el sistema funciona sin conexión, solo lo que documenta el
 * encabezado de este archivo y el README.
 */
export function mensajeErrorRed(err, pantalla = 'esta pantalla') {
  if (esErrorDeRed(err)) {
    return `Sin conexión: ${pantalla} necesita señal para cargar. Vuelve a intentarlo cuando se restablezca.`
  }
  return err?.message ?? 'Ocurrió un error inesperado.'
}
