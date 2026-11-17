// Gestione del gruppo: schede eroi, creazione, equipaggiamento, ordine di marcia, negozio.
import { R, S, modificato, salva, log, nuovoEroe, eroePerId, eroiVivi, livelloMax } from './state.js';
import { h, modal, toast, confirmBox, sign, uid, scelta } from './util.js';
import { tira, dado } from './dice.js';
import { armaDi, nomeClasse, sovraccarico, incantatore, NOME_ARMATURA, gruppoHaLanterna, suppl, tratto, armaConsentita, limiteArma, abissoAttivo, maxFurie, profonditaAttiva, grNumero, acqueAttive, classeDisponibile, armaVisibile, controllaArmi, silvaniAttivi } from './rules.js';
import { tiroES, eroePuoSalire } from './game.js';
import * as T from './tratti.js';
import * as A from './abisso.js';
import * as P from './profondita.js';
import * as Q from './acque.js';
import * as V from './silvani.js';
const Prof = P;   // alias: renderGruppo ha una variabile locale P (il gruppo)
import * as C from './combat.js';
import * as Rit from './ritratti.js';
import { equipaggiabile, equipaggia } from './equip.js';

/** Nome non ancora usato nel gruppo (eventualmente con un numero romano), ignorando l'eroe `escludiId` e i nomi già scelti in `extra`. */
const ROMANI = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
function nomeLibero(base, escludiId = null, extra = []) {
  const usati = new Set([...S.party.eroi.filter(e => e.id !== escludiId).map(e => e.nome.trim().toLowerCase()), ...extra.map(n => n.toLowerCase())]);
  const b = (base || 'Senza nome').trim();
  for (let k = 0; k < ROMANI.length; k++) { const n = b + ROMANI[k]; if (!usati.has(n.toLowerCase())) return n; }
  return b + ' ' + (usati.size + 1);
}
/** Nome casuale scelto tra quelli ancora liberi. */
function nomeCasuale(extra = []) {
  const usati = new Set([...S.party.eroi.map(e => e.nome.trim().toLowerCase()), ...extra.map(n => n.toLowerCase())]);
  const liberi = NOMI.filter(n => !usati.has(n.toLowerCase()));
  return liberi.length ? liberi[Math.floor(Math.random() * liberi.length)] : nomeLibero(NOMI[Math.floor(Math.random() * NOMI.length)], null, extra);
}
const NOMI = ['Bruggo', 'Aldric', 'Thora', 'Kenna', 'Marcus', 'Elowen', 'Dollom', 'Grimli', 'Sera', 'Tobin', 'Vesna', 'Rurik', 'Ilya', 'Fenn', 'Mirela', 'Orsolo', 'Brannoc', 'Zadi', 'Nerys', 'Cael'];
const ICONE = { arlecchino: '\u{1F3AD}', assassino: '\u{1F5E1}', 'elfo-fuoco': '\u{1F525}', tiratore: '\u{1F3AF}', veterano: '\u{1F396}', spadaccino: '\u{1F93A}', 'chierico-elidra': '\u{1F3B6}', 'chierico-korimnos': '\u{1F98C}', druido: '\u{1F33F}', 'elfo-silvano': '\u{1F332}', 'guida-terre-selvagge': '\u{1F9ED}', 'signore-bestie': '\u{1F43A}', barbaro: '\u{1FA93}', chierico: '✡', elfo: '\u{1F3F9}', furfante: '\u{1F5E1}', guerriero: '⚔', mago: '✨', mezzuomo: '\u{1F344}', nano: '⛏' };
export const iconaClasse = c => ICONE[c] || '✦';

export function slotIncantesimi(e) {
  let n = (e.classe === 'mago' || e.classe === 'druido') ? 2 + e.livello : e.classe === 'elfo' ? e.livello : e.classe === 'elfo-fuoco' ? 1 : 0;
  if (n && suppl()) { if (e.perm?.pergamene) n++; if (tratto(e, 'mente')?.scelta === 'incantesimo') n++; }   // grimorio di pergamene e Mente geniale
  if (n && e.classe !== 'elfo-fuoco') n += P.livelloMemoria(e);   // Memoria prodigiosa: conta come 2 (o 4) livelli in più
  return n;
}
export function sistemaSlot(e) {
  const n = slotIncantesimi(e);
  e.incantesimi = e.incantesimi || [];
  const aCosto = profonditaAttiva() && n && e.classe !== 'elfo-fuoco';
  if (aCosto) {   // incantesimi eroici (x2) e leggendari (x3): occupano più spazio in memoria, i posti in eccesso saltano dalla coda
    let usato = 0; e.incantesimi = e.incantesimi.filter(s => { const c = P.costoMemoria(s.nome); if (usato + c > n) return false; usato += c; return true; });
    for (; usato < n; usato++) e.incantesimi.push({ nome: 'Sonno', usato: false });
  } else while (e.incantesimi.length < n) e.incantesimi.push({ nome: e.classe === 'elfo-fuoco' ? 'Palla di Fuoco' : V.incantesimoPredefinito(e) || 'Sonno', usato: false });
  if (e.classe === 'elfo-fuoco') e.incantesimi.forEach(s => { s.nome = 'Palla di Fuoco'; });
  if (!aCosto && e.incantesimi.length > n) e.incantesimi.length = n;
  const fisso = suppl() && n && e.perm?.pergamene;   // l'incantesimo del grimorio non si cambia a ogni avventura
  e.incantesimi.forEach((sp, k) => { if (fisso && k === n - 1) { sp.nome = e.perm.pergamene; sp.fisso = true; } else delete sp.fisso; });
}

export function equipaggiamentoIniziale(e) {
  const A = id => { e.armi.push(id); if (!e.armaPrincipale) e.armaPrincipale = id; };
  switch (e.classe) {
    case 'barbaro': case 'guerriero': case 'nano': A('una-mano-taglio'); e.armatura = 'leggera'; e.scudo = true; break;
    case 'chierico': A('una-mano-contundente'); e.armatura = 'leggera'; e.scudo = true; break;
    case 'elfo': A('una-mano-taglio'); e.armi.push('arco'); e.armatura = 'leggera'; break;
    case 'furfante': A('leggera-taglio'); e.armatura = 'leggera'; e.oggetti.push({ nome: 'Corda', qta: 1 }, { nome: 'Grimaldelli', qta: 1 }); break;
    case 'mago': A('leggera-taglio'); e.oggetti.push({ nome: 'Libro di incantesimi', qta: 1 }, { nome: 'Strumenti per scrivere', qta: 1 }); break;
    case 'arlecchino': A('leggera-taglio'); e.armi.push('leggera-taglio', 'una-mano-taglio'); e.armatura = 'leggera'; e.oggetti.push({ nome: 'Costume da menestrello', qta: 1 }, { nome: 'Grimaldelli', qta: 1 }); break;
    case 'assassino': A('una-mano-taglio'); e.armi.push('leggera-taglio'); e.armatura = 'leggera'; e.oggetti.push({ nome: 'Grimaldelli', qta: 1 }); break;
    case 'elfo-fuoco': A('una-mano-taglio'); e.armatura = 'leggera'; break;
    case 'spadaccino': A('una-mano-taglio'); e.armi.push('leggera-taglio'); e.oggetti.push({ nome: 'Cappello piumato (o tricorno)', qta: 1 }, { nome: 'Cappa', qta: 1 }); break;
    case 'tiratore': A('arco'); e.armi.push('leggera-taglio'); e.armatura = 'leggera'; break;
    case 'druido': A('leggera-taglio'); break;
    case 'elfo-silvano': A('una-mano-taglio'); e.armi.push('arco'); e.armatura = 'pesante'; e.cottaFoglia = 2; break;   // cotta di fogliacciaio: armatura pesante senza penalità, 2 avventure
    case 'guida-terre-selvagge': A('leggera-taglio'); e.lanterna = true; break;
    case 'signore-bestie': A('una-mano-taglio'); e.armatura = 'leggera'; e.scudo = true; break;
    case 'veterano': A('leggera-taglio'); e.lanterna = true; e.abilita = [{ id: 'assistenza' }, { id: 'leader-carismatico' }]; break;
    case 'mezzuomo': A('leggera-taglio'); e.armi.push('fionda'); e.oggetti.push({ nome: 'Razioni', qta: 3 }); break;
  }
  sistemaSlot(e);
}

