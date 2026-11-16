// Incontri e combattimento: reazioni, attacchi, incantesimi, difese, morale, bottino.
import { R, S, log, modificato, eroiVivi, eroiAttivi, eroePerId, ordineMarcia, livelloMax, inCampo } from './state.js';
import { dado, tira, d6Esplosivo, d8Esplosivo, dEsplosivoN, migliorDi } from './dice.js';
import { modAttacco, modDifesa, trovaReazione, gruppoHaLanterna, haNano, armaDi, armaPrincipale, creaIncontro, suppl, tratto, haAbilita, abilita, bonusSalvezza, armaConsentita, tipoNonVivente, oggettoEffetto, haBraccialetto, usaD8, abissoAttivo, inAbisso, profonditaAttiva, profiloDado, grNumero } from './rules.js';
import { tesoro, vittoria, terminaAvventura, monstroErrante, avviaIncontro, aggiungiIndizio } from './game.js';
import { toast, pick, scelta, sceltaMultipla } from './util.js';
import * as K from './caos.js';
import * as T from './tratti.js';
import * as A from './abisso.js';
import * as P from './profondita.js';

export const inc = () => S.adv.incontro;
const livAtt = i => (i.livPrimoTurno && i.turno <= 1) ? i.livPrimoTurno : (P.livelloSenzaFeriti(i) ?? i.liv);
const livDif = (i, e) => (i.livPrimoTurno && i.turno <= 1) ? i.livPrimoTurno : (i.livDifesaFerito && e.pv < e.pvMax ? i.livDifesaFerito : (P.livelloSenzaFeriti(i) ?? i.liv));
const casuale = arr => arr[Math.floor(Math.random() * arr.length)];

export function nota(testo) {
  const i = inc();
  if (i) { i.cronaca = i.cronaca || []; i.cronaca.push(testo); }
  log(testo);
}
const finisci = (esito) => { const i = inc(); i.stato = 'finito'; i.esito = esito; modificato(); };

// ---------------- poteri dei mostri avanzati ----------------
/** d6 esplosivo di un eroe: con punti sfortuna (gremlin del caos) il 6 non esplode e toglie 1 punto. */
/** Dado esplosivo di un eroe: d8 per i livelli avanzati (supplemento «Contro l'Abisso»), altrimenti d6. */
export const dE = (e, label, opz = {}) => {
  const p = profiloDado(e), soglia = opz.senzaEsp ? 0 : Math.max(2, p.soglia - (opz.esp || 0));   // armi e armature perfette: esplosione più probabile
  return p.facce === 6 ? d6Esplosivo(label, soglia) : p.facce === 8 ? d8Esplosivo(label, soglia) : dEsplosivoN(p.facce, soglia, label);
};
/** Il tiro è esploso (6 sul d6, 7-8 sul d8, 8+ sul d10, 9+ sul d12): vale come successo automatico in difesa. */
export const esplode = (e, r) => { const s = r.soglia ?? profiloDado(e).soglia; return s > 0 && r.naturale >= s; };
export async function d6e(e, label, opz = {}) {
  if ((e?.sfortuna || 0) > 0) {
    const r = await dado(label);
    if (r.totale === 6) { e.sfortuna--; nota(`${e.nome}: il 6 non esplode (sfortuna) e toglie 1 punto sfortuna (restano ${e.sfortuna}).`); }
    return { totale: r.totale, naturale: r.totale, tiri: [r.totale] };
  }
  return dE(e, label, opz);
}
/** Mutante tentacolato: l'eroe ha un oggetto afferrato, inutilizzabile finché l'incontro non finisce. */
async function afferra(e) {
  const liberi = (e.oggetti || []).filter(o => !o.afferrato);
  if (!liberi.length) { nota(`${e.nome} non ha oggetti da farsi afferrare.`); return; }
  const k = await scelta('Tentacolo!', `${e.nome} ha un oggetto afferrato. Quale?`, liberi.map((o, n) => [n, o.nome]));
  const o = liberi[k ?? 0]; o.afferrato = true; nota(`Un tentacolo afferra «${o.nome}» di ${e.nome}: non è usabile finché il mutante non è sconfitto.`);
}
/** Eroi che non possono attaccare in questo turno (smarrimento del doppelganger, manto predatore). */
async function blocchiDiTurno() {
  const i = inc(); if (!i || i.stato === 'finito') return;
  await A.inizioTurno(i);
  if (i.id === 'd-doppelganger') {
    for (const e of eroiAttivi()) {
      if (e.id === i.imitato) continue;
      if (!(await salva(e, 4, 0, 'Smarrimento (doppelganger)'))) { i.agito[e.id] = true; nota(`${e.nome} è smarrito e non attacca in questo turno.`); }
    }
  }
  for (const e of eroiAttivi()) if (e.avvolto) i.agito[e.id] = true;
}
/** Poteri all'inizio dell'incontro. */
async function poteriIniziali() {
  const i = inc();
  if (i.id === 'd-spettro') {
    const x = await dado('Spettro: le lanterne si spengono? (1-2)');
    if (x.totale <= 2) { i.buio = true; nota('Tutte le lanterne si spengono fino a fine incontro: -2 ad attacchi e difese.'); } else nota('Le lanterne restano accese.');
  }
  if (i.id === 'd-doppelganger') {
    const c = casuale(eroiAttivi()); if (c) { i.imitato = c.id; nota(`Il doppelganger assume la forma di ${c.nome}.`); }
  }
  if (i.id === 'd-manto') {
    const furf = eroiAttivi().some(e => e.classe === 'furfante');
    const x = await dado(`Manto predatore: lo noti? (1-${furf ? 4 : 2})`);
    if (x.totale <= (furf ? 4 : 2)) nota('Il manto predatore è stato individuato: potete tornare indietro (Ritirata) o affrontarlo.');
    else {
      nota('Il manto predatore cade sul gruppo!');
      for (const e of eroiAttivi()) {
        const b = (['elfo', 'furfante'].includes(e.classe) ? 1 : 0) - (e.armatura === 'pesante' ? 1 : 0);
        if (!(await salva(e, 3, b, 'Schivare il manto predatore'))) { e.avvolto = true; nota(`${e.nome} è avvolto: non attacca e perde 1 PV a ogni turno di difesa.`); }
      }
    }
  }
}
/** Dopo che dei mostri minori sono caduti: poteri che li fanno rialzare. */
async function dopoMorti(i, morti, fonte) {
  if (i.id === 'd-nani-posseduti') {
    const x = await tira(`${morti}d6`, 'Nani posseduti: si rialzano? (3+)');
    const c = x.dadi.filter(v => v >= 3).length;
    if (c) { i.risorti = (i.risorti || 0) + c; nota(`${c} nan${c === 1 ? 'o posseduto attaccherà' : 'i posseduti attaccheranno'} di nuovo al prossimo turno, poi resta${c === 1 ? '' : 'no'} mort${c === 1 ? 'o' : 'i'}.`); }
  }
  if (i.id === 'troll' && fonte !== 'incantesimo') {
    const k = await scelta('Troll', 'Fai a pezzi i cadaveri con un’arma da taglio (così non si rigenerano)?', [[true, 'Sì'], [false, 'No']]);
    if (!k) {
      const x = await tira(`${morti}d6`, 'Troll: si rigenerano? (5-6)');
      const c = x.dadi.filter(v => v >= 5).length;
      if (c) { i.rigenerati = (i.rigenerati || 0) + c; nota(`${c} troll si rigenerano e torneranno in piedi dopo il turno dei mostri.`); }
    }
  }
}

// ---------------- avvio e reazioni ----------------
export async function inizioScontro() {
  const i = inc(); if (i.inizioFatto) return; i.inizioFatto = true;
  i.stato = 'combattimento'; i.turno = 1; i.agito = {}; i.nAtt = {}; i.protetti = {}; i.difeso = {}; i.sparati = {};
  S.party.eroi.forEach(e => { if (e.classe === 'elfo-fuoco') { (e.incantesimi || []).forEach(sp => { sp.usato = false; }); e.vistaAperta = false; } });   // la vista di fuoco si ricarica a ogni scontro
  if (i.id === 'catoblepa') await salvaTutti('Sguardo del catoblepa', 4, () => 0, e => perdiPV(e, 1, 'sguardo'));
  if (i.id === 'medusa') await salvaTutti('Sguardo della medusa', 4, e => (e.classe === 'furfante' ? Math.floor(e.livello / 2) : 0), e => { e.stato = 'pietra'; T.evento(e, 'trasformazione'); nota(`${e.nome} è trasformato in pietra!`); });
  if (i.id === 'signore-caos' || i.id === 'd-signore-caos') await poteriCaos();
  if (i.attDadi) {
    const x = await tira(i.attDadi, `Attacchi di ${i.nome}`); i.att = x.totale;
    if (i.id === 'c-avatar') { i.livBase = i.liv = x.totale >= 5 ? 5 : 6; nota(`${i.nome}: ${x.totale} attacchi di LIV ${i.liv}.`); }
    else nota(`${i.nome}: ${x.totale} attacchi per turno.`);
  }
  await poteriIniziali();
  await A.inizioIncontro(i);
  if (profonditaAttiva()) await P.inizioIncontro(i);   // raffiche, illusioni, ruggito, muco, Resistenza alla magia
  if (i.speciale === 'schiavisti' && !i.errante) {
    const lead = ordineMarcia().find(e => e.stato === 'ok');
    if (lead) {
      const b = (['elfo', 'mezzuomo'].includes(lead.classe) ? 1 : 0) + (lead.classe === 'furfante' ? lead.livello : 0);
      nota('Gli schiavisti hanno preparato una tagliola!');
      if (!(await salva(lead, 4, b, 'Tagliola degli schiavisti'))) { perdiPV(lead, 1, 'tagliola'); if (lead.stato === 'ok') { lead.zoppo = true; nota(`${lead.nome} zoppica.`); } }
    }
  }
  if (i.id === 'c-avatar') await salvaTutti('Avatar di Xichtul (prima visione)', 6, () => 0, e => nota(`${e.nome} lascia cadere 1 oggetto (anche un’arma o almeno 20 p.o.; senza oggetti perde 1 PV).`));
  await blocchiDiTurno();
  modificato();
}

async function poteriCaos() {
  const r = await dado('Poteri del signore del caos (d6)');
  const i = inc(); const av = i.id === 'd-signore-caos';
  if (av) {
    if (r.totale <= 4) { i.potere = 'malocchio'; nota('Malocchio: tutti salvano (L4) o -1 a tutte le difese fino alla sua morte.'); await salvaTutti('Malocchio', 4, () => 0, e => { e.maledetto = true; }); }
    else if (r.totale === 5) { i.potere = 'risucchio'; nota('Risucchio di energia: ogni volta che un personaggio è ferito salva (L4) o perde 1 livello.'); }
    else { i.potere = 'raggio'; nota('Raggio di fuoco infernale minore: tutti salvano (L5, chierici +½L) o perdono 2 PV.'); await salvaTutti('Raggio infernale minore', 5, e => (e.classe === 'chierico' ? Math.floor(e.livello / 2) : 0), e => perdiPV(e, 2, 'raggio')); }
    return;
  }
  if (r.totale <= 3) { i.potere = 'nessuno'; nota('Signore del caos: nessun potere speciale.'); }
  else if (r.totale === 4) { i.potere = 'malocchio'; nota('Malocchio: tutti salvano (L4) o -1 a tutte le difese fino alla sua morte.'); await salvaTutti('Malocchio', 4, () => 0, e => { e.maledetto = true; }); }
  else if (r.totale === 5) { i.potere = 'risucchio'; nota('Risucchio di energia: ogni volta che un personaggio è ferito salva (L4) o perde 1 livello.'); }
  else { i.potere = 'raggio'; nota('Raggio di fuoco infernale: tutti salvano (L6, chierici +½L) o perdono 2 PV.'); await salvaTutti('Raggio infernale', 6, e => (e.classe === 'chierico' ? Math.floor(e.livello / 2) : 0), e => perdiPV(e, 2, 'raggio')); }
}

export function attaccaSubito() {
  const i = inc(); i.reazione = { azione: 'attacco-subito', testo: 'Attacchi per primo.' };
  i.mostriPrima = false; i.sorpresa = false; return inizioScontro();
}

