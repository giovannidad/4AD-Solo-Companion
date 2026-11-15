// Supplemento «Contro il Caos»: Caverne del Caos, «Toccato dal caos», follia, missioni e incantesimi del caos.
import { R, S, log, modificato, eroiVivi, eroiAttivi, eroePerId, nuovoEroe } from './state.js';
import { dado, tira, d6Esplosivo } from './dice.js';
import { riga } from './rules.js';
import { h, modal, toast, scelta, sceltaMultipla, confirmBox, uid } from './util.js';
import { equipaggiamentoIniziale } from './party.js';
import * as G from './game.js';
import * as C from './combat.js';
import * as T from './tratti.js';

const adv = () => S.adv;
const CT = () => R.caos.tabelle;

// ---------------- scelte ----------------
export function eroeScelto(titolo, filtro = e => e.stato !== 'morto') {
  const lista = S.party.eroi.filter(filtro);
  if (lista.length <= 1) return Promise.resolve(lista[0] || null);
  return scelta(titolo, '', lista.map(e => [e.id, e.nome, `${e.livello}° livello · ${e.pv}/${e.pvMax} PV`])).then(id => lista.find(e => e.id === id) || null);
}
export const casuale = arr => arr[Math.floor(Math.random() * arr.length)];
export const eroeCasuale = () => casuale(eroiAttivi());

// ---------------- follia e contaminazione ----------------
export function follia(e, n = 1) {
  const minimo = (e.tratti || []).some(t => t.id === 'folle') ? 1 : 0;   // il tratto Folle non scende mai sotto 1 punto
  e.follia = Math.max(minimo, (e.follia || 0) + n);
  log(`${e.nome} ${n > 0 ? 'riceve' : 'perde'} ${Math.abs(n)} punt${Math.abs(n) === 1 ? 'o' : 'i'} follia (totale ${e.follia}).`);
  modificato('party');
}

/** Il personaggio rinasce come mostro aberrante del caos e attacca il gruppo. */
export async function rinasciComeMostro(e) {
  e.stato = 'morto'; e.caosTrasf = false;
  const inc = await G.monstroDa('aberranti');
  inc.nome = `${e.nome} trasformato (${inc.nome})`; inc.tes = 'NO';
  log(`${e.nome} si trasforma in ${inc.nome}! L’equipaggiamento cade a terra.`);
  G.avviaIncontro(inc, G.tileById(adv().stanzaCorrente));
  toast(`${e.nome} è diventato un mostro del caos!`, 'warn');
}
document.addEventListener('caos-rinasci', ev => { const e = S.party.eroi.find(x => x.id === ev.detail); if (e) rinasciComeMostro(e); });

export async function toccatoDalCaos(e) {
  const corrotto = (e.tratti || []).some(t => t.id === 'corrotto');
  let r = await dado(`Toccato dal caos – ${e.nome}`);
  if (e.classe === 'mezzuomo') {
    const ritira = await scelta('Toccato dal caos', `${e.nome} ha ottenuto ${r.totale + (corrotto ? 1 : 0)}. I mezzuomini possono ritirare 1 volta senza usare punti fortuna.`, [[false, 'Tieni il risultato'], [true, 'Ritira']]);
    if (ritira) r = await dado(`Toccato dal caos (ritiro) – ${e.nome}`);
  }
  const v = r.totale + (corrotto ? 1 : 0);
  const row = riga(CT().toccatoDalCaos, v);
  log(`Toccato dal caos (${v}): ${e.nome} → ${row.azione}.`);
  switch (row.azione) {
    case 'pv': C.perdiPV(e, 1, 'Toccato dal caos'); break;
    case 'pv-follia': C.perdiPV(e, 1, 'Toccato dal caos'); follia(e, 1); break;
    case 'pv-follia-rischio':
      C.perdiPV(e, 1, 'Toccato dal caos'); follia(e, 1);
      if (e.stato === 'morto') await rinasciComeMostro(e);
      else toast('Se impazzisci per questo, rinascerai come mostro del caos.', 'warn');
      break;
    case 'trasformazione': e.caosTrasf = true; log(`${e.nome} inizia a trasformarsi in un mostro del caos (uccidi da solo un maggiore e ricevi una Benedizione per fermarlo).`); break;
  }
  modificato('party');
  return row.testo;
}