// ---------------- pannello gruppo ----------------
export function renderGruppo(box) {
  box.replaceChildren();
  const P = S.party;
  P.ordine = P.ordine.filter(id => eroePerId(id));
  P.eroi.forEach(e => { if (!P.ordine.includes(e.id)) P.ordine.push(e.id); });
  const lant = gruppoHaLanterna();
  box.append(h('div', { class: 'panel-head' },
    h('h2', {}, 'Il gruppo'),
    h('div', { class: 'btns' },
      h('button', { class: 'primary', onclick: creaEroe, disabled: P.eroi.filter(e => e.stato !== 'morto').length >= 4 && false }, '+ Eroe'),
      profonditaAttiva() && !S.adv.attiva && !S.ospite ? h('button', { onclick: () => Prof.passaDiGrado(), title: 'Tra due avventure: passa al grado eroico (livello 9) o leggendario (livello 14) spendendo tiri ES messi da parte e oro' }, 'Passa di grado') : null,
      abissoAttivo() && !S.adv.attiva ? h('button', { onclick: () => A.addestramento(), title: 'Tra due avventure: 100 p.o. per livello in cambio di 1 tiro ES (regola opzionale di «Contro l’Abisso»)' }, 'Addestramento') : null,
      acqueAttive() ? h('button', { onclick: () => Q.nuovoCompagno(), title: 'Aggiunge un alleato PNG come membro aggiuntivo del gruppo' }, '+ Compagno PNG') : null,
      h('button', { onclick: negozio, title: 'Compra e vendi equipaggiamento' }, 'Negozio'))));
  if (P.eroi.length && !lant) box.append(h('div', { class: 'warn-box' }, 'Nessuna lanterna in mano al gruppo: -2 a tutti gli attacchi e alle difese (regola della lanterna).'));
  const stat = h('div', { class: 'party-stats' },
    h('span', {}, `Oro del gruppo: `, h('b', {}, eroiVivi().reduce((a, e) => a + (e.oro || 0), 0))),
    h('span', {}, `Livello max: `, h('b', {}, livelloMax())),
    profonditaAttiva() ? h('span', { title: 'Numero del grado (GR): usato dai mostri per danni e PV. Livello massimo (LMP) e GR dei mostri delle Profondità' }, ['GR ', h('b', {}, grNumero())]) : null);
  box.append(stat);
  if (!P.eroi.length) box.append(h('div', { class: 'empty' }, h('p', {}, 'Nessun eroe. Crea il tuo gruppo di quattro avventurieri.'), h('button', { class: 'primary', onclick: creaGruppoVeloce }, 'Crea gruppo casuale')));
  P.ordine.forEach((id, idx) => {
    const e = eroePerId(id); if (!e) return;
    box.append(schedaCompatta(e, idx));
  });
  const es = (S.adv.esPendenti || []);
  if (es.length) {
    const b = h('div', { class: 'es-box' }, h('h4', {}, 'Tiri esperienza disponibili'));
    const uguali = m => es.filter(y => y.motivo === m);   // più tiri per lo stesso mostro (es. drago finale): numerati, così si vede che ne resta un altro
    es.forEach(x => { const u = uguali(x.motivo); b.append(h('button', { class: 'accent', onclick: () => scegliPerES(x) }, `Tira ES: ${x.motivo}${u.length > 1 ? ` (${u.indexOf(x) + 1} di ${u.length})` : ''}${x.meno1 ? ' (-1)' : ''}`)); });
    box.append(b);
  }
}

