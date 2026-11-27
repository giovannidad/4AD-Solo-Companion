// Supplemento «Orrori dall'Aldilà» (livelli 6-9): classi, incantesimi, mostri, tabelle e strumenti di esplorazione a esagoni.
// Lo stato di gioco sta in S.adv.aldila (spedizione) e S.party.aldila (campagna): qui ci sono solo le regole.
import { R, S, log, modificato, eroiVivi, eroiAttivi, eroePerId } from './state.js';
import { dado, tira } from './dice.js';
import { riga, tabella, creaIncontro, inAldila, aldilaAttivo, abissoAttivo, haAbilita, modAttacco, bonusSalvezza } from './rules.js';
import { h, modal, toast, scelta, confirmBox, uid } from './util.js';
import * as G from './game.js';
import * as C from './combat.js';
import * as K from './caos.js';
import * as A from './abisso.js';

const adv = () => S.adv;
const D = () => R.aldila;
const tb = nome => R.aldila.tabelle[nome];
const mezzo = e => Math.floor(e.livello / 2);
const casuale = a => a[Math.floor(Math.random() * a.length)];
export const nota = t => (C.inc() ? C.nota(t) : log(t));
const num = async (expr, label) => (typeof expr === 'number' ? expr : (/d/.test(expr) ? (await tira(expr, label)).totale : +expr));

/** Stato della spedizione (per avventura) e della campagna, sempre con valori predefiniti. */
export function sp() {
  const a = adv(); a.aldila = Object.assign({ attiva: false, giorno: 1, terreno: null, giorniQui: 0, campoIeri: false, razioni: 0, necro: 0, catturati: 0, obiettivo: null, occhi: 0, divoratore: null, portale: 'aperto', fortezza: null, gufGiorni: 0, trasformati: [], seguaciSub: null }, a.aldila || {});
  return a.aldila;
}
export function cp() {
  const p = S.party; p.aldila = Object.assign({ blasfemi: [], luoghi: [], scoperte: [], fuorilegge: 0, cubi: 0, rivelazioni: 0, patto: null, bilancia: false, clessidra: false, unici: [], marchio: false }, p.aldila || {});
  return p.aldila;
}
export const prontiAldila = vivi => vivi.length > 0 && vivi.every(e => e.livello >= 6 && e.livello <= 9);
export async function controlloIngresso() {
  const bassi = eroiVivi().filter(e => !e.png && !e.merc && e.livello < 5);
  if (!bassi.length) return true;
  return await confirmBox(`«Orrori dall’Aldilà» è pensato per personaggi dal 6° al 9° livello (minimo 5°): ${bassi.map(e => `${e.nome} ${e.livello}°`).join(', ')} non lo raggiunge. Il manuale parla di morte certa per i gruppi più deboli. Scendere comunque?`);
}

// =============================================================
//  MOSTRI: tabelle con dadi a intervalli, formule, poteri
// =============================================================
const TAB = { infestanti: 'infestanti', nonMorti: 'nonMorti', umanoidi: 'umanoidi', demoniaci: 'demoniaci', aberranti: 'aberranti', boss: 'boss' };
/** Le sei facce del d6 di una tabella dei mostri (le voci possono coprire più facce). */
export function listaMostri(nome) {
  if (nome === 'seguaci') return Array.from({ length: 6 }, (_, k) => ({ sottotabella: tb('seguaci').find(r => k + 1 >= r.da && k + 1 <= r.a).tabella, id: 'sel', nome: 'Seguaci' }));
  const l = D().mostri[TAB[nome]]; if (!l) return null;
  return Array.from({ length: 6 }, (_, k) => l.find(m => k + 1 >= m.da && k + 1 <= m.a) || l[l.length - 1]);
}
/** Selettore dei seguaci: sottotabella tirata (nei templi si resta sempre sulla stessa). */
export async function sottotabellaSeguaci(sel) {
  const s = sp(); let sub = s.tempio ? s.seguaciSub : null;
  if (!sub) { sub = sel.sottotabella; if (s.tempio) s.seguaciSub = sub; }
  const l = listaMostri(sub), r = await dado(`Mostri seguaci ${sub} (d6)`);
  return l[r.totale - 1];
}
export const trovaVoce = id => { for (const t of Object.values(D().mostri)) { const m = t.find(x => x.id === id); if (m) return m; } return D().creatureExtra.find(x => x.id === id); };
const UNO = { nonFerisce: 1 };
/** Risolve livello, PV e attacchi a dado di una voce; restituisce una copia con numeri. */
export async function risolviVoce(v) {
  const o = { ...v }, nm = v.nome;
  if (o.id === 'o-blasfemo' || o.id === 'o-abominio-ossuto') return creaBlasfemoVoce(o);
  if (o.livFormula && /^[0-9d+]+$/.test(o.livFormula)) o.liv = await num(o.livFormula, `Livello: ${nm}`);
  if (o.pvFormula && /^[0-9d+]+$/.test(o.pvFormula)) o.pv = await num(o.pvFormula, `PV: ${nm}`);
  if (o.senzaPv) o.pv = 99;
  if (o.attDadi && o.att == null) o.att = 1;
  if (o.att == null) o.att = 1;
  if (o.liv == null) o.liv = 8;
  if (o.pv == null) o.pv = 1;
  delete o.pvFormula; delete o.livFormula;
  if (o.tes === null) o.tes = 'NO';
  if (o.mor == null) o.mor = 0;
  if (o.nonFerisce || o.id === 'o-necrodemoni') o.nonFerisce = true;
  return o;
}
const TESTO_ODIO = { elfi: 'elfo', maghi: 'mago', furfanti: 'furfante' };
/** Dati specifici dell'Aldilà tenuti in inc.al. */
export function poteriMostro(v) {
  const o = {};
  for (const k of ['nonFerisce', 'distruggeRazioni', 'sangueRovente', 'salvezza', 'immuneFuoco', 'immuneFrecce', 'immuneTaglio', 'taglioMod', 'contundenteMod', 'insegueFuga', 'nonInsegue', 'nonSorprende', 'marchioMortale', 'riflessoMagia', 'risucchiaMagia', 'pvPerOcchioFuggito',
    'tesoroFisso', 'tesoroExtra', 'tesRivelazioni', 'tesIndizi', 'doppioTiroPeggiore', 'immuneMagia', 'immuneArmiMagiche', 'perdeLivello', 'rigenera', 'scissione', 'maiBossFinale', 'alMorire', 'auraOgniTurno', 'livAumentoPerTurno', 'distruggeArmi', 'mimetismo',
    'paura', 'paralisi', 'fetore', 'poteri', 'teletrasporto', 'rapimento', 'ingoia', 'petrifica', 'trasformaCaduti', 'riforma', 'risorge', 'rinforzi', 'scorta', 'colpoEffetto', 'malusAttaccoPerFollia', 'seguito', 'reazioneSpeciale', 'scoperta24', 'odia', 'poteriTabella', 'ignoraScudo', 'attSeFuga', 'evocazione', 'offreIndizio', 'catturabili', 'psionico', 'ondataMagica'])
    if (v[k] !== undefined) o[k] = v[k];
  if (v.id === 'o-pallidi') o.ignoraScudo = true;
  if (v.id === 'o-cervello-psionico') o.ignoraScudo = true;
  o.id = v.id;
  return o;
}
const EXTRA_AL = ['immuneIncantesimi', 'sorpresaProb', 'attaccaPerPrimo', 'contundentePiu', 'attDadi', 'ignoraArmatura', 'frecceMod', 'modPallaDiFuoco'];
export const campiGenerici = v => Object.fromEntries(EXTRA_AL.filter(k => v[k] !== undefined).map(k => [k, v[k]]));
/** Dopo la creazione: campi speciali (in inc.al), immunità e sorpresa. */
export async function postCrea(inc, voce, opz = {}) {
  const al = inc.al = poteriMostro(voce);
  if (voce.immuneFuoco) inc.immuneIncantesimi = [...new Set([...(inc.immuneIncantesimi || []), 'Palla di Fuoco'])];
  if (voce.immuneMagia) inc.immuneIncantesimi = ['Sonno', 'Palla di Fuoco', 'Fulmine Magico', 'Protezione'];
  if (voce.nonFerisce && !voce.id.startsWith('o-necro')) al.nonFerisce = true;
  if (voce.id === 'o-cervello-psionico') { inc.attPerBersaglio = true; inc.mostriPrima = true; }
  if (voce.id === 'o-occhio-fiamma') inc.att = 2;
  if (voce.ondataMagica) { inc.attPerBersaglio = true; }
  if (voce.tes === null || voce.tes === undefined || voce.tes === 'NO') { if (voce.tesoroFisso || voce.tesoroExtra) inc.tes = 'NO'; }
  if (voce.id === 'o-littore') {
    const s = sp(); inc.pv += s.occhi || 0; inc.pvMax += s.occhi || 0; if (s.occhi) nota(`Il littore ha ${s.occhi} PV in più per gli occhi fuggiti.`); s.occhi = 0;
    const t = await dado('Poteri del littore (Scoperta 25, d6)'); al.potere = voce.poteri.find(p => t.totale >= p.da && t.totale <= p.a); inc.note += ` POTERE: ${al.potere.nome} – ${al.potere.effetto}.`;
    if (!inc.errante) al.seguitoDa = true;
  }
  if (voce.id === 'o-saccheggiatore-tentacolato') { const t = await dado('Poteri del saccheggiatore (Scoperta 26, d6)'); al.potere = voce.poteri.find(p => t.totale >= p.da && t.totale <= p.a); inc.note += ` POTERE: ${al.potere.nome} – ${al.potere.effetto}.`; }
  if (voce.id === 'o-arcimedusa') { const t = await dado('Poteri unici (Dado attacco, d6)'); const r = riga(tb('blasfemiAttacco'), t.totale); inc.note += ` POTERE UNICO: ${r.nome} – ${r.testo}`; }
  if (voce.nonSorprende) { inc.sorpresa = false; }
  if (voce.sorpresaProb && !inc.errante) { const x = await dado(`${voce.nome}: sorprende il gruppo? (1-${voce.sorpresaProb})`); if (x.totale <= voce.sorpresaProb) { inc.sorpresa = true; log(`${voce.nome} sorprende il gruppo.`); } }
  if (voce.scorta) { const x = await dado(`${voce.nome}: seguito di scheletri? (1-${voce.scorta.probabilita})`); if (x.totale <= voce.scorta.probabilita) { const n = (await tira(voce.scorta.numero, 'Numero scheletri')).totale; const sc = creaIncontro('seguaci', { id: 'o-scheletri-scorta', nome: 'Scheletri del seguito', liv: 6, att: 1, pv: 1, mor: 'NO', tes: 'NO', tag: ['non-morto'], contundentePiu: true, reazioni: [[1, 6, 'morte']] }, n); sc.contundentePiu = true; (adv().coda = adv().coda || []).push(sc); log(`${voce.nome} ha un seguito di ${n} scheletri (da affrontare dopo).`); } }
  if (voce.seguito && voce.id === 'o-littore' && opz.seguito !== false) {
    const s = await G.monstroDa('seguaci'); s.nome += ' (seguito)'; (adv().coda = adv().coda || []).push(s); log(`Il littore ha un seguito: ${s.nome} ×${s.n}, usa le reazioni del padrone.`);
  }
  inc.note = (inc.note || '') + '';
}
export function bossFinale(inc) { inc.bossFinale = true; inc.pv++; inc.pvMax++; inc.att++; inc.noMorale = true; nota(`${inc.nome} è il BOSS FINALE (+1 PV, +1 ATT, senza morale).`); return inc; }

// ---- blasfemi: nome in tre parti, poteri, persistenza ----
const PARTI = ['blasfemiAbilita', 'blasfemiAttacco', 'blasfemiDifesa'];
const RITIRA = ['bhaal', 'gurgun', 'dhaur', 'morkath', 'azach'];
async function tiraParte(tab, label, ritira = false) {
  for (let k = 0; k < 20; k++) { const r = await dado(label), row = riga(tb(tab), r.totale); if (!ritira || !RITIRA.includes(row.id)) return row; }
  return riga(tb(tab), 1);
}
async function parteDoppia(tab, nome) {
  const row = await tiraParte(tab, `Blasfemo: ${nome}`);
  if (!row.tiraDueVolte) return [row];
  const a = await tiraParte(tab, `${nome} (1/2)`), b = await tiraParte(tab, `${nome} (2/2)`);
  return [row, a, b].slice(1).filter((x, k, arr) => !(x.id === row.id && arr.length > 1) || true);
}
function descrivi(parti) { return parti.map(p => `${p.nome} (${p.epiteto}): ${p.testo}`).join(' · '); }
/** Un blasfemo nuovo (o uno persistente indicato): statistiche e poteri dalle tre tabelle. */
async function creaBlasfemoVoce(v, esistente = null, soloDue = false) {
  const o = { ...v };
  let parti;
  if (esistente) parti = esistente.parti.map(id => PARTI.map(t => D().tabelle[t].find(r => r.id === id)).find(Boolean));
  else {
    parti = [];
    for (const t of soloDue || v.id === 'o-abominio-ossuto' ? PARTI.slice(0, 2) : PARTI) {
      const row = await tiraParte(t, `Blasfemo – ${t}`);
      if (row.tiraDueVolte) { const a = await tiraParte(t, `${row.nome}: 1° tiro`), b = await tiraParte(t, `${row.nome}: 2° tiro`); parti.push(a, b); } else parti.push(row);
    }
  }
  o.liv = await num('1d3+7', 'Livello del blasfemo') - (v.id === 'o-abominio-ossuto' ? 2 : 0);
  o.pv = await num('1d6+8', 'PV del blasfemo'); o.mor = 0; o.tes = v.id === 'o-abominio-ossuto' ? 'NO' : 0; o.tesMolt = v.id === 'o-abominio-ossuto' ? 1 : 2;
  const att = parti.find(p => PARTI[1] && D().tabelle.blasfemiAttacco.some(r => r.id === p.id));
  o.att = 1; o.blasf = { parti: parti.map(p => p.id), nome: parti.map(p => p.nome).join(' '), titolo: parti.map(p => p.epiteto).join(', ') };
  if (att) { const atts = parti.filter(p => D().tabelle.blasfemiAttacco.some(r => r.id === p.id)); o.blasf.attIds = atts.map(p => p.id); }
  o.nome = `Blasfemo ${o.blasf.nome}`; o.note = descrivi(parti); o.reazioni = v.id === 'o-abominio-ossuto' ? [[1, 6, 'combatte']] : [[1, 6, 'adorazione']];
  o.immuneIncantesimi = ['Sonno'];
  return o;
}

