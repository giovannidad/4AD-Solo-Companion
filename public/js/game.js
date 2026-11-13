// Flusso di gioco: avventura, generazione stanze, contenuti, tesori, ricerche, esperienza.
import { R, S, log, modificato, eroiVivi, livelloMax, eroePerId, emit } from './state.js';
import { tira, d66, dado, d6Esplosivo } from './dice.js';
import { riga, tabella, creaIncontro, mostriTabella, setAttivo, inCaos, incantesimoACasoLista } from './rules.js';
import * as K from './caos.js';
import * as T from './tratti.js';
import * as Eff from './effetti.js';
import { nomeDungeon } from './nomi.js';
import * as table from './map2d.js';
import { toast, uid, modal, h, scelta } from './util.js';

const adv = () => S.adv;
export const tileById = id => adv().tessere.find(t => t.id === id);

/** Crea i dati di una tessera; la dimensione in quadretti deriva dalla griglia misurata sull'immagine. */
const CARTELLA_SET = { classico: 'set-classico', foresta: 'set-foresta' };
function nuovaTessera(tipo, n) {
  const m = tipo === 'ingresso' ? R.tiles.ingressi[n] : R.tiles.tiles[n];
  return {
    id: uid(), tipo, n, src: `/assets/${CARTELLA_SET[adv().tema] ? CARTELLA_SET[adv().tema] + '/' : ''}${tipo === 'ingresso' ? 'ingressi' : 'tiles'}/${n}.${m.svg ? 'svg' : 'webp'}`,
    w: m.w, h: m.h, cx: m.cx, cy: m.cy, ox: m.ox, oy: m.oy,
    x: 10, z: 14, rot: 0, flip: false, scale: 1, pending: false, nome: `Stanza ${n}`, corridoio: false, contenuto: null, perquisita: false
  };
}

/** Sposta i personaggi che si trovano in `da` nella stanza `a` (il gruppo si muove unito). */
export function muoviGruppo(da, a) {
  S.party.eroi.forEach(e => { if (e.posizione === da || !e.posizione) e.posizione = a; });
}

/** Stanza in cui il gruppo può riposare senza problemi: una stanza (non un corridoio) vuota oppure ripulita dai mostri, senza scontri aperti. */
export function stanzaSicura(t) {
  if (!t || t.pending || t.corridoio || t.sospeso) return false;
  const i = adv()?.incontro;
  if (i && i.stato !== 'finito' && i.tessera === t.id) return false;
  if ((adv()?.coda || []).some(c => c.tessera === t.id)) return false;
  return !!(t.contenuto?.vuota || t.ripulita);
}

/** Percorso (stanze attraversate, destinazione compresa) fra due stanze già esplorate; almeno 1 se le stanze sono diverse. */
export function percorso(da, a) {
  const ts = (adv().tessere || []).filter(t => !t.pending); const prev = new Map([[da, null]]); const coda = [da];
  while (coda.length) {
    const c = coda.shift(); if (c === a) break;
    const tc = ts.find(t => t.id === c); if (!tc) continue;
    for (const t of ts) if (!prev.has(t.id) && table.vicine(tc, t)) { prev.set(t.id, c); coda.push(t.id); }
  }
  if (!prev.has(a)) return [a];
  const p = []; for (let x = a; x && x !== da; x = prev.get(x)) p.unshift(x); return p;
}
/** Tiri dovuti quando i personaggi passano da una stanza all'altra: per ogni stanza già visitata che si attraversa 1d6, con 1 arrivano
 *  i mostri erranti; se nella stanza d'arrivo c'è uno scontro sospeso, si riprende. */
export async function spostamento(da, a, nomi = 'Il gruppo') {
  if (!adv()?.attiva || !da || !a || da === a) return;
  if (adv().incontro && adv().incontro.stato !== 'finito') { toast('C’è uno scontro in corso: nessun tiro di spostamento.', 'warn'); return; }
  const via = percorso(da, a); const dest = tileById(a);
  log(`${nomi} si sposta${nomi === 'Il gruppo' ? '' : ''} attraverso ${via.length} stanza/e già visitate.`);
  for (let k = 0; k < via.length; k++) {
    const r = await dado(`Ritorno sui passi, stanza ${k + 1} di ${via.length} (1 = mostri erranti)`);
    if (r.totale === 1) { const m = await monstroErrante(); log('Mostri erranti sorprendono il gruppo durante lo spostamento!'); avviaIncontro(m, tileById(via[k]) || dest); return; }
  }
  if (dest?.sospeso) { const C = await import('./combat.js'); C.riprendiIncontro(dest); document.dispatchEvent(new CustomEvent('apri-tab', { detail: 'incontro' })); }
}

