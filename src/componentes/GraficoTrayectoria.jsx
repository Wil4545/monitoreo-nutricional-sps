import { useMemo, useState } from 'react'
import {
  clasificarPesoEdad,
  clasificarTallaEdad,
  clasificarPesoTalla,
} from '../lib/oms/clasificacion.js'
import { fechaCorta, formatoZ } from '../lib/formato.js'

/**
 * Trayectoria antropométrica del paciente — RF-05 (Sección 4.2.1)
 *
 * Es la funcionalidad que la nutricionista pidió de forma explícita en la
 * entrevista del 9 de agosto (Sección 4.1): un punto por cita y una línea
 * de tendencia que permita ver si el niño se recupera, se estanca o se
 * deteriora.
 *
 * Se grafica el puntaje Z y no el peso crudo. Un niño puede ganar peso
 * mes a mes y aun así alejarse del patrón de la OMS: la curva de peso
 * subiría y ocultaría el deterioro. El eje Z lo hace visible, y además
 * permite que las bandas de corte (−1, −2, −3) sean líneas rectas
 * comparables entre pacientes de distinta edad.
 */

const INDICADORES = [
  { clave: 'z_talla_edad', etiqueta: 'Talla / edad', corto: 'T/E',
    detalle: 'desnutrición crónica', clasificar: clasificarTallaEdad, altoEsRiesgo: false },
  { clave: 'z_peso_talla', etiqueta: 'Peso / talla', corto: 'P/T',
    detalle: 'desnutrición aguda', clasificar: clasificarPesoTalla, altoEsRiesgo: true },
  { clave: 'z_peso_edad', etiqueta: 'Peso / edad', corto: 'P/E',
    detalle: 'bajo peso', clasificar: clasificarPesoEdad, altoEsRiesgo: true },
]

const ANCHO = 360
const ALTO = 250
const M = { arriba: 10, derecha: 10, abajo: 30, izquierda: 32 }
const Z_MAX = 3.5
const Z_MIN = -4

/** Regresión lineal por mínimos cuadrados. */
function tendencia(puntos) {
  const n = puntos.length
  if (n < 2) return null
  const sx = puntos.reduce((a, p) => a + p.x, 0)
  const sy = puntos.reduce((a, p) => a + p.y, 0)
  const sxy = puntos.reduce((a, p) => a + p.x * p.y, 0)
  const sxx = puntos.reduce((a, p) => a + p.x * p.x, 0)
  const denom = n * sxx - sx * sx
  if (Math.abs(denom) < 1e-9) return null
  const pendiente = (n * sxy - sx * sy) / denom
  const intercepto = (sy - pendiente * sx) / n
  return { pendiente, intercepto }
}