function schedaCompatta(e, idx) {
  const pct = Math.max(0, Math.min(100, e.pv / e.pvMax * 100));
  const stati = [];
  if (e.lanterna) stati.push(h('span', { class: 'tag amber', title: 'Porta la lanterna' }, 'Lanterna'));
  if (e.maledetto) stati.push(h('span', { class: 'tag red' }, 'Maledetto'));
  if (e.zoppo) stati.push(h('span', { class: 'tag red' }, 'Zoppo'));
  if (e.stato === 'pietra') stati.push(h('span', { class: 'tag gray' }, 'Pietrificato'));
  if (e.sfortuna > 0) stati.push(h('span', { class: 'tag gray', title: 'Il 6 non esplode; una Benedizione la toglie' }, `Sfortuna ${e.sfortuna}`));
  if (e.avvolto) stati.push(h('span', { class: 'tag gray' }, 'Avvolto dal manto'));
  if (e.stato === 'morto') stati.push(h('span', { class: 'tag dead' }, 'Caduto'));
  if (sovraccarico(e)) stati.push(h('span', { class: 'tag red', title: 'Troppo carico: -1 alla difesa' }, 'Sovraccarico'));
  if (e.stato === 'prigioniero') stati.push(h('span', { class: 'tag red', title: 'Prigioniero: pagare il riscatto o liberarlo, poi cambia lo stato dalla scheda' }, 'Prigioniero'));
  if (e.png) stati.push(h('span', { class: 'tag amber', title: 'Compagno della missione' }, 'Compagno'));
  for (const [t, c, ti] of Q.statiAcque(e)) stati.push(h('span', { class: `tag ${c}`, title: ti }, t));
  for (const [t, c, ti] of V.statiSilvani(e)) stati.push(h('span', { class: `tag ${c}`, title: ti }, t));
  if (suppl()) {
    if (e.ubriaco) stati.push(h('span', { class: 'tag red', title: '-1 a tutti i tiri finché non scende a metà PV' }, 'Ubriaco'));
    if (e.stordito) stati.push(h('span', { class: 'tag red', title: '-1 alla difesa per un turno' }, 'Stordito'));
    if (e.allergiaPozioni > 0) stati.push(h('span', { class: 'tag gray', title: '-1 agli attacchi e ai salvezza contro veleno' }, `Allergia (${e.allergiaPozioni})`));
    if (tratto(e, 'prima-linea') && idx > 1) stati.push(h('span', { class: 'tag red', title: 'Deve stare nelle posizioni 1-2 dell’ordine di marcia' }, 'Prima linea!'));
    if (tratto(e, 'retroguardia') && idx < 2 && S.party.ordine.length > 2) stati.push(h('span', { class: 'tag red', title: 'Deve stare nelle posizioni 3-4 dell’ordine di marcia' }, 'Retroguardia!'));
    if (tratto(e, 'miope') && e.occhiali !== true) stati.push(h('span', { class: 'tag gray', title: '-1 agli attacchi a distanza' }, 'Senza occhiali'));
  }
  if (abissoAttivo() || A.statiAbisso(e).length) {
    if ((e.follia || 0) > 0) stati.push(h('span', { class: 'tag red', title: `Follia: impazzisce oltre ${e.livello + (e.classe === 'mago' ? 1 : 0) + P.livelloFollia(e)} punti; non può scambiare oggetti o tesoro` }, `Follia ${e.follia}`));
    if (e.licantropia) stati.push(h('span', { class: 'tag red', title: 'Licantropia: rifiuta la lanterna e l’argento; con follia oltre il livello si trasforma' }, 'Licantropo'));
    if (e.peste) stati.push(h('span', { class: 'tag red', title: 'Peste oscura: a ogni stanza 1d8, con 1 perde 1 PV; contagia i compagni' }, 'Peste oscura'));
    if (e.vampirizzato) stati.push(h('span', { class: 'tag dead', title: 'Morto per vampirismo: niente resurrezione finché il corpo non è bruciato o il vampiro ucciso' }, 'Vampirizzato'));
    if (e.livelliPersi > 0) stati.push(h('span', { class: 'tag gray', title: 'Livelli persi per i vampiri (già sottratti dal livello e dai PV)' }, `Livelli persi ${e.livelliPersi}`));
    if (e.paralizzato) stati.push(h('span', { class: 'tag red', title: 'Paralizzato: colpito in automatico, non agisce (Benedizione)' }, 'Paralizzato'));
    if (e.marchiato) stati.push(h('span', { class: 'tag amber', title: '-1 in difesa contro gli uomini formica (Benedizione o acqua)' }, 'Marchiato'));
    if ((e.fortunaExtra || 0) > 0) stati.push(h('span', { class: 'tag green', title: 'Punti fortuna del fortundrago: ripeti un tiro' }, `Fortuna ${e.fortunaExtra}`));
    if (e.merc) stati.push(h('span', { class: 'tag amber', title: e.note }, 'Mercenario'));
  }
  if (profonditaAttiva()) {
    if (e.nonLancia > 0) stati.push(h('span', { class: 'tag red', title: 'Liquido resistente alla magia: niente incantesimi né preghiere' }, `Niente magia (${e.nonLancia})`));
    if (e.legato) stati.push(h('span', { class: 'tag red', title: 'Legato alla stanza dalla trappola dell’anima (serve una Benedizione)' }, 'Legato'));
    if (e.bloccato || e.allucinato) stati.push(h('span', { class: 'tag red', title: 'Allucinazione in corso (Benedizione per interromperla)' }, 'Allucinato'));
    if (e.malusAtt || e.malusAttGR) stati.push(h('span', { class: 'tag red', title: 'Veleno: malus agli attacchi (Benedizione)' }, 'Avvelenato'));
    if (e.muco) stati.push(h('span', { class: 'tag red', title: 'Muco corrosivo: -2 in difesa, 1 PV a turno' }, 'Muco'));
    if (e.malusIncantesimi) stati.push(h('span', { class: 'tag red', title: 'Veleno delle piovre: -1 a perquisire e agli incantesimi fino a fine avventura' }, 'Piovre'));
    if (e.ruggito) stati.push(h('span', { class: 'tag red', title: 'Non può attaccare l’uomo leone (Benedizione)' }, 'Ruggito'));
    if (e.nonResuscitabile) stati.push(h('span', { class: 'tag dead', title: 'Non resuscitabile' }, 'Non resuscitabile'));
  }
  const arma = armaDi(e.armaPrincipale);
  const eq = e.anim ? `${e.anim.tipo.split(' (')[0]} · LIV ${e.anim.liv}` : [arma?.nome, e.armatura !== 'nessuna' ? NOME_ARMATURA[e.armatura] : null, e.scudo ? 'Scudo' : null].filter(Boolean).join(' · ') || 'Disarmato';
  return h('div', { class: `hero ${e.stato}`, dataset: { id: e.id } },
    h('div', { class: 'hero-top' },
      h('div', { class: 'pos' }, h('b', {}, idx + 1)),
      h('div', { class: 'hero-pic', title: 'Clicca per cambiare il ritratto', onclick: () => scheda(e.id) }, Rit.immagine(e, 46)),
      h('div', { class: 'hero-name' }, h('span', { class: 'ico' }, iconaClasse(e.culto || e.classe)), h('b', {}, e.nome), h('small', {}, `${nomeClasse(e)} · liv. ${e.livello}${profonditaAttiva() && P.etichettaGrado(e) ? ' · ' + P.etichettaGrado(e) : ''}`)),
      h('div', { class: 'upd' },
        h('button', { class: 'mini', title: 'Sposta avanti', onclick: () => sposta(idx, -1), disabled: idx === 0 }, '▲'),
        h('button', { class: 'mini', title: 'Sposta indietro', onclick: () => sposta(idx, 1) }, '▼'))),
    h('div', { class: 'hpline' },
      h('button', { class: 'mini', onclick: () => cambiaPV(e, -1) }, '−'),
      h('div', { class: 'hpbar' }, h('i', { style: `width:${pct}%` }), h('span', {}, `${e.pv}/${e.pvMax} PV`)),
      h('button', { class: 'mini', onclick: () => cambiaPV(e, 1) }, '+'),
      h('span', { class: 'gold', title: 'Pezzi d’oro' }, `${e.oro || 0} ●`)),
    h('div', { class: 'eq' }, eq),
    stati.length ? h('div', { class: 'tags' }, stati) : null,
    h('div', { class: 'hero-btns' },
      h('button', { onclick: () => scheda(e.id) }, 'Scheda'),
      h('button', { onclick: () => { e.lanterna = !e.lanterna; modificato(); }, class: e.lanterna ? 'on' : '' }, 'Lanterna'),
      h('button', { onclick: () => usaOggetto(e) }, 'Oggetti')));
}

function sposta(idx, d) {
  const o = S.party.ordine; const j = idx + d; if (j < 0 || j >= o.length) return;
  [o[idx], o[j]] = [o[j], o[idx]]; modificato('party');
}
function cambiaPV(e, d) {
  e.pv = Math.max(0, Math.min(e.pvMax, e.pv + d));
  if (e.pv <= 0) { e.stato = 'morto'; log(`${e.nome} cade a terra, ferito mortalmente.`); }
  else if (e.stato === 'morto') { e.stato = 'ok'; }
  modificato('party');
}

async function scegliPerES(x) {
  modal(`Tiro esperienza: ${x.motivo}`, (b, close) => {
    b.append(h('p', {}, profonditaAttiva() ? `Scegli l’eroe che tenta il tiro ES: deve superare il livello attuale${x.meno1 ? ' (questo tiro è a -1)' : ''}. Eroici: 1d10+4 (esplode con 8+), leggendari: 1d12+8 (esplode con 9+); le abilità, gli incantesimi e le abilità esperte hanno i bonus della tabella dei gradi. Un eroe di livello 9 non sale al 10° senza il grado eroico, né uno di livello 14 al 15° senza il leggendario (passa di grado dal pannello Gruppo: serve mettere da parte i tiri ES).` : abissoAttivo() ? `Scegli l’eroe che tenta il tiro ES: deve superare il livello attuale${x.meno1 ? ' (questo tiro è a -1)' : ''}; 1d8+2 per i livelli avanzati nell’Abisso, con 7-8 naturale sempre un successo. Con il tiro si può salire di livello, imparare un’abilità avanzata o (maghi ed elfi) un incantesimo avanzato.` : `Scegli l’eroe che tenta di salire di livello (tira 1d6 e deve superare il livello attuale${x.meno1 ? '; questo tiro è a -1' : ''}). Lo stesso eroe non può salire due volte di fila.`));
    for (const e of eroiVivi().filter(x => !x.png)) {
      const vincolo = (x.soloClasse && e.classe !== x.soloClasse) || (x.soloEroe && e.id !== x.soloEroe), puo = eroePuoSalire(e), ok = (puo || (abissoAttivo() && e.livello >= 5) || V.haPoste(e)) && !vincolo;
      b.append(h('button', { class: 'item-btn', disabled: !ok, onclick: async () => {
        close(); const posta = profonditaAttiva() ? await P.sceltaPostaES(e, puo) : abissoAttivo() ? await A.sceltaPostaES(e, puo) : silvaniAttivi() ? await V.sceltaPostaES(e, puo) : { tipo: 'livello' }; if (!posta) return;
        const r = await tiroES(x, e, posta); toast(r.ok ? (posta.tipo === 'livello' ? `${e.nome} sale di livello!` : `${e.nome} supera il tiro ES e impara qualcosa di nuovo!`) : `${e.nome} non sale (tiro ${r.tot}).`); } },
        h('b', {}, `${e.nome} – ${nomeClasse(e)} liv. ${e.livello}`), h('span', {}, vincolo ? (x.soloEroe ? 'Questo tiro è di un altro eroe' : 'Questo tiro va usato sull’elfo') : ok ? 'Può tentare' : (P.bloccoGrado(e) ? 'Serve prima il passaggio di grado' : S.adv.ultimoLivello === e.id ? 'Ha già guadagnato l’ultimo livello' : 'Livello massimo raggiunto'))));
    }
    b.append(h('div', { class: 'row end' }, h('button', { onclick: close }, 'Più tardi')));
  });
}