// ---------------- avventura ----------------
/** Decide quali tabelle usare: a partire dal 3° livello di tutto il gruppo si chiede una volta se passare alle avanzate. */
async function risolviSet() {
  const vivi = eroiVivi();
  const pronti = vivi.length > 0 && vivi.every(e => e.livello >= 3);
  if (S.party.set === undefined && pronti) {
    const v = await scelta('Tabelle avanzate', 'Tutti i personaggi hanno raggiunto il 3° livello. Quali tabelle vuoi usare per il prossimo dungeon? (Potrai cambiare scelta prima di ogni avventura.)', [
      ['diabolici', 'Nemici diabolici', 'Tabelle avanzate del manuale base: tesori e mostri più letali.'],
      ['caos', 'Caverne del Caos', 'Supplemento «Contro il Caos»: dungeon a tema con missione, trappole, eventi e incantesimi del caos.'],
      ['base', 'Tabelle base', 'Resta con le tabelle normali.']]);
    if (v === null) return S.party.set || 'base';
    S.party.set = v; modificato('party');
  }
  return S.party.set || 'base';
}

export async function iniziaAvventura() {
  if (!eroiVivi().length) { toast('Crea prima almeno un eroe nel gruppo.', 'warn'); return false; }
  const set = await risolviSet();
  let missione = null;
  if (set === 'caos') { missione = await K.scegliMissione(); }
  Object.assign(S.adv, { set, missione, tema: S.party.tema || 'carta', eventiUsati: [],
    attiva: true, numero: (S.adv.numero || 0) + 1, stanze: 0, tessere: [], stanzaCorrente: null, incontro: null, coda: [],
    maggioriSconfitti: 0, incontriSeguaci: 0, esPendenti: [], bottino: [], fine: null, nomeDungeon: nomeDungeon(), bossFinaleUcciso: false,
    guaritoreVisto: false, alchimistaVisto: false, fontanaUsata: false, dama: false, maledizioniNote: []
  });
  // tra un'avventura e l'altra le ferite guariscono e gli usi si ricaricano
  for (const e of S.party.eroi) {
    if (e.stato === 'morto') continue;
    e.pv = e.pvMax; e.stato = 'ok'; e.maledetto = false; e.zoppo = false;
    e.usi = { benedizione: 0, guarigione: 0, furie: 0, fortuna: 0, bende: 0, pozione: 0 };
    (e.incantesimi || []).forEach(s => { s.usato = false; });
  }
  table.setTema(S.adv.tema); table.setTiles([]);
  const r = await dado('Stanza d’ingresso (d6)');
  const idx = r.totale;
  const t = nuovaTessera('ingresso', String(idx));
  t.nome = `Ingresso ${idx}`; t.contenuto = { testo: 'Stanza d’ingresso (sempre vuota).', vuota: true, ingresso: true };
  table.placeBottom(t);
  adv().tessere.push(t); adv().stanzaCorrente = t.id;
  S.party.eroi.forEach(e => { e.posizione = t.id; });
  table.setTiles(adv().tessere);
  table.selectTile(null); table.animate(t.id);
  log(`Inizia l’avventura n. ${adv().numero}: «${adv().nomeDungeon}» (${set === 'caos' ? 'Caverne del Caos' : set === 'diabolici' ? 'Nemici diabolici' : 'tabelle base'}). Ingresso ${idx}.`);
  if (missione) log(`Missione: ${missione.nome} (livello consigliato ${missione.liv}).`);
  toast(`Ingresso ${idx}: la stanza viene disegnata sul foglio.`);
  modificato();
  return true;
}

export function terminaAvventura(esito) {
  adv().attiva = false; adv().fine = esito;
  log(`Avventura conclusa: ${esito}.`);
  if ((adv().tessere || []).filter(t => t.tipo === 'stanza').length >= 10) T.tutti('dungeon');
  modificato();
}

// ---------------- generazione stanze ----------------
export async function nuovaStanza(opzioni = {}) {
  if (!adv().attiva) { toast('Inizia prima un’avventura.', 'warn'); return null; }
  if (adv().tessere.some(t => t.pending)) { toast('Posiziona prima la stanza in attesa.', 'warn'); return null; }
  const r = await d66('Nuova stanza (d66: rosso = decine)');
  const n = String(r.totale);
  const t = nuovaTessera('stanza', n);
  Object.assign(t, { pending: true, segreta: !!opzioni.segreta, finale: !!opzioni.finale });
  table.autoPlace(t, tileById(adv().stanzaCorrente), adv().tessere);
  adv().tessere.push(t);
  table.setTiles(adv().tessere); table.selectTile(t.id); table.ensureVisible(t);
  log(`Tirato d66 = ${n}: tessera da posizionare${opzioni.segreta ? ' (stanza segreta)' : ''}.`);
  modificato();
  return t;
}

export async function confermaStanza(t, corridoio) {
  t.pending = false; t.corridoio = !!corridoio;
  adv().stanze++; t.idx = adv().stanze;
  muoviGruppo(adv().stanzaCorrente, t.id); adv().stanzaCorrente = t.id;
  table.upsertTile(t); table.selectTile(null); table.animate(t.id);
  log(`Stanza ${t.n} posizionata (${corridoio ? 'corridoio' : 'stanza'}).`);
  modificato();
  await generaContenuto(t);
}

export function scartaStanza(t) {   // se la stanza non entra, resta come vicolo cieco: il contenuto va comunque tirato
  t.nome = `Stanza ${t.n} (vicolo cieco)`;
  return confermaStanza(t, t.corridoio);
}
export function annullaStanza(t) {
  adv().tessere = adv().tessere.filter(x => x.id !== t.id);
  table.removeTile(t.id); table.setTiles(adv().tessere); log(`Tessera ${t.n} scartata.`); modificato();
}

