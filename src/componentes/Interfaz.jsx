import { useNavigate } from 'react-router-dom'
import { ETIQUETA_SEVERIDAD } from '../lib/oms/clasificacion.js'

/**
 * Barra superior. `volver` muestra el control de regreso.
 *
 * `volver` acepta una ruta explícita (string) o `true` para usar el
 * historial del navegador. Se prefiere la ruta explícita en cada
 * pantalla: si se entra directo a una URL (un enlace compartido, una
 * pestaña de Safari restaurada al reabrir el teléfono, un marcador) no
 * queda nada en el historial de ESTA sesión para regresar, y
 * `navegar(-1)` simplemente no hace nada — el botón se ve pero no
 * responde. Con una ruta explícita, "volver" funciona siempre, sin
 * importar cómo se llegó a la pantalla.
 */
export function Barra({ titulo, sub, volver = false, accion = null }) {
  const navegar = useNavigate()
  function irAtras() {
    if (typeof volver === 'string') navegar(volver)
    else navegar(-1)
  }
  return (
    <header className="barra">
      {volver && (
        <button
          type="button"
          className="barra__volver"
          onClick={irAtras}
          aria-label="Volver"
        >
          ←
        </button>
      )}
      <div className="barra__titulo">
        {sub && <span className="barra__sub">{sub}</span>}
        {titulo}
      </div>
      {accion}
    </header>
  )
}

export function Insignia({ severidad, children }) {
  return (
    <span className={`insignia insignia--${severidad}`}>
      <i className={`punto punto--${severidad}`} />
      {children ?? ETIQUETA_SEVERIDAD[severidad]}
    </span>
  )
}

export function Campo({ etiqueta, ayuda, error, children, id }) {
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>{etiqueta}</label>
      {children}
      {error
        ? <p className="campo__error">{error}</p>
        : ayuda && <p className="campo__ayuda">{ayuda}</p>}
    </div>
  )
}

/** Selector de dos o más opciones con objetivos táctiles amplios. */
export function Segmentos({ valor, onChange, opciones, etiqueta }) {
  return (
    <div className="segmentos" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          aria-pressed={valor === o.valor}
          onClick={() => onChange(o.valor)}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}

/** Chips de selección múltiple — misma base visual que Segmentos, pero cada opción se activa por separado. */
export function SelectorMultiple({ valor, onChange, opciones, etiqueta }) {
  function alternar(id) {
    onChange(valor.includes(id) ? valor.filter((v) => v !== id) : [...valor, id])
  }
  return (
    <div className="segmentos segmentos--envuelto" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={valor.includes(o.valor)}
          onClick={() => alternar(o.valor)}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}

export function Aviso({ tipo = 'info', children }) {
  if (!children) return null
  return <div className={`aviso aviso--${tipo}`} role={tipo === 'error' ? 'alert' : undefined}>{children}</div>
}

export function Cargando({ children = 'Cargando…' }) {
  return <div className="cargando">{children}</div>
}

export function BarraAccion({ children }) {
  return (
    <div className="barra-accion">
      <div>{children}</div>
    </div>
  )
}
