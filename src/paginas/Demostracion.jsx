import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pacientesDemo } from '../lib/demo.js'
import GraficoTrayectoria from '../componentes/GraficoTrayectoria.jsx'
import { Aviso, Barra, Insignia } from '../componentes/Interfaz.jsx'
import { edadEnMeses } from '../lib/oms/zscore.js'
import { edadLegible, fechaCorta, formatoZ, hoyISO } from '../lib/formato.js'

/**
 * Recorrido de demostración con datos ficticios. Permite mostrar la ficha
 * de seguimiento y la trayectoria sin necesidad de cuentas ni conexión.
 */
export default function Demostracion() {
  const navegar = useNavigate()
  const [i, setI] = useState(0)
  const p = pacientesDemo[i]
  const ultima = p.mediciones[p.mediciones.length - 1]

  return (
    <div className="marco">
      <Barra
        sub="Modo demostración"
        titulo="Ficha de seguimiento"
        accion={
          <button className="barra__volver" onClick={() => navegar('/')} aria-label="Salir de la demostración">
            ✕
          </button>
        }
      />

      <main className="contenido">
        <Aviso tipo="alerta">
          Datos ficticios para demostración. Los puntajes Z se calculan con
          el mismo motor y las mismas tablas de la OMS que usa el sistema en
          producción.
        </Aviso>

        <div className="grafico__pestanas" role="group" aria-label="Paciente de ejemplo">
          {pacientesDemo.map((x, n) => (
            <button key={x.id} type="button" aria-pressed={n === i} onClick={() => setI(n)}>
              {x.nombre.split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <p className="eyebrow" style={{ marginBottom: '0.15rem' }}>
                {p.codigo} · {p.sexo === 'M' ? 'Niño' : 'Niña'} ·{' '}
                {edadLegible(edadEnMeses(p.fecha_nacimiento, hoyISO()))}
              </p>
              <h2>{p.nombre} {p.apellido}</h2>
            </div>
            <Insignia severidad={ultima.severidad} />
          </div>
          <div className="lista__meta">
            {p.comunidad.nombre} · Tutor: {p.tutor_nombre}
          </div>
        </div>

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
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem' }}>{ultima.clasificacion}</p>
        </div>

        <div className="tarjeta">
          <div className="tarjeta__encabezado">
            <h2>Trayectoria</h2>
            <span className="lista__meta">{p.mediciones.length} citas</span>
          </div>
          <GraficoTrayectoria mediciones={p.mediciones} />
        </div>

        <div className="tarjeta">
          <p className="eyebrow">Historial de citas</p>
          <ul className="lista">
            {[...p.mediciones].reverse().map((m) => (
              <li key={m.id} className="lista__fila" style={{ cursor: 'default' }}>
                <div className="lista__cuerpo">
                  <div className="lista__nombre">{fechaCorta(m.fecha_medicion)}</div>
                  <div className="lista__meta">
                    {m.peso_kg} kg · {m.talla_cm} cm · {edadLegible(m.edad_meses)}
                  </div>
                  <div className="lista__meta">
                    T/E {formatoZ(m.z_talla_edad)} · P/T {formatoZ(m.z_peso_talla)} · P/E{' '}
                    {formatoZ(m.z_peso_edad)}
                  </div>
                </div>
                <Insignia severidad={m.severidad} />
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}