// ---------------- contenuti ----------------
export async function monstroDa(nomeTab, opzioni = {}) {
  let voce, v;
  do {
    const r = await dado(`Tabella mostri ${nomeTab}`);
    v = r.totale; voce = mostriTabella(nomeTab)[v - 1];
  } while (opzioni.errante && (voce.drago || voce.maiErrante));
  const diff = inCaos() ? K.differenzaLivello() : 0;   // gruppo sopra il livello consigliato: più mostri e più PV
  let quantita = 1, nome = voce.nome, extra = {};
  if (voce.speciale === 'scheletri-o-zombi') {
    const t = await dado('Scheletri (1-3) o zombi (4-6)');
    if (t.totale <= 3) { nome = 'Scheletri'; extra.contundentePiu = true; quantita = (await tira('1d6+2', 'Numero scheletri')).totale; }
    else { nome = 'Zombi'; quantita = (await tira('1d6', 'Numero zombi')).totale; }
  } else if (voce.conta && voce.conta !== '1') {
    quantita = (await tira(voce.conta, `Numero ${voce.nome}`)).totale;
  }
  const inc = creaIncontro(nomeTab, { ...voce, nome }, quantita + (inc_minore(nomeTab) ? diff : 0), { ...opzioni, pvExtra: diff });
  if (voce.id === 'ratti-scheletrici') inc.contundentePiu = true;
  Object.assign(inc, extra);
  if (voce.leader && inc_minore(nomeTab)) inc.leaderInc = await leaderDi(voce, inc);
  return inc;
}

/** Leader dei seguaci del caos: tira se è presente e lo crea come mostro maggiore che si affronta dopo il gruppo. */
async function leaderDi(voce, inc) {
  const x = await dado(`${voce.nome}: c'è un leader? (1-${voce.leaderProb || 1} su 1d6)`);
  if (x.totale > (voce.leaderProb || 1)) return null;
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(voce.leader); if (!m) return null;
  const val = async (txt, label) => (/d/.test(txt) ? (await tira(txt, label)).totale : +txt);
  const get = k => { const r = new RegExp(k + '\\s+([0-9d+]+)', 'i').exec(m[2]); return r ? r[1] : null; };
  const nome = m[1], liv = await val(get('LIV') || '5', `Livello: ${nome}`), pv = await val(get('PV') || '3', `PV: ${nome}`), att = +(get('ATT') || 1);
  const mor = /MOR \+1/i.test(voce.note || '') ? 1 : 0;
  const l = creaIncontro('boss', { id: voce.id + '-leader', nome, liv, att, pv, tag: [...(voce.tag || [])], mor, tes: /TES \+1/i.test(voce.leader) ? 1 : 0, xp: true, reazioni: [[1, 6, 'combatte-sempre']] }, 1);
  log(`${voce.nome}: ${nome} è il leader (LIV ${liv}, ATT ${att}, PV ${pv}); si affronta dopo il gruppo.`);
  return l;
}
const inc_minore = t => ['infestanti', 'seguaci'].includes(t);

/** Mostro fisso del supplemento (signore del caos, carnefice, mostro del vuoto…). */
export function creaSpeciale(chiave, finale = false) {
  const voce = R.caos.speciali[chiave];
  const i = creaIncontro('boss', voce, 1, { bossFinale: finale });
  if (finale) { i.att = voce.att; i.pv = i.pvMax = voce.pv; }
  return i;
}

/** Un mostro maggiore a scelta fra aberranti e boss. */
export async function mostroMaggioreScelto(t) {
  const tab = await scelta('Mostro maggiore', 'Gli eventi unici sono finiti: incontri un mostro maggiore. Quale tabella?', [['aberranti', 'Mostri aberranti'], ['boss', 'Mostri boss']]);
  const i = await monstroDa(tab || 'boss'); avviaIncontro(i, t); return `${i.nome} (evento esaurito)`;
}

export async function monstroErrante() {
  const r = await dado('Tipo di mostro errante (d6)');
  const tab = riga(tabella('errante'), r.totale).tabella;
  const inc = await monstroDa(tab, { errante: true });
  inc.nome += ' (erranti)';
  return inc;
}

export function avviaIncontro(inc, tessera) {
  inc.tessera = tessera?.id || null;
  inc.corridoio = !!tessera?.corridoio;
  if (adv().incontro && adv().incontro.stato !== 'finito') { adv().coda = adv().coda || []; adv().coda.push(inc); toast(`${inc.nome} in coda.`); }
  else adv().incontro = inc;
  log(`Incontro: ${inc.nome}${inc.minore ? ` (×${inc.n})` : ''}, LIV ${inc.liv}.`);
  modificato();
  document.dispatchEvent(new CustomEvent('apri-tab', { detail: 'incontro' }));
}

