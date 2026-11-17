// Regole di Four Against Darkness: calcolo modificatori, tabelle, mostri.
import { R, S, eroiVivi, livelloMax } from './state.js';
import * as P from './profondita.js';
import * as Q from './acque.js';
import * as V from './silvani.js';

export const NOME_ARMATURA = { nessuna: 'Nessuna', leggera: 'Armatura leggera', pesante: 'Armatura pesante' };

export const armaDi = id => R.equipaggiamento.armi.find(a => a.id === id);
export const armaPrincipale = e => armaDi(e.armaPrincipale);
export const nomeClasse = e => (e.merc ? 'Mercenario' : (e.culto && R.classi[e.culto]?.nome) || R.classi[e.classe].nome);   // i chierici di Elidra e Korimnos sono chierici (classe) con un culto
export const incantatore = e => ['mago', 'elfo', 'elfo-fuoco'].includes(e.classe);
export const puoUsareMagia = e => e.classe !== 'barbaro';

/** Cerca una riga di tabella in base al valore del dado. */
export function riga(tab, v) {
  return tab.find(r => v >= r.da && v <= r.a) || tab[tab.length - 1];
}
// Set di tabelle attivo per l'avventura: base, «Nemici diabolici» (avanzate) o «Caverne del Caos» (supplemento).
export const SETS = { base: 'Four Against Darkness (lvl 1-2)', coboldi: 'Schiavisti Coboldi (lvl 1-2)', acque: 'Acque Oscure (lvl 1-4)', diabolici: 'Four Against Darkness – Nemici diabolici (lvl 3-5)', caos: 'Contro il Caos (lvl 3-6)', silvani: 'Labirinti Silvani (lvl 4+)', abisso: 'Contro l\'Abisso (lvl 5-9)', profondita: 'Contro le Profondità Dimenticate (lvl 10-19)' };
export const setAttivo = () => (S.adv && S.adv.set) || 'base';
const datiSet = () => ({ diabolici: R.avanzate, caos: R.caos, abisso: R.abisso, profondita: R.profondita, acque: R.acque, coboldi: R.coboldi, silvani: R.silvani })[setAttivo()];
// ---- «Acque Oscure» (livelli 1-4) e «Caverne degli Schiavisti Coboldi» (livelli 1-2) ----
export const inAcque = () => setAttivo() === 'acque';
export const inCoboldi = () => setAttivo() === 'coboldi';
/** Spadaccino, acqua santa, flagello: casella attiva o dungeon di uno dei due set. */
export const acqueAttive = () => !!(S.party?.supplAcque || inAcque() || inCoboldi());
/** Classe selezionabile: le classi del Caos con la casella del Caos, lo Spadaccino con il contenuto di Acque Oscure e Coboldi. */
export const classeDisponibile = c => !c.suppl || (c.suppl === 'acque' ? acqueAttive() : c.suppl === 'silvani' ? silvaniAttivi() : !!S.party?.supplCaos);
export const armaVisibile = a => !a.suppl || (a.suppl === 'acque' ? acqueAttive() : a.suppl === 'silvani' ? silvaniAttivi() : !!S.party?.supplCaos || (silvaniAttivi() && ['balestra', 'bolas', 'boomerang'].includes(a.id)));
// ---- «Labirinti Silvani» (livelli 4+): selva, druido, elfo silvano, guida, signore delle bestie, chierici di Elidra e Korimnos ----
export const inSilvani = () => setAttivo() === 'silvani';
/** Le sei classi, i compagni animali e le cavalcature valgono con la casella attiva o nella selva. */
export const silvaniAttivi = () => !!(S.party?.supplSilvani || inSilvani());
/** Chi salva come il furfante (furfante e spadaccino). */
export const comeFurfante = e => e.classe === 'furfante' || e.classe === 'spadaccino';
export const inCaos = () => setAttivo() === 'caos';
// ---- supplemento «Contro l'Abisso» (livelli 5-9) ----
export const inAbisso = () => setAttivo() === 'abisso';
// ---- supplemento «Contro le Profondità Dimenticate» (livelli 10-19) ----
export const inProfondita = () => setAttivo() === 'profondita';
/** Gradi eroico e leggendario: casella attiva o dungeon delle Profondità. */
export const profonditaAttiva = () => !!(S.party?.supplProfondita || inProfondita());
/** Le regole per i personaggi (livelli oltre il 5°, abilità, oggetti, mercenari) valgono con la casella attiva o nel dungeon dell'Abisso; restano valide per i personaggi di grado superiore (Profondità). */
export const abissoAttivo = () => !!(S.party?.supplAbisso || inAbisso() || profonditaAttiva());
/** Grado dell'eroe, tracciato separatamente dal livello: base (1-4), esperto (5-9, d8), eroico (d10) o leggendario (d12). Eroico e leggendario si ottengono solo con il passaggio di grado. */
export function gradoDi(e) {
  if (!e || e.merc) return 'base';
  if (profonditaAttiva() && (e.grado === 'eroico' || e.grado === 'leggendario')) return e.grado;
  return abissoAttivo() && (e.livello || 0) >= 5 ? 'esperto' : 'base';
}
const PROFILI_DADO = { base: { facce: 6, soglia: 6, gr: 1 }, esperto: { facce: 8, soglia: 7, gr: 2 }, eroico: { facce: 10, soglia: 8, gr: 3 }, leggendario: { facce: 12, soglia: 9, gr: 4 } };
/** Dado del grado: facce e soglia di esplosione (tabella dei gradi, p. 9 del supplemento). */
export const profiloDado = e => PROFILI_DADO[gradoDi(e)];
/** Numero del grado (GR) del gruppo: quello del personaggio di grado più alto (base 1, esperto 2, eroico 3, leggendario 4). */
export const grNumero = () => Math.max(1, ...eroiVivi().filter(e => !e.merc).map(e => profiloDado(e).gr));
/** Un eroe di grado esperto tira il d8 esplosivo; i mercenari e i livelli base restano sul d6. */
export const usaD8 = e => gradoDi(e) === 'esperto';
/** Livello massimo raggiungibile: 5° nel manuale base, 9° con «Contro l'Abisso», 19° con le Profondità. */
export const livelloTetto = () => (profonditaAttiva() ? 19 : abissoAttivo() ? 9 : 5);
/** Attacchi furiosi del barbaro per avventura: ceil(L/2) come in precedenza; con l'Abisso floor(L/2)+1 (come nel manuale) e +1 con Furia del berserker. */
export const maxFurie = e => (abissoAttivo() ? Math.floor(e.livello / 2) + 1 + (haAbilita(e, 'furia-del-berserker') ? 1 : 0) + (profonditaAttiva() ? P.furieExtra(e) : 0) : Math.ceil(e.livello / 2));
export const haAggeggio = (e, re) => !!oggettoEffetto(e, re);
export const tabella = nome => datiSet()?.tabelle?.[nome] || R.tabelle[nome];
export const mostriTabella = nome => datiSet()?.mostri?.[nome] || R.mostri[nome];
export const incantesimoACasoLista = () => {
  const l = tabella('incantesimoCaso');
  if (setAttivo() === 'caos' || setAttivo() === 'abisso') return l;   // incantesimi del caos o avanzati dell'Abisso (d6)
  if (inProfondita()) return P.incantesimiACaso();   // incantesimi eroici o leggendari secondo il grado
  return S.party?.supplCaos ? R.caos.incantesimiBase : l;   // con il supplemento: tabella d12
};