// ---------------- creazione eroi ----------------
export async function creaEroe() {
  modal('Nuovo eroe', (b, close) => {
    let classe = 'guerriero';
    const nome = h('input', { type: 'text', value: nomeCasuale(), maxlength: 24 });
    const grid = h('div', { class: 'class-grid' });
    const info = h('p', { class: 'class-info' });
    const aggiorna = () => {
      [...grid.children].forEach(c => c.classList.toggle('sel', c.dataset.c === classe));
      const c = R.classi[classe];
      info.textContent = `${c.tratti} Vita iniziale: ${c.vitaBase + 1}. Ricchezza: ${c.oro} p.o.`;
    };
    Object.entries(R.classi).filter(([, c]) => classeDisponibile(c)).forEach(([id, c]) => grid.append(h('button', { class: 'class-card', dataset: { c: id }, onclick: () => { classe = id; aggiorna(); } }, h('span', { class: 'ico' }, iconaClasse(id)), c.nome)));
    b.append(h('label', {}, 'Nome', nome), grid, info,
      h('div', { class: 'row end' }, h('button', { onclick: close }, 'Annulla'),
        h('button', { class: 'primary', onclick: async () => {
          const vivi = S.party.eroi.filter(x => x.stato !== 'morto').length;   // un veterano può unirsi al gruppo come quinto personaggio
          if (vivi >= 4 && !(['veterano', 'guida-terre-selvagge'].includes(classe) && vivi === 4) && !(await confirmBox('Hai già 4 eroi vivi: ne aggiungi uno extra (es. PNG o sostituto)?'))) return;
          const e = nuovoEroe(classe, nomeLibero(nome.value.trim() || 'Senza nome'));
          equipaggiamentoIniziale(e);
          close();
          const r = await tira(R.classi[classe].oro, `Ricchezza iniziale di ${e.nome} (${R.classi[classe].oro})`);
          e.oro = r.totale;
          S.party.eroi.push(e); S.party.ordine.push(e.id);
          if (!S.party.eroi.some(x => x.lanterna)) e.lanterna = true;
          log(`${e.nome}, ${nomeClasse(e)} di livello 1, si unisce al gruppo con ${e.oro} p.o.`);
          await V.dotazioneIniziale(e);
          modificato('party'); scheda(e.id);
        } }, 'Crea e tira la ricchezza')));
    aggiorna();
  });
}

async function creaGruppoVeloce() {
  // 4 classi estratte a caso (senza ripetizioni finché le classi disponibili bastano), nomi tutti diversi
  const disponibili = Object.entries(R.classi).filter(([, c]) => classeDisponibile(c)).map(([id]) => id);
  const pesca = [...disponibili].sort(() => Math.random() - 0.5);
  const classi = [];
  while (classi.length < 4) { if (!pesca.length) pesca.push(...disponibili.sort(() => Math.random() - 0.5)); classi.push(pesca.shift()); }
  const nuovi = [];
  for (const c of classi) {
    const e = nuovoEroe(c, nomeCasuale(nuovi.map(x => x.nome)));
    equipaggiamentoIniziale(e);
    e.oro = (await tira(R.classi[c].oro, `Ricchezza di ${e.nome}`)).totale;
    nuovi.push(e); S.party.eroi.push(e); S.party.ordine.push(e.id);
    await V.dotazioneIniziale(e, true);
  }
  nuovi[0].lanterna = true;
  log(`Gruppo casuale creato: ${nuovi.map(e => `${e.nome} (${nomeClasse(e)})`).join(', ')}.${nuovi.some(e => e.classe === 'mago') ? ' Ricordati di preparare gli incantesimi del mago.' : ''}`);
  modificato('party');
}

