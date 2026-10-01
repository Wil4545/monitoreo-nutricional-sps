import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useSesion } from '../contexto/Sesion.jsx'
import { Aviso, Barra, BarraAccion, Campo, Segmentos } from '../componentes/Interfaz.jsx'
import { edadEnMeses } from '../lib/oms/zscore.js'
import { edadLegible, generarCodigo, hoyISO } from '../lib/formato.js'
import { conTiempoLimite, mensajeErrorRed } from '../lib/offline.js'

/** RF-01 — Registrar pacientes (Sección 4.2.1) */
export default function NuevoPaciente() {
  const navegar = useNavigate()
  const { perfil } = useSesion()

  const [comunidades, setComunidades] = useState([])
  const [f, setF] = useState({
    nombre: '', apellido: '', fecha_nacimiento: '', sexo: 'M',
    comunidad_id: '', tutor_nombre: '', tutor_telefono: '',
  })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    conTiempoLimite(supabase.from('comunidad').select('id, nombre').order('nombre'))
      .then(({ data, error }) => {
        if (error) throw error
        setComunidades(data ?? [])
        if (data?.length && !f.comunidad_id) {
          setF((v) => ({ ...v, comunidad_id: perfil?.comunidad_id ?? data[0].id }))
        }
      })
      .catch((e) => setError(mensajeErrorRed(e, 'el catálogo de comunidades')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil])

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))

  const edadMeses = f.fecha_nacimiento
    ? edadEnMeses(f.fecha_nacimiento, hoyISO())
    : null

  function validar() {
    const e = {}
    if (!f.nombre.trim()) e.nombre = 'Escribe el nombre del paciente.'
    if (!f.apellido.trim()) e.apellido = 'Escribe los apellidos.'
    if (!f.fecha_nacimiento) e.fecha_nacimiento = 'Selecciona la fecha de nacimiento.'
    else if (edadMeses < 0) e.fecha_nacimiento = 'La fecha no puede ser futura.'
    if (!f.comunidad_id) e.comunidad_id = 'Selecciona la comunidad de residencia.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function guardar(ev) {
    ev.preventDefault()
    setError('')
    if (!validar()) return
    setGuardando(true)

    try {
      const { count } = await conTiempoLimite(supabase
        .from('paciente')
        .select('id', { count: 'exact', head: true }))

      const { data, error } = await conTiempoLimite(supabase
        .from('paciente')
        .insert({
          codigo: generarCodigo((count ?? 0) + 1),
          nombre: f.nombre.trim(),
          apellido: f.apellido.trim(),
          fecha_nacimiento: f.fecha_nacimiento,
          sexo: f.sexo,
          comunidad_id: f.comunidad_id,
          tutor_nombre: f.tutor_nombre.trim() || null,
          tutor_telefono: f.tutor_telefono.trim() || null,
          creado_por: perfil?.id ?? null,
        })
        .select()
        .single())

      if (error) throw error
      navegar(`/pacientes/${data.id}/medicion?nuevo=1`, { replace: true })
    } catch (err) {
      // Registrar un paciente nuevo necesita generar su código
      // correlativo contra el total actual (RF-01) — a diferencia de una
      // medición (RF-11), esto no se admite sin conexión en este
      // alcance, así que se avisa en vez de encolarlo silenciosamente.
      setError(mensajeErrorRed(err, 'registrar un paciente nuevo'))
      setGuardando(false)
    }
  }

  return (
    <div className="marco">
      <Barra volver="/pacientes" sub="Nuevo registro" titulo="Datos del paciente" />

      <main className="contenido">
        <Aviso tipo="error">{error}</Aviso>

        <form id="form-paciente" onSubmit={guardar}>
          <div className="tarjeta">
            <div className="par">
              <Campo etiqueta="Nombres" id="nombre" error={errores.nombre}>
                <input id="nombre" value={f.nombre} onChange={set('nombre')}
                  autoComplete="off" aria-invalid={!!errores.nombre} />
              </Campo>
              <Campo etiqueta="Apellidos" id="apellido" error={errores.apellido}>
                <input id="apellido" value={f.apellido} onChange={set('apellido')}
                  autoComplete="off" aria-invalid={!!errores.apellido} />
              </Campo>
            </div>

            <Campo
              etiqueta="Fecha de nacimiento"
              id="fnac"
              error={errores.fecha_nacimiento}
              ayuda={
                edadMeses != null && edadMeses >= 0
                  ? edadMeses > 60
                    ? `${edadLegible(edadMeses)} — supera los 5 años; los patrones de la OMS del sistema llegan hasta los 60 meses.`
                    : `Edad hoy: ${edadLegible(edadMeses)}`
                  : 'Determina la edad exacta con la que se calculan los puntajes Z.'
              }
            >
              <input id="fnac" type="date" max={hoyISO()}
                value={f.fecha_nacimiento} onChange={set('fecha_nacimiento')}
                aria-invalid={!!errores.fecha_nacimiento} />
            </Campo>

            <Campo etiqueta="Sexo" id="sexo"
              ayuda="Los patrones de crecimiento de la OMS son distintos para niño y niña.">
              <Segmentos
                etiqueta="Sexo"
                valor={f.sexo}
                onChange={(v) => setF((s) => ({ ...s, sexo: v }))}
                opciones={[
                  { valor: 'M', texto: 'Niño' },
                  { valor: 'F', texto: 'Niña' },
                ]}
              />
            </Campo>

            <Campo etiqueta="Comunidad de residencia" id="comunidad" error={errores.comunidad_id}>
              <select id="comunidad" value={f.comunidad_id} onChange={set('comunidad_id')}
                aria-invalid={!!errores.comunidad_id}>
                <option value="">Selecciona una comunidad</option>
                {comunidades.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="tarjeta">
            <p className="eyebrow">Responsable del paciente</p>
            <Campo etiqueta="Nombre del tutor" id="tutor">
              <input id="tutor" value={f.tutor_nombre} onChange={set('tutor_nombre')} autoComplete="off" />
            </Campo>
            <Campo etiqueta="Teléfono de contacto" id="tel"
              ayuda="Opcional. Se usa para convocar a la cita de seguimiento.">
              <input id="tel" type="tel" inputMode="tel"
                value={f.tutor_telefono} onChange={set('tutor_telefono')} />
            </Campo>
          </div>
        </form>
      </main>

      <BarraAccion>
        <button type="button" className="boton boton--secundario" onClick={() => navegar(-1)}>
          Cancelar
        </button>
        <button form="form-paciente" className="boton boton--principal boton--ancho" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar y medir'}
        </button>
      </BarraAccion>
    </div>
  )
}
