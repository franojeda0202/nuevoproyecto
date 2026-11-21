// Service worker mínimo: alcanza para que la app sea instalable.
// Sin caché offline a propósito: una sesión de entrenamiento guarda cada
// serie en Supabase, y servir pantallas viejas sin red haría creer que se
// guardó algo que no se guardó.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Siempre a la red.
})