/** La Benedizione e il rituale fermano la trasformazione se il personaggio ha ucciso da solo un maggiore. */
export function fermaTrasformazione(e) { if (e.caosTrasf) { e.caosTrasf = false; log(`${e.nome} non si trasformerà più in un mostro del caos.`); } }
export const contaminato = e => !!e.caosTrasf;

// ---------------- pergamene e incantesimi del caos ----------------
export async function incantesimoCaos() {
  const r = await dado('Incantesimo del caos (d6)');
  return R.caos.tabelle.incantesimoCaso[r.totale - 1];
}
export async function pergamenaCaos() {
  const nome = await incantesimoCaos();
  return { tipo: 'pergamena', incantesimo: nome, testo: `Pergamena del caos: ${nome}`, caos: true };
}
/** Un cristallo del caos: chi lo prende tira su «Toccato dal caos» e ottiene un incantesimo del caos lanciabile una volta. */
export async function usaCristallo(e) {
  await toccatoDalCaos(e);
  const nome = await incantesimoCaos();
  (e.incantesimi = e.incantesimi || []).push({ nome, usato: false, spontaneo: true });
  log(`${e.nome} ottiene dal cristallo l’incantesimo del caos «${nome}» (un solo lancio).`);
  modificato('party');
}

// ---------------- caratteristiche speciali ----------------
export async function caratteristicaCaos(row) {
  const vivi = eroiAttivi();
  switch (row.azione) {
    case 'offerte': {
      const chi = await sceltaMultipla(row.nome, 'Chi mangia e beve i doni?', vivi.map(e => [e.id, e.nome]));
      let t = '';
      for (const id of chi) {
        const e = S.party.eroi.find(x => x.id === id); const r = await dado(`Offerte del caos – ${e.nome}`);
        if (r.totale === 1) { await toccatoDalCaos(e); t += ` ${e.nome}: toccato dal caos.`; }
        else if (r.totale >= 5) {
          const s = await scelta(e.nome, 'Scegli il dono:', [['cura', 'Guarisci 1d3 PV'], ['att', '+1 a tutti gli attacchi nel prossimo incontro']]);
          if (s === 'att') { e.bonusIncontro = 1; t += ` ${e.nome}: +1 agli attacchi.`; }
          else { const x = await tira('1d3', 'Cura'); e.pv = Math.min(e.pvMax, e.pv + x.totale); t += ` ${e.nome}: +${x.totale} PV.`; }
        } else t += ` ${e.nome}: nulla.`;
      }
      return t;
    }
    case 'cristalli': {
      const x = await tira('1d6', 'Cristalli del caos (1d6-1)'); const n = Math.max(1, x.totale - 1);
      adv().bottino = adv().bottino || [];
      for (let i = 0; i < n; i++) adv().bottino.push({ id: uid(), tipo: 'cristallo', testo: 'Cristallo del caos (Toccato dal caos + 1 incantesimo del caos; 5d6 p.o. se venduto)' });
      return `${n} cristall${n === 1 ? 'o' : 'i'} del caos nel bottino.`;
    }
    case 'orrore': {
      vivi.forEach(e => follia(e, 1));
      await C.salvaTutti('Camera dell’orrore', 7, e => (['chierico', 'mago'].includes(e.classe) ? 1 : 0), e => { e.maledetto = true; log(`${e.nome}: -1 alle difese finché non riceve una Benedizione.`); });
      return 'Tutti ricevono 1 punto follia; chi fallisce ha -1 alla difesa (Benedizione per toglierlo).';
    }
    case 'catturato': {
      const x = await dado('Mostro prigioniero (tabella boss base)'); const m = R.mostri.boss[x.totale - 1];
      const s = await scelta('Catturato dal caos', `Un ${m.nome} è tenuto prigioniero.`, [['lascia', 'Lascialo stare'], ['uccidi', 'Uccidilo (niente ES né tesori)'], ['libera', 'Liberalo']]);
      if (s === 'libera') {
        const d = await scelta(m.nome, 'In segno di gratitudine…', [['indizio', '1 indizio'], ['pergamena', 'Posizione di una pergamena del caos']]);
        if (d === 'indizio') { const e = await eroeScelto('Chi riceve l’indizio?'); if (e) await G.aggiungiIndizio(e); }
        else if (d === 'pergamena') { const p = await pergamenaCaos(); (adv().bottino = adv().bottino || []).push({ id: uid(), ...p }); }
      }
      return `Prigioniero: ${m.nome} (${s || 'lasciato'}).`;
    }
    case 'tomi': {
      const err = await dado('Mostri erranti durante lo studio (1 = arrivano)');
      if (err.totale === 1) { const i = await G.monstroErrante(); G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); }
      const e = await eroeScelto('Chi studia i tomi?', x => x.stato === 'ok'); if (!e) return 'Nessuno studia i tomi.';
      await G.aggiungiIndizio(e);
      const p = await dado('Pergamena del caos nei tomi (1-2 = trovata)');
      if (p.totale <= 2) { const pg = await pergamenaCaos(); (adv().bottino = adv().bottino || []).push({ id: uid(), ...pg }); }
      const f = await dado('Follia dai tomi (1 = +1 follia)'); if (f.totale === 1) follia(e, 1);
      const t = await dado('Toccato dal caos dai tomi (1-2)'); if (t.totale <= 2) await toccatoDalCaos(e);
      return `${e.nome} studia i tomi blasfemi.`;
    }
    case 'puzzle': return await puzzle('Stanza del puzzle', null);
  }
  return row.testo;
}

