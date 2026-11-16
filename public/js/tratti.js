// Tratti e traguardi del supplemento «Contro il Caos» (regole opzionali).
import { R, S, log, modificato, eroiVivi } from './state.js';
import { d66, tira, dado } from './dice.js';
import { h, toast, scelta, confirmBox, uid } from './util.js';
import { FLAGELLI, tratto, incantatore, haAbilita, suppl, creaIncontro, abissoAttivo } from './rules.js';
import * as G from './game.js';
import * as K from './caos.js';
import * as A from './abisso.js';

const ha = (e, id) => (e.tratti || []).some(t => t.id === id);
export const haTratto = ha;
const aggOggetto = (e, o) => { const ex = (e.oggetti = e.oggetti || []).find(x => x.nome === o.nome && x.cariche == null && o.cariche == null); if (ex) ex.qta = (ex.qta || 1) + (o.qta || 1); else e.oggetti.push({ qta: 1, ...o }); };

// ---------------- tratti ----------------
/** Effetti che scattano nel momento in cui il tratto viene assegnato (anche con scelte del giocatore). */
async function applicaImmediato(e, v) {
  switch (v.id) {
    case 'vitalita': e.pvMax++; e.pv++; log(`${e.nome}: +1 PV permanente (Incredibile vitalità).`); break;
    case 'folle': e.follia = Math.max(1, e.follia || 0); break;
    case 'allergia-magica': {
      const r = await tira('1d12', 'Allergia magica: incantesimo a caso (d12)'); v.incantesimo = R.caos.incantesimiBase[r.totale - 1];
      v.testo += ` Allergico a: ${v.incantesimo} (1 PV a ogni lancio).`; log(`${e.nome} è allergico all’incantesimo «${v.incantesimo}».`); break;
    }
    case 'talento': {
      const nomi = R.equipaggiamento.incantesimi.map(s => s.nome);
      v.incantesimo = (await scelta('Talento magico', `Quale incantesimo lancia a +1 ${e.nome}?${e.classe === 'barbaro' ? ' (I barbari non ottengono il bonus.)' : ''}`, nomi.map(n => [n, n]))) || nomi[0];
      v.testo += ` Incantesimo: ${v.incantesimo}.`; break;
    }
    case 'nobile': { const x = await tira(R.classi[e.classe].oro, 'Ricchezza di famiglia'); e.oro = (e.oro || 0) + x.totale; log(`${e.nome} riceve ${x.totale} p.o. dalla famiglia nobile.`); break; }
    case 'changeling': {
      const anni = (await scelta('Changeling', 'Quanti anni (1-4) ha passato presso le fate?', [1, 2, 3, 4].map(n => [n, String(n)]))) || 1;
      for (let k = 0; k < anni; k++) {
        const r = await dado(`Changeling: anno ${k + 1} (6 = tesoro magico, 1 = -1 PV)`);
        if (r.totale === 6) { const o = await G.oggettoMagico(); (S.adv.bottino = S.adv.bottino || []).push({ id: uid(), ...o }); log(`${e.nome}: le fate gli hanno lasciato un oggetto magico (nel Bottino).`); }
        else if (r.totale === 1 && e.pvMax > 1) { e.pvMax--; e.pv = Math.min(e.pv, e.pvMax); log(`${e.nome} perde 1 PV massimo per il soggiorno fra le fate.`); }
      }
      break;
    }
    case 'cimelio': {
      const k = await scelta('Cimelio di famiglia', `Che cosa eredita ${e.nome}?`, [['oro', '3d6×10 pezzi d’oro'], ['pozioni', '1d6 pozioni o pergamene'], ['arma', 'Arma leggera magica +1 (bonus totale 0)'], ['indizi', '3 indizi (dopo il primo incontro)']]);
      if (k === 'pozioni') {
        const n = (await tira('1d6', 'Pozioni o pergamene')).totale;
        const p = (await scelta('Cimelio', `${n} oggetti: quante pozioni di guarigione? (le altre sono pergamene a caso)`, Array.from({ length: n + 1 }, (_, i) => [i, `${i} pozioni, ${n - i} pergamene`]))) ?? n;
        if (p) aggOggetto(e, { nome: 'Pozione di guarigione', qta: p });
        for (let i = 0; i < n - p; i++) (S.adv.bottino = S.adv.bottino || []).push({ id: uid(), ...(await G.generaPergamena()) });
        log(`${e.nome} eredita ${p} pozioni e ${n - p} pergamene (le pergamene sono nel Bottino).`);
      } else if (k === 'arma') { e.cimelioArma = true; aggOggetto(e, { nome: 'Arma leggera magica (cimelio, +1: bonus totale 0)', nota: 'Compensa il -1 delle armi leggere.' }); log(`${e.nome} eredita un’arma leggera magica.`); }
      else if (k === 'indizi') { e.cimelioIndizi = 3; log(`${e.nome} avrà 3 indizi dopo il suo primo incontro.`); }
      else { const x = await tira('3d6x10', 'Cimelio: monete'); e.oro = (e.oro || 0) + x.totale; log(`${e.nome} eredita ${x.totale} p.o.`); }
      break;
    }
    case 'ben-piazzato': {
      v.scelta = (await scelta('Ben piazzato', 'Scegli il vantaggio:', [['pv', '+1 PV iniziale'], ['danni', 'Una volta per combattimento 2 PV con un’arma a due mani in mischia']])) || 'pv';
      if (v.scelta === 'pv') { e.pvMax++; e.pv++; } v.testo += v.scelta === 'pv' ? ' (scelto: +1 PV)' : ' (scelto: danni doppi con armi a due mani)'; break;
    }
    case 'mente': {
      v.scelta = incantatore(e) ? ((await scelta('Mente geniale', 'Scegli il vantaggio:', [['incantesimo', '1 incantesimo in più'], ['indizio', '1 indizio gratis alla prima stanza vuota di ogni avventura']])) || 'indizio') : 'indizio';
      v.testo += v.scelta === 'incantesimo' ? ' (scelto: 1 incantesimo in più)' : ' (scelto: indizio gratis)'; break;
    }
  }
}