// ---------------- supplemento «Contro il Caos»: tratti, abilità, bonus permanenti ----------------
/** Le regole del supplemento valgono se la casella è attiva o se il dungeon è quello del caos. */
export const suppl = () => !!(S.party?.supplCaos || setAttivo() === 'caos');
export const tratto = (e, id) => (e.tratti || []).find(t => t.id === id);
/** Abilità avanzata dell'eroe; il veterano possiede Assistenza e Leader carismatico fin dall'inizio. */
export const abilita = (e, id) => (e.abilita || []).find(a => a.id === id) || (e.classe === 'veterano' && ['assistenza', 'leader-carismatico'].includes(id) ? { id } : null);
export const haAbilita = (e, id) => !!abilita(e, id);
/** Mostri «flagello»: traguardo → espressione sul nome. */
export const FLAGELLI = [['flagello-hobgoblin', /hobgoblin/i], ['flagello-orchi', /\borc/i], ['flagello-coboldi', /cobold/i], ['flagello-ghoul', /ghoul/i],
  ['flagello-goblin', /(^|\s)goblin/i], ['flagello-troll', /troll/i]];
const REGEX_GELO = /ghiaccio|gelo|neve|inverno/i;
/** Quali oggetti dello zaino hanno un effetto riconoscibile dal nome. */
export const oggettoEffetto = (e, re) => (e.oggetti || []).find(o => re.test(`${o.nome || ''} ${o.nota || ''}`));
export const haBraccialetto = e => !!oggettoEffetto(e, /braccialetto della furia/i);
const furiaSangue = e => haBraccialetto(e) && !!e.furiaSangue && e.pv * 2 <= e.pvMax;
/** Tipo di nemico «non vivente» (per Marchia e Attacco specializzato): 'non-morto', 'artificiale', 'informe' o null. */
export function tipoNonVivente(m) {
  if ((m.tag || []).includes('non-morto')) return 'non-morto';
  if (/golem|automa|robot|elementale/i.test(m.nome || '')) return 'artificiale';
  if (/melma|cubo|liquame|gelatina|blob|muffa|vespe/i.test(m.nome || '')) return 'informe';
  return null;
}

