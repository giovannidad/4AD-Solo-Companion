// Supplemento «Contro le Profondità Dimenticate» (livelli 10-19): gradi eroico e leggendario, mostri con formule su LMP e GR,
// tabelle del dungeon, abilità e incantesimi eroici, fiumi, rovine, tumuli, Cittadelle e idoli (questi ultimi come strumenti guidati).
// Lo stato di gioco sta tutto in S.adv e S.party (eroi, avventura, fiume, sezione, cittadella): qui ci sono solo le regole.
import { R, S, log, modificato, eroiVivi, eroiAttivi, eroePerId, ordineMarcia, livelloMax } from './state.js';
import { dado, tira, dadoN, d66 } from './dice.js';
import { riga, creaIncontro, profonditaAttiva, gradoDi, grNumero, profiloDado, haAbilita, oggettoEffetto, nomeClasse, modAttacco, armaDi } from './rules.js';
import { h, toast, scelta, sceltaMultipla, confirmBox, uid } from './util.js';
import * as G from './game.js';
import * as C from './combat.js';
import * as K from './caos.js';
import * as A from './abisso.js';

const D = () => R.profondita;
const adv = () => S.adv;
const casuale = arr => arr[Math.floor(Math.random() * arr.length)];
const mezzo = e => Math.floor((e.livello || 0) / 2);
const GR = () => grNumero();
const vivi = () => eroiVivi().filter(e => e.stato === 'ok');
const oroGruppo = () => eroiVivi().reduce((a, e) => a + (e.oro || 0), 0);
function prendiOro(q, da = eroiVivi()) { let resto = q; for (const x of [...da].sort((a, b) => (b.oro || 0) - (a.oro || 0))) { const k = Math.min(x.oro || 0, resto); x.oro = (x.oro || 0) - k; resto -= k; if (!resto) break; } return q - resto; }
const bottino = o => { (adv().bottino = adv().bottino || []).push({ id: uid(), ...o }); };
const spec = id => D().mostri.creatureExtra.find(c => c.id === id);
const nota = t => (C.inc() ? C.nota(t) : log(t));
const d10 = label => dadoN(10, label);
/** Tira un'espressione come «3d6» o «10+2d6». */
async function tiraExpr(expr, label) { const m = /^(\d+)\+(.+)$/.exec(expr); return m ? +m[1] + (await tira(m[2], label)).totale : (await tira(expr, label)).totale; }

// =============================================================
//  GRADI: eroico (d10) e leggendario (d12), passaggio di grado, tiri ES
// =============================================================
export const gradoAlto = e => ['eroico', 'leggendario'].includes(gradoDi(e));
/** Etichetta per le schede compatte (vuota per i gradi base ed esperto). */
export const etichettaGrado = e => { const g = gradoDi(e); return g === 'eroico' ? 'eroico d10' : g === 'leggendario' ? 'leggendario d12' : ''; };
/** Grado delle tabelle da usare (tesori magici, incantesimi a caso): leggendario se qualcuno lo è, altrimenti eroico. */
export const gradoGruppo = () => (vivi().some(e => gradoDi(e) === 'leggendario') ? 'leggendario' : 'eroico');
/** I personaggi di livello 10 (o di livello 9 già eroici) sono adatti al supplemento. */
export const adatto = e => e.livello >= 10 || (e.livello === 9 && gradoDi(e) === 'eroico');
export const prontiProfondita = lista => lista.length > 0 && lista.every(adatto);

const PASSI = { eroico: { da: 'esperto', livello: 9, es: 2, po: 1000 }, leggendario: { da: 'eroico', livello: 14, es: 3, po: 2000 } };
const candidati = g => eroiVivi().filter(e => !e.merc && !e.png && e.stato !== 'prigioniero' && gradoDi(e) === PASSI[g].da && e.livello >= PASSI[g].livello);
const esLiberi = () => (adv().esPendenti || []).filter(x => !x.soloEroe && !x.soloClasse);
/** Passaggio di grado: azione esplicita tra due avventure. Costo: tiri ES messi da parte (non si tirano) e oro, pagati insieme per tutti. */
export async function passaDiGrado() {
  if (adv().attiva) return toast('Il passaggio di grado si fa tra due avventure (il grado leggendario fuori da un dungeon).', 'warn');
  const opz = Object.keys(PASSI).filter(g => candidati(g).length).map(g => [g, `Passa al grado ${g}`, `${candidati(g).length} eroi pronti: ${PASSI[g].es} tiri ES e ${PASSI[g].po} p.o. a testa`]);
  if (!opz.length) return toast('Nessun eroe è pronto: serve un eroe esperto di livello 9 (grado eroico) o un eroe di livello 14 (grado leggendario).', 'warn');
  const g = opz.length === 1 ? opz[0][0] : await scelta('Passare di grado', 'Il livello resta lo stesso; cambia solo il dado. Quale passaggio?', opz);
  if (!g) return;
  const p = PASSI[g], lista = candidati(g);
  const ids = await sceltaMultipla(`Grado ${g}`, `Servono ${p.es} tiri ES (messi da parte, non si tirano) e ${p.po} p.o. a testa, in un’unica soluzione; il manuale consiglia di addestrare tutti insieme. Tiri ES disponibili: ${esLiberi().length}; oro del gruppo: ${oroGruppo()} p.o.`, lista.map(e => [e.id, `${e.nome} (${nomeClasse(e)} ${e.livello}°)`]));
  const eroi = ids.map(eroePerId).filter(Boolean); if (!eroi.length) return;
  const tiri = eroi.length * p.es, oro = eroi.length * p.po;
  if (esLiberi().length < tiri) return toast(`Servono ${tiri} tiri ES non tirati (ne hai ${esLiberi().length}): mettili da parte invece di tirarli.`, 'warn');
  if (oroGruppo() < oro) return toast(`Servono ${oro} p.o. (il gruppo ne ha ${oroGruppo()}).`, 'warn');
  if (!(await confirmBox(`${eroi.map(e => e.nome).join(', ')} passa${eroi.length > 1 ? 'no' : ''} al grado ${g} (${g === 'eroico' ? 'd10, esplosivo con 8+' : 'd12, esplosivo con 9+'}): si spendono ${tiri} tiri ES e ${oro} p.o. Confermi?`))) return;
  let daTogliere = tiri; adv().esPendenti = (adv().esPendenti || []).filter(x => { if (daTogliere > 0 && !x.soloEroe && !x.soloClasse) { daTogliere--; return false; } return true; });
  prendiOro(oro); eroi.forEach(e => { e.grado = g; });
  log(`Grado ${g}: ${eroi.map(e => e.nome).join(', ')} (${tiri} tiri ES e ${oro} p.o. spesi).`); modificato('party');
}

// ---- tiri ES: dado del grado e bonus delle abilità ----
const ES_TAB = { eroico: { livello: 4, esperta: 5, eroica: 4 }, leggendario: { livello: 8, esperta: 10, eroica: 9, leggendaria: 8 } };
/** Dado e bonus del tiro ES per eroi di grado eroico o leggendario: 1d10+4 / 1d12+8 per salire di livello; le abilità e gli incantesimi usano la colonna del loro grado. */
export function profiloES(e, posta = { tipo: 'livello' }) {
  const g = gradoDi(e), p = profiloDado(e), t = ES_TAB[g];
  const col = posta.tipo === 'livello' ? 'livello' : posta.tipo === 'incantesimo-p' ? (posta.grado === 'leggendario' ? 'leggendaria' : 'eroica') : (posta.classe || 'esperta');
  return { facce: p.facce, soglia: p.soglia, bonus: t[col] ?? t.eroica, d8: false };
}
/** Bonus al tiro ES di Ambizione (solo salire di livello) e di Addestramento mirato (solo abilità): le versioni leggendarie non si cumulano. */
export function bonusES(e, posta) {
  if (!profonditaAttiva()) return 0;
  if (posta.tipo === 'livello') return forza(e, 'p-ambizione')?.bonusES?.livello || 0;
  if (posta.tipo === 'abilita') return forza(e, 'p-add-mirato')?.bonusES?.abilita || 0;
  return 0;
}
/** Un tiro ES di livello non è consentito al 9° livello senza il grado eroico, né al 14° senza il leggendario. */
export function bloccoGrado(e) {
  if (!profonditaAttiva()) return false;
  return (e.livello === 9 && gradoDi(e) !== 'eroico' && gradoDi(e) !== 'leggendario') || (e.livello === 14 && gradoDi(e) !== 'leggendario');
}

// =============================================================
//  ABILITÀ EROICHE E LEGGENDARIE
// =============================================================
const LEGG = () => Object.fromEntries(D().abilita.filter(a => a.grado === 'leggendario' && a.richiede).map(a => [a.richiede, a.id]));
const abDati = id => D().abilita.find(a => a.id === id);
/** Versione attiva di un'abilità: la leggendaria sostituisce l'eroica (i bonus non si cumulano). */
export function forza(e, base) { const l = LEGG()[base]; if (l && haAbilita(e, l)) return abDati(l); return haAbilita(e, base) ? abDati(base) : null; }
export const furieExtra = e => forza(e, 'p-ira-berserker')?.furieExtra || 0;
/** Catalogo per la scheda: tutte le abilità del supplemento con le classi che le possono imparare. */
export const catalogoAbilita = () => D().abilita.map(a => ({ id: a.id, nome: a.nome, classi: a.qualsiasiClasse ? Object.keys(R.classi) : a.classi, testo: a.effetto, grado: a.grado }));
const gradoAbilitaOk = (e, a) => { const g = gradoDi(e); return a.grado === 'leggendario' ? g === 'leggendario' : g === 'eroico' || g === 'leggendario'; };
/** Abilità eroiche/leggendarie che l'eroe può imparare ora (classe, grado, versione precedente). */
export const abilitaDisponibili = e => D().abilita.filter(a => (a.qualsiasiClasse || a.classi.includes(e.classe)) && gradoAbilitaOk(e, a) && !haAbilita(e, a.id) && (!a.richiede || haAbilita(e, a.richiede)) && (!a.soloSenzaBonusAttaccoClasse || ['mago', 'furfante', 'mezzuomo', 'veterano'].includes(e.classe)));   // gli addestramenti solo per chi non ha bonus di livello all'attacco

// =============================================================
//  INCANTESIMI EROICI E LEGGENDARI: memoria, fonti, apprendimento
// =============================================================
export const NOMI_INCANTESIMI = () => D().incantesimi.map(s => s.nome);
const incP = nome => D().incantesimi.find(s => s.nome === nome);
/** Spazio occupato in memoria: 2 per un incantesimo eroico, 3 per un leggendario. */
export const costoMemoria = nome => incP(nome)?.costoMemoria || 1;
/** Livelli «in più» ai fini degli incantesimi memorizzabili (Memoria prodigiosa e leggendaria). */
export const livelloMemoria = e => (profonditaAttiva() ? forza(e, 'p-memoria-prodigiosa')?.modLivelloIncantesimi || 0 : 0);
/** Livelli «in più» ai fini della follia (Mente stabile). */
export const livelloFollia = e => (profonditaAttiva() ? forza(e, 'p-mente-stabile')?.modLivelloFollia || 0 : 0);
export function incantesimiACaso() {
  return D().tabelle[gradoGruppo() === 'leggendario' ? 'incantesimoLeggendarioCaso' : 'incantesimoEroicoCaso'].map(x => x.nome);
}
export const puoImparare = (e, s) => s.classi.includes(e.classe) && !(s.nonImparabileDa || []).includes(e.classe) && (s.grado === 'eroico' ? gradoAlto(e) : gradoDi(e) === 'leggendario');
/** Fonti di incantesimi eroici/leggendari: pergamene nello zaino e iscrizioni trovate nell'avventura. */
function fontiIncantesimi(e) {
  const out = [];
  for (const x of eroiVivi()) for (const o of x.oggetti || []) if (o.tipo === 'pergamena' && incP(o.incantesimo)) out.push({ tipo: 'pergamena', eroeId: x.id, oggetto: o, nome: o.incantesimo });
  for (const k of adv().iscrizioni || []) out.push({ tipo: 'iscrizione', id: k.id, nome: k.nome });
  return out.filter(f => { const s = incP(f.nome); return puoImparare(e, s) && !(e.avanzati || []).includes(f.nome); });
}
/** Pannello di scelta della posta del tiro ES per eroi eroici e leggendari. */
export async function sceltaPostaES(e, puoSalire = true) {
  if (!gradoAlto(e)) return A.sceltaPostaES(e, puoSalire);
  const mie = e.abilita || [], esperte = A.abilitaPerClasse(e).filter(a => a.id === 'resistente' || !mie.some(x => x.id === a.id));
  const profA = abilitaDisponibili(e), fonti = fontiIncantesimi(e);
  const avanzati = ['mago', 'elfo'].includes(e.classe) ? A.NOMI_AVANZATI().filter(n => !(e.avanzati || []).includes(n)) : [];
  const opz = puoSalire ? [['livello', 'Salire di livello', `${e.livello}° → ${e.livello + 1}°`]] : [];
  if (esperte.length) opz.push(['esperta', 'Imparare un’abilità esperta', `${esperte.length} disponibili (tiro ES a +${ES_TAB[gradoDi(e)].esperta})`]);
  if (profA.some(a => a.grado === 'eroico')) opz.push(['eroica', 'Imparare un’abilità eroica', `${profA.filter(a => a.grado === 'eroico').length} disponibili (+${ES_TAB[gradoDi(e)].eroica})`]);
  if (profA.some(a => a.grado === 'leggendario')) opz.push(['leggendaria', 'Imparare un’abilità leggendaria', `${profA.filter(a => a.grado === 'leggendario').length} disponibili`]);
  if (avanzati.length) opz.push(['avanzato', 'Imparare un incantesimo avanzato (Abisso)', `${avanzati.length} disponibili`]);
  if (fonti.length) opz.push(['studia', 'Studiare un incantesimo eroico o leggendario', `${fonti.length} fonti (pergamene o iscrizioni); se fallisce la fonte è perduta`]);
  if (!opz.length) { toast('Nessuna scelta possibile con questo tiro.', 'warn'); return null; }
  const k = opz.length === 1 && opz[0][0] === 'livello' ? 'livello' : await scelta(`Tiro ES di ${e.nome}`, 'Che cosa tenti con questo tiro? (la scelta si fa prima di tirare)', opz);
  if (!k) return null;
  if (k === 'livello') return { tipo: 'livello' };
  if (k === 'avanzato') { const n = await scelta('Incantesimo avanzato', 'Quale?', avanzati.map(x => [x, x])); return n ? { tipo: 'incantesimo', nome: n } : null; }
  if (k === 'studia') {
    const i = await scelta('Studiare un incantesimo', 'Quale fonte studi? (ogni incantesimo eroico occupa 2 posti di memoria, ogni leggendario 3)', fonti.map((f, n) => [n, `${f.nome} (${incP(f.nome).grado})`, f.tipo === 'pergamena' ? 'Pergamena: lo studio la cancella' : 'Iscrizione: resta leggibile per altri maghi']));
    return i == null ? null : { tipo: 'incantesimo-p', nome: fonti[i].nome, grado: incP(fonti[i].nome).grado, fonte: { tipo: fonti[i].tipo, eroeId: fonti[i].eroeId, id: fonti[i].id } };
  }
  const lista = k === 'esperta' ? esperte : profA.filter(a => a.grado === (k === 'eroica' ? 'eroico' : 'leggendario'));
  const id = await scelta('Abilità', 'Quale abilità vuoi imparare?', lista.map(a => [a.id, a.nome, a.effetto]));
  if (!id) return null;
  const a = lista.find(x => x.id === id);
  if (k === 'esperta') { const voce = await A.sceltaAbilita(a); return voce ? { tipo: 'abilita', voce, classe: 'esperta' } : null; }
  const voce = { id };
  if (id === 'p-colpo-maestro') { const arma = await scelta('Colpo da maestro', 'Con quale arma?', (e.armi || []).map(x => [x, R.equipaggiamento.armi.find(y => y.id === x)?.nome || x])); if (!arma) return null; voce.arma = arma; }
  return { tipo: 'abilita', voce, classe: k === 'eroica' ? 'eroica' : 'leggendaria' };
}
export function applicaPosta(e, posta) { A.applicaPosta(e, posta); }
/** Dopo il tiro ES per studiare un incantesimo: se riesce entra nel grimorio; la pergamena è comunque cancellata, l'iscrizione solo se il tiro fallisce. */
export function fineStudio(e, posta, ok) {
  const f = posta.fonte;
  if (f.tipo === 'pergamena') { const x = eroePerId(f.eroeId); if (x) { const k = (x.oggetti || []).findIndex(o => o.tipo === 'pergamena' && o.incantesimo === posta.nome); if (k >= 0) x.oggetti.splice(k, 1); } }
  else if (!ok) adv().iscrizioni = (adv().iscrizioni || []).filter(k => k.id !== f.id);
  if (ok) { (e.avanzati = e.avanzati || []).push(posta.nome); log(`${e.nome} impara l’incantesimo ${incP(posta.nome).grado} «${posta.nome}» (occupa ${costoMemoria(posta.nome)} posti di memoria).`); }
  else log(`${e.nome} non riesce a imparare «${posta.nome}»: la fonte è ${f.tipo === 'pergamena' ? 'distrutta' : 'inutilizzabile'}.`);
  modificato('party');
}
export const aggiungiIscrizione = (nome, fonte) => { (adv().iscrizioni = adv().iscrizioni || []).push({ id: uid(), nome, fonte }); log(`Iscrizione trovata: ${nome} (un mago la può studiare con un tiro ES, senza cancellarla).`); };

// =============================================================
//  BONUS AI TIRI (attacco, difesa, salvezza) E DADI
// =============================================================
const frazione = (e, f) => (f === 'L' ? e.livello : f === '1/2L' ? mezzo(e) : f === '1/3L' ? Math.floor(e.livello / 3) : typeof f === 'number' ? f : 0);
const SALVA_COME = { salvaComeChierico: ['chierico'], salvaComeMago: ['mago'] };
/** Bonus di un tiro salvezza descritto come {classe: 'L'|'1/2L'|n, altri, tutti}: «tutti» si somma sempre, il bonus di classe sostituisce «altri». */
export function bonusClasse(e, s = {}) {
  let tot = s.tutti !== undefined ? frazione(e, s.tutti) : 0;
  const chiavi = Object.keys(s).filter(k => k === e.classe || (SALVA_COME[k] || []).includes(e.classe));
  if (chiavi.length) tot += Math.max(...chiavi.map(k => frazione(e, s[k]))); else if (s.altri !== undefined) tot += frazione(e, s.altri);
  if (s.armaturaPesante && e.armatura === 'pesante') tot += s.armaturaPesante;
  return tot;
}
const salvaP = (e, liv, s, label, extra = 0) => C.salva(e, liv, bonusClasse(e, s) + extra, label);
const sulFiume = () => (adv().fiume?.sulFiume ? adv().fiume : null);
const MAGIE_DANNO = ['Palla di Fuoco', 'Fulmine Magico', 'Fuoco della Verità', 'Fornace dell’Amuleto', 'Fornace dell\'Amuleto', 'Fulmine Accecante', 'Scarica Oculare', 'Distruggi Aberranti', 'Dardo Infallibile', 'Pugno Arcano'];
const SENZA_ADDESTRAMENTO = ['mago', 'mezzuomo', 'arlecchino'];
/** Modificatore di probabilità di esplosione dei tiri di attacco: armi perfette, Colpo da maestro (cumulabili), Magia esplosiva per gli incantesimi. */
export function espAttacco(e, arma, incantesimo = false) {
  if (!profonditaAttiva()) return 0;
  if (incantesimo) return forza(e, 'p-magia-esplosiva') ? 1 : 0;
  return ((e.armiPerfette || []).includes(arma?.id) ? 1 : 0) + (abDati('p-colpo-maestro') && (e.abilita || []).some(a => a.id === 'p-colpo-maestro' && a.arma === arma?.id) ? 1 : 0);
}
export const espDifesa = e => (profonditaAttiva() && e.armaturaPerfetta ? 1 : 0);