/** Scatola puzzle: livello = livello fisso oppure 2d6 se non indicato. */
export async function puzzle(titolo, livello) {
  const e = await eroeScelto('Chi tenta il puzzle?', x => x.stato === 'ok'); if (!e) return 'Nessun eroe può tentare il puzzle.';
  const L = livello ?? (await tira('2d6', 'Livello del puzzle (2d6)')).totale;
  let esito = null;
  while (esito === null) {
    const r = await d6Esplosivo(`Puzzle di L${L} – ${e.nome}`);
    const bonus = ['mago', 'furfante'].includes(e.classe) ? e.livello : 0;
    const tot = r.totale + bonus;
    if (r.naturale !== 1 && tot >= L) { esito = true; log(`${e.nome} risolve il puzzle (${tot} contro L${L}).`); break; }
    const s = await scelta(titolo, `${e.nome} fallisce (${tot} contro L${L}). Paghi: `, [['pv', 'Perdi 1 PV'], ['follia', 'Ricevi 1 punto follia']]);
    if (s === 'follia') follia(e, 1); else C.perdiPV(e, 1, 'puzzle');
    if (e.stato !== 'ok') { esito = false; break; }
    const ancora = await scelta(titolo, 'Riprovi?', [[true, 'Riprova'], [false, 'Rinuncia']]);
    if (!ancora) esito = false;
  }
  if (esito) {
    const t = await G.tesoro(0, {});
    const o = Math.round(L * 10); (adv().bottino = adv().bottino || []).push({ id: uid(), tipo: 'oro', testo: `${o} pezzi d’oro (scatola L${L})`, valore: o });
    return `Puzzle risolto: ${t} + ${o} p.o.`;
  }
  return 'Il puzzle resta irrisolto.';
}

