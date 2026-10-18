// Íconos de línea del panel. Usan `currentColor`, así que toman el color
// del contenedor (verde institucional) y se ven igual en cualquier
// dispositivo — a diferencia de los emojis, que cambian según el sistema.

function Icono({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const IconoPacientes = () => (
  <Icono>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <circle cx="17.5" cy="9" r="2.4" />
    <path d="M17 14c2.5 0 4.5 1.7 4.5 4.5" />
  </Icono>
)

export const IconoMapa = () => (
  <Icono>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </Icono>
)

export const IconoReportes = () => (
  <Icono>
    <path d="M4 20V4M4 20h16" />
    <rect x="7.5" y="11" width="3" height="6" rx=".5" />
    <rect x="12.5" y="7" width="3" height="10" rx=".5" />
    <rect x="17.5" y="13" width="2.5" height="4" rx=".5" />
  </Icono>
)

export const IconoBitacora = () => (
  <Icono>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icono>
)

// Flecha dentro de un círculo (el círculo lo dibuja el CSS).
export const IconoFlecha = () => (
  <Icono>
    <path d="M5.5 12h12M12.5 6.5l5.5 5.5-5.5 5.5" />
  </Icono>
)

// Controles de la barra superior (círculo con contorno blanco, ver
// `.barra__volver` en estilos.css).
export const IconoVolver = () => (
  <Icono>
    <path d="M18.5 12h-12M11.5 6.5 6 12l5.5 5.5" />
  </Icono>
)

export const IconoSalir = () => (
  <Icono>
    <path d="M12 3.5v8" />
    <path d="M7 6.8a7.5 7.5 0 1 0 10 0" />
  </Icono>
)

export const IconoCerrar = () => (
  <Icono>
    <path d="M7 7l10 10M17 7L7 17" />
  </Icono>
)
