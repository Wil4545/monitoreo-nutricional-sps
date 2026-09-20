import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Aviso, Barra, Cargando } from '../componentes/Interfaz.jsx'
import { fechaHoraCorta } from '../lib/formato.js'

const ETIQUETA_ACCION = {
  alta: 'Alta', modificacion: 'Modificación', baja: 'Baja', consulta: 'Consulta',
}
const ETIQUETA_ENTIDAD = { paciente: 'Paciente', medicion: 'Medición' }
const TAM_PAGINA = 30

/**
 * Bitácora de auditoría — RF-14 y RNF-10 (Sección 4.2.1 y 4.2.3).
 *
 * El registro en sí ya ocurre solo, por el disparador `fn_auditar` del
 * esquema (01_schema.sql): cada alta o modificación de un paciente o una
 * medición queda escrita en `registro_auditoria` sin que la aplicación
 * tenga que acordarse de hacerlo. Lo que faltaba, y es lo que agrega esta
 * pantalla, es un lugar para *leer* esa bitácora — hasta ahora el dato
 * existía pero nadie podía verlo sin entrar directo a Supabase.
 */
export default function Auditoria() {
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [hayMas, setHayMas] = useState(true)
  const [error, setError] = useState('')

  async function cargar(desde) {
    setCargando(true)
    const { data, error } = await supabase
      .from('registro_auditoria')
      .select('id, entidad, entidad_id, accion, ocurrido_en, usuario(nombre)')
      .order('ocurrido_en', { ascending: false })
      .range(desde, desde + TAM_PAGINA - 1)

    if (error) setError(error.message)
    setFilas((prev) => [...prev, ...(data ?? [])])
    setHayMas((data ?? []).length === TAM_PAGINA)
    setCargando(false)
  }

  useEffect(() => { cargar(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="marco">
      <Barra volver sub="Trazabilidad" titulo="Bitácora de auditoría" />

      <main className="contenido">
        <Aviso tipo="error">{error}</Aviso>

        <p className="campo__ayuda" style={{ marginBottom: '0.9rem' }}>
          Cada alta o modificación de un paciente o una medición se registra
          automáticamente aquí, con fecha, usuario y acción, sin intervención
          manual.
        </p>

        {filas.length === 0 && !cargando ? (
          <div className="vacio">
            <p>Todavía no hay actividad registrada.</p>
          </div>
        ) : (
          <ul className="lista">
            {filas.map((f) => (
              <li key={f.id} className="lista__fila" style={{ cursor: 'default' }}>
                <div className="lista__cuerpo">
                  <div className="lista__nombre">
                    {ETIQUETA_ACCION[f.accion] ?? f.accion} · {ETIQUETA_ENTIDAD[f.entidad] ?? f.entidad}
                  </div>
                  <div className="lista__meta">
                    {fechaHoraCorta(f.ocurrido_en)}
                    {' · '}
                    {f.usuario?.nombre ?? 'Usuario no identificado'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {cargando && <Cargando>Cargando…</Cargando>}

        {hayMas && !cargando && filas.length > 0 && (
          <button
            className="boton boton--secundario boton--ancho"
            onClick={() => cargar(filas.length)}
          >
            Cargar más
          </button>
        )}
      </main>
    </div>
  )
}