/** Armi da fuoco e simili: restrizioni di classe e limiti di trasporto. */
export const controllaArmi = e => suppl() || e.classe === 'spadaccino' || !!(e.arti?.mano || e.arti?.gamba) || V.classeSilvana(e);
export function armaConsentita(e, a) {
  if (!a) return { ok: true };
  if (a.soloClassi && !a.soloClassi.includes(e.classe)) return { ok: false, motivo: `${a.nome}: la possono usare solo ${a.soloClassi.map(c => R.classi[c]?.nome || c).join(', ')}.` };
  if (a.lancio && e.classe === 'elfo-fuoco') return { ok: false, motivo: 'Gli elfi del fuoco non usano armi a distanza.' };
  if (e.classe === 'veterano' && a.categoria === 'due-mani') return { ok: false, motivo: 'Il veterano non porta armi a due mani.' };
  if (e.classe === 'spadaccino' && (a.categoria === 'due-mani' || ['arco', 'balestra', 'archibugio'].includes(a.id))) return { ok: false, motivo: 'Lo spadaccino non usa armi a due mani né l’arco.' };
  const rs = V.armaVietata(e, a); if (rs) return { ok: false, motivo: rs };   // classi silvane
  if ((e.arti?.mano || e.arti?.gamba) && (a.mani === 2)) return { ok: false, motivo: 'Con una mano perduta (o una stampella) non si usano armi a due mani.' };
  return { ok: true };
}
const LIMITE_ARMI = { bolas: 2, boomerang: 1 };
export const limiteArma = (e, id) => !LIMITE_ARMI[id] || (e.armi || []).filter(x => x === id).length < LIMITE_ARMI[id];

/** Bonus ai tiri salvezza del supplemento «Contro l'Abisso»: artigiani, pozioni, segreti, oggetti e abilità. */
function bonusSalvezzaAbisso(e, L, inc, add) {
  const sr = e.srv || {}, poz = e.pozioni || {}, ad = S.adv || {}, attivo = inc && inc.stato !== 'finito';
  const paura = /paura|terrore|orrore|fantasma|illusion/i.test(L), veleno = /veleno|gas/i.test(L), malattia = /malattia|peste|veleno/i.test(L);
  if (haAbilita(e, 'volonta-ferrea') && paura) add('Volontà ferrea', 1);
  if (paura && eroiVivi().some(x => x.stato === 'ok' && haAbilita(x, 'leader-carismatico') && (S.party.ordine || []).slice(0, 2).includes(x.id)) && !suppl()) add('Leader carismatico', 1);
  if (sr.erborista && malattia) add('Erborista', 1);
  if (poz.vigore && veleno) add('Pozione del vigore', 1);
  if (poz.mentesalda && attivo && /cervello/i.test(inc.nome || '')) add('Estratto di mentesalda', 2);
  if (ad.divinita && !ad.divinita.fallito) add('Le divinità ci proteggono', 1);
  if (ad.cucinato && /malattia|peste|paura|follia|orrore|fantasma/i.test(L)) add('Cibo del mezzuomo', 1);
  if (attivo && (inc.tag || []).includes('non-morto') && haAggeggio(e, /amuleto di protezione dai non-morti/i)) add('Amuleto anti non-morti', 1);
  if (/soffio/i.test(L) && haAggeggio(e, /pelle di drago/i)) add('Pelle di drago', 1);
}

/** Modificatore ai tiri salvezza in base a tratti, abilità, traguardi e condizioni (etichetta = descrizione del tiro). */
const MAGIA = /magi|mana|volont|paura|terrore|orrore|malocchio|raggio|verbo|incant|illusion|fantasma|smarrimento|follia|caos/i;
const FISICO = /soffio|veleno|malattia|schiv|botola|tagliola|mannaia|catene|fossa|masso|globo|gas|inghiott|correre|forza|scal|salt|nuot|tentacol|manto|dard[oi]|lacrimogeno|lance|pietrific/i;
export function bonusSalvezza(e, label = '') {
  const parti = [];
  const add = (t, v) => { if (v) parti.push([t, v]); };
  const L = String(label), p = e.perm || {}, inc = S.adv?.incontro, nomeInc = inc && inc.stato !== 'finito' ? (inc.nome || '') : '';
  if (abissoAttivo()) bonusSalvezzaAbisso(e, L, inc, add);
  if (profonditaAttiva()) P.salvezza(e, L, inc, add);
  V.salvezza(e, L, inc, add);
  if (!suppl()) return { tot: parti.reduce((a, q) => a + q[1], 0), parti };
  const paura = /paura|terrore|orrore|fantasma/i.test(L);
  if (haAbilita(e, 'concentrazione-mentale') && MAGIA.test(L)) add('Concentrazione mentale', e.livello);
  if (e.classe === 'veterano' && FISICO.test(L)) add('Veterano: tiro fisico', -e.livello);
  if (e.ubriaco) add('Ubriaco', paura ? 1 : -1);
  if (e.allergiaPozioni > 0 && /veleno/i.test(L)) add('Allergia alle pozioni', -1);
  if (p.veleno && /veleno/i.test(L)) add('Tolleranza al veleno', 1);
  if (/sguardo della medusa|pietrific/i.test(L)) { if (p.sguardo) add('Resistente allo sguardo', 2); if (p.trasformazione) add('Tolleranza alla trasformazione', 1); }
  if (p.streghe && /strega|stregon|megera|fattucchier/i.test(nomeInc)) add('Sterminatore di streghe', 1);
  if (p['flagello-ghoul'] && /ghoul/i.test(nomeInc)) add('Flagello dei ghoul', 1);
  if (/gelo|freddo|ghiaccio/i.test(L) && eroiVivi().some(x => x.perm?.thuugas)) add('Santuario di Thuugas Min', 2);
  if (paura) {
    const altri = eroiVivi().filter(x => x.id !== e.id && x.stato === 'ok'), ordine = (S.party.ordine || []).slice(0, 2);
    if (altri.some(x => haAbilita(x, 'leader-carismatico') || (tratto(x, 'presenza') && ordine.includes(x.id)))) add('Leader / presenza incoraggiante', 1);
  }
  return { tot: parti.reduce((a, q) => a + q[1], 0), parti };
}

