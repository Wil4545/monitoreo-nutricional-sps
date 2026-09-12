import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase.js'
import { Aviso, Barra, Cargando, Segmentos } from '../componentes/Interfaz.jsx'
import CapaCalor from '../componentes/CapaCalor.jsx'

const COLOR_SEVERIDAD = {
  0: '#1F7A5C', 1: '#B07D0A', 2: '#C05621', 3: '#9B1C1C',
}

// Centro del municipio — coordenada verificada de la cabecera
// (supabase/08_coordenadas_comunidades.sql). Respaldo si todavía
// ninguna comunidad tiene coordenada.
const CENTRO_DISTRITO = [14.683333, -90.65]

/**
 * Mapa por comunidad — RF-06 (georreferenciar registros) y RF-07
 * (mapa de calor "por comunidad o sector", Sección 4.2.1).
 *
 * Ubica a cada paciente en la coordenada de su COMUNIDAD DE
 * RESIDENCIA — el dato fijo elegido de un catálogo al registrarlo
 * (RF-01) — en vez de la coordenada GPS capturada en el momento exacto
 * de cada medición (`medicion.latitud/longitud`, todavía se guarda,
 * pero ya no es lo que dibuja este mapa).
 *
 * El cambio responde a cómo opera este distrito en la práctica: las
 * familias viajan hacia el puesto de salud, no al revés, así que el
 * GPS del dispositivo en el momento del registro solo indica dónde
 * estaba el punto de atención (o, durante pruebas, dónde estaba quien
 * probaba el sistema) — no de dónde viene el paciente. Georreferenciar
 * por comunidad es además más fiel al texto exacto de RF-07, que pide
 * la concentración de casos "por comunidad o sector", no por punto
 * exacto de cada medición.
 */
export default function Mapa() {
  const [pacientes, setPacientes] = useState(null)
  const [comunidades, setComunidades] = useState(null)
  const [error, setError] = useState('')
  const [vista, setVista] = useState('calor') // 'calor' | 'comunidades'

  useEffect(() => {
    supabase.from('v_paciente_estado').select('*')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setPacientes(data ?? [])
      })
    supabase.from('comunidad').select('nombre, latitud, longitud')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setComunidades(data ?? [])
      })
  }, [])

  // Un punto por paciente en la coordenada de su comunidad — varios
  // pacientes de la misma comunidad caen exactamente en el mismo
  // punto, lo que hace que el mapa de calor se concentre solo donde
  // hay casos reales, sin necesitar ninguna lógica extra.
  const puntos = useMemo(() => {
    if (!pacientes || !comunidades) return []
    const coords = Object.fromEntries(
      comunidades
        .filter((c) => c.latitud != null && c.longitud != null)
        .map((c) => [c.nombre, { lat: c.latitud, lng: c.longitud }]),
    )
    return pacientes
      .filter((p) => p.fecha_medicion && coords[p.comunidad])
      .map((p) => ({
        id: p.id, ...coords[p.comunidad],
        severidad: p.severidad ?? 0, comunidad: p.comunidad,
      }))
  }, [pacientes, comunidades])

  // Agregado por comunidad, para la vista de puntos — mostrar un
  // marcador por paciente no tendría sentido aquí, ya que varios caen
  // en la misma coordenada exacta.
  const resumenComunidades = useMemo(() => {
    if (!puntos.length) return []
    const grupos = {}
    for (const p of puntos) {
      grupos[p.comunidad] ??= { ...p, total: 0, alterados: 0, severos: 0, maxSeveridad: 0 }
      grupos[p.comunidad].total += 1
      if (p.severidad > 0) grupos[p.comunidad].alterados += 1
      if (p.severidad === 3) grupos[p.comunidad].severos += 1
      grupos[p.comunidad].maxSeveridad = Math.max(grupos[p.comunidad].maxSeveridad, p.severidad)
    }
    return Object.values(grupos)
  }, [puntos])

  const medidos = pacientes ? pacientes.filter((p) => p.fecha_medicion).length : 0
  const sinComunidadUbicada = medidos - puntos.length
  const comunidadesPendientes = comunidades
    ? comunidades.filter((c) => c.latitud == null || c.longitud == null).length
    : 0

  return (
    <div className="marco">
      <Barra volver sub="Distribución geográfica" titulo="Mapa" />

      <main className="contenido" style={{ paddingBottom: '1.5rem' }}>
        <Aviso tipo="error">{error}</Aviso>

        {pacientes === null || comunidades === null ? (
          <Cargando>Cargando mapa…</Cargando>
        ) : puntos.length === 0 ? (
          <div className="vacio">
            <p>
              Todavía no hay pacientes con medición en una comunidad con
              coordenada registrada.
              {comunidadesPendientes > 0 &&
                ` ${comunidadesPendientes} comunidades del catálogo aún no tienen coordenada — ver supabase/08_coordenadas_comunidades.sql.`}
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '0.75rem' }}>
              <Segmentos
                etiqueta="Tipo de vista"
                valor={vista}
                onChange={setVista}
                opciones={[
                  { valor: 'calor', texto: 'Mapa de calor' },
                  { valor: 'comunidades', texto: 'Comunidades' },
                ]}
              />
            </div>

            <div className="tarjeta" style={{ padding: 0, overflow: 'hidden' }}>
              <MapContainer
                center={puntos[0] ? [puntos[0].lat, puntos[0].lng] : CENTRO_DISTRITO}
                zoom={13}
                style={{ height: '60vh', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <CapaCalor puntos={puntos} activa={vista === 'calor'} />

                {vista === 'comunidades' && resumenComunidades.map((c) => (
                  <CircleMarker
                    key={c.comunidad}
                    center={[c.lat, c.lng]}
                    radius={Math.max(10, Math.min(26, 8 + c.total * 3))}
                    pathOptions={{
                      color: COLOR_SEVERIDAD[c.maxSeveridad],
                      fillColor: COLOR_SEVERIDAD[c.maxSeveridad],
                      fillOpacity: 0.55,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <strong>{c.comunidad}</strong><br />
                      {c.total} {c.total === 1 ? 'paciente' : 'pacientes'} con medición<br />
                      {c.alterados} con alguna alteración
                      {c.severos > 0 && ` · ${c.severos} ${c.severos === 1 ? 'severo' : 'severos'}`}
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>

            <div className="grafico__leyenda" style={{ marginTop: '0.75rem' }}>
              <span><i className="punto punto--0" /> Normal</span>
              <span><i className="punto punto--1" /> En riesgo</span>
              <span><i className="punto punto--2" /> Moderada</span>
              <span><i className="punto punto--3" /> Severa</span>
            </div>

            <p className="campo__ayuda" style={{ marginTop: '0.5rem' }}>
              {resumenComunidades.length} {resumenComunidades.length === 1 ? 'comunidad' : 'comunidades'} en el mapa
              {sinComunidadUbicada > 0 &&
                ` · ${sinComunidadUbicada} ${sinComunidadUbicada === 1 ? 'paciente' : 'pacientes'} en comunidades sin coordenada aún`}
            </p>
          </>
        )}
      </main>
    </div>
  )
}
