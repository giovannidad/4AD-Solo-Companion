// Flusso di gioco: avventura, generazione stanze, contenuti, tesori, ricerche, esperienza.
import { R, S, log, modificato, eroiVivi, livelloMax, eroePerId, emit } from './state.js';
import { tira, d66, dado, d6Esplosivo } from './dice.js';
import { riga, tabella, creaIncontro } from './rules.js';
import * as table from './map2d.js';
import { toast, uid, modal, h } from './util.js';

const adv = () => S.adv;
export const tileById = id => adv().tessere.find(t => t.id === id);

/** Crea i dati di una tessera; la dimensione in quadretti deriva dalla griglia misurata sull'immagine. */
function nuovaTessera(tipo, n) {
  const m = tipo === 'ingresso' ? R.tiles.ingressi[n] : R.tiles.tiles[n];
  return {
    id: uid(), tipo, n, src: `/assets/${tipo === 'ingresso' ? 'ingressi' : 'tiles'}/${n}.png`,
    w: m.w, h: m.h, cx: m.cx, cy: m.cy, ox: m.ox, oy: m.oy,
    x: 10, z: 14, rot: 0, flip: false, scale: 1, pending: false, nome: `Stanza ${n}`, corridoio: false, contenuto: null, perquisita: false
  };
}

/** Sposta i personaggi che si trovano in `da` nella stanza `a` (il gruppo si muove unito). */
export function muoviGruppo(da, a) {
  S.party.eroi.forEach(e => { if (e.posizione === da || !e.posizione) e.posizione = a; });
}

// ---------------- avventura ----------------
export async function iniziaAvventura() {
  if (!eroiVivi().length) { toast('Crea prima almeno un eroe nel gruppo.', 'warn'); return false; }
  Object.assign(S.adv, {
    attiva: true, numero: (S.adv.numero || 0) + 1, stanze: 0, tessere: [], stanzaCorrente: null, incontro: null, coda: [],
    maggioriSconfitti: 0, incontriSeguaci: 0, esPendenti: [], bottino: [], fine: null,
    guaritoreVisto: false, alchimistaVisto: false, fontanaUsata: false, dama: false, maledizioniNote: []
  });
  // tra un'avventura e l'altra le ferite guariscono e gli usi si ricaricano
  for (const e of S.party.eroi) {
    if (e.stato === 'morto') continue;
    e.pv = e.pvMax; e.stato = 'ok'; e.maledetto = false; e.zoppo = false;
    e.usi = { benedizione: 0, guarigione: 0, furie: 0, fortuna: 0, bende: 0, pozione: 0 };
    (e.incantesimi || []).forEach(s => { s.usato = false; });
  }
  table.setTiles([]);
  const r = await dado('Stanza d’ingresso (d6)');
  const idx = r.totale;
  const t = nuovaTessera('ingresso', String(idx));
  t.nome = `Ingresso ${idx}`; t.contenuto = { testo: 'Stanza d’ingresso (sempre vuota).', vuota: true, ingresso: true };
  table.placeBottom(t);
  adv().tessere.push(t); adv().stanzaCorrente = t.id;
  S.party.eroi.forEach(e => { e.posizione = t.id; });
  table.setTiles(adv().tessere);
  table.selectTile(null); table.animate(t.id);
  log(`Inizia l’avventura n. ${adv().numero}. Ingresso ${idx}.`);
  toast(`Ingresso ${idx}: la stanza viene disegnata sul foglio.`);
  modificato();
  return true;
}