// ---------------- scheda completa ----------------
export function scheda(id) {
  const e = eroePerId(id); if (!e) return;
  sistemaSlot(e);
  modal(`${e.nome} – ${nomeClasse(e)}`, (b, close) => {
    const num = (label, key, opts = {}) => h('label', {}, label, h('input', { type: 'number', value: e[key] ?? 0, min: opts.min ?? 0, onchange: ev => { e[key] = +ev.target.value; if (key === 'livello') { sistemaSlot(e); } modificato('party'); } }));
    const sel = (label, key, opzioni) => h('label', {}, label, h('select', { onchange: ev => { e[key] = ev.target.value; modificato('party'); } }, opzioni.map(([v, t]) => h('option', { value: v, selected: e[key] === v }, t))));
    const chk = (label, key) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!e[key], onchange: ev => { e[key] = ev.target.checked; modificato('party'); } }), label);

    const quadro = h('div', { class: 'ritratto-box' }, Rit.immagine(e, 96, 'grande'));
    const file = h('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async ev => { if (await Rit.carica(e, ev.target.files[0])) { quadro.replaceChildren(Rit.immagine(e, 96, 'grande')); } ev.target.value = ''; } });
    b.append(h('div', { class: 'row', style: 'align-items:center;gap:12px;margin-bottom:8px' }, quadro,
      h('div', { class: 'col' }, h('button', { onclick: () => file.click() }, 'Carica ritratto…'),
        h('button', { disabled: !Rit.haRitrattoProprio(e), onclick: () => { Rit.rimuovi(e); quadro.replaceChildren(Rit.immagine(e, 96, 'grande')); } }, 'Ritratto predefinito'),
        h('small', { class: 'hint' }, 'PNG, JPG o WebP: viene ritagliato in quadrato e ridotto.')), file));
    b.append(h('div', { class: 'grid2' },
      h('label', {}, 'Nome', h('input', { type: 'text', value: e.nome, onchange: ev => { const n = nomeLibero(ev.target.value, e.id); if (n !== ev.target.value.trim()) toast(`Esiste già un eroe con quel nome: diventa «${n}».`, 'warn'); e.nome = n; ev.target.value = n; modificato('party'); } })),
      sel('Stato', 'stato', [['ok', 'In forma'], ['pietra', 'Pietrificato'], ['pazzo', 'Pazzo'], ['lupo', 'Trasformato in lupo mannaro'], ['prigioniero', 'Prigioniero (da liberare)'], ['morto', 'Caduto / morto']]),
      num('Livello', 'livello', { min: 0 }), num('PV massimi', 'pvMax', { min: 1 }), num('PV attuali', 'pv'), num('Pezzi d’oro', 'oro'),
      num('Bonus arma magica', 'bonusMagico', { min: 0 }), num('Bonus difesa magico', 'bonusDifesa', { min: 0 }), num('Indizi (0-2)', 'indizi'), num('Punti follia', 'follia', { min: 0 })),
      h('div', { class: 'chk-row' }, chk('Porta la lanterna', 'lanterna'), chk('Maledetto (-1 difesa)', 'maledetto'), chk('Zoppicante', 'zoppo'), chk('Si sta trasformando (caos)', 'caosTrasf'), chk('Malattia della melma verde', 'malattia'),
        e.classe === 'elfo-fuoco' ? chk('Indossa oggetti anti-fuoco (annulla la vista di fuoco)', 'antifuoco') : null, tratto(e, 'miope') ? chk('Porta gli occhiali', 'occhiali') : null),
      h('p', { class: 'hint' }, R.classi[e.classe].tratti));

    // equipaggiamento
    const armi = h('div', { class: 'list' });
    const rArmi = () => {
      armi.replaceChildren();
      (e.armi || []).forEach((id, k) => {
        const a = armaDi(id);
        armi.append(h('div', { class: 'row' },
          h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'ap', checked: e.armaPrincipale === id, onchange: () => { e.armaPrincipale = id; modificato('party'); } }), `${a?.nome} (${a.mod >= 0 ? '+' : ''}${a.mod})`),
          h('button', { class: 'mini', onclick: () => { e.armi.splice(k, 1); if (e.armaPrincipale === id) e.armaPrincipale = e.armi[0] || null; rArmi(); modificato('party'); } }, '×')));
      });
      if (!e.armi?.length) armi.append(h('small', {}, 'Nessuna arma (attacca a mani nude: -2).'));
    };
    rArmi();
    const aggArma = h('select', {}, R.equipaggiamento.armi.filter(armaVisibile).map(a => h('option', { value: a.id }, a.nome)));
    b.append(h('h4', {}, 'Armi (spunta quella impugnata)'), armi,
      h('div', { class: 'row' }, aggArma, h('button', { onclick: () => {
        if (controllaArmi(e)) { const a = armaDi(aggArma.value), c = armaConsentita(e, a); if (!c.ok) return toast(c.motivo, 'warn'); if (!limiteArma(e, aggArma.value)) return toast(`${a.nome}: ne puoi portare al massimo ${aggArma.value === 'bolas' ? 2 : 1}.`, 'warn'); }
        (e.armi = e.armi || []).push(aggArma.value); if (!e.armaPrincipale) e.armaPrincipale = aggArma.value; rArmi(); modificato('party'); } }, 'Aggiungi arma')),
      h('div', { class: 'grid2' }, sel('Armatura', 'armatura', Object.entries(NOME_ARMATURA)), chk('Scudo', 'scudo')));

    // incantesimi
    if (slotIncantesimi(e)) {
      const sl = h('div', { class: 'list' });
      const rs = () => {
        sl.replaceChildren();
        const permessi = e.classe === 'druido' ? V.incantesimiDruido(e).map(n => ({ nome: n })) : [...R.equipaggiamento.incantesimi.filter(s => (e.classe === 'mago' || s.id !== 'benedizione') && (!s.suppl || S.party.supplCaos) && (!s.caos || S.party.supplCaos) && (e.classe !== 'elfo-fuoco' || s.nome === 'Palla di Fuoco')),
          ...(abissoAttivo() && ['mago', 'elfo'].includes(e.classe) ? (e.avanzati || []).map(n => ({ nome: n })) : [])];
        e.incantesimi.forEach((s, k) => sl.append(h('div', { class: 'row' },
          h('select', { disabled: !!s.fisso, title: s.fisso ? 'Incantesimo fisso del grimorio di pergamene' : '', onchange: ev => { s.nome = ev.target.value; if (profonditaAttiva()) sistemaSlot(e); modificato('party'); if (profonditaAttiva()) rs(); } }, permessi.map(p => h('option', { value: p.nome, selected: p.nome === s.nome }, `${p.nome}${P.costoMemoria(p.nome) > 1 ? ` (occupa ${P.costoMemoria(p.nome)} posti)` : ''}`))),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!s.usato, onchange: ev => { s.usato = ev.target.checked; modificato('party'); } }), 'usato'))));
      };
      rs();
      b.append(h('h4', {}, `Incantesimi preparati (${slotIncantesimi(e)} posti di memoria)`), sl, h('p', { class: 'hint' }, profonditaAttiva() ? 'Prima di ogni avventura scegli liberamente gli incantesimi (anche copie dello stesso). Un incantesimo eroico occupa 2 posti di memoria, uno leggendario 3: scegliendolo i posti in eccesso saltano dalla coda dell’elenco.' : 'Prima di ogni avventura scegli liberamente gli incantesimi (anche copie dello stesso).'));
    }
    if (e.classe === 'chierico') b.append(h('div', { class: 'grid2' }, num2(e, 'Benedizioni usate (max 3)', 'benedizione'), num2(e, 'Guarigioni usate (max 3)', 'guarigione')));
    if (e.classe === 'mezzuomo') b.append(h('div', { class: 'grid2' }, num2(e, `Punti fortuna usati (max ${e.livello + 1})`, 'fortuna')));
    if (e.classe === 'barbaro') b.append(h('div', { class: 'grid2' }, num2(e, `Attacchi furiosi usati (max ${maxFurie(e)})`, 'furie')));

    // oggetti
    const og = h('div', { class: 'list' });
    const ro = () => {
      og.replaceChildren();
      (e.oggetti || []).forEach((o, k) => {
        const car = o.cariche != null ? [
          h('button', { class: 'mini', title: 'Una carica in meno', onclick: () => { o.cariche = Math.max(0, o.cariche - 1); ro(); modificato('party'); } }, '−'),
          h('b', { title: 'Cariche / usi rimasti' }, `${o.cariche}/${o.caricheMax ?? o.cariche}`),
          h('button', { class: 'mini', title: 'Una carica in più', onclick: () => { o.cariche = Math.min(o.caricheMax ?? 99, o.cariche + 1); ro(); modificato('party'); } }, '+'),
          o.manuale ? h('button', { class: 'mini', disabled: o.cariche <= 0, title: 'Usa una carica (registra nel diario)', onclick: () => { o.cariche--; log(`${e.nome} usa ${o.nome} (rimaste: ${o.cariche}).`); ro(); modificato('party'); } }, 'Usa') : null
        ] : [];
        og.append(h('div', { class: 'row', title: o.nota || '' }, h('span', { class: 'grow' }, `${o.nome}${o.qta > 1 ? ` ×${o.qta}` : ''}${o.valore ? ` (${o.valore} p.o.)` : ''}${o.afferrato ? ' — afferrato (non usabile)' : ''}`), ...car, equipaggiabile(o) ? h('button', { class: 'mini', title: 'Impugna come arma o indossa come armatura', onclick: async () => { if (await equipaggia(e, o)) { scheda(e.id); } } }, 'Equipaggia') : null, h('button', { class: 'mini', onclick: () => { e.oggetti.splice(k, 1); ro(); modificato('party'); } }, '×')));
      });
      if (!e.oggetti?.length) og.append(h('small', {}, 'Nessun oggetto.'));
    };
    ro();
    const nuovo = h('input', { type: 'text', placeholder: 'Nome oggetto (es. Pozione di guarigione)' });
    if (abissoAttivo() || A.statiAbisso(e).length) b.append(A.sezioneStati(e, () => scheda(e.id)));
    if (profonditaAttiva() && !e.merc) b.append(P.sezioneGrado(e, () => scheda(e.id)));
    if (S.party.supplCaos || abissoAttivo()) b.append(T.sezioneAbilita(e, () => scheda(e.id)));
    if (S.party.supplCaos) b.append(T.sezione(e, () => scheda(e.id)));
    b.append(Q.sezioneScheda(e, () => scheda(e.id)));
    { const sv = V.sezioneScheda(e, () => scheda(e.id)); if (sv) b.append(sv); }
    b.append(h('h4', {}, 'Oggetti e bottino'), og, h('div', { class: 'row' }, nuovo, h('button', { onclick: () => { if (!nuovo.value.trim()) return; (e.oggetti = e.oggetti || []).push({ nome: nuovo.value.trim(), qta: 1 }); nuovo.value = ''; ro(); modificato('party'); } }, 'Aggiungi')));
    if ((e.segreti || []).length) b.append(h('h4', {}, 'Segreti scoperti'), h('ul', {}, e.segreti.map(s => h('li', {}, s))));
    b.append(h('label', {}, 'Note', h('textarea', { rows: 3, onchange: ev => { e.note = ev.target.value; modificato('party'); } }, e.note || '')));
    b.append(h('div', { class: 'row between' },
      h('button', { class: 'danger', onclick: async () => { if (await confirmBox(`Eliminare definitivamente ${e.nome}?`)) { S.party.eroi = S.party.eroi.filter(x => x.id !== e.id); S.party.ordine = S.party.ordine.filter(x => x !== e.id); if (S.ritratti?.[e.id]) { delete S.ritratti[e.id]; salva('ritratti'); } log(`${e.nome} lascia il gruppo.`); modificato('party'); close(); } } }, 'Elimina eroe'),
      h('button', { class: 'primary', onclick: close }, 'Chiudi')));
  }, { wide: true });
}
function num2(e, label, k) {
  return h('label', {}, label, h('input', { type: 'number', min: 0, value: e.usi[k] || 0, onchange: ev => { e.usi[k] = +ev.target.value; modificato('party'); } }));
}