export async function tiraReazione() {
  const i = inc();
  if (i.speciale === 'gremlin') return;
  let r = await dado(`Reazione di ${i.nome} (d6)`);
  r = { ...r, totale: await A.modReazione(i, await negoziatore(i, r.totale)) };
  if (i.modReazioni) { r.totale = Math.max(1, Math.min(6, r.totale + i.modReazioni)); nota(`Modificatore alla reazione: ${i.modReazioni > 0 ? '+' : ''}${i.modReazioni} → ${r.totale}.`); }
  let re = trovaReazione(i, r.totale);
  if (!re) { re = [1, 6, 'combatte']; }
  let azione = re[2];
  if (i.id === 'troll' && haNano() && ['combatte'].includes(azione)) azione = 'morte';
  if (azione === 'fugge-inf' && eroiAttivi().length <= i.n) azione = 'combatte';
  i.reazione = { tiro: r.totale, azione, param: re[3], tipoCorr: re[4] };
  nota(`Reazione (${r.totale}): ${i.nome} → ${azione === 'corruzione' ? `Corruzione (${re[3]} p.o.${re[4] === 'totale' ? ' in tutto' : ' a mostro'})` : azione}.`);
  if (azione === 'fugge' || azione === 'fugge-inf') { i.stato = 'finito'; i.esito = 'fuga'; nota(`${i.nome} fugge: nessun bottino.`); }
  else if (azione === 'corruzione') {
    if (i.id === 'ferrofago') i.reazione.param = (await tira('1d6', 'Corruzione ferrofago')).totale;
    else if (typeof re[3] === 'string' && /\dd\d/.test(re[3])) i.reazione.param = (await tira(re[3], 'Tangente')).totale;
    i.stato = 'corruzione';
  } else if (azione === 'banchetto') {
    const x = await tira('1d6+3', 'Veleno del banchetto'); nota(`${i.nome} mangia il cibo avvelenato: subisce ${x.totale} PV!`);
    i.mostriPrima = false; await inizioScontro(); await applicaDanni(x.totale);
  } else if (azione === 'tenzone' && abissoAttivo()) await A.tenzone(i);
  else if (azione === 'immobile') { i.noMorale = true; await inizioScontro(); }
  else if (azione === 'combatte' || azione === 'morte' || azione === 'combatte-sempre' || azione === 'tenzone') {
    if (azione === 'tenzone') nota('Singolar tenzone: combatte solo il capo o il campione del nemico (1 contro 1).');
    if (azione !== 'combatte') i.noMorale = true;
    i.mostriPrima = true; await inizioScontro();
  } else if (azione === 'dorme') { i.bonusPrimoAttacco = 2; await inizioScontro(); }
  else i.stato = 'speciale';
  modificato();
}

/** Negoziatore (anche il mezzuomo cuoco): ±1 al tiro di reazione, ma mai fino a ottenere «Combatte» o «Combatte fino alla morte». */
async function negoziatore(i, tot) {
  if (!suppl() && !abissoAttivo()) return tot;
  const neg = eroiVivi().find(x => x.stato === 'ok' && (x.png === 'cuoco' || haAbilita(x, 'negoziatore')));
  if (!neg) return tot;
  const az = v => (trovaReazione(i, v) || [1, 6, 'combatte'])[2], vietata = a => ['combatte', 'morte', 'combatte-sempre'].includes(a);
  const opz = [[0, `Tieni ${tot}: ${az(tot)}`]];
  for (const d of [-1, 1]) { const v = tot + d; if (v >= 1 && v <= 6 && !vietata(az(v))) opz.push([d, `${d > 0 ? '+1' : '-1'} → ${v}: ${az(v)}`]); }
  if (opz.length > 1) { const k = await scelta('Negoziatore', `${neg.nome} può spostare di 1 il tiro di reazione (${tot}).`, opz); if (k) { tot += k; nota(`${neg.nome} (Negoziatore) sposta il tiro di reazione a ${tot}.`); } }
  if (i.id === 'c-signore-cuoco' && az(tot) !== 'banchetto' && await scelta('Il signore del caos', `Reazione attuale: ${az(tot)}. Puoi ripetere il tiro una volta.`, [[false, 'Tieni il risultato'], [true, 'Ripeti il tiro']])) tot = (await dado('Reazione del signore del caos (ripetuta)')).totale;
  return tot;
}

export function costoCorruzione() {
  const i = inc(), p = i.reazione?.param;
  if (typeof p !== 'number') return null;
  return i.reazione.tipoCorr === 'totale' ? p : p * i.n;
}
export const oroTotale = () => eroiVivi().reduce((a, e) => a + (e.oro || 0), 0);
export function haOroStolti() { return eroiVivi().some(e => (e.oggetti || []).some(o => /oro degli stolti/i.test(o.nome))); }

export function paga(costo, stolti = false, gratis = false) {
  const i = inc();
  if (gratis) nota(`${i.nome} è corrotto senza spendere monete.`);
  else if (stolti) {
    for (const e of eroiVivi()) { const k = (e.oggetti || []).findIndex(o => /oro degli stolti/i.test(o.nome)); if (k >= 0) { e.oggetti.splice(k, 1); break; } }
    nota(`Oro degli stolti usato: ${i.nome} corrotto.`);
  } else {
    let resto = costo;
    for (const e of [...eroiVivi()].sort((a, b) => b.oro - a.oro)) { const q = Math.min(e.oro || 0, resto); e.oro -= q; resto -= q; if (!resto) break; }
    nota(`Pagati ${costo} p.o.: ${i.nome} corrotto e considerato sconfitto.`);
  }
  vittoria(i); finisci('corrotto');
}
export function rifiutaCorruzione() { const i = inc(); nota('Corruzione rifiutata: si combatte.'); i.mostriPrima = true; return inizioScontro(); }

// ---------------- helper ----------------
function ctxGruppo() {
  const i = inc();
  return { senzaLanterna: !gruppoHaLanterna(), inferiorita: eroiAttivi().length > i.n };
}
export function perdiPV(e, n, causa = '', opz = {}) {
  if (e.malattia && !opz.noExtra && n > 0) { n += 1; causa = (causa ? causa + ', ' : '') + 'malattia della melma verde'; }
  if (e.pv * 2 > e.pvMax) e.furiaSangue = false;   // il braccialetto della furia si riattiva alla prossima discesa sotto metà PV
  e.pv -= n;
  nota(`${e.nome} perde ${n} PV${causa ? ' (' + causa + ')' : ''}${e.pv <= 0 ? ' e cade a terra, ferito mortalmente!' : ` → ${e.pv}/${e.pvMax}`}`);
  if (e.pv <= 0) { e.pv = 0; e.stato = 'morto'; if (e.caosTrasf) document.dispatchEvent(new CustomEvent('caos-rinasci', { detail: e.id })); if (abissoAttivo()) A.dopoMorte(e).catch(err => console.error(err)); if (profonditaAttiva()) P.eroeCaduto(e, causa).catch(err => console.error(err)); }
  else if (profonditaAttiva() && n > 0) P.eroeFerito(e);
  else if (suppl()) {
    if (e.ubriaco && e.pv * 2 <= e.pvMax) { e.ubriaco = false; nota(`${e.nome}, ferito, torna sobrio.`); }
    if (haBraccialetto(e) && !e.furiaSangue && e.pv * 2 <= e.pvMax) { e.furiaSangue = true; K.follia(e, 1); nota(`${e.nome}: il braccialetto della furia di sangue si accende (+1 follia, +1 ad attacco e difesa finché i PV restano a metà o meno).`); }
  }
  controllaSconfitta(); modificato();
}
function controllaSconfitta() {
  const imb = inc();
  if (imb?.imboscata && imb.stato !== 'finito') {   // imboscata dei tratti «Braccato»: se il solitario cade, lo scontro finisce
    const e = eroePerId(imb.imboscata.eroeId);
    if (e && e.stato !== 'ok') { T.imboscataPersa(e, imb); finisci('soloCaduto'); return; }
  }
  if (!eroiVivi().some(e => e.stato === 'ok')) { terminaAvventura('Il gruppo è stato sconfitto'); if (inc()) { inc().stato = 'finito'; inc().esito = 'sconfitta'; } }
}
export async function salva(e, liv, bonus = 0, label = 'Tiro salvezza') {
  if (e.nessunPericolo) { e.nessunPericolo = false; nota(`${label}: ${e.nome} ignora il pericolo (allucinazione) e fallisce in automatico.`); return false; }
  if (e.autoSalvezza) { e.autoSalvezza = false; nota(`${label}: ${e.nome} riesce in automatico (rivelazione).`); return true; }
  if (abissoAttivo() && /sguardo/i.test(label) && await A.rifletti(e)) return true;   // Rifletti Sguardo: al sicuro senza tirare
  let r = await d6e(e, `${label} – ${e.nome} (L${liv})`);
  let tot = r.totale + bonus + bonusSalvezza(e, label).tot;
  let ok = r.naturale !== 1 && tot >= liv;
  if (!ok && abissoAttivo() && /veleno/i.test(label) && haAbilita(e, 'refrattario-al-veleno')) {   // ripete una volta il tiro contro il veleno fallito
    nota(`${e.nome} (Refrattario al veleno) ripete il tiro: primo tiro ${tot}.`);
    r = await d6e(e, `${label} (ripetuto) – ${e.nome} (L${liv})`); tot = r.totale + bonus + bonusSalvezza(e, label).tot; ok = r.naturale !== 1 && tot >= liv;
  }
  nota(`${label}: ${e.nome} tira ${tot} contro L${liv} → ${ok ? 'salvo' : 'FALLITO'}.`);
  if (abissoAttivo() && !ok && S.adv.divinita) S.adv.divinita.fallito = true;
  if (!ok && /veleno/i.test(label)) T.evento(e, 'veleno');
  if (ok && /sguardo/i.test(label)) T.evento(e, 'sguardo');
  return ok;
}
export async function salvaTutti(label, liv, bonusFn, onFail) {
  for (const e of eroiAttivi()) {
    if (/sguardo/i.test(label) && e.classe === 'elfo-fuoco' && !e.vistaAperta) { nota(`${e.nome} (elfo del fuoco) è immune agli sguardi finché non usa la vista di fuoco.`); continue; }
    if (!(await salva(e, liv, bonusFn(e), label))) await onFail(e);
  }
  modificato();
}

// ---------------- attacco ----------------
export function contestoAttacco(e, opz = {}) {
  const i = inc();
  return { bersaglio: i, arma: opz.armaId, tenzone: !!i.tenzone, ...ctxGruppo(), extra: opz.extra || 0, bonusGruppo: (i.bonusPrimoAttacco && i.turno === 1 ? i.bonusPrimoAttacco : 0) + (opz.bonusGruppo || 0), bonusGruppoTxt: 'Bonus del gruppo' };
}

const armaDiOpz = (e, opz) => (opz.armaId !== undefined ? armaDi(opz.armaId) : armaPrincipale(e));
/** Attacco di un eroe; la stella da lancio dei «Lanciatori di coltelli» specializzati ne scaglia due con una sola azione. */
export async function attacca(e, opz = {}) {
  const arma = armaDiOpz(e, opz);
  const doppio = suppl() && arma?.id === 'stella' && abilita(e, 'lanciatore-di-coltelli')?.arma === 'stella' && !opz.coda;
  const r = await attaccaUno(e, opz);
  if (doppio && r !== undefined && inc() && inc().stato === 'combattimento') { nota(`${e.nome} scaglia una seconda stella da lancio con la stessa azione.`); await attaccaUno(e, { ...opz, secondo: true }); }
  return r;
}

/** Fonti di ripetizione di un attacco fallito (tratti Maestro di bastoni/lame e traguardo «Sempre in missione»). */
async function offriRipetizione(e, arma, totale, L) {
  if (!suppl() && !abissoAttivo()) return false;
  const u = e.usi = e.usi || {}, mischia = !arma?.lancio, fonti = [];
  if (mischia && tratto(e, 'bastoni') && !u.bastoni && (!arma || arma.tipo === 'contundente')) fonti.push(['bastoni', 'Maestro di bastoni (1 volta per avventura)']);
  if (mischia && tratto(e, 'lame') && !u.lame && arma?.tipo === 'taglio') fonti.push(['lame', 'Maestro di lame (1 volta per avventura)']);
  if (e.perm?.missioni && ((S.adv.missione && !S.adv.missione.completata) || inc()?.missione) && (u.ripMissione || 0) < 6) fonti.push(['ripMissione', `Sempre in missione (${6 - (u.ripMissione || 0)} ripetizioni rimaste)`]);
  if (abissoAttivo() && arma?.lancio && haAbilita(e, 'tiro-preciso')) fonti.push(['tiroPreciso', 'Tiro preciso (ripeti un tiro con arma da lancio)']);
  if (!fonti.length) return false;
  const k = await scelta('Ripeti l’attacco?', `${e.nome} ha mancato (${totale} contro LIV ${L}).`, [...fonti, [null, 'No, accetta il fallimento']]);
  if (!k) return false;
  u[k] = (u[k] || 0) + 1; nota(`${e.nome} ripete l’attacco fallito (${fonti.find(f => f[0] === k)[1]}).`); return true;
}