async function bossCheck(inc) {
  if (inc.errante) return inc;
  if (adv().missione?.id === 'esplorazione') return inc;   // non si tira il boss finale
  const r = await dado('Boss finale? (1d6 + maggiori sconfitti)');
  const tot = r.totale + adv().maggioriSconfitti;
  log(`Boss finale? ${r.totale} + ${adv().maggioriSconfitti} = ${tot}${tot >= 6 ? ' → È IL BOSS FINALE!' : ''}`);
  if (tot >= 6) {
    const fisso = adv().missione?.bossFinale;
    if (fisso) { const f = creaSpeciale(fisso, true); log(`Missione: il boss finale è ${f.nome}.`); return f; }
    return creaIncontro(inc.tabella, mostriTabella(inc.tabella).find(m => m.id === inc.id), 1, { bossFinale: true });
  }
  return inc;
}
async function boss(tessera, forzaFinale = false) {
  let inc = await monstroDa('boss');
  if (forzaFinale) inc = adv().missione?.bossFinale ? creaSpeciale(adv().missione.bossFinale, true) : creaIncontro('boss', mostriTabella('boss').find(m => m.id === inc.id), 1, { bossFinale: true });
  else inc = await bossCheck(inc);
  avviaIncontro(inc, tessera);
  return inc.bossFinale ? `BOSS FINALE: ${inc.nome}` : `Mostro boss: ${inc.nome}`;
}

export async function generaContenuto(t) {
  if (t.finale) { t.contenuto = { testo: await boss(t, true), vuota: false }; modificato(); return; }
  const r = await tira('2d6', 'Contenuto della stanza (2d6)');
  const row = riga(tabella('contenuto'), r.totale);
  const corr = t.corridoio;
  let testo = `${r.totale}: ${row.testo}`, vuota = false;
  const vuotaCorr = () => { vuota = true; testo += ' → vuoto (perquisire a -1 nei corridoi).'; };
  switch (row.azione) {
    case 'tesoro': testo += ' ' + await tesoro(); break;
    case 'tesoro-trappola': testo += ' ' + await trappola() + ' ' + await tesoro(); break;
    case 'evento-o-vuoto': if (corr) vuotaCorr(); else testo += ' ' + await evento(t); break;
    case 'vuota-speciale': if (inCaos() && corr) { vuotaCorr(); break; } vuota = true; testo += ' ' + await caratteristica(); break;
    case 'tesoro-guardiano': {
      testo += ' ' + await tesoro();
      const g = await dado('Il tesoro è custodito? (4-6 sì)');
      if (g.totale >= 4) { const i = await mostroMaggioreScelto2(); avviaIncontro(i, t); testo += ` Custodito da ${i.nome}.`; }
      break;
    }
    case 'vuota-o-evento': {
      const g = await dado('Stanza vuota (1-4) o evento unico (5-6)');
      if (g.totale <= 4) { vuota = true; testo += ' → stanza vuota (si può perquisire).'; } else testo += ' ' + await evento(t);
      break;
    }
    case 'boss-o-vuoto': if (corr) vuotaCorr(); else testo += ' ' + await boss(t); break;
    case 'doppio-o-boss': if (corr) vuotaCorr(); else {
      if (R.caos.grandi.includes(String(t.n))) { const a = await monstroDa('aberranti'); avviaIncontro(a, t); testo += ` Stanza grande: ${a.nome} e ` + await boss(t); }
      else testo += ' ' + await boss(t);
    } break;
    case 'infestanti': { const i = await monstroDa('infestanti'); avviaIncontro(i, t); testo += ` ${i.nome} ×${i.n}`; break; }
    case 'seguaci': { const i = await monstroDa('seguaci'); avviaIncontro(i, t); testo += ` ${i.nome} ×${i.n}`; break; }
    case 'seguaci-o-vuoto': if (corr) vuotaCorr(); else { const i = await monstroDa('seguaci'); avviaIncontro(i, t); testo += ` ${i.nome} ×${i.n}`; } break;
    case 'vuota': vuota = true; break;
    case 'aberranti-o-vuoto': if (corr) vuotaCorr(); else {
      let i = await monstroDa('aberranti');
      if (i.speciale === 'gremlin') { testo += ' ' + await gremlin(); break; }
      i = await bossCheck(i); avviaIncontro(i, t); testo += ` ${i.nome}${i.bossFinale ? ' (BOSS FINALE)' : ''}`;
    } break;
    case 'boss': testo += ' ' + await boss(t); break;
    case 'drago-o-vuoto': if (corr) vuotaCorr(); else {
      let i = creaIncontro('boss', mostriTabella('boss').find(m => m.drago), 1);
      i = await bossCheck(i); avviaIncontro(i, t); testo += ` ${i.nome}${i.bossFinale ? ' (BOSS FINALE)' : ''}`;
    } break;
  }
  t.contenuto = { testo, vuota };
  log(`Stanza ${t.n}: ${testo}`);
  modificato();
}

async function mostroMaggioreScelto2() {
  const tab = await scelta('Guardiano del tesoro', 'Quale tabella?', [['aberranti', 'Mostri aberranti'], ['boss', 'Mostri boss']]);
  return await monstroDa(tab || 'aberranti');
}

async function gremlin() {
  const r = await tira('1d6+3', 'Oggetti rubati dai gremlin');
  const t = `I gremlin invisibili rubano ${r.totale} oggetti (cancellali nell’ordine: magici, pergamene, pozioni, armi, gemme, monete a mucchietti da 10 p.o.).`;
  log(t); return t;
}