/** Tratto «Allergico alle pozioni»: 1d6, con 1-2 si perde 1 PV oppure -1 ad attacchi e salvezza contro veleno per 10 incontri. */
async function allergiaPozione(e) {
  const r = await dado(`${e.nome} (allergico alle pozioni): 1-2 si manifesta`);
  if (r.totale > 2) { log(`${e.nome} non ha reazioni alla pozione.`); return; }
  const k = await scelta('Allergia alla pozione', `${e.nome} ha una reazione allergica:`, [['pv', 'Perdi 1 PV'], ['mod', '-1 agli attacchi e ai salvezza contro veleno per 10 incontri']]);
  if (k === 'mod') { e.allergiaPozioni = 10; log(`${e.nome}: -1 ad attacchi e salvezza contro veleno per 10 incontri o fino a fine avventura.`); } else C.perdiPV(e, 1, 'allergia alla pozione');
}

// ---------------- oggetti d'uso ----------------
function usaOggetto(e) {
  modal(`Oggetti di ${e.nome}`, (b, close) => {
    b.append(h('p', { class: 'hint' }, 'Azioni rapide (ogni uso viene registrato).'));
    const azioni = [];
    const paz = h('select', {}, S.party.eroi.filter(x => x.stato !== 'morto').map(x => h('option', { value: x.id, selected: x.id === e.id }, x.nome)));
    azioni.push(h('div', { class: 'row' }, h('button', { class: 'grow', onclick: () => {
      const dst = eroePerId(paz.value) || e; dst.usi = dst.usi || {};
      if (dst.usi.bende) return toast(`${dst.nome} è già stato bendato in questa avventura.`, 'warn');
      const k = (e.oggetti || []).findIndex(o => /bende/i.test(o.nome)); if (k < 0) return toast('Nessuna benda.', 'warn');
      const q = suppl() && tratto(e, 'guaritore') ? 2 : 1;   // Guaritore abile: una benda cura 2 PV
      dst.usi.bende = 1; dst.pv = Math.min(dst.pvMax, dst.pv + q); log(`${e.nome} applica le bende a ${dst.nome} (+${q} PV).`); modificato('party'); close();
    } }, 'Applica bende (+1 PV, fuori dal combattimento) a:'), paz));
    azioni.push(h('button', { onclick: async () => {
      const k = (e.oggetti || []).findIndex(o => /pozione/i.test(o.nome)); if (k < 0) return toast('Nessuna pozione di guarigione.', 'warn'); if (e.classe === 'barbaro') return toast('I barbari non usano pozioni.', 'warn');
      if (profonditaAttiva() && P.curaVietata()) return toast('Nella Cittadella delle cose morte non è possibile alcuna cura tranne le bende.', 'warn');
      e.oggetti.splice(k, 1);
      if (profonditaAttiva() && P.curaRivoMorte()) { e.pv = Math.min(e.pvMax, e.pv + Math.floor(e.pvMax / 2)); log(`${e.nome} beve una pozione di guarigione: sul Rivo della Morte cura solo metà dei PV massimi.`); }
      else { e.pv = e.pvMax; log(`${e.nome} beve una pozione di guarigione: PV al massimo.`); }
      V.cura(e, 'pozione');
      if (suppl() && tratto(e, 'allergico-pozioni')) await allergiaPozione(e);
      modificato('party'); close();
    } }, 'Bevi pozione di guarigione'));
    azioni.push(h('button', { onclick: () => { const k = (e.oggetti || []).findIndex(o => /razion/i.test(o.nome)); if (k >= 0) { e.oggetti[k].qta--; if (e.oggetti[k].qta <= 0) e.oggetti.splice(k, 1); } log(`${e.nome} consuma una razione.`); modificato('party'); close(); } }, 'Consuma razione'));
    azioni.push(...Q.azioniOggetti(e, close));
    if (abissoAttivo()) azioni.push(...A.azioniOggetti(e, close));
    b.append(h('div', { class: 'col' }, azioni));
    const trasf = h('select', {}, S.party.eroi.filter(x => x.id !== e.id).map(x => h('option', { value: x.id }, x.nome)));
    const q = h('input', { type: 'number', min: 1, value: 10 });
    b.append(h('h4', {}, 'Dai monete a un compagno'), h('div', { class: 'row' }, q, trasf, h('button', { disabled: abissoAttivo() && (e.follia || 0) > 0, title: abissoAttivo() && (e.follia || 0) > 0 ? 'Con almeno 1 punto follia non si scambiano oggetti né tesoro' : '', onclick: () => { const dst = eroePerId(trasf.value); const n = Math.min(+q.value || 0, e.oro || 0); if (!dst || n <= 0) return; e.oro -= n; dst.oro = (dst.oro || 0) + n; log(`${e.nome} dà ${n} p.o. a ${dst.nome}.`); modificato('party'); close(); } }, 'Trasferisci')));
  });
}

// ---------------- negozio ----------------
const gemme = e => (e.oggetti || []).filter(o => o.tipo === 'gemma' && o.valore > 0);
const valGemme = e => gemme(e).reduce((a, o) => a + o.valore * (o.qta || 1), 0);
const vendGemme = e => gemme(e).reduce((a, o) => a + (e.classe === 'nano' ? Math.floor(o.valore * 1.2) : o.valore) * (o.qta || 1), 0);