/** Bonus e malus d'attacco del supplemento (abilità, oggetti leggendari, poteri dei mostri, fiumi). `parti` serve a sapere se la classe dà già un bonus di livello. */
export function attacco(e, ctx, bers, arma, add, parti) {
  const mischia = !arma?.lancio && !ctx.incantesimo, distanza = !!arma?.lancio && !ctx.incantesimo, gr = GR(), pf = bers.pf || {};
  if (!ctx.incantesimo) {
    if (!parti.some(p => /livello/i.test(p[0]))) { const ad = forza(e, mischia ? 'p-add-marziale' : 'p-add-balistico'); if (ad) add(ad.nome, frazione(e, ad.bonusAttaccoFraz)); }   // solo se la classe non dà già un bonus di livello
    if (mischia && arma?.categoria === 'leggera' && arma.tipo === 'taglio' && arma.mod < 0 && forza(e, 'p-maestro-coltello')) add('Maestro di coltello', -arma.mod);
    if (arma && (e.armiLeggendarie || []).includes(arma.id)) add('Arma leggendaria', gr);
    if (distanza && pf.modAttaccoADistanzaContro) add('Colpita dalla distanza', pf.modAttaccoADistanzaContro);
    if (distanza && e.dichiara?.precisione) add('Precisione eroica', forza(e, 'p-precisione-eroica')?.modAttaccoDistanza || 0);
    if (distanza && e.dichiara?.frecce) add('Frecce leggendarie', gr);
    if (mischia && e.dichiara?.risposta && bers.danniSubiti?.[e.id]) add('Risposta', (forza(e, 'p-risposta')?.moltDanniSubiti || 2) * bers.danniSubiti[e.id]);
    if (mischia && bers.bloccatoMod) add('Bloccato dal Pugno Arcano', bers.bloccatoMod);
    if (bers.distrazioni) add('Distrazioni illusorie', ['furfante', 'assassino'].includes(e.classe) ? e.livello : SENZA_ADDESTRAMENTO.includes(e.classe) ? mezzo(e) : 0);
    if (arma?.id === 'arco' && adv().alluvione?.stanze > 0) add('Alluvione (archi bagnati)', -2);
    if (oggettoEffetto(e, /flagellatore delle profondità/i) && ['mago', 'veterano'].includes(e.classe) && arma?.categoria === 'leggera' && arma.tipo === 'contundente' && (bers.pf || /profond/i.test(bers.nome || ''))) add('Flagellatore delle profondità', 4 + (arma.mod < 0 ? -arma.mod : 0));   // con un randello leggero in mano: +4 e ignora il -1
  } else {
    if (MAGIE_DANNO.includes(ctx.nomeIncantesimo)) { const m = forza(e, 'p-mira-arcana'); if (m) add(m.nome, m.modAttaccoIncantesimi); }
    if (e.bastoneLeggendario || oggettoEffetto(e, /bastone da mago leggendario/i)) add('Bastone da mago leggendario', gr);
    if (/fulmin/i.test(ctx.nomeIncantesimo || '') && pf.vulnerabileFulmine) add('Vulnerabile al fulmine', gr);
    if (bers.aiutoLancio === e.id) add('Aiuto per lanciare incantesimi', 3);
    if (e.malusIncantesimi) add('Veleno delle piovre', -e.malusIncantesimi);
  }
  if (e.malusAtt) add('Veleno degli uomini lucertola', -e.malusAtt);
  if (e.malusAttGR) add('Veleno degli uomini rana', -e.malusAttGR);
  if (sulFiume()?.id === 'p-rivo-morte') add('Rivo della Morte', 1);
}
/** Difesa: Schivata eroica (non per chi aggiunge già il livello), oggetti leggendari, fiumi. */
export function difesa(e, ctx, add) {
  const gr = GR(), sch = forza(e, 'p-schivata-eroica');
  if (sch && !['furfante', 'arlecchino'].includes(e.classe)) add(sch.nome, sch.modDifesa);
  if (e.armaturaLeggendaria && e.armatura !== 'nessuna') add('Armatura leggendaria', gr);
  if (e.scudoLeggendario && e.scudo && !ctx.ignoraScudo && !ctx.sorpreso && !ctx.fuga) add('Scudo leggendario', gr);
  if (e.armatura === 'pesante' && oggettoEffetto(e, /guanti dell.ombra e del fulmine/i)) add('Guanti dell’ombra e del fulmine', 1);
  if (ctx.circolo) add('Circolo di protezione', ctx.circolo);
  if (e.muco) add('Muco corrosivo', -2);
  if (sulFiume()?.id === 'p-rivo-morte') add('Rivo della Morte', -1);
}
const DANNI_COND = /./;
/** Tiri salvezza: abilità di protezione, nuoto e arrampicata, oggetti leggendari. */
export function salvezza(e, L, inc, add) {
  const paura = /paura|terrore|orrore|fantasma/i.test(L), gr = GR();
  const cor = forza(e, 'p-coraggio-eroico'), dest = haAbilita(e, 'p-protetto-destino'), div = haAbilita(e, 'p-protetto-forze-divine');
  if (paura) { if (cor) add(cor.nome, cor.modTSPaura); if (div) add('Protetto dalle forze divine', 2); }
  else if (DANNI_COND.test(L)) { if (dest && div) add('Protetti dal destino e dalle forze divine', 4); else if (dest) add('Protetto dal destino', 2); else if (div) add('Protetto dalle forze divine', 2); }
  if (/nuot/i.test(L)) { const n = forza(e, 'p-nuotatore-eroico'); if (n) add(n.nome, n.modNuotare); if (oggettoEffetto(e, /veste del nuotatore/i)) add('Veste del nuotatore', 3); }
  if (/arrampic|scal/i.test(L)) { const n = forza(e, 'p-scalatore-eroico'); if (n) add(n.nome, n.modArrampicata); }
  if (oggettoEffetto(e, /amuleto leggendario/i) && !(inc && inc.stato !== 'finito' && inc.rm >= 15)) add('Amuleto leggendario', gr);
  if (/psichic/i.test(L) && e.bonusPsichico) add('Residui psichici già affrontati', 3);
  if (inc && inc.stato !== 'finito' && oggettoEffetto(e, /flagellatore delle profondità/i) && ['mago', 'veterano'].includes(e.classe) && (inc.pf || /profond/i.test(inc.nome || ''))) add('Flagellatore delle profondità', mezzo(e));
}

// =============================================================
//  MOSTRI: formule su LMP e GR, poteri, raffiche
// =============================================================
const valoreLmp = (base, mod) => (base === 'LMP' ? livelloMax() + (mod || 0) : base);
export const livMostro = v => valoreLmp(v.liv, v.livMod);
export function pvMostro(v) {
  let pv = valoreLmp(v.pv, v.pvMod);
  if (v.pvMinimo != null) pv = Math.max(pv, v.pvMinimo);
  if (v.pvTetto != null) pv = Math.min(pv, v.pvTetto);
  return pv;
}
const SPECIALI = ['raffica', 'rigenerazione', 'risorge', 'livSenzaFeriti', 'livAMetaPV', 'nonRiduceLivMetaPv', 'rimbalzoArmiNonMagiche', 'veleno', 'spore', 'livPerDueUccisi', 'uccisoGeneraRagni', 'fuocoAmico',
  'modAttaccoADistanzaContro', 'attaccoConcentrato', 'illusione', 'noEsplosioneFinoAMetaPV', 'primoAttaccoSeSorpresa', 'deviaColpiNonMagici', 'ignoraBonusScudi', 'ruggito', 'esplosionePsionica', 'rinforzi', 'muco',
  'immuneVeleno', 'immuneVista', 'immuneTuttiIncantesimi', 'eccezioneIncantesimo', 'effettoSeFugge', 'acquaSanta', 'vulnerabileFulmine', 'semi', 'odiaElfi', 'odiaFemmine', 'raggioCongelante', 'esplosioneForzaOscura',
  'modReazioniPerStregaUccisa', 'fugaSoloAbbandonandoTutto', 'nonCombatteSeNonAttaccato', 'servizio', 'abilitaBarcaiolo', 'rifiutaSeGruppoHaAltriElfi', 'tesOro', 'tesExtra', 'tesCristalli', 'tesIndizi', 'segretoCorrelato', 'categoria'];
/** Completa un incontro creato da una voce delle Profondità: danni su GR, attacchi dettagliati, RM, poteri (in `pf`). */
export function adattaMostro(inc, voce, maggiore) {
  const gr = GR(), dm = (d, f, m) => (f === 'GR' ? gr + (m || 0) : d ?? 1);
  inc.danno = dm(voce.danno, voce.dannoFormula, voce.dannoMod);
  if (voce.attacchiDettaglio) inc.dannoPerAttacco = voce.attacchiDettaglio.flatMap(a => Array(a.n).fill(dm(a.danno, a.dannoFormula, a.dannoMod)));
  if (voce.nonAttacca) { inc.att = 0; inc.nonAttacca = true; }
  if (voce.attPerBersaglio) { inc.attPerBersaglio = true; inc.attPerBersaglioN = voce.attPerBersaglioN || 1; }
  if (voce.orda) inc.ordaP = true;
  if (voce.rm) inc.rm = valoreLmp(voce.rm, voce.rmMod);
  if (voce.livAMetaPV) inc.livMetaPV = valoreLmp(voce.livAMetaPV.liv, voce.livAMetaPV.livMod);
  inc.pf = Object.fromEntries(SPECIALI.filter(k => voce[k] !== undefined).map(k => [k, voce[k]]));
  inc.pf.id = voce.id;
  // attacchi speciali che si aggiungono ogni turno: tolti dagli ATT normali
  const extraAtt = inc.bossFinale && maggiore ? 1 : 0;
  if (voce.esplosionePsionica || voce.raggioCongelante) inc.att = 1 + extraAtt;
  if (voce.semi) inc.att = 2 + extraAtt;
  if (voce.tesOro && !voce.tesExtra) inc.oroFisso = voce.tesOro;   // TES in monete: niente tabella dei tesori
  if (voce.id === 'p-uccello-agnas') { inc.tes = 0; inc.oroFisso = voce.tesOro; }
  if (voce.id === 'p-goblin-mutato-maggiore') inc.tes = 'NO';
  if (voce.risorge) inc.cadaveri = 0;
  if (voce.id === 'p-pedinatore-profondita' || voce.id === 'p-pedinatore-selvaggio') inc.noMorale = true;
  if (maggiore && sulFiume()?.id === 'p-rivo-serpe') { inc.liv++; inc.livBase++; inc.pf.serpe = true; }
  if (voce.id === 'p-stregone-elfo-oscuro') inc.modReazioni = -(adv().stregheUccise || 0);
  if (inc.bossFinale) inc.noMorale = true;   // il boss finale combatte fino alla morte
}
/** Dopo la creazione in monstroDa: probabilità di sorpresa (con +1 sul Rivo della Fiamma). */
export async function postCrea(inc, voce) {
  const bonus = sulFiume()?.id === 'p-rivo-fiamma' ? 1 : 0;
  if (voce.sorpresaProb && !inc.errante) {
    const p = voce.sorpresaProb + bonus, x = await dado(`${voce.nome}: sorprende il gruppo? (1-${p} su 1d6)`);
    if (x.totale <= p) { inc.sorpresa = true; log(`${voce.nome} sorprende il gruppo.`); }
  }
  if (inc.errante && bonus && voce.sorpresaProb) inc.sorpresa = true;
}

/** Creatura fissa del supplemento (idolo che cammina, barcaioli). */
export function creaSpeciale(id, opz = {}) { const v = spec(id); const i = creaIncontro('boss', { ...v, conta: '1' }, 1, opz); return i; }

// ---- raffiche e poteri all'inizio dell'incontro ----
async function attaccoDistanza(i, lista, danno, causa, ignora = false) {
  const finto = ignora ? { ...i, ignoraArmatura: true } : i;
  for (const eroeId of lista) {
    const e = eroePerId(eroeId); if (!e || e.stato !== 'ok') continue;
    const es = await C.provaDifesa(e, finto, i.liv, {});
    if (es.ok) nota(`${e.nome} si difende da ${causa} (${es.tot} > ${i.liv}).`); else { nota(`${e.nome} è colpito da ${causa} (${es.tot} contro LIV ${i.liv}).`); C.perdiPV(e, danno, causa); }
  }
}
async function raffica(i) {
  const raf = i.pf.raffica, bersagli = eroiAttivi(), gr = GR(), prima = bersagli.filter(e => e.stato === 'ok').length;
  if (!bersagli.length) return;
  nota(`${i.nome}: raffica a distanza prima della mischia.`);
  if (raf.tiriDifesaPerPG) {   // orde: ogni personaggio fa più tiri di difesa
    const piuPV = [...bersagli].sort((a, b) => b.pv - a.pv)[0];
    for (const e of bersagli) { const tiri = (raf.tiriDifesaPerPGLeggendario && gr >= 4 ? raf.tiriDifesaPerPGLeggendario : raf.tiriDifesaPerPG) + (raf.tiriDifesaPGConPVPiuAlti && e === piuPV ? raf.tiriDifesaPGConPVPiuAlti - raf.tiriDifesaPerPG : 0); await attaccoDistanza(i, Array(tiri).fill(e.id), raf.dannoPerFallimento || 1, 'la raffica'); }
  } else if (raf.attacchi) {   // leviatani: 2 bersagli diversi, ignora scudi e armature non magiche
    const ordine = [...bersagli].sort(() => Math.random() - 0.5).slice(0, raf.attacchi);
    await attaccoDistanza(i, ordine.map(e => e.id), 1, 'l’esplosione di energia', true);
  } else {   // minori: ogni mostro scaglia un colpo; i goblin ne mandano metà al personaggio con più PV
    const volte = raf.numeroLeggendario && gr >= 4 ? raf.numeroLeggendario : raf.numero || 1;
    for (let v = 0; v < volte && inc0(i); v++) {
      const lista = [], n = i.n, piuPV = [...bersagli].sort((a, b) => b.pv - a.pv)[0];
      const aPiuPV = raf.metaAlPGConPVPiuAlti ? Math.floor(n / 2) : 0;
      for (let k = 0; k < aPiuPV; k++) lista.push(piuPV.id);
      for (let k = aPiuPV; k < n; k++) lista.push(casuale(bersagli).id);
      await attaccoDistanza(i, lista, raf.dannoCiascuno || 1, 'la raffica');
    }
  }
  if (raf.seUccideAlmenoUnPG && vivi().length < prima) { i.moraleMod = (i.moraleMod || 0) + (raf.seUccideAlmenoUnPG.moraleMod || 0); if (raf.seUccideAlmenoUnPG.livMod) { i.liv += raf.seUccideAlmenoUnPG.livMod; i.livBase += raf.seUccideAlmenoUnPG.livMod; } nota(`La raffica ha ucciso un personaggio: ${i.nome} ha MOR +${raf.seUccideAlmenoUnPG.moraleMod}${raf.seUccideAlmenoUnPG.livMod ? ' e LIV +' + raf.seUccideAlmenoUnPG.livMod : ''} per l’incontro.`); }
}
const inc0 = i => C.inc() === i && i.stato !== 'finito';
/** Poteri che agiscono all'inizio dello scontro: raffica, illusione dell'agnas, ruggito, muco, benedizioni di PNG. */
export async function inizioIncontro(i) {
  const pf = i.pf; if (!pf) return;
  if (pf.raffica) await raffica(i);
  if (pf.illusione && inc0(i)) {
    const ill = pf.illusione;
    for (const e of eroiAttivi()) if (!(await salvaP(e, livelloMax() + ill.livMod, ill.bonus, `Illusioni dell’uccello agnas – ${e.nome}`))) await allucinazione(e);
  }
  if (pf.ruggito && inc0(i)) for (const e of eroiAttivi()) if (!(await salvaP(e, livelloMax() + pf.ruggito.salvezza.livMod, pf.ruggito.salvezza.bonus, 'Paura del ruggito'))) { e.ruggito = true; nota(`${e.nome} non può attaccare ${i.nome} finché non riceve una Benedizione.`); }
  if (pf.muco && inc0(i)) {
    const e = casuale(eroiAttivi());
    if (e) { const liv = i.liv + 1, es = await C.provaDifesa(e, i, liv, {}); if (es.ok) nota(`${e.nome} evita il muco corrosivo.`); else { e.muco = true; nota(`${e.nome} è colpito dal muco: non può fuggire, perde 1 PV per turno e ha -2 in difesa (Benedizione o morte del goblin).`); } }
  }
  if (pf.nonCombatteSeNonAttaccato) nota('Combatte solo se attaccato.');
  if (pf.rigenerazione) nota(`${i.nome}: rigenera ${pf.rigenerazione.pv} PV alla fine del suo turno.`);
  if (i.rm) nota(`${i.nome} ha Resistenza alla magia ${i.rm}: ogni incantesimo richiede prima un tiro per lanciare riuscito contro ${i.rm}.`);
}

/** Resistenza alla magia: prima di qualsiasi incantesimo o preghiera durante l'incontro serve un tiro per lanciare contro la RM. Restituisce false se l'incantesimo è sprecato. */
export async function provaRM(e, nome, chierico = false) {
  const i = C.inc();
  if (!i || i.stato !== 'combattimento' || !i.rm || i.rmIgnorata || adv().cittadella?.tipo === 'p-cit-magica') return true;
  const r = await C.d6e(e, `Resistenza alla magia di ${i.nome} (${nome})`, { esp: espAttacco(e, null, true) });
  const bonus = modAttacco(e, { ...C.contestoAttacco(e), incantesimo: true, nomeIncantesimo: nome }).tot + (chierico ? e.livello : 0), tot = r.totale + bonus;
  const ok = r.naturale !== 1 && tot >= i.rm;
  nota(`Resistenza alla magia: ${e.nome} tira ${tot} contro RM ${i.rm} → ${ok ? 'superata' : `${nome} sprecato`}.`);
  return ok;
}

