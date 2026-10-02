import { useEffect, useMemo, useState } from 'react'
import { useSesion } from '../contexto/Sesion.jsx'
import {
  todasLasMediciones, registrarReporte,
  totalPacientesRegistrados, guardarIndicadorDigitalizacion, historialDigitalizacion,
} from '../lib/registro.js'
import { Aviso, Barra, Cargando, Insignia, Campo } from '../componentes/Interfaz.jsx'
import { fechaCorta, fechaHoraCorta } from '../lib/formato.js'
import { mensajeErrorRed } from '../lib/offline.js'

const META_DIGITALIZACION = 70 // meta a 6 meses, Sección 1.2.3

/**
 * Reportes de control — RF-09 (Sección 4.2.1, 4.3.2).
 *
 * Cuatro reportes, los cuatro que describe la Sección 4.3.2:
 * - Brecha nutricional por comunidad (priorizar rutas de brigadas).
 * - Tiempo de respuesta ante casos severos — el indicador con el que tu
 *   hipótesis promete una reducción del 50% (Sección 1.2.1).
 * - Registros digitalizados — avance hacia la meta de 70% (Sección 1.2.3).
 * - Sala situacional digital: se implementó dentro de Mapa.jsx (no aquí),
 *   porque es justamente mapa de calor + indicadores agregados en tiempo
 *   real — lo que esa pantalla ya hace. Duplicarla en una página aparte
 *   solo habría significado mantener la misma consulta dos veces.
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

  // --- Registros digitalizados (RF-09, Sección 4.3.2) ---
  const [totalRegistrados, setTotalRegistrados] = useState(null)
  const [historialDig, setHistorialDig] = useState(null)
  const [totalAtendidos, setTotalAtendidos] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [guardandoDig, setGuardandoDig] = useState(false)
  const [errorDig, setErrorDig] = useState('')
  const [avisoDig, setAvisoDig] = useState('')

  useEffect(() => {
    totalPacientesRegistrados()
      .then(setTotalRegistrados)
      .catch((e) => setErrorDig(mensajeErrorRed(e, 'el total de pacientes')))
    historialDigitalizacion()
      .then(setHistorialDig)
      .catch((e) => setErrorDig(mensajeErrorRed(e, 'el histórico de digitalización')))
  }, [])

  async function guardarDigitalizacion(ev) {
    ev.preventDefault()
    const n = Number(totalAtendidos)
    if (!periodo.trim()) { setErrorDig('Indica a qué periodo corresponde (por ejemplo, "Agosto 2026").'); return }
    if (!n || n <= 0) { setErrorDig('Ingresa el total de pacientes atendidos en ese periodo, según el SIGSA-2 físico.'); return }
    setGuardandoDig(true)
    setErrorDig('')
    setAvisoDig('')
    try {
      await guardarIndicadorDigitalizacion(
        { periodo: periodo.trim(), totalAtendidos: n, registrados: totalRegistrados ?? 0 },
        perfil?.id,
      )
      setHistorialDig(await historialDigitalizacion())
      setAvisoDig('Medición guardada en la bitácora de reportes.')
      setPeriodo('')
      setTotalAtendidos('')
    } catch (e) {
      setErrorDig(mensajeErrorRed(e, 'guardar el indicador de digitalización'))
    } finally {
      setGuardandoDig(false)
    }
  }

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

        <div className="tarjeta">
          <p className="eyebrow">Registros digitalizados</p>
          <p className="campo__ayuda" style={{ marginTop: '0.25rem' }}>
            Compara cuántos pacientes quedaron en el sistema contra el total
            atendido en el centro de salud en el mismo periodo (SIGSA-2 en
            papel). El sistema no conoce ese segundo número — se ingresa a
            mano cada vez que se quiera medir el avance. Meta: {META_DIGITALIZACION}%
            en los primeros seis meses de operación (línea base 0%).
          </p>

          <Aviso tipo="error">{errorDig}</Aviso>
          <Aviso tipo="exito">{avisoDig}</Aviso>

          <div className="metricas" style={{ margin: '0.75rem 0' }}>
            <div className="metrica">
              <div className="metrica__valor">
                {totalRegistrados == null ? '…' : totalRegistrados}
              </div>
              <div className="metrica__etiqueta">Pacientes en el sistema (ahora)</div>
            </div>
          </div>

          <form onSubmit={guardarDigitalizacion}>
            <div className="par">
              <Campo etiqueta="Periodo" id="periodo-dig" ayuda='Por ejemplo, "Agosto 2026".'>
                <input id="periodo-dig" value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)} autoComplete="off" />
              </Campo>
              <Campo etiqueta="Total atendidos en ese periodo (SIGSA-2)" id="atendidos-dig">
                <input id="atendidos-dig" type="number" min="1" inputMode="numeric"
                  value={totalAtendidos} onChange={(e) => setTotalAtendidos(e.target.value)} />
              </Campo>
            </div>
            <button className="boton boton--secundario" disabled={guardandoDig}>
              {guardandoDig ? 'Guardando…' : 'Guardar medición del periodo'}
            </button>
          </form>

          {historialDig === null ? (
            <Cargando>Cargando histórico…</Cargando>
          ) : historialDig.length > 0 && (
            <ul className="lista" style={{ marginTop: '0.75rem' }}>
              {historialDig.map((h) => (
                <li key={h.id} className="lista__fila" style={{ cursor: 'default' }}>
                  <div className="lista__cuerpo">
                    <div className="lista__nombre">{h.periodo}</div>
                    <div className="lista__meta">
                      {h.registrados} de {h.total_atendidos} atendidos
                      {h.generadoPor && ` · registrado por ${h.generadoPor}`}
                      {' · '}{fechaHoraCorta(h.generadoEn)}
                    </div>
                  </div>
                  <span className={`insignia insignia--${h.porcentaje >= META_DIGITALIZACION ? 0 : h.porcentaje >= META_DIGITALIZACION / 2 ? 1 : 2}`}>
                    {h.porcentaje}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