async function attaccaUno(e, opz = {}) {
  const i = inc();
  if (!i.inizioFatto) await inizioScontro();
  if (i.speciale === 'gremlin') return;
  if (e.inghiottito) { toast(`${e.nome} è stato inghiottito e non può attaccare.`, 'warn'); return; }
  if (e.paralizzato) { toast(`${e.nome} è paralizzato e non può attaccare.`, 'warn'); return; }
  if (profonditaAttiva()) { const blocco = P.bloccoAttacco(e, i); if (blocco) { toast(blocco, 'warn'); return; } i.attacchiRicevuti = (i.attacchiRicevuti || 0) + 1; }
  if (i.campione === e.id && i.leaderInc && !i.leaderInc.morto && !opz.coda) return A.attaccoControLeader(e, opz);   // il campione duella con il leader
  const arma0 = opz.armaId !== undefined ? armaDi(opz.armaId) : armaPrincipale(e);
  const L = opz.coda ? 6 : (i.livControDistanza && arma0?.lancio ? i.livControDistanza : livAtt(i));
  const sup = suppl();
  if (arma0 && sup) { const c = armaConsentita(e, arma0); if (!c.ok) { toast(c.motivo, 'warn'); return; } }
  if (sup && arma0?.id === 'balestra' && e.balestraScarica) { toast('La balestra è scarica: ricaricala con 1 azione.', 'warn'); return; }
  if (sup && S.adv.missione?.portatoreArazzo === e.id && (arma0?.categoria === 'due-mani' || arma0?.id === 'arco')) { toast('Chi porta l’arazzo non può usare armi a due mani né archi: lascialo cadere.', 'warn'); return; }
  if (sup && arma0?.id === 'boomerang' && (i.corridoio || S.adv.tema === 'foresta')) { toast('Il boomerang non si usa nei corridoi, nelle foreste e nelle stanze sotto i 6 quadretti.', 'warn'); return; }
  if (arma0?.fuoco) {
    if ((e.rotte || []).includes(arma0.id)) { toast(`${arma0.nome} è esplosa: va riparata in città.`, 'warn'); return; }
    i.sparati = i.sparati || {};
    if (i.sparati[e.id + arma0.id]) { toast(`${arma0.nome}: un solo colpo per incontro.`, 'warn'); return; }
    i.sparati[e.id + arma0.id] = true;
  }
  if (arma0 && arma0.lancio && e.classe === 'elfo-fuoco') { toast('Gli elfi del fuoco non usano armi a distanza.', 'warn'); return; }
  const segna = a => { if (!opz.secondo) segnaAttacco(e, a); };
  const ctx = contestoAttacco(e, opz);
  // Sangue orchesco: +1 al primo attacco in mischia di un incontro (una volta per avventura, non se sorpresi)
  i.primi = i.primi || {};
  const sangue = sup && tratto(e, 'sangue-orco') && !(e.usi || {}).sangueOrco && !arma0?.lancio && !opz.coda && !i.primi[e.id] && !(i.sorpresa && i.turno <= 1);
  if (sangue) { ctx.sangueOrco = true; e.usi = e.usi || {}; e.usi.sangueOrco = 1; }
  if (!arma0?.lancio) i.primi[e.id] = true;
  const furioso = !!opz.furioso;
  if (profonditaAttiva() && arma0?.lancio && !opz.coda && await P.fuocoAmico(e, i)) { segna(arma0); return modificato(); }   // falena: gli attacchi a distanza possono colpire i compagni
  const r = furioso ? await migliorDi(3, `Attacco furioso di ${e.nome}`, profiloDado(e).facce) : await d6e(e, `Attacco di ${e.nome}`, profonditaAttiva() ? { esp: P.espAttacco(e, arma0), senzaEsp: P.senzaEsplosione(i) } : {});
  if (r.naturale === 1 && e.infettoCaos) { e.infettoCaos = false; await K.toccatoDalCaos(e); }
  if (r.naturale === 1 && sup && !arma0?.lancio && tratto(e, 'miope') && e.occhiali === true) { e.occhiali = 'rotti'; nota(`${e.nome}: gli occhiali si rompono (100 p.o. per ripararli).`); }
  const m = modAttacco(e, ctx);
  if (profonditaAttiva()) P.consumaDichiarazioni(e, i, arma0);
  const dichCM = abissoAttivo() && e.dichiara?.colpoMortale && armaDiOpz(e, opz)?.categoria === 'due-mani';
  if (dichCM) { e.dichiara.colpoMortale = false; (i.usati = i.usati || {})[e.id + 'cm'] = true; }   // il Colpo mortale si dichiara prima del tiro: se fallisce l'uso è perso
  if (abissoAttivo() && e.srv?.veleno && !e.srv.veleno.usato && !armaDiOpz(e, opz)?.lancio) await A.consumaVeleno(e, i);
  if (e.bonusProssimo) e.bonusProssimo = 0;   // il +3 del cappuccio vale per un solo attacco
  const malTroll = (i.id === 'd-troll' && armaDiOpz(e, opz)?.tipo === 'contundente') ? -1 : 0;   // il grosso troll attutisce i colpi contundenti
  const totale = r.totale + m.tot + malTroll;
  const auto1 = r.naturale === 1;
  if (r.naturale === 1 && i.id === 'c-tentacolato') await afferra(e);
  if (opz.coda) {
    segna(arma0);
    if (!auto1 && totale >= 6) { i.codaFerita = true; nota(`${e.nome} ferisce la coda della manticora (${totale} contro LIV 6): il pungiglione è inutilizzabile.`); }
    else nota(`${e.nome} manca la coda della manticora (${totale} contro LIV 6).`);
    return modificato();
  }
  let colpi = !auto1 && totale >= L ? Math.max(1, Math.floor(totale / L)) : 0;
  const armaUsata = opz.armaId !== undefined ? armaDi(opz.armaId) : armaPrincipale(e);
  if (!colpi && !opz.ripetuto && !arma0?.fuoco && arma0?.id !== 'bolas' && await offriRipetizione(e, armaUsata, totale, L)) return attaccaUno(e, { ...opz, ripetuto: true });
  if (armaUsata && !armaUsata.lancio) e.mischia = true;
  if (arma0?.fuoco && r.naturale === 1) {
    const x = await tira('1d3', `Esplosione di ${arma0.nome}`); perdiPV(e, x.totale, `${arma0.nome} esplode`);
    (e.rotte = e.rotte || []).push(arma0.id);
  }
  if (arma0?.id === 'archibugio') { const x = await dado('Lo sparo attira i mostri erranti? (1-2 sì)'); if (x.totale <= 2) { nota('Lo sparo attira i mostri erranti: arriveranno dopo questo combattimento.'); const m = await monstroErrante(); avviaIncontro(m, null); } }
  const desc = `${e.nome} attacca: ${r.totale}${m.tot ? (m.tot > 0 ? '+' : '') + m.tot : ''} = ${totale} contro LIV ${L}${auto1 ? ' (1 naturale: fallimento automatico)' : ''}`;
  if (sup) await recuperaMunizioni(arma0);
  if (sup && arma0?.id === 'bolas') { segna(armaUsata); return await lanciaBolas(e, i, colpi, desc, totale); }
  if (sup && arma0?.id === 'balestra') e.balestraScarica = true;
  if (sup && arma0?.id === 'boomerang' && !colpi) nota('Il boomerang manca il bersaglio e ritorna nelle mani di chi lo ha lanciato.');
  if (colpi && e.classe === 'tiratore' && arma0?.lancio) colpi = Math.max(2, colpi + 1);
  if (colpi && sup) {
    const bp = tratto(e, 'ben-piazzato');
    if (bp?.scelta === 'danni' && armaUsata?.categoria === 'due-mani' && !i.minore && !(i.piazzati || {})[e.id]) { (i.piazzati = i.piazzati || {})[e.id] = true; if (colpi < 2) { colpi = 2; nota(`${e.nome} (Ben piazzato) infligge 2 PV con l’arma a due mani.`); } }
    if (tratto(e, 'distruttore') && !furioso && r.tiri.length > 1 && !armaUsata?.lancio && !(e.usi || {}).distruttore
      && await scelta('Distruttore', `Risultato esplosivo di ${e.nome}: ${i.minore ? 'uccidi 1 mostro in più' : 'infliggi 1 PV in più'}? (1 volta per avventura)`, [[true, 'Sì'], [false, 'No']])) { e.usi = e.usi || {}; e.usi.distruttore = 1; colpi++; nota(`${e.nome} (Distruttore) fa un danno in più.`); }
  }
  if (colpi && abissoAttivo()) colpi = colpiAbisso(e, i, r, totale, L, armaUsata, colpi, dichCM);
  if (colpi && profonditaAttiva()) colpi = await P.colpiProf(e, i, r, armaUsata, colpi, totale, L);
  if (colpi && i.vulnerabileSolo && !A.puoColpireVampiro(e, armaUsata, colpi)) { nota(`${e.nome} colpisce, ma ${i.nome} è ferito solo da armi magiche, incantesimi, paletti, acqua santa, Cacciatore di vampiri o colpi da 2 ferite: nessun effetto.`); colpi = 0; modificato(); return { colpi: 0, totale }; }
  if (colpi && i.marchio?.eroeId === e.id) {
    const nv = tipoNonVivente(i);
    if (!nv || (e.specializzato && (!e.specializzati || e.specializzati.includes(nv)))) { colpi *= 3; nota(`${e.nome} colpisce il bersaglio marchiato: danni TRIPLI!`); }
    i.marchio = null;
  }
  if (colpi && i.id === 'd-spettro' && !((e.bonusMagico || 0) > 0 || armaUsata?.argento || (e.armiArgento || []).includes(armaUsata?.id)) && colpi < 2) { nota(`${e.nome} colpisce, ma lo spettro è ferito solo da armi magiche o d’argento, incantesimi, acqua santa o colpi da 2+ PV: nessun effetto.`); colpi = 0; modificato(); return { colpi: 0, totale }; }
  if (colpi && i.immuneContundenti && armaUsata?.tipo === 'contundente') { nota(`${e.nome} colpisce, ma ${i.nome} è immune alle armi contundenti.`); colpi = 0; modificato(); return { colpi: 0, totale }; }
  if (furioso && colpi) colpi *= 2;
  if (furioso) e.usi.furie = (e.usi.furie || 0) + 1;
  segna(armaUsata);
  if (!colpi) { nota(`${desc} → mancato.`); if (r.naturale === 1 && i.disarmaSu1 && armaUsata && !armaUsata.lancio) await A.disarmato(e, i, armaUsata); modificato(); return { colpi: 0, totale }; }
  nota(`${desc} → ${i.minore ? `${colpi} uccis${colpi === 1 ? 'o' : 'i'}` : `${colpi} ferit${colpi === 1 ? 'a' : 'e'}`}${furioso ? ' (furioso: danni doppi)' : ''}.`);
  const pre = { n: i.n, pv: i.pv };
  i.fonte = 'arma'; i.armaTaglio = armaUsata?.tipo === 'taglio';
  await applicaDanni(colpi);
  T.uccisioni(e, i, pre, { mischia: !armaUsata?.lancio });
  if (profonditaAttiva()) await P.dopoColpo(e, i, pre, { mischia: !armaUsata?.lancio });
  if (abissoAttivo() && e.bastoneRettitudine && !i.minore && pre.pv > 0 && i.pv <= 0 && armaUsata?.tipo === 'contundente' && armaUsata.categoria === 'una-mano') { e.pv = Math.min(e.pvMax, e.pv + 1); nota(`${e.nome}: il bastone della rettitudine lo cura di 1 PV.`); }
  if (abissoAttivo() && e.dichiara?.vortice && i.minore && !opz.vorticeCont && colpi && i.stato === 'combattimento' && i.n > 0 && !(i.usati || {})[e.id + 'vl']) {   // Vortice di lame: fino a 2 attacchi in più a -1 e -2
    (i.usati = i.usati || {})[e.id + 'vl'] = true; e.dichiara.vortice = false;
    for (let k = 1; k <= 2 && inc() === i && i.stato === 'combattimento' && i.n > 0; k++) { nota(`${e.nome} prosegue il vortice di lame (attacco a -${k}).`); const q = await attaccaUno(e, { ...opz, extra: (opz.extra || 0) - k, secondo: true, vorticeCont: true }); if (!q?.colpi) break; }
  }
  if (sup && e.mazzaGiustizia && !i.minore && pre.pv > 0 && i.pv <= 0 && (i.tag || []).includes('caos') && armaUsata?.tipo === 'contundente' && armaUsata.categoria === 'una-mano') { e.pv = Math.min(e.pvMax, e.pv + 1); nota(`${e.nome}: la mazza della giustizia lo cura di 1 PV.`); }
  return { colpi, totale };
}

