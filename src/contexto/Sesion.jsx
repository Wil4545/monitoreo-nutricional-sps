import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, configurado } from '../lib/supabase.js'

const Ctx = createContext(null)

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!configurado) { setCargando(false); return }

    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sesion?.user) { setPerfil(null); return }
    supabase
      .from('usuario')
      .select('id, nombre, rol_id, comunidad_id, rol(codigo, nombre)')
      .eq('id', sesion.user.id)
      .maybeSingle()
      .then(({ data }) => setPerfil(data))
  }, [sesion])

  const salir = () => supabase?.auth.signOut()

  return (
    <Ctx.Provider value={{ sesion, perfil, cargando, salir }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSesion = () => useContext(Ctx)
