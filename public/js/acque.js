// Supplementi «Acque Oscure e Altre Avventure» (livelli 1-4) e «Caverne degli Schiavisti Coboldi» (livelli 1-2):
// set di tabelle, poteri dei mostri, classe Spadaccino, oggetti magici acquatici, acqua santa e regole generali.
// Lo stato di gioco sta in S.adv (adv.acque) e S.party (eroi): qui ci sono solo le regole. I poteri dei mostri stanno in inc.qx.
import { R, S, log, modificato, eroiVivi, eroiAttivi, eroePerId, ordineMarcia, nuovoEroe } from './state.js';
import { dado, tira } from './dice.js';
import { riga, tabella, mostriTabella, creaIncontro, inAcque, inCoboldi, acqueAttive, modAttacco, modDifesa, comeFurfante } from './rules.js';
import { h, modal, toast, scelta, uid } from './util.js';
import * as G from './game.js';
import * as C from './combat.js';
import * as K from './caos.js';
import * as A from './abisso.js';
import * as V from './silvani.js';

const adv = () => S.adv;
const casuale = arr => arr[Math.floor(Math.random() * arr.length)];
const stato = () => (adv().acque = adv().acque || {});
const vivi = () => ordineMarcia().filter(e => e.stato === 'ok');
const mezzo = e => Math.floor(e.livello / 2);
const bottino = o => { (adv().bottino = adv().bottino || []).push({ id: uid(), ...o }); };
const oroGruppo = () => eroiVivi().reduce((a, e) => a + (e.oro || 0), 0);
const prendiOro = q => { let resto = q; for (const x of [...eroiVivi()].sort((a, b) => (b.oro || 0) - (a.oro || 0))) { const k = Math.min(x.oro || 0, resto); x.oro = (x.oro || 0) - k; resto -= k; if (!resto) break; } return q - resto; };
const oggetto = (e, re) => (e.oggetti || []).find(o => re.test(o.nome || ''));
const consuma = (e, o) => { if ((o.qta || 1) > 1) o.qta--; else e.oggetti = (e.oggetti || []).filter(x => x !== o); };

// =============================================================
//  REGOLE GENERALI DEI DUE SET
// =============================================================
/** Due o più personaggi di 3° livello: erranti con 2 su 1d6 e +1 a tutti i mostri seguaci (avventure di livello 1-2). */
export const regolaLivello3 = () => (inAcque() || inCoboldi()) && S.party.eroi.filter(e => e.stato !== 'morto' && !e.merc && !e.png && e.livello === 3).length >= 2;
export const sogliaErranti = () => (regolaLivello3() ? 2 : 1);
export const piuSeguaci = () => (regolaLivello3() ? 1 : 0);

/** Bonus di un tiro salvezza descritti nei dati ({armaturaPesante: -2, mezzuomo: 1, mago: 'L', ...}). */
function bonusDa(e, b = {}) {
  let t = 0;
  for (const [k, v] of Object.entries(b)) {
    const val = v === 'L' ? e.livello : v === '1/2L' ? mezzo(e) : +v;
    const ok = k === 'armaturaPesante' ? e.armatura === 'pesante' : k === 'armaturaLeggera' ? e.armatura === 'leggera' : k === 'scudo' ? !!e.scudo : k === 'furfante' ? comeFurfante(e) : e.classe === k;
    if (ok) t += val;
  }
  return t;
}

// =============================================================
//  TABELLE DEL SET ACQUATICO
// =============================================================
export async function caratteristica(row) {
  const st = stato();
  switch (row.azione) {
    case 'bonus-difesa': {
      const e = await K.eroeScelto('Barriera corallina incantata', x => x.stato === 'ok'); if (!e) return row.testo;
      e.barriera = true; modificato('party'); return `${e.nome} ha +1 in difesa nel prossimo scontro (poi il bonus svanisce).`;
    }
    case 'ostriche': {
      if (await scelta('Letto di ostriche', row.testo, [['esamina', 'Esamina le ostriche'], ['ignora', 'Ignora le ostriche']]) !== 'esamina') return 'Le ostriche vengono ignorate.';
      const x = await dado('Ostriche: 1-3 spruzzo velenoso, 4-6 perle');
      if (x.totale <= 3) { await C.salvaTutti('Spruzzo velenoso (veleno)', 3, e => (e.classe === 'mezzuomo' ? 1 : 0), e => C.perdiPV(e, 1, 'spruzzo velenoso')); return 'Spruzzo velenoso: chi ha fallito perde 1 PV.'; }
      const q = (await tira('3d6x10', 'Perle (3d6x10 p.o.)')).totale; bottino({ tipo: 'gemma', testo: `Perle da ${q} p.o.`, valore: q }); return `Perle per ${q} p.o.`;
    }
    case 'armeria': return 'Tutti possono cambiare o sostituire le armi (dalla scheda dell’eroe), entro i limiti della propria classe.';
    case 'cura': {
      if (st.ondata) return 'Un’altra ondata guaritrice: nessun effetto.';
      st.ondata = true; eroiVivi().forEach(e => { if (e.stato === 'ok') { e.pv = Math.min(e.pvMax, e.pv + 1); e.acqueOscure = false; } }); return 'Tutti i feriti recuperano 1 PV (e la maledizione delle acque oscure si spezza).';
    }
    case 'maledizione': {
      const e = casuale(eroiAttivi()); if (!e) return row.testo; e.acqueOscure = true; modificato('party');
      return `${e.nome} è maledetto: -1 ai tiri di attacco finché non riceve un’ondata guaritrice, una guarigione o una Benedizione.`;
    }
    case 'rompicapo': {
      if (await scelta('Scatola rompicapo', row.testo, [['prova', 'Tenta il rompicapo'], ['ignora', 'Ignora la scatola']]) !== 'prova') return 'La scatola viene ignorata.';
      const e = await K.eroeScelto('Chi tenta il rompicapo?', x => x.stato === 'ok'); if (!e) return 'Nessuno tenta il rompicapo.';
      const L = (await tira('1d6', 'Livello della scatola rompicapo (1d6)')).totale;
      for (;;) {
        const r = await C.dE(e, `Rompicapo di L${L} – ${e.nome}`), tot = r.totale + (['mago', 'furfante'].includes(e.classe) ? e.livello : 0);
        if (r.naturale !== 1 && tot >= L) { log(`${e.nome} risolve il rompicapo (${tot} contro L${L}).`); const o = await tesoroMagico(); bottino(o); return `La scatola si apre: ${o.nome}.`; }
        C.perdiPV(e, 1, 'rompicapo fallito');
        if (e.stato !== 'ok' || !(await scelta('Rompicapo', `${e.nome} fallisce (${tot} contro L${L}). Riprovi?`, [[true, 'Riprova'], [false, 'Rinuncia']]))) return 'Il rompicapo resta irrisolto.';
      }
    }
  }
  return row.testo;
}