// =============================================================
//  CLASSI
// =============================================================
export const classeAldila = e => !!e && ['cambione', 'demonologo', 'paladino'].includes(e.classe);
export const abilitaNomi = classe => D().abilitaPerClasse['o-' + classe] || [];
export const classiAbilita = nome => Object.entries(D().abilitaPerClasse).filter(([, l]) => l.includes(nome)).map(([c]) => c.replace(/^o-/, ''));
export const catalogoAbilita = () => D().abilita.map(a => ({ id: a.id, nome: a.nome, classi: a.classi.map(c => c.replace(/^o-/, '')), testo: a.effetto }));
export function armaVietata(e, a) {
  if (e.classe === 'demonologo' && !(a.categoria === 'leggera' || (a.categoria === 'una-mano' && a.tipo === 'taglio'))) return `${a.nome}: il demonologo usa solo un’arma da taglio a una mano o un’arma leggera.`;
  if (['cambione', 'paladino'].includes(e.classe) && a.lancio) return `${a.nome}: ${e.classe === 'paladino' ? 'il paladino' : 'il cambione'} non usa armi da lancio.`;
  return null;
}
export const incantesimoPredefinito = e => (e.classe === 'cambione' ? 'Asservi demone' : null);
export const NOMI_INCANTESIMI = () => D().incantesimi.map(s => s.nome);
export const incantesimiPermessi = e => (e.classe === 'cambione' ? NOMI_INCANTESIMI() : ['mago'].includes(e.classe) ? (e.avanzati || []).filter(n => NOMI_INCANTESIMI().includes(n)) : []);
export const slotCambione = e => (e.classe === 'cambione' ? e.livello : 0);
const progenie = i => !!(i?.tag?.includes('demone') || i?.tag?.includes('abietto') || i?.al?.progenie || /caos|caotic|xichtul|demon|blasfem/i.test(i?.nome || '') || i?.progenieInfernale);
const progenieCtx = c => !!(c.tag?.includes('demone') || c.tag?.includes('abietto') || c.progenie || /caos|caotic|xichtul|blasfem/i.test(c.nome || '') || /demon/i.test(c.nome || ''));
const inCombattimento = () => { const i = C.inc(); return i && i.stato !== 'finito' ? i : null; };

/** Modificatori d'attacco di classi e mostri dell'Aldilà. */
export function attacco(e, ctx, bers, arma, add) {
  const liv = e.livello, prog = progenie(bers);
  if (e.classe === 'cambione') add(ctx.incantesimo ? 'Livello (cambione, incantesimo)' : 'Mezzo livello (cambione)', ctx.incantesimo ? liv : mezzo(e));
  if (e.classe === 'demonologo') {
    if (ctx.incantesimo) { if (NOMI_INCANTESIMI().includes(ctx.nomeIncantesimo)) add('Livello (incantesimo dell’Aldilà)', liv); }
    else add(prog ? 'Livello (contro la progenie infernale)' : 'Mezzo livello (demonologo)', prog ? liv : mezzo(e));
  }
  if (e.classe === 'paladino' && !ctx.incantesimo) add('Livello (paladino)', liv);
  if (e.culto === 'chierico-foryos' && !ctx.incantesimo && /demon/i.test(bers.nome || '') && bers.foryos?.[e.id]) add('Furia di Foryos (livello intero)', liv - mezzo(e));
  if (e.cavalcatura && e.classe === 'paladino' && !ctx.incantesimo && (e.cavalcaturaAtt)) add('In sella (paladino)', 1);
  const al = bers.al; if (!al) return;
  if (!ctx.incantesimo && arma) {
    if (arma.tipo === 'taglio' && al.taglioMod) add('Armi da taglio contro questa creatura', al.taglioMod);
    if (arma.tipo === 'contundente' && al.contundenteMod) add('Armi contundenti contro questa creatura', al.contundenteMod);
    if (al.mimetismo && arma.lancio && !bers.mimetismoAnnullato) add('Mimetismo', al.mimetismo.modAttaccoArmiDaLancio);
  }
  if (al.malusAttaccoPerFollia && e.follia) add('Spettri fetidi: penalità pari alla follia', -e.follia);
  if (bers.id === 'o-progenie-necrotica' && !(e.bonusMagico > 0) && !ctx.incantesimo) add('Progenie necrotica: +3 al livello contro attacchi non magici', -3);
  if (bers.luce) add('Luce accecante', -bers.luce);
  if (e.malusAtt) add('Malus', -e.malusAtt);
  if (bers.malusAvversari) add('Sangue acido', -bers.malusAvversari);
}
export function difesa(e, ctx, add) {
  if (e.classe === 'demonologo' && progenieCtx(ctx)) add('Mezzo livello (demonologo contro la progenie)', mezzo(e));
  if (e.segnoAntichi && (ctx.tag || []).includes('abietto')) add('Segno degli Antichi', 1);
  if (cp().marchio && (ctx.tag || []).includes('abietto') && ['chierico', 'guerriero', 'paladino'].includes(e.classe)) add('Marchio dei dimenticati', 2);
  if (e.malusCampane) add('Demoni campanari', -e.malusCampane);
  if (e.malusDifIntrappolato) add('Intrappolato', e.malusDifIntrappolato);
  if (ctx.al?.malusDifesaPerFollia) add('Penalità alla difesa pari alla follia', -(e.follia || 0));
}
export function salvezza(e, Ltxt, inc, add) {
  const att = inc && inc.stato !== 'finito';
  if (e.classe === 'cambione' && /follia/i.test(Ltxt)) add('Cambione: livello contro la follia', e.livello);
  if (e.classe === 'demonologo' && att && progenie(inc)) add('Demonologo contro la progenie infernale', e.livello);
  if (e.classe === 'demonologo' && att && progenie(inc) && haAbilita(e, 'o-scudo-diabolico')) add('Scudo diabolico', 2 * e.livello);
  if (e.segnoAntichi && att && (inc.tag || []).includes('abietto')) add('Segno degli Antichi', 1);
  if (/trappol|botola|dard|lance|masso|fossa/i.test(Ltxt) && (e.oggetti || []).some(o => /talismano di protezione/i.test(o.nome))) add('Talismano di protezione (1d3)', 1 + Math.floor(Math.random() * 3));
  if (e.classe === 'cambione' && /persuasion|sociale/i.test(Ltxt)) add('Cambione: persuasione', -e.livello);
}
export function odia(i, e) {
  const od = i.al?.odia || i.blasf?.odio; if (!od) return false;
  const t = (Array.isArray(od) ? od : []).join(' ').toLowerCase();
  if (/chierici/.test(t) && e.classe === 'chierico') return true;
  if (/blasfem/.test(t)) return false;
  return false;
}
export function statiAldila(e) {
  const t = [];
  if (e.classe === 'demonologo') t.push(['Demonologo', 'amber', 'Immune alla follia; non benedicibile né resuscitabile']);
  if (e.salamandra) t.push(['Salamandra', 'amber', 'Uomo salamandra: non mangia, non benedicibile']);
  if ((e.doni || []).length) t.push([`Doni ${e.doni.length}`, 'red', `Doni esecrandi: ${e.doni.map(d => d.nome).join(', ')}`]);
  if (e.possessione) t.push(['Possessione', 'red', `Posseduto da ${e.possessione.nome}`]);
  if (e.malusCampane) t.push([`Campane -${e.malusCampane}`, 'red', 'Penalità alla difesa fino a una Benedizione']);
  if (e.pvPersi) t.push([`-${e.pvPersi} PV max`, 'red', 'Perdita permanente dell’oracolo: Benedizione e Guarigione']);
  if (e.stato === 'prigioniero' && e.catturatoDa?.aldila) t.push(['Catturato', 'red', 'Recinto degli schiavi: vedi Strumenti › Aldilà']);
  return t;
}
export function dopoBenedizione(b) { if (b.malusCampane) { b.malusCampane = 0; log(`${b.nome}: la Benedizione toglie la penalità dei demoni campanari.`); } if (b.perditaLivelloCustode) { b.livello += b.perditaLivelloCustode; b.perditaLivelloCustode = 0; } }