export function terminaAvventura(esito) {
  adv().attiva = false; adv().fine = esito;
  log(`Avventura conclusa: ${esito}.`);
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
async function monstroDa(nomeTab, opzioni = {}) {
  let voce, v;
  do {
    const r = await dado(`Tabella mostri ${nomeTab}`);
    v = r.totale; voce = R.mostri[nomeTab][v - 1];
  } while (opzioni.errante && voce.drago);
  let quantita = 1, nome = voce.nome, extra = {};
  if (voce.speciale === 'scheletri-o-zombi') {
    const t = await dado('Scheletri (1-3) o zombi (4-6)');
    if (t.totale <= 3) { nome = 'Scheletri'; extra.contundentePiu = true; quantita = (await tira('1d6+2', 'Numero scheletri')).totale; }
    else { nome = 'Zombi'; quantita = (await tira('1d6', 'Numero zombi')).totale; }
  } else if (voce.conta && voce.conta !== '1') {
    quantita = (await tira(voce.conta, `Numero ${voce.nome}`)).totale;
  }
  const inc = creaIncontro(nomeTab, { ...voce, nome }, quantita, opzioni);
  if (voce.id === 'ratti-scheletrici') inc.contundentePiu = true;
  Object.assign(inc, extra);
  return inc;
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
  const r = await dado('Boss finale? (1d6 + maggiori sconfitti)');
  const tot = r.totale + adv().maggioriSconfitti;
  log(`Boss finale? ${r.totale} + ${adv().maggioriSconfitti} = ${tot}${tot >= 6 ? ' → È IL BOSS FINALE!' : ''}`);
  if (tot >= 6) return creaIncontro(inc.tabella, R.mostri[inc.tabella].find(m => m.id === inc.id), 1, { bossFinale: true });
  return inc;
}
async function boss(tessera, forzaFinale = false) {
  let inc = await monstroDa('boss');
  if (forzaFinale) inc = creaIncontro('boss', R.mostri.boss.find(m => m.id === inc.id), 1, { bossFinale: true });
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
    case 'vuota-speciale': vuota = true; testo += ' ' + await caratteristica(); break;
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
      let i = creaIncontro('boss', R.mostri.boss.find(m => m.id === 'piccolo-drago'), 1);
      i = await bossCheck(i); avviaIncontro(i, t); testo += ` ${i.nome}${i.bossFinale ? ' (BOSS FINALE)' : ''}`;
    } break;
  }
  t.contenuto = { testo, vuota };
  log(`Stanza ${t.n}: ${testo}`);
  modificato();
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
  const r = await dado('Evento speciale (d6)');
  const row = riga(tabella('eventi'), r.totale);
  let tx = `${row.nome}: ${row.testo}`;
  if (row.azione === 'errante-evento') {
    const x = await dado('Tipo di errante (evento: 1-3 inf., 4 seg., 5 aber., 6 boss)');
    const tab = x.totale <= 3 ? 'infestanti' : x.totale === 4 ? 'seguaci' : x.totale === 5 ? 'aberranti' : 'boss';
    const i = await monstroDa(tab, { errante: true }); i.nome += ' (erranti)'; avviaIncontro(i, t); tx += ` → ${i.nome} ×${i.n}`;
  } else if (row.azione === 'trappola') tx += ' ' + await trappola();
  else if (row.azione === 'missione') tx += ' (tira la missione dagli Strumenti se accetti)';
  else if (row.nome === 'Guaritore errante') { if (adv().guaritoreVisto) { return evento(t); } adv().guaritoreVisto = true; }
  else if (row.nome === 'Alchimista errante') { if (adv().alchimistaVisto) { tx = 'Alchimista già incontrato: ' + await trappola(); } else adv().alchimistaVisto = true; }
  return tx;
}

export async function trappola(forzaLiv) {
  const r = await dado('Trappola (d6)');
  const row = riga(tabella('trappole'), r.totale);
  const t = `Trappola – ${row.nome} (L${forzaLiv || row.liv}): ${row.testo}`;
  adv().trappolaAttiva = { nome: row.nome, liv: forzaLiv || row.liv, testo: row.testo };
  log(t); modificato(); document.dispatchEvent(new CustomEvent('apri-tab', { detail: 'strumenti' }));
  return t;
}

