import { useEffect, useMemo, useState } from 'react'
import { useSesion } from '../contexto/Sesion.jsx'
import { todasLasMediciones, registrarReporte } from '../lib/registro.js'
import { Aviso, Barra, Cargando, Insignia } from '../componentes/Interfaz.jsx'
import { fechaCorta } from '../lib/formato.js'
import { mensajeErrorRed } from '../lib/offline.js'

/**
 * Reportes de control — RF-09 (Sección 4.2.1, 4.3.2).
 *
 * Dos reportes, los dos de mayor valor gerencial según tu propio
 * documento: brecha nutricional por comunidad (para priorizar rutas de
 * brigadas) y tiempo de respuesta ante casos críticos — que es
 * exactamente el indicador con el que tu hipótesis promete una
 * reducción del 50% (Sección 1.2.1). Sin este reporte no había forma de
 * medir esa meta.
 *
 * Cada vista genera una fila en la tabla `reporte` (RF-09 lo pide
 * implícitamente al modelar esa entidad en la Figura 5) — es una
 * bitácora de qué se consultó y cuándo, no el reporte en sí.
 */
export default function Reportes() {
  const { perfil } = useSesion()
  const [mediciones, setMediciones] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    todasLasMediciones()
      .then((datos) => {
        setMediciones(datos)
        registrarReporte('brecha_y_tiempos_respuesta', {}, perfil?.id)
      })
      .catch((e) => { setError(mensajeErrorRed(e, 'los reportes')); setMediciones([]) })
  }, [perfil])

  const porComunidad = useMemo(() => {
    if (!mediciones) return []
    const grupos = {}
    for (const m of mediciones) {
      grupos[m.comunidad] ??= { comunidad: m.comunidad, pacientes: new Set(), alterados: new Set(), severos: new Set() }
      grupos[m.comunidad].pacientes.add(m.pacienteId)
      if (m.severidad > 0) grupos[m.comunidad].alterados.add(m.pacienteId)
      if (m.severidad === 3) grupos[m.comunidad].severos.add(m.pacienteId)
    }
    return Object.values(grupos)
      .map((g) => ({
        comunidad: g.comunidad,
        pacientes: g.pacientes.size,
        alterados: g.alterados.size,
        severos: g.severos.size,
        porcentaje: g.pacientes.size ? Math.round((g.alterados.size / g.pacientes.size) * 100) : 0,
      }))
      .sort((a, b) => b.porcentaje - a.porcentaje)
  }, [mediciones])

  // Tiempo de respuesta: por cada paciente, desde su primera medición
  // severa (3) hasta la siguiente cita registrada — la "visita de
  // seguimiento" que describe la Sección 4.3.2.
  const tiemposRespuesta = useMemo(() => {
    if (!mediciones) return { resueltos: [], pendientes: [] }
    const porPaciente = {}
    for (const m of mediciones) {
      porPaciente[m.pacienteId] ??= { nombre: m.paciente, comunidad: m.comunidad, citas: [] }
      porPaciente[m.pacienteId].citas.push(m)
    }

    const resueltos = []
    const pendientes = []
    for (const p of Object.values(porPaciente)) {
      const citas = p.citas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      const iSevero = citas.findIndex((c) => c.severidad === 3)
      if (iSevero === -1) continue
      const casoSevero = citas[iSevero]
      const seguimiento = citas[iSevero + 1]
      if (seguimiento) {
        const dias = Math.round((new Date(seguimiento.fecha) - new Date(casoSevero.fecha)) / 86400000)
        resueltos.push({ nombre: p.nombre, comunidad: p.comunidad, fechaCaso: casoSevero.fecha, dias })
      } else {
        const diasEspera = Math.round((new Date() - new Date(casoSevero.fecha)) / 86400000)
        pendientes.push({ nombre: p.nombre, comunidad: p.comunidad, fechaCaso: casoSevero.fecha, diasEspera })
      }
    }
    return { resueltos, pendientes: pendientes.sort((a, b) => b.diasEspera - a.diasEspera) }
  }, [mediciones])

  const promedioDias = tiemposRespuesta.resueltos.length
    ? Math.round(tiemposRespuesta.resueltos.reduce((a, r) => a + r.dias, 0) / tiemposRespuesta.resueltos.length)
    : null

  return (
    <div className="marco">
      <Barra volver="/panel" sub="Reportes de control" titulo="Brecha y tiempos de respuesta" />

      <main className="contenido">
        <Aviso tipo="error">{error}</Aviso>

        {mediciones === null ? (
          <Cargando>Generando reportes…</Cargando>
        ) : mediciones.length === 0 ? (
          <div className="vacio"><p>Todavía no hay mediciones registradas para generar reportes.</p></div>
        ) : (
          <>
            <div className="tarjeta">
              <p className="eyebrow">Brecha nutricional por comunidad</p>
              <ul className="lista">
                {porComunidad.map((g) => (
                  <li key={g.comunidad} className="lista__fila" style={{ cursor: 'default' }}>
                    <div className="lista__cuerpo">
                      <div className="lista__nombre">{g.comunidad}</div>
                      <div className="lista__meta">
                        {g.alterados} de {g.pacientes} pacientes con alguna alteración
                        {g.severos > 0 && ` · ${g.severos} ${g.severos === 1 ? 'severo' : 'severos'}`}
                      </div>
                    </div>
                    <span className={`insignia insignia--${g.porcentaje >= 50 ? 3 : g.porcentaje >= 25 ? 2 : g.porcentaje > 0 ? 1 : 0}`}>
                      {g.porcentaje}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="tarjeta">
              <div className="tarjeta__encabezado">
                <p className="eyebrow" style={{ margin: 0 }}>Tiempo de respuesta ante casos severos</p>
                {promedioDias != null && <span className="lista__meta">Promedio: {promedioDias} días</span>}
              </div>

              {tiemposRespuesta.pendientes.length > 0 && (
                <>
                  <p className="campo__ayuda" style={{ margin: '0.5rem 0' }}>
                    Sin visita de seguimiento registrada todavía:
                  </p>
                  <ul className="lista">
                    {tiemposRespuesta.pendientes.map((c, i) => (
                      <li key={i} className="lista__fila" style={{ cursor: 'default' }}>
                        <div className="lista__cuerpo">
                          <div className="lista__nombre">{c.nombre}</div>
                          <div className="lista__meta">{c.comunidad} · caso detectado {fechaCorta(c.fechaCaso)}</div>
                        </div>
                        <Insignia severidad={3}>{c.diasEspera} días esperando</Insignia>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {tiemposRespuesta.resueltos.length > 0 && (
                <>
                  <p className="campo__ayuda" style={{ margin: '0.5rem 0' }}>
                    Con seguimiento ya registrado:
                  </p>
                  <ul className="lista">
                    {tiemposRespuesta.resueltos.map((c, i) => (
                      <li key={i} className="lista__fila" style={{ cursor: 'default' }}>
                        <div className="lista__cuerpo">
                          <div className="lista__nombre">{c.nombre}</div>
                          <div className="lista__meta">{c.comunidad} · caso detectado {fechaCorta(c.fechaCaso)}</div>
                        </div>
                        <span className="insignia insignia--0">{c.dias} días</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {tiemposRespuesta.pendientes.length === 0 && tiemposRespuesta.resueltos.length === 0 && (
                <p className="campo__ayuda">Sin casos de severidad 3 registrados todavía.</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