// ---- inizio e fine del turno dei mostri ----
const ODIO = (i, e) => (i.pf?.odiaElfi && ['elfo', 'elfo-fuoco'].includes(e.classe)) || (i.pf?.odiaFemmine && (e.classe === 'elfo' || e.classe === 'mago'));
/** Attacchi speciali all'inizio del turno dei mostri: fanghiglia, psionico, forza oscura, raggio congelante, semi, muco. Restituisce true se l'incontro è finito. */
export async function inizioTurnoMostri(i) {
  const pf = i.pf; if (!pf) return false;
  for (const e of eroiAttivi()) if (e.muco) C.perdiPV(e, 1, 'muco corrosivo');
  if (i.assenteTurni > 0) { nota(`${i.nome} è lontano (teletrasportato): torna fra ${i.assenteTurni} turni.`); return false; }
  if (pf.veleno?.quando === 'ogni turno' && pf.veleno.dannoFormula) {
    for (const e of eroiAttivi()) {
      if (e.stato !== 'ok') continue;
      if (!(await salvaP(e, livelloMax() + (pf.veleno.livMod || 0), pf.veleno.bonus, `Veleno della fanghiglia – ${e.nome}`))) C.perdiPV(e, GR() + (pf.veleno.dannoMod || 0), i.nome);
    }
  }
  if (pf.esplosionePsionica) {
    const e = [...eroiAttivi()].sort((a, b) => cristalli(b) - cristalli(a))[0], p = pf.esplosionePsionica;
    if (e) { const ok = await salvaP(e, livelloMax() + p.salvezza.livMod, p.salvezza.bonus, `Poteri psionici di ${i.nome} – ${e.nome}`); C.perdiPV(e, ok ? 1 : p.dannoAutomatico, 'esplosione psionica'); }
  }
  if (pf.esplosioneForzaOscura && inc0(i)) {
    for (const e of eroiAttivi()) {
      const es = await C.provaDifesa(e, i, i.liv, {});
      if (es.ok) nota(`${e.nome} resiste alla forza oscura.`);
      else if (['mago', 'elfo'].includes(e.classe) && (e.incantesimi || []).some(s => !s.usato) && await confirmBox(`${e.nome} può perdere un incantesimo memorizzato invece di 2 PV. Lo fai?`)) { e.incantesimi.find(s => !s.usato).usato = true; nota(`${e.nome} sacrifica un incantesimo.`); }
      else C.perdiPV(e, pf.esplosioneForzaOscura.dannoSeFallisce, 'forza oscura');
    }
  }
  if (pf.raggioCongelante && inc0(i)) {
    const e = casuale([...eroiAttivi().filter(x => ODIO(i, x)), ...eroiAttivi()]);
    const es = await C.provaDifesa(e, { ...i, ignoraArmatura: false }, i.liv, {});
    if (es.ok) nota(`${e.nome} evita il raggio congelante.`); else C.perdiPV(e, pf.raggioCongelante.dannoSeFallisce, 'raggio congelante');
  }
  if (pf.semi && inc0(i)) {
    const e = casuale(eroiAttivi()), es = await C.provaDifesa(e, i, i.liv, {});
    if (!es.ok) { C.perdiPV(e, pf.semi.danno, 'sputo di semi'); if (e.stato === 'ok' && !(await salvaP(e, livelloMax(), { mago: 'L', salvaComeMago: 'L', altri: '1/2L' }, 'Semi della testadizucca (confusione)'))) { e.confuso = 2; nota(`${e.nome} è confuso: non agisce nel prossimo turno.`); } }
  }
  return !inc0(i);
}
const cristalli = e => (e.oggetti || []).filter(o => /cristall[oi] ronzant/i.test(o.nome || '')).reduce((a, o) => a + (o.qta || 1), 0);
/** Fine del turno dei mostri: rigenerazione, risurrezione, veleni, rinforzi, allucinazioni, ritorno dei teletrasportati. */
export async function fineTurnoMostri(i) {
  const pf = i.pf || {};
  if (pf.rigenerazione && i.pv > 0 && i.pv < i.pvMax) { i.pv = Math.min(i.pvMax, i.pv + pf.rigenerazione.pv); nota(`${i.nome} rigenera ${pf.rigenerazione.pv} PV (${i.pv}/${i.pvMax}).`); }
  if (pf.risorge) {
    if (i.fuocoTurno) { if (i.cadaveri) nota('Il fuoco impedisce ai troll caduti di rialzarsi.'); i.cadaveri = 0; i.fuocoTurno = false; }
    if (i.cadaveri > 0) { i.cadaveri--; i.n++; i.rigenerati = i.cadaveri > 0 ? 1 : 0; nota('Un troll torna in vita e attaccherà nel turno successivo.'); } else i.rigenerati = 0;
  }
  if (pf.rinforzi?.quando === 'fine di ogni turno dei troll' && i.n > 0 && (await dado(`${i.nome}: arriva un altro troll? (1-${pf.rinforzi.probSu6})`)).totale <= pf.rinforzi.probSu6) { i.n++; i.nIniziale++; nota('Un altro troll si unisce alla mischia.'); }
  if (pf.rinforzi?.turno && i.turno === pf.rinforzi.turno && i.pv > 0 && !i.rinforziChiamati) {
    i.rinforziChiamati = true;
    if ((await dado(`${i.nome}: arrivano i balestrieri? (1-${pf.rinforzi.probSu6})`)).totale <= pf.rinforzi.probSu6) {
      const v = D().mostri.seguaci.find(m => m.id === pf.rinforzi.creatura), n = (await tira(pf.rinforzi.conta, 'Balestrieri elfi oscuri in rinforzo')).totale, inc = creaIncontro('seguaci', v, n);
      inc.tessera = i.tessera; (adv().coda = adv().coda || []).push(inc); nota(`${n} balestrieri elfi oscuri arrivano in aiuto della strega (da affrontare dopo).`);
    }
  }
  for (const e of eroiAttivi()) if (e.allucinato?.id === 'p-all-circondato') await circondato(e, i);
  for (const e of S.party.eroi) if (e.confuso) e.confuso--;
  if (i.rientri?.length) { i.rientri = i.rientri.map(x => x - 1); const tornati = i.rientri.filter(x => x <= 0).length; i.rientri = i.rientri.filter(x => x > 0); if (tornati) { i.n += tornati; nota(`${tornati} creatura/e teletrasportata/e rientrano nel combattimento.`); } }
  if (i.assenteTurni > 0) { i.assenteTurni--; if (!i.assenteTurni) nota(`${i.nome} rientra nel combattimento.`); }
  // veleni a fine turno
  await velenoFineTurno(i);
}
/** Veleno degli uomini lucertola (fine di ogni turno) e degli uomini rana (fine del turno del gruppo): malus agli attacchi finché non arriva una Benedizione. */
async function velenoFineTurno(i) {
  const v = i.pf?.veleno; if (!v || ['ogni turno', 'dopo essere stato ferito'].includes(v.quando) || !inc0(i)) return;
  const feriti = eroiAttivi().filter(e => i.feritiTurno?.[e.id]);
  const lista = v.chi && /caso/.test(v.chi) ? (feriti.length ? [casuale(feriti)] : []) : feriti;
  for (const e of lista) {
    if (e.stato !== 'ok') continue;
    if (!(await salvaP(e, livelloMax() + (v.livMod || 0), v.bonus, `Veleno di ${i.nome} – ${e.nome}`))) {
      if (v.modAttaccoFormula) { e.malusAttGR = GR(); nota(`${e.nome} ha -${GR()} ai tiri di attacco (Benedizione per toglierlo).`); }
      else { e.malusAtt = (e.malusAtt || 0) + 1; nota(`${e.nome} ha -${e.malusAtt} ai tiri di attacco fino a fine incontro (Benedizione per toglierli).`); }
    }
  }
  i.feritiTurno = {};
}
/** Registra le ferite subite nel turno (serve ai veleni) e i danni subiti da un maggiore (abilità Risposta). */
export function dopoFerita(e, i, dn) {
  if (!i.pf) return;
  i.feritiTurno = i.feritiTurno || {}; i.feritiTurno[e.id] = (i.feritiTurno[e.id] || 0) + dn;
  if (!i.minore) { i.danniSubiti = i.danniSubiti || {}; i.danniSubiti[e.id] = (i.danniSubiti[e.id] || 0) + dn; }
  if (i.pf.veleno?.chi === 'ogni personaggio ferito' && i.pf.veleno.quando === 'dopo essere stato ferito') (async () => {   // piovre terricole
    const v = i.pf.veleno;
    if (e.stato === 'ok' && !(await salvaP(e, livelloMax() + (v.livMod || 0), v.bonus, `Veleno delle piovre – ${e.nome}`))) { e.malusPerquisire = 1; e.malusIncantesimi = 1; nota(`${e.nome}: -1 a perquisire e a lanciare incantesimi fino a fine avventura (Benedizione per toglierli).`); modificato('party'); }
  })().catch(err => console.error(err));
}
/** Dopo un attacco dell'eroe: spore degli sporagni (1 su 1d6 cumulativo per ogni sporagno ucciso in mischia). */
export async function dopoColpo(e, i, pre, opz) {
  if (i.pf?.spore && opz.mischia && pre.n > i.n) {
    const sp = i.pf.spore;
    const conta = i.sporeConta = i.sporeConta || {};
    for (let k = 0; k < pre.n - i.n; k++) {   // probabilità cumulativa per ogni personaggio: 5 sporagni uccisi = 5 su 1d6
      conta[e.id] = (conta[e.id] || 0) + 1;
      if ((await dado(`Spore di ${i.nome} su ${e.nome} (1-${conta[e.id]})`)).totale <= conta[e.id]) (i.tossiscono = i.tossiscono || {})[e.id] = true;
    }
  }
}
/** Effetti dei colpi: rimbalzo e deviazione dei colpi non magici, Affondo, Fendente, Ferita profonda, Precisione eroica. Restituisce i colpi effettivi. */
export async function colpiProf(e, i, r, arma, colpi, totale, L) {
  const mischia = !arma?.lancio, pf = i.pf || {}, magica = (e.bonusMagico || 0) > 0 || (e.armiLeggendarie || []).includes(arma?.id);
  if (pf.rimbalzoArmiNonMagiche && !magica) {
    const p = (e.armiPerfette || []).includes(arma?.id) ? pf.rimbalzoArmiNonMagiche.probSu6ArmiPerfette || 1 : pf.rimbalzoArmiNonMagiche.probSu6;
    if ((await dado(`${i.nome}: il colpo rimbalza? (1-${p} su 1d6)`)).totale <= p) { nota(`Il colpo di ${e.nome} rimbalza su ${i.nome}.`); return 0; }
  }
  if (pf.deviaColpiNonMagici && !magica && (await dado(`${i.nome}: colpo deviato dall’armatura? (1-${pf.deviaColpiNonMagici.probSu6})`)).totale <= pf.deviaColpiNonMagici.probSu6) { nota(`L’armatura di ${i.nome} devia il colpo di ${e.nome}.`); return 0; }
  const usati = i.usati = i.usati || {};
  if (mischia) {
    const af = forza(e, 'p-affondo'); if (af && r.naturale % 2 === 0) { colpi += af.ferite; nota(`${e.nome} (Affondo): +${af.ferite} ${i.minore ? 'uccisi' : 'ferite'} (risultato pari).`); }
    const fe = forza(e, 'p-fendente'); if (fe && arma?.categoria === 'due-mani' && arma.tipo === 'taglio') { const x = i.minore ? fe.minoriExtra : fe.ferite; colpi += x; nota(`${e.nome} (Fendente): +${x} ${i.minore ? 'uccisi' : 'ferite'}.`); }
    const fp = forza(e, 'p-ferita-profonda'); if (fp && arma?.categoria === 'leggera' && !usati[e.id + 'fp']) { usati[e.id + 'fp'] = true; colpi += fp.ferite; nota(`${e.nome} (Ferita profonda): +${fp.ferite} ferite (1 volta per combattimento).`); }
  } else if (i.precisioneAttiva === e.id) {
    i.precisioneAttiva = null;
    if (i.minore || i.ordaP) { colpi = 1; nota(`${e.nome} (Precisione eroica): uccide una sola creatura.`); }
  }
  return colpi;
}
/** Dichiarazioni consumate dopo l'attacco (frecce leggendarie, Risposta, Precisione). */
export function consumaDichiarazioni(e, i, arma) {
  const d = e.dichiara || {}; i.usati = i.usati || {}; i.precisioneAttiva = null;
  if (d.frecce) { const o = oggettoEffetto(e, /frecce o dardi magici leggendari/i); if (o) { o.cariche = Math.max(0, (o.cariche || 1) - 1); if (o.cariche <= 0) e.oggetti = e.oggetti.filter(x => x !== o); } d.frecce = false; }
  if (d.risposta) { d.risposta = false; i.usati[e.id + 'ri'] = true; }
  if (d.precisione) { d.precisione = false; i.usati[e.id + 'pr'] = true; i.precisioneAttiva = e.id; }
}
/** Blocchi all'attacco di un eroe: ruggito, allucinazioni, confusione, mostro lontano. Restituisce il motivo o null. */
export function bloccoAttacco(e, i) {
  if (e.ruggito && i.pf?.ruggito) return `${e.nome} è paralizzato dal terrore del ruggito: non può attaccare ${i.nome} (serve una Benedizione).`;
  if (e.bloccato) return `${e.nome} è in preda a un’allucinazione: non agisce (Benedizione, danni o fine dell’incontro).`;
  if (e.allucinato?.id === 'p-all-circondato') return `${e.nome} crede di essere circondato e attacca i compagni, non i mostri.`;
  if (e.confuso) return `${e.nome} è confuso: non agisce in questo turno.`;
  if (i.assenteTurni > 0) return `${i.nome} è lontano (teletrasportato).`;
  return null;
}
/** Fuoco amico della falena: gli attacchi a distanza hanno 3 su 1d6 di colpire un membro del gruppo a caso (nessuna difesa). Restituisce true se l'attacco è deviato. */
export async function fuocoAmico(e, i) {
  const f = i.pf?.fuocoAmico; if (!f) return false;
  if ((await dado(`Fuoco amico contro ${i.nome} (1-${f.probSu6} su 1d6)`)).totale > f.probSu6) return false;
  const v = casuale(eroiAttivi()); nota(`L’attacco a distanza di ${e.nome} colpisce per errore ${v.nome} (nessuna difesa)!`); C.perdiPV(v, 1, 'fuoco amico'); return true;
}
/** Esplosione non permessa: il verme non esplode finché è sopra metà PV (gli incantesimi sì). */
export const senzaEsplosione = i => !!(i.pf?.noEsplosioneFinoAMetaPV && i.pv * 2 > i.pvMax);

/** Mostro ucciso o fuggito: livello dinamico (ragni, goblin), poteri dei maggiori. */
export function livelloDinamico(i) {
  if (i.pf?.livPerDueUccisi) { const k = Math.floor((i.nIniziale - i.n) / 2), p = i.pf.livPerDueUccisi; i.liv = Math.max(p.livMinimo, i.livBase + p.mod * k); }
  if (i.livMetaPV && i.minore && i.n * 2 <= i.nIniziale) i.liv = Math.max(1, i.livMetaPV);
}
/** Ematovermi: LIV ridotto se nessun membro del gruppo è ferito. */
export const livelloSenzaFeriti = i => (i.pf?.livSenzaFeriti && !S.party.eroi.some(e => e.stato === 'ok' && e.pv < e.pvMax) ? valoreLmp(i.pf.livSenzaFeriti.liv, i.pf.livSenzaFeriti.livMod) : null);
/** Il gruppo fugge o si ritira da un mostro con effetto alla fuga (idolo che cammina). */
export function gruppoFugge(i) { if (i.pf?.effettoSeFugge && !adv().idoloFuggito) { adv().idoloFuggito = true; log('Il gruppo scappa dall’idolo che cammina: nei prossimi tiri su Idoli ciclopici l’1 vale 2.'); } }
/** Il mostro odia certe classi e le attacca per prime (elfi, incantatrici). */
export const odia = (i, e) => !!((i.pf?.odiaElfi && ['elfo', 'elfo-fuoco'].includes(e.classe)) || (i.pf?.odiaFemmine && ['elfo', 'elfo-fuoco', 'mago'].includes(e.classe)));
/** Un eroe è caduto: i ragni generano altri ragni, il Rivo delle Lacrime dà follia agli altri. */
export async function eroeCaduto(e, causa) {
  const i = C.inc();
  if (i?.pf?.uccisoGeneraRagni && causa === i.nome && i.stato !== 'finito') { const n = (await tira(i.pf.uccisoGeneraRagni.conta, 'Ragni generati dal caduto')).totale; i.n += n; i.nIniziale += n; e.nonResuscitabile = true; nota(`${e.nome} è morto: ${n} nuovi ragni escono dal corpo (non resuscitabile).`); modificato(); }
  if (sulFiume()?.id === 'p-rivo-lacrime') for (const x of eroiVivi().filter(y => y.id !== e.id && y.stato === 'ok')) K.follia(x, 1);
  if (e.allucinato) e.allucinato = null;
}
/** L'eroe subisce danni: finisce l'allucinazione «le mie dita sono vermi». */
export function eroeFerito(e) { if (e.bloccato === 'dita') { e.bloccato = false; e.allucinato = null; log(`${e.nome} riprende il controllo delle mani.`); } }
/** Benedizione su un personaggio: toglie i malus delle Profondità. */
export function dopoBenedizione(b) {
  for (const k of ['malusAtt', 'malusAttGR', 'malusPerquisire', 'malusIncantesimi', 'ruggito', 'muco', 'bloccato', 'confuso']) delete b[k];
  if (b.allucinato) b.allucinato = null;
  if (b.legato) { log(`${b.nome} è liberato dalla trappola dell’anima.`); b.legato = null; }
  modificato('party');
}
/** Vittoria o fuga: conteggi e conseguenze (streghe uccise, idolo fuggito). */
export function vittoria(inc, esito) {
  if (inc.id === 'p-strega-elfa-oscura') adv().stregheUccise = (adv().stregheUccise || 0) + 1;
  if (inc.orda || inc.ordaP) log('Orda sconfitta: puoi raccogliere armi a una mano e armi leggere a scelta per ogni membro del gruppo.');
  if (esito !== 'fuga') {
    (inc.custodisce || []).forEach(o => bottino(o)); if (inc.custodisce?.length) log(`I tesori magici custoditi da ${inc.nome} sono tuoi (vedi Bottino).`);
    if (inc.indizioInvece && adv().cittadella) { adv().cittadella.indizi = (adv().cittadella.indizi || 0) + 1; log('Prigionieri della Cittadella: il maggiore dà 1 indizio invece del tesoro (ricordalo a mano ai personaggi).'); }
    if (inc.dopoVittoria === 'idolo') idolo().then(t => log(`Idolo ciclopico dopo il guardiano: ${t}`)).catch(err => console.error(err));
  }
}
/** Fine dell'incontro: spore, ruggito, muco, malus di combattimento, risorse temporanee. */
export async function fineIncontro(i, esito) {
  for (const e of eroiVivi()) {
    if (i.tossiscono?.[e.id] && e.stato === 'ok' && !e.curatoMagia) C.perdiPV(e, i.pf.spore.dannoFineIncontro, 'tosse da spore');
    delete e.malusAtt; delete e.malusAttGR; delete e.ruggito; delete e.muco; e.curatoMagia = false; e.confuso = false; if (e.bloccato) e.bloccato = false;
    e.dichiara = e.dichiara || {};
  }
  if (i.tossiscono && eroiVivi().filter(e => e.stato === 'ok').length && eroiVivi().filter(e => e.stato === 'ok').every(e => i.tossiscono[e.id]) && i.pf.spore.seTuttiTossiscono) {
    if ((await dado(`Tutti tossiscono: arrivano gli erranti? (1-${GR()} su 1d6)`)).totale <= GR()) { const m = await G.monstroErrante(); G.avviaIncontro(m, G.tileById(adv().stanzaCorrente)); }
  }
  if (i.pf?.rinforzi && esito) void 0;
}

// ---- tesoro dei mostri ----
/** Tesori particolari dei mostri: goblin mutato, cristalli del maestro psionico, indizio della strega. Restituisce 'solo' se sostituiscono il tesoro normale. */
export async function saccheggioExtra(i) {
  if (i.errante || !i.pf) return null;
  const pf = i.pf;
  if (pf.tesCristalli) { const n = (await tira(pf.tesCristalli, 'Cristalli ronzanti')).totale; bottino({ tipo: 'magico', nome: 'Cristalli ronzanti', qta: n, testo: `Cristalli ronzanti ×${n}: ricaricano un oggetto monouso o salvano una pergamena`, valore: n * 100 }); nota(`Tra i resti: ${n} cristalli ronzanti.`); }
  if (pf.tesIndizi) { const e = await K.eroeScelto('Chi trova l’indizio della strega?'); if (e) await G.aggiungiIndizio(e); }
  if (i.id === 'p-goblin-mutato-maggiore') {
    const oro = (await tira('5d6', 'Oro del goblin mutato')).totale, g = (await tira('2d6', 'Gemme piccole')).totale, p = (await tira('1d6', 'Valore arma perfetta')).totale;
    bottino({ tipo: 'oro', testo: `${oro} pezzi d’oro`, valore: oro }); bottino({ tipo: 'gemma', testo: `${g} gemme piccole da 25 p.o. ciascuna`, valore: g * 25 });
    bottino({ tipo: 'oggetto', testo: `Arma da taglio a una mano perfetta (vale ${(p + 4) * 5} p.o.; lettura probabile di «1d6+4x5»)`, valore: (p + 4) * 5 });
    nota('Saccheggio: oro, gemme e un’arma perfetta del goblin mutato.'); return 'solo';
  }
  return null;
}

// =============================================================
//  ALLUCINAZIONI
// =============================================================
const PERICOLO_ALL = { 'annulla-imboscata': 'annulla un’imboscata (a mano)', 'perquisire-automatico': 'riesce automaticamente in un tiro di perquisire (a mano)', 'contenuto-stanza': 'conosce in anticipo il contenuto di una stanza (tira prima di entrare)' };
export async function allucinazione(e) {
  const r = await dado(`Allucinazione di ${e.nome} (d6)`), row = riga(D().tabelle.allucinazioni, r.totale);
  nota(`Allucinazione (${r.totale}) di ${e.nome}: ${row.nome}.`);
  switch (row.id) {
    case 'p-all-circondato': { const t = (await tira('1d3+1', 'Turni dell’allucinazione')).totale; e.allucinato = { id: row.id, turni: t }; nota(`${e.nome} attacca i compagni per ${t} turni (una Benedizione la interrompe).`); break; }
    case 'p-all-dita-vermi': e.bloccato = 'dita'; e.allucinato = { id: row.id }; nota(`${e.nome} fissa le dita e non agisce fino a fine incontro, a una Benedizione o ai primi danni.`); break;
    case 'p-all-nessun-pericolo': e.nessunPericolo = true; nota(`${e.nome} ignorerà la prossima fonte di pericolo: fallirà il prossimo tiro salvezza o difesa.`); break;
    case 'p-all-orrore-aldila': K.follia(e, GR()); break;
    default: {
      K.follia(e, 1);
      const k = await scelta(`Rivelazioni di ${e.nome}`, 'Scegli un effetto da usare quando serve (una sola volta):', row.scelte.map(c => [c, { 'annulla-imboscata': 'Annullare un’imboscata', 'difesa-automatica': 'Difendersi automaticamente da un attacco', 'salvezza-automatica': 'Riuscire automaticamente in un tiro salvezza', 'perquisire-automatico': 'Riuscire in un tiro di perquisire', 'contenuto-stanza': 'Conoscere il contenuto di una stanza' }[c]]));
      if (k === 'salvezza-automatica') e.autoSalvezza = true; else if (k === 'difesa-automatica') e.autoDifesa = true; else nota(`${e.nome}: ${PERICOLO_ALL[k] || 'effetto da applicare a mano'}.`);
    }
  }
  modificato('party');
}
/** Allucinazione «sono circondato»: ogni turno il personaggio attacca un compagno come un boss di pari LIV (dimezzato senza bonus di livello). */
async function circondato(e, i) {
  const compagni = eroiAttivi().filter(x => x.id !== e.id);
  if (e.stato !== 'ok' || !compagni.length) { e.allucinato = null; return; }
  const liv = ['barbaro', 'guerriero', 'nano', 'elfo', 'assassino', 'elfo-fuoco', 'tiratore'].includes(e.classe) ? e.livello : mezzo(e), v = casuale(compagni);
  const es = await C.provaDifesa(v, { tag: [], nome: e.nome, id: 'allucinato', minore: false, turno: 2, sorpresa: false }, liv, {});
  if (es.ok) nota(`${v.nome} si difende da ${e.nome} allucinato (${es.tot} > ${liv}).`); else { nota(`${e.nome} allucinato colpisce ${v.nome}.`); C.perdiPV(v, 1, `${e.nome} allucinato`); }
  if (--e.allucinato.turni <= 0) { e.allucinato = null; nota(`${e.nome} torna in sé.`); }
}