// ---------------- eventi unici ----------------
export async function eventoCaos(t) {
  const usati = adv().eventiUsati = adv().eventiUsati || [];
  const tab = CT().eventi;
  if (usati.length >= tab.length) return await G.mostroMaggioreScelto(t);
  let row;
  do { const r = await dado('Evento unico (d6)'); row = riga(tab, r.totale); } while (usati.includes(row.azione));
  usati.push(row.azione);
  return `${row.nome}: ${await eseguiEvento(row, t)}`;
}
async function eseguiEvento(row, t) {
  const vivi = eroiAttivi();
  switch (row.azione) {
    case 'verbo': {
      const e = await eroeScelto('Chi legge il libro?', x => x.stato === 'ok'); if (!e) return row.testo;
      const x = await tira('1d6', 'Indizi dal libro'); for (let i = 0; i < x.totale; i++) await G.aggiungiIndizio(e);
      const ok = await C.salva(e, x.totale + 2, ['chierico', 'mago'].includes(e.classe) ? Math.floor(e.livello / 2) : 0, 'Verbo del caos');
      if (!ok) { follia(e, 1); await toccatoDalCaos(e); }
      return `${e.nome} guadagna ${x.totale} indizi${ok ? '' : ', ma impazzisce un po’'}.`;
    }
    case 'infezione': {
      const e = eroeCasuale(); if (!e) return '';
      if (!(await C.salva(e, 5, 0, 'Infezione del caos'))) await toccatoDalCaos(e);
      return `${e.nome} è esposto all’infezione.`;
    }
    case 'sciame': {
      const s = await scelta('Sciame di creature', 'Hai un incantesimo Palla di Fuoco da lanciare?', [[true, 'Sì, lo distruggo'], [false, 'No: tutti perdono 1 PV']]);
      if (!s) vivi.forEach(e => C.perdiPV(e, 1, 'sciame'));
      return s ? 'Lo sciame è distrutto dalla Palla di Fuoco.' : 'Tutti perdono 1 PV.';
    }
    case 'scale': {
      for (let k = 0; k < 2; k++) { const i = await G.monstroDa('aberranti'); i.tes = 'NO'; i.nome += ' (guardiano)'; G.avviaIncontro(i, t); }
      return 'Due aberranti custodiscono i piani di battaglia (3 indizi se vinci, nessun tesoro).';
    }
    case 'aiuto': {
      const s = await scelta('Aiuto dall’alto', 'Scegli l’aiuto:', [['cura', 'Guarisci tutte le ferite di un eroe incontaminato'], ['follia', 'Togli 1 punto follia'], ['ferita', 'Cura 1 ferita (anche se contaminato)'], ['utile', 'Cerca un oggetto utile']]);
      if (s === 'cura') { const e = await eroeScelto('Chi guarisce?', x => x.stato !== 'morto' && !x.caosTrasf); if (e) { e.pv = e.pvMax; log(`${e.nome} guarisce del tutto.`); } }
      else if (s === 'follia') { const e = await eroeScelto('Chi perde 1 follia?', x => (x.follia || 0) > 0 && x.stato !== 'morto'); if (e) follia(e, -1); }
      else if (s === 'ferita') { const e = await eroeScelto('Chi guarisce 1 PV?'); if (e) { e.pv = Math.min(e.pvMax, e.pv + 1); log(`${e.nome} guarisce 1 PV.`); } }
      else if (s === 'utile') { const o = await G.oggettoUtile(); (adv().bottino = adv().bottino || []).push({ id: uid(), ...o }); }
      modificato(); return 'Uno spirito dell’ordine aiuta il gruppo.';
    }
    case 'risucchio': {
      let persi = 0;
      for (const e of vivi) for (const sp of (e.incantesimi || [])) {
        if (sp.usato || sp.daPergamena) continue;
        if (!(await C.salva(e, 7, Math.floor(e.livello / 2), `Risucchio di mana (${sp.nome})`))) { sp.usato = true; persi++; }
      }
      modificato('party'); return `${persi} incantesimi perduti.`;
    }
  }
  return row.testo;
}

// ---------------- complicazioni dei tesori nascosti ----------------
export async function complicazioneCaos(row, t) {
  switch (row.azione) {
    case 'errante': { const i = await G.monstroErrante(); G.avviaIncontro(i, t); break; }
    case 'toccato': { const e = await eroeScelto('Chi raccoglie il tesoro?', x => x.stato === 'ok'); if (e) await toccatoDalCaos(e); break; }
    case 'trappola': { const x = await dado('Livello della trappola (d6)'); await G.trappola(x.totale); break; }
    case 'puzzle': { await puzzle('Scatola puzzle', 7); break; }
    case 'lite': {
      const v = eroiAttivi(); if (v.length < 2) break;
      const a = casuale(v), b = casuale(v.filter(x => x !== a));
      if (!(await C.salva(a, b.livello, 0, `Lite con ${b.nome}`))) C.perdiPV(a, 1, 'lite');
      if (!(await C.salva(b, a.livello, 0, `Lite con ${a.nome}`))) C.perdiPV(b, 1, 'lite');
      break;
    }
    case 'vuoto': {
      const i = G.creaSpeciale('mostroVuoto'); G.avviaIncontro(i, t); break;
    }
  }
}

// ---------------- missioni ----------------
export async function scegliMissione() {
  const tab = CT().missioni;
  const id = await scelta('Missione contro il caos', 'Scegli lo scenario o lascia decidere ai dadi.',
    [...tab.map(m => [m.id, `${m.nome} (L${m.liv})`, m.testo.slice(0, 110) + '…']), ['dado', 'Tira 1d6', 'Scenario casuale']]);
  let m;
  if (id === 'dado' || id === null) { const r = await dado('Missione contro il caos (d6)'); m = riga(tab, r.totale); }
  else m = tab.find(x => x.id === id);
  return { id: m.id, nome: m.nome, liv: m.liv, es: m.es, testo: m.testo, obiettivo: m.obiettivo, bossFinale: m.bossFinale || null, completata: false, salvati: 0, indiziNecessari: m.indiziNecessari || 0, indiziMissione: 0, sbloccata: false };
}