// =============================================================
//  COMBATTIMENTO: poteri dei mostri
// =============================================================
const tsNat = async (e, liv, bonus, label) => {
  const r = await C.d6e(e, `${label} – ${e.nome} (L${liv})`), tot = r.totale + bonus + bonusSalvezza(e, label).tot, ok = r.naturale !== 1 && tot >= liv;
  nota(`${label}: ${e.nome} tira ${tot} contro L${liv} → ${ok ? 'salvo' : 'FALLITO'}.`); return { ok, nat: r.naturale === 1 };
};
const bonusCl = (e, b) => { if (!b) return 0; let t = 0; for (const [k, v] of Object.entries(b)) if (k === e.classe || (k === 'altri' && !Object.keys(b).includes(e.classe))) t += v === 'L' ? e.livello : v === '1/2L' ? mezzo(e) : +v; return t; };
const levaRazioni = n => { const s = sp(); const q = Math.min(s.razioni, n); s.razioni -= q; return q; };
export const inAttesa = i => (i.al?.rientri || []).length > 0;
export async function inizioIncontro(i) {
  const al = i.al, d = sp();
  if (d.divoratore && !al?.marchioMortale) await divoratoreRitorno();
  if (!al) return;
  if (al.paralisi) for (const e of eroiAttivi()) if (!(await C.salva(e, al.paralisi.liv, 0, 'Paura degli spettri'))) { i.agito[e.id] = true; nota(`${e.nome} è paralizzato per 1 turno.`); }
  if (al.evocazione && !/mercanti/.test(i.reazione?.azione || '')) {
    const x = await dado('Il demonologo evoca un demone (1-2 seguaci, 3-4 aberranti, 5 littore, 6 niente)');
    const ev = al.evocazione.esiti.find(q => x.totale >= q.da && x.totale <= q.a);
    if (ev.tabella) { const m = ev.tabella === 'boss' ? await G.monstroDa('boss') : await G.monstroDa(ev.tabella); m.nome += ' (evocato)'; (adv().coda = adv().coda || []).push(m); nota(`Evocato: ${m.nome}.`); } else nota('L’evocazione fallisce.');
  }
  i.al.colpiTurno = {};
}
async function divoratoreRitorno() {
  const d = sp(), q = d.divoratore, x = await dado('Divoratore del tempo scomparso (1 perdita PV, 2-4 nulla, 5-6 ricompare)');
  if (x.totale === 1) { const m = q.marchi; for (const e of eroiVivi()) if (e.stato === 'ok') C.perdiPV(e, m, 'marchi mortali'); }
  else if (x.totale >= 5) { const v = trovaVoce('o-divoratore-tempo'), m = creaIncontro('aberranti', { ...(await risolviVoce(v)), tes: 'NO' }, 1); m.pv = q.pv; await postCrea(m, v); m.al.marchiTotali = q.marchi; d.divoratore = null; (adv().coda = adv().coda || []).push(m); nota(`Il divoratore del tempo ricompare con ${q.pv} PV.`); }
}
export async function inizioTurno(i) {
  const al = i.al; if (!al) return;
  const eroi = eroiAttivi();
  if (i.id === 'o-anime-lacerate') for (const e of eroi) { const r = await tsNat(e, 3, 0, 'Paura delle anime lacerate'); if (!r.ok) { (i.al.noMischia = i.al.noMischia || {})[e.id] = true; nota(`${e.nome} non può attaccare in mischia questo turno.`); if (r.nat) { i.agito[e.id] = true; nota(`${e.nome} fugge dal combattimento (1 naturale): torna a fine incontro.`); e.fuggito = true; } } else if (i.al.noMischia) delete i.al.noMischia[e.id]; }
  if (al.livAumentoPerTurno && i.turno > 1) { i.liv++; nota(`${i.nome}: il livello sale a ${i.liv}.`); }
  if (al.fetore) for (const e of eroi) if (!(await C.salva(e, al.fetore.salvezza.liv, 0, 'Fetore dei mefitici'))) { i.agito[e.id] = true; nota(`${e.nome} perde tutte le azioni del turno.`); }
  if (al.auraOgniTurno) {
    const x = await dado('Occhio di fiamma: 1-3 raggio, 4-6 paura'); const es = al.auraOgniTurno.esiti.find(q => x.totale >= q.da && x.totale <= q.a);
    for (const e of eroi) {
      if (es.tipo === 'raggio') { if (!(await C.salva(e, es.salvezza.liv, bonusCl(e, es.salvezza.bonus), 'Raggio infuocato'))) C.perdiPV(e, 1, 'raggio infuocato'); }
      else if (e.classe !== 'paladino' && !(await C.salva(e, es.salvezza.liv, bonusCl(e, es.salvezza.bonus), 'Paura dell’occhio di fiamma'))) { i.agito[e.id] = true; nota(`${e.nome} è terrorizzato: non attacca in questo turno.`); }
    }
  }
  if (al.potere?.id === 'volto-tentacolato') for (const e of eroi) if (!(await C.salva(e, i.livBase, 0, 'Volto tentacolato'))) { e.malusAtt = (e.malusAtt || 0) + 1; nota(`${e.nome}: -1 a tutti i tiri finché il littore vive.`); }
  if (al.potere?.id === 'senso-di-colpa') for (const e of eroi) if (!(await C.salva(e, Math.max(1, e.follia || 0), 0, 'Senso di colpa'))) C.perdiPV(e, 1, 'senso di colpa');
  if (al.blasf?.sloatsh) {}
  for (const e of eroi) if (e.fuocoPire && !(await C.salva(e, 4, 0, 'Fuoco delle pire'))) C.perdiPV(e, 1, 'fuoco delle pire'); else if (e.fuocoPire) e.fuocoPire = false;
  if (al.rientri?.length) { const ora = al.rientri.filter(r => r.turno <= i.turno); al.rientri = al.rientri.filter(r => r.turno > i.turno); const n = ora.reduce((a, r) => a + r.n, 0); if (n) { i.n += n; nota(`${n} creature tornano in piedi (${ora[0].motivo}).`); } }
  if (al.potere?.id === 'infestato') { const x = await dado('Infestato: parassiti? (1-2)'); if (x.totale <= 2) { const p = await G.monstroDa('infestanti'); p.nome += ' (parassiti)'; (adv().coda = adv().coda || []).push(p); nota(`Emergono parassiti: ${p.nome}.`); } }
}
/** Un colpo di un mostro a segno: restituisce true se il danno normale è sostituito. */
export async function colpoAlBersaglio(e, i, dif, r) {
  const al = i.al; if (!al) return false;
  if (i.id === 'o-vermi-rigonfi') { const q = (await tira('1d6', 'Razioni distrutte')).totale, k = levaRazioni(q); nota(`I vermi distruggono ${q} razioni (rimaste ${sp().razioni}${k < q ? '; poche razioni' : ''}).`); return true; }
  if (i.id === 'o-necrodemoni') { const c = al.colpiTurno = al.colpiTurno || {}; c[e.id] = (c[e.id] || 0) + 1; if (r.naturale === 1) nota('Con 1 colpiscono il compagno (a mano).'); if (c[e.id] === 2 && !(await C.salva(e, 6, 0, 'Rapimento dei necrodemoni'))) { e.stato = 'prigioniero'; e.catturatoDa = { nome: 'necrodemoni', aldila: true }; nota(`${e.nome} è portato via in aria (ha 1 turno per essere recuperato: gestiscilo a mano dalla scheda).`); } return true; }
  if (i.id === 'o-assetati-null') { await risucchia(e); return true; }
  if (i.id === 'o-divoratore-tempo') { e.marchi = (e.marchi || 0) + 1; nota(`${e.nome} riceve un marchio mortale (${e.marchi}).`); return true; }
  if (i.id === 'o-traghettatore-morte') { if (!(await C.salva(e, 3, e.classe === 'mago' ? mezzo(e) : 0, 'Peste oscura (traghettatore)'))) { await A.esponiPeste(e, 99, 'Traghettatore'); e.peste = true; } return true; }
  if (i.id === 'o-avatar-dimenticato') return true;
  if (al.ingoia) { if (!e.ingoiato) { C.perdiPV(e, 1, 'verme della polvere'); if (e.stato === 'ok' && !(await C.salva(e, 10, 0, 'Inghiottito dal verme'))) { e.ingoiato = true; nota(`${e.nome} è inghiottito: perde 1 PV a turno e può attaccare da dentro.`); } } return true; }
  if (al.teletrasporto && e.stato === 'ok') { C.perdiPV(e, 1, i.nome); if (e.stato === 'ok' && !(await C.salva(e, 5, e.classe === 'mago' ? e.livello : e.classe === 'demonologo' ? mezzo(e) : 0, 'Teletrasporto del morfico'))) { e.stato = 'prigioniero'; e.catturatoDa = { nome: 'Fosse del Dolore', aldila: true }; nota(`${e.nome} è teletrasportato alle Fosse del Dolore (luogo V): ripristinalo dalla scheda quando lo recuperate.`); } return true; }
  if (al.potere?.id === 'aggrovigliante') { C.perdiPV(e, i.danno || 1, i.nome); if (e.stato === 'ok' && !(await C.salva(e, 4, e.classe === 'barbaro' ? mezzo(e) : 0, 'Tentacoli aggrovigliati'))) { e.intrappolato = true; i.agito[e.id] = true; nota(`${e.nome} è intrappolato: non può fuggire né attaccare.`); } return true; }
  if (r.naturale === 1) {
    if (al.distruggeRazioni && i.id === 'o-demoni-disperazione') { const q = (await tira('1d3', 'Razioni marcite')).totale; levaRazioni(q); nota(`Con 1 in difesa ${q} razioni vanno a male.`); }
    if (i.id === 'o-pire-destino' && !(await C.salva(e, 4, 0, 'Fuoco delle pire del destino'))) { C.perdiPV(e, 1, 'fuoco'); e.fuocoPire = true; }
  }
  return false;
}
async function risucchia(e) {
  const cu = cp();
  const sl = (e.incantesimi || []).find(s => !s.usato); if (sl) { sl.usato = true; return nota(`${e.nome} perde un incantesimo memorizzato.`); }
  const og = (e.oggetti || []).find(o => o.cariche > 0 && o.tipo !== 'pergamena'); if (og) { og.cariche--; return nota(`${e.nome} perde una carica di ${og.nome}.`); }
  if (cu.cubi > 0) { cu.cubi--; return nota(`${e.nome} perde un cubo anima (restano ${cu.cubi}).`); }
  const per = (e.oggetti || []).findIndex(o => o.tipo === 'pergamena'); if (per >= 0) { const o = e.oggetti.splice(per, 1)[0]; return nota(`${e.nome} perde ${o.nome}.`); }
  const m = (e.oggetti || []).findIndex(o => ['magico', 'arma-magica', 'armatura-magica'].includes(o.tipo)); if (m >= 0) { const o = e.oggetti.splice(m, 1)[0]; return nota(`${e.nome} perde l’oggetto magico ${o.nome}.`); }
  nota(`${e.nome} non ha più magia da perdere.`);
}
export async function effettoFerita(e, i, dn) {
  const al = i.al; if (!al) return;
  for (const s of al.salvezza || []) if (/colpito|ferita/.test(s.quando)) { if (!(await C.salva(e, s.liv, 0, `Potere di ${i.nome}`)) && e.stato === 'ok') { if (s.fallimento?.modDifesa) e.malusCampane = (e.malusCampane || 0) + 1, nota(`${e.nome}: -1 cumulativo alla difesa fino a una Benedizione.`); else C.perdiPV(e, s.fallimento?.pv || 1, i.nome); } }
  if (al.potere?.id === 'proiezione-incubo' && e.stato === 'ok' && !(await C.salva(e, i.livBase - 1, e.classe === 'demonologo' ? mezzo(e) : 0, 'Proiezione dell’incubo'))) K.follia(e, 1);
  if (al.potere?.id === 'invecchiante') { const a = (await tira('1d6', 'Anni invecchiati')).totale; nota(`${e.nome} invecchia di ${a} anni: -1 alla difesa per ogni decade oltre i 40 (a mano; cambioni ed elfi immuni).`); }
}
/** Prima di applicare i danni: restituisce true se i danni sono assorbiti. */
export async function primaDanni(i, n) {
  const al = i.al; if (!al || n <= 0) return false;
  if (al.perdeLivello) { i.liv = Math.max(0, i.liv - n); nota(`${i.nome} perde ${n} livell${n === 1 ? 'o' : 'i'}: ora LIV ${i.liv}.`); if (i.liv <= 0) { i.pv = 0; await C.applicaDanni(0); i.stato !== 'finito' && C.sottraiFuga(); i.esito = 'sconfitti'; } return true; }
  if (al.marchioMortale) {
    let ok = 0; for (let k = 0; k < n; k++) { const x = await dado('Divoratore del tempo: ignora la ferita e scompare? (1-2)'); if (x.totale <= 2) { ok++; break; } }
    if (ok) { const marchi = eroiVivi().reduce((a, e) => a + (e.marchi || 0), 0) + (al.marchiTotali || 0); sp().divoratore = { pv: i.pv, marchi }; nota(`${i.nome} ignora la ferita e scompare (${marchi} marchi mortali in gioco).`); i.stato = 'finito'; i.esito = 'fuga'; i.tesoroPreso = true; return true; }
  }
  if (al.riflessoDamage) return false;
  return false;
}
/** Dopo il tiro di attacco riuscito: immunità e armi distrutte. Restituisce i colpi effettivi. */
export async function colpiAldila(e, i, arma, colpi, r) {
  const al = i.al; if (!al) return colpi;
  i.ultimoAttaccante = e.id;
  if (al.immuneFrecce && arma && ['arco', 'balestra', 'fionda'].includes(arma.id)) { nota(`${i.nome}: archi e fionde non hanno effetto.`); return 0; }
  if (al.immuneTaglio && arma?.tipo === 'taglio') { nota(`${i.nome} è immune alle armi da taglio.`); return 0; }
  if (al.immuneArmiMagiche && (e.bonusMagico || 0) > 0) { nota(`${i.nome} è immune alle armi magiche.`); return 0; }
  if (i.immuneArmi && arma && i.immuneArmi.includes(arma.tipo)) { nota(`${i.nome} è immune a questo tipo di arma.`); return 0; }
  if (al.distruggeArmi && arma && !(await C.salva(e, al.distruggeArmi.tsLiv, e.bonusMagico || 0, 'Acido del poligono'))) { e.armi = (e.armi || []).filter(x => x !== arma.id); if (e.armaPrincipale === arma.id) e.armaPrincipale = e.armi[0] || null; nota(`L’acido distrugge ${arma.nome} di ${e.nome}.`); }
  if (al.scoperta24 && arma?.tipo === 'taglio') { i.luce = (i.luce || 0) + colpi; nota(`Luce accecante: tutti hanno -${i.luce} all’attacco.`); }
  if (al.blasf?.ruggine && arma && !(await C.salva(e, 3, 0, 'Ruggine'))) { e.armi = (e.armi || []).filter(x => x !== arma.id); nota(`${arma.nome} si dissolve in ruggine.`); }
  if (al.blasf?.unaFerita) colpi = Math.min(colpi, 1);
  return colpi;
}
export const bloccoAttacco = (e, i, arma) => (i.al?.noMischia?.[e.id] && !arma?.lancio ? `${e.nome} non può attaccare in mischia (paura).` : e.intrappolato ? `${e.nome} è intrappolato.` : null);
export async function peggiore(e, i, r) {
  if (!i.al?.doppioTiroPeggiore) return r;
  const r2 = await C.dE(e, `Oracolo: secondo tiro di ${e.nome} (vale il peggiore)`);
  const m = r2.totale < r.totale ? r2 : r; nota(`Oracolo salamandra: tiri ${r.totale} e ${r2.totale}, vale ${m.totale}.`); return m;
}
export async function su1Attacco(e, i) {
  for (const s of i.al?.salvezza || []) if (/1 al tiro di attacco/.test(s.quando) && !(await C.salva(e, s.liv, bonusCl(e, s.bonus), 'Aculei avvelenati'))) C.perdiPV(e, 1, 'aculei');
}
export async function dopoDanni(i, prima) {
  const al = i.al; if (!al || !i.minore) return;
  const morti = prima - i.n; if (morti <= 0) return;
  const killer = eroePerId(i.ultimoAttaccante);
  if (al.sangueRovente && killer) for (let k = 0; k < morti; k++) if (killer.stato === 'ok' && !(await C.salva(killer, al.sangueRovente.salvezza.liv, 0, 'Sangue rovente'))) C.perdiPV(killer, 1, 'sangue rovente');
  if (al.risorge) { (al.rientri = al.rientri || []).push({ turno: i.turno + al.risorge.dopoTurni, n: morti, motivo: 'si rianimano' }); }
  if (al.riforma && i.fonte !== 'incantesimo' && killer?.classe !== 'paladino') { const x = await tira(`${morti}d6`, 'Pallidi che si riformano (1-2)'), c = x.dadi.filter(v => v <= 2).length; if (c) (al.rientri = al.rientri || []).push({ turno: i.turno + 1, n: c, motivo: 'si riformano' }); }
}
export async function fineTurnoMostri(i) {
  const al = i.al, hv = eroiVivi();
  for (const e of hv) if (e.ingoiato && e.stato === 'ok') C.perdiPV(e, 1, 'acido gastrico');
  if (!al) return;
  if (al.rigenera && i.pv > 0 && i.pv < i.pvMax) { i.pv++; nota(`${i.nome} rigenera 1 PV.`); }
  if (al.rinforzi && i.n > 0) { const q = (await tira(al.rinforzi.numero, 'Rinforzi')).totale; i.n += q; nota(`Compaiono ${q} nuovi nemici.`); }
  if (al.potere?.id === 'proiezione-incubo' || al.blasf) {}
}
export function eroeCaduto(e, causa) {
  const i = C.inc(); if (!i?.al || causa !== i.nome) return;
  if (i.al.trasformaCaduti) { (i.al.rientri = i.al.rientri || []).push({ turno: i.turno + 1, n: 1, motivo: `${e.nome} diventa mummia` }); nota(`${e.nome} sta per rialzarsi come mummia minore.`); }
  if (i.al.potere?.id === 'fluido-rianimante') { (i.al.rientri = i.al.rientri || []).push({ turno: i.turno + 1, n: 1, motivo: `${e.nome} diventa seguace del littore` }); }
}
export async function vittoria(i, esito) {
  const al = i.al; if (!al) return;
  const cu = cp(), s = sp();
  if (al.pvPerOcchioFuggito && esito === 'fuga') { s.occhi = (s.occhi || 0) + (i.nIniziale || 1); nota(`Occhi fuggiti: il prossimo littore avrà ${s.occhi} PV in più.`); }
  for (const e of eroiVivi()) { e.ingoiato = false; e.intrappolato = false; if (e.fuggito) e.fuggito = false; }
  if (esito === 'fuga' && i.id === 'o-orrori-risvegliati') { i.liv = i.livBase; }
  if (esito !== 'fuga' && !(i.esito === 'fuga')) {
    if (i.id === 'o-divoratore-tempo') { for (const e of eroiVivi()) e.marchi = 0; s.divoratore = null; }
    if (al.tesRivelazioni) { cu.rivelazioni += al.tesRivelazioni; nota(`Rivelazioni: ${cu.rivelazioni} (3 rivelano una magione oscura).`); }
    const tf = al.tesoroFisso;
    if (tf) {
      if (tf.cubiAnima) { const q = await num(tf.cubiAnima, 'Cubi anima del tesoro'); cu.cubi += Math.max(0, q); nota(`Tesoro: ${Math.max(0, q)} cubi anima.`); }
      if (tf.catturati) { const q = await num(tf.catturati, 'Catturati del tesoro'); s.catturati += q; nota(`Tesoro: ${q} catturati.`); }
      if (tf.oggettoMagico) { const o = await oggettoMagico(); (adv().bottino = adv().bottino || []).push({ id: uid(), ...o }); }
      if (tf.indizi) { const e = eroiVivi().sort((a, b) => (b.follia || 0) - (a.follia || 0))[0]; if (e) await G.aggiungiIndizio(e); }
      if (tf.armaDemoniaca) { (adv().bottino = adv().bottino || []).push({ id: uid(), tipo: 'magico', nome: 'Arma demoniaca', testo: 'Arma demoniaca: ' + D().tabelle.tesoriMagici[4].testo }); }
      if (tf.necro) { const q = await num(tf.necro, 'Necro'); s.necro += q; nota(`Tesoro: ${q} ϰ.`); }
      if (tf.oggetto === 'o-clessidra-espiazione') { cu.clessidra = true; nota('Tesoro: Clessidra dell’Espiazione (Strumenti › Aldilà).'); }
    }
    if (al.tesoroExtra?.catturati) { const q = await num(al.tesoroExtra.catturati, 'Catturati'); s.catturati += q; nota(`Tesoro extra: ${q} catturati.`); }
    if (al.tesoroExtra?.tabella === 'tesoriMagici') { const o = await oggettoMagico(); (adv().bottino = adv().bottino || []).push({ id: uid(), ...o }); }
    if (al.tesIndizi) { const e = eroiVivi().sort((a, b) => (b.follia || 0) - (a.follia || 0))[0]; if (e) await G.aggiungiIndizio(e); }
    if (al.offreIndizio) { /* via reazione */ }
    if (al.alMorire?.ultimo || al.scissione || al.blasf) {
      const coda = (adv().coda = adv().coda || []);
      if (al.alMorire?.evoca) { const v = trovaVoce('o-vermi-rigonfi'), n = await num(al.alMorire.evoca.numero, 'Vermi rigonfi'), m = creaIncontro('infestanti', await risolviVoce(v), n); await postCrea(m, v); coda.push(m); nota(`Dai cadaveri emergono ${n} vermi rigonfi.`); }
      if (al.scissione && i.ultimoIncantesimo !== 'Palla di Fuoco') { const n = await num(al.scissione.numero, 'Parti smembrate'); const m = creaIncontro('seguaci', { id: 'o-parti-amorfe', nome: 'Parti smembrate', liv: 6, att: 1, pv: 1, mor: 'NO', tes: 'NO', tag: ['abietto'], reazioni: [[1, 6, 'morte']] }, n); coda.push(m); nota(`Le parti smembrate combattono come ${n} seguaci di LIV 6.`); }
      if (al.blasf) await blasfemoSconfitto(i);
    }
    if (i.bossFinale || !i.minore && i.tabella === 'boss') { /* 2 ES: gestiti da game.vittoria */ }
  }
}
async function blasfemoSconfitto(i) {
  const b = cp().blasfemi.find(x => x.id === i.blasf?.id); if (b) { b.vivo = false; b.tornaIn = (await tira('1d6x1d6', 'Giorni al ritorno del blasfemo')).totale; nota(`${i.nome} è sconfitto: tornerà in ${b.tornaIn} giorni (muore davvero solo con arma demoniaca, uscita dall’Aldilà o cuore divorato).`); }
  if (i.al.blasf.nggurath) { const m = await G.monstroDa('infestanti'); m.sorpresa = true; (adv().coda = adv().coda || []).push(m); nota('Dal cadavere escono parassiti che attaccano di sorpresa.'); }
}
export function catturato(e, causa) {
  const i = C.inc(); if (!i || !i.cattura || !i.al || i.stato === 'finito' || causa !== i.nome || e.png) return false;
  e.pv = 0; e.stato = 'prigioniero'; e.catturatoDa = { nome: i.nome, aldila: true };
  Promise.resolve().then(async () => { e.pv = (await tira('1d3', 'PV del catturato')).totale; e.armi = []; e.armaPrincipale = null; e.armatura = 'nessuna'; e.scudo = false; e.oggetti = []; e.oro = 0; modificato('party'); });
  C.nota(`${e.nome} è catturato da ${i.nome}: spogliato e portato alla fortezza più vicina (Strumenti › Aldilà › Recinto degli schiavi).`);
  if (i.minore) { i.n = Math.max(0, i.n - 1); if (i.n === 0) setTimeout(() => C.applicaDanni(0), 0); } else { i.stato = 'finito'; i.esito = 'fuga'; i.tesoroPreso = true; }
  return true;
}
export function filtraBersagli(ordine) { const o = ordine.filter(e => !e.ingoiato); return o.length ? o : ordine; }
export async function dopoFuga(i) {
  const q = i.al?.insegueFuga; if (!q) return;
  const x = await dado(`${i.nome} inseguono: raggiunti? (1-${q.probabilita})`);
  nota(x.totale <= q.probabilita ? `${i.nome} raggiungono i fuggitivi: l’incontro riprende (riprendilo dalla stanza).` : `${i.nome} perdono le tracce.`);
}
/** Incantesimo base lanciato contro un mostro dell'Aldilà: true se bloccato. */
export function perIncantesimo(e, i, nome) {
  i.ultimoIncantesimo = nome;
  if (i.al?.immuneMagia) { nota(`${e.nome} lancia ${nome}: ${i.nome} è immune agli incantesimi.`); return true; }
  if (nome === 'Fulmine Magico' && i.al?.mimetismo) i.mimetismoAnnullato = true;
  if (nome === 'Fulmine Magico' && i.id === 'o-poligono-gelatinoso') { i.dannoDaIncantesimo = { 'Fulmine Magico': 1 + Math.max(2, 1) }; }
  if (i.al?.riflessoMagia) { const x = Math.floor(Math.random() * 6) + 1; if (x <= 5) nota(`Riflesso (${x}): l’incantesimo colpisce anche ${e.nome} (applica l’effetto a mano).`); }
  return false;
}