export async function evento(t) {
  const st = stato();
  for (;;) {
    const row = riga(tabella('eventi'), (await dado('Evento speciale acquatico (d6)')).totale);
    if ((row.azione === 'guaritore' && st.sirena) || (row.azione === 'cavalluccio' && st.cavalluccio !== undefined)) { log(`${row.nome}: già incontrato in questa avventura, si ritira il dado.`); continue; }
    return `${row.nome}: ${await eseguiEvento(row, t)}`;
  }
}
async function eseguiEvento(row, t) {
  const st = stato();
  switch (row.azione) {
    case 'paura': await C.salvaTutti('Squalo fantasma (paura)', 4, e => (e.classe === 'chierico' ? e.livello : 0), e => C.perdiPV(e, 1, 'squalo fantasma')); return 'Chi fallisce perde 1 PV.';
    case 'erranti': {
      const x = await dado('Tipo di errante acquatico (1-3 inf., 4 seg., 5 aber., 6 boss)');
      const i = await G.monstroDa(riga(row.sottotabella, x.totale).tabella, { errante: true }); i.nome += ' (erranti)'; G.avviaIncontro(i, t); return `${i.nome} ×${i.n}`;
    }
    case 'indizio': {
      if (st.elfo) return `l’elfo marino è già stato incontrato: vale come trappola. ${await G.trappola()}`;
      st.elfo = true; const e = casuale(eroiAttivi()); if (e) await G.aggiungiIndizio(e); return `${e?.nome || 'Un personaggio'} riceve 1 indizio.`;
    }
    case 'tabella': return await G.trappola();
    case 'guaritore': st.sirena = true; await sirena(); return 'La sirena cura a 10 p.o. per PV.';
    case 'cavalluccio': st.cavalluccio = 'attivo'; return 'Il cavalluccio accompagna il gruppo fino al prossimo combattimento (usalo dalla scheda dell’incontro).';
  }
  return row.testo;
}
function sirena() {
  return new Promise(res => modal('Sirena guaritrice', (b, close) => {
    const box = h('div', { class: 'list' });
    const mostra = () => {
      box.replaceChildren(h('p', {}, `Oro del gruppo: ${oroGruppo()} p.o. La sirena cura 1 PV ogni 10 p.o.`));
      eroiVivi().filter(e => e.stato === 'ok' && e.pv < e.pvMax).forEach(e => box.append(h('button', { class: 'item-btn', disabled: oroGruppo() < 10, onclick: () => { prendiOro(10); e.pv++; log(`La sirena cura 1 PV a ${e.nome} (10 p.o.).`); modificato('party'); mostra(); } }, h('b', {}, `Cura 1 PV a ${e.nome}`), h('span', {}, `${e.pv}/${e.pvMax} PV · 10 p.o.`))));
      box.append(h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: close }, 'Basta così')));
    };
    mostra(); b.append(box);
  }, { onClose: () => res() }));
}

/** Trappole acquatiche: la riga è in t.riga (1-6), il livello in t.liv. */
export async function risolviTrappola(t) {
  const v = vivi(); if (!v.length) return;
  const n = t.nome, L = t.liv, ferisci = (e, k = 1) => C.perdiPV(e, k, n);
  const difesa = async (e, ctx, extra = 0) => { const r = await C.dE(e, `${n}: difesa di ${e.nome} (L${L})`); const tot = r.totale + modDifesa(e, ctx).tot + extra; const ok = C.esplode(e, r) || (r.naturale !== 1 && tot > L); log(`${n}: ${e.nome} tira ${tot} contro L${L} → ${ok ? 'evita' : 'colpito'}.`); return ok; };
  const salvaBonus = e => (e.classe === 'elfo' || e.classe === 'mezzuomo' ? 1 : 0) + (comeFurfante(e) ? e.livello : 0);
  switch (t.riga) {
    case 1: { const e = v[0]; if (!(await difesa(e, { ignoraArmatura: true }, (e.armatura === 'pesante' ? -2 : 0) + (e.scudo ? -1 : 0)))) ferisci(e); break; }
    case 2: for (const e of v) if (!(await difesa(e, { ignoraArmatura: true }))) ferisci(e); break;
    case 3: for (const e of v.slice(0, 2)) if (!(await C.salva(e, 4, (e.armatura === 'leggera' ? -1 : e.armatura === 'pesante' ? -2 : 0) + salvaBonus(e), `${n} (trappola)`))) ferisci(e); break;
    case 4: {
      let falliti = 0;
      for (const e of v) if (!(await C.salva(e, 5, 0, `${n} (corrente)`))) { falliti++; log(`${e.nome} è spinto indietro di una stanza o corridoio.`); }
      if (falliti && await scelta('Forte corrente', 'C’è una porta di mezzo tra il gruppo e la stanza di prima?', [[true, 'Sì: l’ultimo dell’ordine di marcia ci sbatte contro (1 PV)'], [false, 'No']])) { const u = vivi().at(-1); if (u) ferisci(u); }
      break;
    }
    case 5: { const due = [...v].sort(() => Math.random() - 0.5).slice(0, 2); for (const e of due) if (!(await C.salva(e, L, salvaBonus(e), `${n} (trappola)`))) ferisci(e); break; }
    case 6: {
      const e = casuale(v);
      if (!(await C.salva(e, 5, salvaBonus(e), `${n} (trappola)`))) {
        const voce = R.acque.mostri.infestanti.find(m => m.id === 'q-granchi-giganti'), c = creaIncontro('infestanti', voce, 1);
        Object.assign(c, { solo: e.id, noMorale: true, reazione: { azione: 'combatte', tiro: 0 }, note: `${voce.note} Gabbia: gli altri possono rompere le sbarre (L5; a ogni tentativo 1 su 1d6 di attirare erranti, una volta sola) o il furfante scassinare la serratura (L3).` });
        G.avviaIncontro(c, G.tileById(adv().stanzaCorrente));
        if (adv().incontro === c) await C.inizioScontro();
        toast(`${e.nome} è chiuso nella gabbia con un granchio gigante e lo affronta da solo.`, 'warn');
      }
      break;
    }
  }
  adv().trappolaAttiva = null; modificato();
}