export async function caratteristica() {
  const r = await dado('Caratteristica speciale (d6)');
  const row = riga(tabella('caratteristiche'), r.totale);
  let t = `${row.nome}: ${row.testo}`;
  if (inCaos()) { t = `${row.nome}: ${await K.caratteristicaCaos(row)}`; log(t); modificato(); return t; }
  if (row.nome === 'Fontana') {
    if (!adv().fontanaUsata) { adv().fontanaUsata = true; eroiVivi().forEach(e => { if (e.stato === 'ok') e.pv = Math.min(e.pvMax, e.pv + 1); }); t += ' (applicata: +1 PV a tutti)'; }
    else t += ' (già usata in questa avventura: nessun effetto)';
  }
  if (row.nome === 'Altare maledetto') {
    const vivi = eroiVivi().filter(e => e.stato === 'ok');
    const bers = vivi[Math.floor(Math.random() * vivi.length)];
    if (bers) { bers.maledetto = true; t += ` → maledetto: ${bers.nome}`; }
  }
  log(t); modificato(); return t;
}

async function evento(t) {
  if (inCaos()) { const x = await K.eventoCaos(t); log(x); modificato(); return x; }
  const r = await dado('Evento speciale (d6)');
  const row = riga(tabella('eventi'), r.totale);
  let tx = `${row.nome}: ${row.testo}`;
  if (row.azione === 'errante-evento') {
    const x = await dado('Tipo di errante (evento: 1-3 inf., 4 seg., 5 aber., 6 boss)');
    const tab = x.totale <= 3 ? 'infestanti' : x.totale === 4 ? 'seguaci' : x.totale === 5 ? 'aberranti' : 'boss';
    const i = await monstroDa(tab, { errante: true }); i.nome += ' (erranti)'; avviaIncontro(i, t); tx += ` → ${i.nome} ×${i.n}`;
  } else if (row.azione === 'trappola') tx += ' ' + await trappola();
  else if (row.azione === 'missione') tx += ' (tira la missione dagli Strumenti se accetti)';
  else if (row.nome === 'Fantasma') await Eff.proponiFantasma({ liv: 4 });
  else if (row.nome === 'Guaritore errante') { if (adv().guaritoreVisto) { return evento(t); } adv().guaritoreVisto = true; }
  else if (row.nome === 'Alchimista errante') { if (adv().alchimistaVisto) { tx = 'Alchimista già incontrato: ' + await trappola(); } else adv().alchimistaVisto = true; }
  return tx;
}

export async function trappola(forzaLiv) {
  const r = await dado('Trappola (d6)');
  const row = riga(tabella('trappole'), r.totale);
  let liv = forzaLiv || row.liv;
  if (!forzaLiv && row.livExpr) liv = (await tira(row.livExpr, `Livello della trappola (${row.livExpr})`)).totale;
  const t = `Trappola – ${row.nome} (L${liv}): ${row.testo}`;
  adv().trappolaAttiva = { nome: row.nome, liv, testo: row.testo, caos: !!row.caos };
  log(t); modificato(); document.dispatchEvent(new CustomEvent('apri-tab', { detail: 'strumenti' }));
  await Eff.proponiTrappola(adv().trappolaAttiva);   // finestra con le azioni possibili (disarmare, subire, risolvere a mano)
  return t;
}

