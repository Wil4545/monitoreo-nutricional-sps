import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useSesion } from '../contexto/Sesion.jsx'
import { Aviso, Barra, Cargando, Insignia } from '../componentes/Interfaz.jsx'
import { edadEnMeses } from '../lib/oms/zscore.js'
import { edadLegible, fechaCorta, fechaHoraCorta, hoyISO } from '../lib/formato.js'
import { conTiempoLimite, esErrorDeRed, guardarEnCache, leerDeCache, mensajeErrorRed } from '../lib/offline.js'
import { estadoPrecarga, precargarPacientes } from '../lib/precarga.js'

const CLAVE_CACHE = 'pacientes'

export default function ListaPacientes() {
  const { perfil } = useSesion()
  const navegar = useNavigate()
  const [pacientes, setPacientes] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState('')
  const [cacheFecha, setCacheFecha] = useState(null)
  const [precargando, setPrecargando] = useState(false)
  const [progreso, setProgreso] = useState({ completados: 0, total: 0 })
  const [estadoPrevio, setEstadoPrevio] = useState(() => estadoPrecarga())

  useEffect(() => {
    conTiempoLimite(supabase
      .from('v_paciente_estado')
      .select('*')
      .order('severidad', { ascending: false, nullsFirst: false }))
      .then(({ data, error }) => {
        if (error) throw error
        setPacientes(data ?? [])
        setCacheFecha(null)
        guardarEnCache(CLAVE_CACHE, data ?? [])
      })
      .catch((e) => {
        // Sin conexión (o la petición nunca llegó al servidor): se
        // muestra la última lista que sí se pudo cargar en línea, en
        // vez de dejar la pantalla en blanco.
        const cache = leerDeCache(CLAVE_CACHE)
        if (cache && (navigator.onLine === false || esErrorDeRed(e))) {
          setPacientes(cache.datos)
          setCacheFecha(cache.guardadoEn)
        } else {
          setError(mensajeErrorRed(e, 'la lista de pacientes'))
          setPacientes([])
        }
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

  async function prepararParaBrigada() {
    if (!pacientes || pacientes.length === 0) return
    setPrecargando(true)
    setProgreso({ completados: 0, total: pacientes.length })
    await precargarPacientes(pacientes, (completados, total) =>
      setProgreso({ completados, total }),
    )
    setEstadoPrevio(estadoPrecarga())
    setPrecargando(false)
  }

  return (
    <div className="marco">
      <Barra
        volver="/panel"
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
        {cacheFecha && (
          <Aviso tipo="alerta">
            Sin conexión: mostrando la última lista guardada en este dispositivo
            ({fechaHoraCorta(cacheFecha)}). Puede no incluir cambios recientes.
          </Aviso>
        )}

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

        {pacientes !== null && pacientes.length > 0 && (
          <div className="tarjeta" style={{ marginBottom: '0.9rem' }}>
            <p className="eyebrow" style={{ marginBottom: '0.3rem' }}>
              Preparar para trabajo sin conexión
            </p>
            <p className="campo__ayuda" style={{ marginBottom: '0.6rem' }}>
              Descarga la ficha y el historial de cada paciente a este
              dispositivo, para poder consultar a cualquiera y registrarle una
              medición nueva sin señal — hazlo con conexión, antes de salir a
              una comunidad.
            </p>

            {estadoPrevio && (
              <p className="lista__meta" style={{ marginBottom: '0.6rem' }}>
                Última preparación: {estadoPrevio.datos.completados} de{' '}
                {estadoPrevio.datos.total} pacientes listos sin conexión
                {estadoPrevio.datos.interrumpido ? ' (se interrumpió por falta de señal)' : ''}
                {' · '}
                {fechaHoraCorta(estadoPrevio.guardadoEn)}
              </p>
            )}

            <button
              type="button"
              className="boton boton--secundario"
              onClick={prepararParaBrigada}
              disabled={precargando}
            >
              {precargando
                ? `Preparando… ${progreso.completados}/${progreso.total}`
                : `Preparar los ${pacientes.length} pacientes`}
            </button>
          </div>
        )}

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