// =============================================================
//  OGGETTI MAGICI ACQUATICI
// =============================================================
export async function tesoroMagico() {
  const row = riga(tabella('tesoriMagici'), (await dado('Tesori magici acquatici (d6)')).totale);
  const base = { tipo: 'magico', nome: row.nome, testo: `${row.nome}: ${row.testo}`, abi: row.id, manuale: false };
  switch (row.id) {
    case 'q-corno-narvalo': return { ...base, cariche: 3, caricheMax: 3, solo: ['elfo', 'mago'] };
    case 'q-lancia-fulmine': return { ...base, cariche: 2, caricheMax: 2, solo: ['mago'], incantesimo: 'Fulmine Magico' };
    case 'q-bacchetta-piovra': return { ...base, cariche: 3, caricheMax: 3 };
    case 'q-alghe-curative': return { ...base, testo: 'Alghe curative (monouso, azione gratuita: curano tutti i PV persi)', valore: 40 };
    case 'q-arma-magica-acquatica': {
      const w = await dado('Tipo di arma magica (1 leggera cont., 2 leggera taglio, 3 una mano cont., 4-5 una mano taglio, 6 arco)');
      const t = ['arma leggera contundente', 'arma leggera da taglio', 'arma a una mano contundente', 'arma a una mano da taglio', 'arma a una mano da taglio', 'arco'][w.totale - 1];
      return { ...base, testo: `Arma magica (${t}) +1 all’attacco. Permanente.`, bonusArma: 1, armaTipo: t };
    }
    case 'q-guscio-conchiglia': return { ...base, cariche: 3, caricheMax: 3 };
  }
  return base;
}

/** Dopo un incontro: gli oggetti esauriti cambiano natura (corno: curiosità da 2d6 p.o.; lancia: arma da taglio a una mano). */
export async function normalizza() {
  for (const e of S.party.eroi) for (const o of e.oggetti || []) {
    if (/corno del narvalo/i.test(o.nome) && o.cariche === 0 && o.tipo === 'magico') { const q = (await tira('2d6', 'Valore del corno esaurito (2d6)')).totale; Object.assign(o, { tipo: 'oggetto', valore: q, nota: `Corno esaurito: curiosità da ${q} p.o.`, nome: 'Corno del narvalo (esaurito)', solo: null }); log(`Il corno del narvalo di ${e.nome} perde i suoi poteri: vale ${q} p.o.`); }
    if (/lancia del fulmine/i.test(o.nome) && o.cariche === 0 && o.incantesimo) { Object.assign(o, { tipo: 'oggetto', nome: 'Arma a una mano da taglio (ex Lancia del Fulmine)', incantesimo: null, cariche: null, solo: null }); log(`La Lancia del Fulmine di ${e.nome} è scarica: ora è un’arma da taglio a una mano.`); }
  }
}

const proveMagiche = async (e, i, etichetta) => {
  const r = await C.d6e(e, `${etichetta} di ${e.nome}`);
  const m = modAttacco(e, { ...C.contestoAttacco(e), incantesimo: true, nomeIncantesimo: etichetta }).tot + (['mago', 'elfo', 'elfo-fuoco'].includes(e.classe) ? 0 : e.livello);
  const tot = r.totale + m; return { ok: r.naturale !== 1 && tot >= i.liv, tot };
};
async function usaCorno(e, o) {
  const i = C.inc(); if (!i || i.stato !== 'combattimento') return toast('Serve un combattimento in corso.', 'warn');
  if ((i.tag || []).includes('non-morto')) return toast('Lo stordimento non ha effetto sui non-morti.', 'warn');
  o.cariche--; i.agito[e.id] = true;
  const x = await proveMagiche(e, i, 'Corno del narvalo');
  if (x.ok) { i.stordito = 1; C.nota(`${e.nome} suona il corno (${x.tot} contro LIV ${i.liv}): ${i.minore ? 'un mostro' : i.nome} non può agire per un turno completo.`); }
  else C.nota(`${e.nome} suona il corno ma manca il bersaglio (${x.tot} contro LIV ${i.liv}).`);
  modificato();
}
async function usaBacchetta(e, o) {
  const i = C.inc(); if (!i || i.stato !== 'combattimento') return toast('Serve un combattimento in corso.', 'warn');
  if (R.acque.oggetti.find(x => x.id === 'q-bacchetta-piovra').nonVale.includes(i.id)) return toast('Il potere non ha effetto su cecaelie, piovre giganti e kraken.', 'warn');
  o.cariche--; i.agito[e.id] = true;
  const x = await proveMagiche(e, i, 'Bacchetta della piovra');
  if (!x.ok) C.nota(`${e.nome} agita la bacchetta ma manca (${x.tot} contro LIV ${i.liv}).`);
  else if (i.minore) { i.avvil = Math.min(i.n, (await tira('1d6', 'Minori avviluppati (1d6 + livello)')).totale + e.livello); C.nota(`${i.avvil} ${i.nome} sono avviluppati: +1 agli attacchi del gruppo contro di loro.`); }
  else { i.avvil = 1; C.nota(`${i.nome} è avviluppato: +1 agli attacchi del gruppo.`); }
  modificato();
}
/** Delfino evocato dal guscio: guerriero di 3° livello con 3 PV, quinto membro del gruppo. */
export async function evocaDelfino(e, o) {
  const st = stato();
  if (eroiVivi().some(x => x.png === 'delfino')) return toast('Il delfino è già con il gruppo.', 'warn');
  if (st.delfinoMorto && adv().stanze - st.delfinoMorto.stanze < 3) return toast(`Il delfino è caduto: tornerà dopo 3 nuove stanze o corridoi (ne mancano ${3 - (adv().stanze - st.delfinoMorto.stanze)}).`, 'warn');
  if (!(o.cariche > 0)) return toast('Il guscio è esaurito.', 'warn');
  o.cariche--; const d = nuovoEroe('guerriero', 'Delfino magico');
  Object.assign(d, { livello: 3, pvMax: 3, pv: 3, png: 'delfino', armi: [], armaPrincipale: null, armatura: 'nessuna', posizione: adv().stanzaCorrente, note: 'Alleato evocato dal guscio di conchiglia: guerriero di 3° livello, quinto membro del gruppo.' });
  S.party.eroi.push(d); S.party.ordine.push(d.id); log(`${e.nome} usa il guscio di conchiglia: compare un delfino magico (guerriero di 3° livello, 3 PV). Cariche rimaste: ${o.cariche}.`); modificato('party');
}

/** Oggetti d'uso fuori dagli scontri (scheda «Oggetti»): alghe curative. */
export function azioniOggetti(e, close) {
  const o = oggetto(e, /alghe curative/i), out = [];
  if (o) out.push(h('button', { onclick: () => { consuma(e, o); e.pv = e.pvMax; log(`${e.nome} mangia le alghe curative: PV al massimo (azione gratuita).`); modificato('party'); close(); } }, 'Mangia le alghe curative (azione gratuita: tutti i PV)'));
  return out;
}