const EXTRA = ['livPrimoTurno', 'livDifesaFerito', 'immuneIncantesimi', 'immuneContundenti', 'veleno', 'petrifica', 'dissangua', 'sofLiv', 'sofDanno',
  'attDadi', 'richiamo', 'scissione', 'orda', 'sfortuna', 'ratti', 'follia', 'attPerBersaglio', 'leader', 'leaderProb', 'maiErrante', 'contundentePiu', 'dannoSu1', 'rompeScudo', 'psionico',
  // Contro l'Abisso
  'paralisi', 'vampirismo', 'licantropia', 'marchiatura', 'lameInfette', 'rubaOro', 'stritola', 'scorta', 'elettricita', 'illusione', 'auraOgniTurno', 'paura', 'folliaIncontro',
  'incantesimiAnnullati', 'disarmaSu1', 'leaderDati', 'immuneSonnoProb', 'incantesimiMod', 'modPallaDiFuoco', 'attiraErranti', 'nonAttacca', 'malusDifesa', 'frecceMod', 'attaccaPerPrimo',
  'evitaFerita', 'sorpresaProb', 'ignoraArmatura', 'bonusDifesaClassi', 'rompeScudoSu1', 'sofBonus', 'sofSoloPrimoTurno', 'livControDistanza', 'vulnerabileSolo', 'dannoDaIncantesimo',
  'tesoroFossa', 'premioMorte', 'benedizioneModReazione', 'nonAttaccaInFuga', 'corruzioneAlternativa', 'tesoroSoloGemmeMagici', 'senzaSoffio', 'argentoMod', 'immobile', 'allarmeFurfante',
  'unicoPerDungeon', 'bersagliPrioritari', 'follia', 'oroFisso'];

const EXTRA_S = ['immuneIncantesimi', 'nonAttacca', 'sorpresaProb', 'attaccaPerPrimo', 'attPerBersaglio', 'incantesimiMod'];   // campi di EXTRA con lo stesso significato nei Labirinti Silvani
const EXTRA_Q = ['veleno', 'contundentePiu', 'immuneIncantesimi', 'maiErrante', 'attDadi'];
const QX = ['salvezza', 'aggancio', 'intrappola', 'frenesia', 'iniziativa', 'contraccolpo', 'contundenteMod', 'modAttaccoContro', 'immuneVeleno', 'immuneMalattie', 'attDivisiEquamente', 'attDadiOgniTurno', 'attaccoCrescente',
  'incantesimiMostro', 'tentacoli', 'tiriES', 'tesoroExtra', 'indebolitoSe', 'infezione', 'moraleRegola', 'patto', 'trasformaCaduti', 'distruggePergamenePallaDiFuoco', 'ignoraSoloArmatura', 'vulnerabileAcquaSanta',
  'perdeLivello', 'poteri', 'nonAumentareBossFinale', 'paralisi', 'paura', 'premioMorte', 'bersagliPrioritari', 'corruzioneAlternativa', 'comeInStanza', 'bonusPrimoTurno', 'modPallaDiFuoco', 'incantesimiMod', 'frecceMod', 'attiraErranti'];

/** Descrive il mostro in base ad una voce della tabella. */
export function creaIncontro(tabellaNome, voce, quantita, opzioni = {}) {
  const dq = typeof voce.id === 'string' && /^[qk]-/.test(voce.id);   // voci di «Acque Oscure» e «Caverne dei Coboldi»
  const sv = typeof voce.id === 'string' && voce.id.startsWith('s-');   // voci di «Labirinti Silvani»: poteri in inc.sv
  const prof = typeof voce.id === 'string' && voce.id.startsWith('p-');   // voci di «Contro le Profondità Dimenticate»: formule su LMP e GR
  const maggiore = ['aberranti', 'boss', 'draghi'].includes(tabellaNome) || (prof && voce.conta === '1');
  const finale = !!opzioni.bossFinale;
  const boost = finale && maggiore && !voce.nonAumentareBossFinale;
  const pv = (prof ? P.pvMostro(voce) : voce.pvFormula ? livelloMax() + (voce.pvLMP || 0) : voce.pv) + (boost ? 1 : 0) + (maggiore ? (opzioni.pvExtra || 0) : 0);
  const livBase = (prof ? P.livMostro(voce) : voce.liv === 'LMP' ? livelloMax() : voce.liv) + (maggiore ? (opzioni.livExtra || 0) : 0);   // livExtra: scala dei Labirinti Silvani
  const inc = {
    tabella: tabellaNome, id: voce.id, nome: voce.nome, minore: !maggiore,
    tag: [...(voce.tag || [])], livBase, liv: livBase,
    att: voce.att + (boost ? 1 : 0), danno: voce.danno || 1,
    n: maggiore ? 1 : quantita, nIniziale: maggiore ? 1 : quantita,
    pvMax: pv, pv, moraleMod: typeof voce.mor === 'number' ? voce.mor : 0, noMorale: voce.mor === 'NO' || (finale && maggiore),   // il boss finale combatte fino alla morte (FAQ)
    tes: voce.tes, tesMolt: voce.tesMolt || (voce.tes === 'x2' ? 2 : 1), xp: voce.xp !== false,
    note: voce.note || '', reazioni: voce.reazioni || [], speciale: voce.speciale || null, drago: !!voce.drago,
    bossFinale: finale, errante: !!opzioni.errante, sorpresa: !!opzioni.errante,
    stato: 'nuovo', moraleFatto: false, reazione: null, turno: 0, sottoAttacco: false,
    sedato: 0, segreta: !!opzioni.segreta,
    ...Object.fromEntries(EXTRA.filter(k => voce[k] !== undefined && !(prof && ['veleno', 'orda', 'illusione', 'follia'].includes(k)) && !(dq && !EXTRA_Q.includes(k)) && !(sv && !EXTRA_S.includes(k))).map(k => [k, voce[k]]))
  };
  if (sv) inc.sv = V.poteriMostro(voce);
  if (prof) P.adattaMostro(inc, voce, maggiore);
  if (dq) inc.qx = Object.fromEntries(QX.filter(k => voce[k] !== undefined).map(k => [k, voce[k]]));   // poteri dei due supplementi, tenuti separati dai campi di Abisso e Caos
  return inc;
}