/** Quanti livelli sopra quello consigliato è il gruppo (modifica mostri minori e PV dei maggiori). */
export function differenzaLivello() {
  const m = adv().missione; if (!m) return 0;
  const v = eroiVivi(); if (!v.length) return 0;
  const media = Math.floor(v.reduce((a, e) => a + e.livello, 0) / v.length);
  return Math.max(0, media - m.liv);
}

export async function generaBossMissione() {
  const m = adv().missione; if (!m) return;
  const t = G.tileById(adv().stanzaCorrente);
  let inc;
  if (m.id === 'cuoco') inc = G.creaSpeciale('signoreCuoco');
  else if (m.id === 'signore') inc = G.creaSpeciale('signoreDistruzione', true);
  else if (m.id === 'ascia') { inc = G.creaSpeciale('carnefice', true); inc.nome += ' (con l’ascia di Nydann)'; }
  else if (m.id === 'arazzo') {
    const r = await dado('Custode dell’arazzo (1-3 aberrante, 4-6 boss)');
    inc = await G.monstroDa(r.totale <= 3 ? 'aberranti' : 'boss'); inc.nome += ' (custode dell’arazzo)';
  } else return;
  if (m.id === 'cuoco') { inc.mostriPrima = false; }
  inc.missioneBoss = m.id;
  G.avviaIncontro(inc, t);
  log(`Missione «${m.nome}»: ${inc.nome} appare.`);
}

/** La missione sostituisce il contenuto della stanza appena posizionata (boss del cuoco alla 10ª stanza, custodi di arazzo e ascia). */
export async function contenutoMissione(t) {
  const m = adv().missione; if (!m || m.completata || m.bossGenerato) return false;
  let boss = false;
  if (m.id === 'cuoco' && adv().stanze === 10) {
    const cuoco = S.party.eroi.find(e => e.png === 'cuoco');
    if (cuoco && cuoco.stato !== 'morto') boss = true; else log('Il mezzuomo cuoco è caduto: il cibo avvelenato non può essere consegnato e la missione è fallita.');
  }
  if (['arazzo', 'ascia'].includes(m.id) && m.sbloccata) boss = true;
  if (!boss) return false;
  m.bossGenerato = true;
  await generaBossMissione();
  t.contenuto = { testo: `Missione «${m.nome}»: ${adv().incontro?.nome || 'il boss della missione'}.`, vuota: false }; modificato();
  return true;
}
/** Il boss di una missione è stato sconfitto (arazzo e ascia si possono ora raccogliere). */
export function bossMissioneSconfitto(id) {
  const m = adv().missione; if (!m || m.id !== id) return;
  m.bossSconfitto = true;
  if (id === 'arazzo') { m.arazzoTrovato = true; log('Il custode è caduto: l’arazzo è tuo (assegnalo a chi lo porta).'); }
  if (id === 'ascia') { m.asciaTrovata = true; log('Il carnefice è caduto: l’ascia di Nydann è tua (assegnala a un eroe).'); }
  modificato();
}
/** Indizi trovati durante la missione (arazzo: 4, ascia: 3). */
export function indizioMissione(n = 1) {
  const m = adv().missione; if (!m || !m.indiziNecessari || m.sbloccata || m.completata) return;
  m.indiziMissione = (m.indiziMissione || 0) + n;
  if (m.indiziMissione >= m.indiziNecessari) toast(`Hai ${m.indiziMissione} indizi di missione: puoi spenderli per localizzare l’obiettivo (scheda della missione).`);
}
export function spendiIndiziMissione() {
  const m = adv().missione; if (!m?.indiziNecessari || m.sbloccata) return;
  if ((m.indiziMissione || 0) < m.indiziNecessari) { toast(`Servono ${m.indiziNecessari} indizi (ne hai ${m.indiziMissione || 0}).`, 'warn'); return; }
  m.indiziMissione -= m.indiziNecessari; m.sbloccata = true;
  log(`Spesi ${m.indiziNecessari} indizi: ${m.id === 'arazzo' ? 'l’arazzo' : 'l’ascia di Nydann'} è nella prossima stanza che esplorerai, custodito da un boss.`); modificato();
}

