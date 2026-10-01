import { supabase } from './supabase.js'
import { historial } from './registro.js'
import { guardarEnCache, leerDeCache } from './offline.js'

const CLAVE_ESTADO = 'precarga-estado'

/**
 * Descarga y guarda en ESTE dispositivo los datos y el historial de
 * CADA paciente de la lista — no solo el de uno que ya se hubiera
 * abierto antes. Es la pieza que faltaba para el caso de uso real: una
 * brigada a una comunidad sin señal, donde la nutricionista necesita
 * poder consultar la ficha de varios niños y registrarles una medición
 * nueva, sin haber entrado antes a la ficha de cada uno desde la
 * oficina.
 *
 * Se pensó para correr CON conexión, justo antes de salir — un botón en
 * la lista de pacientes ("Preparar para trabajo sin conexión"), no algo
 * automático en segundo plano, para que la nutricionista sepa con
 * certeza que ya quedó lista antes de perder la señal.
 *
 * Es secuencial a propósito (no en paralelo): una conexión móvil rural
 * ya es limitada de por sí, y lanzar decenas de peticiones a la vez
 * sería peor, no mejor. Si una petición falla por red a medio camino,
 * se detiene ahí — lo que ya se alcanzó a guardar queda utilizable
 * igual, y el estado guardado indica que se interrumpió.
 */
export async function precargarPacientes(pacientes, onProgreso) {
  let completados = 0
  for (const p of pacientes) {
    try {
      const [{ data: datos, error }, hist] = await Promise.all([
        supabase
          .from('paciente')
          .select('*, comunidad(nombre, sector)')
          .eq('id', p.id)
          .single(),
        historial(p.id),
      ])
      if (error) throw error
      guardarEnCache(`paciente-datos-${p.id}`, datos)
      guardarEnCache(`paciente-historial-${p.id}`, hist)
      completados++
      onProgreso?.(completados, pacientes.length)
    } catch {
      const estado = { completados, total: pacientes.length, interrumpido: true }
      guardarEnCache(CLAVE_ESTADO, estado)
      return estado
    }
  }
  const estado = { completados, total: pacientes.length, interrumpido: false }
  guardarEnCache(CLAVE_ESTADO, estado)
  return estado
}

/** Último resultado de `precargarPacientes` guardado, o `null` si nunca se corrió. */
export function estadoPrecarga() {
  return leerDeCache(CLAVE_ESTADO)
}