// =============================================================
//  INCANTESIMI, TESORI, EVENTI, OGGETTI
// =============================================================
const bott = o => { (adv().bottino = adv().bottino || []).push({ id: uid(), ...o }); };
const sottraiCubi = n => { const c = cp(); if (c.cubi < n) return false; c.cubi -= n; return true; };
export async function lancia(e, nome, annulla, bersaglioId) {
  const i = inCombattimento(), cu = cp();
  if (e.classe === 'cambione' && (e.armatura === 'pesante' || e.scudo)) { annulla(); return toast('Il cambione lancia solo con armatura leggera e senza scudo.', 'warn'); }
  const bers = eroePerId(bersaglioId) || e;
  switch (nome) {
    case 'Asservi demone': {
      if (!i || !i.tag.includes('demone') || i.tag.includes('non-morto')) { annulla(); return toast('Serve un demone in combattimento (non su non-morti o abietti).', 'warn'); }
      const pal = eroiVivi().find(x => x.classe === 'paladino' && x.stato === 'ok');
      if (pal && !(await C.salva(pal, pal.livello, 0, 'Il paladino davanti a un demone asservito'))) { nota(`${pal.nome} attacca ${e.nome} fino alla morte (a mano).`); }
      const r = await C.dE(e, `Asservi demone di ${e.nome}`), tot = r.totale + modAttacco(e, { ...C.contestoAttacco(e), incantesimo: true, nomeIncantesimo: nome }).tot, dif = i.liv + (i.minore ? 1 : i.pv);
      if (r.naturale !== 1 && tot >= dif) { i.asservito = { id: e.id, combattimenti: e.livello }; nota(`${e.nome} asservisce ${i.nome} (${tot} contro ${dif}) per ${e.livello} combattimenti: combatte per il gruppo con +½L ad attacco e difesa (gestito a mano).`); i.stato = 'finito'; i.esito = 'corrotto'; i.tesoroPreso = true; } else nota(`Asservi demone fallisce (${tot} contro ${dif}).`);
      return modificato();
    }
    case 'Banchetto di carne': { const q = 10 + e.livello; sp().razioni += q; nota(`${e.nome} fa crescere carne: +${q} razioni (chi la mangia fa 1 tiro di follia).`); return modificato(); }
    case 'Fantasma da riporto': { if (!sottraiCubi(1)) { annulla(); return toast('Serve 1 cubo anima.', 'warn'); } nota(`${e.nome} consuma 1 cubo anima: ritira la prossima tabella Incontri/Contenuti e scegli il risultato.`); return modificato(); }
    case 'Oblio': {
      if (bers.id === e.id && !i) { annulla(); return toast('Oblio non agisce sull’incantatore.', 'warn'); }
      if (i && bers.id === e.id) { await C.tiraReazione(); return nota('Oblio: nuovo tiro delle reazioni.'); }
      if (bers.follia > 0) { K.follia(bers, -1); nota(`${e.nome} lancia Oblio su ${bers.nome}: -1 follia.`); } else nota(`${bers.nome} non ha follia da perdere.`); return modificato();
    }
    case 'Portale dell’Aldilà': case 'Portale dell\'Aldilà': {
      const r = await C.dE(e, `Portale dell’Aldilà (L9)`), b = ['cambione', 'mago'].includes(e.classe) || e.daPergamena ? e.livello : 0, tot = r.totale + b + bonusSalvezza(e, 'magia').tot;
      const cubi = Math.max(0, 3 - Math.max(0, tot - 9));
      if (r.naturale === 1 || tot < 9) { nota(`Portale fallito (${tot} contro 9).`); return modificato(); }
      if (!sottraiCubi(cubi)) { annulla(); return toast(`Servono ${cubi} cubi anima.`, 'warn'); }
      sp().portale = 'aperto'; nota(`Portale aperto per 1 giorno (${tot}, costo ${cubi} cubi anima).`); return modificato();
    }
    case 'Scavadolore': { e.scavadolore = true; nota(`${e.nome} potenzia un’arma da taglio per questo combattimento: ferite non rigenerabili, un maggiore ferito perde 1 livello (una volta).`); if (i && !i.minore && !i.al?.perdeLivello && !i.tag.includes('non-morto')) { i.liv = Math.max(1, i.liv - 1); nota(`${i.nome} perde 1 livello (ora ${i.liv}).`); } return modificato(); }
  }
}
/** Tabella Tesori dell'Aldilà (d6 con modificatori del mostro). */
export async function tesoro(mod = 0, ctx = {}) {
  const r = await dado(`Tabella Tesori (d6${mod ? (mod > 0 ? '+' : '') + mod : ''})`), v = r.totale + mod, row = riga(tb('tesori'), v), s = sp(), cu = cp();
  const mol = ctx.molt || 1; let t = '';
  switch (row.azione) {
    case 'niente': t = 'Nessun tesoro.'; break;
    case 'necro': { const q = (await tira('1d6', 'Valore in ϰ')).totale * 5 * mol; s.necro += q; t = `${q} ϰ (scarti di ferro e conoscenze proibite).`; break; }
    case 'razioni': { const q = (await tira('2d6', 'Razioni')).totale * mol; s.razioni += q; t = `${q} razioni di cibo.`; break; }
    case 'catturati': { const q = (await tira('1d3', 'Catturati')).totale; s.catturati += q; t = `${q} catturati.`; break; }
    case 'pergamena': { const p = await G.generaPergamena(); bott(p); t = p.testo; break; }
    case 'oggetto-magico': { const o = await oggettoMagico(); bott(o); t = o.testo; break; }
    default: { const q = (await tira(row.dadi, 'Cubi anima')).totale; cu.cubi += q; t = `${q} cubi anima.`; }
  }
  log(`Tesoro (${v}): ${t}`); modificato('party'); return `Tesoro: ${t}`;
}
const OGG_TXT = { 'o-segno-antichi': ['segnoAntichi'], 'o-arma-demoniaca': [] };
/** Tesori magici dell'Aldilà (d6). */
export async function oggettoMagico() {
  const row = riga(tb('tesoriMagici'), (await dado('Tesori magici (d6)')).totale), o = { tipo: 'magico', nome: row.nome, testo: `${row.nome}: ${row.testo}`, abi: row.id };
  if (row.id === 'o-athame') o.solo = ['furfante'];
  return o;
}
/** Eventi speciali dell'Aldilà (d6). */
export async function evento(t) {
  const r = await dado('Evento speciale (d6)'), row = riga(tb('eventi'), r.totale);
  let tx = `${row.nome}: ${row.testo}`;
  const tuttiTS = async (liv, f, label) => { for (const e of eroiVivi().filter(x => x.stato === 'ok')) if (!(await C.salva(e, liv, 0, label))) await f(e); };
  switch (row.nome) {
    case 'Zur, il dio della morte': await tuttiTS(6, async e => { e.maledetto = true; }, 'Paura di Zur'); tx += ' → i falliti sono maledetti (-1 difesa); i demoni e non-morti uccisi nel raggio di 1d6 tornano al 50% (a mano).'; break;
    case 'Bottino nascosto': { const e = eroiVivi().find(x => x.stato === 'ok'); if (e && (await C.salva(e, 7, 0, 'Orientamento (bottino)'))) { const q = (await tira('1d3', 'Cubi anima')).totale; cp().cubi += q; tx += ` → ${q} cubi anima.`; } else tx += ' → ' + await G.trappola(); break; }
    case 'Tentacoli dal sottosuolo': { const L = (await tira('1d3+4', 'Livello dei tentacoli')).totale; await tuttiTS(L, async e => { if (!(await C.salva(e, L, -1, 'Attacco all’appendice (-2)'))) { C.perdiPV(e, e.pv, 'divorato dai tentacoli'); } }, 'Tentacoli dal sottosuolo'); break; }
    case 'Campo di battaglia': { for (let k = 0; k < 2; k++) tx += ' ' + await tesoro(-1); const q = (await tira('1d6', 'Razioni di carne')).totale; sp().razioni += q; tx += ` +${q} razioni di carne umana.`; break; }
    case 'Polmonite d\'ossa': case 'Polmonite d’ossa': await tuttiTS(4, async e => C.perdiPV(e, 1, 'polmonite d’ossa'), 'Polmonite d’ossa'); tx += ' (i falliti ripetono a fine giorno fino a 3 successi consecutivi).'; break;
    case 'Compagni di viaggio': { const n = (await tira('1d3+1', 'Avventurieri')).totale; tx += ` → ${n} avventurieri (Scoperte 18-19, vedi Strumenti › Aldilà).`; break; }
  }
  return tx;
}
export async function segretoAldila(e) {
  const k = await scelta(`${e.nome}: segreto dell’Aldilà (3 indizi)`, 'Scegli:', [['marchio', 'Marchio dei dimenticati: +2 alla difesa contro gli abietti per sempre'], ['magione', 'Magione oscura: ubicazione a 2d6 esagoni']]);
  if (k === 'marchio') { cp().marchio = true; (e.segreti = e.segreti || []).push('Marchio dei dimenticati'); log(`${e.nome} e i chierici/guerrieri/paladini del gruppo ricevono il Marchio dei dimenticati (+2 difesa contro gli abietti).`); }
  else if (k === 'magione') { const d = (await tira('2d6', 'Distanza')).totale, dir = (await tira('1d6', 'Direzione (1-6)')).totale; log(`Magione oscura a ${d} esagoni in direzione ${dir} (faccia del d6 sulla mappa).`); }
  G.aggiungiES(`${e.nome}: segreto scoperto (3 indizi)`); modificato('party');
}