/** Effetti delle abilità avanzate e dei segreti dell'Abisso sul numero di colpi di un attacco riuscito. */
function colpiAbisso(e, i, r, totale, L, arma, colpi, colpoMortale) {
  i.usati = i.usati || {};
  if (colpoMortale) { colpi = Math.max(colpi, 2); nota(`${e.nome} sferra un Colpo mortale: almeno 2 ferite.`); }
  if (haAbilita(e, 'abbattere-i-deboli') && i.minore && !i.usati[e.id + 'ad']) { i.usati[e.id + 'ad'] = true; const x = Math.floor((totale - L) / 2); if (x > 0) { colpi += x; nota(`${e.nome} (Abbattere i deboli) abbatte ${x} mostri in più.`); } }
  if (haAbilita(e, 'scova-i-punti-deboli') && !i.minore && r.tiri.length > 1) { colpi++; nota(`${e.nome} (Scova i punti deboli) infligge 1 ferita in più.`); }
  if (haAbilita(e, 'sterminatore-di-draghi') && i.drago && !(i.sterminati || {})[e.id]) { (i.sterminati = i.sterminati || {})[e.id] = true; colpi = Math.max(colpi, 2); nota(`${e.nome} (Sterminatore di draghi) infligge 2 ferite.`); }
  if (e.vendetta && !i.minore) { colpi *= 2; nota(`${e.nome}: la vendetta raddoppia le ferite.`); }
  if (i.evitaFerita && !i.minore) { /* gestito in applicaDanni */ }
  return colpi;
}

/** Abilità Recuperare munizioni: 1d6 a ogni munizione consumata (5-6 recuperata; 1 = abilità esaurita per l'incontro). */
async function recuperaMunizioni(arma) {
  if (!['arco', 'balestra', 'fionda'].includes(arma?.id)) return;
  const i = inc(), chi = eroiAttivi().find(x => haAbilita(x, 'recuperare-munizioni') && !(i.recMun || {})[x.id]);
  if (!chi) return;
  const r = await dado(`Recuperare munizioni (${chi.nome}): 5-6 recuperata, 1 abilità esaurita`);
  if (r.totale >= 5) nota(`${chi.nome} recupera la munizione.`);
  else if (r.totale === 1) { (i.recMun = i.recMun || {})[chi.id] = true; nota(`${chi.nome}: la munizione è perduta e l’abilità è esaurita per questo incontro.`); }
}

/** Bolas: nessun danno; se colpiscono il bersaglio fa un tiro salvezza contro il LIV (+½L) per restare intrappolato. */
async function lanciaBolas(e, i, colpi, desc, totale) {
  if (!colpi) { nota(`${desc} → mancato (le bolas si recuperano a fine incontro).`); modificato(); return { colpi: 0, totale }; }
  const troppoGrande = /ogre|troll|gigante|minotauro|chimera|manticora|dinosauro|drago|catoblepa|ferrofago|golem|scimitarra/i.test(i.nome), fluido = /melma|cubo|gelatina|liquame|elementale|fantasma|spettro|muffa|ombra/i.test(i.nome);
  if (i.orda || fluido || troppoGrande || (!i.minore && (i.livBase || i.liv) >= 5)) { nota(`${desc} → le bolas sono inefficaci contro ${i.nome} (fluido, orda, più grande di un umano o maggiore di LIV 5+).`); modificato(); return { colpi: 0, totale }; }
  nota(`${desc} → colpito: ${e.nome} tira il salvezza contro il LIV ${i.liv} (+½L).`);
  const ok = await salva(e, i.liv, Math.floor(e.livello / 2), `Bolas contro ${i.nome}`);
  if (ok) { i.intrappolato = e.id; nota(`${i.nome} è intrappolato dalle bolas: un compagno può legarlo con 1 azione, altrimenti si libera con la sua prossima azione.`); }
  else nota('Il bersaglio si divincola: le bolas non lo trattengono.');
  modificato(); return { colpi: 0, totale };
}
/** Un eroe spende 1 azione per legare il bersaglio intrappolato dalle bolas: è catturato vivo (conta come sconfitto). */
export async function legaBersaglio(e) {
  const i = inc(); if (!i?.intrappolato) { toast('Nessun bersaglio intrappolato.', 'warn'); return; }
  i.intrappolato = false; i.agito[e.id] = true;
  nota(`${e.nome} lega ${i.nome}: catturato vivo!`);
  if (i.minore) await applicaDanni(1); else vittoriaScontro();
  modificato();
}
/** Ricarica la balestra (1 azione). */
export function ricaricaBalestra(e) { e.balestraScarica = false; const i = inc(); if (i) i.agito[e.id] = true; nota(`${e.nome} ricarica la balestra (1 azione).`); modificato(); }
/** Il gruppo si sottrae indenne al combattimento (Muro di Ghiaccio, triboli): nessun tiro di difesa. */
export function sottrarsiIndenne(motivo) {
  const i = inc(); if (!i) return;
  nota(`Il gruppo si sottrae al combattimento senza danni (${motivo}): nessun tiro di difesa.`);
  const t = (S.adv.tessere || []).find(x => x.id === i.tessera);
  if (t) { t.sospeso = i; S.adv.incontro = (S.adv.coda || []).shift() || null; nota(`Mostri rimasti nella stanza ${t.n}.`); }
  else chiudiIncontro();
  modificato();
}

/** Numero di attacchi in mischia che un eroe può fare in un turno (l'arlecchino giocoliere ne fa fino a 3). */
export function maxAttacchi(e, arma) {
  if (profonditaAttiva() && P.doppioColpo(e, arma)) return 2;   // abilità eroica Doppio colpo
  if (e.classe === 'tiratore' && suppl() && arma?.lancio && !arma.fuoco && S.adv.tema === 'foresta' && (inc()?.turno || 1) <= 1) return 2;   // all'aperto: 2 attacchi a distanza prima della mischia
  if (abissoAttivo() && e.classe !== 'arlecchino' && arma && !arma.lancio) {   // Attacco penetrante (armi leggere) e Doppio attacco (armi a una mano, 1 volta per incontro)
    if (haAbilita(e, 'attacco-penetrante') && arma.categoria === 'leggera') return 2;
    if (haAbilita(e, 'doppio-attacco') && arma.categoria === 'una-mano' && !((inc()?.usati || {})[e.id + 'da'])) return 2;
  }
  if (e.classe !== 'arlecchino') return 1;
  const ok = a => ['leggera', 'una-mano'].includes(a?.categoria) && !a.lancio;
  const n = (e.armi || []).filter(id => ok(armaDi(id))).length;
  if (n >= 2 && ok(arma)) return Math.min(3, n);
  return suppl() && haAbilita(e, 'doppio-attacco') && ok(arma) ? 2 : 1;   // una sola arma: 1 attacco, 2 con Doppio attacco
}
function segnaAttacco(e, arma) {
  const i = inc(); i.nAtt = i.nAtt || {};
  i.nAtt[e.id] = (i.nAtt[e.id] || 0) + 1;
  if (abissoAttivo() && i.nAtt[e.id] === 2 && e.classe !== 'arlecchino' && haAbilita(e, 'doppio-attacco') && arma?.categoria === 'una-mano' && !haAbilita(e, 'attacco-penetrante')) (i.usati = i.usati || {})[e.id + 'da'] = true;
  const max = maxAttacchi(e, arma);
  if (i.nAtt[e.id] >= max) i.agito[e.id] = true; else nota(`${e.nome} può ancora fare ${max - i.nAtt[e.id]} attacco/i in questo turno.`);
}

/** Assassino: rinuncia a un attacco per nascondersi e marchiare il bersaglio. */
export async function marchia(e) {
  const i = inc();
  if (!i || i.stato !== 'combattimento') { toast('Serve un combattimento in corso.', 'warn'); return; }
  if (i.marchio && i.marchio.eroeId !== e.id) { toast('Solo un assassino alla volta può marchiare un bersaglio.', 'warn'); return; }
  if (!eroiAttivi().some(x => x.id !== e.id)) { toast('Se nessun altro compagno è attaccabile l’assassino fronteggia da solo il nemico e non può nascondersi.', 'warn'); return; }
  const r = await d6Esplosivo(`Furtività di ${e.nome} (contro LIV ${i.liv})`);
  const tot = r.totale + e.livello; i.agito[e.id] = true;
  if (r.naturale !== 1 && tot >= i.liv) { i.marchio = { eroeId: e.id }; nota(`${e.nome} si nasconde nell’ombra e marchia ${i.nome} (${tot} contro ${i.liv}): il prossimo attacco infliggerà danni tripli.`); }
  else { nota(`${e.nome} viene scoperto (${tot} contro ${i.liv}): ${i.nome} lo attacca subito.`); await eseguiDifese([{ eroeId: e.id }]); }
  modificato();
}

export async function applicaDanni(n) {
  const i = inc();
  if (i.evitaFerita && !i.minore && n > 0) {   // pantera distorcente: 3 su 1d6 di evitare la ferita
    const x = await dado(`${i.nome}: evita la ferita? (1-${i.evitaFerita.probabilita})`);
    if (x.totale <= i.evitaFerita.probabilita) { nota(`${i.nome} si teletrasporta e evita il colpo!`); return modificato(); }
  }
  if (i.orda) {
    i.liv = Math.max(0, i.liv - n); nota(`${i.nome}: il suo livello scende a ${i.liv}.`);
    if (i.liv === 0) return vittoriaScontro();
    return modificato();
  }
  if (i.minore) {
    const prima = i.n;
    i.n = Math.max(0, i.n - n);
    if (prima > i.n) await dopoMorti(i, prima - i.n, i.fonte);
    if (i.pf) { if (prima > i.n && i.pf.risorge && !i.fuocoTurno) { i.cadaveri = (i.cadaveri || 0) + (prima - i.n); i.rigenerati = 1; } P.livelloDinamico(i); }
    if (i.n === 0 && !((i.risorti || 0) > 0 || (i.rigenerati || 0) > 0 || (i.rientri || []).length)) return vittoriaScontro();
    if (i.n === 0) { nota('I caduti torneranno in piedi: resta il turno dei mostri.'); return modificato(); }
    if (!i.moraleFatto && !i.noMorale && !(i.leaderInc && !i.leaderInc.morto) && i.n * 2 < i.nIniziale) { i.moralePendente = true; nota(`Rimasti ${i.n} su ${i.nIniziale}: serve un tiro di morale.`); }
  } else {
    i.pv = Math.max(0, i.pv - n);
    if (i.pv === 0) {
      if (i.id === 'd-troll' && !i.noRig) {
        const k = await scelta('Grosso troll', 'È a 0 PV: lo fai a pezzi con un’arma da taglio (altrimenti si rigenera)?', [[true, 'Sì, a pezzi'], [false, 'No']]);
        if (!k) { i.rigenera = true; nota('Il grosso troll è a terra ma si rigenererà: tornerà in piedi con 1 PV nel suo turno, salvo Palla di Fuoco o acido.'); return modificato(); }
      }
      return vittoriaScontro();
    }
    if (i.pv * 2 < i.pvMax && i.liv === i.livBase && !i.pf?.nonRiduceLivMetaPv) { i.liv = Math.max(1, i.livBase - (i.pf?.livAMetaPV ? 2 : 1)); nota(`${i.nome} è ferito gravemente: il suo livello scende a ${i.liv}.`); if (!i.moraleFatto && !i.noMorale) { i.moralePendente = true; nota('Serve un tiro di morale.'); } }
  }
  modificato();
}

export async function tiraMorale(extra = 0) {
  const i = inc();
  const r = await dado(`Morale di ${i.nome}`);
  const tot = r.totale + (i.moraleMod || 0) + extra + (abissoAttivo() && i.minore && eroiAttivi().some(x => haAbilita(x, 'furia-terrificante')) ? -1 : 0);
  i.moraleFatto = true; i.moralePendente = false;
  if (tot <= 3) { nota(`Morale ${tot}: ${i.nome} fugge!`); return vittoriaScontro('fuga'); }
  nota(`Morale ${tot}: ${i.nome} continua a combattere.`); modificato();
}