function bonusSupplAttacco(e, ctx, bers, arma, add) {
  const p = e.perm || {}, tags = bers.tag || [], nome = bers.nome || '', mischia = !arma?.lancio && !ctx.incantesimo;
  for (const [id, re] of FLAGELLI) if (p[id] && re.test(nome) && (id !== 'flagello-ghoul' || mischia)) add('Flagello', 1);
  if (p.grazia && mischia && !bers.minore && !bers.orda && bers.pv === 1) add('Colpo di grazia', 2);
  if (p.dragonidi && bers.drago) add('Distruttore di dragonidi', 1);
  if (p.infestanti && bers.tabella === 'infestanti') add('Sterminatore di infestanti', 1);
  if (ctx.nomeIncantesimo === 'Fulmine Magico' && p.fulmine) add('Padronanza del fulmine', 1);
  if (ctx.nomeIncantesimo === 'Sonno' && p.sonno) add('Padronanza del sonno', 1);
  if (REGEX_GELO.test(nome) && eroiVivi().some(x => x.perm?.thuugas)) add('Santuario di Thuugas Min', 1);
  if (ctx.incantesimo && ctx.nomeIncantesimo && tratto(e, 'talento')?.incantesimo === ctx.nomeIncantesimo && e.classe !== 'barbaro') add('Talento magico', 1);
  if (ubriacoAtt(e)) add('Ubriaco', -1);
  if (e.allergiaPozioni > 0) add('Allergia alle pozioni', -1);
  if (furiaSangue(e)) add('Furia di sangue', 1);
  if (tratto(e, 'miope') && arma?.lancio && !ctx.incantesimo && e.occhiali !== true) add('Miope', -1);
  if (ctx.sputafuoco) add('Sputafuoco (livello)', e.livello);
  if (e.bonusProssimo) add('Cappuccio del caos', e.bonusProssimo);
  if (ctx.sangueOrco) add('Sangue orchesco', 1);
  if (!ctx.incantesimo) {
    if (e.mazzaGiustizia && arma?.tipo === 'contundente' && arma.categoria === 'una-mano' && tags.includes('caos')) add('Mazza della giustizia', 1);
    if (e.armaDorata && arma && /energia|elettric|fulmin/i.test(nome)) add('Arma dorata', 2);
    if (e.asciaNydann && e.classe === 'nano' && arma?.tipo === 'taglio' && arma.categoria === 'una-mano') add('Ascia di Nydann', 1);
    if (e.cimelioArma && arma?.categoria === 'leggera' && !arma.lancio) add('Arma leggera magica (cimelio)', 1);
  }
}
const ubriacoAtt = e => !!e.ubriaco;
/** Capacità prestate con l'abilità Assistenza nell'incontro in corso: chi le riceve guadagna il bonus, chi le presta lo perde. */
function bonusPrestiti(e, tipo, add) {
  const inc = S.adv?.incontro; if (!inc || inc.stato === 'finito') return;
  for (const p of inc.prestiti || []) {
    const v = p.cap === 'att-livello' ? ['att', e.livello] : p.cap === 'dif-livello' ? ['dif', e.livello] : p.cap === 'dif-mezzo' ? ['dif', Math.floor(e.livello / 2)] : null;
    if (!v || v[0] !== tipo) continue;
    if (p.a === e.id) add('Assistenza (capacità prestata)', v[1]);
    if (p.da === e.id) add('Assistenza (capacità prestata ad altri)', -v[1]);
  }
}

