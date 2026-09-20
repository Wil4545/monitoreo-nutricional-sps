import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ProveedorSesion } from './contexto/Sesion.jsx'
import './estilos.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </BrowserRouter>
  </React.StrictMode>,
)

// RNF-07 — registra el Service Worker que hace instalable la app.
// Solo en producción: en `vite dev` el hot-reload y el SW compiten por
// servir los mismos archivos y termina mostrando versiones viejas.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('No se pudo registrar el Service Worker:', err.message)
    })
  })
}