/** Prezzo di vendita di un oggetto del personaggio (null = non vendibile). Gli oggetti magici generici valgono 1d6×1d6 (tirati alla vendita). */
function prezzoOggetto(o, e) {
  if (/alghe curative/i.test(o.nome || '')) return { v: 40 };
  if (o.tipo === 'gemma' || o.tipo === 'gioiello') return e?.classe === 'nano' ? { v: Math.floor(o.valore * 1.2), nota: '+20% (nano)' } : { v: o.valore };   // FAQ: prezzo pieno, +20% se vende un nano
  const n = o.nome || '';
  if (o.cariche != null && o.incantesimo) return { v: 100 * Math.max(0, o.cariche), nota: `100 p.o. per carica (${o.cariche})` };
  if (/bacchetta del potere/i.test(n)) return { v: 25 * Math.max(0, o.cariche ?? 0), nota: '25 p.o. per carica' };
  if (/rosario/i.test(n)) return { v: 10 * Math.max(0, o.cariche ?? 0), nota: '10 p.o. per grano' };
  if (/pozione|anello/i.test(n)) return { v: 50 };
  if (abissoAttivo() && o.incantesimo && A.NOMI_AVANZATI().includes(o.incantesimo) && o.tipo === 'pergamena') return { v: 150, nota: '150 p.o. per pergamena dell’Abisso' };
  if (o.tipo === 'pergamena' || /pergamena/i.test(n)) return { v: 100 };
  const m = /vale (\d+) p\.o\./i.exec(o.nota || '');
  if (m) return { v: +m[1] };
  if (o.tipo === 'magico' || o.tipo === 'arma-magica' || o.tipo === 'armatura-magica') return { dadi: '1d6x1d6' };
  const cat = R.equipaggiamento.oggetti.find(x => x.nome === n);
  if (cat) return { v: Math.floor(cat.costo / 2) };
  if (o.valore) return { v: o.valore };
  return null;
}

