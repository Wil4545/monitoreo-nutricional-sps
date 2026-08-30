import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSesion } from './contexto/Sesion.jsx'
import { Cargando } from './componentes/Interfaz.jsx'
import Ingreso from './paginas/Ingreso.jsx'
import Panel from './paginas/Panel.jsx'
import ListaPacientes from './paginas/ListaPacientes.jsx'
import NuevoPaciente from './paginas/NuevoPaciente.jsx'
import FichaPaciente from './paginas/FichaPaciente.jsx'
import NuevaMedicion from './paginas/NuevaMedicion.jsx'
import Auditoria from './paginas/Auditoria.jsx'
import Demostracion from './paginas/Demostracion.jsx'

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
    <Routes>
      <Route path="/" element={<Navigate to="/panel" replace />} />
      <Route path="/panel" element={<Panel />} />
      <Route path="/pacientes" element={<ListaPacientes />} />
      <Route path="/pacientes/nuevo" element={<NuevoPaciente />} />
      <Route path="/pacientes/:id" element={<FichaPaciente />} />
      <Route path="/pacientes/:id/medicion" element={<NuevaMedicion />} />
      <Route path="/auditoria" element={<Auditoria />} />
      <Route path="*" element={<Navigate to="/panel" replace />} />
    </Routes>
  )
}