function vittoriaScontro(esito = 'sconfitti') {
  const i = inc();
  if (!i || i.stato === 'finito') return;   // già concluso: niente secondo tiro ES per lo stesso incontro
  i.stato = 'finito'; i.esito = esito; i.n = esito === 'fuga' ? i.n : 0;
  nota(esito === 'fuga' ? `${i.nome} in fuga: conta come sconfitto.` : `${i.nome} sconfitto!`);
  vittoria(i);
  if (profonditaAttiva()) { P.vittoria(i, esito); P.fineIncontro(i, esito).catch(err => console.error(err)); }
  const coda = (S.adv.coda = S.adv.coda || []);
  if (i.leaderInc && !i.leaderInc.morto && esito !== 'fuga') { if (abissoAttivo()) i.tesoroPreso = true; i.campione = null; coda.push(i.leaderInc); nota(`Resta da affrontare il leader: ${i.leaderInc.nome}.`); i.leaderInc = null; }
  if ((i.scheletriGen || 0) > 0) {
    const sc = creaIncontro('seguaci', { id: 'scheletri-corazzati', nome: 'Scheletri corazzati', liv: 4, att: 1, pv: 1, tag: ['non-morto'], mor: 'NO', tes: 0, xp: false, contundentePiu: true }, i.scheletriGen);
    sc.contundentePiu = true; sc.tessera = i.tessera; coda.push(sc); nota(`Gli scheletri generati dal sangue (${i.scheletriGen}) si rialzano: vanno affrontati.`); i.scheletriGen = 0;
  }
  { const t = (S.adv.tessere || []).find(x => x.id === i.tessera); if (t && !coda.some(c => c.tessera === t.id)) t.ripulita = true; }   // stanza ripulita: ci si può riposare
  if (abissoAttivo()) A.fineIncontro(i, esito).catch(err => console.error(err));
  modificato();
}

export async function saccheggia() {
  const i = inc();
  if (i.tesoroPreso) return; i.tesoroPreso = true;
  if (profonditaAttiva() && i.pf && (await P.saccheggioExtra(i)) === 'solo') return modificato();   // tesori particolari delle Profondità
  if (i.oroFisso) {   // imboscate dei tratti «Braccato»: monete fisse al posto della tabella dei tesori
    const x = await tira(i.oroFisso, `Oro degli aggressori (${i.oroFisso})`);
    (S.adv.bottino = S.adv.bottino || []).push({ id: Math.random().toString(36).slice(2, 9), tipo: 'oro', testo: `${x.totale} pezzi d’oro (dagli aggressori)`, valore: x.totale });
    nota(`Saccheggio: ${x.totale} p.o.`); modificato(); return;
  }
  const oro = async (q, testo) => { (S.adv.bottino = S.adv.bottino || []).push({ id: Math.random().toString(36).slice(2, 9), tipo: 'oro', testo, valore: q }); };
  if (abissoAttivo() && i.tesoroFossa) {   // coccodrillo spinato: resti nella fossa
    const x = await dado(`Resti nella fossa (1-${i.tesoroFossa.probabilita} su 1d6 = tesoro)`);
    if (x.totale <= i.tesoroFossa.probabilita) { const q = (await tira(i.tesoroFossa.oro, 'Tesoro della fossa (8d6)')).totale; await oro(q, `${q} pezzi d’oro (resti nella fossa)`); nota(`Tra i resti: ${q} p.o.`); }
  }
  const pieno = abissoAttivo() && S.adv.pienoOro && !i.minore && !i.drago;
  if (i.oroFisso === undefined && i.tes === 'NO' && pieno) { S.adv.pienoOro = false; const x = await tira('5d6', 'Mostro pieno d’oro (50+5d6)'); await oro(50 + x.totale, `${50 + x.totale} pezzi d’oro (mostro pieno d’oro)`); nota(`Mostro pieno d’oro: ${50 + x.totale} p.o.`); modificato(); return; }
  if (i.tes === 'NO' || i.errante) { nota(i.errante ? 'I mostri erranti non hanno tesori.' : 'Nessun tesoro.'); modificato(); return; }
  const mod = typeof i.tes === 'number' ? i.tes : 0;
  let molt = i.tes === 'x2' ? 2 : (i.tesMolt || 1);
  if (pieno) { S.adv.pienoOro = false; molt *= 2; nota('Mostro pieno d’oro: le monete del tesoro sono raddoppiate.'); }
  const t = await tesoro(mod, { molt, finale: i.bossFinale, orcoSenzaMagia: i.tag.includes('orco'), gemmeInvece: !!i.tesoroSoloGemmeMagici });
  nota(`Saccheggio: ${t}`); modificato();
}

export function chiudiIncontro() {
  const i = inc(); if (!i) return;
  S.adv.incontro = (S.adv.coda || []).shift() || null;
  S.party.eroi.forEach(e => {
    if (i.paralisi?.finisceFineCombattimento) e.paralizzato = false;
    e.dichiara = {}; e.illuso = false;
    if (profonditaAttiva()) { delete e.malusAtt; delete e.malusAttGR; delete e.ruggito; delete e.muco; e.confuso = false; e.bloccato = false; e.tumuloCariche = 0; }
    e.inghiottito = false; e.mischia = false; e.bonusIncontro = 0; e.avvolto = false; e.stordito = false; e.balestraScarica = false; e.bonusProssimo = 0;
    if (e.allergiaPozioni > 0) e.allergiaPozioni--;
    if (e.cimelioIndizi && e.stato !== 'morto') { e.cimelioIndizi = 0; aggiungiIndizio(e, { semplice: true }).then(() => aggiungiIndizio(e, { semplice: true })).then(() => aggiungiIndizio(e, { semplice: true })); log(`${e.nome} sfrutta gli indizi ereditati (cimelio di famiglia).`); }
    (e.oggetti || []).forEach(o => { o.afferrato = false; });
    if (e.stato === 'ok' && (e.traguardi || []).some(t => t.id === 'passo-morte')) {   // 1 PV e nessuna guarigione per 6 incontri = 1 punto
      if (e.pv === 1) { e.passoMorte = (e.passoMorte || 0) + 1; if (e.passoMorte >= 6) { e.passoMorte = 0; T.evento(e, 'passo-morte'); } } else e.passoMorte = 0;
    }
  });
  modificato();
}

// ---------------- incantesimi e poteri ----------------
export const incantesimiPronti = e => (e.incantesimi || []).map((s, idx) => ({ ...s, idx })).filter(s => !s.usato);

/** Oggetti che annullano la vista di fuoco dell'elfo del fuoco (bonus contro il fuoco). */
export const haOggettoAntifuoco = e => !!e.antifuoco || (e.oggetti || []).some(o => o.antifuoco || /(protezion|resistenz|immunit|mantello|anello|amuleto|armatura|scudo).*(fuoco|fiamm|calore)|ignifug|antifuoco/i.test(`${o.nome || ''} ${o.nota || ''}`));

