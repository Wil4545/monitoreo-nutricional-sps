import { useState } from 'react'
import { supabase, configurado } from '../lib/supabase.js'
import { Aviso, Campo } from '../componentes/Interfaz.jsx'

export default function Ingreso() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password: clave,
    })
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'El correo o la contraseña no coinciden. Verifica e intenta de nuevo.'
          : error.message,
      )
      setEnviando(false)
    }
  }

  return (
    <div className="ingreso">
      <div className="ingreso__caja">
        <p className="ingreso__marca">
          Centro de Salud · San Pedro Sacatepéquez
        </p>
        <h1 className="ingreso__titulo">Monitoreo nutricional</h1>

        {!configurado && (
          <Aviso tipo="alerta">
            Falta la conexión con Supabase. Copia <code>.env.example</code> como{' '}
            <code>.env</code> y coloca la URL y la clave del proyecto.
          </Aviso>
        )}

        <Aviso tipo="error">{error}</Aviso>

        <form onSubmit={entrar}>
          <Campo etiqueta="Correo institucional" id="correo">
            <input
              id="correo"
              type="email"
              autoComplete="username"
              required
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </Campo>

          <Campo etiqueta="Contraseña" id="clave">
            <input
              id="clave"
              type="password"
              autoComplete="current-password"
              required
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </Campo>

          <button
            className="boton boton--principal boton--ancho"
            disabled={enviando || !configurado}
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