// ---- compagni e oggetti di missione ----
/** Compagni, pergamene e oggetti forniti all'inizio della missione (chiamata dopo la preparazione dell'avventura). */
export async function dotazioniMissione() {
  const m = adv().missione; if (!m) return;
  if (m.id === 'cuoco') await creaCuoco();
  if (m.id === 'salvataggio') { m.giovani = (await tira('1d3+3', 'Giovani rapiti (1d3+3)')).totale; m.apparsi = 0; m.prigionieri = []; log(`Giovani rapiti da salvare: ${m.giovani}.`); }
  if (m.id === 'arazzo') await preparaArazzo();
  if (m.id === 'signore') dotazioneSignore();
  modificato();
}
async function creaCuoco() {
  if (S.party.eroi.some(e => e.png === 'cuoco' && e.stato !== 'morto')) return;
  const e = nuovoEroe('mezzuomo', 'Mezzuomo cuoco');
  Object.assign(e, { livello: 2, pvMax: 5, pv: 5, png: 'cuoco', armi: ['leggera-taglio'], armaPrincipale: 'leggera-taglio', armatura: 'nessuna', posizione: adv().stanzaCorrente,
    note: 'Compagno della missione «Il cuoco» (membro aggiuntivo). Ha l’effetto di Negoziatore: ±1 al tiro di reazione dei mostri, senza ottenere Combatte.' });
  e.oro = (await tira('4d6', 'Equipaggiamento del cuoco (4d6 p.o.)')).totale;
  S.party.eroi.push(e); S.party.ordine.push(e.id);
  log(`Il mezzuomo cuoco (L2) si unisce al gruppo con ${e.oro} p.o. di equipaggiamento.`);
}
/** Alla fine della missione il cuoco torna a casa. */
export function congedaCuoco() {
  const c = S.party.eroi.filter(e => e.png === 'cuoco'); if (!c.length) return;
  S.party.eroi = S.party.eroi.filter(e => e.png !== 'cuoco'); S.party.ordine = S.party.ordine.filter(id => !c.some(e => e.id === id));
  log('Il mezzuomo cuoco lascia il gruppo.'); modificato('party');
}
async function preparaArazzo() {
  let elfo = eroiVivi().find(e => e.classe === 'elfo' && !e.png);
  if (!elfo) {
    const k = await scelta('L’arazzo rubato', 'Nel gruppo non c’è un elfo (del manuale base). Crei un elfo di 3° livello con 150 p.o. di equipaggiamento (al massimo 40 p.o. in contanti)? Resta come membro aggiuntivo.', [[true, 'Crea l’elfo'], [false, 'No, ci penso io']]);
    if (k) {
      elfo = nuovoEroe('elfo', 'Elfo dell’arazzo'); Object.assign(elfo, { livello: 3, pvMax: 7, pv: 7, posizione: adv().stanzaCorrente });
      equipaggiamentoIniziale(elfo); elfo.oro = 40;
      S.party.eroi.push(elfo); S.party.ordine.push(elfo.id); log('Creato un elfo di 3° livello per la missione (equipaggiamento base, 40 p.o. in contanti).');
    }
  }
  if (!elfo) return;
  const sp = await scelta('L’arazzo rubato', `${elfo.nome} riceve una pergamena: quale incantesimo?`, [['Fulmine Magico', 'Fulmine Magico'], ['Sonno', 'Sonno']]) || 'Sonno';
  (elfo.oggetti = elfo.oggetti || []).push({ nome: `Pergamena: ${sp}`, qta: 1, tipo: 'pergamena', nota: `Pergamena: ${sp}`, cariche: 1, caricheMax: 1, incantesimo: sp, consuma: true });
  log(`${elfo.nome} riceve una pergamena di ${sp}.`);
}
function dotazioneSignore() {
  const v = eroiVivi();
  if (v.filter(e => e.livello <= 4).length * 2 <= v.length) { log('Gruppo forte: nessun aiuto dalle autorità.'); return; }
  const b = (adv().bottino = adv().bottino || []);
  for (let i = 0; i < 2; i++) b.push({ id: uid(), tipo: 'pergamena', testo: 'Pergamena: Fulmine Magico', incantesimo: 'Fulmine Magico' });
  b.push({ id: uid(), tipo: 'oggetto', testo: 'Amuleto curativo (guarisce 4 PV in totale)', nome: 'Amuleto curativo', cariche: 4, caricheMax: 4, curativo: true, manuale: true });
  log('Le autorità forniscono 2 pergamene di Fulmine Magico e un amuleto curativo (nel Bottino).');
}