// =============================================================
//  ACQUA SANTA E PATTO DEMONIACO
// =============================================================
export async function acquaSanta(e, o, i) {
  consuma(e, o); i.agito[e.id] = true;
  C.nota(`${e.nome} getta l’acqua santa su ${i.nome}: 1 ferita automatica.`);
  const primo = !i.minore && !i.bonusChierici;
  if (primo) { i.bonusChierici = true; if (eroiAttivi().some(x => x.classe === 'chierico')) C.nota('Un boss demoniaco ferito dall’acqua santa: +1 ad attacco e difesa a tutti i chierici contro di lui fino a fine incontro.'); }
  await C.applicaDanni(1); modificato();
}
export function accettaPatto(i) {
  const st = stato(); st.patto = { stipulato: true, stato: 'attivo' };
  bottino({ tipo: 'oro', testo: '50 pezzi d’oro (patto demoniaco)', valore: 50 });
  i.stato = 'finito'; i.esito = 'patto'; i.tesoroPreso = true;
  C.nota('Patto demoniaco accettato: i demoni lasciano passare il gruppo e danno 50 p.o. Uccidete la prima creatura che non sia un demone o un non-morto e riportatene le spoglie in questa stanza.'); modificato();
}
export function cartaPatto(i, btn) {
  return h('div', { class: 'card' }, h('h4', {}, 'Patto demoniaco'),
    h('p', {}, `${i.nome} propongono un patto: vi lasciano passare e vi danno 50 p.o., ma dovete uccidere la prima creatura incontrata che non sia un demone o un non-morto e riportarne le spoglie in questa stanza. Se fallite, nessuno dei caduti di questa avventura potrà essere resuscitato. Si può stipulare un solo patto.`),
    h('div', { class: 'row wrap' }, btn('Accetta il patto (+50 p.o.)', () => accettaPatto(i), 'primary'), btn('Rifiuta e combatti', () => { i.mostriPrima = true; return C.inizioScontro(); }, 'danger')));
}
/** Nuovo incontro: dopo un patto la prima creatura non demoniaca e non morta diventa la preda. */
export function nuovoIncontro(inc) {
  inc.qid = inc.qid || uid();
  const p = stato().patto; if (!p || p.stato !== 'attivo') return;
  const t = inc.tag || []; if (t.includes('demone') || t.includes('non-morto')) return;
  p.stato = 'caccia'; inc.pattoBersaglio = true; log(`Patto demoniaco: la preda è ${inc.nome}; va uccisa e le sue spoglie riportate ai demoni.`);
}
function pattoFallito() {
  const p = stato().patto; if (!p || p.stato === 'fallito' || p.stato === 'onorato') return;
  p.stato = 'fallito'; log('Patto demoniaco fallito: i caduti di questa avventura non possono essere resuscitati.');
  S.party.eroi.forEach(e => { if (e.stato === 'morto' && e.mortoAvv === adv().numero) e.nonResuscitabile = true; }); modificato('party');
}
export function carta(btn) {
  const st = stato(), p = st.patto, out = [];
  const gusci = eroiVivi().map(e => [e, oggetto(e, /guscio di conchiglia/i)]).filter(([, o]) => o);
  gusci.forEach(([e, o]) => out.push(btn(`Guscio di conchiglia (${e.nome}, ${o.cariche}): evoca il delfino`, () => evocaDelfino(e, o))));
  if (st.cavalluccio === 'attivo') out.push(h('small', { class: 'hint' }, 'Il cavalluccio marino gigante accompagna il gruppo fino al prossimo combattimento.'));
  if (p) out.push(h('p', { class: 'hint' }, `Patto demoniaco: ${({ attivo: 'attivo (nessuna preda ancora)', caccia: 'preda incontrata: uccidila', spoglie: 'preda uccisa: riporta le spoglie nella stanza dei demoni', onorato: 'onorato', fallito: 'FALLITO: nessuna resurrezione' })[p.stato]}.`),
    ['attivo', 'caccia', 'spoglie'].includes(p.stato) ? h('div', { class: 'row wrap' }, p.stato === 'spoglie' ? btn('Spoglie riportate: patto onorato', () => { p.stato = 'onorato'; log('Patto demoniaco onorato.'); modificato(); }, 'primary') : null, btn('Patto fallito', () => { pattoFallito(); modificato(); }, 'danger')) : null);
  return out.length ? h('div', { class: 'card' }, h('h3', {}, 'Acque Oscure e Coboldi'), h('div', { class: 'tools' }, ...out)) : null;
}

// =============================================================
//  CLASSE SPADACCINO
// =============================================================
/** Arma leggera secondaria: lo spadaccino con arma a una mano principale attacca anche con quella. */
export function armaSecondaria(e) {
  if (e.classe !== 'spadaccino') return null;
  const R_ = id => R.equipaggiamento.armi.find(a => a.id === id);
  const p = R_(e.armaPrincipale); if (p?.categoria !== 'una-mano') return null;
  return (e.armi || []).find(id => R_(id)?.categoria === 'leggera' && !R_(id).lancio) || null;
}
export const doppioAttacco = e => !!armaSecondaria(e);
export function armaMaestria(e) {
  if (!(e.maestria > 0)) return toast('Nessun punto maestria disponibile.', 'warn');
  e.maestriaPronta = !e.maestriaPronta; C.nota(e.maestriaPronta ? `${e.nome} concentra la maestria: +1 al prossimo tiro di attacco o di difesa.` : `${e.nome} rinuncia alla maestria.`); modificato('party');
}
export function spendiMaestria(e) {
  if (e.classe !== 'spadaccino' || !e.maestriaPronta) return;
  e.maestriaPronta = false; if (e.maestria > 0) { e.maestria--; C.nota(`${e.nome} spende 1 punto maestria (restano ${e.maestria}).`); }
}
/** Un punto maestria per ogni mostro ucciso, fino al livello. */
export function dopoColpo(e, i, pre) {
  if (e.classe !== 'spadaccino' || !i || i.orda || !pre) return;
  const uccisi = i.minore ? Math.max(0, pre.n - i.n) : (pre.pv > 0 && i.pv <= 0 ? 1 : 0); if (!uccisi) return;
  const prima = e.maestria || 0; e.maestria = Math.min(e.livello, prima + uccisi);
  if (e.maestria > prima) C.nota(`${e.nome} guadagna ${e.maestria - prima} punt${e.maestria - prima === 1 ? 'o' : 'i'} maestria (${e.maestria}/${e.livello}).`);
}

