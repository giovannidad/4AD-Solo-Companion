// Incontri e combattimento: reazioni, attacchi, incantesimi, difese, morale, bottino.
import { R, S, log, modificato, eroiVivi, eroiAttivi, eroePerId, ordineMarcia, livelloMax } from './state.js';
import { dado, tira, d6Esplosivo, migliorDi } from './dice.js';
import { modAttacco, modDifesa, trovaReazione, gruppoHaLanterna, haNano, armaDi, armaPrincipale } from './rules.js';
import { tesoro, vittoria, terminaAvventura } from './game.js';
import { toast, pick } from './util.js';

export const inc = () => S.adv.incontro;
const casuale = arr => arr[Math.floor(Math.random() * arr.length)];

export function nota(testo) {
  const i = inc();
  if (i) { i.cronaca = i.cronaca || []; i.cronaca.push(testo); }
  log(testo);
}
const finisci = (esito) => { const i = inc(); i.stato = 'finito'; i.esito = esito; modificato(); };

// ---------------- avvio e reazioni ----------------
export async function inizioScontro() {
  const i = inc(); if (i.inizioFatto) return; i.inizioFatto = true;
  i.stato = 'combattimento'; i.turno = 1; i.agito = {}; i.protetti = {}; i.difeso = {};
  if (i.id === 'catoblepa') await salvaTutti('Sguardo del catoblepa', 4, () => 0, e => perdiPV(e, 1, 'sguardo'));
  if (i.id === 'medusa') await salvaTutti('Sguardo della medusa', 4, e => (e.classe === 'furfante' ? Math.floor(e.livello / 2) : 0), e => { e.stato = 'pietra'; nota(`${e.nome} è trasformato in pietra!`); });
  if (i.id === 'signore-caos') await poteriCaos();
  modificato();
}

async function poteriCaos() {
  const r = await dado('Poteri del signore del caos (d6)');
  const i = inc();
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
  const r = await dado(`Reazione di ${i.nome} (d6)`);
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
    else if (typeof re[3] === 'string' && /d6/.test(re[3])) i.reazione.param = (await tira(re[3], 'Tangente')).totale;
    i.stato = 'corruzione';
  } else if (azione === 'combatte' || azione === 'morte' || azione === 'combatte-sempre') {
    if (azione !== 'combatte') i.noMorale = true;
    i.mostriPrima = true; await inizioScontro();
  } else if (azione === 'dorme') { i.bonusPrimoAttacco = 2; await inizioScontro(); }
  else i.stato = 'speciale';
  modificato();
}

export function costoCorruzione() {
  const i = inc(), p = i.reazione?.param;
  if (typeof p !== 'number') return null;
  return i.reazione.tipoCorr === 'totale' ? p : p * i.n;
}
export const oroTotale = () => eroiVivi().reduce((a, e) => a + (e.oro || 0), 0);
export function haOroStolti() { return eroiVivi().some(e => (e.oggetti || []).some(o => /oro degli stolti/i.test(o.nome))); }

