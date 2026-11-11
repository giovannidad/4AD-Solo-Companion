// Tutti i tiri passano da qui: dadi fisici sul tavolo 3D (con ripiego virtuale se disattivati).
import * as table from './table3d.js';
import { d6 } from './util.js';

export const settings = { fisici: true };
export const storico = [];
const ascoltatori = new Set();
export const onRoll = fn => { ascoltatori.add(fn); return () => ascoltatori.delete(fn); };
let tableReady = false;
export const tableIsReady = () => { tableReady = true; };

async function fisici(n, colori) {
  if (n <= 0) return [];
  if (!settings.fisici || !tableReady || n > 10 || document.hidden) return Array.from({ length: n }, d6);
  try { return await table.rollDice(Array.from({ length: n }, (_, i) => ({ colore: colori?.[i] }))); }
  catch (e) { console.error('dadi 3D', e); return Array.from({ length: n }, d6); }
}

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
    const raw = (facce === 6 || facce === 3) ? await fisici(n, [i === 0 ? 'avorio' : 'rosso', i === 0 ? 'avorio' : 'rosso', 'avorio', 'avorio'])
      : Array.from({ length: n }, () => Math.floor(Math.random() * facce) + 1);   // d8 ecc.: dadi virtuali
    dadi.push(...raw);
    const somma = raw.reduce((a, v) => a + (usaD3 ? Math.ceil(v / 2) : v), 0);
    valori.push(somma + bonus);
  }
  const totale = valori.reduce((a, v) => a * v);
  return registra({ label, expr, totale, dadi, ora: Date.now() });
}

/** d66: primo dado = decine (rosso), secondo = unità (avorio). */
export async function d66(label = 'd66') {
  const [a, b] = await fisici(2, ['rosso', 'avorio']);
  return registra({ label, expr: 'd66', totale: a * 10 + b, dadi: [a, b], ora: Date.now() });
}

/** 1d6 semplice. */
export async function dado(label = '1d6', colore) {
  const [v] = await fisici(1, [colore]);
  return registra({ label, expr: '1d6', totale: v, dadi: [v], ora: Date.now() });
}
export async function dadi2(label = '2d6') { return tira('2d6', label); }

/** d6 con regola del 6 esplosivo. Restituisce {totale, naturale, tiri}. */
export async function d6Esplosivo(label = '1d6') {
  const tiri = [];
  let v;
  do { [v] = await fisici(1, ['avorio']); tiri.push(v); } while (v === 6 && tiri.length < 8);
  registra({ label: tiri.length > 1 ? `${label} (6 esplosivo!)` : label, expr: '1d6!', totale: tiri.reduce((a, b) => a + b, 0), dadi: tiri, ora: Date.now() });
  return { totale: tiri.reduce((a, b) => a + b, 0), naturale: tiri[0], tiri };
}

/** Tira N dadi e tieni il migliore (attacco furioso). */
export async function migliorDi(n, label) {
  const raw = await fisici(n, ['rosso', 'rosso', 'rosso']);
  const best = Math.max(...raw);
  registra({ label: `${label} (migliore di ${n})`, expr: `${n}d6 max`, totale: best, dadi: raw, ora: Date.now() });
  return { totale: best, naturale: best, tiri: raw };
}