// =============================================================
//  MODIFICATORI (chiamati da rules.js)
// =============================================================
export function attacco(e, ctx, bers, arma, add) {
  const q = bers.qx || {};
  if (e.classe === 'spadaccino' && e.maestriaPronta && e.maestria > 0 && !ctx.incantesimo) add('Maestria', 1);
  if (e.png === 'delfino' && !arma) add('Delfino: nessuna penalità da disarmato', 2);
  if (e.acqueOscure) add('Acque oscure', -1);
  if (e.avviluppato) add('Avviluppato', -1);
  if (e.gelo) add('Raggio congelante', -1);
  if (bers.avvil > 0) add('Bacchetta della piovra: bersaglio avviluppato', 1);
  if (e.classe === 'chierico' && bers.bonusChierici) add('Acqua santa sul boss demoniaco', 1);
  if (q.modAttaccoContro) add('Mostro minuscolo', q.modAttaccoContro);
  if (ctx.incantesimo) { if (q.incantesimiMod) add('Potere del mostro (incantesimi)', q.incantesimiMod); if (ctx.nomeIncantesimo === 'Palla di Fuoco' && q.modPallaDiFuoco) add('Palla di Fuoco contro la fanghiglia', q.modPallaDiFuoco); return; }
  if (arma?.tipo === 'contundente' && q.contundenteMod) add('Armi contundenti contro questo mostro', q.contundenteMod);
  if (['arco', 'balestra'].includes(arma?.id) && q.frecceMod) add('Frecce contro questo mostro', q.frecceMod);
}
export function difesa(e, ctx, add) {
  const i = S.adv?.incontro, att = i && i.stato !== 'finito' ? i : null;
  if (e.classe === 'spadaccino' && e.maestriaPronta && e.maestria > 0) add('Maestria', 1);
  if (e.barriera && att) add('Barriera corallina', 1);
  if (e.avviluppato) add('Avviluppato', -1);
  if (e.gelo) add('Raggio congelante', -1);
  if (e.paura && att && (e.paura.fino !== 'meta' || att.pv * 2 > att.pvMax)) add('Terrore', -1);
  if (e.classe === 'chierico' && att?.bonusChierici) add('Acqua santa sul boss demoniaco', 1);
  if (e.scudo && (e.arti?.mano || e.arti?.gamba) && !ctx.ignoraArmatura && !ctx.ignoraScudo && !ctx.sorpreso && !ctx.fuga) add('Mano perduta: niente scudo', -1);
}
export const odia = (i, e) => i.qx?.bersagliPrioritari === 'chierici' && e.classe === 'chierico';