/** Bonus e malus d'attacco del supplemento «Contro l'Abisso»: abilità avanzate, artigiani, oggetti e poteri dei mostri. */
function bonusAttaccoAbisso(e, ctx, bers, arma, add) {
  const tags = bers.tag || [], nome = bers.nome || '', sr = e.srv || {}, mischia = !arma?.lancio && !ctx.incantesimo;
  const ab = id => (e.abilita || []).find(a => a.id === id);
  if (ctx.incantesimo) {
    add('Potere del mostro (incantesimi)', bers.incantesimiMod || 0);
    if (ctx.nomeIncantesimo === 'Palla di Fuoco') add('Potere del mostro (Palla di Fuoco)', bers.modPallaDiFuoco || 0);
  }
  if (ab('ammazzaorchi') && (tags.includes('orco') || /\borc/i.test(nome))) add('Ammazzaorchi', 1);
  if (ab('cacciatore-di-vampiri') && tags.includes('vampiro')) add('Cacciatore di vampiri', 1);
  if (e.settaVampiri && tags.includes('vampiro')) add('Setta ammazzavampiri', 0);
  if (ctx.tenzone && ab('gladiatore')) add('Gladiatore', 1);
  if (ab('mira-infallibile') && ((e.classe === 'elfo' && arma?.id === 'arco') || (e.classe === 'mezzuomo' && arma?.id === 'fionda'))) add('Mira infallibile', 1);
  const ng = ab('nemico-giurato'); if (ng && ng.bersaglio === bers.id) add('Nemico giurato', 1);
  if (ab('sterminatore-di-draghi') && bers.drago && !(bers.sterminati || {})[e.id]) add('Sterminatore di draghi', 1);
  if (!arma && ab('rissaiolo')) add('Rissaiolo', 1);
  if (arma && (e.armiArgento || []).includes(arma.id) && bers.argentoMod) add('Arma d’argento', bers.argentoMod);
  if (arma && (e.armiArgento || []).includes(arma.id) && tags.includes('licantropo') && !bers.argentoMod) add('Arma d’argento', 1);
  if (['arco', 'balestra'].includes(arma?.id) && bers.frecceMod) add('Frecce contro teschi volanti', bers.frecceMod);
  if (sr.armaiolo && mischia && arma?.tipo === 'taglio') add('Lama affilata (armaiolo)', 1);
  if (sr.veleno && !sr.veleno.usato && mischia && bers.minore && !tags.includes('non-morto') && !bers.drago) add('Arma avvelenata', 1);
  if (bers.pauraEroi?.[e.id] && bers.pvMax - bers.pv < 2) add('Terrore del lich', -1);
  if (e.orrore) add('Stanza degli orrori', -1);
  if (e.avvelenatoAtt > 0) add('Agnello guasto', -1);
}
/** Bonus e malus di difesa del supplemento «Contro l'Abisso». */
function bonusDifesaAbisso(e, ctx, add) {
  const tags = ctx.tag || [], nome = ctx.nome || '', sr = e.srv || {}, poz = e.pozioni || {};
  const ab = id => (e.abilita || []).find(a => a.id === id);
  if (haAggeggio(e, /anello della difesa/i)) add('Anello della difesa', 1);
  if (tags.includes('vampiro') && haAggeggio(e, /croce contro i vampiri/i)) add('Croce contro i vampiri', 2);
  if (tags.includes('non-morto') && haAggeggio(e, /amuleto di protezione dai non-morti/i)) add('Amuleto anti non-morti', 1);
  if (!ctx.ignoraArmatura) {
    if (e.scudoMagico && e.scudo && !ctx.ignoraScudo && !ctx.sorpreso && !ctx.fuga) add('Scudo magico (+2 invece di +1)', 1);
    if (e.cottaElfica && e.armatura === 'leggera' && !ctx.ignoraSoloArmatura) add('Cotta di maglia elfica (+2)', 1);
    if (e.armaturaIncantata && e.armatura === 'pesante' && !ctx.ignoraPesante && !ctx.ignoraSoloArmatura) add('Armatura incantata (+3)', 1);
  }
  if (tags.includes('drago') && haAggeggio(e, /pelle di drago/i)) add('Pelle di drago', 1);
  if (poz.argento && /lupo mannaro/i.test(nome)) add('Argento polverizzato', 1);
  if (poz.mentesalda && /urlatore/i.test(nome)) add('Estratto di mentesalda', 2);
  if (ctx.tenzone && ab('gladiatore')) add('Gladiatore', 1);
  if ((e.abilita || []).some(a => a.id === 'resistente' && a.bersaglio && a.bersaglio === ctx.id)) add('Resistente', 1);
  if ((ctx.ritirata || ctx.fuga) && ab('lesto-di-piedi')) add('Lesto di piedi', 1);
  if (e.merc === 'm-sterminatore-ratti' && /ratt|topo/i.test(nome)) add('Sterminatore di ratti', 2);
  if (e.marchiato && /formica/i.test(nome)) add('Marchiato dagli uomini formica', -1);
  if (e.illuso) add('Illuso dal drago', -1);
  if (e.vendetta && !ctx.minore) add('Sete di vendetta', -1);
  if (e.cestoIngombrante) add('Tesoro ingombrante', -1);
  if (ctx.malusDifesa) add('Potere del mostro', ctx.malusDifesa);
}