/** Tira un tratto (d66): con 66 si sceglie fra due tratti o un tratto raro. */
export async function tiraTratto(e, { profondita = 0 } = {}) {
  const tab = R.tratti.tratti;
  const aggiungi = async (t) => {
    if (ha(e, t.id)) return false;
    const voce = { id: t.id, nome: t.nome, testo: t.testo };
    (e.tratti = e.tratti || []).push(voce);
    await applicaImmediato(e, voce); log(`${e.nome} ottiene il tratto «${t.nome}».`); return true;
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
  if (t.id !== 'doppi') { await aggiungi(t); modificato('party'); return; }
  const s = await scelta('Tratti doppi o tratti rari', 'Che cosa scegli?', [['doppi', 'Due tratti dalla lista'], ['raro', 'Un tratto raro (d8)']]);
  if (s === 'raro') await tiraRaro(e, aggiungi);
  else for (let k = 0; k < 2; k++) await aggiungi(await un());
  modificato('party');
}
async function tiraRaro(e, aggiungi, profondita = 0) {
  const tab = R.tratti.rari;
  for (let k = 0; k < 20; k++) {
    const x = await tira8();
    const t = tab.find(r => r.d8 === x);
    if (t.id === 'dotato') { if (profondita > 0) continue; await tiraRaro(e, aggiungi, 1); await tiraRaro(e, aggiungi, 1); return; }
    if (await aggiungi(t)) return;
  }
}
const tira8 = async () => (await tira('1d8', 'Tratto raro (d8)')).totale;

// ---------------- traguardi ----------------
/** Perché un traguardo non è adatto all'eroe (null = va bene). */
function nonIdoneo(e, t) {
  if (['pergamene', 'fulmine', 'sonno'].includes(t.id) && (!incantatore(e) || e.classe === 'elfo-fuoco')) return 'Traguardo riservato agli incantatori che leggono gli incantesimi.';
  if (t.id === 'serrature' && !['furfante', 'arlecchino', 'assassino'].includes(e.classe)) return 'Traguardo riservato a chi sa scassinare (furfanti, arlecchini, assassini).';
  if (t.id === 'panoplia' && e.classe === 'barbaro') return 'I barbari non usano oggetti magici.';
  return null;
}
export async function tiraTraguardo(e) {
  let t;
  for (let k = 0; k < 30; k++) {
    const r = await d66('Traguardo (d66)');
    t = R.traguardi.traguardi.find(x => x.d66 === r.totale) || R.traguardi.traguardi[0];
    if (!nonIdoneo(e, t)) break;
  }
  return assegnaTraguardo(e, t);
}
/** Elenco dei mostri minori comuni fra cui scegliere per «Conoscenza degli abitanti dei sotterranei». */
function mostriMinori() {
  const visti = new Map();
  for (const sorgente of [R.mostri, R.avanzate.mostri, R.caos.mostri]) for (const tab of ['infestanti', 'seguaci']) for (const m of sorgente[tab] || []) if (!visti.has(m.id)) visti.set(m.id, m.nome);
  return [...visti];
}
export async function assegnaTraguardo(e, t) {
  const max = ha(e, 'eclettico') ? 2 : 1;
  e.traguardi = e.traguardi || [];
  if (e.traguardi.length >= max) { toast(`${e.nome} ha già ${max === 1 ? 'un traguardo' : 'due traguardi'} in corso.`, 'warn'); return false; }
  const no = nonIdoneo(e, t); if (no) { toast(no, 'warn'); return false; }
  const voce = { id: t.id, nome: t.nome, obiettivo: t.obiettivo, unita: t.unita, testo: t.testo, effetto: t.effetto || null, conta: 0 };
  if (t.bersaglio) {
    if (!((e.indizi || 0) >= 1)) { toast(`${e.nome} deve spendere 1 indizio per studiare le tracce: non ne ha.`, 'warn'); return false; }
    const id = await scelta(t.nome, 'Quale tipo di mostro minore studia? (costa 1 indizio)', mostriMinori().map(([i, n]) => [i, n]));
    if (!id) return false;
    e.indizi--; voce.bersaglio = { id, nome: mostriMinori().find(x => x[0] === id)[1] };
  }
  if (t.id === 'panoplia') voce.conta = Object.values(e.panoplia || {}).filter(Boolean).length;
  e.traguardi.push(voce);
  log(`${e.nome} sceglie il traguardo «${t.nome}»${voce.bersaglio ? ` (${voce.bersaglio.nome})` : ''}.`); modificato('party');
  if (voce.conta >= voce.obiettivo) completa(e, voce).catch(err => console.error(err));
  return true;
}
export function conta(e, k, d) {
  const t = e.traguardi[k]; if (!t) return;
  t.conta = Math.max(0, t.conta + d);
  if (t.conta >= t.obiettivo) completa(e, t).catch(err => console.error(err));
  modificato('party');
}
/** Riprova a completare i traguardi che erano bloccati da una condizione (es. lancio esplosivo di Fulmine). */
export function verifica(e) { for (const t of [...(e.traguardi || [])]) if (t.conta >= t.obiettivo) completa(e, t).catch(err => console.error(err)); }

async function completa(e, t) {
  const P = e.perm = e.perm || {};
  if (t.id === 'fulmine' && !P.fulmineEsp) { toast(`${e.nome}: servono 20 PV con Fulmine e almeno un lancio esplosivo.`, 'warn'); return; }
  const k = e.traguardi.indexOf(t); if (k < 0) return;
  e.traguardi.splice(k, 1);   // subito, così il completamento non scatta due volte
  log(`${e.nome} completa il traguardo «${t.nome}»! ${t.testo}`);
  if (t.effetto?.pvMax) { e.pvMax += t.effetto.pvMax; e.pv += t.effetto.pvMax; }
  e.completati = [...(e.completati || []), t.nome];
  toast(`Traguardo completato: ${t.nome}`);
  await applicaEffetto(e, t, P);
  modificato('party');
}

/** Beneficio permanente (o una tantum) di un traguardo completato. */
async function applicaEffetto(e, t, P) {
  const ricorda = testo => log(`${e.nome}: ${testo}`);
  switch (t.id) {
    case 'gemme': {
      const buone = (e.oggetti || []).filter(o => o.tipo === 'gemma' && o.valore >= 50).flatMap(o => Array.from({ length: o.qta || 1 }, () => o)).sort((a, b) => a.valore - b.valore);
      if (buone.length < 10) { ricorda('servono 10 gemme da 50+ p.o. in mano per far costruire il gioiello (+50%).'); break; }
      const usate = buone.slice(0, 10), somma = usate.reduce((a, o) => a + o.valore, 0);
      for (const g of usate) { if (g.qta > 1) g.qta--; else e.oggetti = e.oggetti.filter(y => y !== g); }
      const v = Math.floor(somma * 1.5); aggOggetto(e, { nome: `Gioiello da ${v} p.o.`, tipo: 'gioiello', valore: v });
      ricorda(`10 gemme (${somma} p.o.) diventano un gioiello da ${v} p.o.`); break;
    }
    case 'pergamene': {
      const nomi = R.equipaggiamento.incantesimi.filter(s => (e.classe === 'mago' || s.id !== 'benedizione')).map(s => s.nome);
      P.pergamene = (await scelta('Collezionista di pergamene', 'Scegli l’incantesimo in più (resta fisso a ogni avventura):', nomi.map(n => [n, n]))) || nomi[0];
      ricorda(`1 incantesimo in più per avventura: ${P.pergamene}.`); break;
    }
    case 'segreti': await G.scegliSegreto(e, { gratis: true }); break;
    case 'generoso': P.benAttesa = (P.benAttesa || 0) + 2; ricorda('nella prossima avventura potrà lanciare 2 Benedizioni gratuite (azione libera).'); break;
    case 'risparmiatore': e.oro = (e.oro || 0) + 100; ricorda('un investimento frutta 100 p.o.'); break;
    case 'ritratto': P.prossimoES = (P.prossimoES || 0) + 1; ricorda('+1 al prossimo tiro ES.'); break;
    case 'rubacuori': {
      const k = await scelta('Rubacuori', 'Quale ricompensa?', [['bonus', '+1 permanente ad amoreggiare'], ['oro', 'Un regalo da 250 p.o.']]);
      if (k === 'oro') { e.oro = (e.oro || 0) + 250; ricorda('riceve 250 p.o. da un amante.'); } else { P.amoreggiare = (P.amoreggiare || 0) + 1; ricorda('+1 permanente ad amoreggiare.'); }
      break;
    }
    case 'panoplia': P.favori = (P.favori || 0) + 1; ricorda('guadagna 1 favore da un’autorità (300 p.o., multa annullata, uscita di prigione o resurrezione). La decorazione costa 100 p.o.: pagala a mano.'); break;
    case 'cuoco': effettoCuoco(); P.cuoco = true; ricorda('da ora cucina a ogni riposo (salta i propri benefici): follia o ferite dei compagni migliorano.'); break;
    case 'abitanti': (P.abitanti = P.abitanti || []).push(t.bersaglio); ricorda(`può ritirare il numero di «${t.bersaglio.nome}» (accettando il secondo tiro).`); break;
    case 'buon-padrone': ricorda('il mercenario è ormai leale (morale +1, +1 PV): segnalo a mano, i mercenari non sono gestiti.'); break;
    case 'saali': P.saali = true; ricorda('santuario operativo: -1 follia a fine avventura e 5 razioni gratis (mai cacciare cervi).'); break;
    case 'tamas-santuario': P.tamasSantuario = true; ricorda('prima di ogni avventura può prestare un giuramento.'); break;
    case 'missioni': P.missioni = true; ricorda('può ottenere la reazione Missione e ripetere fino a 6 attacchi falliti durante quella missione.'); break;
    case 'cercatore': P.cercatoreMax = true; ricorda('il prossimo tiro casuale di un tesoro sarà il massimo.'); break;
    default: P[t.id] = true;
  }
}
/** Effetto del «Cuoco dei sotterranei»: chi ha più follia ne perde 1, altrimenti il più ferito guarisce 1 PV. */
export function effettoCuoco() {
  const v = eroiVivi();
  const f = v.filter(e => (e.follia || 0) > 0).sort((a, b) => b.follia - a.follia)[0];
  if (f) { K.follia(f, -1); return; }
  const g = v.filter(e => e.stato === 'ok' && e.pv < e.pvMax).sort((a, b) => (b.pvMax - b.pv) - (a.pvMax - a.pv))[0];
  if (g) { g.pv++; log(`La cucina del gruppo fa guarire ${g.nome} di 1 PV in più.`); }
}
/** Spende p.o. per un traguardo «a spese» (santuari, ritratto, donazioni). */
export async function paga(e, k) {
  const t = e.traguardi[k]; if (!t) return;
  const opz = [10, 50, 100, 200, 500].filter(n => n <= (e.oro || 0));
  if (!opz.length) { toast(`${e.nome} non ha abbastanza p.o.`, 'warn'); return; }
  const n = await scelta(t.nome, `Quanti p.o. versa ${e.nome}? (ne ha ${e.oro})`, opz.map(x => [x, `${x} p.o.`]));
  if (!n) return;
  e.oro -= n; log(`${e.nome} versa ${n} p.o. per «${t.nome}».`); conta(e, k, n);
}

// ---- conteggio automatico dei traguardi ----
/** Traguardi che l'app aggiorna da sola. */
export const AUTOMATICI = new Set(['passo-morte', 'gemme', 'pergamene', 'grazia', 'dragonidi', 'dungeon', 'segreti', 'flagello-hobgoblin', 'flagello-orchi',
  'flagello-coboldi', 'flagello-ghoul', 'flagello-goblin', 'flagello-troll', 'fulmine', 'sonno', 'sguardo', 'missioni', 'infestanti', 'streghe', 'veleno', 'trasformazione',
  'cuoco', 'abitanti', 'boschi', 'serrature', 'cercatore', 'panoplia', 'risparmiatore']);
/** Aggiunge n punti al traguardo `id` dell'eroe, se lo sta perseguendo. */
export function evento(e, id, n = 1) {
  if (!e || !(n > 0)) return;
  const k = (e.traguardi || []).findIndex(t => t.id === id);
  if (k >= 0) conta(e, k, n);
}
export function tutti(id, n = 1) { eroiVivi().forEach(e => evento(e, id, n)); }

/** Dopo un attacco o un incantesimo: attribuisce uccisioni e danni all'eroe. pre = {n, pv} del mostro prima dell'effetto. */
export function uccisioni(e, i, pre, { mischia = false, incantesimo = '', esplosivo = false } = {}) {
  if (!e || !i || !pre || i.orda) return;
  const uccisi = i.minore ? Math.max(0, pre.n - i.n) : (pre.pv > 0 && i.pv <= 0 ? 1 : 0);
  const pvInflitti = i.minore ? uccisi : Math.max(0, pre.pv - i.pv);
  if (i.imboscata?.eroeId === e.id && uccisi) braccatoUccisi(e, i, uccisi);
  if (!(e.traguardi || []).length && !(incantesimo === 'Fulmine Magico' && esplosivo)) return;
  const liv = i.livBase || i.liv || 0, nome = i.nome || '';
  if (uccisi) {
    for (const [id, re] of FLAGELLI) if (re.test(nome)) evento(e, id, uccisi * liv);
    if (i.tabella === 'infestanti') evento(e, 'infestanti', uccisi);
    if (/strega|stregon|megera|fattucchier/i.test(nome)) evento(e, 'streghe', uccisi);
    if (!i.minore && mischia) evento(e, 'grazia', 1);
  }
  if (i.drago) evento(e, 'dragonidi', pvInflitti);
  if (incantesimo === 'Fulmine Magico') { evento(e, 'fulmine', pvInflitti); if (esplosivo) { (e.perm = e.perm || {}).fulmineEsp = true; verifica(e); } }
  if (incantesimo === 'Sonno') evento(e, 'sonno', uccisi * liv);
}
/** Un incontro con un tipo di mostro: conta per «Conoscenza degli abitanti dei sotterranei». */
export function incontro(inc) {
  if (!inc) return;
  for (const e of eroiVivi()) { const k = (e.traguardi || []).findIndex(t => t.id === 'abitanti' && t.bersaglio?.id === inc.id); if (k >= 0) conta(e, k, 1); }
}
/** Controllo dei traguardi legati all'oro in tasca («Risparmiatore»). */
export function controllaOro() {
  for (const e of eroiVivi()) { const t = (e.traguardi || []).find(x => x.id === 'risparmiatore'); if (t) { t.conta = Math.min(e.oro || 0, t.obiettivo); if (t.conta >= t.obiettivo) completa(e, t).catch(err => console.error(err)); } }
}
/** Un oggetto magico preso dall'eroe: serve per la Panoplia (arma, armatura e scudo magici). */
export function oggettoMagicoRicevuto(e, x) {
  const t = `${x.armaturaTipo || ''}`;
  const cat = x.bonusArma ? 'arma' : x.bonusDifesa ? (/scudo/i.test(t) ? 'scudo' : /anello/i.test(t) ? null : 'armatura') : null;
  if (!cat) return;
  e.panoplia = e.panoplia || {};
  if (!e.panoplia[cat]) { e.panoplia[cat] = true; evento(e, 'panoplia', 1); }
}

// ---------------- imboscate dei tratti «Braccato da…» ----------------
const BRACCATI = {
  'braccato-orchi': { soglia: 15, nome: 'Orchi', id: 'imb-orchi', liv: 3, mor: 0, tag: ['orco'], oro: '2d6', boss: { nome: 'Orco (boss)', liv: 5, pv: 4, oro: '4d6' } },
  'braccato-ratti': { soglia: 15, nome: 'Uomini ratto', id: 'imb-ratti', liv: 4, mor: -1, tag: [], oro: '3d6' },
  'braccato-goblin': { soglia: 18, nome: 'Goblin minori', id: 'imb-goblin', liv: 2, mor: -1, tag: ['goblin'], oroMostro: 1 }
};
const REAZ = [[1, 6, 'combatte-sempre']];
async function imboscata(e, tid) {
  const B = BRACCATI[tid];
  const x = await dado(`${tratto(e, tid).nome}: imboscata per ${e.nome}? (1-2 sì)`);
  if (x.totale > 2) return;
  const q = (await tira('1d6', `Numero di ${B.nome.toLowerCase()}`)).totale;
  let inc;
  if (B.boss && q === 1) {
    inc = creaIncontro('boss', { id: B.id + '-boss', nome: B.boss.nome, liv: B.boss.liv, att: 1, pv: B.boss.pv, tag: B.tag, mor: 0, tes: 'NO', xp: true, reazioni: REAZ }, 1);
    inc.oroFisso = B.boss.oro;
  } else {
    inc = creaIncontro('seguaci', { id: B.id, nome: B.nome, liv: B.liv, att: 1, pv: 1, tag: B.tag, mor: B.mor, tes: 'NO', xp: false, reazioni: REAZ }, q);
    inc.oroFisso = B.oro || String(q * B.oroMostro);
  }
  inc.nome += ` (imboscata a ${e.nome})`;
  Object.assign(inc, { solo: e.id, imboscata: { eroeId: e.id, tratto: tid }, sorpresa: true });
  log(`${e.nome} cade in un’imboscata: ${inc.nome}, da affrontare da solo.`);
  G.avviaIncontro(inc, null);
}
function braccatoUccisi(e, i, uccisi) {
  const tid = i.imboscata.tratto, B = BRACCATI[tid], pt = i.minore ? uccisi : uccisi * 3;   // un boss orco vale 3 orchi
  e.braccati = e.braccati || {}; e.braccati[tid] = (e.braccati[tid] || 0) + pt;
  log(`${e.nome} ha eliminato ${e.braccati[tid]}/${B.soglia} ${B.nome.toLowerCase()} che lo braccano.`);
  if (e.braccati[tid] >= B.soglia) { e.tratti = (e.tratti || []).filter(t => t.id !== tid); log(`${e.nome} ha eliminato abbastanza ${B.nome.toLowerCase()}: il tratto che lo rendeva braccato scompare.`); }
}
/** Il personaggio solo contro l'imboscata è caduto. */
export function imboscataPersa(e, i) {
  const tid = i.imboscata?.tratto;
  if (tid === 'braccato-ratti') {
    e.stato = 'prigioniero'; e.pv = 1;
    log(`${e.nome} è solo stordito e finisce prigioniero degli uomini ratto: servono 2 indizi per trovare la tana oppure un riscatto di ${100 * e.livello} p.o.`);
  } else log(`${e.nome} è stato trucidato: il gruppo può spendere 3 indizi e svelare un segreto per trovare la tana nel prossimo dungeon (con l’equipaggiamento del caduto).`);
}

// ---------------- inizio e fine avventura ----------------
/** All'inizio dell'avventura: effetti di tratti, traguardi e abilità che si rinnovano a ogni dungeon. */
export async function inizioAvventura() {
  if (!suppl()) return;
  for (const e of S.party.eroi) {
    if (e.stato === 'morto') continue;
    Object.assign(e, { ubriaco: false, allergiaPozioni: 0, stordito: false, furiaSangue: false, bonusProssimo: 0, vistaAperta: false, giuramento: null, cappuccioIndossato: false });
    const P = e.perm = e.perm || {};
    P.benGratis = P.benAttesa || 0; P.benAttesa = 0;
    if (ha(e, 'alcolizzato')) { const r = await dado(`${e.nome} (alcolizzato): è ubriaco? (4+ sì)`); if (r.totale >= 4) { e.ubriaco = true; log(`${e.nome} si presenta ubriaco: -1 a tutti i tiri finché non scende a metà PV.`); } }
    if (P.saali) { aggOggetto(e, { nome: 'Razioni', qta: 5 }); log(`Il santuario di Saali fornisce 5 razioni a ${e.nome}.`); }
    if (P.tamasSantuario) {
      const k = await scelta('Santuario di Tamas Zeya', `${e.nome} presta un giuramento prima dell’avventura?`, [['sepoltura', 'Non abbandonerò il corpo di un amico senza sepoltura'], ['caos', 'Sconfiggerò da solo almeno 5 servitori minori del caos'], ['rinuncia', 'Rinuncerò ai guadagni: donerò almeno 200 p.o.'], [null, 'Nessun giuramento']]);
      e.giuramento = k || null; if (k) log(`${e.nome} presta il giuramento «${k}» al santuario di Tamas Zeya.`);
    }
    if (haAbilita(e, 'preparare-veleno')) { aggOggetto(e, { nome: 'Veleno preparato', qta: 1, nota: 'Effetto: vedi «Esperto di veleni» in Contro l’Abisso.' }); log(`${e.nome} prepara una dose di veleno.`); }
    if (haAbilita(e, 'usare-bombe') && !(e.oggetti || []).some(o => /^bomba/i.test(o.nome))) {
      if ((e.oro || 0) >= 30) { e.oro -= 30; aggOggetto(e, { nome: 'Bomba (creata con Usare bombe)', qta: 1, nota: '1 azione e una fonte di fuoco: 2 attacchi a +3 sui minori, 1 sui maggiori; tutti salvano contro l’esplosione.' }); log(`${e.nome} crea una bomba (30 p.o.).`); }
      else log(`${e.nome} non ha 30 p.o. per creare la bomba.`);
    }
  }
}
/** Alla fine dell'avventura: conteggi dei dungeon, santuari, giuramenti e imboscate dei tratti. */
export async function fineAvventura() {
  if (!suppl()) return;
  const a = S.adv, stanze = (a.tessere || []).filter(t => t.tipo === 'stanza').length;
  if (stanze >= 10 && a.esTirati) { tutti('dungeon'); if (a.tema === 'foresta') tutti('boschi'); }
  const vivi = eroiVivi().filter(e => e.stato === 'ok');
  for (const e of vivi) {
    if (e.perm?.saali && (e.follia || 0) > 0) { K.follia(e, -1); log(`Il santuario di Saali: ${e.nome} recupera 1 punto follia.`); }
    if (e.giuramento) {
      const k = await scelta('Giuramento a Tamas Zeya', `${e.nome} ha mantenuto il giuramento «${e.giuramento}»?`, [[true, 'Sì: trova una pergamena di Benedizione'], [false, 'No']]);
      if (k) { aggOggetto(e, { nome: 'Pergamena: Benedizione', qta: 1, tipo: 'pergamena', nota: 'Pergamena: Benedizione', cariche: 1, caricheMax: 1, incantesimo: 'Benedizione', consuma: true }); log(`${e.nome} trova una pergamena di Benedizione nel santuario.`); }
      e.giuramento = null;
    }
  }
  controllaOro();
  if (!vivi.length) return;
  for (const e of vivi) for (const tid of Object.keys(BRACCATI)) if (ha(e, tid) && e.stato === 'ok') await imboscata(e, tid);
}

// ---------------- abilità avanzate ----------------
const TIPI_BERSAGLIO = [['non-morto', 'Non-morti (anche incorporei e vampiri)'], ['artificiale', 'Creature artificiali (automi, elementali, golem, robot)'], ['informe', 'Esseri informi (blob, cubi gelatinosi, melme, muffe)']];
/** Quante abilità avanzate può già avere l'eroe secondo il livello (null = nessun limite). */
function abilitaConsentite(e) {
  const ingegno = ha(e, 'ingegno'), da = e.classe === 'veterano' ? (ingegno ? 2 : 3) : (ingegno ? 3 : 5);   // veterano dal 3° (dal 2° con Ingegno precoce), gli altri dal 5° (dal 3°)
  if (e.livello < da) return 0;
  return e.classe === 'veterano' && e.livello < 5 ? e.livello - da + 1 : null;
}
const iniziali = e => (e.classe === 'veterano' ? ['assistenza', 'leader-carismatico'] : []);
/** Sezione «Abilità avanzate» della scheda eroe. */
export function sezioneAbilita(e, rinfresca) {
  const box = h('div', { class: 'tratti' });
  const cat = [];   // catalogo: abilità del Caos (se attivo) e dell'Abisso (se attivo, con il testo del manuale che le descrive)
  if (S.party.supplCaos) cat.push(...(R.caos.abilita || []));
  if (abissoAttivo()) for (const a of R.abisso.abilita) { const k = cat.findIndex(x => x.id === a.id); if (k >= 0) cat[k] = { ...cat[k], testo: a.effetto, classi: [...new Set([...cat[k].classi, ...a.classi])] }; else cat.push({ id: a.id, nome: a.nome, classi: a.classi, testo: a.effetto }); }
  const sincronizza = () => {
    const sp = (e.abilita || []).filter(a => a.id === 'attacco-specializzato');
    e.specializzato = sp.length > 0; e.specializzati = sp.map(a => a.bersaglio).filter(Boolean);
  };
  const draw = () => {
    box.replaceChildren(h('h4', {}, 'Abilità avanzate'));
    const mie = e.abilita || [];
    const implicite = iniziali(e).filter(id => !mie.some(a => a.id === id));
    implicite.forEach(id => { const c = cat.find(x => x.id === id); box.append(h('div', { class: 'row' }, h('span', { class: 'grow', title: c?.testo }, h('b', {}, c?.nome || id), ' (iniziale) – ', c?.testo || ''))); });
    mie.forEach((a, k) => { const c = cat.find(x => x.id === a.id);
      box.append(h('div', { class: 'row' }, h('span', { class: 'grow', title: c?.testo }, h('b', {}, c?.nome || a.id), a.bersaglio ? ` (${TIPI_BERSAGLIO.find(t => t[0] === a.bersaglio)?.[1] || A.nomeMostro(a.bersaglio)})` : a.arma ? ` (${a.arma})` : '', ' – ', c?.testo || ''),
        h('button', { class: 'mini', onclick: () => { e.abilita.splice(k, 1); sincronizza(); modificato('party'); rinfresca(); } }, '×'))); });
    if (!mie.length && !implicite.length) box.append(h('small', {}, 'Nessuna abilità avanzata.'));
    const disp = cat.filter(c => c.classi.includes(e.classe) && !implicite.includes(c.id) && (c.id === 'attacco-specializzato' || c.id === 'resistente' || !mie.some(a => a.id === c.id)));
    if (disp.length) {
      const sel = h('select', {}, disp.map(c => h('option', { value: c.id, title: c.testo }, c.nome)));
      const consentite = abilitaConsentite(e), possedute = mie.length;
      box.append(h('div', { class: 'row' }, sel, h('button', { onclick: async () => {
        const c = cat.find(x => x.id === sel.value);
        if ((consentite === 0 || (consentite !== null && possedute >= consentite)) && !(await confirmBox(`${e.nome} non può ancora imparare un’altra abilità avanzata (dal ${e.classe === 'veterano' ? '3°' : '5°'} livello; con Ingegno precoce prima). Aggiungerla comunque?`))) return;
        const voce = { id: c.id };
        if (['nemico-giurato', 'resistente'].includes(c.id) && abissoAttivo()) { const v = await A.sceltaAbilita(c); if (!v) return; voce.bersaglio = v.bersaglio; }
        if (c.id === 'attacco-specializzato') { voce.bersaglio = await scelta('Attacco specializzato', 'Quale classe di nemici può marchiare?', TIPI_BERSAGLIO); if (!voce.bersaglio) return; }
        if (c.id === 'lanciatore-di-coltelli') voce.arma = (await scelta('Lanciatore di coltelli', 'In quale arma si specializza?', [['stella', 'Stella da lancio (ne lancia 2 con una sola azione)'], ['altra', 'Un’altra arma da lancio (da gestire a mano)']])) || 'altra';
        (e.abilita = e.abilita || []).push(voce); sincronizza(); log(`${e.nome} impara l’abilità avanzata «${c.nome}».`); modificato('party'); rinfresca();
      } }, abissoAttivo() ? 'Aggiungi senza tiro (correzione)' : 'Aggiungi abilità')));
      box.append(h('small', { class: 'hint' }, e.classe === 'veterano' ? 'Il veterano impara 1 abilità al 3°, 4° e 5° livello (esclusa la magia); dal 5° in poi con le regole normali.' : abissoAttivo() ? 'Le abilità si imparano dal 5° livello spendendo un tiro ES (1d8+2 nell’Abisso, 7-8 naturale sempre un successo): dal pannello Gruppo scegli «Imparare un’abilità avanzata». Ogni abilità si impara una sola volta (Resistente per tipi diversi).' : 'Le abilità avanzate si imparano dal 5° livello (dal 3° con Ingegno precoce); le abilità del manuale «Contro l’Abisso» si imparano con un tiro ES attivando quel supplemento.'));
    }
  };
  draw();
  return box;
}

// ---------------- scheda eroe ----------------
const PERM_TXT = { benAttesa: 'Benedizioni gratuite nella prossima avventura', benGratis: 'Benedizioni gratuite disponibili', favori: 'Favori da un’autorità', prossimoES: 'Bonus al prossimo tiro ES', amoreggiare: 'Bonus ad amoreggiare', cercatoreMax: 'Prossimo tesoro casuale al massimo', fulmineEsp: 'Lancio esplosivo di Fulmine ottenuto', pergamene: 'Incantesimo in più (grimorio)' };
const nomePerm = k => PERM_TXT[k] || R.traguardi.traguardi.find(x => x.id === k)?.nome || k;
/** Tratti con una meccanica applicata dal programma (gli altri restano un promemoria). */
const TRATTI_AUTO = new Set(['abilita-meccanica', 'alcolizzato', 'allergia-magica', 'allergico-pozioni', 'avido', 'tamas', 'braccato-orchi', 'braccato-ratti', 'braccato-goblin', 'changeling', 'cimelio', 'corrotto', 'diario',
  'eclettico', 'esca-draghi', 'folle', 'fortuna-tesori', 'vitalita', 'intuizione', 'bastoni', 'lame', 'miope', 'nemici-gloria', 'nobile', 'piaga', 'presenza', 'protetto', 'sangue-orco', 'prima-linea', 'retroguardia',
  'sovrappeso', 'talento', 'ben-piazzato', 'distruttore', 'guaritore', 'ingegno', 'lesto-esperienza', 'mente']);
/** Sezione della scheda eroe. */
export function sezione(e, rinfresca) {
  const box = h('div', { class: 'tratti' });
  const draw = () => {
    box.replaceChildren(h('h4', {}, 'Tratti'));
    (e.tratti || []).forEach((t, k) => box.append(h('div', { class: 'row' }, h('span', { class: 'grow', title: t.testo }, h('b', {}, t.nome), ' – ', t.testo, TRATTI_AUTO.has(t.id) ? h('small', { class: 'tag' }, ' effetto automatico') : null),
      h('button', { class: 'mini', onclick: () => { e.tratti.splice(k, 1); modificato('party'); rinfresca(); } }, '×'))));
    if (!(e.tratti || []).length) box.append(h('small', {}, 'Nessun tratto.'));
    box.append(h('div', { class: 'row' }, h('button', { onclick: async () => { await tiraTratto(e); rinfresca(); } }, 'Tira un tratto (d66)')));
    box.append(h('h4', {}, 'Traguardi'));
    (e.traguardi || []).forEach((t, k) => {
      const spesa = R.traguardi.traguardi.find(x => x.id === t.id)?.spesa;
      box.append(h('div', { class: 'card' }, h('b', {}, t.nome, t.bersaglio ? ` – ${t.bersaglio.nome}` : ''), h('p', { class: 'hint' }, t.testo),
        h('div', { class: 'row' }, h('span', { class: 'grow' }, `${t.conta}/${t.obiettivo} ${t.unita}`, AUTOMATICI.has(t.id) ? h('small', { class: 'tag' }, ' conteggio automatico') : null),
          spesa ? h('button', { class: 'mini', title: 'Versa p.o. per questo traguardo', onclick: async () => { await paga(e, k); rinfresca(); } }, 'Paga p.o.') : null,
          h('button', { class: 'mini', onclick: () => { conta(e, k, -1); rinfresca(); } }, '−'), h('button', { class: 'mini', onclick: () => { conta(e, k, 1); rinfresca(); } }, '+'),
          h('button', { class: 'mini', onclick: () => { conta(e, k, 10); rinfresca(); } }, '+10'),
          h('button', { class: 'mini', onclick: () => { e.traguardi.splice(k, 1); modificato('party'); rinfresca(); } }, '×'))));
    });
    if ((e.completati || []).length) box.append(h('p', { class: 'hint' }, `Completati: ${e.completati.join(', ')}`));
    const perm = Object.entries(e.perm || {}).filter(([, v]) => v && !(Array.isArray(v) && !v.length));
    if (perm.length) {
      box.append(h('h4', {}, 'Benefici permanenti'));
      perm.forEach(([k, v]) => box.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, nomePerm(k), Array.isArray(v) ? `: ${v.map(x => x.nome || x).join(', ')}` : typeof v === 'number' ? ` (${v})` : typeof v === 'string' ? `: ${v}` : ''),
        h('button', { class: 'mini', title: 'Togli il beneficio', onclick: () => { delete e.perm[k]; modificato('party'); rinfresca(); } }, '×'))));
    }
    const sel = h('select', {}, R.traguardi.traguardi.map(t => h('option', { value: t.id }, t.nome)));
    box.append(h('div', { class: 'row' }, sel,
      h('button', { onclick: async () => { await assegnaTraguardo(e, R.traguardi.traguardi.find(t => t.id === sel.value)); rinfresca(); } }, 'Scegli'),
      h('button', { onclick: async () => { await tiraTraguardo(e); rinfresca(); } }, 'Tira (d66)')));
  };
  draw();
  return box;
}