// ---- arazzo e ascia ----
export function prendiArazzo(e) { const m = adv().missione; m.portatoreArazzo = e.id; m.arazzoPreso = true; m.arazzoLasciato = false; log(`${e.nome} porta l’arazzo: niente armi a due mani né archi, difesa a -1.`); modificato(); }
export function lasciaArazzo() { const m = adv().missione; if (!m?.portatoreArazzo) return; const e = eroePerId(m.portatoreArazzo); m.arazzoLasciato = true; m.portatoreArazzo = null; log(`${e?.nome || 'Il portatore'} lascia cadere l’arazzo (riprenderlo costa 1 azione).`); modificato(); }
export function riprendiArazzo(e) { const m = adv().missione; m.portatoreArazzo = e.id; m.arazzoLasciato = false; log(`${e.nome} riprende l’arazzo (1 azione).`); modificato(); }
export function prendiAscia(e) {
  const m = adv().missione; m.asciaPresa = e.id; e.asciaNydann = true; (e.oggetti = e.oggetti || []).push({ nome: 'Ascia di Nydann', qta: 1, nota: 'Ascia magica: +1 agli attacchi se brandita da un nano.' });
  log(`${e.nome} prende l’ascia di Nydann${e.classe === 'nano' ? ': +1 agli attacchi (nano)' : ' (solo un nano ne ricava il +1)'}.`); modificato();
}

// ---- prigionieri (Salvataggio) ----
export async function dopoStanza(t) {
  const m = adv().missione; if (!m || m.completata) return;
  if (m.id === 'salvataggio' && [3, 6, 9].includes(adv().stanze) && (m.apparsi || 0) < Math.min(3, m.giovani || 0)) {
    t.prigionieri = (t.prigionieri || 0) + 1; m.apparsi++;
    log(`Un giovane rapito, legato e imbavagliato, è nella ${t.nome}.`); toast('Hai trovato un prigioniero da salvare!');
  }
  if (m.id === 'esplorazione' && adv().stanze === 10) { log('Dieci stanze mappate: la missione si compie quando il gruppo esce dal dungeon con la mappa.'); toast('10 stanze mappate: esci dal dungeon per consegnare la mappa.'); }
  modificato();
}
/** Nell'ultima stanza compaiono tutti i giovani rimasti. */
export function ultimaStanzaPrigionieri() {
  const m = adv().missione; if (m?.id !== 'salvataggio') return;
  const t = G.tileById(adv().stanzaCorrente), resto = (m.giovani || 0) - (m.apparsi || 0) - (m.salvati || 0) - (m.prigionieri || []).length;
  if (resto <= 0) { toast('Non restano altri giovani da trovare.', 'warn'); return; }
  t.prigionieri = (t.prigionieri || 0) + resto; m.apparsi += resto; log(`Nell’ultima stanza ci sono altri ${resto} giovani prigionieri.`); modificato();
}
const capienzaScorta = () => { const n = eroiVivi().filter(e => e.stato !== 'pietra').length; return n >= 3 ? 2 : n === 2 ? 3 : 4; };
export function liberaPrigioniero() {
  const m = adv().missione; if (m?.id !== 'salvataggio') return;
  const t = G.tileById(adv().stanzaCorrente); if (!t?.prigionieri) { toast('Nessun prigioniero in questa stanza.', 'warn'); return; }
  const i = adv().incontro;
  const nemici = (i && i.tessera === t.id && i.stato !== 'finito' ? [i] : []).concat((adv().coda || []).filter(c => c.tessera === t.id));
  if (nemici.length && !(nemici.length === 1 && eroiAttivi().length > (nemici[0].minore ? nemici[0].n : 1))) { toast('Con i mostri nella stanza puoi liberare il prigioniero solo se i personaggi sono più numerosi dei mostri (o se sono stati corrotti).', 'warn'); return; }
  m.prigionieri = m.prigionieri || [];
  if (m.prigionieri.length >= capienzaScorta()) { toast(`Puoi scortare al massimo ${capienzaScorta()} prigionieri alla volta.`, 'warn'); return; }
  t.prigionieri--; m.prigionieri.push({ id: uid(), pv: 2 });
  log('Un giovane viene liberato (1 azione): ha 2 PV, attacca a -2 se disarmato e va scortato all’ingresso.'); modificato();
}
export function portaFuoriPrigionieri() {
  const m = adv().missione; if (m?.id !== 'salvataggio' || !(m.prigionieri || []).length) return;
  const t = G.tileById(adv().stanzaCorrente); if (t?.tipo !== 'ingresso') { toast('I giovani si salvano solo portandoli alla stanza d’ingresso.', 'warn'); return; }
  m.salvati = (m.salvati || 0) + m.prigionieri.length; log(`${m.prigionieri.length} giovani sono in salvo (in tutto ${m.salvati}).`); m.prigionieri = []; modificato();
}
export function feritaPrigioniero(k, d) {
  const m = adv().missione, p = m?.prigionieri?.[k]; if (!p) return;
  p.pv = Math.min(2, p.pv + d);
  if (p.pv <= 0) { m.prigionieri.splice(k, 1); log('Un giovane scortato è morto.'); }
  modificato();
}

