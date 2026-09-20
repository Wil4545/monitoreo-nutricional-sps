import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useSesion } from '../contexto/Sesion.jsx'
import { guardarMedicion } from '../lib/registro.js'
import { encolarMedicionPendiente, esErrorDeRed } from '../lib/offline.js'
import { calcularIndicadores } from '../lib/oms/zscore.js'
import { clasificar } from '../lib/oms/clasificacion.js'
import { kgALibraOnza, libraOnzaAKg } from '../lib/peso.js'
import {
  Aviso, Barra, BarraAccion, Campo, Cargando, Insignia, Segmentos,
} from '../componentes/Interfaz.jsx'
import { edadLegible, formatoZ, hoyISO } from '../lib/formato.js'

/**
 * RF-02, RF-03 y RF-04 en una sola pantalla.
 *
 * La clasificación se calcula mientras se escribe, antes de guardar. Es
 * deliberado: en el proceso manual actual el personal mide, anota y se
 * entera de la clasificación semanas después (Sección 2.4.2). Aquí el
 * dictamen aparece con el niño todavía en la consulta, que es el momento
 * en que sirve para decidir algo.
 */
export default function NuevaMedicion() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const { perfil } = useSesion()

  const [paciente, setPaciente] = useState(null)
  const [f, setF] = useState({
    fecha_medicion: hoyISO(), peso_kg: '', peso_lb: '', peso_oz: '', talla_cm: '',
    medido_acostado: null, observaciones: '',
  })
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase
      .from('paciente')
      .select('id, codigo, nombre, apellido, sexo, fecha_nacimiento, comunidad(nombre)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setPaciente(data)
        // La posición de medición se propone según la edad: acostado
        // antes de los 24 meses, de pie después.
        if (data) {
          const meses =
            (new Date() - new Date(data.fecha_nacimiento)) / 86400000 / 30.4375
          setF((v) => ({ ...v, medido_acostado: meses < 24 }))
        }
      })
  }, [id])

  // Coordenadas del punto de atención. Insumo para el mapa de calor de la
  // segunda entrega (RF-06/RF-07); si el usuario no da permiso, el
  // registro clínico se guarda igual.
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setCoords(false),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [])

  const previa = useMemo(() => {
    if (!paciente || !f.peso_kg || !f.talla_cm) return null
    const peso = Number(f.peso_kg)
    const talla = Number(f.talla_cm)
    if (!Number.isFinite(peso) || !Number.isFinite(talla) || peso <= 0 || talla <= 0) return null

    const z = calcularIndicadores({
      sexo: paciente.sexo,
      fechaNacimiento: paciente.fecha_nacimiento,
      fechaMedicion: f.fecha_medicion,
      pesoKg: peso,
      tallaCm: talla,
      medidoAcostado: f.medido_acostado,
    })
    return { ...z, dictamen: clasificar(z) }
  }, [paciente, f])

  const fueraDeRangoFisiologico =
    (f.peso_kg && (Number(f.peso_kg) < 0.5 || Number(f.peso_kg) > 60)) ||
    (f.talla_cm && (Number(f.talla_cm) < 30 || Number(f.talla_cm) > 150))

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))

  /**
   * Peso en dos unidades para el mismo dato (a pedido de la
   * nutricionista: en Guatemala se pesa en libras y onzas, pero la OMS y
   * la base de datos usan kilogramos). Cada campo, al cambiar, recalcula
   * los otros dos — ver lib/peso.js para la conversión.
   */
  function cambiarPesoKg(e) {
    const valor = e.target.value
    const kg = Number(valor)
    const conv = valor === '' || !Number.isFinite(kg) ? { libras: '', onzas: '' } : kgALibraOnza(kg)
    setF((v) => ({ ...v, peso_kg: valor, peso_lb: conv.libras, peso_oz: conv.onzas }))
  }

  function cambiarPesoLibras(e) {
    const libras = e.target.value
    setF((v) => ({ ...v, peso_lb: libras, peso_kg: libraOnzaAKg(libras, v.peso_oz) }))
  }

  function cambiarPesoOnzas(e) {
    const onzas = e.target.value
    setF((v) => ({ ...v, peso_oz: onzas, peso_kg: libraOnzaAKg(v.peso_lb, onzas) }))
  }

  async function guardar(ev) {
    ev.preventDefault()
    setError('')
    if (!previa) { setError('Registra el peso y la talla para poder guardar.'); return }
    if (fueraDeRangoFisiologico) {
      setError('El peso o la talla están fuera del rango que acepta el sistema. Verifica la medición.')
      return
    }
    setGuardando(true)

    const payload = {
      paciente,
      medicion: {
        ...f,
        latitud: coords ? coords.lat : null,
        longitud: coords ? coords.lng : null,
      },
      usuarioId: perfil?.id,
    }

    // Sin conexión: ni se intenta la llamada de red (RF-11). El registro
    // se sincroniza solo más adelante (RF-12, ver lib/offline.js).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      encolarMedicionPendiente(payload)
      navegar(`/pacientes/${id}`, { replace: true, state: { sinConexion: true } })
      return
    }

    try {
      await guardarMedicion(payload)
      navegar(`/pacientes/${id}`, { replace: true })
    } catch (err) {
      if (esErrorDeRed(err)) {
        encolarMedicionPendiente(payload)
        navegar(`/pacientes/${id}`, { replace: true, state: { sinConexion: true } })
        return
      }
      setError(err.message ?? 'No se pudo guardar la medición.')
      setGuardando(false)
    }
  }

  if (!paciente) return <div className="marco"><Barra volver titulo="Nueva medición" /><Cargando /></div>

  return (
    <div className="marco">
      <Barra
        volver
        sub={paciente.codigo}
        titulo={`${paciente.nombre} ${paciente.apellido}`}
      />

      <main className="contenido">
        {params.get('nuevo') === '1' && (
          <Aviso tipo="info">
            Paciente registrado. Toma la primera medición para establecer su
            línea base.
          </Aviso>
        )}

        <Aviso tipo="error">{error}</Aviso>

        <form id="form-medicion" onSubmit={guardar}>
          <div className="tarjeta">
            <p className="eyebrow">Medición antropométrica</p>

            <Campo etiqueta="Fecha de la cita" id="fecha">
              <input id="fecha" type="date" max={hoyISO()}
                value={f.fecha_medicion} onChange={set('fecha_medicion')} />
            </Campo>

            <div className="par">
              <Campo etiqueta="Peso (kg)" id="peso" ayuda="O ingresa libras y onzas abajo — se convierte solo.">
                <input id="peso" inputMode="decimal" placeholder="0.00"
                  value={f.peso_kg} onChange={cambiarPesoKg}
                  aria-invalid={fueraDeRangoFisiologico || undefined} />
              </Campo>
              <Campo etiqueta="Talla (cm)" id="talla">
                <input id="talla" inputMode="decimal" placeholder="0.0"
                  value={f.talla_cm} onChange={set('talla_cm')}
                  aria-invalid={fueraDeRangoFisiologico || undefined} />
              </Campo>
            </div>

            <div className="par">
              <Campo etiqueta="… o libras" id="peso_lb">
                <input id="peso_lb" inputMode="decimal" placeholder="lb"
                  value={f.peso_lb} onChange={cambiarPesoLibras} />
              </Campo>
              <Campo etiqueta="… y onzas" id="peso_oz">
                <input id="peso_oz" inputMode="decimal" placeholder="oz"
                  value={f.peso_oz} onChange={cambiarPesoOnzas} />
              </Campo>
            </div>

            <Campo
              etiqueta="Posición de medición"
              id="posicion"
              ayuda="La OMS usa longitud acostado antes de los 24 meses y estatura de pie después. Registrar la posición real evita un sesgo de 0.7 cm."
            >
              <Segmentos
                etiqueta="Posición de medición"
                valor={f.medido_acostado}
                onChange={(v) => setF((s) => ({ ...s, medido_acostado: v }))}
                opciones={[
                  { valor: true, texto: 'Acostado' },
                  { valor: false, texto: 'De pie' },
                ]}
              />
            </Campo>

            <Campo etiqueta="Observaciones" id="obs">
              <textarea id="obs" rows="2" value={f.observaciones} onChange={set('observaciones')} />
            </Campo>
          </div>

          {previa && (
            <div className="tarjeta">
              <div className="tarjeta__encabezado">
                <h2>Clasificación</h2>
                <Insignia severidad={previa.dictamen.severidad} />
              </div>

              <p className="eyebrow">
                Edad a la fecha de la cita: {edadLegible(previa.edadMeses)}
              </p>

              <div className="rejilla-datos">
                <Dato etiqueta="Talla / edad" z={previa.zTallaEdad} d={previa.dictamen.tallaEdad} />
                <Dato etiqueta="Peso / talla" z={previa.zPesoTalla} d={previa.dictamen.pesoTalla} />
                <Dato etiqueta="Peso / edad" z={previa.zPesoEdad} d={previa.dictamen.pesoEdad} />
              </div>

              {previa.fueraDeRango.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <Aviso tipo="alerta">
                    Sin referencia de la OMS para {previa.fueraDeRango.join(', ')}.
                    La medición queda fuera de las tablas de 0 a 60 meses.
                  </Aviso>
                </div>
              )}

              {previa.dictamen.severidad === 3 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <Aviso tipo="error">
                    Caso severo. Requiere referencia inmediata según el protocolo
                    del centro de salud.
                  </Aviso>
                </div>
              )}
            </div>
          )}

          <p className="campo__ayuda">
            {coords
              ? `Ubicación del punto de atención capturada (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}).`
              : coords === false
                ? 'Sin acceso a la ubicación. La medición se guarda igual, sin coordenadas.'
                : 'Obteniendo la ubicación del punto de atención…'}
          </p>
        </form>
      </main>

      <BarraAccion>
        <button type="button" className="boton boton--secundario" onClick={() => navegar(-1)}>
          Cancelar
        </button>
        <button form="form-medicion" className="boton boton--principal boton--ancho"
          disabled={guardando || !previa}>
          {guardando ? 'Guardando…' : 'Guardar medición'}
        </button>
      </BarraAccion>
    </div>
  )
}

function Dato({ etiqueta, z, d }) {
  return (
    <div className="dato">
      <div className="dato__etiqueta">{etiqueta}</div>
      <div className={`dato__valor dato__valor--${d.severidad}`}>{formatoZ(z)}</div>
      <div className="dato__pie">{d.etiqueta}</div>
    </div>
  )
}
