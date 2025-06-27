const CACHE_NAME = 'hacienda-hansen-control-v2.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  'https://i.ibb.co/mCDdH6wt/logo.jpg',
  '/logos/logo2-180.png',
  '/logos/logo2-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request).catch(() => caches.match('/index.html')))
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.filter(name => !cacheWhitelist.includes(name)).map(name => caches.delete(name))
    ))
  );
  self.clients.claim();
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-actions') {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions() {
  try {
    const pendingActions = JSON.parse(localStorage.getItem('pendingActions') || '[]');
    if (pendingActions.length === 0) return;

    const res = await fetch('https://api.jsonbin.io/v3/b/6859f6548a456b7966b466c6/latest', {
      headers: { 'X-Master-Key': '$2a$10$CJN48O6SvqnObn0Z0zy0j.Vronnf/8J5ntOTNT5f4ZMhCsRguKcNe' }
    });
    const data = await res.json();
    let actuales = data.record || [];

    for (const action of pendingActions) {
      if (action.action === 'cancel') {
        const { nombre, fecha } = action.data;
        actuales = actuales.filter(r => r.nombre !== nombre);
        actuales.push({ nombre, fecha, totalHoras: 0 });
      } else if (action.action === 'delete') {
        const { nombre } = action.data;
        actuales = actuales.filter(r => r.nombre !== nombre);
      }
    }

    const putRes = await fetch('https://api.jsonbin.io/v3/b/6859f6548a456b7966b466c6', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': '$2a$10$CJN48O6SvqnObn0Z0zy0j.Vronnf/8J5ntOTNT5f4ZMhCsRguKcNe'
      },
      body: JSON.stringify(actuales)
    });

    if (putRes.ok) {
      localStorage.setItem('cachedRegistros', JSON.stringify(actuales));
      localStorage.removeItem('pendingActions');
      self.registration.showNotification('Hacienda Hansen', {
        body: 'Acciones pendientes sincronizadas correctamente',
        icon: 'https://i.ibb.co/mCDdH6wt/logo.jpg',
        badge: 'https://i.ibb.co/mCDdH6wt/logo.jpg'
      });
    }
  } catch (error) {
    console.error('Error en sincronización:', error);
  }
}