// =============================================================
//  COMBATTIMENTO
// =============================================================
const salvaVeleno = (e, liv, label) => C.salva(e, liv, 0, label);
export async function inizioIncontro(i) {
  const q = i.qx; if (!q) return;
  for (const s of q.salvezza || []) if (s.quando === 'inizio-combattimento') for (const e of eroiAttivi()) {
    if (!(await C.salva(e, s.liv, bonusDa(e, s.bonus), `${s.tipo === 'fascino-magico' ? 'Fascino magico' : 'Tentacoli'} (${i.nome})`))) {
      if (s.fallimento.stato === 'avviluppato') { e.avviluppato = true; C.nota(`${e.nome} è avviluppato: -1 ad attacco e difesa per questo combattimento.`); }
      else { e.affascinato = true; i.agito[e.id] = true; C.nota(`${e.nome} è affascinato: non agisce e fallisce le difese finché non riceve una guarigione o una Benedizione.`); }
    }
  }
  if (q.iniziativa) { const x = await dado(`${i.nome}: agiscono prima del gruppo? (${q.iniziativa.agisconoPrimaSe.join('-')})`); if (q.iniziativa.agisconoPrimaSe.includes(x.totale)) { i.mostriPrima = true; C.nota(`${i.nome} agiscono prima del gruppo.`); } }
  if (q.bonusPrimoTurno && ordineMarcia().slice(0, 2).some(e => e.classe === 'furfante' && e.stato === 'ok')) { i.bonusPrimoAttacco = q.bonusPrimoTurno.modAttacco; C.nota('Un furfante in prima fila: +1 agli attacchi del primo turno.'); }
  if (q.paralisi?.quando === 'prima-combattimento') for (const e of eroiAttivi()) if (!(await C.salva(e, q.paralisi.liv, bonusDa(e, q.paralisi.bonus), 'Paralisi (magia)'))) paralizza(e, q.paralisi.durataTurni, i);
  if (q.paura) for (const e of eroiAttivi()) if (!(await C.salva(e, q.paura.tsLiv, 0, 'Terrore'))) { e.paura = { fino: q.paura.finoAMetaPv ? 'meta' : 'fine' }; C.nota(`${e.nome} è terrorizzato: -1 in difesa ${q.paura.finoAMetaPv ? 'finché il mostro non ha perso metà dei PV' : 'fino a fine combattimento'}.`); }
  if (q.poteri) await poteriSignore(i);
}
function paralizza(e, turni, i) { e.paralizzato = true; e.paralisiQ = turni; if (i?.agito) i.agito[e.id] = true; C.nota(`${e.nome} è paralizzato per ${turni} turni: non agisce e fallisce le difese.`); }
async function poteriSignore(i) {
  const x = await dado('Potere del signore supremo del caos (1-4 Malocchio, 5 Risucchio, 6 Raggio)');
  const p = i.qx.poteri.tabella.find(r => x.totale >= r.da && x.totale <= r.a);
  C.nota(`${i.nome}: ${p.nome}.`);
  if (p.nome === 'Malocchio') await C.salvaTutti('Malocchio (magia)', p.salvezza.liv, () => 0, e => { e.maledetto = true; });
  else if (p.nome === 'Risucchio di energia') i.potere = 'risucchio';
  else await C.salvaTutti('Raggio di fuoco infernale (magia)', p.salvezza.liv, e => (e.classe === 'chierico' ? mezzo(e) : 0), e => C.perdiPV(e, p.fallimento.pv, 'raggio di fuoco infernale'));
}
export async function inizioTurno(i) {
  for (const e of eroiAttivi()) {
    if (e.rete && !(await C.salva(e, 3, 0, 'Liberarsi dalla rete'))) { i.agito[e.id] = true; C.nota(`${e.nome} è ancora impigliato nella rete e non agisce.`); }
    else if (e.rete) { e.rete = false; C.nota(`${e.nome} si libera dalla rete.`); }
    if (e.affascinato || e.paralisiQ > 0) i.agito[e.id] = true;
  }
}
export async function inizioTurnoMostri(i) {
  const q = i.qx; if (!q) return null;
  if (q.incantesimiMostro) {
    const x = await dado(`${i.nome}: incantesimo (1-3 Raggio congelante, 4-5 Dardo di ghiaccio, 6 Fiamma gelida)`);
    const s = q.incantesimiMostro.tabella.find(r => x.totale >= r.da && x.totale <= r.a), mago = e => (e.classe === 'mago' ? e.livello : 0);
    C.nota(`${i.nome} lancia ${s.nome}.`);
    if (s.bersaglio === 'tutti') await C.salvaTutti(`${s.nome} (magia)`, s.salvezza.liv, mago, e => { e.gelo = true; C.nota(`${e.nome}: -1 a tutti gli attacchi e le difese finché lo stregone non muore.`); });
    else { const e = casuale(eroiAttivi()); if (e && !(await C.salva(e, s.salvezza.liv, mago(e), `${s.nome} (magia)`))) C.perdiPV(e, s.fallimento.pv, s.nome); }
  }
  if (q.paralisi?.quando === 'ogni-turno') { const e = casuale(eroiAttivi().filter(x => !x.paralizzato)); if (e && !(await C.salva(e, q.paralisi.liv, bonusDa(e, q.paralisi.bonus), 'Paralisi (magia)'))) paralizza(e, q.paralisi.durataTurni, i); }
  if (q.tentacoli) {
    const x = await dado(`${i.nome}: tentacoli? (1 = spazzano l’area)`);
    if (q.tentacoli.scattaCon.includes(x.totale)) { C.nota(`${i.nome} spazza l’area con i tentacoli (non attacca altrimenti).`); await C.salvaTutti('Tentacoli del kraken', q.tentacoli.salvezza.liv, e => bonusDa(e, q.tentacoli.salvezza.bonus), e => C.perdiPV(e, 1, 'tentacoli')); return { salta: true }; }
  }
  return null;
}
/** Malus di difesa del granchio agganciato: l'attacco k-esimo sullo stesso eroe è di un granchio agganciato. */
export function aggancio(e, i, k, ass) {
  if (!i.qx?.aggancio) return 0;
  const prima = ass.slice(0, k).filter(x => x.eroeId === e.id).length;
  return (i.agganci?.[e.id] || 0) > prima ? -1 : 0;
}
export async function effettoFerita(e, i, dn, r, dif) {
  const q = i.qx; if (!q) return;
  if (q.infezione) { const x = await dado(`Infezione per ${e.nome} (${q.infezione.probabilita} su 1d6)`); if (x.totale <= q.infezione.probabilita) C.perdiPV(e, q.infezione.pv, 'infezione'); }
  for (const s of q.salvezza || []) if (s.quando === null && e.stato === 'ok') if (!(await C.salva(e, s.liv, bonusDa(e, s.bonus), `${s.tipo === 'elettricita' ? 'Scarica elettrica' : 'Veleno urticante'}`))) C.perdiPV(e, s.fallimento.pv, i.nome);
  if (q.aggancio && q.aggancio.su === 'colpo-a-segno') { i.agganci = i.agganci || {}; i.agganci[e.id] = Math.min((i.agganci[e.id] || 0) + 1, i.n); C.nota(`Un granchio si aggancia a ${e.nome}: -1 alle sue difese contro di lui.`); }
  if (q.intrappola && r?.naturale === 1 && e.stato === 'ok') { e.rete = true; i.agito[e.id] = true; C.nota(`${e.nome} resta impigliato nella rete: non agisce e fallisce le difese (tiro salvezza L3 a ogni turno per liberarsi).`); }
  if (q.perdeLivello && e.stato === 'ok' && !(await C.salva(e, q.perdeLivello.salvezza.liv, 0, 'Perdita di livello (magia)'))) A.perdiLivello(e, q.perdeLivello.livelli);
  if (q.frenesia && e.stato === 'ok') { C.nota(`${i.nome}: frenesia! Secondo tiro di difesa per ${e.nome}.`); const es = await C.provaDifesa(dif || e, i, i.liv, {}); if (!es.ok) C.perdiPV(e, q.frenesia.pvExtra, `${i.nome} (frenesia)`); }
}
export async function contraccolpo(e, i) {
  const c = i.qx?.contraccolpo; if (!c) return;
  if (c.salvezza) { if (!(await C.salva(e, c.salvezza.liv, bonusDa(e, c.salvezza.bonus), 'Aculei velenosi (veleno)'))) C.perdiPV(e, c.fallimento.pv, 'aculei velenosi'); }
  else C.perdiPV(e, c.fallimento.pv, 'corallo tagliente');
}
export function dopoDanni(i, prima, n) {
  const q = i.qx; if (!q) return;
  if (q.attaccoCrescente?.su === 'ferita-subita' && !i.minore && i.pv > 0) { i.att += n; C.nota(`${i.nome} guadagna ${n} attacco/i: ora ${i.att}.`); }
  if (q.moraleRegola && i.minore && prima > i.n) {
    i.uccisiTurno = (i.uccisiTurno || 0) + (prima - i.n);
    if (i.n > 0 && i.uccisiTurno >= q.moraleRegola.tiraOgniTurnoSeUccisiAlmeno && !(q.moraleRegola.nonTiraSeUccisiPiuDellaMeta && i.nIniziale - i.n > i.nIniziale / 2) && !i.noMorale) { i.moraleFatto = false; i.moralePendente = true; C.nota('Almeno 3 uccisi in questo turno: serve un tiro di morale.'); }
  }
}
export function fineTurnoMostri(i) {
  i.uccisiTurno = 0; i.stordito = 0;
  for (const e of S.party.eroi) if (e.paralisiQ > 0 && !--e.paralisiQ) { e.paralizzato = false; C.nota(`${e.nome} non è più paralizzato.`); }
}
export async function nuovoTurno(i) {
  if (i.qx?.attDadiOgniTurno && i.attDadi) { const x = await tira(i.attDadi, `Attacchi di ${i.nome}`); i.att = x.totale; C.nota(`${i.nome}: ${x.totale} attacchi in questo turno, divisi equamente.`); }
}
export async function eroeCaduto(e, causa) {
  e.mortoAvv = adv().numero; const st = stato(), i = C.inc();
  if (stato().patto?.stato === 'fallito') e.nonResuscitabile = true;
  if (e.png === 'delfino') { st.delfinoMorto = { stanze: adv().stanze }; S.party.eroi = S.party.eroi.filter(x => x.id !== e.id); S.party.ordine = S.party.ordine.filter(id => id !== e.id); log('Il delfino magico è caduto: tornerà dopo 3 nuove stanze o corridoi.'); modificato('party'); return; }
  if (!i || causa !== i.nome) return;
  const ac = i.qx?.attaccoCrescente; if (ac?.su === 'personaggio-ucciso') { i.att += ac.incremento; C.nota(`${i.nome} ha ucciso ${e.nome}: ora attacca ${i.att} volte per turno.`); }
  if (i.qx?.trasformaCaduti) {
    const c = eroiVivi().find(x => x.stato === 'ok' && ((x.classe === 'chierico' && (x.usi?.benedizione || 0) < 3) || (x.incantesimi || []).some(s => s.nome === 'Benedizione' && !s.usato)));
    if (c && await scelta('Lupo mannaro demoniaco', `${e.nome} è caduto: ${c.nome} può lanciare una Benedizione su di lui perché non si trasformi.`, [[true, 'Lancia la Benedizione (potrà essere resuscitato)'], [false, 'Lascia che si trasformi']])) {
      if (c.classe === 'chierico') c.usi.benedizione = (c.usi.benedizione || 0) + 1; else (c.incantesimi.find(s => s.nome === 'Benedizione' && !s.usato)).usato = true;
      C.nota(`${c.nome} benedice ${e.nome}: resta morto ma non si trasforma.`);
    } else {
      e.nonResuscitabile = true; const voce = R.coboldi.mostri.boss.find(m => m.id === i.qx.trasformaCaduti.in || m.id === i.id), n = creaIncontro('boss', voce, 1);
      n.tessera = i.tessera; n.nome = `${voce.nome} (ex ${e.nome})`; (adv().coda = adv().coda || []).push(n); C.nota(`${e.nome} si trasforma in un lupo mannaro demoniaco: va affrontato dal gruppo.`);
    }
    modificato();
  }
}
export function fineIncontro(i, esito) {
  const q = i.qx, p = stato().patto;
  if (i.pattoBersaglio && p?.stato === 'caccia') { if (esito === 'sconfitti') { p.stato = 'spoglie'; log('Patto demoniaco: la preda è morta. Riportate le spoglie nella stanza dei demoni.'); } else pattoFallito(); }
  if (q?.attiraErranti?.quando === 'fine-combattimento' && esito !== 'fuga') {
    dado('Abbaiare dei mastini: arrivano gli erranti? (1)').then(async x => { if (x.totale <= q.attiraErranti.probabilita) { const m = await G.monstroErrante(); log('L’abbaiare dei mastini attira mostri erranti.'); G.avviaIncontro(m, G.tileById(i.tessera)); } });
  }
  if (i.cerchio && esito === 'sconfitti' && i.avatar) {
    const av = i.avatar, f = i.qx?.indebolitoSe;
    if (i.turno <= 1) { av.liv = av.livBase = av.liv - 1; av.pvMax = av.pv = av.pvMax - 1; av.att -= 1; C.nota('Tutti gli adepti sono morti nel primo turno: l’Avatar compare indebolito (-1 LIV, -1 PV, -1 ATT).'); }
    else C.nota('Gli adepti non sono caduti tutti nel primo turno: l’Avatar compare al massimo della forza.');
    av.tessera = i.tessera; (adv().coda = adv().coda || []).push(av); i.avatar = null; void f;
  }
}
/** Boss finale del set acquatico: si può scegliere il cerchio di evocazione con l'Avatar di Tezany. */
export async function bossFinale(f) {
  if (!inAcque() || f.cerchio) return f;
  const k = await scelta('Boss finale', `È uscito il boss finale: ${f.nome}. Vuoi invece il cerchio di evocazione con l’Avatar di Tezany (come nel capitolo 2 di Acque Oscure)?`, [['mostro', `Il mostro estratto: ${f.nome}`], ['avatar', 'Cerchio di evocazione e Avatar di Tezany', '8 adepti da uccidere nel primo turno, poi l’Avatar (indebolito se ci riesci)']]);
  if (k !== 'avatar') return f;
  const ex = R.acque.creatureExtra, ad = ex.find(x => x.id === 'q-adepti-demoni-abissali'), av = ex.find(x => x.id === 'q-avatar-di-tezany');
  const a = creaIncontro('seguaci', { ...ad, nome: 'Demoni abissali adepti (cerchio di evocazione)', tes: 'NO', mor: 'NO' }, 8);
  Object.assign(a, { cerchio: true, noMorale: true, nonAttacca: false, note: `${ad.note}` });
  a.qx = { ...(a.qx || {}), bonusPrimoTurno: ad.bonusPrimoTurno };
  a.avatar = creaIncontro('boss', { ...av, nonAumentareBossFinale: true }, 1, { bossFinale: true }); a.avatar.qx = { ...a.avatar.qx, ...Object.fromEntries(['paura', 'indebolitoSe', 'tiriES', 'tesoroExtra'].map(k => [k, av[k]])) };
  a.avatar.note = av.note; return a;
}
export function chiudiIncontro(i) {
  const p = stato().patto; if (i?.pattoBersaglio && p?.stato === 'caccia') pattoFallito();
  for (const e of S.party.eroi) {
    e.barriera = false; e.avviluppato = false; e.gelo = false; e.paura = null; e.rete = false;
    if (e.paralisiQ > 0) { e.paralisiQ = 0; e.paralizzato = false; }
  }
  normalizza().catch(err => console.error(err));
}
export function curaAcque(b, tipo) {
  b.affascinato = false; b.acqueOscure = false; V.cura(b, tipo);   // anche i malus silvani (lamia, rospo, apatia)
}
export async function inizioAvventura() {
  for (const e of S.party.eroi) { e.barriera = false; e.avviluppato = false; e.gelo = false; e.paura = null; e.rete = false; e.affascinato = false; e.acqueOscure = false; e.paralisiQ = 0; e.maestriaPronta = false; }
  S.party.eroi = S.party.eroi.filter(e => e.png !== 'delfino'); S.party.ordine = S.party.ordine.filter(id => eroePerId(id));
}
export function fineAvventura() { inizioAvventura(); }

