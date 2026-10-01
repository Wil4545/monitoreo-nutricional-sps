import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useSesion } from '../contexto/Sesion.jsx'
import { Aviso, Barra, Cargando } from '../componentes/Interfaz.jsx'
import { ETIQUETA_SEVERIDAD } from '../lib/oms/clasificacion.js'
import { esErrorDeRed, guardarEnCache, leerDeCache, mensajeErrorRed } from '../lib/offline.js'
import { fechaHoraCorta } from '../lib/formato.js'

const CLAVE_CACHE = 'panel'

const COLOR_SEVERIDAD = {
  0: 'var(--sev-0)', 1: 'var(--sev-1)', 2: 'var(--sev-2)', 3: 'var(--sev-3)',
}

/**
 * Panel resumen del distrito.
 *
 * Es la pantalla de entrada tras iniciar sesión. Responde la pregunta que
 * normalmente exige revisar cuadernillos uno por uno (Sección 2.4.2):
 * ¿cuántos pacientes hay, cuántos tienen algo alterado ahora mismo, y en
 * qué comunidades se concentran? Las cifras se calculan en el navegador
 * a partir de `v_paciente_estado`, que ya trae la clasificación vigente
 * de cada paciente — no hay una tabla de agregados separada que
 * mantener sincronizada.
 */
export default function Panel() {
  const { perfil, salir } = useSesion()
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState('')
  const [cacheFecha, setCacheFecha] = useState(null)

  useEffect(() => {
    supabase
      .from('v_paciente_estado')
      .select('*')
      .then(({ data, error }) => {
        if (error) throw error
        setFilas(data ?? [])
        setCacheFecha(null)
        guardarEnCache(CLAVE_CACHE, data ?? [])
      })
      .catch((e) => {
        const cache = leerDeCache(CLAVE_CACHE)
        if (cache && (navigator.onLine === false || esErrorDeRed(e))) {
          setFilas(cache.datos)
          setCacheFecha(cache.guardadoEn)
        } else {
          setError(mensajeErrorRed(e, 'el panel'))
          setFilas([])
        }
      })
  }, [])

  const stats = useMemo(() => {
    if (!filas) return null
    const total = filas.length
    const medidos = filas.filter((f) => f.fecha_medicion)
    const porSeveridad = [0, 1, 2, 3].map(
      (s) => medidos.filter((f) => (f.severidad ?? 0) === s).length,
    )
    const alterados = porSeveridad[1] + porSeveridad[2] + porSeveridad[3]

    const porComunidad = {}
    medidos
      .filter((f) => (f.severidad ?? 0) > 0)
      .forEach((f) => {
        porComunidad[f.comunidad] = (porComunidad[f.comunidad] ?? 0) + 1
      })
    const comunidades = Object.entries(porComunidad)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)

    return { total, medidos: medidos.length, alterados, porSeveridad, comunidades }
  }, [filas])

  return (
    <div className="marco">
      <Barra
        sub="Centro de Salud · San Pedro Sacatepéquez"
        titulo="Panel"
        accion={
          <button className="barra__volver" onClick={salir} aria-label="Cerrar sesión" title="Cerrar sesión">
            ⏻
          </button>
        }
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
            Sin conexión: cifras de la última carga guardada en este dispositivo
            ({fechaHoraCorta(cacheFecha)}).
          </Aviso>
        )}

        {!stats ? (
          <Cargando>Cargando panel…</Cargando>
        ) : (
          <>
            <div className="metricas">
              <div className="metrica">
                <div className="metrica__valor">{stats.total}</div>
                <div className="metrica__etiqueta">Pacientes registrados</div>
              </div>
              <div className="metrica">
                <div className="metrica__valor">{stats.medidos}</div>
                <div className="metrica__etiqueta">Con al menos una medición</div>
              </div>
              <div className="metrica">
                <div
                  className="metrica__valor"
                  style={{ color: stats.alterados ? 'var(--sev-2)' : undefined }}
                >
                  {stats.medidos ? Math.round((stats.alterados / stats.medidos) * 100) : 0}%
                </div>
                <div className="metrica__etiqueta">Con alguna alteración nutricional</div>
              </div>
              <div className="metrica">
                <div className="metrica__valor" style={{ color: 'var(--sev-3)' }}>
                  {stats.porSeveridad[3]}
                </div>
                <div className="metrica__etiqueta">Casos severos</div>
              </div>
            </div>

            <div className="tarjeta">
              <p className="eyebrow">Distribución por severidad</p>
              {[0, 1, 2, 3].map((s) => (
                <div className="barra-horiz" key={s}>
                  <span className="barra-horiz__etiqueta">{ETIQUETA_SEVERIDAD[s]}</span>
                  <span className="barra-horiz__pista">
                    <span
                      className="barra-horiz__relleno"
                      style={{
                        width: stats.medidos ? `${(stats.porSeveridad[s] / stats.medidos) * 100}%` : '0%',
                        background: COLOR_SEVERIDAD[s],
                      }}
                    />
                  </span>
                  <span className="barra-horiz__valor">{stats.porSeveridad[s]}</span>
                </div>
              ))}
              {stats.medidos === 0 && (
                <p className="campo__ayuda">Aún no hay mediciones registradas.</p>
              )}
            </div>

            {stats.comunidades.length > 0 && (
              <div className="tarjeta">
                <p className="eyebrow">Comunidades con más casos en seguimiento</p>
                <ul className="lista">
                  {stats.comunidades.map(([nombre, n]) => (
                    <li key={nombre} className="lista__fila" style={{ cursor: 'default' }}>
                      <div className="lista__cuerpo">
                        <div className="lista__nombre">{nombre}</div>
                      </div>
                      <span className="insignia insignia--2">
                        {n} {n === 1 ? 'caso' : 'casos'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link className="enlace-panel" to="/pacientes">
              <span className="enlace-panel__icono" aria-hidden="true">👥</span>
              <div className="lista__cuerpo">
                <div className="lista__nombre">Ver todos los pacientes</div>
                <div className="lista__meta">Buscar, registrar y dar seguimiento</div>
              </div>
              <span className="enlace-panel__flecha" aria-hidden="true">→</span>
            </Link>

            <Link className="enlace-panel" to="/mapa">
              <span className="enlace-panel__icono" aria-hidden="true">🗺️</span>
              <div className="lista__cuerpo">
                <div className="lista__nombre">Mapa</div>
                <div className="lista__meta">Distribución geográfica y mapa de calor</div>
              </div>
              <span className="enlace-panel__flecha" aria-hidden="true">→</span>
            </Link>

            {[3, 4, 5].includes(perfil?.rol_id) && (
              <Link className="enlace-panel" to="/reportes">
                <span className="enlace-panel__icono" aria-hidden="true">📊</span>
                <div className="lista__cuerpo">
                  <div className="lista__nombre">Reportes de control</div>
                  <div className="lista__meta">Brecha nutricional por comunidad y tiempos de respuesta</div>
                </div>
                <span className="enlace-panel__flecha" aria-hidden="true">→</span>
              </Link>
            )}

            {[4, 5].includes(perfil?.rol_id) && (
              <Link className="enlace-panel" to="/auditoria">
                <span className="enlace-panel__icono" aria-hidden="true">🕓</span>
                <div className="lista__cuerpo">
                  <div className="lista__nombre">Bitácora de auditoría</div>
                  <div className="lista__meta">Altas y modificaciones registradas por el sistema</div>
                </div>
                <span className="enlace-panel__flecha" aria-hidden="true">→</span>
              </Link>
            )}
          </>
        )}
      </main>
    </div>
  )
}
