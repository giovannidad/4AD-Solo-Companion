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
export const SETS = { base: 'Tabelle base', diabolici: 'Nemici diabolici (avanzate)', caos: 'Caverne del Caos' };
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
    if (['mago', 'elfo', 'elfo-fuoco'].includes(e.classe)) add('Livello (incantesimo)', liv);
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
      case 'arlecchino': if (!daLancio && (e.armi || []).filter(id => ['leggera', 'una-mano'].includes(armaDi(id)?.categoria)).length < 2) add('Mezzo livello (1 sola arma)', Math.floor(liv / 2)); break;
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
  if (e.zoppo) add('Zoppicante', -1);
  if (ctx.senzaLanterna) add('Gruppo senza lanterna', -2);
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
  if (e.zoppo) add('Zoppicante', -1);
  if (ctx.senzaLanterna) add('Gruppo senza lanterna', -2);
  if (ctx.primoMinotauro) add('Carica del minotauro', -1);
  if (ctx.extra) add('Altro', ctx.extra);
  return { tot: parti.reduce((a, p) => a + p[1], 0), parti };
}

export const gruppoHaLanterna = () => eroiVivi().some(e => e.lanterna && e.stato === 'ok');
export const haNano = () => eroiVivi().some(e => e.classe === 'nano');

/** Tesoro da trasportare: oro massimo 200 ecc. (solo avviso) */
export function sovraccarico(e) {
  const armiCont = (e.armi || []).reduce((a, id) => a + (armaDi(id)?.mani === 2 && id !== 'arco' ? 2 : id === 'fionda' ? 0 : 1), 0);
  const scudi = e.scudo ? 1 : 0;
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