export async function lancia(e, idx, { bersaglioId, daPergamena, oggetto, sputafuoco } = {}) {
  const i = inc();
  const s = sputafuoco ? { nome: 'Palla di Fuoco', usato: false } : oggetto ? { nome: oggetto.incantesimo, usato: false } : e.incantesimi[idx];
  if (!s || s.usato) return;
  if (e.classe === 'elfo-fuoco' && suppl() && haOggettoAntifuoco(e)) { toast(`${e.nome} porta un oggetto che protegge dal fuoco: la sua vista di fuoco è annullata.`, 'warn'); return; }
  if (oggetto) {
    if (!(oggetto.cariche > 0)) return toast(`${oggetto.nome}: nessuna carica.`, 'warn');
    oggetto.cariche--;
    if (oggetto.cariche <= 0 && oggetto.consuma) e.oggetti = e.oggetti.filter(o => o !== oggetto);
    nota(`${e.nome} usa ${oggetto.nome} (cariche rimaste: ${oggetto.cariche}).`);
  }
  const rimborsa = () => { if (oggetto) { oggetto.cariche++; if (!e.oggetti.includes(oggetto)) e.oggetti.push(oggetto); } };
  if (profonditaAttiva()) { const v = P.incantesimoVietato(e); if (v) { rimborsa(); return toast(v, 'warn'); } }
  if (e.paralizzato) return toast(`${e.nome} è paralizzato e non può lanciare incantesimi.`, 'warn');
  if (i?.stato === 'combattimento' && e.illuso) return toast(`${e.nome} è illuso e non può lanciare incantesimi.`, 'warn');
  s.usato = true; i && (i.agito[e.id] = true);
  const annulla = () => { s.usato = false; rimborsa(); if (i) i.agito[e.id] = false; };
  const nome = s.nome;
  if (e.classe === 'elfo-fuoco') e.vistaAperta = true;   // con gli occhi aperti non è più immune agli sguardi
  if (suppl() && !sputafuoco) {   // Piaga magica e Allergia magica: 1 PV a ogni lancio
    if (tratto(e, 'piaga')) perdiPV(e, 1, 'piaga magica');
    if (tratto(e, 'allergia-magica')?.incantesimo === nome) perdiPV(e, 1, 'allergia magica');
  }
  if (profonditaAttiva()) {
    if (!(await P.provaRM(e, nome))) return modificato();   // Resistenza alla magia: l'incantesimo è sprecato
    if (!oggetto && !sputafuoco) P.tumuloRisparmia(e, s);
    if (i?.bloccatoDa === e.id) { i.bloccatoMod = 0; i.bloccatoDa = null; }   // Pugno Arcano: il blocco dura finché il mago non lancia un altro incantesimo
    if (P.NOMI_INCANTESIMI().includes(nome) && P.AUTOMATICI.includes(nome)) return await P.lanciaAutomatico(e, nome, annulla);
    if (i?.stato === 'combattimento' && i.pf?.immuneTuttiIncantesimi && nome !== 'Distruggi la Non-vita') { nota(`${e.nome} lancia ${nome}: ${i.nome} è immune a tutti gli incantesimi.`); return modificato(); }
  }
  if (abissoAttivo() && nome === 'Rifletti Sguardo') { annulla(); return toast('Rifletti Sguardo si lancia da solo quando devi salvarti da uno sguardo.', 'warn'); }
  if (A.AVANZATI_LANCIABILI.includes(nome)) return await A.lanciaAvanzato(e, nome, annulla, bersaglioId);
  if (nome === 'Protezione') { const b = eroePerId(bersaglioId) || e; i.protetti[b.id] = true; nota(`${e.nome} lancia Protezione su ${b.nome}: +2 alle difese per questo combattimento.`); return modificato(); }
  if (nome === 'Benedizione') { const b = eroePerId(bersaglioId) || e; b.maledetto = false; b.malattia = false; b.sfortuna = 0; if (b.stato === 'pietra') b.stato = 'ok'; nota(`${e.nome} lancia Benedizione su ${b.nome}.`); if (abissoAttivo()) await A.dopoBenedizione(e, b); if (profonditaAttiva()) P.dopoBenedizione(b); return modificato(); }
  if (nome === 'Fuga') { nota(`${e.nome} lancia Fuga e riappare nella stanza d’ingresso.`); e.fuga = true; return modificato(); }
  if (nome === 'Comunicazione a Distanza') return await comunicazioneDistanza(e, s);
  if (nome === 'Muro di Ghiaccio') return await muroGhiaccio(e);
  if (nome === 'Ondata di Forza') { const b = eroePerId(bersaglioId) || e; b.ondataForza = 6; b.ondataForzaProp = b.id === e.id; nota(`${e.nome} lancia Ondata di Forza su ${b.nome}: per 6 stanze usa armi da mischia a due mani con una mano e non subisce penalità di peso${b.id === e.id ? '; può anche sfondare le porte (azione negli Strumenti, 1 su 1d6 attira i mostri erranti)' : ''}.`); return modificato(); }
  if (nome === 'Ponte Illusorio') return await ponteIllusorio(e);
  if (nome === 'Dono d’Oro') {
    const oro = (S.adv.bottino || []).filter(x => x.tipo === 'oro' && !x.raddoppiato);
    oro.forEach(x => { x.valore *= 2; x.raddoppiato = true; x.testo = `${x.valore} pezzi d’oro (raddoppiati dal Dono d’Oro)`; });
    nota(`${e.nome} lancia Dono d’Oro: ${oro.length ? 'l’oro del tesoro è raddoppiato' : 'nessun tesoro d’oro da raddoppiare'}.`);
    return modificato();
  }
  if (nome === 'Teletrasporto del Caos') { s.usato = false; const ok = await K.teletrasporto(e); if (ok) s.usato = true; return modificato(); }
  if (!i || i.stato !== 'combattimento') { toast('Serve un combattimento in corso.', 'warn'); s.usato = false; rimborsa(); return; }
  if (i.immuneIncantesimi?.includes(nome)) { nota(`${e.nome} lancia ${nome}: ${i.nome} è immune.`); return modificato(); }
  if (i.incantesimiAnnullati) { const x = await dado(`${i.nome}: annulla l’incantesimo? (1-${i.incantesimiAnnullati.probabilita})`); if (x.totale <= i.incantesimiAnnullati.probabilita) { nota(`${e.nome} lancia ${nome}: il ${i.nome} lo annulla!`); return modificato(); } }
  const L = i.livControDistanza || livAtt(i);
  if (nome === 'Missile del Caos') {
    nota(`${e.nome} lancia Missile del Caos (automatico): ${i.minore ? 'nessun effetto sui mostri minori' : '2 PV al mostro maggiore'}; 1 PV all’incantatore.`);
    if (!i.minore) await applicaDanni(2);
    perdiPV(e, 1, 'Missile del Caos'); return modificato();
  }
  if (nome === 'Bacio di Xichtul') {
    nota(`${e.nome} lancia Bacio di Xichtul: tutti tirano 1d6 (esplosivo): chi supera il proprio livello perde 1 PV.`);
    for (const x of eroiAttivi()) { const q = await d6Esplosivo(`Bacio di Xichtul – ${x.nome}`); if (q.totale > x.livello) perdiPV(x, 1, 'Bacio di Xichtul'); }
    if (inc() === i && i.stato === 'combattimento') { const q = await d6Esplosivo(`Bacio di Xichtul – ${i.nome}`); if (q.totale > i.liv) { nota(`${i.nome} subisce 1 PV.`); await applicaDanni(1); } }
    return modificato();
  }
  if (nome === 'Scarica Oculare') K.follia(e, 1);
  const preInc = { n: i.n, pv: i.pv };
  i.fonte = 'incantesimo';
  const ctx = { ...contestoAttacco(e), incantesimo: true, daPergamena: !!daPergamena, nomeIncantesimo: nome, sputafuoco: !!sputafuoco };
  const r = await d6e(e, `${nome} di ${e.nome}`, profonditaAttiva() ? { esp: P.espAttacco(e, null, true) } : {});   // Magia esplosiva
  const m = modAttacco(e, ctx);
  const totale = r.totale + m.tot + (nome === 'Scarica Oculare' && ['elfo', 'mago'].includes(e.classe) ? 0 : 0);
  const colpisce = r.naturale !== 1 && totale >= L;
  const base = `${e.nome} lancia ${nome}: ${totale} contro LIV ${L}`;
  if (e.classe === 'elfo-fuoco' && r.naturale === 1) {
    const x = await tira(e.armatura === 'pesante' ? '1d6' : '1d3', 'Fiamme che avvolgono l’elfo del fuoco'); perdiPV(e, x.totale, 'vista di fuoco');
    for (const a of eroiAttivi()) if (a.id !== e.id && !(await salva(a, e.livello, ['elfo-fuoco', 'furfante'].includes(a.classe) ? a.livello : 0, 'Fiamme dell’elfo del fuoco'))) perdiPV(a, 1, 'fiamme');
  }
  if (profonditaAttiva()) { await P.dopoTiroIncantesimo(e, nome, r); if (P.NOMI_INCANTESIMI().includes(nome)) { await P.lanciaConTiro(e, nome, { i, r, totale, L, base, colpisce }); return modificato(); } }
  if (!colpisce) { nota(`${base} → fallito.`); return modificato(); }
  if (nome === 'Distruggi Aberranti') {
    if (i.tabella !== 'aberranti') { nota(`${base} → nessun effetto (solo mostri aberranti).`); return modificato(); }
    const q = 3 + (totale >= L * 2 ? 1 : 0); nota(`${base} → ${q} PV.`); await applicaDanni(q); return modificato();
  }
  if (nome === 'Scarica Oculare') { const q = 2 + (r.tiri.length > 1 ? 1 : 0); nota(`${base} → ${i.minore ? q + ' uccisi' : q + ' ferite'}.`); await applicaDanni(q); return modificato(); }
  if (nome === 'Occhio del Terrore') {
    const immune = i.drago || i.tag.includes('non-morto') || i.noMorale || /melma|cubo|liquame|gelatina|golem/i.test(i.nome);
    if (immune) { nota(`${base} → nessun effetto (${i.nome} non tira il morale).`); return modificato(); }
    nota(`${base} → tutti gli avversari tirano il morale a -1.`); i.moraleFatto = false; await tiraMorale(-1); return modificato();
  }
  if (nome === 'Illusione') {
    const k = await scelta('Illusione', `${base}: l’inganno riesce. Scegli l’effetto:`, [
      ['corr', 'Corrompi la creatura (come l’oro degli stolti)'], ['reaz', 'Scegli una reazione dall’elenco (non Fugge né Missione)'],
      ['mor', 'Costringi i seguaci a un tiro di morale'], ['bers', 'Crea un bersaglio illusorio (attira tutti gli attacchi per 1 turno)']]);
    if (k === 'corr') {
      if (!i.reazioni.some(x => x[2] === 'corruzione')) nota('Questa creatura non ha Corruzione fra le reazioni: nessun effetto.');
      else { nota(`${i.nome} è corrotto dall’illusione e se ne va (poi ti odierà).`); vittoria(i); finisci('corrotto'); }
    } else if (k === 'reaz') {
      const ok = i.reazioni.filter(x => !['fugge', 'fugge-inf', 'missione'].includes(x[2]));
      const sc = await scelta('Scegli la reazione', '', ok.map((x, n) => [n, x[2]]));
      nota(`Illusione: ${i.nome} reagisce con «${ok[sc ?? 0]?.[2]}».`);
      if (ok[sc ?? 0]?.[2] === 'corruzione') { vittoria(i); finisci('corrotto'); }
    } else if (k === 'mor') { if (i.minore && !i.noMorale) { i.moraleFatto = false; await tiraMorale(); } else nota('Nessun effetto (solo seguaci con morale).'); }
    else if (k === 'bers') { i.bersaglioIllusorio = true; nota('Un bersaglio illusorio attira tutti gli attacchi dei nemici per 1 turno.'); }
    return modificato();
  }
  if (nome === 'Fulmine Magico') {
    const q = i.dannoDaIncantesimo?.[nome] ?? (i.minore ? 1 : Math.max(2, Math.floor(totale / L)));
    nota(`${base} → ${i.minore ? '1 ucciso' : q + ' ferite'}.`); await applicaDanni(q);
  } else if (nome === 'Palla di Fuoco') {
    if (S.adv.muroGhiaccio) { S.adv.muroGhiaccio = false; nota('Il fuoco distrugge il Muro di Ghiaccio.'); }
    if (['d-troll', 'troll'].includes(i.id)) i.noRig = true;   // il fuoco impedisce la rigenerazione
    if (i.drago && !i.tag.includes('non-morto')) { nota(`${base} → nessun effetto sui draghi.`); return modificato(); }
    if (i.orda) { nota(`${base} → l’intero sciame è distrutto.`); await applicaDanni(99); return modificato(); }
    const bonus2 = i.id === 'mummia' ? 2 : 0;
    if (i.pf?.risorge) i.fuocoTurno = true;   // il fuoco impedisce ai troll di rialzarsi
    const comeMinori = i.minore || i.ordaP, q = comeMinori ? Math.max(1, totale + bonus2 - L) : Math.max(1, Math.floor((totale + bonus2) / L));
    nota(`${base} → ${comeMinori ? q + (i.ordaP ? ' PV all’orda' : ' uccisi') : q + ' ferite'}.`); await applicaDanni(q);
  } else if (nome === 'Sonno') {
    if (i.immuneSonnoProb) {
      if (i.immuneSonno === undefined) { const x = await dado(`${i.nome}: immuni al Sonno? (1-${i.immuneSonnoProb.probabilita}, un solo tiro)`); i.immuneSonno = x.totale <= i.immuneSonnoProb.probabilita; }
      if (i.immuneSonno) { nota(`${base} → ${i.nome} è immune al Sonno.`); return modificato(); }
    }
    if (i.tag.includes('non-morto') || i.drago) { nota(`${base} → nessun effetto (non-morti/draghi immuni).`); return modificato(); }
    if (i.ordaP) { const x = await tira('1d6', 'Mostri addormentati nell’orda'); const q = x.totale + e.livello; nota(`${base} → ${q} membri dell’orda si addormentano: -${q} PV all’orda.`); await applicaDanni(q); }
    else if (i.minore) { const x = await tira('1d6', 'Mostri addormentati'); const q = x.totale + e.livello; i.sedato += Math.min(q, i.n); nota(`${base} → ${Math.min(q, i.n)} mostri addormentati (contano come uccisi).`); await applicaDanni(q); }
    else { i.sedato = 1; nota(`${base} → ${i.nome} si addormenta (conta come sconfitto; puoi legarlo con una corda).`); await applicaDanni(i.pv); }
  } else { nota(`${base} → effetto: vedi regole.`); }
  if (i.stritolato && i.stritola?.dannoAlleatoDa?.includes(nome)) { const t = eroePerId(i.stritolato); if (t) perdiPV(t, 1, `${nome} sul serpente`); }
  T.uccisioni(e, i, preInc, { incantesimo: nome, esplosivo: r.tiri.length > 1 });
  modificato();
}

// ---- incantesimi base del supplemento con effetto meccanico ----
/** Comunicazione a Distanza: i compagni scelti ricevono 1 indizio ottenuto da chi lancia lontano dal gruppo. */
async function comunicazioneDistanza(e, s) {
  const altri = eroiVivi().filter(x => x.id !== e.id && x.stato !== 'morto');
  const chi = await sceltaMultipla('Comunicazione a Distanza', `${e.nome} condivide un indizio ottenuto lontano dal gruppo (nessun tiro). Chi lo riceve? Se non ne ha ottenuti, chiudi la finestra.`, altri.map(x => [x.id, x.nome]));
  if (!chi.length) { s.usato = false; nota(`${e.nome} non condivide alcun indizio (incantesimo non consumato).`); return modificato(); }
  nota(`${e.nome} lancia Comunicazione a Distanza: ${chi.length} compagn${chi.length === 1 ? 'o riceve' : 'i ricevono'} un indizio.`);
  for (const id of chi) await aggiungiIndizio(eroePerId(id), { semplice: true });
  return modificato();
}
/** Muro di Ghiaccio: nel combattimento permette di sottrarsi indenni, tranne contro immateriali, volanti e creature di ghiaccio/gelo. */
async function muroGhiaccio(e) {
  S.adv.muroGhiaccio = true;
  nota(`${e.nome} erige un Muro di Ghiaccio: resta fino a fine avventura (un incantesimo di fuoco lo distrugge in 1 turno; nel deserto si scioglie in 30 minuti e dà acqua per 3 giorni).`);
  const i = inc();
  if (i && i.stato === 'combattimento') {
    const passa = /ghiaccio|gelo/i.test(i.nome) || (await scelta('Muro di Ghiaccio', `${i.nome} è immateriale, volante, o può attraversare il muro?`, [[false, 'No, il muro lo ferma'], [true, 'Sì, lo attraversa']]));
    if (passa) nota(`${i.nome} attraversa il muro come se non esistesse.`);
    else if (await scelta('Muro di Ghiaccio', `Il muro blocca ${i.nome}: il gruppo può sottrarsi indenne.`, [[true, 'Sottrai il gruppo (nessuna difesa)'], [false, 'Lascia solo il muro e continua a combattere']])) sottrarsiIndenne('Muro di Ghiaccio');
  }
  return modificato();
}
/** Ponte Illusorio: attraversa gli ostacoli; contro gli inseguitori può sparire sotto i loro piedi. */
async function ponteIllusorio(e) {
  nota(`${e.nome} crea un Ponte Illusorio: il gruppo attraversa ogni ostacolo invalicabile e fiumi; scompare quando l’incantatore lascia l’area.`);
  const i = inc();
  if (i && i.stato === 'combattimento' && await scelta('Ponte Illusorio', `${i.nome} vi insegue sul ponte? Puoi farlo sparire sotto i suoi piedi (inseguitori eliminati o dispersi, bottino perso).`, [[true, 'Sì, fai sparire il ponte'], [false, 'No, solo attraversamento']])) {
    nota(`Il ponte sparisce sotto ${i.nome}: gli inseguitori sono eliminati o dispersi.`); i.tesoroPreso = true; vittoriaScontro('fuga');
  }
  return modificato();
}

