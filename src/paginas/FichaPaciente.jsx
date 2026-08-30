import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { historial } from '../lib/registro.js'
import GraficoTrayectoria from '../componentes/GraficoTrayectoria.jsx'
import { Aviso, Barra, BarraAccion, Cargando, Insignia } from '../componentes/Interfaz.jsx'
import { edadEnMeses } from '../lib/oms/zscore.js'
import { edadLegible, fechaCorta, formatoZ, hoyISO } from '../lib/formato.js'

/**
 * Ficha de seguimiento individual — reporte operativo de la Sección 4.3.1.
 * Es la versión digital de la ficha que hoy se llena a mano en el centro
 * de salud, y reúne los datos generales, la clasificación vigente y la
 * trayectoria histórica en una sola vista.
 */
export default function FichaPaciente() {
  const { id } = useParams()
  const [paciente, setPaciente] = useState(null)
  const [mediciones, setMediciones] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('paciente')
      .select('*, comunidad(nombre, sector)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setPaciente(data)
      })

    historial(id)
      .then(setMediciones)
      .catch((e) => { setError(e.message); setMediciones([]) })
  }, [id])

  if (!paciente || mediciones === null) {
    return (
      <div className="marco">
        <Barra volver titulo="Ficha del paciente" />
        <Cargando />
      </div>
    )
  }

  const ultima = mediciones.length ? mediciones[mediciones.length - 1] : null
  const edadHoy = edadEnMeses(paciente.fecha_nacimiento, hoyISO())

  return (
    <div className="marco">
      <Barra
        volver
        sub={paciente.codigo}
        titulo={`${paciente.nombre} ${paciente.apellido}`}
      />

      <main className="contenido">
        <Aviso tipo="error">{error}</Aviso>

        {/* Datos generales */}
        <div className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <p className="eyebrow" style={{ marginBottom: '0.15rem' }}>
                {paciente.sexo === 'M' ? 'Niño' : 'Niña'} · {edadLegible(edadHoy)}
              </p>
              <h2>{paciente.comunidad?.nombre ?? 'Sin comunidad'}</h2>
            </div>
            {ultima && <Insignia severidad={ultima.severidad ?? 0} />}
          </div>

          <div className="lista__meta">
            Nacimiento {fechaCorta(paciente.fecha_nacimiento)}
            {paciente.tutor_nombre ? ` · Tutor: ${paciente.tutor_nombre}` : ''}
            {paciente.tutor_telefono ? ` · ${paciente.tutor_telefono}` : ''}
          </div>
        </div>

        {/* Clasificación vigente */}
        {ultima ? (
          <div className="tarjeta">
            <div className="tarjeta__encabezado">
              <h2>Clasificación vigente</h2>
              <span className="lista__meta">{fechaCorta(ultima.fecha_medicion)}</span>
            </div>

            <div className="rejilla-datos">
              <div className="dato">
                <div className="dato__etiqueta">Talla / edad</div>
                <div className="dato__valor">{formatoZ(ultima.z_talla_edad)}</div>
                <div className="dato__pie">Crónica</div>
              </div>
              <div className="dato">
                <div className="dato__etiqueta">Peso / talla</div>
                <div className="dato__valor">{formatoZ(ultima.z_peso_talla)}</div>
                <div className="dato__pie">Aguda</div>
              </div>
              <div className="dato">
                <div className="dato__etiqueta">Peso / edad</div>
                <div className="dato__valor">{formatoZ(ultima.z_peso_edad)}</div>
                <div className="dato__pie">Bajo peso</div>
              </div>
            </div>

            <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem' }}>
              {ultima.clasificacion}
            </p>
            <p className="lista__meta" style={{ marginTop: '0.35rem' }}>
              {ultima.peso_kg} kg · {ultima.talla_cm} cm ·{' '}
              {ultima.medido_acostado ? 'medido acostado' : 'medido de pie'}
            </p>
          </div>
        ) : (
          <div className="tarjeta">
            <div className="vacio" style={{ padding: '1.5rem 0.5rem' }}>
              <p>Este paciente aún no tiene mediciones.</p>
              <Link className="boton boton--principal" to={`/pacientes/${id}/medicion`}>
                Tomar la primera medición
              </Link>
            </div>
          </div>
        )}

        {/* Trayectoria — RF-05 */}
        {mediciones.length > 0 && (
          <div className="tarjeta">
            <div className="tarjeta__encabezado">
              <h2>Trayectoria</h2>
              <span className="lista__meta">
                {mediciones.length} {mediciones.length === 1 ? 'cita' : 'citas'}
              </span>
            </div>
            <GraficoTrayectoria mediciones={mediciones} />
          </div>
        )}

        {/* Historial tabular */}
        {mediciones.length > 0 && (
          <div className="tarjeta">
            <p className="eyebrow">Historial de citas</p>
            <ul className="lista">
              {[...mediciones].reverse().map((m) => (
                <li key={m.id} className="lista__fila" style={{ cursor: 'default' }}>
                  <div className="lista__cuerpo">
                    <div className="lista__nombre">{fechaCorta(m.fecha_medicion)}</div>
                    <div className="lista__meta">
                      {m.peso_kg} kg · {m.talla_cm} cm · {edadLegible(m.edad_meses)}
                    </div>
                    <div className="lista__meta">
                      T/E {formatoZ(m.z_talla_edad)} · P/T {formatoZ(m.z_peso_talla)} ·
                      P/E {formatoZ(m.z_peso_edad)}
                    </div>
                  </div>
                  <Insignia severidad={m.severidad ?? 0} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      <BarraAccion>
        <Link className="boton boton--principal boton--ancho" to={`/pacientes/${id}/medicion`}>
          Registrar nueva medición
        </Link>
      </BarraAccion>
    </div>
  )
}
