// Oggetti, abilità e azioni speciali del supplemento «Contro il Caos» usabili in combattimento e negli Strumenti.
import { R, S, log, modificato, eroiAttivi, eroePerId } from './state.js';
import { dado, tira } from './dice.js';
import { oggettoEffetto } from './rules.js';
import { toast, scelta } from './util.js';
import * as C from './combat.js';
import * as K from './caos.js';
import * as G from './game.js';
import * as T from './tratti.js';

const inCombattimento = () => { const i = C.inc(); return i && i.stato === 'combattimento' ? i : null; };
const consuma = (e, o) => { if ((o.qta || 1) > 1) o.qta--; else e.oggetti = (e.oggetti || []).filter(x => x !== o); };
const speso = (e, i) => { if (i?.agito) i.agito[e.id] = true; };

// ---------------- riconoscimento degli oggetti dal nome ----------------
export const OGGETTI = {
  bomba: /^bomba|bomba \(/i, triboli: /^triboli/i, polvere: /polvere melmicida/i, segno: /segno di xichtul/i, invocazione: /invocazione dell.ordine/i,
  cappuccio: /cappuccio del caos/i, filtro: /filtro della calma/i, amuleto: /amuleto curativo/i, tomo: /tomo/i
};
export const oggettoDi = (e, k) => (e.oggetti || []).find(o => OGGETTI[k].test(o.nome || '') || (k !== 'bomba' && OGGETTI[k].test(o.nota || '')));
/** Oggetti d'uso in combattimento che l'eroe possiede (per i pulsanti dell'incontro). */
export function oggettiCombattimento(e) {
  const out = [];
  for (const k of ['bomba', 'triboli', 'polvere', 'invocazione', 'cappuccio', 'amuleto']) { const o = oggettoDi(e, k); if (o && !(o.cariche != null && o.cariche <= 0)) out.push([k, o]); }
  return out;
}

// ---------------- polvere melmicida, triboli, bomba ----------------
export async function usaPolvere(e, o) {
  const i = inCombattimento(); if (!i) return toast('Serve un combattimento in corso.', 'warn');
  if (!(o.cariche > 0)) return toast('Polvere esaurita.', 'warn');
  if (!/cubo|melma|muffa|fung|liquame|gelatina/i.test(i.nome) && !(await scelta('Polvere melmicida', `${i.nome} è un cubo gelatinoso, una melma, una muffa o un fungo?`, [[true, 'Sì'], [false, 'No: annulla']]))) return;
  o.cariche--; speso(e, i);
  C.nota(`${e.nome} scaglia la polvere melmicida su ${i.nome}: ${i.minore ? '2 mostri uccisi' : '2 PV'} (dosi rimaste: ${o.cariche}).`);
  await C.applicaDanni(2); modificato();
}
export async function usaTriboli(e, o) {
  const i = inCombattimento(); if (!i) return toast('Serve un combattimento in corso.', 'warn');
  if (!i.minore) return toast('I triboli funzionano solo contro mostri minori.', 'warn');
  if (!(await scelta('Triboli', 'Sei in una stanza senza porta e i mostri non volano?', [[true, 'Sì: il gruppo si sottrae'], [false, 'No: annulla']]))) return;
  consuma(e, o); C.sottrarsiIndenne('triboli'); modificato();
}
export async function lanciaBomba(e, o) {
  const i = inCombattimento(); if (!i) return toast('Serve un combattimento in corso.', 'warn');
  if (e.classe === 'barbaro') return toast('I barbari non usano le bombe.', 'warn');
  if (!e.lanterna && !oggettoEffetto(e, /torcia/i)) return toast('Serve una fonte di fuoco in mano (lanterna o torcia) per accendere la miccia.', 'warn');
  const q = o.qta || 1;
  const n = e.classe === 'arlecchino' && q >= 2 ? await scelta('Bomba', 'L’arlecchino può lanciare 2 bombe insieme contro lo stesso bersaglio.', [[1, 'Una bomba'], [2, 'Due bombe']]) || 1 : 1;
  const L = i.liv, tiri = (i.minore ? 2 : 1) * n, pre = { n: i.n, pv: i.pv };
  let colpi = 0;
  for (let k = 0; k < tiri; k++) {
    const r = await C.d6e(e, `Attacco della bomba di ${e.nome} (+3)`), tot = r.totale + 3;   // nessun altro bonus
    const c = r.naturale !== 1 && tot >= L ? Math.max(1, Math.floor(tot / L)) : 0; colpi += c;
    C.nota(`Bomba (${k + 1}/${tiri}): ${r.totale}+3 = ${tot} contro LIV ${L} → ${c ? c + (i.minore ? ' uccisi' : ' ferite') : 'mancato'}.`);
  }
  for (let k = 0; k < n; k++) consuma(e, o);
  speso(e, i);
  if (colpi) { i.fonte = 'bomba'; await C.applicaDanni(colpi); }
  T.uccisioni(e, i, pre, {});
  await C.salvaTutti('Esplosione della bomba', 5, x => (x.classe === 'nano' ? 1 : 0), x => { x.stordito = true; C.nota(`${x.nome} è stordito dall’esplosione: -1 alla difesa nel turno dei mostri.`); });
  modificato();
}

// ---------------- oggetti magici del caos ----------------
/** Segno di Xichtul (prima del combattimento, 1 volta per avventura): 1d8+L contro il LIV dei minori del caos. */
export async function usaSegno(e, o) {
  const i = C.inc(); if (!i || i.stato === 'finito') return toast('Nessun incontro.', 'warn');
  e.usi = e.usi || {}; if (e.usi.segno) return toast('Il segno di Xichtul è già stato usato in questa avventura.', 'warn');
  if (!i.minore || !(i.tag || []).includes('caos')) return toast('Funziona solo contro mostri minori del caos.', 'warn');
  e.usi.segno = 1;
  const r = await tira('1d8', `Segno di Xichtul (${e.nome}: 1d8 + livello contro LIV ${i.liv})`), tot = r.totale + e.livello;
  if (tot >= i.liv) {
    C.nota(`Segno di Xichtul: ${tot} contro LIV ${i.liv} → ${i.nome} ignora il gruppo finché non viene attaccato.`);
    i.reazione = { azione: 'pacifico', testo: 'Ignorano il gruppo (segno di Xichtul).' }; i.stato = 'speciale';
  } else C.nota(`Segno di Xichtul: ${tot} contro LIV ${i.liv} → non funziona.`);
  modificato();
}
/** Invocazione dell'ordine: 3 PV a un maggiore del caos oppure morale forzato per i minori del caos. */
export async function usaInvocazione(e, o) {
  const i = inCombattimento(); if (!i) return toast('Serve un combattimento in corso.', 'warn');
  if (!['chierico', 'guerriero', 'mago'].includes(e.classe) || e.caosTrasf || e.infettoCaos) return toast('Solo chierici, guerrieri e maghi non contaminati dal caos possono usarla.', 'warn');
  if (!(i.tag || []).includes('caos')) return toast('Funziona solo contro creature del caos.', 'warn');
  consuma(e, o); speso(e, i);
  if (!i.minore) { C.nota(`${e.nome} legge l’invocazione dell’ordine: 3 PV a ${i.nome}.`); await C.applicaDanni(3); }
  else { C.nota(`${e.nome} legge l’invocazione dell’ordine: ${i.nome} deve tirare il morale (anche con MOR NO).`); const no = i.noMorale; i.noMorale = false; i.moraleFatto = false; await C.tiraMorale(); if (C.inc() === i) i.noMorale = no; }
  modificato();
}
/** Cappuccio del caos: +3 a un attacco in mischia contro un maggiore (1 volta per avventura); ogni uso richiede «Toccato dal caos». */
export async function usaCappuccio(e) {
  const i = inCombattimento(); if (!i) return toast('Serve un combattimento in corso.', 'warn');
  if (!e.cappuccioIndossato) return toast('Prima indossa il cappuccio (Strumenti): chi lo indossa tira subito «Toccato dal caos».', 'warn');
  e.usi = e.usi || {}; if (e.usi.cappuccio) return toast('Il cappuccio è già stato usato in questa avventura.', 'warn');
  if (i.minore) return toast('Il +3 vale solo contro un mostro maggiore.', 'warn');
  e.usi.cappuccio = 1; e.bonusProssimo = 3;
  C.nota(`${e.nome} sfrutta il cappuccio del caos: +3 al prossimo attacco in mischia contro ${i.nome}. (L’Aura di Terrore di «Contro l’Abisso» va gestita a mano.)`);
  await K.toccatoDalCaos(e); modificato();
}
/** Chi indossa il cappuccio tira subito «Toccato dal caos». */
export async function indossaCappuccio(e) { log(`${e.nome} indossa il cappuccio del caos.`); await K.toccatoDalCaos(e); }
/** Amuleto curativo (4 PV in totale): in combattimento costa un'azione. */
export async function usaAmuleto(e, o, bersaglio) {
  if (!(o.cariche > 0)) return toast('L’amuleto è esaurito.', 'warn');
  const max = Math.min(o.cariche, bersaglio.pvMax - bersaglio.pv); if (max <= 0) return toast(`${bersaglio.nome} non ha ferite.`, 'warn');
  const q = max === 1 ? 1 : await scelta('Amuleto curativo', `Quanti PV guarisce ${bersaglio.nome}? (restano ${o.cariche})`, Array.from({ length: max }, (_, k) => [k + 1, `${k + 1} PV`]));
  if (!q) return;
  o.cariche -= q; bersaglio.pv += q; const i = C.inc(); if (i && i.stato === 'combattimento') speso(e, i);
  C.nota(`${e.nome} usa l’amuleto: ${bersaglio.nome} guarisce ${q} PV (${bersaglio.pv}/${bersaglio.pvMax}; restano ${o.cariche} PV nell’amuleto).`); modificato();
}
/** Filtro della calma mentale: toglie fino a 2 punti follia (non in combattimento). */
export function usaFiltro(e, o) {
  if (inCombattimento()) return toast('Non si può usare in combattimento.', 'warn');
  const q = Math.min(2, e.follia || 0); consuma(e, o); K.follia(e, -q); log(`${e.nome} beve il filtro della calma mentale (-${q} follia).`); modificato();
}

// ---------------- benedizioni gratuite del traguardo «Generoso» ----------------
export function benedizioneDivina(e, bersaglio) {
  const P = e.perm || {}; if (!(P.benGratis > 0)) return toast('Nessuna Benedizione gratuita rimasta.', 'warn');
  P.benGratis--; bersaglio.maledetto = false; bersaglio.malattia = false; bersaglio.sfortuna = 0; if (bersaglio.stato === 'pietra') bersaglio.stato = 'ok';
  C.nota(`${e.nome} lancia una Benedizione divina (azione gratuita) su ${bersaglio.nome}; ne restano ${P.benGratis}.`); modificato();
}

// ---------------- abilità ----------------
/** Sputafuoco: una Palla di Fuoco non magica a +livello, con una torcia e una fiaschetta d'olio (1 volta per avventura). */
export async function sputafuoco(e) {
  const i = inCombattimento(); if (!i) return toast('Serve un combattimento in corso.', 'warn');
  const u = e.usi = e.usi || {}; if (u.sputafuoco) return toast('Sputafuoco già usato in questa avventura.', 'warn');
  const torcia = oggettoEffetto(e, /torcia/i), olio = oggettoEffetto(e, /olio/i);
  if (!torcia || !olio) return toast('Servono una torcia e una fiaschetta d’olio (1 p.o. ciascuna in negozio).', 'warn');
  consuma(e, torcia); consuma(e, olio); u.sputafuoco = 1;
  C.nota(`${e.nome} spruzza una nuvola di fuoco (Sputafuoco, non magico).`);
  await C.lancia(e, -1, { sputafuoco: true });
}
/** Assistenza (veterano, 1 volta per incontro): presta a un compagno una capacità di un terzo personaggio per questo incontro. */
const CAPACITA = [
  { id: 'att-livello', nome: 'Livello ai tiri di attacco', classi: ['guerriero', 'barbaro', 'assassino'] },
  { id: 'dif-livello', nome: 'Livello ai tiri di difesa', classi: ['furfante'] },
  { id: 'dif-mezzo', nome: 'Mezzo livello ai tiri di difesa', classi: ['arlecchino'] },
  { id: 'altro', nome: 'Altra capacità (da applicare a mano)', classi: null }
];
export async function assistenza(vet) {
  const i = inCombattimento(); if (!i) return toast('Serve un combattimento in corso.', 'warn');
  i.assistenzaUsata = i.assistenzaUsata || {};
  if (i.assistenzaUsata[vet.id]) return toast('Assistenza già usata in questo incontro.', 'warn');
  const altri = eroiAttivi().filter(x => x.id !== vet.id && !x.png && (!x.posizione || !vet.posizione || x.posizione === vet.posizione));
  if (altri.length < 2) return toast('Servono due compagni nella stessa stanza: uno che presta e uno che riceve.', 'warn');
  const da = eroePerId(await scelta('Assistenza', 'Chi presta la capacità?', altri.map(x => [x.id, x.nome, R.classi[x.classe].nome])));
  if (!da) return;
  const cap = CAPACITA.filter(c => !c.classi || c.classi.includes(da.classe));
  const capId = await scelta('Assistenza', `Quale capacità di ${da.nome} viene prestata?`, cap.map(c => [c.id, c.nome]));
  if (!capId) return;
  const a = eroePerId(await scelta('Assistenza', 'Chi la riceve?', altri.filter(x => x.id !== da.id).map(x => [x.id, x.nome, R.classi[x.classe].nome])));
  if (!a) return;
  i.assistenzaUsata[vet.id] = true;
  (i.prestiti = i.prestiti || []).push({ da: da.id, a: a.id, cap: capId });
  C.nota(`${vet.nome} (Assistenza): ${da.nome} presta «${CAPACITA.find(c => c.id === capId).nome}» a ${a.nome} per questo incontro; ${da.nome} non può usarla.`);
  modificato();
}

// ---------------- azioni da Strumenti ----------------
/** Sfonda una porta (Ondata di Forza lanciata su di sé): con 1 su 1d6 arrivano i mostri erranti. */
export async function sfondaPorta(e) {
  if (!(e.ondataForza > 0) || !e.ondataForzaProp) return toast('Serve l’Ondata di Forza lanciata su se stessi.', 'warn');
  const r = await dado(`${e.nome} sfonda la porta (1 = arrivano i mostri erranti)`);
  log(`${e.nome} sfonda la porta con la sua forza sovrumana.`);
  if (r.totale === 1) { const m = await G.monstroErrante(); G.avviaIncontro(m, G.tileById(S.adv.stanzaCorrente)); }
}
/** Tomo di conoscenza proibita: 1 volta per avventura +2 indizi e +1 punto follia. */
export async function studiaTomo(e) {
  e.usi = e.usi || {}; if (e.usi.tomo) return toast('Il tomo è già stato esaminato in questa avventura.', 'warn');
  e.usi.tomo = 1; log(`${e.nome} studia il tomo di conoscenza proibita.`);
  await G.aggiungiIndizio(e, { semplice: true }); await G.aggiungiIndizio(e, { semplice: true }); K.follia(e, 1);
}
