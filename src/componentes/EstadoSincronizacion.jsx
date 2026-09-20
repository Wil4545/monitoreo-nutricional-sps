import { useEffect, useRef, useState } from 'react'
import { guardarMedicion } from '../lib/registro.js'
import { contarPendientes, sincronizarPendientes } from '../lib/offline.js'

/**
 * Aviso persistente de mediciones guardadas sin conexión (RF-11/RF-12,
 * alcance acotado — ver lib/offline.js). Vive junto a las rutas
 * autenticadas en App.jsx, así que es visible sin importar en qué
 * pantalla esté el usuario cuando vuelve la señal.
 */
export default function EstadoSincronizacion() {
  const [pendientes, setPendientes] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const enCurso = useRef(false)

  function actualizarConteo() {
    setPendientes(contarPendientes())
  }

  async function sincronizar() {
    if (enCurso.current) return
    enCurso.current = true
    setSincronizando(true)
    try {
      await sincronizarPendientes(guardarMedicion)
    } finally {
      actualizarConteo()
      setSincronizando(false)
      enCurso.current = false
    }
  }

  useEffect(() => {
    actualizarConteo()
    // Revisa cada pocos segundos por si otra pantalla encoló algo, y de
    // una vez intenta sincronizar si ya hay señal al entrar.
    const intervalo = setInterval(actualizarConteo, 4000)
    window.addEventListener('online', sincronizar)
    if (navigator.onLine) sincronizar()
    return () => {
      clearInterval(intervalo)
      window.removeEventListener('online', sincronizar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (pendientes === 0) return null

  return (
    <div className="aviso aviso--alerta" style={{ margin: '0.75rem 1rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <span>
        {pendientes} {pendientes === 1 ? 'medición guardada' : 'mediciones guardadas'} sin
        conexión, pendiente{pendientes === 1 ? '' : 's'} de sincronizar.
      </span>
      <button type="button" className="boton boton--secundario" onClick={sincronizar} disabled={sincronizando}>
        {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
      </button>
    </div>
  )
}