// =============================================================
//  CONTENUTI DELLE STANZE
// =============================================================
/** Contenuto di una stanza o di un corridoio. `opz`: corridoio, bossFinaleOk (può uscire il boss finale), aberranteSolo (solo la tabella Aberranti), cit (id della Cittadella in corso). Restituisce {testo, vuota}. */
export async function risolviContenuto(row, t, opz = {}) {
  const corr = !!opz.corridoio, avvia = i => G.avviaIncontro(i, t || G.tileById(adv().stanzaCorrente));
  const mostro = async (tab, piuN = 0) => {
    const i = await G.monstroDa(tab);
    if (piuN) { i.n += piuN; i.nIniziale += piuN; }
    if (opz.cit === 'p-cit-affollata') { if (i.minore && tab === 'seguaci') { i.n *= 2; i.nIniziale *= 2; } i.modReazioni = (i.modReazioni || 0) - 1; }   // abitanti più civilizzati: seguaci doppi e -1 alle reazioni
    avvia(i); return i;
  };
  if (opz.cit === 'p-cit-trappole' && ['seguaci', 'seguaci-piu', 'orda'].includes(row.azione) && (await dado('Cittadella delle trappole: al posto dei mostri c’è una trappola? (1-4)')).totale <= 4) row = D().tabelle.contenuto.find(x => x.azione === 'trappola-tesoro');
  switch (row.azione) {
    case 'macchinario': return { testo: await macchinario(row, t), vuota: false };
    case 'allucinazione': {
      if ((adv().allucinazioni || 0) >= 2) return { testo: `Allucinazioni già due volte: ${await evento(t)}`, vuota: false };
      adv().allucinazioni = (adv().allucinazioni || 0) + 1;
      const e = casuale(eroiAttivi()); if (e) await allucinazione(e);
      return { testo: e ? `${e.nome} ha un’allucinazione.` : '', vuota: false };
    }
    case 'infestanti': case 'seguaci': { const i = await mostro(row.azione); return { testo: `${i.nome} ×${i.n}`, vuota: false }; }
    case 'seguaci-piu': { const i = await mostro('seguaci', row.contaExtra || 2); return { testo: `${i.nome} ×${i.n} (+${row.contaExtra || 2})`, vuota: false }; }
    case 'orda': { const i = await mostro('orde'); return { testo: i.nome, vuota: false }; }
    case 'trappola-tesoro': {
      let testo = await G.trappola();
      if (!corr) { const prob = opz.cit === 'p-cit-trappole' ? 3 : row.tesoroStanza?.probSu6 || 2; if ((await dado(`Tesoro nella stanza della trappola? (1-${prob} su 1d6)`)).totale <= prob) testo += ' ' + await G.tesoro(); }
      return { testo, vuota: true };
    }
    case 'boss': {
      let i = await G.monstroDa('boss');
      if (opz.bossFinaleOk) i = await G.bossCheck(i);
      if (opz.cit === 'p-cit-prigionieri') { i.tes = 'NO'; i.indizioInvece = true; }
      avvia(i); return { testo: `${i.nome}${i.bossFinale ? ' (BOSS FINALE)' : ''}`, vuota: false };
    }
    case 'aberrante': {
      const tab = opz.aberranteSolo ? 'aberranti' : riga(D().tabelle.aberranteOrigine, (await dado('Aberrante: 1-3 Aberranti, 4-6 Aberranti della Cittadella')).totale).tabella;
      let i = await G.monstroDa(tab);
      if (opz.bossFinaleOk) i = await G.bossCheck(i);
      if (opz.cit === 'p-cit-affollata') i.modReazioni = (i.modReazioni || 0) - 1;
      if (opz.cit === 'p-cit-prigionieri') { i.tes = 'NO'; i.indizioInvece = true; }
      avvia(i); return { testo: `${i.nome}${i.bossFinale ? ' (BOSS FINALE)' : ''}`, vuota: false };
    }
    case 'vuota': return { testo: corr ? 'Vuota (si può perquisire a -1).' : 'Stanza vuota (si può perquisire).', vuota: true };
    case 'evento': return { testo: await evento(t), vuota: false };
    case 'residui-psichici': return { testo: await residuiPsichici(row), vuota: false };
    case 'passaggio-segreto': return { testo: await passaggioSegreto(), vuota: false };
  }
  return { testo: row.testo, vuota: false };
}
async function macchinario(row, t) {
  const L = livelloMax() + row.difficolta.livMod, fatti = t ? (t.macchinaTentata = t.macchinaTentata || {}) : {};
  for (;;) {
    const lista = vivi().filter(e => !fatti[e.id]); if (!lista.length) return `Macchinario (L${L}): nessuno riesce a capirlo.`;
    const id = await scelta('Macchinario', `Chi tenta di capire come funziona? (difficoltà L${L}; un tentativo a testa; gnomi e artificieri +L, maghi +½L; se fallisce subisce ${GR()} danni)`, [...lista.map(e => [e.id, e.nome]), [null, 'Basta così']]);
    if (!id) return 'Il macchinario resta un mistero.';
    const e = eroePerId(id); fatti[id] = true;
    if (await C.salva(e, L, bonusClasse(e, row.bonus), `Macchinario (L${L})`)) {
      const k = await scelta('Macchinario funzionante', `${e.nome} lo capisce: che cosa ottiene?`, [['indizio', '1 indizio'], ...(row.successo.some(x => x.razioni) ? [['razioni', '1d6 razioni di cibo']] : [])]);
      if (k === 'razioni') { const n = (await tira('1d6', 'Razioni dal macchinario')).totale; bottino({ tipo: 'oggetto', testo: `Razioni di cibo ×${n}`, nome: 'Razioni', qta: n }); return `${e.nome} capisce il macchinario: ${n} razioni.`; }
      await G.aggiungiIndizio(e); return `${e.nome} capisce il macchinario e ottiene un indizio.`;
    }
    C.perdiPV(e, GR() + (row.fallimento.dannoMod || 0), 'macchinario');
  }
}
async function residuiPsichici(row) {
  const s = row.salvezza, L = livelloMax() + s.livMod; let n = 0;
  for (const e of eroiAttivi()) {
    if (await C.salva(e, L, bonusClasse(e, s.bonus), `Attacco psichico (L${L})`)) { e.bonusPsichico = true; continue; }
    const opz = [['pv', 'Subisci 3 PV'], ['follia', 'Guadagni 1 punto follia']];
    if ((e.incantesimi || []).filter(x => !x.usato).length >= 1) opz.push(['inc', 'Perdi 2 incantesimi memorizzati fino a fine avventura']);
    const k = await scelta(`${e.nome}: residui psichici`, 'Il tiro salvezza è fallito: scegli il prezzo.', opz);
    if (k === 'follia') K.follia(e, 1); else if (k === 'inc') { (e.incantesimi || []).filter(x => !x.usato).slice(0, 2).forEach(x => { x.usato = true; }); nota(`${e.nome} perde 2 incantesimi fino a fine avventura.`); } else C.perdiPV(e, 3, 'residui psichici'); n++;
  }
  return `Sala infestata da residui psichici: ${n} personagg${n === 1 ? 'io' : 'i'} colpit${n === 1 ? 'o' : 'i'}.`;
}
async function passaggioSegreto() {
  const k = await scelta('Passaggio segreto', 'Come lo cerchi? (3 indizi, oppure 3 trappole LMP+3 da disattivare, oppure 2 aberranti da sconfiggere senza tesoro)', [['indizi', 'Spendo 3 indizi'], ['aberranti', 'Combatto 2 aberranti (fino alla morte)'], ['trappole', 'Affronto 3 trappole LMP+3'], [null, 'Lascio perdere']]);
  if (!k) return 'Passaggio segreto: ignorato.';
  if (k === 'indizi') { if (!(await spendiIndizi(3))) return 'Passaggio segreto: indizi insufficienti.'; }
  else if (k === 'aberranti') for (let n = 0; n < 2; n++) { const i = await G.monstroDa('aberranti'); i.tes = 'NO'; i.reazioni = [[1, 6, 'morte']]; G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); }
  else for (let n = 0; n < 3; n++) { const L = livelloMax() + 3; for (const e of eroiAttivi()) if (!(await C.salva(e, L, mezzo(e), `Trappola del passaggio segreto (L${L})`))) C.perdiPV(e, GR(), 'trappola'); }
  const d = (await tira('1d3', 'Destinazione del passaggio (1 Abisso, 2 Aldilà, 3 Cittadella)')).totale;
  if (d === 3) { if (await confirmBox('Il passaggio conduce a una Cittadella: la esplori ora? (strumento guidato)')) await iniziaCittadella(); return 'Passaggio segreto verso una Cittadella.'; }
  return d === 1 ? 'Passaggio segreto verso un dungeon dell’Abisso (da generare a parte con «Contro l’Abisso»: non gestito qui).' : 'Passaggio segreto verso l’Aldilà («Orrori dall’Aldilà»: non collegato, ignorato).';
}
export async function spendiIndizi(n) {
  const tot = eroiVivi().reduce((a, x) => a + (x.indizi || 0), 0); if (tot < n) { toast(`Servono ${n} indizi (ne hai ${tot}).`, 'warn'); return false; }
  let resto = n; for (const x of [...eroiVivi()].sort((a, b) => (b.indizi || 0) - (a.indizi || 0))) { const k = Math.min(x.indizi || 0, resto); x.indizi -= k; resto -= k; }
  log(`Spesi ${n} indizi.`); modificato('party'); return true;
}

// =============================================================
//  EVENTI SPECIALI (d10)
// =============================================================
export async function evento(t) {
  const r = await d10('Evento speciale (d10)'), row = riga(D().tabelle.eventi, r.totale);
  return `${row.nome}: ${await eseguiEvento(row, t)}`;
}
async function eseguiEvento(row, t) {
  const gr = GR();
  switch (row.id) {
    case 'p-ev-dama-grigio': return await missione();
    case 'p-ev-venti-disperazione': for (const e of vivi()) { const k = await scelta(`Venti di disperazione – ${e.nome}`, 'Scegli il prezzo.', [['follia', '1 punto follia'], ['pv', 'Perdi 2 PV']]); if (k === 'pv') C.perdiPV(e, 2, 'venti di disperazione'); else K.follia(e, 1); } return 'Tutti hanno pagato.';
    case 'p-ev-qualcosa-si-agita': {
      const chi = eroiVivi().filter(x => (x.classe === 'chierico' && (x.usi?.benedizione || 0) < 3) || (x.incantesimi || []).some(s => s.nome === 'Benedizione' && !s.usato));
      let senza = false;
      if (chi.length && await scelta('Qualcosa si agita nell’oscurità', 'Una Benedizione lanciata subito toglie la possibilità di sorpresa ai mostri.', [[true, `Lancia Benedizione (${chi[0].nome})`], [false, 'No']])) { const c = chi[0]; if (c.classe === 'chierico') await C.usaBenedizione(c, c); else await C.lancia(c, c.incantesimi.findIndex(s => s.nome === 'Benedizione' && !s.usato), { bersaglioId: c.id }); senza = true; }
      adv().agitazione = { stanze: 6, senzaSorpresa: senza }; return 'per 6 stanze, ogni stanza vuota ha 3 su 1d6 di un incontro fluviale.';
    }
    case 'p-ev-metamorfosi': return 'il labirinto si muove: ritira a mano le forme (non i contenuti) delle ultime 5 stanze sulla mappa.';
    case 'p-ev-alluvione': {
      for (const e of vivi()) for (let k = 0; k < row.salvezze.numero; k++) if (!(await C.salva(e, row.salvezze.liv, 0, `Alluvione: nuotare (L${row.salvezze.liv})`))) C.perdiPV(e, 1, 'alluvione');
      let persi = 0; for (const e of eroiVivi()) for (const o of (e.oggetti || []).filter(x => x.tipo === 'pergamena')) if ((await dado(`Pergamena bagnata: ${o.nome} (1-2 = distrutta)`)).totale <= 2) { e.oggetti.splice(e.oggetti.indexOf(o), 1); persi++; }
      adv().alluvione = { stanze: 12 }; return `${persi} pergamene distrutte; archi a -2 per 12 stanze.`;
    }
    case 'p-ev-terremoto': for (const e of vivi()) { const n = (await tira('1d3', `Pietre su ${e.nome}`)).totale; for (let k = 0; k < n; k++) if (!(await C.salva(e, livelloMax(), 0, `Terremoto: pietra ${k + 1}`))) C.perdiPV(e, 1, 'pietra del terremoto'); } return 'ogni fallimento costa 1 PV.';
    case 'p-ev-nebbia-incubo': for (const e of vivi()) { if (oggettoEffetto(e, /maschera di thar-tizan/i)) { nota(`${e.nome} indossa una maschera di Thar-Tizan: immune alla nebbia.`); continue; } if (!(await C.salva(e, livelloMax() + 2, 0, `Nebbia da incubo (allucinazioni, L${livelloMax() + 2})`))) await allucinazione(e); } return 'chi fallisce ha un’allucinazione.';
    case 'p-ev-passaggio': {
      if ((await dado(`Il corridoio è protetto da una trappola? (1-${Math.min(6, gr)})`)).totale <= gr) await G.trappola();
      if (await confirmBox('Una porta segreta conduce a una Cittadella: la esplori? (strumento guidato; consigliata ai leggendari)')) await iniziaCittadella();
      return 'porta segreta verso una Cittadella.';
    }
    case 'p-ev-portale': return 'portale verso l’Aldilà o un dungeon dell’Abisso/caotico (1 PV a chi lo attraversa): non gestito dal programma, genera il dungeon a parte se vuoi seguirlo.';
    case 'p-ev-camera-tesoro': {
      const i = await G.monstroDa('aberranti'); i.pvMax += 4; i.pv += 4; i.reazioni = [[1, 6, 'morte']]; i.custodisce = [];
      for (let k = 0; k < 3; k++) i.custodisce.push(await tesoroMagico());
      G.avviaIncontro(i, t || G.tileById(adv().stanzaCorrente)); return `3 tesori magici custoditi da ${i.nome} (PV +4, combatte fino alla morte): saranno tuoi a incontro vinto.`;
    }
  }
  return row.testo;
}
/** Dopo ogni stanza: eventi che durano più stanze, effetti temporanei, artefatti dei segreti. */
export async function dopoStanza(t) {
  if (!profonditaAttiva()) return;
  const a = adv();
  if (a.agitazione) {
    if (t.contenuto?.vuota && (await dado('Qualcosa si agita: incontro fluviale? (1-3 su 1d6)')).totale <= 3) {
      const i = await G.monstroDa('incontriFluviali');
      if (!a.agitazione.senzaSorpresa && (await dado('I mostri sorprendono il gruppo? (1 su 1d6)')).totale === 1) { i.sorpresa = true; i.mostriPrima = true; }
      G.avviaIncontro(i, t);
    }
    if (--a.agitazione.stanze <= 0) a.agitazione = null;
  }
  if (a.alluvione && --a.alluvione.stanze <= 0) { a.alluvione = null; log('Gli archi si sono asciugati.'); }
  for (const e of eroiVivi()) if (e.nonLancia > 0 && --e.nonLancia === 0) log(`Il liquido su ${e.nome} perde effetto: può di nuovo lanciare incantesimi.`);
  if (a.artefatto) { const o = await tesoroMagico(a.artefatto.grado); a.artefatto = null; bottino(o); log(`Artefatto del segreto: ${o.testo}`); }
  const m = a.missioneP;
  if (m?.id === 'p-mis-nemico' && !m.apparso && m.stanze > 0 && --m.stanze <= 0) await missioneNemico();
}

// =============================================================
//  TRAPPOLE (LMP+GR+2)
// =============================================================
export const livTrappola = row => livelloMax() + (row.livGR ? GR() : 0) + (row.livMod || 0);
export async function risolviTrappola(t) {
  const ord = ordineMarcia().filter(e => e.stato === 'ok'); if (!ord.length) return;
  const L = t.liv, gr = GR();
  const ts = async (e, s, label, extra = 0) => { const b = mezzo(e) + bonusClasse(e, s || {}) + extra; let ok = await C.salva(e, L, b, `${label} (L${L})`); if (!ok && e.classe === 'mezzuomo') ok = await C.salva(e, L, b, `${label} (mezzuomo ripete, L${L})`); return ok; };
  switch (t.riga) {
    case 1: { const e = casuale(ord); if (!(await ts(e, { mago: 'L', elfo: 1 }, 'Liquido resistente alla magia'))) { e.nonLancia = 6; nota(`${e.nome} non può lanciare incantesimi né preghiere per 6 stanze.`); } break; }
    case 2: {
      const e = ord[0];
      if (!(await ts(e, { furfante: 'L' }, 'Botola dell’oblio'))) {
        C.perdiPV(e, 1, 'caduta nella botola');
        const altri = ord.filter(x => x !== e); let ricorda = 0;
        for (const x of altri) if (await C.salva(x, L, mezzo(x), `Botola dell’oblio: ricordare ${e.nome} (L${L})`)) ricorda++; else nota(`${x.nome} dimentica ${e.nome}.`);
        if (e.stato === 'ok' && !ricorda) { e.stato = 'morto'; e.nonResuscitabile = true; e.persoPerSempre = true; nota(`Nessuno ricorda ${e.nome}: lui e il suo equipaggiamento sono persi per sempre (solo un viaggio dimensionale o un Desiderio possono salvarlo).`); }
        else if (e.stato === 'ok') nota(`${e.nome} è nella botola: serve l’aiuto di un compagno per tirarlo fuori.`);
      }
      break;
    }
    case 3: {
      let colpiti = 0;
      for (const e of ord) { const arm = e.classe === 'furfante' ? e.livello : (e.armatura === 'leggera' ? 1 : e.armatura === 'pesante' ? 2 : 0) + (e.scudo ? 1 : 0); if (!(await C.salva(e, L, mezzo(e) + arm, `Disco di ossidiana (L${L})`))) { C.perdiPV(e, gr + 2, 'disco di ossidiana'); colpiti++; } }
      const n = (await tira('1d6', 'Frammenti del disco')).totale;
      bottino({ tipo: 'oggetto', testo: `Coltello di ossidiana (arma da taglio leggera perfetta, si rompe con un 1 all’attacco, vale 10 p.o.)`, nome: 'Coltello di ossidiana', qta: n, valore: 10 }); nota(`Il disco si frantuma in ${n} frammenti: coltelli di ossidiana.`); void colpiti; break;
    }
    case 4: {
      const e = ord[0];
      if (!(await ts(e, {}, 'Gabbia della bestia'))) { const i = await G.monstroDa('aberranti'); i.tes = 'NO'; i.sorpresa = true; i.mostriPrima = true; G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); nota(`${i.nome} esce dalla gabbia e attacca con sorpresa (senza tesoro, non è il boss finale).`); }
      break;
    }
    case 5: {
      const e = ord[ord.length - 1];
      if (!(await ts(e, {}, 'Trappola dell’anima'))) { e.legato = { stanza: adv().stanzaCorrente }; nota(`${e.nome} è legato alla stanza: per ogni area di distanza perde 1 PV o prende 1 follia (a tua scelta) finché una Benedizione non lo libera.`); }
      break;
    }
    case 6: {
      const e = casuale(ord); let ok = await ts(e, {}, 'Esplosione disintegrante');
      if (!ok && e.classe === 'mezzuomo') ok = await ts(e, {}, 'Esplosione disintegrante (migliore dei due)');
      if (ok) break;
      const magici = (e.oggetti || []).filter(o => ['magico', 'arma-magica', 'armatura-magica'].includes(o.tipo) && !/pozione|pergamena/i.test(o.nome || ''));
      if (magici.length && (await confirmBox(`${e.nome} sta per essere incenerito: sacrifica un oggetto magico permanente (${magici[0].nome.slice(0, 40)}…) e subisce solo ${gr + 1} danni?`))) { e.oggetti.splice(e.oggetti.indexOf(magici[0]), 1); C.perdiPV(e, gr + 1, 'esplosione disintegrante'); }
      else { e.stato = 'morto'; e.nonResuscitabile = true; nota(`${e.nome} è incenerito (corpo distrutto).`); }
      break;
    }
  }
  adv().trappolaAttiva = null; modificato();
}

