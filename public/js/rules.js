// Regole di Four Against Darkness: calcolo modificatori, tabelle, mostri.
import { R, S, eroiVivi, livelloMax } from './state.js';

export const NOME_ARMATURA = { nessuna: 'Nessuna', leggera: 'Armatura leggera', pesante: 'Armatura pesante' };

export const armaDi = id => R.equipaggiamento.armi.find(a => a.id === id);
export const armaPrincipale = e => armaDi(e.armaPrincipale);
export const nomeClasse = e => R.classi[e.classe].nome;
export const incantatore = e => ['mago', 'elfo', 'elfo-fuoco'].includes(e.classe);
export const puoUsareMagia = e => e.classe !== 'barbaro';

/** Cerca una riga di tabella in base al valore del dado. */
export function riga(tab, v) {
  return tab.find(r => v >= r.da && v <= r.a) || tab[tab.length - 1];
}
// Set di tabelle attivo per l'avventura: base, «Nemici diabolici» (avanzate) o «Caverne del Caos» (supplemento).
export const SETS = { base: 'Four Against Darkness (lvl 1-2)', diabolici: 'Four Against Darkness – Nemici diabolici (lvl 3-5)', caos: 'Contro il Caos (lvl 3-6)' };
export const setAttivo = () => (S.adv && S.adv.set) || 'base';
const datiSet = () => ({ diabolici: R.avanzate, caos: R.caos })[setAttivo()];
export const inCaos = () => setAttivo() === 'caos';
export const tabella = nome => datiSet()?.tabelle?.[nome] || R.tabelle[nome];
export const mostriTabella = nome => datiSet()?.mostri?.[nome] || R.mostri[nome];
export const incantesimoACasoLista = () => {
  const l = tabella('incantesimoCaso');
  if (setAttivo() === 'caos') return l;                     // incantesimi del caos (d6)
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
export function armaConsentita(e, a) {
  if (!a) return { ok: true };
  if (a.soloClassi && !a.soloClassi.includes(e.classe)) return { ok: false, motivo: `${a.nome}: la possono usare solo ${a.soloClassi.map(c => R.classi[c]?.nome || c).join(', ')}.` };
  if (a.lancio && e.classe === 'elfo-fuoco') return { ok: false, motivo: 'Gli elfi del fuoco non usano armi a distanza.' };
  if (e.classe === 'veterano' && a.categoria === 'due-mani') return { ok: false, motivo: 'Il veterano non porta armi a due mani.' };
  return { ok: true };
}
const LIMITE_ARMI = { bolas: 2, boomerang: 1 };
export const limiteArma = (e, id) => !LIMITE_ARMI[id] || (e.armi || []).filter(x => x === id).length < LIMITE_ARMI[id];

/** Modificatore ai tiri salvezza in base a tratti, abilità, traguardi e condizioni (etichetta = descrizione del tiro). */
const MAGIA = /magi|mana|volont|paura|terrore|orrore|malocchio|raggio|verbo|incant|illusion|fantasma|smarrimento|follia|caos/i;
const FISICO = /soffio|veleno|malattia|schiv|botola|tagliola|mannaia|catene|fossa|masso|globo|gas|inghiott|correre|forza|scal|salt|nuot|tentacol|manto|dard[oi]|lacrimogeno|lance|pietrific/i;
export function bonusSalvezza(e, label = '') {
  const parti = [];
  if (!suppl()) return { tot: 0, parti };
  const add = (t, v) => { if (v) parti.push([t, v]); };
  const L = String(label), p = e.perm || {}, inc = S.adv?.incontro, nomeInc = inc && inc.stato !== 'finito' ? (inc.nome || '') : '';
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
  'attDadi', 'richiamo', 'scissione', 'orda', 'sfortuna', 'ratti', 'follia', 'attPerBersaglio', 'leader', 'leaderProb', 'maiErrante', 'contundentePiu', 'dannoSu1', 'rompeScudo', 'psionico'];

/** Descrive il mostro in base ad una voce della tabella. */
export function creaIncontro(tabellaNome, voce, quantita, opzioni = {}) {
  const maggiore = ['aberranti', 'boss'].includes(tabellaNome);
  const finale = !!opzioni.bossFinale;
  const pv = voce.pv + (finale && maggiore ? 1 : 0) + (maggiore ? (opzioni.pvExtra || 0) : 0);
  const livBase = voce.liv === 'LMP' ? livelloMax() : voce.liv;
  return {
    tabella: tabellaNome, id: voce.id, nome: voce.nome, minore: !maggiore,
    tag: [...(voce.tag || [])], livBase, liv: livBase,
    att: voce.att + (finale && maggiore ? 1 : 0), danno: voce.danno || 1,
    n: maggiore ? 1 : quantita, nIniziale: maggiore ? 1 : quantita,
    pvMax: pv, pv, moraleMod: typeof voce.mor === 'number' ? voce.mor : 0, noMorale: voce.mor === 'NO',
    tes: voce.tes, tesMolt: voce.tesMolt || (voce.tes === 'x2' ? 2 : 1), xp: voce.xp !== false,
    note: voce.note || '', reazioni: voce.reazioni || [], speciale: voce.speciale || null, drago: !!voce.drago,
    bossFinale: finale, errante: !!opzioni.errante, sorpresa: !!opzioni.errante,
    stato: 'nuovo', moraleFatto: false, reazione: null, turno: 0, sottoAttacco: false,
    sedato: 0, segreta: !!opzioni.segreta,
    ...Object.fromEntries(EXTRA.filter(k => voce[k] !== undefined).map(k => [k, voce[k]]))
  };
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

/** Modificatore al tiro di attacco. Restituisce {tot, parti:[[testo, valore]]}. */
export function modAttacco(e, ctx = {}) {
  const parti = [];
  const add = (t, v) => { if (v) parti.push([t, v]); };
  const arma = ctx.arma !== undefined ? armaDi(ctx.arma) : armaPrincipale(e);
  const liv = e.livello, bers = ctx.bersaglio || {};
  const tags = bers.tag || [];
  const daLancio = arma?.lancio;
  const dueMani = arma?.categoria === 'due-mani';
  if (ctx.incantesimo) {
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
  if (e.zoppo) add('Zoppicante', -1);
  if (ctx.senzaLanterna && e.classe !== 'elfo-fuoco') add('Gruppo senza lanterna', -2);   // l'elfo del fuoco vede anche al buio
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
    if (e.armatura === 'leggera') add('Armatura leggera', 1);
    if (e.armatura === 'pesante' && !ctx.ignoraPesante) add('Armatura pesante', 2);
    if (e.scudo && !ctx.ignoraScudo && !ctx.sorpreso && !ctx.fuga) add('Scudo', 1);
  }
  if (e.classe === 'furfante') add('Furfante: livello', e.livello);
  if (e.classe === 'arlecchino') add('Arlecchino: mezzo livello', Math.floor(e.livello / 2));
  if (e.classe === 'nano' && gigante) add('Nano vs giganti/troll', 1);
  if (e.classe === 'mezzuomo' && gigante) add('Mezzuomo vs giganti/troll', e.livello);
  if (e.bonusDifesa) add('Armatura magica', e.bonusDifesa);
  if (ctx.ritirata) add('Ritirata', 1);
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
  if (e.zoppo) add('Zoppicante', -1);
  if (ctx.senzaLanterna && e.classe !== 'elfo-fuoco') add('Gruppo senza lanterna', -2);
  if (ctx.primoMinotauro) add('Carica del minotauro', -1);
  if (ctx.extra) add('Altro', ctx.extra);
  return { tot: parti.reduce((a, p) => a + p[1], 0), parti };
}

export const gruppoHaLanterna = () => !(S.adv?.incontro?.buio && S.adv.incontro.stato !== 'finito') && eroiVivi().some(e => e.lanterna && e.stato === 'ok');
export const haNano = () => eroiVivi().some(e => e.classe === 'nano');

/** Tesoro da trasportare: oro massimo 200 ecc. (solo avviso) */
export function sovraccarico(e) {
  const armiCont = (e.armi || []).reduce((a, id) => a + (armaDi(id)?.mani === 2 && id !== 'arco' ? 2 : id === 'fionda' ? 0 : 1), 0);
  const scudi = e.scudo ? 1 : 0;
  if (e.ondataForza > 0) return false;   // Ondata di Forza: nessuna penalità di peso
  return (e.oro || 0) > 200 || armiCont > 3 || scudi > 2;
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
  morte: 'Combatte fino alla morte', 'combatte-sempre': 'Combatte sempre', dorme: 'Dorme (+2 al primo attacco)', missione: 'Missione', enigma: 'Enigma', sfida: 'Sfida magica'
};
export function reazioneTesto(r, m) {
  const eti = ETICHETTE_REAZIONE[r[2]] || r[2];
  if (r[2] === 'corruzione') {
    const unita = r[4] === 'totale' ? 'in tutto' : 'a mostro';
    return `${eti} (${r[3]} p.o. ${unita})`;
  }
  return eti;
}
export function reazioniElenco(m) {
  return m.reazioni.map(r => `${r[0] === r[1] ? r[0] : r[0] + '-' + r[1]}) ${reazioneTesto(r, m)}`).join(', ');
}
export function trovaReazione(m, v) {
  return m.reazioni.find(r => v >= r[0] && v <= r[1]) || m.reazioni[m.reazioni.length - 1];
}