export async function guarisci(e, bersaglio) {
  if ((e.usi.guarigione || 0) >= 3) return toast('Guarigioni esaurite.', 'warn');
  if (profonditaAttiva()) {
    const v = (P.curaVietata() ? 'Nella Cittadella delle cose morte non è possibile alcuna cura tranne le bende.' : null) || P.incantesimoVietato(e); if (v) return toast(v, 'warn');
    if (!(await P.provaRM(e, 'Guarigione', true))) { e.usi.guarigione++; if (inc()) inc().agito[e.id] = true; return modificato(); }
  }
  const r = profonditaAttiva() ? await P.dadoCura(e, `Guarigione di ${e.nome}`) : await tira('1d6', `Guarigione di ${e.nome}`);
  let q = r.totale + e.livello + (e.simboloSacro ? 2 : 0);
  if (profonditaAttiva()) { if (P.curaRivoMorte()) q = Math.floor(q / 2); bersaglio.curatoMagia = true; }
  const prima = bersaglio.pv;
  bersaglio.pv = Math.min(bersaglio.pvMax, bersaglio.pv + q);
  e.usi.guarigione++;
  if (inc()) inc().agito[e.id] = true;
  nota(`${e.nome} cura ${bersaglio.nome}: +${bersaglio.pv - prima} PV (tiro ${q}) → ${bersaglio.pv}/${bersaglio.pvMax}.`);
  modificato();
}
export async function usaBenedizione(e, bersaglio) {
  if ((e.usi.benedizione || 0) >= 3) return toast('Benedizioni esaurite.', 'warn');
  if (profonditaAttiva()) {
    const v = P.incantesimoVietato(e); if (v) return toast(v, 'warn');
    if (!(await P.provaRM(e, 'Benedizione', true))) { e.usi.benedizione++; if (inc()) inc().agito[e.id] = true; return modificato(); }
  }
  e.usi.benedizione++;
  const bersagli = profonditaAttiva() && P.forza(e, 'p-benedizione-condivisa') ? eroiVivi().filter(x => x.stato !== 'morto') : [bersaglio];   // Benedizione condivisa: tutto il gruppo
  for (const b of bersagli) {
    b.maledetto = false; b.malattia = false; b.sfortuna = 0; if (b.stato === 'pietra') b.stato = 'ok';
    nota(`${e.nome} lancia Benedizione su ${b.nome}.`); if (abissoAttivo()) await A.dopoBenedizione(e, b); if (profonditaAttiva()) P.dopoBenedizione(b);
  }
  modificato();
}

// ---------------- turno dei mostri ----------------
const ODIATI = { nano: ['troll', 'goblin', 'coboldo'], elfo: ['orco'], chierico: ['non-morto'] };
const odia = (inc_, e) => (ODIATI[e.classe] || []).some(t => inc_.tag.includes(t)) || P.odia(inc_, e);

/** Propone chi viene attaccato da ogni attacco dei mostri. Restituisce [{eroeId}] */
export function propostaAttacchi(opz = {}) {
  const lista = propostaBase(opz), i = inc();
  if (suppl() && i.drago && lista.length) {   // Esca per draghi: se possibile un attacco colpisce lui
    const esca = ordineMarcia().find(x => x.stato === 'ok' && inCampo(x) && tratto(x, 'esca-draghi'));
    if (esca && !lista.some(a => a.eroeId === esca.id)) lista[0] = { eroeId: esca.id };
  }
  return lista;
}
function propostaBase({ tuttiAttaccano = false } = {}) {
  const i = inc();
  if (i.nonAttacca) return [];
  if (i.assenteTurni > 0) return [];
  let attacchi = i.attPerBersaglio ? eroiAttivi().length * (i.attPerBersaglioN || 1) : (i.minore ? i.n + (i.risorti || 0) : i.att);
  if (i.pf?.primoAttaccoSeSorpresa && i.sorpresa && i.turno <= 1) attacchi = ordineMarcia().some(x => x.stato === 'ok' && haAbilita(x, 'sesto-senso')) ? i.pf.primoAttaccoSeSorpresa.attacchiSeSestoSenso : i.pf.primoAttaccoSeSorpresa.attacchi;
  if (i.id === 'd-doppelganger') { const im = eroePerId(i.imitato); if (im && im.stato === 'ok') return [{ eroeId: im.id }]; }
  if (i.minore && i.corridoio && !tuttiAttaccano) attacchi = Math.min(attacchi, 2);
  let ordine = ordineMarcia().filter(e => e.stato === 'ok' && inCampo(e) && i.campione !== e.id);
  if (i.illusione) ordine = A.filtraBersagli(i, ordine);
  if (!ordine.length) return [];
  let eleg = ordine;
  if (i.corridoio && !i.attPerBersaglio) {
    const dietro = i.sorpresa && i.errante;
    eleg = dietro ? ordine.slice(-2) : ordine.slice(0, 2);
  }
  const lista = [];
  const prima = [...eleg].sort((a, b) => (odia(i, b) - odia(i, a)) || (b.pv - a.pv));
  if (attacchi <= eleg.length) for (let k = 0; k < attacchi; k++) lista.push({ eroeId: prima[k].id });
  else {
    const per = Math.floor(attacchi / eleg.length);
    eleg.forEach(e => { for (let k = 0; k < per; k++) lista.push({ eroeId: e.id }); });
    const extra = attacchi - per * eleg.length;
    const pl = x => (suppl() && tratto(x, 'prima-linea') ? 1 : 0);   // «Sempre in prima linea»: riceve gli attacchi in più
    const ex = [...eleg].sort((a, b) => (pl(b) - pl(a)) || (odia(i, b) - odia(i, a)) || (a.pv - b.pv));
    for (let k = 0; k < extra; k++) lista.push({ eroeId: ex[k % ex.length].id });
  }
  if (i.primoBersaglio && i.turno <= 1 && lista.length && eroePerId(i.primoBersaglio)?.stato === 'ok') lista[0] = { eroeId: i.primoBersaglio };   // il 1° attacco dell'ogre è sul PG che ha mangiato
  if (i.pf?.primoAttaccoSeSorpresa && i.sorpresa && i.turno <= 1 && lista.length) { const b = casuale(eleg).id; return lista.map(() => ({ eroeId: b })); }   // pedinatori: tutti i colpi sullo stesso bersaglio
  if (!i.minore && i.att > 1 && lista.length) { // attacchi multipli del maggiore: a caso fra i bersagli possibili
    if (i.pf?.attaccoConcentrato) { const b = casuale(eleg).id; return lista.map(() => ({ eroeId: b })); }   // falene: tutti gli attacchi su un solo bersaglio
    if (i.id === 'c-manticora') { const b = casuale(eleg).id; return lista.map(() => ({ eroeId: b })); }   // la manticora colpisce sempre lo stesso bersaglio
    return lista.map(() => ({ eroeId: casuale(eleg).id }));
  }
  return lista;
}

async function effettoFerita(e, dn = 1) {
  const i = inc();
  await A.effettoFerita(e, i, dn);
  if (profonditaAttiva()) P.dopoFerita(e, i, dn);
  if (e.stato !== 'ok') return;
  if (i.id === 'ratti') { const x = await dado(`Infezione dei ratti per ${e.nome} (1 = perde 1 PV)`); if (x.totale === 1) perdiPV(e, 1, 'infezione'); }
  if (i.id === 'millepiedi') { if (!(await salva(e, 2, 0, 'Veleno millepiedi'))) perdiPV(e, 1, 'veleno'); }
  if (i.id === 'fungoidi') { if (!(await salva(e, 3, e.classe === 'mezzuomo' ? e.livello : 0, 'Veleno fungoidi'))) perdiPV(e, 1, 'veleno'); }
  if (i.id === 'ragno') { if (!(await salva(e, 3, 0, 'Veleno del ragno'))) perdiPV(e, 1, 'veleno'); }
  if (i.veleno) { if (!(await salva(e, i.veleno, 0, 'Veleno'))) perdiPV(e, 1, 'veleno'); }
  if (i.petrifica && e.stato === 'ok') { if (!(await salva(e, i.petrifica, 0, 'Pietrificazione'))) { e.stato = 'pietra'; T.evento(e, 'trasformazione'); nota(`${e.nome} è trasformato in pietra!`); } }
  if (i.dissangua) { i.dissanguati = i.dissanguati || {}; i.dissanguati[e.id] = true; }
  if (i.follia && e.stato === 'ok') K.follia(e, 1);
  if ((i.potere === 'risucchio' || i.id === 'd-spettro') && e.livello > 0) { if (!(await salva(e, 4, 0, 'Risucchio di energia'))) { e.livello--; e.pvMax = Math.max(1, e.pvMax - 1); e.pv = Math.min(e.pv, e.pvMax); nota(`${e.nome} perde un livello (ora ${e.livello}).`); } }
}

async function ferrofago(e) {
  if (e.armatura !== 'nessuna') { nota(`Il ferrofago divora l’armatura di ${e.nome}!`); e.armatura = 'nessuna'; }
  else if (e.scudo) { e.scudo = false; nota(`Il ferrofago divora lo scudo di ${e.nome}!`); }
  else if (e.armaPrincipale) { const a = armaDi(e.armaPrincipale); e.armi = (e.armi || []).filter(x => x !== e.armaPrincipale); e.armaPrincipale = e.armi[0] || null; nota(`Il ferrofago divora l’arma (${a?.nome}) di ${e.nome}!`); }
  else { const x = await tira('3d6', 'Oro divorato'); const q = Math.min(e.oro || 0, x.totale); e.oro -= q; nota(`Il ferrofago ruba ${q} p.o. a ${e.nome}.`); }
}

/** Un tiro di difesa di `dif` contro il LIV `liv` (per sé o, con la protezione, per un compagno). */
export async function provaDifesa(dif, i, liv, opz) {
  const ctx = {
    tag: i.tag, nome: i.nome, id: i.id, minore: i.minore, sorpreso: i.sorpresa && i.turno <= 1, ritirata: opz.ritirata, fuga: opz.fuga,
    ignoraArmatura: i.id === 'c-vespe' || i.psionico || i.ignoraArmatura, extra: (i.psionico ? Math.floor(dif.livello / 2) : 0) + (i.bonusDifesaClassi?.[dif.classe] ? dif.livello : 0) + (i.malusDifesaAbisso || 0),
    protezione: i.protetti?.[dif.id], senzaLanterna: !gruppoHaLanterna(), malusDifesa: i.malusDifesa, tenzone: i.tenzone,
    ignoraPesante: i.id === 'ferrofago', primoMinotauro: i.id === 'minotauro' && !i.difeso?.[dif.id]
  };
  if (profonditaAttiva()) { ctx.ignoraScudo = !!i.pf?.ignoraBonusScudi; ctx.circolo = i.circolo?.eroeId === dif.id ? i.circolo.mod : 0; if (i.fortunaBarcaiolo) ctx.extra = (ctx.extra || 0) + grNumero(); }
  if (profonditaAttiva() && dif.nessunPericolo) { dif.nessunPericolo = false; nota(`${dif.nome} ignora il pericolo (allucinazione) e non si difende.`); return { r: { naturale: 1, tiri: [1], totale: 1 }, tot: 0, ok: false }; }
  if (profonditaAttiva() && dif.autoDifesa) { dif.autoDifesa = false; nota(`${dif.nome} si difende in automatico (rivelazione).`); return { r: { naturale: 99, tiri: [99], totale: 99 }, tot: 99, ok: true }; }
  const m = modDifesa(dif, ctx);
  const r = await d6e(dif, `Difesa di ${dif.nome} (contro LIV ${liv})`, profonditaAttiva() ? { esp: P.espDifesa(dif) } : {});
  if (profonditaAttiva() && r.naturale === 1 && i.circolo?.eroeId === dif.id) { i.circolo = null; nota('Un 1 in difesa: il circolo di protezione cessa.'); }
  const tot = r.totale + m.tot;
  if (r.naturale === 1 && dif.infettoCaos) { dif.infettoCaos = false; await K.toccatoDalCaos(dif); }
  if (abissoAttivo() && r.naturale === 1 && i.rompeScudoSu1 && dif.scudo && !dif.scudoMagico && !dif.srv?.scudo) { dif.scudo = false; nota(`${i.nome} manda in frantumi lo scudo di ${dif.nome}!`); }
  return { r, tot, ok: esplode(dif, r) || (r.naturale !== 1 && tot > liv) };
}
/** Il gruppo mette in fuga i mostri (usato da incantesimi e abilità dell'Abisso). */
export function sottraiFuga() { return vittoriaScontro('fuga'); }

