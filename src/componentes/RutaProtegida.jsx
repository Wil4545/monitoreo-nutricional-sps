import { useSesion } from '../contexto/Sesion.jsx'
import { Barra, Cargando } from './Interfaz.jsx'

/**
 * Restringe una pantalla completa a ciertos roles — RF-13 (Sección
 * 4.2.1), ajustado en 07_revertir_alcance_comunidad.sql: el control de
 * acceso es por PANTALLA/OPERACIÓN, no por comunidad geográfica.
 *
 * Es un candado de interfaz, pensado para que un enlace oculto no sea
 * la única barrera — si alguien escribe la URL directamente, esto
 * también la bloquea. La base de datos respalda esto mismo a nivel de
 * fila para `reporte` y `registro_auditoria` (ver la migración 07), así
 * que aunque alguien se saltara este componente, la consulta a
 * Supabase no devolvería datos de todas formas.
 */
export default function RutaProtegida({ rolesPermitidos, children }) {
  const { perfil, cargando } = useSesion()

  // Mientras el perfil aún no llega, no se decide nada — evita un
  // parpadeo de "acceso restringido" seguido de la pantalla real.
  if (cargando || perfil === null) {
    return <Cargando>Verificando acceso…</Cargando>
  }

  if (!rolesPermitidos.includes(perfil.rol_id)) {
    return (
      <div className="marco">
        <Barra volver titulo="Acceso restringido" />
        <main className="contenido">
          <div className="vacio">
            <p>
              Tu rol ({perfil.rol?.nombre ?? 'sin rol asignado'}) no tiene acceso
              a esta sección.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return children
}