// =============================================================
//  MISSIONI DELLA DAMA IN GRIGIO
// =============================================================
export async function missione() {
  const r = await dado('Missione (d6)'), row = riga(D().tabelle.missioni, r.totale);
  const m = adv().missioneP = { id: row.id, nome: row.nome, testo: row.testo, pagine: 0, idoli: 0, stanze: row.incontroDopoStanze || 0 };
  log(`Missione: ${row.nome} – ${row.testo}`);
  if (row.id === 'p-mis-servitore') { const i = await G.monstroDa('seguaci'); m.servitore = i.nome; log(`Il servitore fuggito è un tipo di «${i.nome}».`); }
  if (row.id === 'p-mis-fosse') await iniziaSezione('fosse');
  modificato(); return `Missione «${row.nome}».`;
}
async function missioneNemico() {
  const m = adv().missioneP; m.apparso = true;
  const tab = await scelta('Il tuo nemico', 'Un maggiore a caso viene incontrato: da quale tabella?', [['aberranti', 'Mostri aberranti'], ['boss', 'Mostri boss']]);
  const i = await G.monstroDa(tab || 'boss'); G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); log(`Missione: il nemico è ${i.nome}.`);
}
/** Completa la missione in corso con le ricompense del manuale. */
export async function completaMissione() {
  const m = adv().missioneP; if (!m) return;
  const tesoro = async () => { const o = await tesoroMagico(); bottino(o); log(`Ricompensa della missione: ${o.testo}`); };
  switch (m.id) {
    case 'p-mis-servitore': case 'p-mis-nemico': case 'p-mis-pagine': G.aggiungiES(`Missione «${m.nome}»`); await tesoro(); break;
    case 'p-mis-tre-oggetti': { G.aggiungiES(`Missione «${m.nome}»`); const e = await K.eroeScelto('Chi riceve le informazioni segrete (3 indizi)?'); if (e) for (let k = 0; k < 3; k++) await G.aggiungiIndizio(e, { semplice: true }); break; }
    case 'p-mis-idoli': { const k = await scelta('Pellegrinaggio agli idoli', 'Ricompensa a scelta:', [['es', '1 tiro ES a testa per tutti i personaggi'], ['tesoro', '1 tesoro magico eroico']]); if (k === 'es') for (const e of eroiVivi()) G.aggiungiES(`Pellegrinaggio: ${e.nome}`, false, 1, { soloEroe: e.id }); else { const o = await tesoroMagico('eroico'); bottino(o); } break; }
    case 'p-mis-fosse': { G.aggiungiES(`Missione «${m.nome}»`); const tutti = [...new Set([...R.equipaggiamento.incantesimi.map(s => s.nome), ...A.NOMI_AVANZATI(), ...NOMI_INCANTESIMI()])]; const n = await scelta('Fosse oscure', 'Scegli l’incantesimo della pergamena:', tutti.map(x => [x, x])); if (n) bottino({ tipo: 'pergamena', testo: `Pergamena: ${n}`, incantesimo: n }); break; }
  }
  log(`Missione «${m.nome}» compiuta.`); adv().missioneP = null; modificato();
}

// =============================================================
//  TESORI
// =============================================================
/** Un tesoro magico adatto al grado (d6 eroico, d10 leggendario). */
export async function tesoroMagico(grado) {
  const g = grado || gradoGruppo(), leg = g === 'leggendario';
  const r = leg ? await d10('Tesori magici leggendari (d10)') : await dado('Tesori magici eroici (d6)');
  return await creaMagico(riga(D().tabelle[leg ? 'tesoriMagiciLeggendari' : 'tesoriMagiciEroici'], r.totale));
}
async function creaMagico(row) {
  const o = { tipo: 'magico', nome: row.nome, testo: `${row.nome}: ${row.testo}`, abi: row.id };
  const gr = GR();
  switch (row.id) {
    case 'p-barca-fortunata': Object.assign(o, { cariche: 3, caricheMax: 3, incantesimo: 'Fortuna del Barcaiolo', solo: ['mago', 'elfo', 'elfo-fuoco'], manuale: false, valore: 120 }); break;
    case 'p-cristalli-ronzanti-1d3': case 'p-cristalli-ronzanti-1d6': { const n = (await tira(row.n, 'Cristalli ronzanti')).totale; Object.assign(o, { nome: 'Cristalli ronzanti', qta: n, testo: `Cristalli ronzanti ×${n}: ricaricano un oggetto monouso o salvano una pergamena dalla distruzione`, valore: n * 100 }); break; }
    case 'p-arma-leggendaria': { const x = await dado('Tipo di arma leggendaria (d6)'), t = riga(D().tabelle.armaLeggendariaTipo, x.totale).tipo; o.testo = `Arma leggendaria, ${t.replace(/\s*\(.*\)/, '')}: +${gr} ai tiri di attacco con questa arma (+GR)`; o.leggendaria = true; break; }
    case 'p-armatura-leggendaria': { const x = await dado('Tipo di armatura leggendaria (d6)'), t = riga(D().tabelle.armaturaLeggendariaTipo, x.totale); o.testo = `${t.tipo === 'armatura leggera' ? 'Armatura leggera' : 'Armatura pesante'} leggendaria: +${gr} ai tiri di difesa oltre al normale bonus${(await dado('Non metallica? (1-2)')).totale <= 2 ? ' (non metallica)' : ''}`; o.leggendaria = true; o.valore = t.prezzo; break; }
    case 'p-scudo-leggendario': o.leggendaria = true; break;
  }
  return o;
}
const ES_RIGHE = () => D().tabelle.tesori;
/** Tabella Tesori (d10 con righe estreme): sostituisce quella base nelle Profondità. Restituisce il testo del risultato. */
export async function tesoro(mod = 0, ctx = {}, prof = 0) {
  const r = await d10(`Tabella Tesori (d10${mod ? (mod > 0 ? '+' : '') + mod : ''})`), v = r.totale + mod, row = riga(ES_RIGHE(), v), molt = ctx.molt || 1, voci = [];
  const aggiungi = o => { bottino(o); voci.push(o.testo); };
  const esegui = async rr => {
    switch (rr.azione) {
      case 'cibo-vino': { const n = (await tira('1d6x10', 'Razioni di cibo')).totale, b = (await tira('1d6', 'Bottiglie di vino')).totale; aggiungi({ tipo: 'oggetto', testo: `Razioni di cibo ×${n}`, nome: 'Razioni', qta: n }); aggiungi({ tipo: 'oggetto', testo: `${b} bottiglie di vino pregiato (10 p.o. ciascuna)`, valore: b * 10 }); return; }
      case 'attrezzature': aggiungi({ tipo: 'oggetto', testo: 'Attrezzature comuni fino a 50 p.o. (a scelta da qualsiasi tabella di equipaggiamento)' }); return;
      case 'oro': {
        if (rr.unaVoltaPerAvventura) { if (adv().setaTrovata) return esegui(riga(ES_RIGHE(), (await d10('Rotolo di seta già trovato: ritira')).totale)); adv().setaTrovata = true; }
        const q = (await tira(rr.dadi, 'Valore del rotolo di seta')).totale * molt; aggiungi({ tipo: 'gemma', testo: `Rotolo di seta preziosa da ${q} p.o.`, valore: q }); return;
      }
      case 'scelta': { const k = await scelta(rr.nome, 'Scegli cosa prendi:', rr.opzioni.map((o, n) => [n, o.testo])); return esegui(rr.opzioni[k ?? 0]); }
      case 'arma-perfetta': aggiungi({ tipo: 'oggetto', testo: 'Arma perfetta (a scelta del tipo): +1 alla probabilità di esplosione dei tiri di attacco; non magica' }); return;
      case 'gemma': { const q = (await tira(rr.dadi, 'Valore della gemma')).totale * molt; aggiungi({ tipo: 'gemma', testo: `Gemma da ${q} p.o.`, valore: q }); return; }
      case 'gioiello': { const q = (await tira(rr.dadi, 'Valore del gioiello')).totale * molt; aggiungi({ tipo: 'gioiello', testo: `Gioiello da ${q} p.o.`, valore: q }); return; }
      case 'maschere': { const n = (await tira(rr.n, 'Maschere di Thar-Tizan')).totale; aggiungi({ tipo: 'magico', nome: 'Maschera di Thar-Tizan', testo: `Maschera di Thar-Tizan ×${n}: annulla 1 evento che darebbe follia (poi si distrugge); immune alla Nebbia da incubo`, qta: n, valore: 50 * n }); return; }
      case 'armi-argento': aggiungi({ tipo: 'oggetto', testo: 'Arma da mischia d’argento (a scelta del tipo)', qta: rr.n, valore: rr.valorePo }); return;
      case 'frecce-leggendarie': aggiungi({ tipo: 'magico', nome: 'Frecce o dardi magici leggendari', testo: `Frecce o dardi magici leggendari: +${GR()} (GR) all’attacco, monouso`, cariche: rr.n, caricheMax: rr.n, manuale: true, valore: rr.valorePo * rr.n }); return;
      case 'arco-perfetto': aggiungi({ tipo: 'oggetto', testo: 'Arco perfetto con 24 frecce a punta d’argento (+1 alla probabilità di esplosione)', valore: rr.valorePo }); return;
      case 'pozioni-guarigione': for (let k = 0; k < rr.n; k++) aggiungi({ tipo: 'magico', nome: 'Pozione di guarigione', testo: 'Pozione di guarigione: recupera tutti i PV, azione gratuita, monouso, non per barbari', noBarbaro: true }); return;
      case 'pergamene-caso': for (let k = 0; k < rr.n; k++) { const leg = gradoGruppo() === 'leggendario', x = await dado('Incantesimo a caso (d6)'), n = riga(D().tabelle[leg ? 'incantesimoLeggendarioCaso' : 'incantesimoEroicoCaso'], x.totale).nome; aggiungi({ tipo: 'pergamena', testo: `Pergamena: ${n}`, incantesimo: n }); } return;
      case 'indizi': { const e = await K.eroeScelto('Chi legge le informazioni segrete (2 indizi)?'); if (e) { for (let k = 0; k < rr.n; k++) await G.aggiungiIndizio(e, { semplice: true }); voci.push(`2 indizi a ${e.nome}`); } return; }
      case 'tesoro-magico': for (let k = 0; k < (ctx.finale ? 2 : rr.n); k++) aggiungi(await tesoroMagico()); return;
      case 'ritira': {
        if (prof >= 3) return;
        const k = await scelta('Tira ancora', 'Tira 2 volte su questa tabella, oppure 4 volte (ma con 4 su 1d6 mostri erranti che sorprendono gli eroi mentre raccolgono).', [[2, '2 tiri'], [4, '4 tiri (rischio erranti)']]);
        for (let n = 0; n < (k || 2); n++) voci.push(await tesoro(0, ctx, prof + 1));
        if (k === 4 && (await dado('Erranti mentre raccogli? (1-4)')).totale <= 4) { const m = await G.monstroErrante(); G.avviaIncontro(m, G.tileById(adv().stanzaCorrente)); }
      }
    }
  };
  await esegui(row);
  if (ctx.finale) bottino({ tipo: 'oggetto', testo: 'Boss finale: monete triplicate (o almeno 100 p.o.) e 2 oggetti magici se ce n’è uno (applicalo a mano a ciò che hai trovato)' });
  const testo = voci.filter(Boolean).join('; ') || 'nessun tesoro';
  log(`Tesoro (${v}): ${testo}`); modificato();
  return prof ? testo : `Tesoro: ${testo}`;
}
/** Oggetti magici con effetto automatico nell'equipaggiamento: riconosce le versioni leggendarie, perfette e speciali. */
export function marcaEquip(e, o, id, tipo) {
  const t = `${o.nome || ''} ${o.nota || ''}`;
  if (tipo === 'arma') {
    if (/perfett/i.test(t) || /ossidiana/i.test(t)) (e.armiPerfette = e.armiPerfette || []).push(id);
    if (/leggendari/i.test(t)) (e.armiLeggendarie = e.armiLeggendarie || []).push(id);
    if (/bastone da mago leggendario/i.test(t)) e.bastoneLeggendario = true;
  } else if (tipo === 'armatura') { e.armaturaPerfetta = /perfett/i.test(t); e.armaturaLeggendaria = /leggendari/i.test(t); }
  else if (tipo === 'scudo') e.scudoLeggendario = /leggendari/i.test(t);
}

// =============================================================
//  SEZIONI ANNIDATE: rovine, tumuli, fosse, idolo segreto e Cittadelle (strumenti guidati, senza mappa)
// =============================================================
const SEZIONI = {
  rovine: { nome: 'Rovine', expr: '1d6+2', tabella: 'contenutoRovine' },
  tumulo: { nome: 'Tumulo', expr: '1', tabella: 'contenutoRovine' },
  fosse: { nome: 'Fosse oscure', expr: '1d6+3', tabella: 'contenuto' },
  'idolo-segreto': { nome: 'Idolo segreto', expr: '1d6+3', tabella: 'contenuto' }
};
export async function iniziaSezione(tipo) {
  if (adv().sezione && !(await confirmBox(`Sei già in «${adv().sezione.nome}»: la abbandoni per iniziare un’altra sezione?`))) return;
  const d = SEZIONI[tipo], n = d.expr === '1' ? 1 : await tiraExpr(d.expr, `Numero di stanze: ${d.nome}`);
  adv().sezione = { tipo, nome: d.nome, totale: n, fatte: 0, tabella: d.tabella };
  log(`${d.nome}: ${n} stanz${n === 1 ? 'a' : 'e'}${tipo === 'rovine' ? ' (nessun boss finale)' : ''}. Usa «Genera la prossima stanza» (disegna la mappa a parte).`);
  modificato();
}
export function chiudiSezione() {
  const s = adv().sezione; if (!s) return;
  adv().sezione = null; if (s.tipo === 'cittadella') adv().cittadella = null;
  for (const e of S.party.eroi) e.tumuloCariche = 0;
  log(`Fine di «${s.nome}».`); modificato();
}
/** Una stanza della sezione in corso: tira il contenuto e lo risolve. Restituisce {testo, vuota} o null se la sezione è finita (e viene chiusa). */
export async function stanzaSezione(t) {
  const s = adv().sezione; if (!s) return null;
  if (s.fatte >= s.totale) { chiudiSezione(); return null; }
  s.fatte++;
  const ultima = s.fatte >= s.totale;
  let x;
  if (s.tipo === 'cittadella') x = await stanzaCittadella(s, t, ultima);
  else if (s.tipo === 'fosse' && ultima && !(s.occupanti)) {   // se non c'è stato alcun occupante, l'ultima stanza ha un aberrante con PV +50%
    const r = await tira('2d6', `Contenuto: ${s.nome} (2d6)`), row = riga(D().tabelle.contenuto, r.totale); x = await risolviContenuto(row, t, {});
    if (!C.inc() || C.inc().stato === 'finito') { const i = await G.monstroDa('aberranti'); i.pvMax = i.pv = Math.ceil(i.pvMax * 1.5); G.avviaIncontro(i, t || G.tileById(adv().stanzaCorrente)); x.testo += ` Nessun occupante: aberrante con PV +50% (${i.nome}).`; }
  } else {
    const r = await tira('2d6', `Contenuto: ${s.nome} (2d6)`), row = riga(D().tabelle[s.tabella], r.totale);
    x = await risolviContenuto(row, t, { aberranteSolo: s.tabella === 'contenutoRovine', bossFinaleOk: false });
    x.testo = `${r.totale}: ${row.testo} → ${x.testo}`;
    if (C.inc() && C.inc().stato !== 'finito') s.occupanti = true;
    if (s.tipo === 'idolo-segreto' && ultima) x.testo += ' Ultima stanza: ' + await idoloSegretoFine();
  }
  const prefisso = `${s.nome} ${s.fatte}/${s.totale}: `;
  x.testo = prefisso + x.testo; if (ultima) x.testo += ' (ultima stanza: poi esci)';
  return x;
}
/** Pulsante «Genera la prossima stanza» degli strumenti (senza tessera sulla mappa). */
export async function prossimaStanzaStrumenti() {
  const t = G.tileById(adv().stanzaCorrente), x = await stanzaSezione(t);
  if (!x) return toast('Le stanze della sezione sono finite: sezione chiusa.');
  log(x.testo); modificato();
}
async function idoloSegretoFine() {
  const k = await scelta('Idolo segreto: ultima stanza', 'Trovi a tua scelta:', [['tesoro', '1 tiro sulla tabella Tesori'], ['incantesimo', '1 incantesimo eroico inciso (un mago lo impara con un tiro ES)']]);
  if (k === 'incantesimo') { const x = await dado('Incantesimo eroico a caso (d6)'); aggiungiIscrizione(riga(D().tabelle.incantesimoEroicoCaso, x.totale).nome, 'idolo'); return 'iscrizione di un incantesimo eroico.'; }
  return await tesoro();
}
// ---- tumulo ----
export async function tumulo() {
  const incant = eroiVivi().filter(e => e.stato === 'ok' && (e.incantesimi || []).some(s => !s.usato) && e.classe !== 'elfo-fuoco');
  if (incant.length) {
    const ids = await sceltaMultipla('Tumulo', `Gli incantatori possono sfruttare l’energia del tumulo (tiro per lanciare LMP+5): se riesce, lanciano un incantesimo senza consumarlo, ma perdono 1 PV. Chi ci prova?`, incant.map(e => [e.id, e.nome]));
    for (const id of ids) {
      const e = eroePerId(id), L = livelloMax() + D().fiumi.regole.tumulo.tiroLancioLivMod;
      const r = await C.d6e(e, `Tumulo: tiro per lanciare di ${e.nome} (LMP+5 = ${L})`), tot = r.totale + modAttacco(e, { incantesimo: true, nomeIncantesimo: 'Tumulo', bersaglio: {} }).tot;
      if (r.naturale === 1) { const k = await scelta('Tumulo: 1 naturale', `${e.nome} deve scegliere:`, [['pv', 'Perde 1 PV'], ['inc', 'Dimentica 1 incantesimo']]); if (k === 'inc') { const s = e.incantesimi.find(x => !x.usato); if (s) s.usato = true; } else C.perdiPV(e, 1, 'tumulo'); }
      else if (tot >= L) { e.tumuloCariche = 1; nota(`${e.nome} sfrutta il tumulo (${tot} contro ${L}): il prossimo incantesimo non sarà consumato (perde 1 PV al lancio).`); }
      else nota(`${e.nome} non riesce a connettersi con l’energia del tumulo (${tot} contro ${L}).`);
    }
  }
  if ((await dado('Il tumulo è custodito? (1-2 su 1d6)')).totale <= 2) { const i = await G.monstroDa('incontriFluviali'); i.modReazioni = 1; G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); log(`Il tumulo è custodito da ${i.nome}: va affrontato prima della stanza (reazioni +1).`); }
  await iniziaSezione('tumulo');
}

