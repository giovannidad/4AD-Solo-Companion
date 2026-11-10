// Tratti e traguardi del supplemento «Contro il Caos» (regole opzionali).
import { R, S, log, modificato } from './state.js';
import { d66, tira } from './dice.js';
import { h, toast, scelta } from './util.js';

const ha = (e, id) => (e.tratti || []).some(t => t.id === id);
export const haTratto = ha;

function applicaImmediato(e, t) {
  if (t.id === 'vitalita') { e.pvMax++; e.pv++; log(`${e.nome}: +1 PV permanente (Incredibile vitalità).`); }
  if (t.id === 'folle') e.follia = Math.max(1, e.follia || 0);
}

/** Tira un tratto (d66): con 66 si sceglie fra due tratti o un tratto raro. */
export async function tiraTratto(e, { profondita = 0 } = {}) {
  const tab = R.tratti.tratti;
  const aggiungi = (t) => {
    if (ha(e, t.id)) return false;
    (e.tratti = e.tratti || []).push({ id: t.id, nome: t.nome, testo: t.testo });
    applicaImmediato(e, t); log(`${e.nome} ottiene il tratto «${t.nome}».`); return true;
  };
  const un = async () => {
    for (let k = 0; k < 20; k++) {
      const r = await d66('Tratto (d66)'); const t = tab.find(x => x.d66 === r.totale) || tab[0];
      if (t.id === 'doppi') { if (profondita > 0) continue; return t; }
      if (!ha(e, t.id)) return t;
    }
    return tab[0];
  };
  const t = await un();
  if (t.id !== 'doppi') { aggiungi(t); modificato('party'); return; }
  const s = await scelta('Tratti doppi o tratti rari', 'Che cosa scegli?', [['doppi', 'Due tratti dalla lista'], ['raro', 'Un tratto raro (d8)']]);
  if (s === 'raro') await tiraRaro(e, aggiungi);
  else for (let k = 0; k < 2; k++) aggiungi(await un());
  modificato('party');
}
async function tiraRaro(e, aggiungi, profondita = 0) {
  const tab = R.tratti.rari;
  for (let k = 0; k < 20; k++) {
    const x = await tira8();
    const t = tab.find(r => r.d8 === x);
    if (t.id === 'dotato') { if (profondita > 0) continue; await tiraRaro(e, aggiungi, 1); await tiraRaro(e, aggiungi, 1); return; }
    if (aggiungi(t)) return;
  }
}
const tira8 = async () => (await tira('1d8', 'Tratto raro (d8)')).totale;

export async function tiraTraguardo(e) {
  const r = await d66('Traguardo (d66)');
  const t = R.traguardi.traguardi.find(x => x.d66 === r.totale) || R.traguardi.traguardi[0];
  assegnaTraguardo(e, t);
}
export function assegnaTraguardo(e, t) {
  const max = ha(e, 'eclettico') ? 2 : 1;
  e.traguardi = e.traguardi || [];
  if (e.traguardi.length >= max) { toast(`${e.nome} ha già ${max === 1 ? 'un traguardo' : 'due traguardi'} in corso.`, 'warn'); return; }
  e.traguardi.push({ id: t.id, nome: t.nome, obiettivo: t.obiettivo, unita: t.unita, testo: t.testo, effetto: t.effetto || null, conta: 0 });
  log(`${e.nome} sceglie il traguardo «${t.nome}».`); modificato('party');
}
export function conta(e, k, d) {
  const t = e.traguardi[k]; t.conta = Math.max(0, t.conta + d);
  if (t.conta >= t.obiettivo) {
    log(`${e.nome} completa il traguardo «${t.nome}»! ${t.testo}`);
    if (t.effetto?.pvMax) { e.pvMax += t.effetto.pvMax; e.pv += t.effetto.pvMax; }
    e.completati = [...(e.completati || []), t.nome];
    e.traguardi.splice(k, 1);
    toast(`Traguardo completato: ${t.nome}`);
  }
  modificato('party');
}

/** Sezione della scheda eroe. */
export function sezione(e, rinfresca) {
  const box = h('div', { class: 'tratti' });
  const draw = () => {
    box.replaceChildren(h('h4', {}, 'Tratti'));
    (e.tratti || []).forEach((t, k) => box.append(h('div', { class: 'row' }, h('span', { class: 'grow', title: t.testo }, h('b', {}, t.nome), ' – ', t.testo),
      h('button', { class: 'mini', onclick: () => { e.tratti.splice(k, 1); modificato('party'); rinfresca(); } }, '×'))));
    if (!(e.tratti || []).length) box.append(h('small', {}, 'Nessun tratto.'));
    box.append(h('div', { class: 'row' }, h('button', { onclick: async () => { await tiraTratto(e); rinfresca(); } }, 'Tira un tratto (d66)')));
    box.append(h('h4', {}, 'Traguardi'));
    (e.traguardi || []).forEach((t, k) => box.append(h('div', { class: 'card' }, h('b', {}, t.nome), h('p', { class: 'hint' }, t.testo),
      h('div', { class: 'row' }, h('span', { class: 'grow' }, `${t.conta}/${t.obiettivo} ${t.unita}`),
        h('button', { class: 'mini', onclick: () => { conta(e, k, -1); rinfresca(); } }, '−'), h('button', { class: 'mini', onclick: () => { conta(e, k, 1); rinfresca(); } }, '+'),
        h('button', { class: 'mini', onclick: () => { conta(e, k, 10); rinfresca(); } }, '+10'),
        h('button', { class: 'mini', onclick: () => { e.traguardi.splice(k, 1); modificato('party'); rinfresca(); } }, '×')))));
    if ((e.completati || []).length) box.append(h('p', { class: 'hint' }, `Completati: ${e.completati.join(', ')}`));
    const sel = h('select', {}, R.traguardi.traguardi.map(t => h('option', { value: t.id }, t.nome)));
    box.append(h('div', { class: 'row' }, sel,
      h('button', { onclick: () => { assegnaTraguardo(e, R.traguardi.traguardi.find(t => t.id === sel.value)); rinfresca(); } }, 'Scegli'),
      h('button', { onclick: async () => { await tiraTraguardo(e); rinfresca(); } }, 'Tira (d66)')));
  };
  draw();
  return box;
}