export async function completaMissione() {
  const m = adv().missione; if (!m || m.completata) return;
  const mancante = {
    cuoco: !m.bossSconfitto && 'il signore del caos non risulta ucciso',
    esplorazione: adv().stanze < 10 && 'non hai ancora mappato 10 stanze',
    arazzo: !m.arazzoPreso && 'l’arazzo non è stato recuperato',
    signore: !adv().bossFinaleUcciso && 'il signore del caos non risulta ucciso',
    ascia: !m.bossSconfitto && 'il carnefice non risulta ucciso'
  }[m.id];
  if (mancante && !(await confirmBox(`Obiettivo non rilevato: ${mancante}. Segni comunque la missione come compiuta?`))) return;
  let es = m.es, nota = '', extra = {};
  if (m.id === 'salvataggio') {
    if (m.giovani == null) { const n = await scelta('Salvataggio', 'Quanti giovani hai portato fuori vivi?', [0, 1, 2, 3, 4, 5, 6].map(k => [k, String(k)])); m.salvati = n || 0; }
    es = m.salvati || 0;
  }
  if (m.id === 'arazzo') {
    (adv().bottino = adv().bottino || []).push({ id: uid(), tipo: 'oro', testo: '200 pezzi d’oro (consegna dell’arazzo)', valore: 200 }); nota = ' +200 p.o.';
    if (eroiVivi().some(e => e.classe === 'elfo')) extra = { soloClasse: 'elfo' };   // almeno uno dei 3 tiri ES va all'elfo
    m.portatoreArazzo = null;
  }
  if (m.id === 'ascia') {
    const r = await scelta('L’ascia di Nydann', 'Restituisci l’ascia ai nani?', [[true, 'Sì (gemme + 1 tiro ES in più)'], [false, 'No, la tengo']]);
    if (!r) es = 0;
    else {
      for (const e of eroiVivi()) { const x = await tira('2d6', 'Gemma dei nani (100+2d6)'); (adv().bottino = adv().bottino || []).push({ id: uid(), tipo: 'gemma', testo: `Gemma da ${100 + x.totale} p.o. (dai nani, per ${e.nome})`, valore: 100 + x.totale }); }
      for (const e of S.party.eroi) if (e.asciaNydann) { e.asciaNydann = false; e.oggetti = (e.oggetti || []).filter(o => o.nome !== 'Ascia di Nydann'); }
    }
  }
  m.completata = true; T.tutti('missioni');
  if (es > 0) {
    const motivo = `Missione «${m.nome}» compiuta`;
    if (extra.soloClasse) { if (es > 1) G.aggiungiES(motivo, false, es - 1); G.aggiungiES(`${motivo} (da usare sull’elfo)`, false, 1, extra); }
    else G.aggiungiES(motivo, false, es);
  }
  log(`Missione «${m.nome}» compiuta.${nota}`);
  modificato();
}

// ---------------- Teletrasporto del Caos ----------------
export async function teletrasporto(e) {
  const stanze = adv().tessere.filter(t => !t.pending);
  if (stanze.length < 6) { toast('Il Teletrasporto del Caos richiede almeno 6 stanze esplorate.', 'warn'); return false; }
  let scelte = [];
  while (scelte.length !== 6) {
    scelte = await sceltaMultipla('Teletrasporto del Caos', 'Scegli esattamente 6 stanze/corridoi: verranno numerati da 1 a 6 e un d6 deciderà la destinazione.', stanze.map(t => [t.id, `${t.nome}${t.corridoio ? ' (corridoio)' : ''}`]));
    if (!scelte.length) return false;
    if (scelte.length !== 6) toast('Servono esattamente 6 stanze.', 'warn');
  }
  const r = await dado('Teletrasporto del Caos (d6)');
  const dest = G.tileById(scelte[r.totale - 1]);
  e.posizione = dest.id; adv().stanzaCorrente = dest.id;
  log(`${e.nome} si teletrasporta (${r.totale}) in ${dest.nome}.`);
  modificato();
  return true;
}