// ---------------- tesori ----------------
export async function tesoro(mod = 0, ctx = {}) {
  const r = await dado(`Tabella Tesori (d6${mod ? (mod > 0 ? '+' : '') + mod : ''})`);
  const v = r.totale + mod;
  const tab = tabella('tesori');
  const molt = (ctx.molt || 1) * (ctx.segreta ? 2 : 1);
  const voci = [];
  const aggiungi = (o) => { adv().bottino = adv().bottino || []; const b = { id: uid(), ...o }; adv().bottino.push(b); voci.push(b); };
  const esegui = async (row) => {
    switch (row.azione) {
      case 'niente': return;
      case 'scelta': {
        const k = await scelta(row.nome, 'Scegli cosa prendi:', row.opzioni.map((o, i) => [i, o.testo]));
        return esegui(row.opzioni[k ?? 0]);
      }
      case 'scegli-riga': {
        const base = tab.filter(x => x.da >= 1 && x.da <= 6);
        const k = await scelta('Tesoro a scelta', 'Scegli un risultato della tabella:', base.map((x, i) => [i, x.nome]));
        return esegui(base[k ?? 0]);
      }
      case 'oro': { const x = await tira(row.dadi, 'Monete d’oro'); let q = x.totale * molt; if (ctx.finale) q = Math.max(q * 3, 100); aggiungi({ tipo: 'oro', testo: `${q} pezzi d’oro`, valore: q }); return; }
      case 'pergamena': aggiungi(await generaPergamena(ctx.orcoSenzaMagia)); return;
      case 'pergamena-caos': aggiungi(await K.pergamenaCaos()); return;
      case 'pergamena-o-arma': {
        const k = await scelta('Pergamena o arma', 'A scelta:', [['p', 'Una pergamena con 1 incantesimo a caso'], ['a', 'Un’arma non magica (2 su 1d6 è d’argento)']]);
        if (k === 'a') {
          const x = await dado('L’arma è d’argento? (1-2 sì)');
          aggiungi({ tipo: 'oggetto', testo: x.totale <= 2 ? 'Arma non magica a scelta, d’ARGENTO (+20 p.o., +40 se a due mani; colpisce gli spettri)' : 'Arma non magica a scelta' });
        } else aggiungi(await generaPergamena(ctx.orcoSenzaMagia));
        return;
      }
      case 'arma': aggiungi({ tipo: 'oggetto', testo: 'Un’arma non magica a scelta' }); return;
      case 'equip': {
        const k = await scelta('Equipaggiamento', 'Scegli:', ['Fiala di acqua santa', 'Bende', 'Corda', 'Lanterna'].map(x => [x, x]));
        aggiungi({ tipo: 'oggetto', testo: k || 'Bende' }); return;
      }
      case 'utile': for (let i = 0; i < (row.n || 1); i++) aggiungi(await oggettoUtile()); return;
      case 'cristallo': aggiungi({ tipo: 'cristallo', testo: 'Cristallo del caos (Toccato dal caos + 1 incantesimo del caos; 5d6 p.o. se venduto)' }); return;
      case 'gemma': { const x = await tira(row.dadi, 'Valore gemma'); const q = x.totale * molt; aggiungi({ tipo: 'gemma', testo: `Gemma da ${q} p.o.`, valore: q }); return; }
      case 'gioiello': { const x = await tira(row.dadi, 'Valore gioiello'); const q = x.totale * molt; aggiungi({ tipo: 'gioiello', testo: `Gioiello da ${q} p.o.`, valore: q }); return; }
      case 'magico': { const n = ctx.finale ? 2 : 1; for (let i = 0; i < n; i++) aggiungi(await oggettoMagico(ctx.orcoSenzaMagia)); return; }
    }
  };
  const row = riga(tab, v);
  await esegui(row);
  if (row.azione === 'niente' && !voci.length) { log(`Tesoro (${v}): nessun tesoro.`); modificato(); return 'Nessun tesoro.'; }
  const testo = voci.map(b => b.testo).join('; ');
  log(`Tesoro (${v}): ${testo}`); modificato();
  return `Tesoro: ${testo}`;
}

async function generaPergamena(orco) {
  if (orco) { const x = await tira('1d6x1d6', 'Pergamena degli orchi = monete'); return { tipo: 'oro', testo: `${x.totale} p.o. (pergamena degli orchi)`, valore: x.totale }; }
  const lista = incantesimoACasoLista();
  const s = lista.length === 12 ? await d12('Incantesimo a caso (d12)') : (await dado('Incantesimo a caso (d6)')).totale;
  const nome = lista[s - 1];
  return { tipo: 'pergamena', testo: `Pergamena: ${nome}`, incantesimo: nome };
}
/** d12 = d6 + d6 «a due fasi» come fa il tavolo (1-6 poi 7-12 con un secondo dado). */
async function d12(label) { const a = await dado(label); const b = await dado(`${label} – metà`); return (b.totale <= 3 ? 0 : 6) + a.totale; }

/** Oggetti utili del supplemento (tabella d6). */
export async function oggettoUtile() {
  const r = await dado('Oggetti utili (d6)');
  const row = riga(tabella('oggettiUtili'), r.totale);
  let testo = `${row.nome}: ${row.testo}`;
  if (row.azione === 'scelta-equip') {
    const k = await scelta(row.nome, 'Scegli:', ['Arma a una mano (taglio o contundente)', 'Arco con 3d6 frecce', 'Bende', 'Corda', 'Lanterna', 'Sacchetto di sale (6 p.o.)'].map(x => [x, x]));
    testo = k || 'Bende';
  } else if (row.azione === 'stelle') { const x = await tira('1d6', 'Stelle da lancio'); testo = `${x.totale} stelle da lancio`; }
  else if (row.azione === 'polvere') { const x = await tira('1d3', 'Dosi di polvere melmicida'); testo = `Polvere melmicida (${x.totale} dosi): 1 azione per scagliarla contro cubi, melme, muffe e fungoidi: 2 PV a un maggiore o 2 minori uccisi. 40 p.o. a dose.`; }
  return { tipo: 'oggetto', testo, nome: row.nome };
}

