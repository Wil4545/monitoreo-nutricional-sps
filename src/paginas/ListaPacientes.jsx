import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useSesion } from '../contexto/Sesion.jsx'
import { Aviso, Barra, Cargando, Insignia } from '../componentes/Interfaz.jsx'
import { edadEnMeses } from '../lib/oms/zscore.js'
import { edadLegible, fechaCorta, hoyISO } from '../lib/formato.js'

export default function ListaPacientes() {
  const { perfil } = useSesion()
  const navegar = useNavigate()
  const [pacientes, setPacientes] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('v_paciente_estado')
      .select('*')
      .order('severidad', { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setPacientes(data ?? [])
      })
  }, [])

  const visibles = useMemo(() => {
    if (!pacientes) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return pacientes
    return pacientes.filter((p) =>
      `${p.nombre} ${p.apellido} ${p.codigo} ${p.comunidad ?? ''}`
        .toLowerCase()
        .includes(q),
    )
  }, [pacientes, busqueda])

  const enSeguimiento = pacientes?.filter((p) => p.severidad > 0).length ?? 0

  return (
    <div className="marco">
      <Barra
        volver
        sub="Centro de Salud · San Pedro Sacatepéquez"
        titulo="Pacientes en monitoreo"
      />

      <main className="contenido">
        {perfil && (
          <p className="eyebrow">
            {perfil.nombre} · {perfil.rol?.nombre ?? 'Sin rol asignado'}
          </p>
        )}

        <Aviso tipo="error">{error}</Aviso>

        <div className="campo">
          <label className="campo__etiqueta" htmlFor="buscar">
            Buscar paciente
          </label>
          <input
            id="buscar"
            type="search"
            placeholder="Nombre, código o comunidad"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {pacientes === null ? (
          <Cargando>Cargando pacientes…</Cargando>
        ) : pacientes.length === 0 ? (
          <div className="vacio">
            <p>Todavía no hay pacientes registrados.</p>
            <Link className="boton boton--principal" to="/pacientes/nuevo">
              Registrar el primero
            </Link>
          </div>
        ) : (
          <>
            <p className="eyebrow">
              {visibles.length} de {pacientes.length} · {enSeguimiento} con alguna alteración
            </p>

            <ul className="lista">
              {visibles.map((p) => (
                <li key={p.id}>
                  <button
                    className="lista__fila"
                    onClick={() => navegar(`/pacientes/${p.id}`)}
                  >
                    <div className="lista__cuerpo">
                      <div className="lista__nombre">
                        {p.nombre} {p.apellido}
                      </div>
                      <div className="lista__meta">
                        {p.codigo} · {edadLegible(edadEnMeses(p.fecha_nacimiento, hoyISO()))}
                        {p.comunidad ? ` · ${p.comunidad}` : ''}
                      </div>
                      <div className="lista__meta">
                        {p.fecha_medicion
                          ? `Última cita ${fechaCorta(p.fecha_medicion)}`
                          : 'Sin mediciones registradas'}
                      </div>
                    </div>
                    {p.severidad != null && <Insignia severidad={p.severidad} />}
                  </button>
                </li>
              ))}
            </ul>

            {visibles.length === 0 && (
              <div className="vacio">
                <p>Ningún paciente coincide con «{busqueda}».</p>
              </div>
            )}
          </>
        )}
      </main>

      <div className="barra-accion">
        <div>
          <Link className="boton boton--principal boton--ancho" to="/pacientes/nuevo">
            Registrar paciente
          </Link>
        </div>
      </div>
    </div>
  )
}
