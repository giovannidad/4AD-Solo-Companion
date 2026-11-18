// Gesti al tocco sulla mappa, senza toccare map2d.js: la mappa gestisce già un dito (trascina = sposta, tocco = clic su stanza/personaggio).
// Qui si aggiungono: pizzico con due dita = zoom, doppio tocco = adatta (o doppio clic su una stanza, come con il mouse).
// Lo zoom passa dalla rotellina «sintetica» della mappa (centrata tra le due dita); gli eventi che genera questo modulo (flag `interno`) non vengono ri-elaborati.
const host = document.getElementById('mapView');
const dita = new Map();            // pointerId -> {x, y}
let dist0 = 0, pizzicando = false;
let inizio = null, ultimoTap = null, ultimoTocco = 0, interno = false;

const tela = () => host.querySelector('canvas');
const tocco = ev => !interno && ev.pointerType === 'touch';
const invia = ev => { const t = tela(); if (!t) return; interno = true; try { t.dispatchEvent(ev); } finally { interno = false; } };
const coppia = () => { const [a, b] = [...dita.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };

function zoom(fattore, x, y) {   // la mappa usa exp(-deltaY * 0.0012) e mantiene fermo il punto sotto le dita
  if (!isFinite(fattore) || fattore <= 0) return;
  invia(new WheelEvent('wheel', { deltaY: -Math.log(fattore) / 0.0012, clientX: x, clientY: y, bubbles: true, cancelable: true }));
}

if (host) {
  host.addEventListener('pointerdown', ev => {
    if (!tocco(ev)) return;
    ultimoTocco = Date.now();
    dita.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (dita.size === 1) { inizio = { x: ev.clientX, y: ev.clientY, t: Date.now(), mosso: false }; return; }
    // seconda dita: la mappa non deve vederla; si annulla l'eventuale trascinamento del primo dito e si parte con lo zoom
    ev.stopPropagation();
    if (!pizzicando) { pizzicando = true; inizio = null; ultimoTap = null; invia(new PointerEvent('pointercancel', { pointerId: ev.pointerId, pointerType: 'touch', bubbles: true })); }
    dist0 = coppia().d;
  }, true);

  host.addEventListener('pointermove', ev => {
    if (!tocco(ev) || !dita.has(ev.pointerId)) return;
    dita.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (inizio && Math.hypot(ev.clientX - inizio.x, ev.clientY - inizio.y) > 10) inizio.mosso = true;
    if (!pizzicando) return;
    ev.stopPropagation();
    if (dita.size < 2) return;
    const c = coppia(); if (dist0 > 0) zoom(c.d / dist0, c.x, c.y); dist0 = c.d;
  }, true);

  const fine = ev => {
    if (!tocco(ev) || !dita.has(ev.pointerId)) return;
    dita.delete(ev.pointerId); ultimoTocco = Date.now();
    if (pizzicando) { ev.stopPropagation(); if (!dita.size) { pizzicando = false; dist0 = 0; } return; }
    // tocco breve e fermo: due di seguito = doppio tocco
    if (ev.type === 'pointerup' && inizio && !inizio.mosso && Date.now() - inizio.t < 300) {
      const t = { x: ev.clientX, y: ev.clientY, quando: Date.now() };
      if (ultimoTap && t.quando - ultimoTap.quando < 350 && Math.hypot(t.x - ultimoTap.x, t.y - ultimoTap.y) < 30) {
        ultimoTap = null;
        invia(new MouseEvent('dblclick', { clientX: t.x, clientY: t.y, bubbles: true, cancelable: true }));   // come il doppio clic: «adatta» sul foglio, entra nella stanza
      } else ultimoTap = t;
    } else ultimoTap = null;
    inizio = null;
  };
  host.addEventListener('pointerup', fine, true);
  host.addEventListener('pointercancel', fine, true);

  // il doppio clic «vero» generato dal browser dopo due tocchi è già coperto qui sopra: va ignorato per non eseguirlo due volte
  host.addEventListener('dblclick', ev => { if (!interno && Date.now() - ultimoTocco < 800) ev.stopPropagation(); }, true);
  // vecchi Safari: il pizzico farebbe ingrandire tutta la pagina
  ['gesturestart', 'gesturechange'].forEach(t => host.addEventListener(t, ev => ev.preventDefault()));
}
