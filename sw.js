// Service worker (solo modalità locale / PWA): app disponibile offline. Non viene mai registrato quando c'è il server di gioco.
// Cache versionata: il valore di BUILD è sostituito da tools/prepara-statico.js con versione + impronta dei file.
// Strategia: cache first con aggiornamento in background; una nuova versione resta in attesa finché l'utente non conferma.
const BUILD = '1.16.3-03839d17';
const CACHE = '4ad-' + BUILD;
const BASE = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css', 'js/main.js',
  'vendor/three/three.module.min.js', 'vendor/cannon-es/cannon-es.js', 'icone/icona-192.png', 'icone/icona-512.png'];
const url = p => new URL(p, self.registration.scope).href;
const INDEX = url('index.html');

async function precarica() {
  const c = await caches.open(CACHE);
  await c.addAll(BASE.map(p => new Request(url(p), { cache: 'reload' })));   // indispensabili: se mancano l'installazione fallisce
  let altri = [];
  try { const r = await fetch(url('elenco-file.json'), { cache: 'no-store' }); if (r.ok) altri = (await r.json()).file || []; } catch { /* nessun elenco: si impara a mano a mano */ }
  await Promise.all(altri.map(p => c.add(new Request(url(p), { cache: 'reload' })).catch(() => {})));   // il resto è «al meglio»
}
self.addEventListener('install', e => e.waitUntil(precarica()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('4ad-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

async function rispondi(req) {
  const c = await caches.open(CACHE);
  const chiave = req.mode === 'navigate' ? INDEX : req;
  const salvata = await c.match(chiave, { ignoreSearch: true });
  const rete = fetch(req.mode === 'navigate' ? INDEX : req.url, { cache: 'no-cache' }).then(r => { if (r.ok && r.status === 200) c.put(chiave, r.clone()); return r; });
  if (salvata) { rete.catch(() => {}); return salvata; }   // aggiornamento in background, risposta subito dalla cache
  return rete;
}
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin || u.pathname.includes('/api/')) return;
  if (u.pathname.endsWith('/sw.js') || u.pathname.endsWith('/elenco-file.json')) return;
  e.respondWith(rispondi(r).catch(() => Response.error()));
});