// =============================================================
//  REAZIONI NUOVE E CORRUZIONE
// =============================================================
const eliminaMostri = (i, esito = 'corrotto') => { i.stato = 'finito'; i.esito = esito; i.tesoroPreso = true; modificato(); };
const pagaNecro = n => { const s = sp(); if (s.necro < n) return false; s.necro -= n; return true; };
const pvSangue = async (n, chi) => { let k = 0; while (k < n) { const e = eroiVivi().filter(x => x.stato === 'ok' && x.pv > 1).sort((a, b) => b.pv - a.pv)[0]; if (!e) break; C.perdiPV(e, 1, 'sangue'); k++; } return k; };
export function cartaCorruzione(i, btn) {
  const re = i.reazione, p = re.param, ris = re.risorsa || '', tot = re.tipoCorr === 'totale', q = typeof p === 'number' ? (tot ? p : p * i.n) : null, s = sp(), cu = cp();
  const fatto = txt => { C.nota(`${txt}: ${i.nome} è corrotto.`); C.paga(0, false, true); };
  const out = [h('p', {}, `${i.nome} chiede ${q != null ? `${q} ${ris || 'p.o.'}${tot ? ' in tutto' : ` (${p} a mostro)`}` : p}.`)];
  if (/razion/.test(ris)) out.push(btn(`Cedi ${q} razioni (hai ${s.razioni})`, () => { s.razioni -= q; fatto(`Cedute ${q} razioni`); }, 'primary', { disabled: s.razioni < q }));
  else if (/necro/.test(ris)) out.push(btn(`Paga ${q} ϰ (hai ${s.necro})`, () => { s.necro -= q; fatto(`Pagati ${q} ϰ`); }, 'primary', { disabled: s.necro < q }));
  else if (/punti vita/.test(ris + p)) out.push(btn(`Paga col sangue (${q ?? '?'} PV, a chi ha più PV)`, async () => { await pvSangue(q || 1); fatto('Pagato col sangue'); }, 'primary'));
  const txt = String(p);
  if (/cubo anima|cubi anima/.test(txt)) out.push(btn(`Cedi ${/1 cubo/.test(txt) ? 1 : 1} cubo anima (hai ${cu.cubi})`, () => { cu.cubi--; fatto('Ceduto 1 cubo anima'); }, '', { disabled: cu.cubi < 1 }));
  if (/catturat/.test(txt)) out.push(btn(`Cedi 1 catturato (hai ${s.catturati})`, () => { s.catturati--; fatto('Ceduto 1 catturato'); }, '', { disabled: s.catturati < 1 }));
  if (/20 ϰ a mostro/.test(txt)) out.push(btn(`Paga ${20 * i.n} ϰ`, () => { s.necro -= 20 * i.n; fatto('Pagati ϰ'); }, '', { disabled: s.necro < 20 * i.n }));
  if (/perdono permanentemente 1 punto vita|perdono permanentemente 1 PV/.test(txt)) out.push(btn('Tutti perdono permanentemente 1 PV', () => { eroiVivi().forEach(e => { e.pvMax = Math.max(1, e.pvMax - 1); e.pv = Math.min(e.pv, e.pvMax); e.pvPersi = (e.pvPersi || 0) + 1; }); fatto('Perso 1 PV permanente a testa'); }, 'primary'));
  out.push(btn('Ho consegnato il costo a mano', () => fatto('Costo consegnato a mano')), btn('Rifiuta e combatti', () => C.rifiutaCorruzione(), 'danger'));
  return h('div', { class: 'card' }, h('h4', {}, 'I mostri chiedono una tangente'), ...out);
}
/** Carte delle reazioni nuove del supplemento (brucia-anime, mercenari, patto, adorazione, obbedienza, trasformazione, mercanti, speciale). */
export function cartaReazione(i, btn) {
  const az = i.reazione?.azione; if (!i.al && !['brucia-anime', 'mercenari', 'adorazione', 'obbedienza', 'trasformazione'].includes(az)) return null;
  const s = sp(), cu = cp(), combatti = () => btn('Combatti', () => { i.mostriPrima = true; return C.inizioScontro(); }, 'danger'), chiudi = () => btn('Chiudi (se ne vanno)', () => C.chiudiIncontro());
  const card = (...k) => h('div', { class: 'card' }, ...k);
  const tutti = () => eroiVivi().filter(x => x.stato === 'ok');
  if (az === 'brucia-anime') {
    const costo = 10 * (i.minore ? i.n : 1);
    return card(h('p', {}, `${i.nome} ha una fornace di anime: paga ${costo} ϰ per la reazione Pacifico, altrimenti Cattura (in fortezza è sempre Pacifico).`),
      btn(`Paga ${costo} ϰ (hai ${s.necro})`, () => { s.necro -= costo; C.nota(`Pagati ${costo} ϰ: ${i.nome} è pacifico.`); i.reazione.azione = 'pacifico'; modificato(); }, 'primary', { disabled: s.necro < costo }),
      btn('Siamo in una fortezza: Pacifico', () => { i.reazione.azione = 'pacifico'; modificato(); }),
      btn('Rifiuta: Cattura', () => { i.reazione.azione = 'cattura'; i.cattura = true; i.mostriPrima = true; return C.inizioScontro(); }, 'danger'), combatti());
  }
  if (az === 'mercenari') {
    const prezzo = i.minore ? i.n * (i.pvMax > 1 ? i.pvMax : i.liv) : (i.pvMax > 1 ? i.pvMax : i.liv);
    return card(h('p', {}, `${i.nome} offre i suoi servigi come mercenari nel prossimo combattimento: ${prezzo} ϰ in anticipo (i demoni vogliono sangue o catturati). Morale a +1 contro infestanti, -1 aberranti, -2 boss, -3 boss finale o blasfemo; rifiutare dà Corruzione (3d6 ϰ).`),
      btn(`Assolda (${prezzo} ϰ, hai ${s.necro})`, () => { if (!pagaNecro(prezzo)) return; s.mercenari = { nome: i.nome, n: i.n, liv: i.liv }; C.nota(`${i.nome} assoldati per il prossimo combattimento (gestione a mano, tiro di morale prima di combattere).`); eliminaMostri(i, 'patto'); }, 'primary', { disabled: s.necro < prezzo }),
      btn('Rifiuta', async () => { const q = (await tira('3d6', 'Corruzione')).totale; C.nota(`Rifiutando: Corruzione di ${q} ϰ.`); i.reazione = { azione: 'corruzione', param: q, tipoCorr: 'totale', risorsa: 'necro' }; i.stato = 'corruzione'; modificato(); }), combatti(), chiudi());
  }
  if (az === 'patto-demoniaco') return card(h('p', {}, `${i.nome} propone un patto: 1 cubo anima subito, ma il gruppo deve uccidere e riportare qui la prima creatura incontrata che non sia demone, non-morto o catturato; altrimenti niente resurrezione per i futuri morti. Un solo patto alla volta.`),
    btn('Accetta il patto', () => { if (cu.patto) return toast('C’è già un patto attivo.', 'warn'); cu.cubi++; cu.patto = { da: i.nome, stato: 'attivo' }; C.nota('Patto stipulato: +1 cubo anima. Obbligo: uccidere e riportare la prima creatura (Strumenti › Aldilà).'); i.esito = 'patto'; eliminaMostri(i, 'patto'); }, 'primary'), combatti());
  if (az === 'adorazione') return card(h('p', {}, `${i.nome} esige adorazione: il sacrificio di 1 catturato (1 tiro di follia) o di un membro del gruppo. Offrendo un catturato riceve la missione di portargli il cuore di un altro blasfemo. Un paladino non adora mai e attacca subito.`),
    btn('Sacrifica un catturato', async () => { if (s.catturati < 1) return toast('Nessun catturato.', 'warn'); s.catturati--; const e = tutti().find(x => x.classe !== 'demonologo'); if (e) await follia(e); C.nota(`Sacrificato 1 catturato: missione del cuore di un altro blasfemo.`); (cp().missioniCuore = cp().missioniCuore || []).push(i.nome); eliminaMostri(i, 'patto'); }, 'primary', { disabled: s.catturati < 1 || tutti().some(x => x.classe === 'paladino') }),
    combatti(), chiudi());
  if (az === 'obbedienza') return card(h('p', {}, `${i.nome} chiede un tributo: sangue (1 ϰ per PV), catturati (10 ϰ), cubi anima (50 ϰ), oggetti dell’Aldilà (75 ϰ). Reazioni a -1 ogni 20 ϰ versati (max -4) e +1 per punto «fuorilegge infernale» (${cu.fuorilegge}).`),
    btn('Versa il tributo e tira la reazione', async () => { const v = Number(prompt('Valore del tributo in ϰ', '20')) || 0; const mod = -Math.min(4, Math.floor(v / 20)) + cu.fuorilegge, x = await dado('Reazione di obbedienza (d6)'), t = x.totale + mod; C.nota(`Tributo ${v} ϰ: reazione ${t}. ${t >= -1 && t <= 2 ? '1 indizio e 1 missione (testa del tiranno rivale).' : t <= -2 ? 'Favore del tiranno: -1 reazioni nella fortezza e 10% di sconto.' : 'Nessun favore.'}`); if (t >= -1 && t <= 2) { const e = tutti()[0]; if (e) await G.aggiungiIndizio(e); } eliminaMostri(i, 'patto'); }, 'primary'), combatti());
  if (az === 'trasformazione') return card(h('p', {}, `${i.nome} propone di diventare uno di loro: irreversibile, niente benedizioni né resurrezione né patti demoniaci, +1 alle reazioni fuori dall'Aldilà (-3 con i simili), nessun problema di cibo. Alleati e catturati morirebbero.`),
    btn('Un personaggio accetta', async () => { const e = await K.eroeScelto('Chi si trasforma?', x => x.stato === 'ok' && !x.salamandra); if (!e) return; e.salamandra = true; C.nota(`${e.nome} diventa uomo salamandra (irreversibile).`); eliminaMostri(i, 'patto'); }, 'primary'),
    btn('Tutti rifiutano (1d6: 1-2 missione, 3-6 combatte)', async () => { const x = await dado('Rifiuto (1-2 missione, 3-6 combatte)'); if (x.totale <= 2) { i.reazione.azione = 'missione'; modificato(); } else { i.mostriPrima = true; await C.inizioScontro(); } }));
  if (az === 'mercanti') return card(h('p', {}, `${i.nome} è pacifico e commercia (necro, razioni, cubi anima; niente Benedizione, acqua santa o resurrezione). Se vuoi un oggetto specifico tira 1d6 per la disponibilità.`), btn('Mercanti dell’Aldilà…', () => mercanti(i.al?.mercanteId || null), 'primary'), combatti(), chiudi());
  if (az === 'speciale') {
    const t = i.reazione.param || i.reazioni.find(r => r[2] === 'speciale')?.[3] || '';
    const el = [h('p', {}, `Reazione speciale: ${t || 'risolvi a parole'}`)];
    if (/Trance/.test(t)) el.push(btn('Trance: attacca con +2 al primo tiro di tutti', () => { i.bonusPrimoAttacco = 2; i.mostriPrima = false; return C.inizioScontro(); }, 'primary'));
    if (/indizio/.test(t)) el.push(btn('Prendi l’indizio', async () => { const e = tutti()[0]; if (e) await G.aggiungiIndizio(e); eliminaMostri(i, 'patto'); }, 'primary'));
    if (/tesoro/.test(t)) el.push(btn('Prendi il tesoro offerto', async () => { C.nota(await tesoro(0, {})); eliminaMostri(i, 'patto'); }, 'primary'));
    return card(...el, combatti(), chiudi());
  }
  return null;
}
async function follia(e) {
  if (e.classe === 'demonologo') return;
  const r = await dado(`Tiro di follia di ${e.nome} (riesce se ≤ follia)`);
  if (r.totale <= (e.follia || 0)) return nota(`${e.nome}: tiro di follia riuscito (${r.totale}).`);
  if (e.classe === 'cambione' && !e.ripetuto) { e.ripetuto = true; const r2 = await dado(`Cambione: ripete il tiro di follia`); if (r2.totale <= (e.follia || 0)) return nota(`${e.nome} ripete il tiro e riesce.`); }
  K.follia(e, 1);
}
export const tiroFollia = follia;

// =============================================================
//  CLASSI: dotazione, azioni in combattimento, scheda
// =============================================================
export async function dotazioneIniziale(e, auto = false) {
  if (e.classe === 'cambione' || e.classe === 'demonologo') {
    const n = (await tira('2d6', `Necro iniziali di ${e.nome} (2d6 ϰ)`)).totale; e.necro = n; log(`${e.nome} inizia con ${n} ϰ${e.classe === 'cambione' ? ' (in carne, non oro)' : ''}.`);
    if (e.classe === 'cambione') e.oro = 0;
    e.oggetti = e.oggetti || []; e.oggetti.push({ nome: e.classe === 'cambione' ? 'Souvenir terrificante' : 'Tatuaggi di protezione', qta: 1, nota: 'Equipaggiamento narrativo' });
  }
  if (e.classe === 'demonologo') await donoEsecrando(e, true);
}
/** Dono esecrando a caso da Dado abilità o Dado attacco (ritira i poteri combinatori). */
export async function donoEsecrando(e, gratis = false) {
  const t = Math.random() < 0.5 ? 'blasfemiAbilita' : 'blasfemiAttacco', row = await tiraParte(t, `Dono esecrando di ${e.nome}`, true);
  (e.doni = e.doni || []).push({ id: row.id, nome: row.nome, testo: row.testo }); log(`${e.nome} riceve il dono esecrando ${row.nome}: ${row.testo} (+2 alle reazioni contro creature non dell'Aldilà, non-morti esclusi; l'odio si ignora).`); modificato('party');
}
export function azioniCombattimento(e, i, azione) {
  const out = [], u = e.usi = e.usi || {};
  if (!aldilaAttivo() || e.png) return out;
  if (e.culto === 'chierico-zur' && (i.tag || []).includes('non-morto') && u.benedizione < 3 && !i.bossFinale) out.push(azione(e, `Offerta di sangue a Zur (${3 - u.benedizione})`, async () => {
    u.benedizione++; i.agito[e.id] = true; C.perdiPV(e, 1, 'offerta di sangue');
    const ok = i.minore || (await C.d6e(e, `Zur: salvezza contro il LIV ${i.liv}`)).totale + e.livello >= i.liv;
    if (ok) { i.reazione = { azione: 'pacifico', tiro: 0 }; i.stato = 'speciale'; C.nota(`${i.nome} diventa Pacifico per volere di Zur.`); } else C.nota('Zur non ascolta: il non-morto resta ostile.'); modificato();
  }, 'accent', { disabled: u.benedizione >= 3 }));
  if (e.culto === 'chierico-foryos' && /demon/i.test(i.nome) && u.benedizione < 3 && !(i.foryos || {})[e.id]) out.push(azione(e, `Furia di Foryos (${3 - u.benedizione})`, () => { u.benedizione++; (i.foryos = i.foryos || {})[e.id] = true; i.agito[e.id] = true; C.nota(`${e.nome}: per tutto l’incontro aggiunge il livello intero all’attacco contro ${i.nome}.`); modificato(); }, 'accent'));
  if (e.classe === 'paladino') {
    const pp = e.livello + 1 - (u.preghiera || 0);
    if (pp > 0) out.push(azione(e, `Preghiera: cura 1 PV (${pp} punti)`, async () => { const b = await K.eroeScelto('Chi cura?', x => x.stato === 'ok' && x.pv < x.pvMax); if (!b) return; u.preghiera = (u.preghiera || 0) + 1; b.pv = Math.min(b.pvMax, b.pv + 1); C.nota(`${e.nome} prega: ${b.nome} +1 PV.`); modificato('party'); }, 'accent'));
    if (!u.punizione) out.push(azione(e, 'Punizione divina (3 ferite a un maggiore o 3 minori)', async () => {
      u.punizione = 1; i.agito[e.id] = true; const r = await C.dE(e, `Punizione divina di ${e.nome}`, { senzaEsp: true }), m = modAttacco(e, C.contestoAttacco(e));
      const tot = r.totale + m.tot; if (r.naturale !== 1 && tot >= i.liv) { C.nota(`Punizione divina riesce (${tot}): ${i.minore ? '3 mostri uccisi' : '3 ferite'}.`); await C.applicaDanni(3); } else C.nota(`Punizione divina fallisce (${tot}).`); modificato();
    }, 'accent'));
  }
  if (e.classe === 'demonologo') {
    if (haAbilita(e, 'o-evocazione') && !u.evocazione && !e.possessione) out.push(azione(e, 'Evocazione (1 volta per avventura)', () => evoca(e, i), 'accent'));
    if (e.possessione) out.push(azione(e, `Rilascia ${e.possessione.nome}`, () => { C.nota(`${e.nome} libera ${e.possessione.nome}: si disperde.`); e.possessione = null; modificato('party'); }, '', {}));
    if (!e.possessione && !i.minore && progenie(i) && i.stato === 'combattimento' && i.pv <= 1) out.push(azione(e, 'Possessione sul colpo di grazia', () => possessione(e, i), 'accent'));
  }
  return out;
}
async function evoca(e, i) {
  const u = e.usi; u.evocazione = 1; i.agito[e.id] = true;
  const k = await scelta('Evocazione', 'Quale maggiore della progenie infernale (aberranti o boss, non blasfemi)?', [...D().mostri.aberranti, ...D().mostri.boss].filter(m => m.progenieInfernale && m.id !== 'o-blasfemo').map(m => [m.id, m.nome]));
  const v = trovaVoce(k); if (!v) return;
  const r = await C.dE(e, `Evocazione di ${v.nome}`), liv = v.liv || 9, tot = r.totale + e.livello + bonusSalvezza(e, 'magia').tot;
  if (r.naturale !== 1 && tot >= liv) C.nota(`${e.nome} evoca ${v.nome} (${tot} contro LIV ${liv}): combatte come alleato con +½L ad attacco e difesa; ogni turno salvezza per tenerlo (a mano: se fallisce attacca il demonologo). Immune a Benedizione e guarigioni.`);
  else { C.nota(`Evocazione fallita (${tot}): ${v.nome} si libera e attacca ${e.nome}.`); const m = await G.monstroDa('aberranti'); void m; }
  modificato('party');
}
async function possessione(e, i) {
  const r = await C.dE(e, `Possessione di ${i.nome}`), tot = r.totale + e.livello;
  if (r.naturale !== 1 && tot >= i.livBase) { e.possessione = { nome: i.nome, id: i.id }; C.nota(`${e.nome} imprigiona ${i.nome} (${tot} contro LIV ${i.livBase}): può usarne 1 sola regola (a mano). Dopo ogni combattimento nuovo tiro; se fallisce il mostro si materializza a PV pieni.`); } else C.nota(`Possessione fallita (${tot}).`);
  modificato('party');
}
export async function dopoCombattimentoPossessione() {
  for (const e of eroiVivi()) if (e.possessione && e.stato === 'ok') {
    const v = trovaVoce(e.possessione.id), r = await C.dE(e, `Possessione: tiro dopo il combattimento (${e.possessione.nome})`);
    if (r.naturale === 1 || r.totale + e.livello < (v?.liv || 9)) { nota(`La possessione di ${e.nome} fallisce: ${e.possessione.nome} si materializza a PV pieni e attacca con sorpresa.`); const m = creaIncontro('boss', await risolviVoce(v), 1); await postCrea(m, v); m.sorpresa = true; m.mostriPrima = true; e.possessione = null; G.avviaIncontro(m, G.tileById(adv().stanzaCorrente)); }
  }
}
export function sezioneScheda(e, rinfresca) {
  if (!aldilaAttivo() || e.anim) return null;
  const box = h('div', {}), k = cp();
  box.append(h('h4', {}, 'Orrori dall’Aldilà'));
  if (e.classe === 'paladino') box.append(h('p', { class: 'hint' }, `Punti preghiera: ${e.livello + 1 - (e.usi?.preghiera || 0)}/${e.livello + 1}. A fine avventura paga 10 p.o. × livello (${10 * e.livello}) o tutto l’oro e le gemme. Non si sottrae al combattimento. Cavalcatura: solo all'aperto, non nell'Aldilà.`));
  if (e.classe === 'demonologo') box.append(h('p', { class: 'hint' }, `Immune alla follia (ogni punto guadagnato guarisce 1 PV). Non resuscitabile né benedicibile. Possessione: ${e.possessione ? e.possessione.nome : 'nessuna'}.`));
  if (e.classe === 'cambione') box.append(h('p', { class: 'hint' }, `Lancia 1 incantesimo dell’Aldilà per livello (armatura leggera, niente scudo). Con 3+ follia non è benedicibile né resuscitabile. Tiri di follia: ripete 1 fallito per avventura. Non usa acqua santa.`));
  if (e.culto === 'chierico-zur') box.append(h('p', { class: 'hint' }, 'Voti: non usa cubi anima né ha figli. Non mangia nell’Aldilà. Non può imparare Creare acqua santa né Creare pergamene. Infrangere i voti: niente incantesimi finché non compie una missione.'));
  box.append(h('div', { class: 'row wrap' },
    h('span', { class: 'grow' }, `Doni esecrandi: ${(e.doni || []).map(d => d.nome).join(', ') || 'nessuno'}`),
    h('button', { class: 'mini', onclick: async () => { await donoEsecrando(e); rinfresca(); } }, 'Nuovo dono'),
    h('button', { class: 'mini', disabled: !(e.doni || []).length, onclick: () => { e.doni.pop(); modificato('party'); rinfresca(); } }, 'Togli')));
  if (e.pvPersi) box.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, `PV massimi persi per l’oracolo: ${e.pvPersi}`), h('button', { class: 'mini', onclick: () => { e.pvMax += e.pvPersi; e.pvPersi = 0; log(`${e.nome} recupera i PV persi (Benedizione e Guarigione).`); modificato('party'); rinfresca(); } }, 'Ripristina')));
  if (e.stato === 'prigioniero' && e.catturatoDa) box.append(h('button', { onclick: () => { e.stato = 'ok'; e.pv = Math.max(1, e.pv); e.catturatoDa = null; modificato('party'); rinfresca(); } }, 'Libera / recupera il personaggio'));
  if (e.classe === 'mago') {
    const sel = h('select', {}, NOMI_INCANTESIMI().filter(n => !(e.avanzati || []).includes(n)).map(n => h('option', { value: n }, n)));
    if (sel.children.length) box.append(h('div', { class: 'row' }, sel, h('button', { onclick: () => { (e.avanzati = e.avanzati || []).push(sel.value); log(`${e.nome} impara «${sel.value}» (incantesimo dell'Aldilà).`); modificato('party'); rinfresca(); } }, 'Impara un incantesimo dell’Aldilà (segreto o tiro ES)')));
  }
  box.append(h('small', { class: 'hint' }, `Gruppo: ${k.cubi} cubi anima · fuorilegge infernale ${k.fuorilegge}.`));
  return box;
}
export async function inizioAvventura() {
  if (!aldilaAttivo()) return;
  for (const e of S.party.eroi) { e.malusCampane = 0; e.malusAtt = 0; e.ingoiato = false; e.intrappolato = false; e.fuocoPire = false; e.marchi = 0; e.ripetuto = false; if (e.classe === 'cambione' && e.stato === 'ok') e.armatura = e.armatura === 'pesante' ? 'leggera' : e.armatura; }
  adv().seguaciSub = null;
}
export async function fineAvventura(esito) {
  if (!aldilaAttivo()) return;
  const sconfitta = /sconfitt/i.test(esito || '');
  for (const e of S.party.eroi.filter(x => x.classe === 'paladino' && x.stato === 'ok')) {
    if (sconfitta) continue; const dovuto = 10 * e.livello;
    if ((e.oro || 0) >= dovuto) { e.oro -= dovuto; log(`${e.nome} (paladino) paga all’ordine ${dovuto} p.o.`); } else { log(`${e.nome} (paladino) non ha ${dovuto} p.o.: cede tutto l’oro e le gemme dell’ultima avventura.`); e.oro = 0; }
  }
  const s = sp(); s.seguaciSub = null; s.tempio = false; modificato('party');
}