/** Contenuti dopo ogni stanza: nulla da fare (il delfino torna contando le stanze). */
export async function dopoStanza() {}

// =============================================================
//  UI: scheda incontro, combattimento, scheda eroe
// =============================================================
export function preIncontro(i, btn) {
  const st = stato(), out = [];
  if (st.cavalluccio === 'attivo' && i.stato === 'nuovo') out.push(btn('Cavalluccio marino gigante: usalo (1d6)', async () => {
    const x = await dado('Cavalluccio marino: 1-2 fugge, 3-6 corrompe automaticamente'); st.cavalluccio = 'usato';
    if (x.totale <= 2) { C.nota('Il cavalluccio marino gigante fugge.'); modificato(); return; }
    C.nota(`Il cavalluccio marino corrompe automaticamente ${i.nome}.`); C.paga(0, false, true);
  }));
  return out;
}
export function azioniCombattimento(e, i, azione, btn) {
  const out = [];
  if (e.classe === 'spadaccino') out.push(btn(`Maestria ${e.maestriaPronta ? '✓ ' : ''}(${e.maestria || 0}/${e.livello})`, async () => { const C2 = await import('./coop.js'); if (C2.sonoOspite()) return C2.comando({ tipo: 'maestria', eroeId: e.id }); armaMaestria(e); }, e.maestriaPronta ? 'accent' : ''));
  const acqua = oggetto(e, /acqua santa/i);
  if (acqua && ((i.tag || []).includes('demone') || i.qx?.vulnerabileAcquaSanta)) out.push(azione(e, 'Lancia acqua santa (1 ferita)', () => acquaSanta(e, acqua, i), 'accent'));
  const corno = oggetto(e, /^corno del narvalo$/i); if (corno?.cariche > 0 && ['elfo', 'mago'].includes(e.classe)) out.push(azione(e, `Corno del narvalo (${corno.cariche})`, () => usaCorno(e, corno), 'accent'));
  const bac = oggetto(e, /bacchetta della piovra/i); if (bac?.cariche > 0) out.push(azione(e, `Bacchetta della piovra (${bac.cariche})`, () => usaBacchetta(e, bac), 'accent'));
  return out;
}
export function statiAcque(e) {
  const t = [];
  if (e.classe === 'spadaccino') t.push([`Maestria ${e.maestria || 0}/${e.livello}`, 'green', 'Punti maestria: +1 a un tiro di attacco o di difesa']);
  if (e.acqueOscure) t.push(['Acque oscure', 'red', '-1 agli attacchi (ondata guaritrice, guarigione o Benedizione)']);
  if (e.affascinato) t.push(['Affascinato', 'red', 'Non agisce (guarigione o Benedizione)']);
  if (e.avviluppato) t.push(['Avviluppato', 'red', '-1 ad attacco e difesa']);
  if (e.rete) t.push(['Nella rete', 'red', 'Non agisce; TS L3 a ogni turno']);
  if (e.arti?.mano) t.push(['Senza mano', 'red', 'Niente armi a due mani né scudo']);
  if (e.arti?.gamba) t.push(['Senza gamba', 'red', 'Stampella: una mano occupata']);
  if (e.nonResuscitabile) t.push(['Non resuscitabile', 'dead', '']);
  return t;
}
/** Scheda: punti maestria e arti perduti. */
export function sezioneScheda(e, rinfresca) {
  const box = h('div', {});
  if (e.classe === 'spadaccino') box.append(h('div', { class: 'grid2' }, h('label', {}, `Punti maestria (massimo ${e.livello})`, h('input', { type: 'number', min: 0, max: e.livello, value: e.maestria || 0, onchange: ev => { e.maestria = Math.max(0, Math.min(e.livello, +ev.target.value || 0)); modificato('party'); } }))));
  if (acqueAttive()) {
    const a = e.arti = e.arti || {};
    const chk = (t, k) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!a[k], onchange: ev => { a[k] = ev.target.checked; modificato('party'); rinfresca(); } }), t);
    box.append(h('h4', {}, 'Arti perduti'), h('div', { class: 'chk-row' }, chk('Ha perso una mano', 'mano'), chk('Ha perso una gamba (stampella)', 'gamba')),
      h('p', { class: 'hint' }, 'Senza una mano (o con la stampella) non si usano armi a due mani né lo scudo. Rimedi a fine capitolo: arma leggera permanente (lama o uncino) al posto della mano, gamba di legno, oppure 300 p.o. per far ricrescere l’arto; la resurrezione lo fa ricrescere.'),
      (a.mano || a.gamba) ? h('div', { class: 'row wrap' }, h('button', { onclick: () => { a.mano = a.gamba = false; log(`${e.nome} recupera l’arto (resurrezione).`); modificato('party'); rinfresca(); } }, 'Arto ricresciuto (resurrezione)'),
        h('button', { disabled: (e.oro || 0) < 300, onclick: () => { e.oro -= 300; a.mano = a.gamba = false; log(`${e.nome} paga 300 p.o. e l’arto ricresce.`); modificato('party'); rinfresca(); } }, 'Fai ricrescere l’arto (300 p.o.)'),
        a.mano ? h('button', { onclick: () => { a.mano = false; (e.armi = e.armi || []).push('leggera-taglio'); log(`${e.nome} sostituisce la mano con una lama permanente (arma leggera).`); modificato('party'); rinfresca(); } }, 'Lama o uncino (arma leggera)') : null,
        a.gamba ? h('button', { onclick: () => { a.gamba = false; log(`${e.nome} porta una gamba di legno (nessun beneficio).`); modificato('party'); rinfresca(); } }, 'Gamba di legno') : null) : null);
  }
  return box;
}
/** Compagno PNG: membro aggiuntivo del gruppo (può superare le 4 posizioni). */
export function nuovoCompagno() {
  modal('Compagno PNG', (b, close) => {
    const nome = h('input', { type: 'text', value: 'Compagno', maxlength: 24 }), liv = h('input', { type: 'number', min: 0, value: 0 }), pv = h('input', { type: 'number', min: 1, value: 3 });
    const arma = h('select', {}, [['una-mano-taglio', 'Arma a una mano da taglio'], ['leggera-taglio', 'Arma leggera'], ['', 'Nessuna']].map(([v, t]) => h('option', { value: v }, t)));
    const arm = h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: true }), 'Armatura leggera');
    b.append(h('p', { class: 'hint' }, 'Un alleato assoldato o liberato conta come membro aggiuntivo del gruppo e occupa una posizione nell’ordine di marcia. Equipaggialo dalla sua scheda.'), h('label', {}, 'Nome', nome), h('label', {}, 'Livello (0 = senza bonus)', liv), h('label', {}, 'Punti vita', pv), h('label', {}, 'Arma', arma), arm,
      h('div', { class: 'row end' }, h('button', { onclick: close }, 'Annulla'), h('button', { class: 'primary', onclick: () => {
        const e = nuovoEroe('guerriero', nome.value.trim() || 'Compagno');
        Object.assign(e, { livello: +liv.value || 0, pvMax: +pv.value || 1, pv: +pv.value || 1, png: 'compagno', armi: arma.value ? [arma.value] : [], armaPrincipale: arma.value || null, armatura: arm.querySelector('input').checked ? 'leggera' : 'nessuna', posizione: adv().stanzaCorrente || null, note: 'Compagno PNG: membro aggiuntivo del gruppo.' });
        S.party.eroi.push(e); S.party.ordine.push(e.id); log(`${e.nome} si unisce al gruppo come compagno PNG.`); modificato('party'); close();
      } }, 'Aggiungi')));
  });
}