export function negozio() {
  modal('Negozio e vendite', (b, close) => {
    const vivi = () => S.party.eroi.filter(e => e.stato !== 'morto');
    const eroeSel = h('select', {});
    // oro del gruppo: l'acquirente paga prima con il proprio, poi con quello dei compagni (gli elfi del fuoco non condividono con le altre razze)
    const gruppoCk = h('input', { type: 'checkbox', checked: true, onchange: () => rLista() });
    const donatori = e => gruppoCk.checked ? vivi().filter(x => x.id !== e.id && (x.oro || 0) > 0 && (x.classe === 'elfo-fuoco') === (e.classe === 'elfo-fuoco')) : [];
    const oroAltri = e => donatori(e).reduce((a, x) => a + (x.oro || 0), 0);
    const rSel = (id) => eroeSel.replaceChildren(...vivi().map(x => h('option', { value: x.id, selected: x.id === id }, `${x.nome} (${x.oro || 0} p.o.${valGemme(x) ? ` + gemme ${valGemme(x)}` : ''})`)));
    const lista = h('div', { class: 'shop' });
    const venditaBox = h('div', { class: 'shop' });
    const aggiorna = (e) => { rSel(e.id); modificato('party'); rLista(); };
    const rLista = () => {
      lista.replaceChildren(); venditaBox.replaceChildren();
      const e = eroePerId(eroeSel.value); if (!e) return;
      const fondi = (e.oro || 0) + oroAltri(e) + valGemme(e);
      const voci = [
        ...R.equipaggiamento.armi.filter(a => armaVisibile(a) && a.costo > 0).map(a => ({ nome: a.nome, costo: a.costo, arma: a.id })),
        ...R.equipaggiamento.oggetti.filter(o => o.id !== 'occhiali' || (suppl() && tratto(e, 'miope'))).map(o => ({ nome: o.nome, costo: prezzo(e, o), id: o.id }))
      ];
      lista.append(h('p', { class: 'hint' }, `Fondi: ${e.oro || 0} p.o.${oroAltri(e) ? ` + ${oroAltri(e)} p.o. dei compagni` : ''}${valGemme(e) ? ` + ${valGemme(e)} p.o. in gemme (usate come moneta se l’oro non basta)` : ''}.`));
      voci.forEach(v => lista.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, v.nome), h('span', { class: 'price' }, `${v.costo} p.o.`),
        h('button', { disabled: fondi < v.costo, title: (e.oro || 0) + oroAltri(e) < v.costo ? 'Pagherai con le gemme' : (e.oro || 0) < v.costo ? 'Pagherai anche con l’oro dei compagni' : '', onclick: () => compra(e, v) }, (e.oro || 0) + oroAltri(e) < v.costo && fondi >= v.costo ? 'Compra (gemme)' : (e.oro || 0) < v.costo ? 'Compra (oro del gruppo)' : 'Compra'))));

      { const sn = V.sezioneNegozio(e, () => aggiorna(e)); if (sn) lista.append(sn); }   // compagni animali, cavalcature, vanga
      // vendita
      venditaBox.append(h('h4', {}, `Vendi (${e.nome})`));
      let n = 0;
      (e.oggetti || []).forEach(o => {
        const p = prezzoOggetto(o, e); if (!p) return; n++;
        venditaBox.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, `${o.nome}${o.qta > 1 ? ` ×${o.qta}` : ''}`),
          h('span', { class: 'price' }, p.dadi ? '1d6×1d6 p.o.' : `${p.v * (o.tipo === 'gemma' ? 1 : 1)} p.o.${p.nota ? ` (${p.nota})` : ''}`),
          h('button', { onclick: async () => {
            let v = p.v; if (p.dadi) { const x = await tira(p.dadi, `Vendita di ${o.nome}`); v = x.totale; }
            if (o.qta > 1) o.qta--; else e.oggetti = e.oggetti.filter(y => y !== o);
            e.oro = (e.oro || 0) + v; log(`${e.nome} vende ${o.nome} per ${v} p.o.`); aggiorna(e);
          } }, 'Vendi')));
      });
      (e.armi || []).forEach((id, k) => {
        const a = armaDi(id); if (!a || !(a.costo > 0)) return; n++;
        if (a.fuoco && suppl() && e.classe !== 'nano') { venditaBox.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, a.nome), h('small', {}, 'le armi da fuoco le vendono solo i nani'))); return; }
        venditaBox.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, a.nome), h('span', { class: 'price' }, `${Math.floor(a.costo / 2)} p.o.`),
          h('button', { onclick: () => { e.armi.splice(k, 1); if (e.armaPrincipale === id && !e.armi.includes(id)) e.armaPrincipale = e.armi[0]; const v = Math.floor(a.costo / 2); e.oro = (e.oro || 0) + v; log(`${e.nome} vende ${a.nome} per ${v} p.o.`); aggiorna(e); } }, 'Vendi')));
      });
      // riparazioni: armi da fuoco esplose e occhiali rotti
      if (suppl()) {
        const rotte = (e.rotte || []).map(id => ({ id, a: armaDi(id) })).filter(x => x.a);
        rotte.forEach(x => { n++; const c = x.a.riparazione || 10; venditaBox.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, `${x.a.nome} (esplosa)`), h('span', { class: 'price' }, `${c} p.o.`),
          h('button', { disabled: fondi < c, onclick: () => { pagaOro(e, c); e.rotte.splice(e.rotte.indexOf(x.id), 1); log(`${e.nome} ripara ${x.a.nome} (${c} p.o.).`); aggiorna(e); } }, 'Ripara'))); });
        if (e.occhiali === 'rotti') { n++; venditaBox.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Occhiali rotti'), h('span', { class: 'price' }, '100 p.o.'),
          h('button', { disabled: fondi < 100, onclick: () => { pagaOro(e, 100); e.occhiali = true; log(`${e.nome} ripara gli occhiali (100 p.o.).`); aggiorna(e); } }, 'Ripara'))); }
      }
      if (gemme(e).length > 1) venditaBox.append(h('button', { class: 'accent', onclick: () => { const v = vendGemme(e); e.oggetti = e.oggetti.filter(o => o.tipo !== 'gemma'); e.oro = (e.oro || 0) + v; log(`${e.nome} vende tutte le gemme per ${v} p.o.`); aggiorna(e); } }, `Vendi tutte le gemme (${vendGemme(e)} p.o.)`));
      if (!n) venditaBox.append(h('small', {}, 'Niente da vendere.'));
    };
    /** Prezzo per l'acquirente: il tratto Sovrappeso aumenta del 20% (per eccesso) cibo e armature. */
    const prezzo = (e, o) => o.id === 'acqua-santa' && acqueAttive() && S.party.demoneNoto ? 20 : suppl() && tratto(e, 'sovrappeso') && ['armatura-leggera', 'armatura-pesante', 'razioni'].includes(o.id) ? Math.ceil(o.costo * 1.2) : o.costo;
    /** Paga con l'oro del personaggio e poi con quello dei compagni (usato dalle riparazioni). */
    const pagaOro = (e, costo) => {
      let da = costo; const usa = Math.min(e.oro || 0, da); e.oro = (e.oro || 0) - usa; da -= usa;
      for (const x of donatori(e).sort((a, b) => (b.oro || 0) - (a.oro || 0))) { if (da <= 0) break; const k = Math.min(x.oro || 0, da); x.oro -= k; da -= k; }
    };
    const compra = (e, v) => {
      if (v.id === 'acqua-santa' && acqueAttive() && (e.oggetti || []).some(o => /acqua santa/i.test(o.nome))) return toast('Al massimo 1 fiala di acqua santa per personaggio.', 'warn');
      if (v.arma && controllaArmi(e)) {   // armi da fuoco riservate, limiti di bolas e boomerang
        const a = armaDi(v.arma), c = armaConsentita(e, a); if (!c.ok) return toast(c.motivo, 'warn');
        if (!limiteArma(e, v.arma)) return toast(`${a.nome}: ne puoi portare al massimo ${v.arma === 'bolas' ? 2 : 1}.`, 'warn');
      }
      let da = v.costo;
      const usaOro = Math.min(e.oro || 0, da); e.oro = (e.oro || 0) - usaOro; da -= usaOro;
      let nota = '';
      const pagati = [];
      for (const x of donatori(e).sort((a, b) => (b.oro || 0) - (a.oro || 0))) {   // poi l'oro dei compagni, partendo dal più ricco
        if (da <= 0) break; const k = Math.min(x.oro || 0, da); x.oro -= k; da -= k; pagati.push(`${k} da ${x.nome}`);
      }
      if (pagati.length) nota += ` (oro del gruppo: ${pagati.join(', ')})`;
      if (da > 0) {   // paga il resto con le gemme (prima le più piccole che bastano); l'eventuale resto torna in oro
        const gs = gemme(e).flatMap(o => Array.from({ length: o.qta || 1 }, () => o)).sort((a, b) => a.valore - b.valore);
        const scelte = []; let somma = 0;
        const unica = gs.find(g => g.valore >= da);
        if (unica) { scelte.push(unica); somma = unica.valore; } else for (const g of gs.reverse()) { if (somma >= da) break; scelte.push(g); somma += g.valore; }
        scelte.forEach(g => { if (g.qta > 1) g.qta--; else e.oggetti = e.oggetti.filter(y => y !== g); });
        nota += ` (pagando con ${scelte.length} gemm${scelte.length === 1 ? 'a' : 'e'} da ${somma} p.o.${somma > da ? '; nessun resto' : ''})`;   // le gemme non danno resto
      }
      if (v.arma) { (e.armi = e.armi || []).push(v.arma); if (!e.armaPrincipale) e.armaPrincipale = v.arma; }
      else if (v.id === 'armatura-leggera') { e.armatura = e.armatura === 'pesante' ? 'pesante' : 'leggera'; if (e.armatura === 'leggera') { e.cottaElfica = false; e.armaturaPerfetta = false; e.armaturaLeggendaria = false; } }
      else if (v.id === 'armatura-pesante') { e.armatura = 'pesante'; e.armaturaIncantata = false; e.armaturaPerfetta = false; e.armaturaLeggendaria = false; }
      else if (v.id === 'scudo') e.scudo = true;
      else if (v.id === 'lanterna') e.lanterna = true;
      else if (v.id === 'occhiali') e.occhiali = true;
      else { const ex = (e.oggetti = e.oggetti || []).find(o => o.nome === v.nome); if (ex) ex.qta++; else e.oggetti.push({ nome: v.nome, qta: 1 }); }
      log(`${e.nome} compra ${v.nome} per ${v.costo} p.o.${nota}`);
      aggiorna(e);
    };
    eroeSel.onchange = rLista;
    rSel();
    if (acqueAttive()) b.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!S.party.demoneNoto, onchange: ev => { S.party.demoneNoto = ev.target.checked; modificato('party'); rLista(); } }), 'Il gruppo sa che c’è un demone: acqua santa a 20 p.o. invece di 30'));
    b.append(h('label', {}, 'Personaggio', eroeSel), h('label', { class: 'chk' }, gruppoCk, 'Usa anche l’oro del gruppo se quello del personaggio non basta'), lista, venditaBox,
      ...(abissoAttivo() ? [A.sezioneAlleati(() => { close(); negozio(); })] : []),
      h('p', { class: 'hint' }, 'Vendita: armi a metà prezzo (arrotondato per difetto); gemme al loro valore; pozioni e anelli magici 50 p.o.; bacchette, bastoni e pergamene 100 p.o. per incantesimo; altri oggetti magici 1d6×1d6 p.o. (o il valore indicato). Le gemme si possono anche usare direttamente come moneta negli acquisti.'),
      h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: close }, 'Chiudi')));
    rLista();
  }, { wide: true });
}

// ---------------- riposo ----------------
export function riposa() {
  if (profonditaAttiva()) { const v = P.riposoVietato(); if (v) { toast(v, 'warn'); return; } }
  const cuochi = eroiVivi().filter(e => e.stato === 'ok' && suppl() && ((e.traguardi || []).some(t => t.id === 'cuoco') || e.perm?.cuoco));
  const conEffetto = cuochi.some(e => e.perm?.cuoco);   // chi ha già completato il traguardo: la sua cucina migliora il gruppo a ogni riposo
  eroiVivi().forEach(e => {
    if (e.stato !== 'ok') return;
    if (cuochi.includes(e)) { T.evento(e, 'cuoco'); return; }   // «Cuoco dei sotterranei»: prepara il pasto e salta i propri benefici
    e.pv = Math.min(e.pvMax, e.pv + 1);
    const u = (e.incantesimi || []).find(s => s.usato); if (u) u.usato = false;
    if (e.usi.guarigione) e.usi.guarigione--; else if (e.usi.benedizione) e.usi.benedizione--;
  });
  if (conEffetto) T.effettoCuoco();
  log(`Il gruppo si riposa: +1 PV, +1 incantesimo/potere recuperato per ognuno${cuochi.length ? ` (tranne chi cucina: ${cuochi.map(e => e.nome).join(', ')})` : ''}.`);
  modificato('party');
}
