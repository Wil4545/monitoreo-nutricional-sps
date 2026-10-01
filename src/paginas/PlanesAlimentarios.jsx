import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useSesion } from '../contexto/Sesion.jsx'
import { asignarPlan, finalizarPlan, planesDePaciente } from '../lib/registro.js'
import { clasificar } from '../lib/oms/clasificacion.js'
import {
  MACRONUTRIENTES, etiquetasDeMacros, generarSugerencia, sugerirMacronutrientes,
} from '../lib/nutricion.js'
import { descargarPlanPdf } from '../lib/pdfPlan.js'
import {
  Aviso, Barra, BarraAccion, Campo, Cargando, SelectorMultiple,
} from '../componentes/Interfaz.jsx'
import { fechaCorta, hoyISO } from '../lib/formato.js'
import { conTiempoLimite, mensajeErrorRed } from '../lib/offline.js'

/**
 * RF-10 — planes alimentarios generados a partir de las necesidades
 * nutricionales del paciente.
 *
 * Flujo: la nutricionista marca los macronutrientes a reforzar (por
 * defecto, los que sugiere la clasificación vigente del paciente — RF-04),
 * genera una propuesta de alimentos y un menú-guía de 5 tiempos con
 * `lib/nutricion.js`, la ajusta si hace falta en "Indicaciones", y
 * guarda. El menú generado queda fijo en el plan (`menu_sugerido`) y
 * cada plan se puede descargar como PDF para el tutor (`lib/pdfPlan.js`).
 *
 * La tabla `plan_alimentario` existe desde el primer avance
 * (01_schema.sql); `macronutrientes` y `menu_sugerido` se agregaron en
 * 10_plan_alimentario_estructura.sql para soportar este generador.
 *
 * "Finalizar" no borra el plan — pone `fecha_fin = hoy` y lo deja en el
 * historial, igual que un plan cerrado en papel no se tacha, se archiva.
 */