export default function GraficoTrayectoria({ mediciones }) {
  const [indice, setIndice] = useState(0)
  const ind = INDICADORES[indice]

  const datos = useMemo(() => {
    return (mediciones ?? [])
      .filter((m) => m[ind.clave] != null && m.edad_meses != null)
      .map((m) => ({
        x: Number(m.edad_meses),
        y: Number(m[ind.clave]),
        fecha: m.fecha_medicion,
        peso: m.peso_kg,
        talla: m.talla_cm,
      }))
      .sort((a, b) => a.x - b.x)
  }, [mediciones, ind.clave])

  if (datos.length === 0) {
    return (
      <>
        <Pestanas indice={indice} setIndice={setIndice} />
        <div className="vacio">
          <p>Aún no hay mediciones con {ind.etiqueta.toLowerCase()} calculado.</p>
        </div>
      </>
    )
  }

  // Escalas
  const xMin = Math.max(0, Math.floor(Math.min(...datos.map((d) => d.x)) - 1))
  const xMax = Math.max(xMin + 6, Math.ceil(Math.max(...datos.map((d) => d.x)) + 1))
  const anchoUtil = ANCHO - M.izquierda - M.derecha
  const altoUtil = ALTO - M.arriba - M.abajo

  const px = (x) => M.izquierda + ((x - xMin) / (xMax - xMin)) * anchoUtil
  const py = (z) =>
    M.arriba + ((Z_MAX - Math.max(Z_MIN, Math.min(Z_MAX, z))) / (Z_MAX - Z_MIN)) * altoUtil

  // Bandas de severidad. Por debajo de −1 siempre indican riesgo; por
  // encima de +1 solo cuando el exceso es patológico (peso, no talla).
  const bandas = [
    { desde: -1, hasta: 1, sev: 0 },
    { desde: -2, hasta: -1, sev: 1 },
    { desde: -3, hasta: -2, sev: 2 },
    { desde: Z_MIN, hasta: -3, sev: 3 },
    { desde: 1, hasta: 2, sev: ind.altoEsRiesgo ? 1 : 0 },
    { desde: 2, hasta: Z_MAX, sev: ind.altoEsRiesgo ? 2 : 0 },
  ]

  const t = tendencia(datos)
  const veredicto = interpretar(t, datos, ind)

  const ultimo = datos[datos.length - 1]
  const clasUltimo = ind.clasificar(ultimo.y)

  return (
    <>
      <Pestanas indice={indice} setIndice={setIndice} />

      <svg
        className="grafico"
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={
          `Trayectoria de ${ind.etiqueta} del paciente. ` +
          `${datos.length} mediciones. Último puntaje Z ${formatoZ(ultimo.y)}, ` +
          `clasificado como ${clasUltimo.etiqueta}. ${veredicto.texto}`
        }
      >
        {/* Bandas de referencia OMS */}
        {bandas.map((b, i) => (
          <rect
            key={i}
            x={M.izquierda}
            y={py(b.hasta)}
            width={anchoUtil}
            height={Math.max(0, py(b.desde) - py(b.hasta))}
            fill={`var(--sev-${b.sev}-fondo)`}
          />
        ))}

        {/* Líneas de corte */}
        {[-3, -2, -1, 0, 1, 2].map((z) => (
          <g key={z}>
            <line
              x1={M.izquierda}
              x2={ANCHO - M.derecha}
              y1={py(z)}
              y2={py(z)}
              stroke={z === 0 ? 'var(--linea-fuerte)' : 'var(--linea)'}
              strokeWidth={z === 0 ? 1.2 : 0.8}
              strokeDasharray={z === 0 ? 'none' : '3 3'}
            />
            <text
              x={M.izquierda - 6}
              y={py(z) + 3.5}
              textAnchor="end"
              fontSize="9"
              fontFamily="var(--fuente-dato)"
              fill="var(--tenue)"
            >
              {z > 0 ? `+${z}` : z}
            </text>
          </g>
        ))}

        {/* Eje X: edad en meses */}
        <line
          x1={M.izquierda}
          x2={ANCHO - M.derecha}
          y1={ALTO - M.abajo}
          y2={ALTO - M.abajo}
          stroke="var(--linea-fuerte)"
        />
        {marcasX(xMin, xMax).map((x) => (
          <text
            key={x}
            x={px(x)}
            y={ALTO - M.abajo + 14}
            textAnchor="middle"
            fontSize="9"
            fontFamily="var(--fuente-dato)"
            fill="var(--tenue)"
          >
            {x}
          </text>
        ))}
        <text
          x={M.izquierda + anchoUtil / 2}
          y={ALTO - 4}
          textAnchor="middle"
          fontSize="9"
          fontFamily="var(--fuente-dato)"
          fill="var(--tenue)"
          letterSpacing="0.05em"
        >
          EDAD EN MESES
        </text>

        {/* Línea de tendencia */}
        {t && (
          <line
            x1={px(xMin)}
            y1={py(t.intercepto + t.pendiente * xMin)}
            x2={px(xMax)}
            y2={py(t.intercepto + t.pendiente * xMax)}
            stroke="var(--jade)"
            strokeWidth="1.6"
            strokeDasharray="5 4"
            opacity="0.85"
          />
        )}

        {/* Recorrido entre citas */}
        {datos.length > 1 && (
          <polyline
            points={datos.map((d) => `${px(d.x)},${py(d.y)}`).join(' ')}
            fill="none"
            stroke="var(--tinta-suave)"
            strokeWidth="1.2"
            opacity="0.45"
          />
        )}

        {/* Un punto por cita */}
        {datos.map((d, i) => {
          const sev = ind.clasificar(d.y).severidad
          const esUltimo = i === datos.length - 1
          return (
            <circle
              key={i}
              cx={px(d.x)}
              cy={py(d.y)}
              r={esUltimo ? 5.5 : 4}
              fill={`var(--sev-${sev})`}
              stroke="var(--superficie)"
              strokeWidth="1.5"
            >
              <title>
                {fechaCorta(d.fecha)} · Z {formatoZ(d.y)} · {d.peso} kg · {d.talla} cm
              </title>
            </circle>
          )
        })}
      </svg>

      <div className="grafico__leyenda">
        <span><i className="punto punto--0" /> Normal</span>
        <span><i className="punto punto--1" /> En riesgo</span>
        <span><i className="punto punto--2" /> Moderada</span>
        <span><i className="punto punto--3" /> Severa</span>
      </div>

      <div className="veredicto">
        <strong>{veredicto.titulo}.</strong> {veredicto.texto}
      </div>
    </>
  )
}

function Pestanas({ indice, setIndice }) {
  return (
    <div className="grafico__pestanas" role="group" aria-label="Indicador a graficar">
      {INDICADORES.map((i, n) => (
        <button
          key={i.clave}
          type="button"
          aria-pressed={n === indice}
          onClick={() => setIndice(n)}
        >
          {i.etiqueta}
        </button>
      ))}
    </div>
  )
}

function marcasX(min, max) {
  const span = max - min
  const paso = span <= 12 ? 2 : span <= 30 ? 6 : 12
  const salida = []
  for (let x = Math.ceil(min / paso) * paso; x <= max; x += paso) salida.push(x)
  return salida
}

/**
 * Traduce la pendiente a lenguaje clínico. El umbral de 0.05 Z/mes evita
 * llamar «recuperación» al ruido de medición: por debajo de esa magnitud
 * la variación cabe dentro del error de una báscula de campo.
 */
function interpretar(t, datos, ind) {
  if (datos.length < 2) {
    return {
      titulo: 'Una sola medición',
      texto:
        'Se necesita al menos una segunda cita para trazar la tendencia y evaluar ' +
        'la respuesta al plan de tratamiento.',
    }
  }
  const meses = datos[datos.length - 1].x - datos[0].x
  const cambio = datos[datos.length - 1].y - datos[0].y
  const detalle =
    `Entre la primera y la última cita el puntaje Z de ${ind.etiqueta.toLowerCase()} ` +
    `pasó de ${formatoZ(datos[0].y)} a ${formatoZ(datos[datos.length - 1].y)} ` +
    `en ${meses.toFixed(1)} meses.`

  if (!t) return { titulo: 'Sin tendencia calculable', texto: detalle }

  if (t.pendiente > 0.05)
    return { titulo: 'Tendencia de recuperación', texto: detalle }
  if (t.pendiente < -0.05)
    return {
      titulo: 'Tendencia de deterioro',
      texto: `${detalle} Conviene revisar la adherencia al plan y considerar visita domiciliaria.`,
    }
  return {
    titulo: 'Tendencia estable',
    texto: `${detalle} El cambio (${cambio >= 0 ? '+' : ''}${cambio.toFixed(2)} Z) está dentro del margen de una medición a otra.`,
  }
}