// ---------------- tesori ----------------
export async function tesoro(mod = 0, ctx = {}) {
  const r = await dado(`Tabella Tesori (d6${mod ? (mod > 0 ? '+' : '') + mod : ''})`);
  const v = r.totale + mod;
  const row = riga(tabella('tesori'), v);
  const molt = (ctx.molt || 1) * (ctx.segreta ? 2 : 1);
  const voci = [];
  const aggiungi = (o) => { adv().bottino = adv().bottino || []; const b = { id: uid(), ...o }; adv().bottino.push(b); voci.push(b); };
  switch (row.azione) {
    case 'niente': log(`Tesoro (${v}): nessun tesoro.`); modificato(); return 'Nessun tesoro.';
    case 'oro': { const x = await tira(row.dadi, 'Monete d’oro'); let q = x.totale * molt; if (ctx.finale) q = Math.max(q * 3, 100); aggiungi({ tipo: 'oro', testo: `${q} pezzi d’oro`, valore: q }); break; }
    case 'pergamena': aggiungi(await generaPergamena(ctx.orcoSenzaMagia)); break;
    case 'gemma': { const x = await tira(row.dadi, 'Valore gemma'); aggiungi({ tipo: 'gemma', testo: `Gemma da ${x.totale * molt} p.o.`, valore: x.totale * molt }); break; }
    case 'gioiello': { const x = await tira(row.dadi, 'Valore gioiello'); aggiungi({ tipo: 'gioiello', testo: `Gioiello da ${x.totale * molt} p.o.`, valore: x.totale * molt }); break; }
    case 'magico': {
      const n = ctx.finale ? 2 : 1;
      for (let i = 0; i < n; i++) aggiungi(await oggettoMagico(ctx.orcoSenzaMagia));
      break;
    }
  }
  const testo = voci.map(b => b.testo).join('; ');
  log(`Tesoro (${v}): ${testo}`); modificato();
  return `Tesoro: ${testo}`;
}

async function generaPergamena(orco) {
  if (orco) { const x = await tira('1d6x1d6', 'Pergamena degli orchi = monete'); return { tipo: 'oro', testo: `${x.totale} p.o. (pergamena degli orchi)`, valore: x.totale }; }
  const s = await dado('Incantesimo a caso (d6)');
  const nome = R.tabelle.incantesimoCaso[s.totale - 1];
  return { tipo: 'pergamena', testo: `Pergamena: ${nome}`, incantesimo: nome };
}
export async function oggettoMagico(orco) {
  if (orco) { const x = await tira('2d6x1d6', 'Oggetto magico degli orchi = monete'); return { tipo: 'oro', testo: `${x.totale} p.o. (oggetto magico degli orchi)`, valore: x.totale }; }
  const r = await dado('Tesori magici (d6)');
  const row = riga(tabella('tesoriMagici'), r.totale);
  let testo = `${row.nome}: ${row.testo}`;
  const bonus = {};
  if (row.azione === 'arma-magica') {
    const w = await dado('Tipo di arma magica (d6)');
    const tipo = riga(tabella('armaMagica'), w.totale).nome;
    testo = `Arma magica (${tipo}) +1 all’attacco. Permanente.`; bonus.bonusArma = 1; bonus.armaTipo = tipo;
  }
  return { tipo: 'magico', testo, nome: row.nome, ...bonus };
}

// ---------------- perquisire ----------------
export async function perquisisci(t) {
  const r = await dado(`Perquisire la stanza (d6${t.corridoio ? ', -1 corridoio' : ''})`);
  const v = r.totale + (t.corridoio ? -1 : 0);
  t.perquisita = true;
  const row = riga(tabella('perquisire'), v);
  log(`Perquisire stanza ${t.n}: ${v} → ${row.testo}`);
  if (row.azione === 'errante') { const i = await monstroErrante(); avviaIncontro(i, t); }
  modificato();
  return { v, row };
}
export async function tesoroNascosto(t) {
  const c = await dado('Complicazione tesoro nascosto (d6)');
  const row = riga(tabella('tesoroNascostoComplicazioni'), c.totale);
  log(`Tesoro nascosto: ${row.testo}`);
  if (row.azione === 'errante') { const i = await monstroErrante(); avviaIncontro(i, t); }
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
  const tot = r.totale + (es.meno1 ? -1 : 0);
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
      R.tabelle.indizi.forEach(s => lista.append(h('button', { class: 'item-btn', onclick: () => {
        eroe.segreti = [...(eroe.segreti || []), s.nome]; log(`${eroe.nome} sceglie il segreto: ${s.nome}.`); modificato(); close();
      } }, h('b', {}, s.nome), h('span', {}, s.testo))));
      b.append(lista);
    }, { wide: true });
  }
  modificato();
}
