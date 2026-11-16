// Tutti i tiri passano da qui: dadi fisici sul tavolo 3D (con ripiego virtuale se disattivati).
let table = null;                       // modulo del tavolo 3D (three.js + cannon-es), caricato solo quando serve
import { d6 } from './util.js';

export const settings = { fisici: true, veloci: true };
try { const v = localStorage.getItem('fad-veloci'); if (v !== null) settings.veloci = v === '1'; } catch { /* predefinito */ }
export function setVeloci(on) { settings.veloci = !!on; try { localStorage.setItem('fad-veloci', on ? '1' : '0'); } catch { /* ok */ } }
/** Tiri che meritano i dadi 3D anche in modalità «tiri veloci»: attacchi, difese, salvezze, incantesimi, nuova stanza e tiri liberi.
 *  Tutti gli altri (numero di mostri, tabelle, morale, ricchezza, perquisizioni…) sono immediati. */
const PRINCIPALE = /^(Attacco|Difesa|Nuova stanza|Tiro libero|Prova dadi|Furtivit|Boss finale|Sonno|Palla di Fuoco|Fulmine Magico|Protezione|Benedizione|Fuga|Illusione|Missile|Bacio|Scarica Oculare|Occhio del Terrore|Distruggi)|\(L\d+\)/i;
export const storico = [];
const ascoltatori = new Set();
export const onRoll = fn => { ascoltatori.add(fn); return () => ascoltatori.delete(fn); };
let tableReady = false;
export const tableIsReady = () => { tableReady = true; };
/** Collega il tavolo 3D appena il modulo è stato caricato: finché non c'è, i tiri sono virtuali. */
export function collegaTavolo(modulo) { table = modulo; tableReady = true; }

async function fisici(n, colori, label = '') {
  if (n <= 0) return [];
  if (!settings.fisici || !tableReady || n > 10 || document.hidden || (settings.veloci && !PRINCIPALE.test(label))) return Array.from({ length: n }, d6);
  try { return await table.rollDice(Array.from({ length: n }, (_, i) => ({ colore: colori?.[i] }))); }
  catch (e) { console.error('dadi 3D', e); return Array.from({ length: n }, d6); }
}

/** Un tiro fatto dall'ospitante, mostrato sul registro dei dadi degli ospiti. */
export function iniettaTiro(rec) { storico.unshift(rec); if (storico.length > 60) storico.pop(); ascoltatori.forEach(f => f(rec)); }

function registra(rec) {
  storico.unshift(rec); if (storico.length > 60) storico.pop();
  ascoltatori.forEach(f => f(rec));
  return rec;
}

/** Valuta un'espressione tipo "3d6", "1d6+3", "2d6x5", "3d6x3d6", "1d3+1". */
export async function tira(expr, label = '') {
  const fattori = String(expr).replace(/\s/g, '').toLowerCase().split('x');
  const valori = [], dadi = [];
  for (let i = 0; i < fattori.length; i++) {
    const m = fattori[i].match(/^(\d+)(?:d(\d+))?([+-]\d+)?$/);
    if (!m) throw new Error(`Espressione dadi non valida: ${expr}`);
    if (!m[2]) { valori.push(+m[1]); continue; }
    const n = +m[1], facce = +m[2], bonus = +(m[3] || 0);
    const usaD3 = facce === 3;
    const raw = (facce === 6 || facce === 3) ? await fisici(n, [i === 0 ? 'avorio' : 'rosso', i === 0 ? 'avorio' : 'rosso', 'avorio', 'avorio'], label)
      : Array.from({ length: n }, () => Math.floor(Math.random() * facce) + 1);   // d8 ecc.: dadi virtuali
    dadi.push(...raw);
    const somma = raw.reduce((a, v) => a + (usaD3 ? Math.ceil(v / 2) : v), 0);
    valori.push(somma + bonus);
  }
  const totale = valori.reduce((a, v) => a * v);
  return registra({ label, expr, totale, dadi, ora: Date.now() });
}

/** Valore massimo (o minimo) possibile di un'espressione come quelle di tira(): "3d6x30" → 540. */
export function estremo(expr, massimo = true) {
  return String(expr).replace(/\s/g, '').toLowerCase().split('x').reduce((tot, f) => {
    const m = f.match(/^(\d+)(?:d(\d+))?([+-]\d+)?$/); if (!m) return tot;
    const v = m[2] ? +m[1] * (massimo ? +m[2] : 1) + +(m[3] || 0) : +m[1];
    return tot === null ? v : tot * v;
  }, null) ?? 0;
}

/** d66: primo dado = decine (rosso), secondo = unità (avorio). */
export async function d66(label = 'd66') {
  const [a, b] = await fisici(2, ['rosso', 'avorio'], label);
  return registra({ label, expr: 'd66', totale: a * 10 + b, dadi: [a, b], ora: Date.now() });
}

/** 1d6 semplice. */
export async function dado(label = '1d6', colore) {
  const [v] = await fisici(1, [colore], label);
  return registra({ label, expr: '1d6', totale: v, dadi: [v], ora: Date.now() });
}
export async function dadi2(label = '2d6') { return tira('2d6', label); }

/** d6 con regola del 6 esplosivo. Restituisce {totale, naturale, tiri}. */
export async function d6Esplosivo(label = '1d6') {
  const tiri = [];
  let v;
  do { [v] = await fisici(1, ['avorio'], label); tiri.push(v); } while (v === 6 && tiri.length < 8);
  registra({ label: tiri.length > 1 ? `${label} (6 esplosivo!)` : label, expr: '1d6!', totale: tiri.reduce((a, b) => a + b, 0), dadi: tiri, ora: Date.now() });
  return { totale: tiri.reduce((a, b) => a + b, 0), naturale: tiri[0], tiri };
}

/** Tira N dadi e tieni il migliore (attacco furioso); con `facce` = 8 usa il d8 (virtuale, non 3D). */
export async function migliorDi(n, label, facce = 6) {
  const raw = facce === 8 ? Array.from({ length: n }, d8) : await fisici(n, ['rosso', 'rosso', 'rosso'], label);
  const best = Math.max(...raw);
  registra({ label: `${label} (migliore di ${n}${facce === 8 ? ', d8' : ''})`, expr: `${n}d${facce} max`, totale: best, dadi: raw, ora: Date.now() });
  return { totale: best, naturale: best, tiri: raw };
}

// ---------------- d8 (supplemento «Contro l'Abisso») ----------------
// Il d8 non ha una versione tridimensionale: si tira in modo virtuale e il registro/il riquadro dei risultati lo segnalano con «d8».
export const d8 = () => Math.floor(Math.random() * 8) + 1;
/** 1d8 semplice (mostrato come d8 nel registro dei dadi). */
export async function dado8(label = '1d8') {
  const v = d8();
  return registra({ label: `${label} [d8]`, expr: '1d8', totale: v, dadi: [v], ora: Date.now() });
}
/** d8 con regola dell'esplosione: con 7 o 8 si tira ancora e si somma. Restituisce {totale, naturale, tiri}. */
export async function d8Esplosivo(label = '1d8') {
  const tiri = [];
  let v;
  do { v = d8(); tiri.push(v); } while (v >= 7 && tiri.length < 8);
  const totale = tiri.reduce((a, b) => a + b, 0);
  registra({ label: `${label} [d8${tiri.length > 1 ? ', esplosivo!' : ''}]`, expr: '1d8!', totale, dadi: tiri, ora: Date.now() });
  return { totale, naturale: tiri[0], tiri };
}