export async function oggettoMagico(orco) {
  if (orco) { const x = await tira('2d6x1d6', 'Oggetto magico degli orchi = monete'); return { tipo: 'oro', testo: `${x.totale} p.o. (oggetto magico degli orchi)`, valore: x.totale }; }
  const r = await dado('Tesori magici (d6)');
  const row = riga(tabella('tesoriMagici'), r.totale);
  let testo = `${row.nome}: ${row.testo}`;
  const bonus = {}; let tipo = 'magico';
  const TIPI_ARMA = ['arma leggera da taglio', 'arma a una mano contundente', 'arma a una mano da taglio', 'arma a una mano da taglio', 'arma a due mani contundente', 'arma a due mani da taglio'];
  const TIPI_ARM = ['scudo', 'scudo', 'armatura leggera', 'armatura pesante', 'armatura pesante', 'anello magico di protezione (+1 alla difesa; non per barbari)'];
  switch (row.azione) {
    case 'arma-magica': {
      const w = await dado('Tipo di arma magica (d6)');
      const t = riga(tabella('armaMagica'), w.totale).nome;
      testo = `Arma magica (${t}) +1 all’attacco. Permanente.`; bonus.bonusArma = 1; bonus.armaTipo = t; break;
    }
    case 'arma-migliorata': {
      const b = await dado('Arma magica migliorata: bonus (1-4 = +1, 5-6 = +2)'); const w = await dado('Tipo di arma (d6)');
      const q = b.totale >= 5 ? 2 : 1; const t = TIPI_ARMA[w.totale - 1];
      testo = `Arma magica migliorata (${t}) +${q} all’attacco. Permanente.`; bonus.bonusArma = q; bonus.armaTipo = t; tipo = 'arma-magica'; break;
    }
    case 'armatura-magica': {
      const b = await dado('Armatura magica: bonus (1-4 = +1, 5-6 = +2)'); const w = await dado('Tipo di armatura (d6)');
      const q = w.totale === 6 ? 1 : (b.totale >= 5 ? 2 : 1); const t = TIPI_ARM[w.totale - 1];
      testo = `Armatura magica (${t}) +${q} alla difesa. Permanente.`; bonus.bonusDifesa = q; if (w.totale === 6) bonus.noBarbaro = true; tipo = 'armatura-magica'; break;
    }
    case 'fiale': {
      const n = (await tira('1d3+1', 'Numero di fiale')).totale; const c = [];
      for (let i = 0; i < n; i++) { const x = await dado(`Contenuto della fiala ${i + 1}`); c.push(x.totale <= 3 ? 'Pozione di Guarigione' : x.totale <= 5 ? 'Acido' : 'Acqua santa'); }
      testo = `${n} fiale: ${c.join(', ')}. (Guarigione: tutti i PV, azione gratuita, max 1 per avventura a testa, non per barbari. Acido: al posto di un attacco, 1d6: con 1 si rompe e ferisce chi lo lancia, con 2+ 1 PV a un maggiore o 1 minore ucciso; non su non-morti e golem. Acqua santa: 1 PV a spettri e demoni scheletrici.)`; break;
    }
    case 'bacchetta-potere': { const x = await tira('2d3', 'Cariche della bacchetta'); bonus.cariche = bonus.caricheMax = x.totale; bonus.manuale = true; bonus.solo = ['mago']; testo = `Bacchetta del potere (${x.totale} cariche): solo maghi, ogni carica aggiunge 1 livello a un incantesimo. Vale 25 p.o. per carica rimasta.`; break; }
    case 'rosario': { const x = await dado('Grani del rosario'); bonus.cariche = bonus.caricheMax = x.totale; bonus.manuale = true; bonus.solo = ['chierico']; testo = `Rosario (${x.totale} grani): quando un chierico recita una benedizione o guarigione tira 1d6: con 4+ non consuma il potere; ogni tiro consuma un grano. 10 p.o. per grano.`; break; }
  }
  const C0 = CARICHE_MAGICHE[row.nome];
  if (C0) Object.assign(bonus, { cariche: C0.n, caricheMax: C0.n, incantesimo: C0.inc, solo: C0.solo, manuale: !C0.inc });
  return { tipo, testo, nome: row.nome, ...bonus };
}
/** Oggetti magici con un numero limitato di usi: gli incantesimi si lanciano direttamente dal tasto in combattimento. */
const CARICHE_MAGICHE = {
  'Bacchetta del Sonno': { n: 3, inc: 'Sonno', solo: ['elfo', 'mago'] },
  'Bastone della Palla di Fuoco': { n: 2, inc: 'Palla di Fuoco', solo: ['mago'] },
  'Anello di teletrasporto': { n: 1 },
  'Oro degli stolti': { n: 1 }
};

// ---------------- perquisire ----------------
/** Tira il d6 della tabella "Perquisire una stanza vuota" (−1 nei corridoi) senza ancora applicarne gli effetti. */
export async function tiraPerquisizione(t) {
  const r = await dado(`Perquisire la stanza (d6${t.corridoio ? ', -1 corridoio' : ''})`);
  const v = Math.max(1, r.totale + (t.corridoio ? -1 : 0));
  return { v, row: riga(tabella('perquisire'), v), naturale: r.totale };
}
/** Applica l'esito: la stanza viene segnata con una "P" e, con 1, arrivano i mostri erranti. */
export async function concludiPerquisizione(t, res) {
  t.perquisita = true;
  log(`Perquisire stanza ${t.n}: tiro ${res.v} → ${res.row.testo}`);
  if (res.row.azione === 'errante') { const i = await monstroErrante(); avviaIncontro(i, t); }
  modificato();
}
export async function tesoroNascosto(t) {
  const c = await dado('Complicazione tesoro nascosto (d6)');
  const row = riga(tabella('tesoroNascostoComplicazioni'), c.totale);
  log(`Tesoro nascosto: ${row.testo}`);
  if (inCaos()) await K.complicazioneCaos(row, t);
  else if (row.azione === 'errante') { const i = await monstroErrante(); avviaIncontro(i, t); }
  else if (c.totale >= 3 && c.totale <= 5) await Eff.proponiTrappolaTesoro(c.totale);
  else if (c.totale === 6) { const l = await tira('1d3', 'Livello del fantasma (1d3+1)'); await Eff.proponiFantasma({ liv: l.totale + 1, scacciabile: true, motivo: `Un fantasma (LIV ${l.totale + 1}) protegge l'oro` }); }
  const x = await tira('3d6x3d6', 'Oro nascosto (3d6×3d6)');
  adv().bottino = adv().bottino || [];
  adv().bottino.push({ id: uid(), tipo: 'oro', testo: `${x.totale} pezzi d’oro (tesoro nascosto)`, valore: x.totale });
  log(`Tesoro nascosto: ${x.totale} p.o.`); modificato();
  return { complicazione: row, c: c.totale, oro: x.totale };
}
export async function portaSegreta() {
  const x = await dado('Scorciatoia sicura? (6 = sì)');
  if (x.totale === 6) { adv().scorciatoia = true; log('Porta segreta: scorciatoia sicura verso l’uscita!'); }
  modificato();
  return x.totale === 6;
}