export default function PlanesAlimentarios() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { perfil } = useSesion()

  const [paciente, setPaciente] = useState(null)
  const [planes, setPlanes] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)

  const [macros, setMacros] = useState([])
  const [sugerencia, setSugerencia] = useState(null)
  const [f, setF] = useState({
    nombre: '', descripcion: '', costo_diario: '',
    fecha_inicio: hoyISO(), fecha_fin: '',
  })

  useEffect(() => {
    conTiempoLimite(supabase
      .from('paciente')
      .select('id, codigo, nombre, apellido, comunidad(nombre)')
      .eq('id', id)
      .single())
      .then(({ data, error }) => {
        if (error) throw error
        setPaciente(data)
      })
      .catch((e) => {
        // Esta pantalla no tiene copia en caché propia — sin conexión
        // no hay nada que mostrar, así que se marca con `false` (no con
        // null) para salir del estado "Cargando…" y mostrar el aviso.
        setError(mensajeErrorRed(e, 'los planes alimentarios'))
        setPaciente(false)
      })

    // Clasificación vigente, para proponer macronutrientes por defecto
    // (RF-04 → RF-10). Si el paciente aún no tiene mediciones, la vista
    // devuelve los campos en null y simplemente no se sugiere nada. Es
    // un apoyo opcional: si falla (por ejemplo, sin conexión), el
    // formulario sigue funcionando, solo sin sugerencia preseleccionada.
    supabase
      .from('v_paciente_estado')
      .select('z_peso_edad, z_talla_edad, z_peso_talla')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const dictamen = clasificar({
          zPesoEdad: data.z_peso_edad, zTallaEdad: data.z_talla_edad, zPesoTalla: data.z_peso_talla,
        })
        setMacros(sugerirMacronutrientes(dictamen))
      })
      .catch(() => {})

    cargarPlanes()
  }, [id])

  function cargarPlanes() {
    planesDePaciente(id)
      .then(setPlanes)
      .catch((e) => { setError(mensajeErrorRed(e, 'los planes alimentarios')); setPlanes([]) })
  }

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))

  function generar() {
    if (macros.length === 0) {
      setError('Marca al menos un macronutriente para generar la sugerencia.')
      return
    }
    setError('')
    const s = generarSugerencia(macros)
    setSugerencia(s)
    if (!f.nombre.trim()) {
      setF((v) => ({ ...v, nombre: `Refuerzo de ${etiquetasDeMacros(macros).join(', ')}` }))
    }
  }

  async function guardar(ev) {
    ev.preventDefault()
    setError('')
    if (!f.nombre.trim()) { setError('Ponle un nombre al plan (por ejemplo, "Refuerzo proteico").'); return }
    setGuardando(true)
    try {
      await asignarPlan({
        pacienteId: id,
        plan: { ...f, macronutrientes: macros, sugerencia },
        usuarioId: perfil?.id,
      })
      setF({ nombre: '', descripcion: '', costo_diario: '', fecha_inicio: hoyISO(), fecha_fin: '' })
      setSugerencia(null)
      setMostrarForm(false)
      cargarPlanes()
    } catch (err) {
      setError(mensajeErrorRed(err, 'guardar un plan alimentario'))
    } finally {
      setGuardando(false)
    }
  }

  async function finalizar(planId) {
    try {
      await finalizarPlan(planId)
      cargarPlanes()
    } catch (err) {
      setError(mensajeErrorRed(err, 'finalizar el plan'))
    }
  }

  function descargar(plan) {
    descargarPlanPdf({
      paciente,
      plan: { ...plan, macronutrientes_etiquetas: etiquetasDeMacros(plan.macronutrientes ?? []) },
    })
  }

  if (paciente === null || planes === null) {
    return (
      <div className="marco">
        <Barra volver={`/pacientes/${id}`} titulo="Planes alimentarios" />
        <Cargando />
      </div>
    )
  }

  if (!paciente) {
    return (
      <div className="marco">
        <Barra volver={`/pacientes/${id}`} titulo="Planes alimentarios" />
        <main className="contenido">
          <Aviso tipo="alerta">{error}</Aviso>
        </main>
      </div>
    )
  }

  const vigentes = planes.filter((p) => !p.fecha_fin || p.fecha_fin >= hoyISO())
  const finalizados = planes.filter((p) => p.fecha_fin && p.fecha_fin < hoyISO())

  return (
    <div className="marco">
      <Barra
        volver={`/pacientes/${id}`}
        sub={paciente.codigo}
        titulo={`${paciente.nombre} ${paciente.apellido}`}
      />

      <main className="contenido">
        <Aviso tipo="error">{error}</Aviso>

        {!mostrarForm && (
          <div className="tarjeta">
            <div className="tarjeta__encabezado">
              <h2>Planes alimentarios</h2>
              <button type="button" className="boton boton--principal" onClick={() => setMostrarForm(true)}>
                Asignar plan
              </button>
            </div>
            <p className="lista__meta">
              {planes.length === 0
                ? 'Este paciente aún no tiene un plan alimentario asignado.'
                : `${vigentes.length} ${vigentes.length === 1 ? 'vigente' : 'vigentes'} · ${finalizados.length} en el historial.`}
            </p>
          </div>
        )}

        {mostrarForm && (
          <form id="form-plan" onSubmit={guardar}>
            <div className="tarjeta">
              <p className="eyebrow">Generar plan a partir de necesidades</p>

              <Campo
                etiqueta="Macronutrientes a reforzar"
                id="macros"
                ayuda="Preseleccionados según la última clasificación del paciente (RF-04). Ajusta si hace falta."
              >
                <SelectorMultiple
                  etiqueta="Macronutrientes a reforzar"
                  valor={macros}
                  onChange={(v) => { setMacros(v); setSugerencia(null) }}
                  opciones={MACRONUTRIENTES.map((m) => ({ valor: m.id, texto: m.etiqueta }))}
                />
              </Campo>

              <button type="button" className="boton boton--secundario" onClick={generar}>
                Generar sugerencia
              </button>
            </div>

            {sugerencia && (
              <div className="tarjeta">
                <p className="eyebrow">Alimentos sugeridos</p>
                <ul className="lista">
                  {sugerencia.alimentosPorMacro.map((g) => (
                    <li key={g.macro} className="lista__fila" style={{ cursor: 'default' }}>
                      <div className="lista__cuerpo">
                        <div className="lista__nombre">{g.macro}</div>
                        <div className="lista__meta">{g.alimentos.join(', ')}</div>
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="eyebrow" style={{ marginTop: '1rem' }}>Menú-guía (5 tiempos)</p>
                <ul className="lista">
                  {sugerencia.menu.map((item, i) => (
                    <li key={i} className="lista__fila" style={{ cursor: 'default' }}>
                      <div className="lista__cuerpo">
                        <div className="lista__nombre">{item.comida}</div>
                        <div className="lista__meta">{item.alimento}{item.macro ? ` · ${item.macro}` : ''}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="campo__ayuda" style={{ marginTop: '0.5rem' }}>
                  Es una guía orientativa con opciones accesibles en la zona, no un menú clínico exhaustivo.
                </p>
              </div>
            )}

            <div className="tarjeta">
              <p className="eyebrow">Datos del plan</p>

              <Campo etiqueta="Nombre del plan" id="nombre" ayuda="Se propone al generar la sugerencia; puedes cambiarlo.">
                <input id="nombre" value={f.nombre} onChange={set('nombre')} />
              </Campo>

              <Campo etiqueta="Indicaciones adicionales" id="descripcion" ayuda="Opcional — ajustes, alergias, cantidades específicas.">
                <textarea id="descripcion" rows="3" value={f.descripcion} onChange={set('descripcion')} />
              </Campo>

              <div className="par">
                <Campo etiqueta="Costo diario estimado (Q)" id="costo" ayuda="Opcional.">
                  <input id="costo" inputMode="decimal" placeholder="0.00"
                    value={f.costo_diario} onChange={set('costo_diario')} />
                </Campo>
                <Campo etiqueta="Fecha de inicio" id="inicio">
                  <input id="inicio" type="date" max={hoyISO()}
                    value={f.fecha_inicio} onChange={set('fecha_inicio')} />
                </Campo>
              </div>

              <Campo etiqueta="Fecha de fin (si ya se conoce)" id="fin" ayuda="Déjalo vacío si el plan sigue abierto.">
                <input id="fin" type="date" value={f.fecha_fin} onChange={set('fecha_fin')} />
              </Campo>
            </div>

            <BarraAccion>
              <button type="button" className="boton boton--secundario"
                onClick={() => { setMostrarForm(false); setSugerencia(null) }}>
                Cancelar
              </button>
              <button form="form-plan" className="boton boton--principal boton--ancho" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar plan'}
              </button>
            </BarraAccion>
          </form>
        )}

        {vigentes.length > 0 && (
          <div className="tarjeta">
            <p className="eyebrow">Vigentes</p>
            <ul className="lista">
              {vigentes.map((p) => (
                <li key={p.id} className="lista__fila" style={{ cursor: 'default' }}>
                  <div className="lista__cuerpo">
                    <div className="lista__nombre">{p.nombre}</div>
                    <div className="lista__meta">
                      Desde {fechaCorta(p.fecha_inicio)}
                      {p.fecha_fin ? ` · hasta ${fechaCorta(p.fecha_fin)}` : ''}
                      {p.costo_diario ? ` · Q${Number(p.costo_diario).toFixed(2)}/día` : ''}
                    </div>
                    {p.macronutrientes?.length > 0 && (
                      <div className="lista__meta">{etiquetasDeMacros(p.macronutrientes).join(' · ')}</div>
                    )}
                    {p.descripcion && <div className="lista__meta">{p.descripcion}</div>}
                    {p.usuario?.nombre && <div className="lista__meta">Asignado por {p.usuario.nombre}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="boton boton--secundario" onClick={() => descargar(p)}>
                      PDF
                    </button>
                    <button type="button" className="boton boton--secundario" onClick={() => finalizar(p.id)}>
                      Finalizar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {finalizados.length > 0 && (
          <div className="tarjeta">
            <p className="eyebrow">Historial</p>
            <ul className="lista">
              {finalizados.map((p) => (
                <li key={p.id} className="lista__fila" style={{ cursor: 'default' }}>
                  <div className="lista__cuerpo">
                    <div className="lista__nombre">{p.nombre}</div>
                    <div className="lista__meta">
                      {fechaCorta(p.fecha_inicio)} – {fechaCorta(p.fecha_fin)}
                      {p.costo_diario ? ` · Q${Number(p.costo_diario).toFixed(2)}/día` : ''}
                    </div>
                  </div>
                  <button type="button" className="boton boton--secundario" onClick={() => descargar(p)}>
                    PDF
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