// =============================================================
//  CITTADELLE
// =============================================================
export async function iniziaCittadella(forzata) {
  if (adv().sezione && !(await confirmBox(`Sei già in «${adv().sezione.nome}»: lo abbandoni per entrare in una Cittadella?`))) return;
  const row = forzata || riga(D().tabelle.cittadelle, (await dado('Tipo di Cittadella (d6)')).totale);
  const n = await tiraExpr(row.stanze, `Stanze della ${row.nome}`);
  adv().cittadella = { tipo: row.id, nome: row.nome, stanze: n, regole: row.testo };
  adv().sezione = { tipo: 'cittadella', nome: row.nome, totale: n, fatte: 0, tabella: 'contenuto', cit: row.id };
  log(`${row.nome} (${n} stanze): ${row.testo}`);
  if (row.id === 'p-cit-fantasma') {
    for (const e of eroiVivi()) K.follia(e, 1);
    const L = livelloMax() + 6;
    for (const e of vivi()) if (!(await C.salva(e, L, mezzo(e) + (e.classe === 'mago' ? 1 : 0), `Cittadella fantasma (magia, L${L})`))) await allucinazione(e);
  }
  if (row.id === 'p-cit-magica') log('La Resistenza alla magia è sospesa per tutta la Cittadella.');
  modificato();
}
async function stanzaCittadella(s, t, ultima) {
  const cit = s.cit, aperto = i => G.avviaIncontro(i, t || G.tileById(adv().stanzaCorrente));
  if (ultima && cit === 'p-cit-fantasma') {
    const i = await G.monstroDa('aberrantiCittadella'), f = creaIncontro('aberrantiCittadella', D().mostri.aberrantiCittadella.find(m => m.id === i.id), 1, { bossFinale: true });
    aperto(f); return { testo: `ultima stanza: ${f.nome} (BOSS FINALE)`, vuota: false };
  }
  if (ultima && cit === 'p-cit-magica') {
    const i = await G.monstroDa('aberrantiCittadella'); i.pvMax++; i.pv++; i.dopoVittoria = 'idolo'; i.immuneCittadella = true; aperto(i);
    return { testo: `ultima stanza: idolo ciclopico custodito da ${i.nome} (PV +1, immune agli incantesimi della Cittadella); sconfitto, tira su Idoli ciclopici`, vuota: false };
  }
  const r = await tira('2d6', `Contenuto della Cittadella (2d6)`), row = riga(D().tabelle.contenuto, r.totale);
  const x = await risolviContenuto(row, t, { cit, bossFinaleOk: !['p-cit-fantasma', 'p-cit-magica'].includes(cit) });
  x.testo = `${r.totale}: ${row.testo} → ${x.testo}`;
  if (cit === 'p-cit-magica' && (await dado('Idolo o altare in questa stanza? (1 su 1d6)')).totale === 1) {
    if ((await dado('Idolo (1-3) o altare (4-6)')).totale <= 3) { const q = await dado('Idolo: statua (1-3) o tabella Idoli (4-6)'); x.testo += q.totale <= 3 ? ' Un idolo: è solo una statua.' : ' Un idolo: ' + await idolo(); }
    else { const q = await dado('Incantesimo eroico inciso sull’altare (d6)'); aggiungiIscrizione(riga(D().tabelle.incantesimoEroicoCaso, q.totale).nome, 'altare'); x.testo += ' Un altare con un incantesimo eroico inciso.'; }
  }
  return x;
}
/** Un aberrante della Cittadella (tabella a parte). */
export async function aberranteCittadella() { const i = await G.monstroDa('aberrantiCittadella'); G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); log(`Aberrante della Cittadella: ${i.nome}.`); }
export const rmSospesa = () => adv().cittadella?.tipo === 'p-cit-magica';
export const curaVietata = () => adv().cittadella?.tipo === 'p-cit-cose-morte';
export async function usciCittadella() {
  const c = adv().cittadella; if (!c) return;
  if (c.tipo === 'p-cit-prigionieri' && !(await spendiIndizi(4))) return;   // i cancelli si chiudono: l'uscita segreta costa 4 indizi
  chiudiSezione();
}

// =============================================================
//  IDOLI CICLOPICI
// =============================================================
export async function idolo() {
  let v = (await dado('Idoli ciclopici (d6)')).totale; if (v === 1 && adv().idoloFuggito) v = 2;
  const row = riga(D().tabelle.idoli, v); log(`Idolo ciclopico: ${row.nome}.`);
  if (adv().missioneP?.id === 'p-mis-idoli') adv().missioneP.idoli++;
  switch (row.id) {
    case 'p-idolo-gemme': {
      const e = await K.eroeScelto('Idolo delle gemme: chi si arrampica? (L = LMP+1)', x => x.stato === 'ok'); if (!e) return row.nome;
      const L = livelloMax() + 1, ok = await C.salva(e, L, bonusClasse(e, row.salvezzaArrampicata.bonus), `Scalare l’idolo: arrampicarsi (L${L})`);
      if (!ok) { C.perdiPV(e, row.salvezzaArrampicata.caduta.pv, 'caduta dall’idolo'); return `${e.nome} non riesce a salire (cade con un 1: 2 PV).`; }
      if ((await dado('Gemme in testa? (1-3 su 1d6)')).totale > 3) return `${e.nome} sale ma in testa non c’è nulla.`;
      const n = (await tira('1d3', 'Gemme sulla testa')).totale; let testo = `${e.nome} trova ${n} gemme.`;
      for (let k = 0; k < n; k++) {
        const q = (await tira('1d6x20', 'Valore della gemma')).totale; bottino({ tipo: 'gemma', testo: `Gemma da ${q} p.o.`, valore: q });
        if ((await dado(`Trappola magica sulla gemma ${k + 1}? (1 su 1d6)`)).totale === 1 && !(await C.salva(e, L, mezzo(e), `Trappola magica della gemma (L${L})`))) { C.perdiPV(e, GR(), 'trappola della gemma'); if (e.stato === 'ok' && !(await C.salva(e, L, 0, `Caduta dall’idolo (L${L})`))) C.perdiPV(e, 2, 'caduta dall’idolo'); }
      }
      return testo;
    }
    case 'p-idolo-cammina': { const i = creaSpeciale('p-idolo-che-cammina'); G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); return `L’idolo cammina: ${i.nome} ti attacca.`; }
    case 'p-idolo-segreto': {
      if (!(await confirmBox('Il piedistallo ha una porta segreta (1 indizio, o perquisire senza limiti ma ogni 1 attira gli erranti). La apri e la esplori?'))) return 'Idolo segreto: ignorato.';
      await iniziaSezione('idolo-segreto'); return 'Idolo segreto: dungeon di 1d6+3 stanze.';
    }
    case 'p-idolo-allucinante': { let n = 0; for (const e of vivi().filter(x => !x.vampirizzato)) { C.perdiPV(e, 1, 'idolo allucinante'); if (e.stato === 'ok' && (await dado(`Visioni di ${e.nome}: indizio? (1 su 1d6)`)).totale === 1) { await G.aggiungiIndizio(e); n++; } } return `Tutti perdono 1 PV; ${n} indizi dalle visioni.`; }
    case 'p-idolo-profezia': {
      const k = await scelta('Idolo della profezia', 'Una dama in nera ti permette una domanda. Se la attacchi, la corteggi o le lanci un incantesimo scompare.', [['indizio', 'Sacrifica 1 tesoro magico eroico per 1 indizio'], ['missione', 'Tira una Missione (un PG a caso muore a fine avventura se non la compi)'], [null, 'Niente']]);
      if (k === 'indizio') { const e = await K.eroeScelto('Chi ottiene l’indizio? (rimuovi a mano il tesoro magico sacrificato)'); if (e) await G.aggiungiIndizio(e); }
      else if (k === 'missione') { await missione(); adv().missioneP.rischioMorte = true; }
      return 'Idolo della profezia.';
    }
    case 'p-idolo-magia': { const x = await dado('Incantesimo eroico a caso (d6)'); aggiungiIscrizione(riga(D().tabelle.incantesimoEroicoCaso, x.totale).nome, 'idolo'); return 'Incantesimo eroico inciso sul piedistallo.'; }
  }
  return row.nome;
}

// =============================================================
//  FIUMI: natura, barca e barcaiolo, tratti, pericoli, sbarco
// =============================================================
const FIUME_TXT = { 'p-rivo-evocazione': 'a ogni tratto puoi ottenere indizi in cambio di altrettanta follia', 'p-rivo-fiamma': 'sorpresa +1, TS fuoco LMP+2 a ogni tratto, la barca non ignifuga può bruciare', 'p-rivo-lacrime': 'una morte dà 1 follia a tutti, niente riposo', 'p-rivo-morte': 'attacchi +1, difese -1, guarigioni dimezzate', 'p-rivo-oblio': 'un 1 su un tiro per lanciare fa dimenticare un incantesimo', 'p-rivo-serpe': 'maggiori con LIV +1, barca a -2' };
export async function naturaFiume() {
  if (adv().fiume && !(await confirmBox(`Hai già il ${adv().fiume.nome}: un altro fiume si tira di nuovo. Lo sostituisci?`))) return;
  const row = riga(D().tabelle.naturaFiume, (await dado('Natura del fiume (d6)')).totale), f = D().fiumi.elenco.find(x => x.id === row.fiume);
  adv().fiume = { id: f.id, nome: f.nome, tratti: 0, barca: null, barcaiolo: null, sulFiume: true, fiamma: 0, ignifuga: false, fortuna: false };
  log(`${f.nome}: ${f.effetto}`);
  if (f.id === 'p-rivo-oblio') { const e = await K.eroeScelto('Rivo dell’Oblio: a chi togli 1 punto follia?', x => (x.follia || 0) > 0 && x.stato !== 'morto'); if (e) K.follia(e, -1); }
  modificato();
}
const haBarcaiolo = () => eroiVivi().filter(e => e.stato === 'ok' && haAbilita(e, 'p-barcaiolo')).length + (adv().fiume?.barcaiolo?.automa ? 1 : 0);
/** Uscita sul fiume (UF): 4 su 1d6 di trovare una barca; senza incontro un barcaiolo offre il passaggio. */
export async function uscitaFiume() {
  if (!adv().fiume) await naturaFiume(); const f = adv().fiume; if (!f) return;
  if ((await dado('Barca all’uscita sul fiume? (1-4 su 1d6)')).totale > 4) { log('Nessuna barca all’uscita sul fiume.'); return; }
  f.barca = 'ok'; log('C’è una barca all’uscita sul fiume.');
  const r = await dado('Barcaiolo (d6)'), b = riga(D().tabelle.barcaiolo, r.totale), cr = spec(b.creatura);
  if (b.rifiutaSeGruppoHaAltriElfi && eroiVivi().some(e => ['elfo', 'elfo-fuoco'].includes(e.classe))) { log('Il barcaiolo elfo oscuro rifiuta il servizio perché nel gruppo c’è un altro tipo di elfo.'); return; }
  const costo = cr.servizio.costoPoPerPGPerViaggio * vivi().length;
  const k = await scelta(cr.nome, `${cr.note} Costo del viaggio: ${costo} p.o. (il gruppo ha ${oroGruppo()}).`, [['paga', `Paga ${costo} p.o. e sali a bordo`], ['attacca', 'Attaccalo'], [null, 'Rinuncia']]);
  if (k === 'paga') { if (oroGruppo() < costo) return toast('Oro insufficiente.', 'warn'); prendiOro(costo); f.barcaiolo = { id: cr.id, nome: cr.nome, automa: !!cr.abilitaBarcaiolo }; f.sulFiume = true; log(`${cr.nome} porta il gruppo sul fiume (${costo} p.o.).`); }
  else if (k === 'attacca') { const i = creaSpeciale(cr.id); i.reazione = { azione: 'combatte-sempre', tiro: 0 }; G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); }
  modificato();
}
export async function ignifuga() {
  const f = adv().fiume; if (!f?.barca) return toast('Serve una barca.', 'warn');
  const k = await scelta('Barca ignifuga', 'Come la rendi ignifuga?', [['fortuna', 'Fortuna del Barcaiolo (lanciata a mano)'], ['conciatore', 'Conciatore arcano con pelle di drago (1 ora = 6 tiri erranti)'], ['alchimista', 'Alchimista: 20 p.o.']]);
  if (!k) return;
  if (k === 'alchimista') { if (oroGruppo() < 20) return toast('Servono 20 p.o.', 'warn'); prendiOro(20); }
  f.ignifuga = true; log('La barca è ignifuga.'); modificato();
}
/** Un nuovo tratto di fiume: d66 sulla mappa (le lettere vanno lette sulla mappa), caratteristica, effetti del fiume e pericolo. */
export async function nuovoTratto() {
  const f = adv().fiume; if (!f?.sulFiume) return toast('Determina prima il fiume e sali a bordo (Natura del fiume / Uscita sul fiume).', 'warn');
  const m = await d66('Tratto di fiume (d66: cerca la casella nella mappa delle pp. 36-37)');
  f.tratti++; log(`Tratto ${f.tratti} del ${f.nome}: d66 = ${m.totale}.`);
  if (f.id === 'p-rivo-fiamma') await entrataFiamma(f);
  if (f.id === 'p-rivo-evocazione') for (const e of vivi()) { const k = await scelta(`Rivo dell’Evocazione – ${e.nome}`, 'Quanti indizi vuoi in cambio di altrettanti punti follia?', [[0, 'Nessuno'], [1, '1 indizio (+1 follia)'], [2, '2 indizi (+2 follia)'], [3, '3 indizi (+3 follia)']]); for (let n = 0; n < (k || 0); n++) { K.follia(e, 1); await G.aggiungiIndizio(e, { semplice: true }); } }
  if ((await dado('Minaccia sul tratto? (1-2 su 1d6)')).totale <= 2) await pericolo();
  const lettera = await scelta('Caratteristica del tratto', 'La mappa riporta una lettera su questo tratto?', [['n', 'Nessuna (tira 1d6: 5-6 caratteristica)'], ['P', 'P: ponte'], ['R', 'R: rovine'], ['T', 'T: tumulo'], ['FINE', 'FINE: il fiume non è più navigabile'], ['IC', 'IC: ingresso a una Cittadella'], [null, 'Nulla di notevole']]);
  let c = lettera;
  if (c === 'n') { if ((await dado('Caratteristica? (5-6 sì)')).totale >= 5) c = ['P', 'P', 'R', 'R', 'T', 'T'][(await dado('Natura: 1-2 ponte, 3-4 rovine, 5-6 tumulo')).totale - 1]; else c = null; }
  if (c === 'P') await ponte(); else if (c === 'R') { if (await confirmBox('Un edificio in rovina: lo esplori?')) await iniziaSezione('rovine'); } else if (c === 'T') { if (await confirmBox('Un tumulo dei Precursori: lo visiti?')) await tumulo(); } else if (c === 'FINE') await fineFiume(); else if (c === 'IC' && await confirmBox('Un ingresso a una Cittadella: la esplori?')) await iniziaCittadella();
  modificato();
}
async function entrataFiamma(f) {
  const L = livelloMax() + 2;
  for (const e of vivi()) {
    if (e.classe === 'elfo-fuoco') { nota(`${e.nome} (elfo del fuoco) è immune al fuoco del fiume.`); continue; }
    if (!(await C.salva(e, L, 0, `Rivo della Fiamma: fuoco (L${L})`))) {
      const fuoco = (e.incantesimi || []).find(s => !s.usato && /fuoco/i.test(s.nome));
      if (fuoco && await confirmBox(`${e.nome} può sacrificare ${fuoco.nome} per evitare il danno. Lo fai?`)) fuoco.usato = true; else C.perdiPV(e, 1, 'acque bollenti');
    }
  }
  f.fiamma++;
  if (f.ignifuga || f.fortuna || !f.barca || f.barca === 'distrutta') return;
  const x = await dado(`La barca brucia? (1d6 + ${f.fiamma} consecutivi, 6+ = distrutta)`);
  if (x.totale + f.fiamma < 6) return;
  f.barca = 'distrutta'; f.sulFiume = false; nota('La barca è distrutta dalle acque bollenti: tutti subiscono danni automatici e devono nuotare fino a riva.');
  for (const e of vivi()) {
    C.perdiPV(e, GR(), 'acque bollenti');
    while (e.stato === 'ok' && !(await C.salva(e, 8, 0, `Rivo della Fiamma: nuotare (L8)`))) C.perdiPV(e, 2, 'acque bollenti');
    if (e.stato === 'morto') e.nonResuscitabile = true;
  }
  await barcaDistrutta();
}
async function barcaDistrutta() {
  const f = adv().fiume; f.barca = 'distrutta'; f.sulFiume = false;
  if (f.barcaiolo) { log(`${f.barcaiolo.nome} ${(await dado('Il barcaiolo muore (1-3) o fugge (4-6)')).totale <= 3 ? 'muore' : 'fugge'}.`); f.barcaiolo = null; }
  log('La barca è andata: il gruppo prosegue a piedi (genera un nuovo dungeon a parte).');
}
async function ponte() {
  if ((await dado('Il ponte è sorvegliato? (1-2 su 1d6)')).totale <= 2) { const i = await G.monstroDa('incontriFluviali'); G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); log(`Il ponte è sorvegliato da ${i.nome}.`); }
  if (await confirmBox('Sbarchi al ponte e prosegui a piedi? (un nuovo dungeon da generare a parte)')) await sbarca(); else log('Il gruppo passa sotto il ponte e prosegue sul fiume.');
}
async function fineFiume() {
  if (await confirmBox('Il fiume non è più navigabile. Sbarchi e prosegui a piedi? (lasci la barca: 5 su 1d6 che ci sia ancora al ritorno)')) await sbarca();
}
export async function sbarca() {
  const f = adv().fiume; if (!f) return;
  if (f.barca === 'ok' || f.barca === 'danneggiata') { f.barca = 'ormeggiata'; f.sulFiume = false; log('Il gruppo sbarca lasciando la barca: al ritorno ci sono 5 probabilità su 1d6 che sia ancora lì.'); }
  else f.sulFiume = false;
  modificato();
}
export async function ritrovaBarca() {
  const f = adv().fiume; if (f?.barca !== 'ormeggiata') return;
  if ((await dado('La barca è ancora qui? (1-5 su 1d6)')).totale <= 5) { f.barca = 'ok'; f.sulFiume = true; log('La barca è ancora qui.'); } else { f.barca = 'distrutta'; log('La barca è sparita.'); }
  modificato();
}
/** Pericolo fluviale (con l'abilità Barcaiolo o il barcaiolo automa si tira 2 o 3 volte e si sceglie). */
export async function pericolo() {
  const f = adv().fiume; if (!f) return;
  const nb = haBarcaiolo(), volte = nb >= 2 ? 3 : nb === 1 ? 2 : 1, righe = [];
  for (let k = 0; k < volte; k++) righe.push(riga(D().tabelle.pericoliFluviali, (await dado(`Pericolo fluviale (d6)${volte > 1 ? ` – tiro ${k + 1}` : ''}`)).totale));
  const scelto = righe.length === 1 ? righe[0].id : await scelta('Barcaiolo', 'Scegli il pericolo:', righe.map(x => [x.id, x.nome, x.testo])), row = righe.find(x => x.id === scelto);
  if (!row) return;
  log(`Pericolo fluviale: ${row.nome} – ${row.testo}`);
  if (f.fortuna) { f.fortuna = false; log('Fortuna del Barcaiolo: il gruppo evita il primo pericolo fluviale.'); if (row.azione === 'imboscata') { const i = await G.monstroDa('incontriFluviali'); i.fortunaBarcaiolo = true; G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); log(`${i.nome} attacca ma il gruppo non è sorpreso e ha +${GR()} a tutti gli attacchi e le difese.`); } return; }
  switch (row.azione) {
    case 'tempo': if ((await dado('Mostri erranti durante la perdita di tempo (1 su 1d6)')).totale <= A.sogliaErranti()) { const m = await G.monstroErrante(); G.avviaIncontro(m, G.tileById(adv().stanzaCorrente)); } break;
    case 'barca-danneggiata': if (f.barca === 'danneggiata') await barcaDistrutta(); else { f.barca = 'danneggiata'; log('La barca è danneggiata: al prossimo risultato uguale sarà distrutta.'); } break;
    case 'imboscata': { const i = await G.monstroDa('incontriFluviali'); i.sorpresa = true; i.mostriPrima = true; G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); break; }
    case 'fantasmi': {
      const L = livelloMax();
      for (const e of vivi()) {
        if (!(await C.salva(e, L, bonusClasse(e, { salvaComeChierico: 'L', altri: '1/2L' }), `Fantasmi del fiume (paura, L${L})`))) { const k = await scelta(`${e.nome}: fantasmi del fiume`, 'Scegli il prezzo.', [['follia', '1 punto follia'], ['pv', 'Perdi 2 PV']]); if (k === 'pv') C.perdiPV(e, 2, 'fantasmi del fiume'); else K.follia(e, 1); }
      }
      break;
    }
    case 'teletrasporto': {
      const bonus = f.barcaiolo ? 9 : Math.max(0, ...eroiVivi().filter(e => haAbilita(e, 'p-barcaiolo')).map(e => e.livello)), r = await dado(`Teletrasporto: il barcaiolo salva L8 (1d6+${bonus})`);
      log(`La barca è teletrasportata su un altro tratto del fiume (a caso, se ce ne sono altri sulla mappa).`);
      if (r.totale + bonus < 8) { f.barca = 'danneggiata'; log('Il teletrasporto danneggia la barca.'); } break;
    }
    case 'caratteristica-scelta': {
      const k = await scelta('Caratteristica speciale', 'Il tratto ha a tua scelta:', [['IC', 'Ingresso di una Cittadella'], ['P', 'Ponte'], ['T', 'Tumulo'], [null, 'Ignora']]);
      if (k === 'P') await ponte(); else if (k === 'T') await tumulo(); else if (k === 'IC') await iniziaCittadella(); break;
    }
  }
  modificato();
}

