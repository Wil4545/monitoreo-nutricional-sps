// Service Worker — RNF-07 (instalabilidad como PWA)
//
// Alcance deliberadamente acotado: cachea el cascarón de la aplicación
// (HTML, JS, CSS, fuentes, iconos) para que el navegador pueda instalarla
// y para que abra más rápido en una conexión intermitente. NO cachea
// datos de Supabase ni implementa cola de escritura sin conexión — eso
// es RF-11/RF-12 (operación offline + sincronización), que quedó fuera
// de esta entrega por su riesgo técnico (ver README, "Pendiente para la
// próxima entrega"). Sin este Service Worker, un navegador no ofrece
// instalar la app aunque tenga manifest.webmanifest.

const CACHE = 'monitoreo-nutricional-cascaron-v1'

const CASCARON = [
  '/',
  '/panel',
  '/manifest.webmanifest',
  '/icono-192.png',
  '/icono-512.png',
]

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CASCARON))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const { request } = evento
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Las llamadas a Supabase (API/auth) nunca se sirven desde caché: los
  // datos clínicos siempre deben venir de la fuente. Solo se cachea lo
  // que sirve la misma app (mismo origen).
  if (url.origin !== self.location.origin) return

  evento.respondWith(
    caches.match(request).then((enCache) => {
      const redFetch = fetch(request)
        .then((respuesta) => {
          if (respuesta.ok) {
            const copia = respuesta.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copia))
          }
          return respuesta
        })
        .catch(() => enCache)

      // Cache-first para lo ya guardado (carga instantánea); si no está
      // en caché, se espera la red.
      return enCache || redFetch
    }),
  )
})