// =============================================================
//  ESPLORAZIONE A ESAGONI: strumenti guidati (la mappa del manuale non è codificata)
// =============================================================
const TERR_TAB = { altopiano: 'incontriAltopiano', canyon: 'incontriCanyon', caverne: 'incontriCaverne', 'mare-polvere': 'incontriMarePolvere', montagne: 'incontriMontagne' };
const diff = id => tb('difficoltaTerreni').find(t => t.terreno === id);
const gruppo = () => eroiVivi().filter(e => e.stato === 'ok' && !e.png);
const dg = () => (gruppo().some(e => e.livello >= 5) ? '1d8' : '1d6');
const tiraG = async (label, mod = 0) => { const r = await tira(dg(), label); return { ...r, tot: r.totale + mod }; };
const nutre = e => !(e.salamandra || e.classe === 'cambione' || e.culto === 'chierico-zur' || e.merc === 'm-salamandra');
export async function nuovaSpedizione() {
  const s = adv().aldila = null; void s; const d = sp(); d.attiva = true;
  d.razioni = 10 * gruppo().filter(nutre).length;
  const mod = (eroiVivi().some(e => e.classe === 'paladino') ? -1 : 0) + (eroiVivi().some(e => e.classe === 'demonologo') ? 1 : 0), r = await dado('Obiettivo (d6, paladino -1, demonologo +1)');
  const v = r.totale + mod, row = riga(tb('obiettivi'), v); d.obiettivo = { id: row.id, nome: row.nome, testo: row.obiettivo, secondario: row.secondario, fatto: false, secFatto: false };
  const ing = await dado('Esagono d’ingresso (faccia del d6 sulla mappa)'); d.ingresso = ing.totale;
  log(`Spedizione nell'Aldilà: obiettivo «${row.nome}» – ${row.obiettivo} (secondario: ${row.secondario}). Razioni: ${d.razioni}. Ingresso: esagono ${ing.totale}. Tira il terreno dell'esagono (d66) se la mappa non lo indica.`); modificato();
}
export async function terrenoCasuale() {
  const d = sp(), r = await (await import('./dice.js')).d66('Terreno (d66)'), row = riga(tb('terreno'), r.totale);
  let t = row.terreno;
  if (t === 'identico') { if (d.terreno && !['fortezza', 'tempio'].includes(d.terreno)) t = d.terreno; else return terrenoCasuale(); }
  d.terreno = t; d.giorniQui = 0; log(`Terreno dell'esagono: ${row.nome === 'Identico all\'esagono appena attraversato' ? diff(t)?.nome : row.nome}.`); modificato(); return t;
}
export async function impostaTerreno() {
  const k = await scelta('Terreno dell’esagono', 'Quale terreno indica la mappa?', tb('difficoltaTerreni').map(t => [t.terreno, t.nome]));
  if (!k) return; const d = sp(); d.terreno = k; d.giorniQui = 0; log(`Terreno: ${diff(k).nome}.`); modificato();
}
async function consumaGiorno(nogiorno) {
  const d = sp(), mang = gruppo().filter(nutre), fame = [];
  const bocche = mang.length + d.catturati;
  if (d.razioni >= bocche) d.razioni -= bocche; else { d.razioni = 0; fame.push(...mang); }
  if (d.razioni === 0 && bocche > 0 && fame.length) for (const e of fame) C.perdiPV(e, 1, 'senza cibo');
  d.giorno++; d.giorniQui++; if (!nogiorno) log(`Giorno ${d.giorno}: razioni ${d.razioni}.`);
}
/** Una giornata nell'esagono: incontri → furtività → foraggiamento → riposo. */
export async function giornata({ campo = false } = {}) {
  const d = sp(); if (!d.terreno) return toast('Imposta prima il terreno dell’esagono.', 'warn');
  const t = diff(d.terreno), g = gruppo(), pgn = g.length + d.catturati; let incontro = false;
  if (t.intransitabile) return toast('L’abisso è intransitabile.', 'warn');
  if (t.incontri === 'sempre') incontro = true; else if (typeof t.incontri === 'number') { const r = await tiraG(`Incontri ${t.nome} (≥${t.incontri})`); incontro = r.tot >= t.incontri; log(`Incontri: ${r.tot} contro ${t.incontri}: ${incontro ? 'incontro' : 'nessuno'}.`); }
  if (incontro && typeof t.furtivita === 'number') {
    const mod = g.filter(e => ['furfante', 'mezzuomo'].includes(e.classe)).length - 2 * (g.filter(e => ['elfo', 'paladino'].includes(e.classe)).length + g.filter(e => (e.oggetti || []).some(o => /reliquia sacra/i.test(o.nome))).length) + (d.campoIeri ? 1 : 0);
    const L = Math.max(1, pgn + t.furtivita), r = await tiraG(`Furtività (livello ${L})`, mod);
    log(`Furtività: ${r.tot} contro ${L}: ${r.tot >= L ? 'incontro evitato' : 'scoperti'}.`); if (r.tot >= L) incontro = false;
  }
  if (incontro && TERR_TAB[d.terreno]) await incontroTerreno();
  else if (incontro && d.terreno === 'tempio') log('Tempio: nessun incontro se lo eviti; per esplorarlo usa «Tempio» negli Strumenti.');
  if (typeof t.foraggiamento === 'number') {
    const mod = (g.some(e => e.classe === 'barbaro') ? 1 : 0) + g.filter(e => e.classe === 'demonologo').length + (d.terreno === 'montagne' ? g.filter(e => e.classe === 'nano').length : 0) - (d.giorniQui > 0 ? d.giorniQui : 0);
    const r = await tiraG(`Foraggiamento (livello ${t.foraggiamento})`, mod);
    if (r.tot > t.foraggiamento) { const q = r.tot - t.foraggiamento; d.razioni += q; log(`Foraggiamento: ${r.tot} contro ${t.foraggiamento}: +${q} razioni.`); } else log(`Foraggiamento fallito (${r.tot} contro ${t.foraggiamento}).`);
  }
  const mangiato = d.razioni >= g.filter(nutre).length + d.catturati;
  await consumaGiorno();
  if (typeof t.riposo === 'number' && campo && mangiato) { const r = await tiraG(`Riposo (livello ${t.riposo})`); if (r.tot >= t.riposo) { g.concat([]).forEach(e => { e.pv = Math.min(e.pvMax, e.pv + 1); }); log('Riposo riuscito: +1 PV a chi ha mangiato.'); } }
  d.campoIeri = campo; modificato('party');
}
export async function orientamento() {
  const d = sp(), t = diff(d.terreno); if (!t) return;
  if (t.orientamento === 'sempre') return log('Orientamento automatico.');
  const mod = gruppo().filter(e => e.classe === 'demonologo').length + d.giorniQui, r = await tiraG(`Orientamento (livello ${t.orientamento})`, mod);
  if (r.tot >= t.orientamento) { log(`Orientamento riuscito (${r.tot}): il gruppo lascia l'esagono.`); d.terreno = null; d.giorniQui = 0; } else { log(`Orientamento fallito (${r.tot}): si resta un altro giorno.`); await consumaGiorno(); }
  modificato();
}
async function creaDa(tab, opz = {}) { const i = await G.monstroDa(opz.tabella || tab, { lista: opz.lista || (opz.tabella === 'seguaci' ? undefined : tab) }); G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); return i; }
const mostri = async (rif, row) => {
  const tab = { infestanti: 'infestanti', nonMorti: 'seguaci', umanoidi: 'seguaci', demoniaci: 'seguaci', aberranti: 'aberranti', boss: 'boss' }[rif];
  let i;
  if (row?.voce) { const l = D().mostri[rif]; const v = l[row.voce - 1], q = await risolviVoce(v); const n = v.conta && v.conta !== '1' ? (await tira(v.conta, `Numero ${v.nome}`)).totale : 1; i = creaIncontro(tab, q, n); await postCrea(i, v); }
  else { const o = { lista: rif }; if (row?.tiroTabella) { const mm = D().mostri[rif], x = await tira(row.tiroTabella.replace(/-8$/, '-8'), 'Tiro sulla tabella'); const idx = Math.max(1, Math.min(6, row.tiroMin ? Math.max(row.tiroMin, x.totale) : x.totale)); const v = listaMostri(rif)[idx - 1]; const q = await risolviVoce(v), n = v.conta && v.conta !== '1' ? (await tira(v.conta, `Numero ${v.nome}`)).totale : 1; i = creaIncontro(tab, q, n); await postCrea(i, v); void mm; } else i = await G.monstroDa(tab, o); }
  if (row?.sorpresaProb && (await dado(`Ti sorprendono? (1-${row.sorpresaProb})`)).totale <= row.sorpresaProb) i.sorpresa = true;
  if (row?.modReazioni) i.modReazioni = row.modReazioni;
  G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); return i;
};
async function mostroExtra(id, conta) {
  const v = trovaVoce(id); if (!v) return; let q;
  if (id === 'o-ragni-demoniaci') { const b = R.mostri.aberranti[4]; q = { ...b, id, nome: 'Ragni demoniaci', tag: [...(b.tag || []), 'demone'], conta: '1d3+1' }; }
  else q = await risolviVoce(v);
  const n = conta ? (await tira(conta, `Numero ${v.nome}`)).totale : v.conta && v.conta !== '1' ? Math.max(v.contaMin || 1, (await tira(v.conta, `Numero ${v.nome}`)).totale) : 1;
  const tab = ['boss', 'aberranti'].includes(v.categoria) ? v.categoria : v.categoria === 'seguaci' ? 'seguaci' : 'infestanti';
  const i = creaIncontro(tab, { ...q, tes: q.tes === null ? 'NO' : q.tes }, n); await postCrea(i, q); G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); return i;
}
/** Tira sulla tabella incontri del terreno e risolve la voce. */
export async function incontroTerreno(tabNome) {
  const d = sp(), nome = tabNome || TERR_TAB[d.terreno]; if (!nome) return;
  const r = await tira('2d6', `Incontri (${nome}, 2d6)`), row = riga(tb(nome), r.totale);
  log(`Incontro (${r.totale}): ${row.nome} – ${row.testo}`); await risolviRiga(row); modificato(); return row;
}
async function sceltaRiga(row) {
  const k = await scelta(row.nome, row.testo, (row.opzioni || []).map((o, n) => [n, o.id + (o.scoperta ? ` (Scoperta ${o.scoperta})` : ''), o.testo || '']));
  const o = row.opzioni?.[k ?? 0]; if (!o) return;
  if (o.scoperta) return scoperta(o.scoperta);
  if (o.azione === 'sacrifica-catturato') { const s = sp(); if (s.catturati < 1) return toast('Nessun catturato.', 'warn'); s.catturati--; const e = await K.eroeScelto('Chi riceve la Benedizione?'); if (e) { K.follia(e, 1); log(`${e.nome} riceve una Benedizione e 1 follia.`); } }
  else if (o.azione === 'distruggi') { const e = await K.eroeScelto('Chi è maledetto?'); if (e) { e.maledetto = true; K.follia(e, -1); } }
  else if (row.azione === 'scelta' && o.id === 'combatti') await creaDa('demoniaci', { tabella: 'seguaci', lista: 'demoniaci' });
}
async function salvezzeRiga(row) {
  const tutti = gruppo(), p = async (liv, f, lab) => { for (const e of tutti) if (!(await C.salva(e, liv, 0, lab))) await f(e); };
  switch (row.nome) {
    case 'Crollo': await p(4, async e => { const o = casuale(e.oggetti || []); if (o) { e.oggetti.splice(e.oggetti.indexOf(o), 1); log(`${e.nome} perde ${o.nome}.`); } }, 'Crollo (schivare)'); break;
    case 'Frana': for (const e of tutti) { const rr = await C.dE(e, `Frana: difesa di ${e.nome} (L6)`); if (rr.naturale === 1 || rr.totale + 0 <= 6 && !C.esplode(e, rr)) { const q = (await tira('1d3', 'Oggetti persi')).totale; for (let k = 0; k < q && e.oggetti?.length; k++) e.oggetti.splice(Math.floor(Math.random() * e.oggetti.length), 1); if (rr.naturale === 1) C.perdiPV(e, 1, 'frana'); } } break;
    case 'Crollo sotterraneo': await p(5, async e => C.perdiPV(e, 1, 'crollo'), 'Crollo sotterraneo'); break;
    case 'Tentacoli affamati': for (const e of tutti) { let L = 7, ok = false; for (let k = 0; k < 6 && !ok && e.stato === 'ok'; k++) { ok = await C.salva(e, L, 0, 'Tentacoli affamati'); if (!ok) { C.perdiPV(e, 1, 'tentacoli'); L++; } } } break;
    case 'Sabbie mobili': { const e = casuale(tutti); let L = (await tira('1d3+5', 'Livello sabbie mobili')).totale, k = 0; while (e && e.stato === 'ok' && k++ < 8 && !(await C.salva(e, L, k - 1 - (e.armatura === 'pesante' ? 2 : e.armatura === 'leggera' ? 1 : 0), 'Sabbie mobili'))) C.perdiPV(e, 1, 'sabbie mobili'); break; }
    case 'Pozzo nascosto': await p(5, async e => C.perdiPV(e, 1, 'acqua avvelenata'), 'Pozzo nascosto (veleno)'); break;
    case 'Senza scopo': { const e = tutti.sort((a, b) => b.livello - a.livello)[0]; if (e && !(await C.salva(e, 5, 0, 'Senza scopo (paura)'))) { log('Il gruppo resta nel Guf anche il giorno dopo (ritira con -1).'); sp().gufGiorni++; } break; }
    default: log('Risolvi a mano: ' + row.testo);
  }
}
async function risolviRiga(row) {
  const d = sp();
  switch (row.azione) {
    case 'scelta': return sceltaRiga(row);
    case 'scoperta': { if (row.opzioneSaltare && !(await confirmBox(`${row.nome}: ${row.testo}\nIndaghi?`))) return; return scoperta(row.scoperta); }
    case 'tabella': return row.tabellaRiferita === 'eventi' ? log(await evento()) : row.tabellaRiferita === 'tesoriMagici' ? bott(await oggettoMagico()) : null;
    case 'mostri': return mostri(row.tabellaRiferita, row);
    case 'mostro': return mostroExtra(row.mostro);
    case 'mercanti': return mercanti(null, row);
    case 'fortezza': return fortezza();
    case 'evento': { if (row.nome === 'Strani fenomeni') { const x = [await tira('1d6', 'Evento A'), await tira('1d6', 'Evento B'), await tira('1d6', 'Evento C')].map(q => q.totale).sort((a, b) => a - b); log(`Strani fenomeni: eventi ${x[0]} e ${x[1]}.`); for (const n of x.slice(0, 2)) { const rr = riga(tb('eventi'), n); log(`Evento ${n}: ${rr.nome} – ${rr.testo}`); } } return; }
    case 'salvezza': return salvezzeRiga(row);
    case 'orientamento': { for (const e of gruppo()) { const L = row.orientamento.liv; if (!(await C.salva(e, L, e.classe === 'demonologo' ? 1 : 0, row.nome))) log(`${e.nome} fallisce l'orientamento (${row.nome}: ${row.orientamento.fallimento}).`); } return; }
    case 'perdi-giorno': return consumaGiorno();
    case 'follia': { const e = gruppo().sort((a, b) => (b.follia || 0) - (a.follia || 0))[0]; if (e) { const r = await dado(`Cupa disperazione: follia di ${e.nome}`); if (r.totale > (e.follia || 0)) { K.follia(e, 0); log('Il gruppo impiega 1 giorno in più.'); await consumaGiorno(); } } return; }
    case 'fornace': { log('Fornace di anime: guardiano 1d3+3 su aberranti e compari 1d3+3 su seguaci.'); return; }
    case 'enigma': return log(`${row.nome}: ${row.testo}`);
    case 'missione': return log('Angelo morente: tira 1d3-1 su Obiettivi (Strumenti › Aldilà).');
    default: log(`Risolvi a mano: ${row.testo}`);
  }
}
// ---- Guf, fortezza, luoghi, dicerie, mercanti, scoperte ----
export async function guf() {
  const d = sp(), r = await tira('2d6', 'Esplorazione del Guf (2d6)'), tot = r.totale + d.gufGiorni;
  let row = riga(tb('guf'), tot); const unici = cp().unici;
  if (row.unico && unici.includes(row.nome)) row = riga(tb('guf'), row.nome === 'Angelo morente' ? 2 : 4);
  log(`Guf (${tot}): ${row.nome} – ${row.testo}`);
  if (row.unico) unici.push(row.nome);
  if (row.nome === 'Demone mietitore') { const l = trovaVoce('o-littore'), q = await risolviVoce(l), i = creaIncontro('boss', q, 1); await postCrea(i, l, { seguito: false }); i.reazione = { azione: 'cattura' }; i.cattura = true; const s = await G.monstroDa('seguaci', { lista: 'nonMorti' }); G.avviaIncontro(i, null); (adv().coda = adv().coda || []).push(s); }
  else if (row.nome === 'Demoni della disperazione') await mostroExtra('o-demoni-disperazione', '2d6');
  else if (row.nome === 'Angelo morente') { const x = await tira('1d3-1', 'Obiettivo dell’angelo'); log(`Angelo morente: missione = obiettivo n. ${x.totale} (${riga(tb('obiettivi'), x.totale).nome}).`); }
  else if (row.nome === 'Pozzo dei rimpianti') { const e = await K.eroeScelto('Chi scende nel pozzo?', x => x.stato === 'ok'); if (e) { for (const L of [5, 7, 9]) { let ok = false; while (!ok && e.stato === 'ok') { ok = await C.salva(e, L, -(e.follia || 0), 'Pozzo dei rimpianti (paura)'); if (!ok) { C.perdiPV(e, ['cambione', 'demonologo'].includes(e.classe) ? (await tira('1d3', 'PV persi')).totale : 1, 'pozzo'); K.follia(e, 1); } } } cp().bilancia = true; log('Trovata la Bilancia dell’ingiustizia (6 cubi anima per far risorgere 1 personaggio, +1 follia permanente).'); } }
  else if (row.nome === 'Senza scopo') await salvezzeRiga(row);
  d.gufGiorni = d.gufGiorni || 0; modificato();
}
export async function fortezza() {
  const d = sp(); d.fortezza = d.fortezza || { entrati: false };
  const n = gruppo().length; if (!d.fortezza.entrati) { if (!(await confirmBox(`Entrare nella fortezza: ${n} ϰ di ingresso (1 per personaggio) e 1 ϰ al giorno. Hai ${d.necro} ϰ. Senza pagare la milizia ti cattura. Paghi?`))) return; if (d.necro < n) return toast('Necro insufficienti.', 'warn'); d.necro -= n; d.fortezza.entrati = true; log(`Entrati nella fortezza (-${n} ϰ). Reazioni a -3 finché ci sei.`); }
  const k = await scelta('Fortezza: attività del giorno', 'Una attività al giorno:', [['mercanti', 'Vendere o comprare dai mercanti'], ['info', 'Cercare informazioni (Dicerie)'], ['riposo', 'Cercare cibo e riposo (1 ϰ a testa)'], ['tiranno', 'Rendere omaggio a un tiranno'], ['bruciare', 'Bruciare i catturati in una fornace'], ['liberare', 'Liberare catturati (fuorilegge infernale +1)'], ['assoldare', 'Assoldare alleati (artigiani e mercenari)'], ['esci', 'Lascia la fortezza']]);
  if (k === 'mercanti') await mercanti(); else if (k === 'info') await dicerie();
  else if (k === 'riposo') { const c = n + Math.floor(d.catturati / 5); if (d.necro >= c) { d.necro -= c; gruppo().forEach(e => { e.pv = Math.min(e.pvMax, e.pv + 1); }); log(`Cibo e riposo (-${c} ϰ).`); const x = await dado('Incontro ostile a fine giornata? (1)'); if (x.totale === 1) await mostri('nonMorti'); } else toast('Necro insufficienti.', 'warn'); }
  else if (k === 'tiranno') { const v = listaMostri('aberranti')[(await tira('1d3+3', 'Tiranno')).totale - 1], q = await risolviVoce(v); q.liv += 3; q.pv += (await tira('1d8', 'PV extra')).totale; q.att += 2; q.nome = `Tiranno: ${v.nome}`; q.reazioni = [[1, 6, 'obbedienza']]; const i = creaIncontro('boss', q, 1); await postCrea(i, v); G.avviaIncontro(i, null); const s = await G.monstroDa('seguaci'); s.nome += ' (seguito)'; s.n *= (await tira('1d6', 'Moltiplicatore del seguito')).totale; s.nIniziale = s.n; s.noMorale = true; (adv().coda = adv().coda || []).push(s); }
  else if (k === 'bruciare') { const x = await dado('La fortezza ha una fornace? (1-4)'); if (x.totale <= 4) { const i = await G.monstroDa('seguaci', { lista: 'demoniaci' }); i.reazioni = [[1, 6, 'brucia-anime']]; G.avviaIncontro(i, null); } else log('Nessuna fornace in questa fortezza.'); }
  else if (k === 'liberare') { cp().fuorilegge++; log(`Tentativo di liberare catturati: fuorilegge infernale ${cp().fuorilegge}. Prima va affrontata la milizia (seguaci × 1d3).`); const i = await G.monstroDa('seguaci'); i.n *= (await tira('1d3', 'Moltiplicatore')).totale; i.nIniziale = i.n; G.avviaIncontro(i, null); }
  else if (k === 'assoldare') log('Artigiani (ϰ o PV): armaiolo 6, chiromante 15, esperto di veleni 25, fabbricante di scudi 8, saggio 10. Mercenari salamandra (ϰ): armigero 20, attendente 12, guardia del corpo 30, guida 7/livello (+1 foraggiamento), lanterniere 4, portatore 4 (20 razioni). Non mangiano.');
  else if (k === 'esci') d.fortezza = null;
  modificato();
}
export async function dicerie() {
  const r = await dado('Dicerie (d6)'), row = riga(tb('dicerie'), r.totale); log(`Dicerie (${r.totale}): ${row.nome}.`);
  const v = row.mostro ? trovaVoce(row.mostro) : null;
  if (row.mostro === 'o-cambioni' || row.nome === 'Demoni blateranti') { const i = row.mostro ? await mostri('umanoidi', { voce: 2 }) : await G.monstroDa('seguaci', { lista: 'demoniaci' }); if (!row.mostro) G.avviaIncontro(i, null); i.note += ' ' + row.testo; }
  else if (row.mostro === 'o-demonologo-errante') { const q = await risolviVoce(v); const i = creaIncontro('boss', { ...q, tes: 1, tesMolt: 2 }, 1); await postCrea(i, v); G.avviaIncontro(i, null); }
  else if (v) { const q = await risolviVoce(v), i = creaIncontro(row.mostro === 'o-littore' ? 'boss' : 'aberranti', q, 1); await postCrea(i, q); G.avviaIncontro(i, null); i.note += ' ' + row.testo; }
  modificato();
}
export async function mercanti(id, rigaForzata) {
  const r = id ? null : await dado('Mercanti (d6)'), m = id ? D().mercanti.tipi.find(x => x.id === id) : D().mercanti.tipi.find(x => r.totale >= x.da && r.totale <= x.a);
  const molt = (rigaForzata?.prezziMolt || 1) * (sp().fortezza?.citta ? 1.2 : 1);
  modal(`Mercanti: ${m.nome}`, (b, close) => {
    const s = sp(), cu = cp(), fmt = x => `${x.cosa}: ${x.prezzo != null ? (typeof x.prezzo === 'string' ? x.prezzo : Math.round(x.prezzo * molt)) + ' ' + (x.unita || '') : 'prezzo del manuale base'}`;
    b.append(h('p', {}, `Hai ${s.necro} ϰ, ${s.razioni} razioni, ${cu.cubi} cubi anima, ${s.catturati} catturati.${m.indisponibile ? ` Oggetto specifico: tira 1d6, indisponibile con ${m.indisponibile.da === m.indisponibile.a ? m.indisponibile.da : m.indisponibile.da + '-' + m.indisponibile.a}.` : ''} Nessuno vende Benedizione, acqua santa o resurrezioni.`),
      h('h4', {}, 'Vendono'), h('ul', {}, (m.vende || []).map(x => h('li', {}, fmt(x)))), h('h4', {}, 'Comprano'), h('ul', {}, (m.compra || []).map(x => h('li', {}, fmt(x)))));
    const op = (testo, f) => h('button', { onclick: () => { f(); modificato('party'); close(); mercanti(m.id, rigaForzata); } }, testo);
    const salamandra = m.id === 'o-merc-salamandra';
    b.append(h('div', { class: 'row wrap' },
      op(`Compra 1 razione (1 ϰ)`, () => { if (s.necro >= 1) { s.necro--; s.razioni++; } }), op('Compra 1 cubo anima (50 ϰ)', () => { if (s.necro >= 50) { s.necro -= 50; cu.cubi++; } }),
      op('Vendi 1 cubo anima (+50 ϰ)', () => { if (cu.cubi) { cu.cubi--; s.necro += 50; } }), op('Compra 1 catturato (10 ϰ)', () => { if (s.necro >= 10) { s.necro -= 10; s.catturati++; } }),
      op('Vendi 1 catturato (+10 ϰ)', () => { if (s.catturati) { s.catturati--; s.necro += 10; } }), salamandra ? null : op('Vendi 1 PV di sangue (+1 ϰ)', () => { const e = gruppo().sort((a, c) => c.pv - a.pv)[0]; if (e && e.pv > 1) { C.perdiPV(e, 1, 'sangue venduto'); s.necro++; } })));
    b.append(h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: close }, 'Chiudi')));
  }, { wide: true });
}
export async function recinto(e) {
  const cu = cp(), r = await tira('2d6', `Recinto degli schiavi (2d6 + livello ${e.livello} + fuorilegge ${cu.fuorilegge})`), tot = r.totale + e.livello + cu.fuorilegge, row = riga(tb('recintoSchiavi'), tot);
  let t = `${e.nome} (${tot}): ${row.nome}`;
  if (row.azione === 'morto') { e.stato = 'morto'; t += ' – è morto'; } else { const p = (await tira('2d6', 'Prezzo per livello')).totale * e.livello + cu.fuorilegge; t += ` – ${row.azione === 'acquisto' ? `ricomprabile a ${p} ϰ` : `venduto (${p} ϰ): lo ritrovi dal ${row.destinazione}`}`; e.prezzoRiscatto = p; }
  log(t); modificato('party'); return t;
}
export async function blasfemo(persistente) {
  const cu = cp(); let esistente = null;
  if (persistente) { const vivi = cu.blasfemi.filter(b => b.vivo !== false); if (!vivi.length) return toast('Nessun blasfemo persistente.', 'warn'); const k = await scelta('Blasfemo persistente', 'Quale?', vivi.map(b => [b.id, b.nome])); esistente = vivi.find(b => b.id === k); if (!esistente) return; }
  const v = await creaBlasfemoVoce(trovaVoce('o-blasfemo'), esistente), i = creaIncontro('boss', v, 1), parti = v.blasf.parti;
  i.blasf = v.blasf; await postCrea(i, v);
  if (!esistente) { i.blasf.id = uid(); cu.blasfemi.push({ id: i.blasf.id, nome: v.blasf.nome, titolo: v.blasf.titolo, parti, terreno: sp().terreno, vivo: true }); } else i.blasf.id = esistente.id;
  const ids = new Set(parti); const al = i.al;
  al.blasf = { ruggine: ids.has('bhaal'), unaFerita: false, nggurath: ids.has('nggurath'), sloatsh: ids.has('sloatsh') };
  if (ids.has('mogron')) { i.danno = 1; } if (ids.has('dhaur')) i.att = 1 + Math.floor(Math.random() * 2); if (ids.has('thar')) i.att = 1 + Math.floor(Math.random() * 3); if (ids.has('hotaug')) i.att = 1 + Math.floor(Math.random() * 6); if (ids.has('morkath')) i.attPerBersaglio = true;
  if (ids.has('thakkua')) i.tes = 1; if (ids.has('ozoog')) { const x = Math.floor(Math.random() * 6) + 1; i.immuneIncantesimi = [...i.immuneIncantesimi, ...(x <= 2 ? ['Palla di Fuoco'] : x <= 4 ? ['Fulmine Magico'] : x === 6 ? ['Fulmine Magico', 'Palla di Fuoco'] : [])]; }
  G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); log(`Blasfemo: ${v.blasf.nome} (${v.blasf.titolo}). Posizione segnata sulla mappa: persistente finché non è ucciso.`); modificato('party');
}
export async function ritornoACasa() {
  const d = sp(), g = gruppo(); const x = await dado('Mostri erranti al ritorno (1)'); if (x.totale === 1) { const m = await G.monstroErrante(); G.avviaIncontro(m, G.tileById(adv().stanzaCorrente)); return; }
  const L = Math.max(0, ...g.map(e => e.follia || 0)) + g.filter(e => e.classe === 'demonologo').length;
  if (L === 0) { log('Nessuno ha follia: il portale è ancora aperto (successo automatico).'); d.portale = 'aperto'; return modificato(); }
  const r = await tiraG(`Ritorno a casa (livello ${L})`); if (r.tot >= L) { d.portale = 'aperto'; log(`Il portale è aperto (${r.tot} contro ${L}): si torna nel mondo reale.`); } else { d.portale = 'chiuso'; log(`Il portale si è richiuso (${r.tot} contro ${L}): serve un altro portale (1d6=6 a ogni nuovo esagono, o 2d6 esagoni in direzione casuale).`); }
  modificato();
}
export async function riportaFuori() {
  const s = sp(); let tot = 0; for (let k = 0; k < s.catturati; k++) { let q = 0, x; do { x = (await tira('1d6', 'Ricompensa catturato')).totale; q += x; } while (x === 6); tot += Math.max(0, q - 7); }
  const e = gruppo()[0]; if (e) e.oro = (e.oro || 0) + tot; log(`${s.catturati} catturati riportati fuori: ${tot} p.o.${s.catturati >= 1 ? ' Tiro di redenzione: ' + ((await tira('1d6', 'Redenzione')).totale < s.catturati ? 'riuscito, -1 follia a tutti.' : 'fallito.') : ''}`);
  if (s.catturati && (await tira('1d6', 'Redenzione (controllo)')).totale < s.catturati) gruppo().forEach(h2 => (h2.follia > 0 ? K.follia(h2, -1) : null));
  s.catturati = 0; if (s.obiettivo && !s.obiettivo.fatto) { /* manuale */ } modificato('party');
}