/** Modificatore al tiro di attacco. Restituisce {tot, parti:[[testo, valore]]}. */
export function modAttacco(e, ctx = {}) {
  const parti = [];
  const add = (t, v) => { if (v) parti.push([t, v]); };
  const arma = ctx.arma !== undefined ? armaDi(ctx.arma) : armaPrincipale(e);
  const liv = e.livello, bers = ctx.bersaglio || {};
  const tags = bers.tag || [];
  const daLancio = arma?.lancio;
  const dueMani = arma?.categoria === 'due-mani';
  if (V.classeSilvana(e)) V.attaccoClasse(e, ctx, bers, arma, add);   // druido, elfo silvano, guida, signore delle bestie, compagni animali
  else if (ctx.incantesimo) {
    if (ctx.sputafuoco) { /* non magico: il livello si aggiunge sotto, per qualsiasi classe */ }
    else if (['mago', 'elfo', 'elfo-fuoco'].includes(e.classe)) add('Livello (incantesimo)', liv);
    else if (ctx.daPergamena) add('Pergamena (livello 1)', 0);
    if (e.classe === 'elfo' && tags.includes('orco')) add('Elfo vs orchi', 1);
  } else {
    switch (e.classe) {
      case 'barbaro': case 'guerriero': add('Livello', liv); break;
      case 'nano': if (!daLancio) add('Livello', liv); break;
      case 'elfo': if (!dueMani) add('Livello', liv); break;
      case 'chierico': if (tags.includes('non-morto')) add('Livello (non-morti)', liv); else add('Mezzo livello', Math.floor(liv / 2)); break;
      case 'furfante': if (ctx.inferiorita && bers.minore) add('Livello (inferiorità numerica)', liv); break;
      case 'mezzuomo': if (arma?.id === 'fionda') add('Fionda: 1/3 livello', Math.floor(liv / 3)); break;
      case 'assassino': add('Livello', liv); break;
      case 'spadaccino': add('Mezzo livello', Math.floor(liv / 2)); break;
      case 'elfo-fuoco': if (!dueMani) add('Livello', liv); break;
      case 'tiratore': if (daLancio) add('Livello +1', liv + 1); else add('Mezzo livello', Math.floor(liv / 2)); break;
      case 'arlecchino': { const ok = a => ['leggera', 'una-mano'].includes(a?.categoria) && !a.lancio; if (!(ok(arma) && (e.armi || []).filter(id => ok(armaDi(id))).length >= 2)) add('Mezzo livello (1 sola arma)', Math.floor(liv / 2)); break; }
    }
    if (!arma) add('Disarmato', -2);
    else {
      if (arma.mod) add(`${arma.nome}`, arma.mod);
      if (['mago', 'furfante', 'mezzuomo'].includes(e.classe) && ['due-mani', 'una-mano'].includes(arma.categoria)) add('Arma pesante usata come leggera', -1 - arma.mod);
      if (arma.tipo === 'contundente' && bers.contundentePiu) add('Arma contundente vs scheletri', 1);
    }
    if (e.classe === 'nano' && tags.includes('goblin')) add('Nano vs goblin', 1);
    if (e.classe === 'elfo' && tags.includes('orco')) add('Elfo vs orchi', 1);
  }
  if (e.bonusMagico) add('Arma magica', e.bonusMagico);
  if (e.bonusIncontro) add('Dono del caos', e.bonusIncontro);
  if ((e.tratti || []).some(t => t.id === 'tamas') && tags.includes('caos')) add('Benedizione di Tamas Zeya', 1);
  if (suppl()) { bonusSupplAttacco(e, ctx, bers, arma, add); if (!ctx.incantesimo) bonusPrestiti(e, 'att', add); }
  if (abissoAttivo()) { bonusAttaccoAbisso(e, ctx, bers, arma, add); if (e.mercAtt && !ctx.incantesimo) add('Armigero', e.mercAtt); }
  if (profonditaAttiva()) P.attacco(e, ctx, bers, arma, add, parti);
  Q.attacco(e, ctx, bers, arma, add);
  V.attacco(e, ctx, bers, arma, add);
  if (e.zoppo) add('Zoppicante', -1);
  if (ctx.senzaLanterna && e.classe !== 'elfo-fuoco' && !e.pozioni?.scurovisione) add('Gruppo senza lanterna', -2);   // l'elfo del fuoco vede anche al buio
  if (ctx.bonusGruppo) add(ctx.bonusGruppoTxt || 'Bonus', ctx.bonusGruppo);
  if (ctx.extra) add('Altro', ctx.extra);
  return { tot: parti.reduce((a, p) => a + p[1], 0), parti };
}