// =============================================================
//  SEGRETI EROICI E LEGGENDARI (5 o 6 indizi, nessun tiro ES)
// =============================================================
export const sogliaIndizi = e => (profonditaAttiva() && gradoAlto(e) ? D().segretiRegola[gradoDi(e) === 'leggendario' ? 'costoLeggendario' : 'costoEroico'] : null);
/** Un eroe di grado eroico o leggendario ha raggiunto la soglia di indizi: sceglie un segreto del manuale base, dell'Abisso o delle Profondità. */
export async function indizio(eroe) {
  const soglia = sogliaIndizi(eroe); if (!soglia || eroe.indizi < soglia) return;
  const leg = gradoDi(eroe) === 'leggendario';
  const k = await scelta(`${eroe.nome}: segreto scoperto (${soglia} indizi, nessun tiro ES)`, 'Che tipo di segreto vuoi?', [['base', 'Un segreto del manuale base'], ['abisso', 'Un segreto di «Contro l’Abisso»'], ['eroico', 'Un segreto eroico'], ...(leg ? [['leggendario', 'Un segreto leggendario']] : [])]);
  if (!k) return;   // finestra chiusa: gli indizi restano
  if (k === 'base') { eroe.indizi = 0; await G.scegliSegreto(eroe, { gratis: true }); return; }
  const lista = k === 'abisso' ? A.segretiDisponibili(eroe) : D().segreti.filter(s => s.grado === k);
  const id = await scelta(`${eroe.nome}: segreto`, 'Scegli un segreto:', lista.map(s => [s.id, s.nome, s.effetto]));
  const s = lista.find(x => x.id === id); if (!s) return;
  eroe.indizi = 0; eroe.segreti = [...(eroe.segreti || []), s.nome]; log(`${eroe.nome} sceglie il segreto «${s.nome}».`);
  if (k === 'abisso') await A.applicaSegreto(eroe, s); else await applicaSegretoP(eroe, s);
  modificato('party');
}
async function applicaSegretoP(e, s) {
  switch (s.id) {
    case 'p-seg-artefatto-eroico': adv().artefatto = { grado: 'eroico' }; log('Un artefatto eroico si trova nella prossima stanza che visiterai.'); break;
    case 'p-seg-artefatto-leggendario': adv().artefatto = { grado: 'leggendario' }; log('Un artefatto leggendario si trova nella prossima stanza che visiterai.'); break;
    case 'p-seg-passaggio-profondita': {
      const k = await scelta('Passaggio segreto', 'Verso dove?', [['idolo', 'Una camera con un idolo ciclopico'], ['cittadella', 'Un’entrata segreta a una Cittadella'], ['fiume', 'Un’entrata segreta a un fiume a tua scelta']]);
      if (k === 'idolo') log('Idolo scoperto: ' + await idolo()); else if (k === 'cittadella') await iniziaCittadella();
      else if (k === 'fiume') { const id = await scelta('Fiume', 'Quale?', D().fiumi.elenco.map(f => [f.id, f.nome])), f = D().fiumi.elenco.find(x => x.id === id); if (f) { adv().fiume = { id: f.id, nome: f.nome, tratti: 0, barca: null, barcaiolo: null, sulFiume: false, fiamma: 0, ignifuga: false, fortuna: false }; log(`${f.nome}: ${f.effetto} (serve una barca: usa «Uscita sul fiume» o ottienila come bottino).`); } }
      break;
    }
    case 'p-seg-ingresso-cittadella': {
      const a = riga(D().tabelle.cittadelle, (await dado('Cittadella (1° tiro)')).totale), b = riga(D().tabelle.cittadelle, (await dado('Cittadella (2° tiro)')).totale);
      const id = await scelta('Ingresso segreto', 'Scegli una delle due Cittadelle:', [[a.id, a.nome, a.testo], [b.id, b.nome, b.testo]]);
      await iniziaCittadella(a.id === id ? a : b); break;
    }
    case 'p-seg-iscrizione': { const x = await dado('Incantesimo leggendario a caso (d6)'); aggiungiIscrizione(riga(D().tabelle.incantesimoLeggendarioCaso, x.totale).nome, 'segreto'); log('L’iscrizione si trova nella prossima stanza: se è occupata devi prima sconfiggere, mettere in fuga o corrompere i mostri.'); break; }
    default: (e.segretiP = e.segretiP || []).push({ id: s.id, nome: s.nome });
  }
}
/** Segreti con effetto durante gli incontri (agnas, debolezza magica). */
export async function usaSegretoP(e, s) {
  const i = C.inc();
  if (s.id === 'p-seg-agnas') {
    if (!i || i.id !== 'p-uccello-agnas' || i.stato === 'finito') return toast('Serve l’uccello agnas in combattimento.', 'warn');
    const r = await C.d6e(e, `Benedizione contro la maledizione dell’agnas (LIV ${i.liv})`), tot = r.totale + (['chierico', 'mago'].includes(e.classe) ? e.livello : 0) + modAttacco(e, { incantesimo: true, nomeIncantesimo: 'Benedizione', bersaglio: i, ...C.contestoAttacco(e) }).tot;
    if (r.naturale !== 1 && tot >= i.liv) { nota(`${e.nome} spezza la maledizione (${tot} contro LIV ${i.liv}): la donna torna normale.`); G.aggiungiES('Segreto dell’agnas (tiro ES in più)'); i.tes = 'NO'; await C.applicaDanni(i.pv); if ((await dado('La donna si unisce al gruppo? (1-3 su 1d6)')).totale <= 3) nota('La donna (furfante di livello 1) si unisce al gruppo: creala dal pannello Gruppo.'); }
    else nota(`${e.nome} non riesce a spezzare la maledizione (${tot} contro LIV ${i.liv}).`);
  } else if (s.id === 'p-seg-debolezza-magica') {
    if (!i || i.stato === 'finito') return toast('Serve un incontro in corso.', 'warn');
    i.rmIgnorata = true; e.segretiP = (e.segretiP || []).filter(x => x !== s); nota('La Resistenza alla magia è ignorata per questo incontro.');
  }
  modificato();
}

// =============================================================
//  INCANTESIMI EROICI E LEGGENDARI (effetto in combattimento)
// =============================================================
export const AUTOMATICI = ['Benedizione di Massa', 'Fortuna del Barcaiolo', 'Contattare un Dio Dimenticato'];
const COND_BEN = ['maledetto', 'malattia', 'marchiato', 'orrore', 'campanellini', 'paralizzato', 'peste', 'muco', 'ruggito', 'malusAtt', 'malusAttGR', 'bloccato', 'legato', 'allucinato'];
const condizioni = x => COND_BEN.filter(k => x[k]).length + (x.sfortuna > 0 ? 1 : 0) + (x.stato === 'pietra' ? 1 : 0);
/** Incantesimi che non richiedono un tiro contro il LIV (Benedizione di Massa, Fortuna del Barcaiolo, Contattare un Dio Dimenticato). */
export async function lanciaAutomatico(e, nome, annulla) {
  const i = C.inc(), combatte = i?.stato === 'combattimento';
  if (nome === 'Benedizione di Massa') {
    const bers = eroiVivi().filter(x => x.stato !== 'morto'), costo = bers.length - 1 + bers.reduce((a, x) => a + condizioni(x), 0);
    for (const b of bers) { b.maledetto = false; b.malattia = false; b.sfortuna = 0; if (b.stato === 'pietra') b.stato = 'ok'; await A.dopoBenedizione(e, b); dopoBenedizione(b); }
    nota(`${e.nome} lancia Benedizione di Massa su ${bers.length} personagg${bers.length === 1 ? 'io' : 'i'}: ${costo} PV all’incantatore (1 per bersaglio oltre il primo e 1 per ogni condizione rimossa).`);
    if (costo > 0) C.perdiPV(e, costo, 'Benedizione di Massa');
  } else if (nome === 'Fortuna del Barcaiolo') {
    const f = adv().fiume; if (!f?.barca || f.barca === 'distrutta') { annulla(); return toast('Serve una barca su un fiume.', 'warn'); }
    f.fortuna = true; f.ignifuga = true; nota(`${e.nome} lancia Fortuna del Barcaiolo: il gruppo evita il primo pericolo fluviale e la barca è ignifuga per il viaggio.`);
  } else if (nome === 'Contattare un Dio Dimenticato') {
    const morti = S.party.eroi.filter(x => x.stato === 'morto' && !x.nonResuscitabile && !x.resuscitatoDio && !x.vampirizzato && !x.merc);
    const opz = [...(morti.length ? [['res', 'Resuscita un compagno morto da non più di 1 ora (una sola volta nella vita)']] : []), ...(combatte && !i.bossFinale ? [['uccidi', `Uccidi ${i.nome} (il TES è perso, conta per l’ES)`]] : [])];
    if (!opz.length) { annulla(); return toast('Nessun compagno da resuscitare e nessun mostro da uccidere.', 'warn'); }
    const k = await scelta('Contattare un Dio Dimenticato', `${e.nome} riceve 1 punto follia e perde 2 PV; poi sceglie:`, opz);
    if (!k) { annulla(); return; }
    K.follia(e, 1); C.perdiPV(e, 2, 'Contattare un Dio Dimenticato');
    if (k === 'res') {
      const id = await scelta('Resurrezione', 'Chi torna in vita?', morti.map(x => [x.id, `${x.nome} (${nomeClasse(x)})`])), x = eroePerId(id); if (x) { const min = { base: 1, esperto: 5, eroico: 10, leggendario: 15 }[gradoDi(x)], dl = Math.max(0, x.livello - min); x.livello = Math.min(x.livello, min); x.pvMax = Math.max(1, x.pvMax - dl); x.pv = Math.max(1, Math.floor(x.pvMax / 2)); x.stato = 'ok'; x.resuscitatoDio = true; nota(`${x.nome} torna in vita al livello ${x.livello} con metà PV (${x.pv}/${x.pvMax}), con le sue abilità.`); }
    } else { i.tes = 'NO'; nota(`${e.nome} invoca il dio: ${i.nome} è annientato.`); await C.applicaDanni(i.minore ? i.n : i.pv); }
  }
  modificato();
}
/** Incantesimi con un tiro per lanciare contro il LIV: l'esito è già calcolato in combat.lancia (c = {i, r, totale, L, base, colpisce}). */
export async function lanciaConTiro(e, nome, c) {
  const { i, r, L, base } = c, gr = GR(); let { totale, colpisce } = c;
  const danno = async q => { i.fonte = 'incantesimo'; await C.applicaDanni(q); };
  const falla = () => nota(`${base} → fallito.`);
  if (i.bloccatoDa === e.id && !['Pugno Arcano'].includes(nome)) { i.bloccatoMod = 0; i.bloccatoDa = null; }
  switch (nome) {
    case 'Fuoco della Verità': case 'Fornace dell\'Amuleto': {
      if (nome === 'Fuoco della Verità' && ['non-morto', 'artificiale'].includes(tipoViv(i))) { nota(`${base} → nessun effetto sui non-viventi.`); return; }
      if (nome === 'Fuoco della Verità' && r.naturale === 1) { const m = await G.monstroErrante(); G.avviaIncontro(m, G.tileById(adv().stanzaCorrente)); nota('Un 1 naturale: arrivano mostri erranti.'); }
      if (!colpisce) return falla();
      if (i.drago && !(i.tag || []).includes('non-morto')) { nota(`${base} → nessun effetto sui draghi.`); return; }
      if (i.pf?.risorge) i.fuocoTurno = true;
      const bonus = nome === 'Fuoco della Verità' && (i.tag || []).includes('caos') ? 1 : 0, comeMinori = i.minore || i.ordaP;
      const q = nome === 'Fornace dell\'Amuleto' ? gr : comeMinori ? Math.max(1, totale + bonus - L) : Math.max(1, Math.floor((totale + bonus) / L));
      nota(`${base} → ${comeMinori ? q + ' uccisi' : q + ' ferite'}.`); const pvPrima = i.pv; await danno(q);
      if (nome === 'Fuoco della Verità' && e.classe === 'mago' && await C.salva(e, L, e.livello, `Fuoco della Verità: visione (L${L})`)) await G.aggiungiIndizio(e);
      if (nome === 'Fornace dell\'Amuleto' && !i.minore && pvPrima > 0 && i.pv <= 0) await amuleto(e, i);
      return;
    }
    case 'Fulmine Accecante': {
      const metallo = /automa|golem di ferro|metall/i.test(i.nome || '') ? 3 : 0; totale += metallo; colpisce = r.naturale !== 1 && totale >= L;
      if (!colpisce) return falla();
      if (/elementale.*fulmine/i.test(i.nome || '')) { nota(`${base} → nessun effetto.`); return; }
      nota(`${base}${metallo ? ' (+3 bersaglio metallico)' : ''} → ${gr} ${i.minore ? 'uccisi' : 'ferite'}${i.pf?.immuneVista ? '' : ' e perde 2 LIV (accecato)'}.`);
      if (!i.pf?.immuneVista) { i.liv = Math.max(1, i.liv - 2); i.livBase = Math.max(1, i.livBase - 2); }
      await danno(gr); return;
    }
    case 'Pugno Arcano': case 'Tempesta Arcana': {
      const tem = nome === 'Tempesta Arcana';
      const k = await scelta(nome, 'Una sola azione a scelta:', tem ? [[1, 'Copre la ritirata (nessun attacco mentre il gruppo si ritira)'], [2, 'Attacco a distanza (+L): 4 PV'], [3, 'Attacco a distanza con +3 oltre a +L: solo 1 PV anche con esplosione'], [4, 'Abbatte una porta (non immune alla magia)']] : [[1, 'Impedisce l’attacco di un nemico mentre il gruppo si ritira'], [2, `Attacco a distanza (+L): ${gr} danni`], [3, 'Abbatte una porta (non immune alla magia)'], [4, 'Recupera un oggetto o un personaggio su un baratro'], [5, `Blocca un avversario: attacchi in mischia contro di lui a +${gr} finché non lanci un altro incantesimo`]]);
      if (!k) return;
      if (k === 1) { if (colpisce || tem) { nota(`${nome}: copre la ritirata.`); C.sottrarsiIndenne(nome); } else falla(); return; }
      if ((tem && k === 4) || (!tem && (k === 3 || k === 4))) { nota(`${nome}: ${k === 4 && !tem ? 'recupera l’oggetto o il personaggio' : 'abbatte la porta'}.`); return; }
      if (tem && k === 3) { totale += 3; colpisce = r.naturale !== 1 && totale >= L; if (!colpisce) return falla(); nota(`${base} (+3) → 1 ${i.minore ? 'ucciso' : 'ferita'}.`); await danno(1); return; }
      if (!colpisce) return falla();
      if (!tem && k === 5) { i.bloccatoMod = gr; i.bloccatoDa = e.id; nota(`${e.nome} blocca ${i.nome}: attacchi in mischia contro di lui a +${gr}.`); return; }
      const q = tem ? 4 : gr; nota(`${base} → ${q} ${i.minore ? 'uccisi' : 'ferite'}.`); await danno(q); return;
    }
    case 'Teletrasportare il Nemico': {
      if (!colpisce) return falla();
      const d = (await tira('1d6', 'Turni di assenza (1 per stanza di distanza)')).totale;
      if (i.minore) { i.n = Math.max(0, i.n - 1); (i.rientri = i.rientri || []).push(d); nota(`${base} → una creatura è teletrasportata e rientrerà fra ${d} turni.`); if (i.n === 0 && !(i.rientri || []).length) await C.applicaDanni(0); else if (i.n === 0) nota('Restano solo i teletrasportati: attendi il loro ritorno.'); }
      else { i.assenteTurni = d; nota(`${base} → ${i.nome} è teletrasportato e rientra fra ${d} turni.`); }
      return;
    }
    case 'Invisibilità di Massa': {
      if (!colpisce) return falla();
      if (i.bossFinale || tipoViv(i) || /vede gli invisibili/i.test(i.note || '')) { nota(`${base} → inutile contro ${i.nome} (immune alla magia, non vivente, boss finale o vede gli invisibili).`); return; }
      nota(`${base} → il gruppo non è visto da ${i.nome}.`);
      const f = vivi().find(x => x.classe === 'furfante');
      if (f && await confirmBox(`${f.nome} tenta di rubare qualcosa (un oggetto o un sacco fino a ${f.livello * 10} p.o.)? Se fallisce il bersaglio vede il gruppo e attacca.`)) {
        const t = await C.dE(f, `Furtività di ${f.nome} (contro LIV ${i.liv})`);
        if (t.naturale !== 1 && t.totale + f.livello >= i.liv) { nota(`${f.nome} deruba ${i.nome} senza essere visto.`); const q = await G.tesoro(typeof i.tes === 'number' ? i.tes : 0); nota(q); }
        else { nota(`${f.nome} fallisce: ${i.nome} vede il gruppo e attacca.`); i.mostriPrima = true; return; }
      }
      i.stato = 'speciale'; i.reazione = { azione: 'invisibili', tiro: 0 }; return;
    }
    case 'Distrazioni Illusorie': {
      if (!colpisce) return falla();
      i.distrazioni = true; nota(`${base} → i nemici sono distratti: bonus d’attacco al gruppo fino a fine incontro (furfanti e assassini +L, chi non ha addestramento militare +½L).`);
      if (await confirmBox('Il gruppo vuole approfittarne per fuggire senza subire attacchi?')) C.sottrarsiIndenne('Distrazioni Illusorie'); return;
    }
    case 'Distruggi Nemico Invincibile': {
      const ok = (i.attacchiRicevuti || 0) >= 12 || await confirmBox(`${i.nome} ha subito ${i.attacchiRicevuti || 0} attacchi (ne servono 12). Si può colpire solo con la magia e nessuno ha armi magiche?`);
      if (!ok) { nota(`${base} → ${i.nome} non è un nemico invincibile: nessun effetto.`); return; }
      if (!colpisce) return falla();
      i.tes = 'NO'; nota(`${base} → ${i.nome} è distrutto e il suo tesoro è perso.`); await danno(i.minore ? i.n : i.pv); return;
    }
  }
}
const tipoViv = i => (i.tag || []).includes('non-morto') ? 'non-morto' : /golem|automa|robot/i.test(i.nome || '') || (i.tag || []).includes('artificiale') ? 'artificiale' : null;
/** Fornace dell'Amuleto: con una gemma da 200 p.o. si crea un amuleto leggendario con cariche pari al LIV della creatura. */
async function amuleto(e, i) {
  const g = (e.oggetti || []).find(o => o.tipo === 'gemma' && o.valore >= 200); if (!g) return;
  if (!(await confirmBox(`${i.nome} è distrutto: ${e.nome} ha una gemma da ${g.valore} p.o. Tenta di creare un amuleto leggendario con ${i.livBase} cariche? (se fallisce la gemma si frantuma: 50 p.o.)`))) return;
  const r = await C.dE(e, `Fornace dell’Amuleto: creare l’amuleto (LIV ${i.livBase})`);
  if (r.naturale !== 1 && r.totale + e.livello >= i.livBase) { e.oggetti.splice(e.oggetti.indexOf(g), 1); e.oggetti.push({ nome: `Amuleto leggendario (${i.livBase} cariche): +GR ai tiri salvezza di chi lo indossa`, qta: 1, tipo: 'magico', cariche: i.livBase, caricheMax: i.livBase, nota: 'Ogni TS di chi lo indossa consuma una carica; a zero la gemma diventa polvere.' }); nota(`${e.nome} crea un amuleto leggendario con ${i.livBase} cariche.`); }
  else { g.valore = 50; g.nome = 'Gemma frantumata'; nota(`${e.nome} fallisce: la gemma si frantuma (50 p.o.).`); }
}
/** Dopo il tiro di un incantesimo: sul Rivo dell'Oblio un 1 naturale fa dimenticare un incantesimo; il tumulo risparmia l'incantesimo. */
export async function dopoTiroIncantesimo(e, nome, r) {
  if (r.naturale === 1 && sulFiume()?.id === 'p-rivo-oblio') { const s = (e.incantesimi || []).find(x => !x.usato); if (s) { s.usato = true; nota(`Rivo dell’Oblio: ${e.nome} dimentica ${s.nome}.`); } }
}
/** Il tumulo: l'incantesimo appena lanciato non è consumato (1 PV). Restituisce true se è stato risparmiato. */
export function tumuloRisparmia(e, s) {
  if (!(e.tumuloCariche > 0)) return false;
  e.tumuloCariche--; s.usato = false; C.perdiPV(e, 1, 'energia del tumulo'); nota(`${e.nome} lancia ${s.nome} con l’energia del tumulo: l’incantesimo non è consumato.`); return true;
}
export const incantesimoVietato = e => (e.nonLancia > 0 ? `${e.nome} è schizzato dal liquido resistente alla magia: niente incantesimi né preghiere per ${e.nonLancia} stanze.` : e.confuso || e.bloccato ? `${e.nome} non può agire in questo momento (confusione o allucinazione).` : null);
/** Dado di cura della Guarigione: d10 o d12 per gli eroi di grado eroico e leggendario (i livelli inferiori restano sul d6). */
export const dadoCura = (e, label) => (gradoAlto(e) ? dadoN(profiloDado(e).facce, label) : tira('1d6', label));
/** Doppio colpo: 2 attacchi a distanza per turno (non con balestre e armi da fuoco). */
export const doppioColpo = (e, arma) => !!arma?.lancio && !arma.fuoco && !['balestra', 'archibugio'].includes(arma.id) && !!forza(e, 'p-doppio-colpo');
export const curaRivoMorte = () => sulFiume()?.id === 'p-rivo-morte';
export const riposoVietato = () => (sulFiume()?.id === 'p-rivo-lacrime' ? 'Sulle rive del Rivo delle Lacrime non si può riposare.' : curaVietata() ? 'Nella Cittadella delle cose morte non è possibile alcuna cura tranne le bende.' : null);
/** Fanghiglia: si fugge solo abbandonando tutto. Restituisce true se il gruppo accetta. */
export async function fugaFanghiglia(i) {
  if (!i.pf?.fugaSoloAbbandonandoTutto) return true;
  if (!(await confirmBox(`${i.nome} si attacca ai vestiti e all’equipaggiamento: si può fuggire solo abbandonando tutto ciò che si possiede (armi, armature, oggetti e monete). Abbandoni tutto?`))) return false;
  for (const e of S.party.eroi.filter(x => x.stato !== 'morto')) Object.assign(e, { armi: [], armaPrincipale: null, armatura: 'nessuna', scudo: false, oggetti: [], oro: 0, lanterna: false });
  log('Il gruppo fugge abbandonando tutto il suo equipaggiamento e le monete.'); modificato('party'); return true;
}