// ---- Scoperte (27) e luoghi unici (7) ----
export async function scoperta(n) {
  const sc = D().esplorazione.scoperte.find(x => x.numero === n); if (!sc) return;
  const cu = cp(), tutti = gruppo(), tg = tutti[0];
  log(`Scoperta ${n}: ${sc.nome} – ${sc.sintesi}`);
  switch (n) {
    case 1: if (tg) { const L = (await tira('1d3+6', 'Livello obelisco')).totale, r = await C.dE(tg, 'Obelisco'), tot = r.totale + bonusCl(tg, { demonologo: 'L', mago: '1/2L' }); if (tot >= L) await G.aggiungiIndizio(tg); else C.perdiPV(tg, L - tot, 'obelisco'); } break;
    case 2: case 5: case 13: for (const e of (n === 2 ? tutti.slice(0, 1) : tutti)) { const L = n === 2 ? 7 : n === 13 ? 7 : 7; const r = await tiraG(`Furtività di ${e.nome} (L${L})`, ['furfante'].includes(e.classe) ? e.livello : e.classe === 'mezzuomo' ? mezzo(e) : 0); log(r.tot >= L ? 'Riesce.' : 'Fallisce: attacco di sorpresa.'); } break;
    case 4: { const x = await dado('Fuga dai demoni (1-2 ti raggiungono)'); log(x.totale <= 2 ? 'Ti raggiungono nel sonno: attacco di sorpresa.' : 'Incontro evitato.'); break; }
    case 6: case 7: await blasfemo(false); if (n === 7) await mostroExtra('o-paladina-ostile'); break;
    case 8: await consumaGiorno(); break;
    case 9: for (const e of tutti) { let L = (await tira('1d3+4', 'Livello corrente')).totale, f = 0; while (f < 6 && e.stato === 'ok' && !(await C.salva(e, L + Math.max(0, f - 1), bonusCl(e, { barbaro: 1, mezzuomo: -1, nano: -1 }), 'Piena'))) { f++; C.perdiPV(e, 1, 'piena'); } } break;
    case 10: for (let k = 0; k < 2; k++) log(`Trappola: ${await G.trappola()}`); await mostroExtra('o-custode-ombre'); break;
    case 11: if (tg && (await C.salva(tg, 6, 0, 'Carcassa del colosso'))) log(await tesoro(-1)); else if (tg) { const v = casuale(tutti); const q = Math.max(0, (await tira('2d6-8', 'Caduta')).totale); if (q) C.perdiPV(v, q, 'caduta nel crepaccio'); } break;
    case 12: await mostroExtra('o-arcimedusa'); break;
    case 14: { const x = await dado('Rovine (1-2 trappola, 3-4 tesori, 5-6 due tiri su Nemici diabolici)'); log(x.totale <= 2 ? await G.trappola() : x.totale <= 4 ? await tesoro(0) : await tesoro(-1) + ' ' + await tesoro(-1)); break; }
    case 16: { const x = await dado('Il padrone ritorna? (5-6)'); if (x.totale >= 5) { const v = listaMostri('boss')[(await tira('1d3', 'Boss')).totale - 1]; const q = await risolviVoce(v), i = creaIncontro('boss', q, 1); await postCrea(i, v); G.avviaIncontro(i, null); } else tutti.forEach(e => { e.pv = Math.min(e.pvMax, e.pv + 1); }); break; }
    case 17: await mostroExtra('o-idolo-ossidiana'); break;
    case 18: { const n2 = (await tira('1d3+1', 'Avventurieri')).totale; const q = await risolviVoce(trovaVoce('o-avventurieri-nemici')); const i = creaIncontro('seguaci', { ...q, id: 'o-avv-nemici', nome: 'Avventurieri nemici', pv: 8, reazioni: [[1, 6, 'combatte']] }, n2); G.avviaIncontro(i, null); break; }
    case 19: { const x = await dado('Unire le forze? (4-6)'); log(x.totale >= 4 ? 'Propongono di unire le forze: alleati LIV 1d3+4, 1 PV per livello (a mano).' : 'Obiettivi diversi: usa la tabella reazioni della Scoperta.'); break; }
    case 20: if (tg) await risucchia(tg); break;
    case 21: log('Il divoratore del tempo è gestito in automatico durante il combattimento.'); break;
    case 27: log('Con un avatar dimenticato in campo le armi demoniache attaccano i possessori (a mano).'); break;
  }
  if (!cu.scoperte.includes(n)) cu.scoperte.push(n);
  modificato('party');
}
export async function luogo(num) {
  const l = D().esplorazione.luoghi.find(x => x.numero === num); if (!l) return; const cu = cp();
  if (!cu.luoghi.includes(num)) cu.luoghi.push(num);
  log(`Luogo ${num}: ${l.nome} – ${l.regola}`);
  if (num === 'V') for (const e of gruppo()) { const r = await dado(`Fosse del Dolore: follia di ${e.nome}`); if (e.classe !== 'demonologo' && r.totale + 1 > (e.follia || 0)) K.follia(e, 1); const rr = await C.dE(e, `Difesa di ${e.nome} (L7)`); if (rr.naturale === 1 || rr.totale <= 7 && !C.esplode(e, rr)) C.perdiPV(e, Math.max(1, 7 - rr.totale), 'Fosse del Dolore'); }
  if (num === 'VII') await guf();
  if (num === 'VI') { sp().tempio = false; log('Dungeon a 3 livelli: usa «Nuova stanza» con il set Aldilà; boss finale al 3° livello: Colui che piange nell’oscurità (Strumenti › Aldilà › Boss del luogo VI).'); }
  modificato('party');
}

