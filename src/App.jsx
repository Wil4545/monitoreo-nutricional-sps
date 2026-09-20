import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSesion } from './contexto/Sesion.jsx'
import { Cargando } from './componentes/Interfaz.jsx'
import Ingreso from './paginas/Ingreso.jsx'
import Panel from './paginas/Panel.jsx'
import ListaPacientes from './paginas/ListaPacientes.jsx'
import NuevoPaciente from './paginas/NuevoPaciente.jsx'
import FichaPaciente from './paginas/FichaPaciente.jsx'
import NuevaMedicion from './paginas/NuevaMedicion.jsx'
import PlanesAlimentarios from './paginas/PlanesAlimentarios.jsx'
import Auditoria from './paginas/Auditoria.jsx'
import Mapa from './paginas/Mapa.jsx'
import Reportes from './paginas/Reportes.jsx'
import Demostracion from './paginas/Demostracion.jsx'
import RutaProtegida from './componentes/RutaProtegida.jsx'
import EstadoSincronizacion from './componentes/EstadoSincronizacion.jsx'

export default function App() {
  const { sesion, cargando } = useSesion()
  const { pathname } = useLocation()

  // La demostración funciona sin cuenta ni conexión.
  if (pathname === '/demostracion') {
    return (
      <Routes>
        <Route path="/demostracion" element={<Demostracion />} />
      </Routes>
    )
  }

  if (cargando) return <Cargando>Verificando sesión…</Cargando>
  if (!sesion) return <Ingreso />

  return (
    <>
      <EstadoSincronizacion />
      <Routes>
        <Route path="/" element={<Navigate to="/panel" replace />} />
        <Route path="/panel" element={<Panel />} />
        <Route path="/pacientes" element={<ListaPacientes />} />
        <Route path="/pacientes/nuevo" element={<NuevoPaciente />} />
        <Route path="/pacientes/:id" element={<FichaPaciente />} />
        <Route path="/pacientes/:id/medicion" element={<NuevaMedicion />} />
        <Route path="/pacientes/:id/planes" element={<PlanesAlimentarios />} />
        <Route
          path="/auditoria"
          element={<RutaProtegida rolesPermitidos={[4, 5]}><Auditoria /></RutaProtegida>}
        />
        <Route path="/mapa" element={<Mapa />} />
        <Route
          path="/reportes"
          element={<RutaProtegida rolesPermitidos={[3, 4, 5]}><Reportes /></RutaProtegida>}
        />
        <Route path="*" element={<Navigate to="/panel" replace />} />
      </Routes>
    </>
  )
}