export function paga(costo, stolti = false) {
  const i = inc();
  if (stolti) {
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
export function perdiPV(e, n, causa = '') {
  e.pv -= n;
  nota(`${e.nome} perde ${n} PV${causa ? ' (' + causa + ')' : ''}${e.pv <= 0 ? ' e cade a terra, ferito mortalmente!' : ` → ${e.pv}/${e.pvMax}`}`);
  if (e.pv <= 0) { e.pv = 0; e.stato = 'morto'; }
  controllaSconfitta(); modificato();
}
function controllaSconfitta() {
  if (!eroiVivi().some(e => e.stato === 'ok')) { terminaAvventura('Il gruppo è stato sconfitto'); if (inc()) { inc().stato = 'finito'; inc().esito = 'sconfitta'; } }
}
export async function salva(e, liv, bonus = 0, label = 'Tiro salvezza') {
  const r = await d6Esplosivo(`${label} – ${e.nome} (L${liv})`);
  const tot = r.totale + bonus;
  const ok = r.naturale !== 1 && tot >= liv;
  nota(`${label}: ${e.nome} tira ${tot} contro L${liv} → ${ok ? 'salvo' : 'FALLITO'}.`);
  return ok;
}
export async function salvaTutti(label, liv, bonusFn, onFail) {
  for (const e of eroiAttivi()) if (!(await salva(e, liv, bonusFn(e), label))) onFail(e);
  modificato();
}

// ---------------- attacco ----------------
export function contestoAttacco(e, opz = {}) {
  const i = inc();
  return { bersaglio: i, arma: opz.armaId, ...ctxGruppo(), extra: opz.extra || 0, bonusGruppo: (i.bonusPrimoAttacco && i.turno === 1 ? i.bonusPrimoAttacco : 0) + (opz.bonusGruppo || 0), bonusGruppoTxt: 'Bonus del gruppo' };
}

export async function attacca(e, opz = {}) {
  const i = inc();
  if (!i.inizioFatto) await inizioScontro();
  if (i.speciale === 'gremlin') return;
  const ctx = contestoAttacco(e, opz);
  const furioso = !!opz.furioso;
  const r = furioso ? await migliorDi(3, `Attacco furioso di ${e.nome}`) : await d6Esplosivo(`Attacco di ${e.nome}`);
  const m = modAttacco(e, ctx);
  const totale = r.totale + m.tot;
  const auto1 = r.naturale === 1;
  let colpi = !auto1 && totale >= i.liv ? Math.max(1, Math.floor(totale / i.liv)) : 0;
  if (furioso && colpi) colpi *= 2;
  if (furioso) e.usi.furie = (e.usi.furie || 0) + 1;
  i.agito[e.id] = true;
  const desc = `${e.nome} attacca: ${r.totale}${m.tot ? (m.tot > 0 ? '+' : '') + m.tot : ''} = ${totale} contro LIV ${i.liv}${auto1 ? ' (1 naturale: fallimento automatico)' : ''}`;
  if (!colpi) { nota(`${desc} → mancato.`); modificato(); return { colpi: 0, totale }; }
  nota(`${desc} → ${i.minore ? `${colpi} uccis${colpi === 1 ? 'o' : 'i'}` : `${colpi} ferit${colpi === 1 ? 'a' : 'e'}`}${furioso ? ' (furioso: danni doppi)' : ''}.`);
  await applicaDanni(colpi);
  return { colpi, totale };
}

export async function applicaDanni(n) {
  const i = inc();
  if (i.minore) {
    i.n = Math.max(0, i.n - n);
    if (i.n === 0) return vittoriaScontro();
    if (!i.moraleFatto && !i.noMorale && i.n * 2 < i.nIniziale) { i.moralePendente = true; nota(`Rimasti ${i.n} su ${i.nIniziale}: serve un tiro di morale.`); }
  } else {
    i.pv = Math.max(0, i.pv - n);
    if (i.pv === 0) return vittoriaScontro();
    if (i.pv * 2 < i.pvMax && i.liv === i.livBase) { i.liv = Math.max(1, i.livBase - 1); nota(`${i.nome} è ferito gravemente: il suo livello scende a ${i.liv}.`); if (!i.moraleFatto && !i.noMorale) { i.moralePendente = true; nota('Serve un tiro di morale.'); } }
  }
  modificato();
}

export async function tiraMorale() {
  const i = inc();
  const r = await dado(`Morale di ${i.nome}`);
  const tot = r.totale + (i.moraleMod || 0);
  i.moraleFatto = true; i.moralePendente = false;
  if (tot <= 3) { nota(`Morale ${tot}: ${i.nome} fugge!`); return vittoriaScontro('fuga'); }
  nota(`Morale ${tot}: ${i.nome} continua a combattere.`); modificato();
}

function vittoriaScontro(esito = 'sconfitti') {
  const i = inc();
  i.stato = 'finito'; i.esito = esito; i.n = esito === 'fuga' ? i.n : 0;
  nota(esito === 'fuga' ? `${i.nome} in fuga: conta come sconfitto.` : `${i.nome} sconfitto!`);
  vittoria(i); modificato();
}

export async function saccheggia() {
  const i = inc();
  if (i.tesoroPreso) return; i.tesoroPreso = true;
  if (i.tes === 'NO' || i.errante) { nota(i.errante ? 'I mostri erranti non hanno tesori.' : 'Nessun tesoro.'); modificato(); return; }
  const mod = typeof i.tes === 'number' ? i.tes : 0;
  const molt = i.tes === 'x2' ? 2 : (i.tesMolt || 1);
  const t = await tesoro(mod, { molt, finale: i.bossFinale, orcoSenzaMagia: i.tag.includes('orco') });
  nota(`Saccheggio: ${t}`); modificato();
}

export function chiudiIncontro() {
  const i = inc(); if (!i) return;
  S.adv.incontro = (S.adv.coda || []).shift() || null;
  modificato();
}

// ---------------- incantesimi e poteri ----------------
export const incantesimiPronti = e => (e.incantesimi || []).map((s, idx) => ({ ...s, idx })).filter(s => !s.usato);

export async function lancia(e, idx, { bersaglioId, daPergamena } = {}) {
  const i = inc();
  const s = e.incantesimi[idx];
  if (!s || s.usato) return;
  s.usato = true; i && (i.agito[e.id] = true);
  const nome = s.nome;
  if (nome === 'Protezione') { const b = eroePerId(bersaglioId) || e; i.protetti[b.id] = true; nota(`${e.nome} lancia Protezione su ${b.nome}: +2 alle difese per questo combattimento.`); return modificato(); }
  if (nome === 'Benedizione') { const b = eroePerId(bersaglioId) || e; b.maledetto = false; if (b.stato === 'pietra') b.stato = 'ok'; nota(`${e.nome} lancia Benedizione su ${b.nome}.`); return modificato(); }
  if (nome === 'Fuga') { nota(`${e.nome} lancia Fuga e riappare nella stanza d’ingresso.`); e.fuga = true; return modificato(); }
  if (!i || i.stato !== 'combattimento') { toast('Serve un combattimento in corso.', 'warn'); s.usato = false; return; }
  const ctx = { ...contestoAttacco(e), incantesimo: true, daPergamena: !!daPergamena };
  const r = await d6Esplosivo(`${nome} di ${e.nome}`);
  const m = modAttacco(e, ctx);
  const totale = r.totale + m.tot;
  const colpisce = r.naturale !== 1 && totale >= i.liv;
  const base = `${e.nome} lancia ${nome}: ${totale} contro LIV ${i.liv}`;
  if (!colpisce) { nota(`${base} → fallito.`); return modificato(); }
  if (nome === 'Fulmine Magico') {
    const q = i.minore ? 1 : Math.max(2, Math.floor(totale / i.liv));
    nota(`${base} → ${i.minore ? '1 ucciso' : q + ' ferite'}.`); await applicaDanni(q);
  } else if (nome === 'Palla di Fuoco') {
    if (i.drago && !i.tag.includes('non-morto')) { nota(`${base} → nessun effetto sui draghi.`); return modificato(); }
    const bonus2 = i.id === 'mummia' ? 2 : 0;
    const q = i.minore ? Math.max(1, totale + bonus2 - i.liv) : Math.max(1, Math.floor((totale + bonus2) / i.liv));
    nota(`${base} → ${i.minore ? q + ' uccisi' : q + ' ferite'}.`); await applicaDanni(q);
  } else if (nome === 'Sonno') {
    if (i.tag.includes('non-morto') || i.drago) { nota(`${base} → nessun effetto (non-morti/draghi immuni).`); return modificato(); }
    if (i.minore) { const x = await tira('1d6', 'Mostri addormentati'); const q = x.totale + e.livello; i.sedato += Math.min(q, i.n); nota(`${base} → ${Math.min(q, i.n)} mostri addormentati (contano come uccisi).`); await applicaDanni(q); }
    else { i.sedato = 1; nota(`${base} → ${i.nome} si addormenta (conta come sconfitto; puoi legarlo con una corda).`); await applicaDanni(i.pv); }
  } else { nota(`${base} → effetto: vedi regole.`); }
  modificato();
}

export async function guarisci(e, bersaglio) {
  if ((e.usi.guarigione || 0) >= 3) return toast('Guarigioni esaurite.', 'warn');
  const r = await tira('1d6', `Guarigione di ${e.nome}`);
  const q = r.totale + e.livello + (e.simboloSacro ? 2 : 0);
  const prima = bersaglio.pv;
  bersaglio.pv = Math.min(bersaglio.pvMax, bersaglio.pv + q);
  e.usi.guarigione++;
  if (inc()) inc().agito[e.id] = true;
  nota(`${e.nome} cura ${bersaglio.nome}: +${bersaglio.pv - prima} PV (tiro ${q}) → ${bersaglio.pv}/${bersaglio.pvMax}.`);
  modificato();
}
export function usaBenedizione(e, bersaglio) {
  if ((e.usi.benedizione || 0) >= 3) return toast('Benedizioni esaurite.', 'warn');
  e.usi.benedizione++; bersaglio.maledetto = false; if (bersaglio.stato === 'pietra') bersaglio.stato = 'ok';
  nota(`${e.nome} lancia Benedizione su ${bersaglio.nome}.`); modificato();
}

// ---------------- turno dei mostri ----------------
const ODIATI = { nano: ['troll', 'goblin', 'coboldo'], elfo: ['orco'], chierico: ['non-morto'] };
const odia = (inc_, e) => (ODIATI[e.classe] || []).some(t => inc_.tag.includes(t));

/** Propone chi viene attaccato da ogni attacco dei mostri. Restituisce [{eroeId}] */
export function propostaAttacchi({ tuttiAttaccano = false } = {}) {
  const i = inc();
  let attacchi = i.minore ? i.n * 1 : i.att;
  if (i.minore && i.corridoio && !tuttiAttaccano) attacchi = Math.min(attacchi, 2);
  const ordine = ordineMarcia().filter(e => e.stato === 'ok');
  if (!ordine.length) return [];
  let eleg = ordine;
  if (i.corridoio) {
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
    const ex = [...eleg].sort((a, b) => (odia(i, b) - odia(i, a)) || (a.pv - b.pv));
    for (let k = 0; k < extra; k++) lista.push({ eroeId: ex[k % ex.length].id });
  }
  if (!i.minore && i.att > 1 && lista.length) { // attacchi multipli del maggiore: a caso fra i bersagli possibili
    return lista.map(() => ({ eroeId: casuale(eleg).id }));
  }
  return lista;
}

async function effettoFerita(e) {
  const i = inc();
  if (e.stato !== 'ok') return;
  if (i.id === 'ratti') { const x = await dado(`Infezione dei ratti per ${e.nome} (1 = perde 1 PV)`); if (x.totale === 1) perdiPV(e, 1, 'infezione'); }
  if (i.id === 'millepiedi') { if (!(await salva(e, 2, 0, 'Veleno millepiedi'))) perdiPV(e, 1, 'veleno'); }
  if (i.id === 'fungoidi') { if (!(await salva(e, 3, e.classe === 'mezzuomo' ? e.livello : 0, 'Veleno fungoidi'))) perdiPV(e, 1, 'veleno'); }
  if (i.id === 'ragno') { if (!(await salva(e, 3, 0, 'Veleno del ragno'))) perdiPV(e, 1, 'veleno'); }
  if (i.potere === 'risucchio' && e.livello > 0) { if (!(await salva(e, 4, 0, 'Risucchio di energia'))) { e.livello--; e.pvMax = Math.max(1, e.pvMax - 1); e.pv = Math.min(e.pv, e.pvMax); nota(`${e.nome} perde un livello (ora ${e.livello}).`); } }
}

async function ferrofago(e) {
  if (e.armatura !== 'nessuna') { nota(`Il ferrofago divora l’armatura di ${e.nome}!`); e.armatura = 'nessuna'; }
  else if (e.scudo) { e.scudo = false; nota(`Il ferrofago divora lo scudo di ${e.nome}!`); }
  else if (e.armaPrincipale) { const a = armaDi(e.armaPrincipale); e.armi = (e.armi || []).filter(x => x !== e.armaPrincipale); e.armaPrincipale = e.armi[0] || null; nota(`Il ferrofago divora l’arma (${a?.nome}) di ${e.nome}!`); }
  else { const x = await tira('3d6', 'Oro divorato'); const q = Math.min(e.oro || 0, x.totale); e.oro -= q; nota(`Il ferrofago ruba ${q} p.o. a ${e.nome}.`); }
}

export async function eseguiDifese(assegnazioni, opz = {}) {
  const i = inc();
  if (i.speciale === 'gremlin') return;
  // soffi e poteri che sostituiscono gli attacchi
  if (i.id === 'chimera' || i.drago) {
    const x = await dado(`${i.nome}: soffio? (1-2 = soffia)`);
    if (x.totale <= 2) {
      nota(`${i.nome} soffia fuoco su tutti!`);
      await salvaTutti(`Soffio di ${i.nome}`, i.drago ? 6 : 4, e => (i.drago ? Math.floor(e.livello / 2) : 0), e => perdiPV(e, 1, 'soffio'));
      return fineTurnoMostri();
    }
  }
  for (const a of assegnazioni) {
    const e = eroePerId(a.eroeId);
    if (!e || e.stato !== 'ok') continue;
    const ctx = {
      tag: i.tag, sorpreso: i.sorpresa && i.turno <= 1, ritirata: opz.ritirata, fuga: opz.fuga,
      protezione: i.protetti?.[e.id], senzaLanterna: !gruppoHaLanterna(),
      ignoraPesante: i.id === 'ferrofago', primoMinotauro: i.id === 'minotauro' && !i.difeso[e.id]
    };
    const m = modDifesa(e, ctx);
    const r = await d6Esplosivo(`Difesa di ${e.nome} (contro LIV ${i.liv})`);
    const tot = r.totale + m.tot;
    const ok = r.naturale === 6 || (r.naturale !== 1 && tot > i.liv);
    i.difeso[e.id] = true;
    if (ok) nota(`${e.nome} si difende: ${tot} > ${i.liv} → nessun danno.`);
    else {
      nota(`${e.nome} difesa fallita: ${tot} contro LIV ${i.liv}${r.naturale === 1 ? ' (1 naturale)' : ''}.`);
      if (i.id === 'ferrofago') await ferrofago(e);
      else { perdiPV(e, i.danno || 1, i.nome); await effettoFerita(e); }
    }
  }
  fineTurnoMostri();
}
function fineTurnoMostri() {
  const i = inc(); i.turno++; i.sorpresa = false; i.mostriPrima = false; i.agito = {}; i.protetti = i.protetti || {};
  if (i.id === 'troll' && i.n === 0) nota('Ricorda: i troll uccisi possono rigenerarsi (5-6 su 1d6 ciascuno) se non usi incantesimi o non li fai a pezzi.');
  modificato();
}

export async function sottrarsi(tipo) {
  const i = inc();
  nota(`Il gruppo ${tipo === 'ritirata' ? 'si ritira' : 'fugge'}!`);
  const lista = propostaAttacchi({ tuttiAttaccano: true });
  await eseguiDifese(lista, { ritirata: tipo === 'ritirata', fuga: tipo === 'fuga' });
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