// =============================================================
//  CARTA «ALDILÀ» DEGLI STRUMENTI
// =============================================================
export function carta(btn) {
  if (!aldilaAttivo()) return null;
  const d = sp(), cu = cp(), t = diff(d.terreno), p = x => h('p', { class: 'hint' }, x), bt = [];
  const info = [`Giorno ${d.giorno} · terreno: ${t?.nome || 'non impostato'}${d.giorniQui ? ` (${d.giorniQui} gg qui)` : ''} · razioni ${d.razioni} · ϰ ${d.necro} · catturati ${d.catturati} · cubi anima ${cu.cubi} · fuorilegge ${cu.fuorilegge} · rivelazioni ${cu.rivelazioni}`];
  const ob = d.obiettivo; const lista = [];
  if (ob) lista.push(p(`Obiettivo: ${ob.nome} – ${ob.testo} (secondario: ${ob.secondario}) ${ob.fatto ? '✓' : ''}`));
  if (cu.blasfemi.length) lista.push(p(`Blasfemi: ${cu.blasfemi.map(b => `${b.nome}${b.vivo === false ? ` (torna in ${b.tornaIn} gg)` : ''}`).join('; ')}`));
  if (cu.luoghi.length) lista.push(p(`Luoghi visitati: ${cu.luoghi.join(', ')} · Scoperte fatte: ${cu.scoperte.join(', ') || 'nessuna'}`));
  if (cu.patto) lista.push(p(`Patto demoniaco attivo con ${cu.patto.da}: uccidi e riporta la prima creatura (altrimenti niente resurrezione).`));
  const ct = (txt, f, cls = '', ex = {}) => bt.push(btn(txt, async () => { await f(); modificato('party'); }, cls, ex));
  ct('Nuova spedizione (obiettivo, razioni)', nuovaSpedizione, 'primary');
  ct('Terreno (d66)', terrenoCasuale); ct('Terreno: scegli', impostaTerreno);
  ct('Giornata di cammino', () => giornata(), 'primary'); ct('Giornata in campo (riposo)', () => giornata({ campo: true }));
  ct('Lascia l’esagono (orientamento)', orientamento); ct('Incontro del terreno', () => incontroTerreno());
  ct('Fortezza', fortezza); ct('Mercanti', () => mercanti()); ct('Dicerie', dicerie); ct('Il Guf', guf);
  ct('Blasfemo nuovo', () => blasfemo(false)); ct('Blasfemo persistente', () => blasfemo(true), '', { disabled: !cu.blasfemi.some(b => b.vivo !== false) });
  ct('Tempio (1d6+4 stanze)', async () => { d.tempio = true; d.seguaciSub = null; const n = (await tira('1d6+4', 'Stanze del tempio')).totale; log(`Tempio: ${n} stanze con le tabelle dell'Aldilà (usa «Nuova stanza»); boss finale = blasfemo, oro = strumenti occulti (1 ϰ per p.o.).`); });
  ct('Ritorno a casa', ritornoACasa); ct('Riporta fuori i catturati', riportaFuori, '', { disabled: !d.catturati });
  ct('Recinto degli schiavi (catturato)', async () => { const e = await K.eroeScelto('Chi è nel recinto?', x => x.stato === 'prigioniero'); if (e) await recinto(e); });
  ct('Usa un luogo unico…', async () => { const k = await scelta('Luogo unico', 'Non leggere le descrizioni in anticipo.', D().esplorazione.luoghi.map(l => [l.numero, `${l.numero} – ${l.nome}`])); if (k) await luogo(k); });
  ct('Scoperta n…', async () => { const k = await scelta('Scoperta', 'Quale paragrafo?', D().esplorazione.scoperte.map(s => [s.numero, `${s.numero}. ${s.nome}`])); if (k) await scoperta(k); });
  ct('Boss del luogo VI', () => mostroExtra('o-colui-che-piange'));
  ct('Cerca una magione oscura (3 rivelazioni)', async () => { if (cu.rivelazioni < 3) return toast('Servono 3 rivelazioni.', 'warn'); cu.rivelazioni -= 3; const a = (await tira('1d6+2', 'Distanza')).totale; log(`Magione oscura a ${a} esagoni in direzione casuale.`); }, '', { disabled: cu.rivelazioni < 3 });
  ct('+1 razione', () => { d.razioni++; }, 'mini'); ct('−1 razione', () => { d.razioni = Math.max(0, d.razioni - 1); }, 'mini');
  ct('+1 ϰ', () => { d.necro++; }, 'mini'); ct('−1 ϰ', () => { d.necro = Math.max(0, d.necro - 1); }, 'mini');
  ct('+1 cubo anima', () => { cu.cubi++; }, 'mini'); ct('−1 cubo', () => { cu.cubi = Math.max(0, cu.cubi - 1); }, 'mini');
  ct('+1 catturato', () => { d.catturati++; }, 'mini'); ct('−1 catturato', () => { d.catturati = Math.max(0, d.catturati - 1); }, 'mini');
  ct('Cubo anima: usa la Bilancia (6 cubi)', async () => { if (cu.cubi < 6) return toast('Servono 6 cubi.', 'warn'); const e = await K.eroeScelto('Chi risorge?', x => x.stato === 'morto'); if (!e) return; cu.cubi -= 6; e.stato = 'ok'; e.pv = e.pvMax; K.follia(e, 1); e.folliaPerm = (e.folliaPerm || 0) + 1; log(`${e.nome} risorge con la Bilancia (+1 follia permanente).`); }, '', { disabled: !cu.bilancia });
  ct('Clessidra: -1 follia, -2d6 PV', async () => { const e = await K.eroeScelto('Chi la usa?', x => x.stato === 'ok' && x.follia > 0); if (!e) return; const q = (await tira('2d6', 'PV')).totale; K.follia(e, -1); C.perdiPV(e, q, 'Clessidra'); }, '', { disabled: !cu.clessidra });
  ct('Recupera i teletrasportati/rapiti', () => { S.party.eroi.filter(e => e.catturatoDa?.aldila && e.stato === 'prigioniero' && /Fosse|necro/.test(e.catturatoDa.nome)).forEach(e => { e.stato = 'ok'; e.catturatoDa = null; e.pv = Math.max(1, e.pv); }); });
  return h('div', { class: 'card' }, h('h3', {}, 'Aldilà: esplorazione a esagoni'), p(info[0]), ...lista, h('small', { class: 'hint' }, 'La mappa a esagoni del manuale è solo un’immagine e non è codificata: scegli tu l’esagono d’arrivo e il terreno; gli strumenti tirano, applicano gli effetti e scrivono nel registro.'), h('div', { class: 'tools' }, ...bt));
}