export async function eseguiDifese(assegnazioni, opz = {}) {
  const i = inc();
  if (i.speciale === 'gremlin') return;
  if (i.intrappolato) {   // bolas: il bersaglio spende 1 attacco per liberarsi e distrugge le bolas
    const lanc = eroePerId(i.intrappolato); i.intrappolato = false;
    if (lanc) { const k = (lanc.armi || []).indexOf('bolas'); if (k >= 0) lanc.armi.splice(k, 1); }
    nota(`${i.nome} si libera dalle bolas (usa 1 attacco) e le distrugge.`); assegnazioni = assegnazioni.slice(1);
  }
  // effetti all'inizio del turno dei mostri
  if (i.richiamo) { const x = await tira(`1d${i.richiamo}`, 'Belato: richiamo'); if (x.totale === 1) { i.n++; i.nIniziale++; nota(`${i.nome}: un altro mostro accorre in mischia!`); } }
  for (const e of eroiAttivi()) if (i.dissanguati?.[e.id]) perdiPV(e, 1, 'uccelli stigei');
  for (const e of eroiAttivi()) if (e.avvolto) perdiPV(e, 1, 'manto predatore');
  { const pre = await A.inizioTurnoMostri(i, assegnazioni); if (pre?.salta) return fineTurnoMostri(); if (pre?.assegnazioni) assegnazioni = pre.assegnazioni; }
  if (profonditaAttiva() && i.pf && await P.inizioTurnoMostri(i)) return fineTurnoMostri();   // fanghiglia, poteri psionici, forza oscura, raggio congelante, semi
  if (i.speciale === 'cubo') {
    for (const e of eroiAttivi()) {
      if (e.inghiottito) continue;
      if (!(await salva(e, e.mischia ? 4 : 2, 0, 'Inghiottito dal cubo'))) { e.inghiottito = true; nota(`${e.nome} è inghiottito dal cubo gelatinoso!`); }
      e.mischia = false;
    }
    return fineTurnoMostri();
  }
  // soffi e poteri che sostituiscono gli attacchi
  if (i.id === 'chimera' || i.id === 'c-chimera-sputo' || (i.drago && !i.senzaSoffio)) {
    const x = await dado(`${i.nome}: soffio? (1-2 = soffia)`);
    if (x.totale <= 2) {
      nota(`${i.nome} soffia fuoco su tutti!`);
      await salvaTutti(`Soffio di ${i.nome}`, i.drago ? (i.sofLiv || 6) : 4, e => (i.drago ? Math.floor(e.livello / 2) : 0), async e => {
        const q = i.sofDanno ? (await tira(i.sofDanno, 'Danno del soffio')).totale : 1; perdiPV(e, q, 'soffio');
      });
      return fineTurnoMostri();
    }
  }
  for (const [k, a] of assegnazioni.entries()) {
    const e = eroePerId(a.eroeId);
    if (!e || e.stato !== 'ok') continue;
    const liv = livDif(i, e);
    let dif = e;   // il veterano può essere protetto da un compagno che rinuncia a un attacco e tira la difesa al suo posto
    const prot = a.protettoreId ? eroePerId(a.protettoreId) : null;
    if (prot && prot.id !== e.id && prot.stato === 'ok') { dif = prot; i.agito[prot.id] = true; nota(`${prot.nome} rinuncia a un attacco per proteggere ${e.nome}: tira lui la difesa.`); }
    let es = dif.paralizzato ? { r: { naturale: 1, tiri: [1] }, tot: 0, ok: false } : await provaDifesa(dif, i, liv, opz);
    if (!es.ok && abissoAttivo() && !dif.paralizzato && await A.ripetiDifesa(dif, i)) es = await provaDifesa(dif, i, liv, opz);
    if (!es.ok && suppl() && tratto(dif, 'protetto') && !(dif.usi || {}).protetto && await scelta('Protetto dagli dèi', `${dif.nome} ha fallito la difesa (${es.tot} contro LIV ${liv}): la ripeti? (1 volta per avventura)`, [[true, 'Sì, ripeti'], [false, 'No']])) {
      dif.usi = dif.usi || {}; dif.usi.protetto = 1; nota(`${dif.nome} è protetto dagli dèi e ripete la difesa.`); es = await provaDifesa(dif, i, liv, opz);
    }
    const { r, tot, ok } = es;
    i.difeso[e.id] = true;
    if (r.naturale === 1 && i.id === 'c-tentacolato') await afferra(dif);
    if (ok && abissoAttivo() && r.tiri.length > 1 && haAbilita(dif, 'colpo-di-scudo') && !(profonditaAttiva() && haAbilita(dif, 'p-colpo-scudo-eroico')) && dif.scudo && armaPrincipale(dif)?.tipo === 'contundente' && inc() === i && i.stato === 'combattimento') { nota(`${dif.nome} (Colpo di scudo) risponde con un attacco gratuito a -1.`); await attacca(dif, { extra: -1, secondo: true }); }
    else if (ok && profonditaAttiva() && esplode(dif, r) && haAbilita(dif, 'p-colpo-scudo-eroico') && dif.scudo && inc() === i && i.stato === 'combattimento') { const ch = oggettoEffetto(dif, /scudo chiodato/i) ? 1 : 0; nota(`${dif.nome} (Colpo di scudo eroico) risponde con un attacco gratuito${ch ? ' (+1 scudo chiodato)' : ''}.`); await attacca(dif, { extra: ch, secondo: true }); }
    if (ok) nota(`${dif.nome} si difende${dif !== e ? ` per ${e.nome}` : ''}: ${tot} > ${liv} → nessun danno.`);
    else {
      nota(`${dif.nome} fallisce la difesa${dif !== e ? ` per ${e.nome}` : ''}: ${tot} contro LIV ${liv}${r.naturale === 1 ? ' (1 naturale)' : ''}.`);
      if (i.id === 'ferrofago') await ferrofago(e);
      else if (i.speciale === 'melma') {
        nota(`${i.nome} colpisce senza far danni: tiro salvezza contro la malattia.`);
        if (!(await salva(e, 4, e.classe === 'mezzuomo' ? Math.floor(e.livello / 2) : 0, 'Malattia della melma verde'))) { e.malattia = true; nota(`${e.nome} è contagiato: ogni PV perso ne costa 1 in più (Benedizione per guarire).`); }
      } else if (i.id === 'c-manticora') {
        const x = await dado('Manticora: artigli (1-2), morso (3-4), pungiglione (5-6)');
        if (x.totale <= 2 || (x.totale >= 5 && i.codaFerita)) perdiPV(e, 1, 'artigli della manticora');
        else if (x.totale <= 4) perdiPV(e, 2, 'morso della manticora');
        else {
          perdiPV(e, 1, 'pungiglione della manticora');
          if (e.stato === 'ok' && !(await salva(e, 6, 0, 'Veleno della manticora'))) { nota(`${e.nome} muore avvelenato!`); perdiPV(e, e.pv, 'veleno della manticora', { noExtra: true }); }
        }
      } else {
        const dn = (i.dannoSu1 && r.naturale === 1) ? i.dannoSu1 : (i.dannoPerAttacco?.[k] ?? (i.danno || 1));
        if (abissoAttivo() && haAbilita(e, 'sopportare-il-dolore') && !(i.usati || {})[e.id + 'sd']) { (i.usati = i.usati || {})[e.id + 'sd'] = true; nota(`${e.nome} (Sopportare il dolore) ignora la ferita.`); continue; }
        perdiPV(e, dn, i.nome);
        if (i.id === 'd-demone') { i.scheletriGen = (i.scheletriGen || 0) + dn; nota(`Il sangue versato genera ${dn} scheletr${dn === 1 ? 'o corazzato' : 'i corazzati'} (totale ${i.scheletriGen}).`); }
        if (i.rompeScudo && dif.scudo && dif.stato !== 'morto') { dif.scudo = false; nota(`${i.nome} distrugge lo scudo di ${dif.nome}!`); }
        await effettoFerita(e, dn);
      }
    }
  }
  await A.turnoLeader(i);
  if (i.id === 'd-doppelganger') { const im = eroePerId(i.imitato); if (im && im.stato === 'morto') { nota('Il personaggio imitato è caduto: il doppelganger fugge.'); return vittoriaScontro('fuga'); } }
  await fineTurnoMostri();
}
async function fineTurnoMostri() {
  const i = inc();
  if (i.stato === 'finito') return modificato();
  if (profonditaAttiva()) { await P.fineTurnoMostri(i); if (i.stato === 'finito') return modificato(); }   // rigenerazione, risurrezione dei troll, veleni, rinforzi
  // fine del turno dei mostri: rigenerazioni, risorti e sfortuna
  if (i.id === 'troll' && (i.rigenerati || 0) > 0) { i.n += i.rigenerati; nota(`${i.rigenerati} troll si rialzano rigenerati.`); i.rigenerati = 0; }
  if (i.id === 'd-nani-posseduti' && (i.risorti || 0) > 0) { nota('I nani posseduti risorti sono caduti di nuovo.'); i.risorti = 0; }
  if (i.minore && i.n === 0) return vittoriaScontro();
  if (i.id === 'd-troll' && !i.noRig) {
    if (i.rigenera) { i.rigenera = false; i.pv = 1; nota('Il grosso troll si rigenera e si rialza con 1 PV.'); }
    else if (i.pv > 0 && i.pv < i.pvMax) { i.pv++; nota(`Il grosso troll rigenera 1 PV (${i.pv}/${i.pvMax}).`); }
  } else if (i.id === 'd-troll' && i.rigenera) { nota('Colpito dal fuoco, il grosso troll non si rigenera: muore.'); i.noRig = false; return vittoriaScontro(); }
  i.noRig = false;
  if (i.sfortuna) { eroiAttivi().forEach(e => { e.sfortuna = (e.sfortuna || 0) + 1; }); nota('I gremlin si nutrono di fortuna: ogni personaggio riceve 1 punto sfortuna.'); }
  S.party.eroi.forEach(e => { e.stordito = false; });   // l'esplosione della bomba stordisce solo per un turno
  if (i.attiraErranti && !i.erranteChiamato && i.turno >= i.attiraErranti.entroTurni && i.n > 0) {
    i.erranteChiamato = true; nota(`${i.nome}: troppo rumore! Arrivano i mostri erranti, che sorprendono il gruppo.`);
    const m = await monstroErrante(); m.sorpresa = true; avviaIncontro(m, S.adv.tessere.find(x => x.id === i.tessera) || null);
  }
  i.turno++; i.sorpresa = false; i.mostriPrima = false; i.agito = {}; i.nAtt = {}; i.protetti = i.protetti || {};
  await blocchiDiTurno();
  if (i.id === 'troll' && i.n === 0) nota('Ricorda: i troll uccisi possono rigenerarsi (5-6 su 1d6 ciascuno) se non usi incantesimi o non li fai a pezzi.');
  modificato();
}

export async function sottrarsi(tipo) {
  const i = inc();
  if (profonditaAttiva() && !(await P.fugaFanghiglia(i))) return;
  if (profonditaAttiva()) P.gruppoFugge(i);
  nota(`Il gruppo ${tipo === 'ritirata' ? 'si ritira' : 'fugge'}!`);
  if (tipo === 'fuga' && suppl()) for (const v of eroiAttivi().filter(x => x.classe === 'veterano')) if (!(await salva(v, 2, 0, 'Correre in fuga'))) { nota(`${v.nome} non regge il passo: catturato e ucciso dai mostri.`); perdiPV(v, v.pv, 'catturato in fuga', { noExtra: true }); }
  if (S.adv.missione?.portatoreArazzo) K.lasciaArazzo();   // l'arazzo resta nella stanza da cui ci si ritira
  if (i.nonAttaccaInFuga || i.immobile) nota(`${i.nome} non attacca durante ${tipo === 'ritirata' ? 'la ritirata' : 'la fuga'}.`);
  else await eseguiDifese(propostaAttacchi({ tuttiAttaccano: true }), { ritirata: tipo === 'ritirata', fuga: tipo === 'fuga' });
  if (S.adv.incontro === i && i.stato !== 'finito') {
    const t = S.adv.tessere.find(x => x.id === i.tessera);
    if (t) { t.sospeso = i; S.adv.incontro = (S.adv.coda || []).shift() || null; nota(`Mostri rimasti nella stanza ${t.n}.`); }
  }
  modificato();
}
export function riprendiIncontro(t) {
  if (!t.sospeso) return;
  const i = t.sospeso; t.sospeso = null;
  i.inizioFatto = false; i.stato = 'nuovo'; i.turno = 0;
  if (S.adv.incontro && S.adv.incontro.stato !== 'finito') (S.adv.coda = S.adv.coda || []).push(i); else S.adv.incontro = i;
  modificato();
}