/** Modificatore al tiro di difesa contro un mostro. */
export function modDifesa(e, ctx = {}) {
  const parti = [];
  const add = (t, v) => { if (v) parti.push([t, v]); };
  const tags = ctx.tag || [];
  const gigante = tags.includes('gigante') || tags.includes('troll');
  if (!ctx.ignoraArmatura) {
    if (e.armatura === 'leggera' && !ctx.ignoraSoloArmatura) add('Armatura leggera', 1);
    if (e.armatura === 'pesante' && !ctx.ignoraPesante && !ctx.ignoraSoloArmatura) add('Armatura pesante', 2);
    if (e.scudo && !ctx.ignoraScudo && !ctx.sorpreso && !ctx.fuga) add('Scudo', 1);
  }
  if (e.classe === 'furfante') add('Furfante: livello', e.livello);
  if (e.classe === 'arlecchino') add('Arlecchino: mezzo livello', Math.floor(e.livello / 2));
  if (e.classe === 'spadaccino') add('Spadaccino: mezzo livello', Math.floor(e.livello / 2));
  if (e.classe === 'nano' && gigante) add('Nano vs giganti/troll', 1);
  if (e.classe === 'mezzuomo' && gigante) add('Mezzuomo vs giganti/troll', e.livello);
  if (e.bonusDifesa) add('Armatura magica', e.bonusDifesa);
  if (ctx.ritirata) add('Ritirata', 1);
  if (abissoAttivo() && e.incenso && (tags.includes('non-morto') || /demon/i.test(ctx.nome || ''))) add('Incenso protettivo', 1);
  if (ctx.protezione) add('Protezione', 2);
  if (e.maledetto) add('Maledizione', -1);
  if (suppl()) {
    if (e.ubriaco) add('Ubriaco', -1);
    if (furiaSangue(e)) add('Furia di sangue', 1);
    if (e.stordito) add('Stordito dall’esplosione', -1);
    if (S.adv?.missione?.portatoreArazzo === e.id) add('Porta l’arazzo', -1);
    bonusPrestiti(e, 'dif', add);
    for (const [id, re] of FLAGELLI) if (id !== 'flagello-ghoul' && e.perm?.[id] && re.test(ctx.nome || '')) add('Flagello', 1);
  }
  if (abissoAttivo()) bonusDifesaAbisso(e, ctx, add);
  if (profonditaAttiva()) P.difesa(e, ctx, add);
  Q.difesa(e, ctx, add);
  V.difesa(e, ctx, add);
  if (e.zoppo) add('Zoppicante', -1);
  if (ctx.senzaLanterna && e.classe !== 'elfo-fuoco' && !e.pozioni?.scurovisione) add('Gruppo senza lanterna', -2);
  if (ctx.primoMinotauro) add('Carica del minotauro', -1);
  if (ctx.extra) add('Altro', ctx.extra);
  return { tot: parti.reduce((a, p) => a + p[1], 0), parti };
}

export const gruppoHaLanterna = () => !(S.adv?.incontro?.buio && S.adv.incontro.stato !== 'finito') && eroiVivi().some(e => e.stato === 'ok' && (e.lanterna || (abissoAttivo() && haAbilita(e, 'luce-perenne'))));
export const haNano = () => eroiVivi().some(e => e.classe === 'nano');

/** Tesoro da trasportare: oro massimo 200 ecc. (solo avviso) */
export function sovraccarico(e) {
  const armiCont = (e.armi || []).reduce((a, id) => a + (armaDi(id)?.mani === 2 && id !== 'arco' ? 2 : id === 'fionda' ? 0 : 1), 0);
  const scudi = e.scudo ? 1 : 0;
  if (e.ondataForza > 0) return false;   // Ondata di Forza: nessuna penalità di peso
  return (e.oro || 0) > 200 * V.caricoCavalcatura(e) || armiCont > 3 || scudi > 2;   // una cavalcatura porta il carico (mulo: triplo)
}

/** Caratteristiche di un mostro in forma leggibile. */
export function descriviMostro(m) {
  const mor = m.noMorale ? 'NO' : m.moraleMod ? (m.moraleMod > 0 ? `+${m.moraleMod}` : m.moraleMod) : 'ST';
  const molt = m.tesMolt > 1 && m.tes !== 'x2' ? ` x${m.tesMolt}` : '';
  const tes = m.tes === 'NO' ? 'NO' : m.tes === 'x2' ? 'x2' : (m.tes === 0 ? 'ST' : (m.tes > 0 ? `+${m.tes}` : m.tes)) + molt;
  return `LIV ${m.liv} · ATT ${m.att} · PV ${m.minore ? 1 : m.pvMax} · MOR ${mor} · TES ${tes}`;
}

export const ETICHETTE_REAZIONE = {
  pacifico: 'Pacifico', tenzone: 'Singolar tenzone', banchetto: 'Banchetto',
  fugge: 'Fugge', 'fugge-inf': 'Fugge se in inferiorità numerica', corruzione: 'Corruzione', combatte: 'Combatte',
  morte: 'Combatte fino alla morte', 'combatte-sempre': 'Combatte sempre', dorme: 'Dorme (+2 al primo attacco)', missione: 'Missione', enigma: 'Enigma', sfida: 'Sfida magica',
  amichevole: 'Amichevole (ti lascia passare, nessun tesoro)', immobile: 'Immobile (non attacca, urla)', mercanti: 'Mercanti (come Pacifico, vendono oggetti)', cattura: 'Cattura (attacchi non letali: i caduti sono catturati)'
};
export function reazioneTesto(r, m) {
  const eti = ETICHETTE_REAZIONE[r[2]] || r[2];
  if (r[2] === 'corruzione') {
    const unita = r[4] === 'totale' ? 'in tutto' : 'a mostro';
    return `${eti} (${r[3]} ${r[5] || 'p.o.'} ${unita})`;
  }
  return eti;
}
export function reazioniElenco(m) {
  return m.reazioni.map(r => `${r[0] === r[1] ? r[0] : r[0] + '-' + r[1]}) ${reazioneTesto(r, m)}`).join(', ');
}
export function trovaReazione(m, v) {
  return m.reazioni.find(r => v >= r[0] && v <= r[1]) || m.reazioni[m.reazioni.length - 1];
}
