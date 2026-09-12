import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'

/**
 * Mapa de calor — RF-07 (Sección 4.2.1, 3.4.4).
 *
 * react-leaflet no tiene un componente propio para esto; leaflet.heat
 * extiende el objeto L global con L.heatLayer, así que se agrega de
 * forma imperativa sobre la instancia del mapa, tal como describe la
 * Sección 3.4.4.
 *
 * El peso de cada punto es la severidad clínica (0 a 3), no un conteo
 * simple de pacientes. La diferencia importa: un mapa de calor por
 * densidad de puntos mostraría más intenso donde hay más gente, sin
 * distinguir si esos pacientes están sanos o en riesgo. Ponderando por
 * severidad, la intensidad del mapa representa concentración de riesgo
 * nutricional — que es lo que un mapa de calor debe mostrar en este
 * contexto (identificar focos para priorizar brigadas, Sección 1.1.2).
 */
const PESO_POR_SEVERIDAD = { 0: 0.1, 1: 0.4, 2: 0.7, 3: 1.0 }

export default function CapaCalor({ puntos, activa }) {
  const mapa = useMap()

  useEffect(() => {
    if (!activa || puntos.length === 0) return undefined

    const datos = puntos.map((p) => [p.lat, p.lng, PESO_POR_SEVERIDAD[p.severidad] ?? 0.1])
    const capa = L.heatLayer(datos, {
      radius: 32,
      blur: 24,
      // Antes en 16 — con el mapa arrancando en zoom 13 (ver Mapa.jsx),
      // esa diferencia hacía que leaflet.heat atenuara la intensidad
      // como si estuvieras muy alejado, incluso con pesos altos. Al
      // igualarlo al zoom inicial, la intensidad real (basada en
      // severidad) se ve completa desde que se abre el mapa, sin
      // depender de que el usuario haga zoom para "revelarla".
      maxZoom: 13,
      minOpacity: 0.25,
      gradient: { 0.2: '#1F7A5C', 0.5: '#B07D0A', 0.75: '#C05621', 1.0: '#9B1C1C' },
    })
    capa.addTo(mapa)

    return () => mapa.removeLayer(capa)
  }, [mapa, puntos, activa])

  return null
}