// =============================================================
//  INGRESSO, INIZIO E FINE AVVENTURA
// =============================================================
/** Avviso quando non tutti i personaggi sono adatti (livello 10 o più, o livello 9 già eroici). Restituisce false se l'utente rinuncia. */
export async function controlloIngresso() {
  const bassi = eroiVivi().filter(e => !e.png && !e.merc && !adatto(e));
  if (!bassi.length) return true;
  return await confirmBox(`Il supplemento «Contro le Profondità Dimenticate» è pensato per personaggi dei livelli 10-19 (si accede al grado eroico dal 9° livello, con 2 tiri ES e 1.000 p.o. a testa). Non tutti lo sono (${bassi.map(e => `${e.nome} ${e.livello}°`).join(', ')}): il manuale sconsiglia di scendere così ma non lo vieta. I mostri usano LMP (il livello più alto del gruppo) e GR (il grado). Scendere comunque?`);
}
export async function inizioAvventura() {
  if (!profonditaAttiva()) return;
  for (const e of S.party.eroi) {
    if (e.stato === 'morto') continue;
    Object.assign(e, { nonLancia: 0, malusPerquisire: 0, malusIncantesimi: 0, legato: null, tumuloCariche: 0, allucinato: null, bloccato: false, bonusPsichico: false, nessunPericolo: false, autoSalvezza: false, autoDifesa: false, ruggito: false, muco: false, confuso: false, malusAtt: 0, malusAttGR: 0, curatoMagia: false });
    delete e.resuscitatoDio;
  }
}
export async function fineAvventura() {
  if (!profonditaAttiva()) return;
  for (const e of S.party.eroi) {
    if (e.stato === 'morto' || e.merc) continue;
    const ms = forza(e, 'p-mente-stabile');
    if (ms && (e.follia || 0) > 0) { const n = Math.min(e.follia, ms.guarigioneFolliaTraAvventure); K.follia(e, -n); log(`${e.nome} (${ms.nome}) recupera ${n} punti follia.`); }
    Object.assign(e, { nonLancia: 0, legato: null, tumuloCariche: 0, bloccato: false, allucinato: null, muco: false });
  }
  adv().fiume = null; adv().sezione = null; adv().cittadella = null;
}

// =============================================================
//  INTERFACCIA: strumenti, azioni di combattimento, scheda
// =============================================================
const metaPV = e => Math.floor(e.pvMax / 2);
/** Azioni di abilità e segreti utilizzabili fuori dal combattimento (carta degli Strumenti). */
function azioniStrumenti(btn) {
  const out = [];
  for (const e of vivi()) {
    const u = e.usi = e.usi || {};
    const ri = forza(e, 'p-riposo-eroe'); if (ri && !u.riposoEroe) out.push(btn(`Riposo dell’eroe (${e.nome}): metà dei PV totali al gruppo`, () => { if (riposoVietato()) return toast(riposoVietato(), 'warn'); u.riposoEroe = 1; for (const x of vivi()) x.pv = Math.min(x.pvMax, x.pv + metaPV(x) * (curaRivoMorte() ? 0.5 : 1) | 0); log(`${e.nome} (Riposo dell’eroe): il gruppo recupera metà dei suoi PV totali.`); modificato('party'); }));
    const ba = forza(e, 'p-banchetto-eroe'); if (ba && !u.banchetto) out.push(btn(`Banchetto dell’eroe (${e.nome}): +2 PV a tutti (doppio delle razioni)`, () => { if (riposoVietato()) return toast(riposoVietato(), 'warn'); u.banchetto = 1; for (const x of vivi()) x.pv = Math.min(x.pvMax, x.pv + 2); log(`${e.nome} prepara il Banchetto dell’eroe: +2 PV a tutti (usa il doppio delle razioni, 1 ora, 1 solo tiro per gli erranti).`); modificato('party'); }));
    const ca = forza(e, 'p-canzone-elidra'); if (ca && !u.canzone) out.push(btn(`Canzone di Elidra (${e.nome}): cura ${ca.cura}`, async () => { u.canzone = 1; for (const x of vivi()) { const q = (await tira(ca.cura, `Canzone di Elidra su ${x.nome}`)).totale; x.pv = Math.min(x.pvMax, x.pv + q); } log(`${e.nome} canta la Canzone di Elidra: ${ca.cura} PV a ciascuno (chi è toccato dal caos o dalla follia può invece rimuovere ${ca.rimuoviFollia} punti follia a mano).`); modificato('party'); }));
    const rm = forza(e, 'p-ripristino-mentale'); if (rm && !u.ripMentale) out.push(btn(`Ripristino mentale (${e.nome}): restituisce 1 incantesimo a un compagno`, async () => { const c = await K.eroeScelto('A chi?', x => x.id !== e.id && x.stato === 'ok' && (x.incantesimi || []).some(s => s.usato)); if (!c) return; u.ripMentale = 1; c.incantesimi.find(s => s.usato).usato = false; log(`${e.nome} ripristina un incantesimo di ${c.nome} (10 minuti: 1 tiro erranti).`); modificato('party'); }));
    for (const s of e.segretiP || []) out.push(btn(`Segreto «${s.nome}» (${e.nome})`, () => usaSegretoP(e, s)));
    if (e.legato) out.push(btn(`${e.nome} è legato alla stanza: paga 1 PV o 1 follia per area di distanza`, async () => { const k = await scelta('Trappola dell’anima', 'Per ogni area di distanza:', [['pv', 'Perdi 1 PV'], ['follia', 'Prendi 1 punto follia']]); if (k === 'follia') K.follia(e, 1); else C.perdiPV(e, 1, 'trappola dell’anima'); }));
  }
  return out;
}
/** Carta «Profondità Dimenticate» degli Strumenti: fiumi, rovine, tumuli, Cittadelle, idoli, missione, abilità e segreti. */
export function carta(btn) {
  const a = adv(), f = a.fiume, s = a.sezione, c = a.cittadella, m = a.missioneP, p = t => h('p', { class: 'hint' }, t), out = [];
  if (f) out.push(p(`Fiume: ${f.nome} — ${FIUME_TXT[f.id]}. Tratti: ${f.tratti}. Barca: ${f.barca || 'nessuna'}${f.ignifuga ? ' (ignifuga)' : ''}${f.fortuna ? ' (Fortuna del Barcaiolo)' : ''}${f.barcaiolo ? ` · barcaiolo: ${f.barcaiolo.nome}` : ''}${f.sulFiume ? ' · a bordo' : ' · a piedi'}.`));
  if (s) out.push(p(`In corso: ${s.nome}, stanza ${s.fatte}/${s.totale}${c ? ` — ${c.regole}` : ''}${c?.tipo === 'p-cit-prigionieri' ? ` Indizi dai maggiori: ${c.indizi || 0}.` : ''}`));
  if (m) out.push(p(`Missione della Dama in grigio: «${m.nome}» — ${m.testo}${m.id === 'p-mis-pagine' ? ` Pagine: ${m.pagine}/4.` : ''}${m.id === 'p-mis-idoli' ? ` Idoli visitati: ${m.idoli}/3.` : ''}${m.id === 'p-mis-nemico' && !m.apparso ? ` Il nemico arriva fra ${m.stanze} stanze.` : ''}`));
  if ((a.iscrizioni || []).length) out.push(p(`Iscrizioni leggibili (un mago le studia con un tiro ES): ${a.iscrizioni.map(k => k.nome).join(', ')}.`));
  const bt = [
    btn('Fiume: natura (d6)', () => naturaFiume()), btn('Uscita sul fiume (barca e barcaiolo)', () => uscitaFiume()), btn('Nuovo tratto di fiume', () => nuovoTratto()),
    btn('Pericolo fluviale (d6)', () => pericolo()), btn('Barca ignifuga', () => ignifuga(), '', { disabled: !f?.barca }), btn('Sbarca', () => sbarca(), '', { disabled: !f?.sulFiume }), btn('Ritrova la barca (5 su 1d6)', () => ritrovaBarca(), '', { disabled: f?.barca !== 'ormeggiata' }),
    btn('Rovine (1d6+2 stanze)', () => iniziaSezione('rovine')), btn('Tumulo', () => tumulo()),
    btn('Nuova Cittadella (d6)', () => iniziaCittadella()), btn('Aberrante della Cittadella', () => aberranteCittadella()),
    btn('Idolo ciclopico (d6)', () => idolo()), btn('Missione: Dama in grigio', () => missione().then(t => toast(t))),
    btn('Incantesimo eroico/leggendario a caso', async () => { const l = D().tabelle[gradoGruppo() === 'leggendario' ? 'incantesimoLeggendarioCaso' : 'incantesimoEroicoCaso'], x = await dado('Incantesimo a caso (d6)'), n = riga(l, x.totale).nome; bottino({ tipo: 'pergamena', testo: `Pergamena: ${n}`, incantesimo: n }); log(`Pergamena: ${n}`); modificato(); }),
    btn('Tesoro magico adatto al grado', async () => { const o = await tesoroMagico(); bottino(o); log(`Tesoro magico: ${o.testo}`); modificato(); }),
    btn('Passa di grado…', () => passaDiGrado(), '', { disabled: !!a.attiva, title: 'Si fa tra due avventure' })];
  if (s) bt.push(btn(`Genera la prossima stanza (${s.fatte}/${s.totale})`, () => prossimaStanzaStrumenti(), 'primary'), btn('Esci dalla sezione', () => (c ? usciCittadella() : chiudiSezione())));
  if (m?.id === 'p-mis-nemico' && !m.apparso) bt.push(btn('Spendi 1 indizio: il nemico arriva subito', async () => { if (await spendiIndizi(1)) await missioneNemico(); }));
  if (m?.id === 'p-mis-pagine') bt.push(btn('Una pagina recuperata (al posto di una pergamena)', () => { m.pagine = Math.min(4, m.pagine + 1); log(`Pagina del tomo recuperata (${m.pagine}/4).`); modificato(); }));
  if (m) bt.push(btn('Missione compiuta (ricompense)', () => completaMissione(), 'primary'));
  out.push(h('div', { class: 'tools' }, ...bt, ...azioniStrumenti(btn)));
  return h('div', { class: 'card' }, h('h3', {}, 'Profondità Dimenticate: fiumi, rovine, Cittadelle, idoli'), ...out);
}
/** Pulsanti in combattimento delle abilità e dei segreti del supplemento. `azione` costruisce i pulsanti dell'interfaccia. */
export function azioniCombattimento(e, i, azione) {
  const out = [], u = i.usati = i.usati || {}, arma = armaDi(e.armaPrincipale), distanza = !!arma?.lancio, spesa = () => { i.agito[e.id] = true; };
  const casella = (k, testo) => h('label', { class: 'chk', title: 'Da dichiarare prima del tiro di attacco' }, h('input', { type: 'checkbox', checked: !!e.dichiara?.[k], onchange: ev => { e.dichiara = e.dichiara || {}; e.dichiara[k] = ev.target.checked; modificato('party'); } }), testo);
  const prec = forza(e, 'p-precisione-eroica'); if (prec && distanza && !u[e.id + 'pr']) out.push(casella('precisione', `Precisione eroica (+${prec.modAttaccoDistanza})`));
  if (forza(e, 'p-risposta') && !i.minore && i.danniSubiti?.[e.id] && !u[e.id + 'ri']) out.push(casella('risposta', `Risposta (+${(forza(e, 'p-risposta').moltDanniSubiti) * i.danniSubiti[e.id]})`));
  const fr = oggettoEffetto(e, /frecce o dardi magici leggendari/i); if (fr && fr.cariche > 0 && distanza) out.push(casella('frecce', `Freccia leggendaria (+${GR()}, ${fr.cariche})`));
  const ca = forza(e, 'p-carneficina');
  if (ca && !u[e.id + 'ca'] && !i.sorpresa) out.push(azione(e, `Carneficina (${ca.distruggeMinori})`, async () => {
    const lim = mezzo(e);
    if (i.minore && i.liv > lim) return toast(`Carneficina colpisce solo minori di LIV ${lim} o meno (metà livello del barbaro): ${i.nome} è LIV ${i.liv}.`, 'warn');
    u[e.id + 'ca'] = true; spesa(); const n = (await tira(ca.distruggeMinori, 'Carneficina')).totale;
    if (i.minore) { nota(`${e.nome} compie una Carneficina: ${Math.min(n, i.n)} nemici distrutti.`); await C.applicaDanni(n); }
    else if (i.ordaP) { const d = (await tira(forza(e, 'p-carneficina').id === 'p-carneficina-l' ? '1d8' : '1d6', 'Carneficina contro l’orda')).totale; nota(`${e.nome} compie una Carneficina sull’orda: ${d} danni.`); await C.applicaDanni(d); }
    else toast('Carneficina non ha effetto su un mostro maggiore.', 'warn');
  }, 'accent'));
  if (forza(e, 'p-forza-arcana') && !(e.usi || {}).forzaArcana) out.push(azione(e, 'Forza arcana (+1d3 danni a un incantesimo)', async () => { e.usi.forzaArcana = 1; const q = (await tira('1d3', 'Forza arcana')).totale; nota(`${e.nome} (Forza arcana): +${q} danni all’incantesimo.`); await C.applicaDanni(q); }, 'accent'));
  const cp = forza(e, 'p-circolo-protezione'); if (cp && !u[e.id + 'cp']) out.push(azione(e, `Circolo di protezione (+${cp.modDifesa} difesa, 5 p.o. di erbe)`, async () => {
    if (!(await provaRM(e, 'Circolo di protezione', true))) { u[e.id + 'cp'] = true; spesa(); return modificato(); }
    const b = await K.eroeScelto('Chi protegge il circolo?', x => x.stato === 'ok'); if (!b) return; u[e.id + 'cp'] = true; spesa(); prendiOro(5, [e, ...eroiVivi()]);
    i.circolo = { eroeId: b.id, mod: cp.modDifesa }; nota(`${e.nome} traccia un circolo di protezione: ${b.nome} ha +${cp.modDifesa} alle difese finché non ottiene un 1.`); modificato();
  }, 'accent'));
  if (forza(e, 'p-aiuto-incantesimi') && !i.aiutoLancio) out.push(azione(e, 'Aiuto per lanciare incantesimi (+3 a un alleato)', async () => { const b = await K.eroeScelto('Chi riceve il +3?', x => x.id !== e.id && x.stato === 'ok'); if (!b) return; spesa(); i.aiutoLancio = b.id; nota(`${e.nome} aiuta ${b.nome}: +3 al prossimo tiro per lanciare incantesimi.`); modificato(); }, 'accent'));
  if (i.pf?.risorge && i.cadaveri > 0) out.push(azione(e, 'Fai a pezzi i troll caduti (1 turno)', async () => { i.cadaveri = 0; i.rigenerati = 0; spesa(); nota(`${e.nome} fa a pezzi i troll caduti: non si rialzeranno.`); await C.applicaDanni(0); }, 'accent'));
  for (const s of e.segretiP || []) out.push(azione(e, `Segreto: ${s.nome}`, () => usaSegretoP(e, s), 'accent'));
  const acqua = i.pf?.acquaSanta && (e.oggetti || []).find(o => /acqua santa/i.test(o.nome || ''));
  if (acqua) out.push(azione(e, `Lancia acqua santa (${i.pf.acquaSanta.dannoPerFiala} ferite)`, async () => { if ((acqua.qta || 1) > 1) acqua.qta--; else e.oggetti = e.oggetti.filter(x => x !== acqua); spesa(); nota(`${e.nome} getta l’acqua santa su ${i.nome}: ${i.pf.acquaSanta.dannoPerFiala} ferite.`); await C.applicaDanni(i.pf.acquaSanta.dannoPerFiala); }, 'accent'));
  return out;
}
/** Sezione «Grado» della scheda dell'eroe (correzione manuale). */
export function sezioneGrado(e, rinfresca) {
  const g = gradoDi(e), p = profiloDado(e);
  return h('div', { class: 'tratti' }, h('h4', {}, 'Grado (Profondità Dimenticate)'),
    h('p', { class: 'hint' }, `Grado ${g} (GR ${p.gr}): d${p.facce} esplosivo con ${p.soglia}+; 1 naturale sempre fallimento. Il passaggio al grado eroico (livello 9) o leggendario (livello 14) si fa dal pannello Gruppo: qui puoi solo correggerlo a mano.`),
    h('label', {}, 'Grado ', h('select', { onchange: ev => { e.grado = ev.target.value || null; log(`${e.nome}: grado corretto a mano (${ev.target.value || 'automatico'}).`); modificato('party'); rinfresca(); } },
      [['', 'Automatico (base/esperto)'], ['eroico', 'Eroico (d10)'], ['leggendario', 'Leggendario (d12)']].map(([v, t]) => h('option', { value: v, selected: (e.grado || '') === v }, t)))));
}
/** Corruzione con un costo scritto a parole (razioni, gemme, pergamene, animali…): offre il pagamento in monete, se previsto, e la consegna a mano. */
export function corruzioneTesto(i, btn) {
  const out = [], p = i.reazione.param, m = /(\d+)\s*p\.o\./.exec(p);
  if (m) { const costo = +m[1] * (i.minore ? i.n : 1); out.push(btn(`Paga ${costo} p.o.`, () => C.paga(costo), '', { disabled: costo > C.oroTotale() })); }
  out.push(btn(`Ho consegnato il costo a mano (${p})`, () => C.paga(0, false, true)));
  return out;
}