// ---------------- esperienza ----------------
export function aggiungiES(motivo, meno1 = false, quanti = 1) {
  adv().esPendenti = adv().esPendenti || [];
  for (let i = 0; i < quanti; i++) adv().esPendenti.push({ id: uid(), motivo, meno1 });
  log(`Tiro esperienza guadagnato: ${motivo}${meno1 ? ' (a -1)' : ''}.`);
  modificato();
}
export function eroePuoSalire(e) {
  const altri = eroiVivi().filter(x => x.id !== e.id);
  if (e.livello >= 5 && altri.some(x => x.livello < 5)) return false;
  if (S.adv.ultimoLivello === e.id && altri.length && !altri.every(x => x.livello >= 5)) return false;
  return true;
}
export async function tiroES(es, e) {
  const r = await d6Esplosivo(`Tiro ES di ${e.nome} (deve superare il livello ${e.livello})`);
  const tot = r.totale + (es.meno1 ? -1 : 0) + (inCaos() ? 1 : 0) + (e.bonusES || 0) + ((e.tratti || []).some(t => t.id === 'lesto-esperienza') ? 1 : 0);
  const ok = r.naturale !== 1 && tot > e.livello;
  adv().esPendenti = adv().esPendenti.filter(x => x.id !== es.id);
  if (ok) {
    e.livello++; e.pvMax++; e.pv++; adv().ultimoLivello = e.id;
    if (e.classe === 'mezzuomo') { /* un punto fortuna in più: calcolato dal livello */ }
    log(`${e.nome} sale al livello ${e.livello}! (tiro ${tot})`);
  } else log(`${e.nome} non sale di livello (tiro ${tot}).`);
  modificato();
  return { ok, tot };
}

export function vittoria(inc) {
  if (inc.bossFinale) { adv().bossFinaleUcciso = true; log('Il boss finale è stato sconfitto: si può lasciare il dungeon.'); }
  const mid = adv().missione?.id;
  if (mid === 'cuoco') return;                              // la missione del cuoco non dà ES per i mostri
  if (mid === 'salvataggio' && inc.minore) return;          // niente ES dai minori
  if (inc.errante && inc.minore && inc.tabella === 'infestanti') return;
  if (!inc.minore) {
    if (inc.speciale === 'gremlin') return;
    adv().maggioriSconfitti = (adv().maggioriSconfitti || 0) + 1;
    const draghi = inc.drago && inc.bossFinale;
    aggiungiES(`${inc.nome} sconfitto`, false, draghi ? 2 : 1);
  } else if (inc.tabella === 'seguaci' || inc.xp) {
    if (inc.tabella === 'infestanti' && !inc.xp) return;
    adv().incontriSeguaci = (adv().incontriSeguaci || 0) + 1;
    if (adv().incontriSeguaci >= 10) { adv().incontriSeguaci = 0; aggiungiES('10 incontri con seguaci', true); }
  }
  modificato();
}

// ---------------- indizi ----------------
export async function aggiungiIndizio(eroe) {
  eroe.indizi = (eroe.indizi || 0) + 1;
  log(`${eroe.nome} trova un indizio (${eroe.indizi}/3).`);
  if (eroe.indizi >= 3) {
    eroe.indizi = 0;
    aggiungiES(`${eroe.nome}: segreto scoperto (3 indizi)`);
    modal(`${eroe.nome} ha scoperto un segreto!`, (b, close) => {
      b.append(h('p', {}, 'Scegli un effetto di gioco (annotalo nelle note dell’eroe):'));
      const lista = h('div', { class: 'list' });
      [...R.tabelle.indizi, ...(inCaos() ? R.caos.tabelle.segretiCaos : [])].forEach(s => lista.append(h('button', { class: 'item-btn', onclick: () => {
        eroe.segreti = [...(eroe.segreti || []), s.nome]; T.evento(eroe, 'segreti'); log(`${eroe.nome} sceglie il segreto: ${s.nome}.`); modificato(); close();
      } }, h('b', {}, s.nome), h('span', {}, s.testo))));
      b.append(lista);
    }, { wide: true });
  }
  modificato();
}
