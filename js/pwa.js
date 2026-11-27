// Modalità locale (senza server di gioco): service worker per l'uso offline e avviso di aggiornamento.
// In modalità server (PC, Electron) il service worker NON viene registrato e se ne eventualmente rimasto uno viene tolto.
import { h, toast } from './util.js';

const haSw = 'serviceWorker' in navigator;

/** Modalità server: elimina un eventuale service worker (e le sue cache) lasciato da una prova in modalità locale sulla stessa origine. */
export async function pulisciSw() {
  if (!haSw || !window.caches) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    for (const k of await caches.keys()) if (k.startsWith('4ad-')) await caches.delete(k);
  } catch { /* ok */ }
}

/** Modalità locale: registra sw.js (percorso relativo, vale anche in sottocartella) e propone di ricaricare quando c'è una versione nuova. */
export async function registraSw() {
  if (!haSw) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    const avvisa = nuovo => {
      if (!navigator.serviceWorker.controller) return;   // prima installazione: niente da aggiornare
      const barra = h('div', { class: 'toast warn', style: 'pointer-events:auto' }, 'Aggiornamento disponibile, ricarica. ',
        h('button', { onclick: () => nuovo.postMessage('skipWaiting') }, 'Ricarica'));
      let box = document.getElementById('toasts');
      if (!box) { box = h('div', { id: 'toasts' }); document.body.append(box); }
      box.append(barra);
    };
    if (reg.waiting) avvisa(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nuovo = reg.installing;
      nuovo?.addEventListener('statechange', () => { if (nuovo.state === 'installed') avvisa(nuovo); });
    });
    let ricarica = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!ricarica) { ricarica = true; location.reload(); } });
    reg.update().catch(() => {});
  } catch (e) { console.warn('service worker', e); }
}

export function avvisoLocale() { toast('Salvataggio sul dispositivo (memoria del browser)'); }
