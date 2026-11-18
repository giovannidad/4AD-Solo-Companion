// Supplemento «Labirinti Silvani» (livelli 4+): la selva (mappa Foresta), druido, elfo silvano, guida, signore delle bestie,
// chierici di Elidra e Korimnos, compagni animali, cavalcature, oggetti, mostri e regole dei dungeon silvani.
// Lo stato di gioco sta in S.adv.silvani (selva in corso), nei campi degli eroi (S.party) e in inc.sv (poteri dei mostri).
import { R, S, log, modificato, eroiVivi, eroiAttivi, eroePerId, ordineMarcia, nuovoEroe, livelloMax } from './state.js';
import { dado, tira, d66 } from './dice.js';
import { riga, tabella, creaIncontro, inSilvani, silvaniAttivi, suppl, abissoAttivo, modAttacco, modDifesa, haAbilita, armaDi, tipoNonVivente, trovaReazione } from './rules.js';
import { h, modal, toast, scelta, sceltaMultipla, confirmBox, uid, d6 } from './util.js';
import * as G from './game.js';
import * as C from './combat.js';
import * as K from './caos.js';
import * as A from './abisso.js';
import * as table from './map2d.js';
import * as O from './oggetti.js';

const D = () => R.silvani;
const adv = () => S.adv;
const st = () => (S.adv.silvani = S.adv.silvani || {});
const ro = () => S.adv?.silvani || {};   // sola lettura: non scrive nulla negli altri set
const casuale = arr => arr[Math.floor(Math.random() * arr.length)];
const mezzo = e => Math.floor(e.livello / 2);
const vivi = () => ordineMarcia().filter(e => e.stato === 'ok');
const bottino = o => { (adv().bottino = adv().bottino || []).push({ id: uid(), ...o }); };
const inForesta = () => inSilvani() || adv()?.tema === 'foresta';
const consuma = (e, o) => { if ((o.qta || 1) > 1) o.qta--; else e.oggetti = (e.oggetti || []).filter(x => x !== o); };
const oggetto = (e, re) => (e.oggetti || []).find(o => re.test(`${o.nome || ''}`));
const conta = (expr, label) => (typeof expr === 'number' ? Promise.resolve(expr) : tira(expr, label).then(x => x.totale));
const NOMI_DRUIDO = () => D().incantesimi.filter(s => s.lista === 'druido' && s.livello === 'base').map(s => s.nome);
const NOMI_AVANZATI = () => D().incantesimi.filter(s => s.livello === 'avanzato').map(s => s.nome);
export const NOMI_INCANTESIMI = () => [...D().incantesimi.filter(s => s.lista === 'druido' || s.id === 's-raccolto-abbondante').map(s => s.nome)];
const incantesimo = nome => D().incantesimi.find(s => s.nome === nome);
const sc = (...v) => v;   // abbreviazione per le opzioni delle scelte

// =============================================================
//  REGOLE GENERALI: scala, ingresso, tessere
// =============================================================
/** Livelli del personaggio più alto sopra il 4°: +1 ai minori, +1 LIV e PV ai maggiori (p. 10). */
export const scala = () => Math.max(0, livelloMax() - 4);
const gruppoAvanzato = () => { const l = livelloMax(); return l >= 5 && l <= 9; };
export async function controlloIngresso() {
  const bassi = eroiVivi().filter(e => !e.png && !e.merc && e.livello < 4);
  if (!bassi.length) return true;
  return await confirmBox(`«Labirinti Silvani» è pensato per personaggi di almeno 4° livello (le tabelle si usano quando tutti lo sono). Non tutti lo sono (${bassi.map(e => `${e.nome} ${e.livello}°`).join(', ')}): il manuale non lo vieta, ma i mostri sono molto pericolosi. Scendere comunque?`);
}
/** Le radure sono stanze, i sentieri corridoi: tipo presunto dalla geometria della tessera (modificabile prima di confermare). */
export function eSentiero(n) {
  const t = D().conformazione.tessere.find(x => x.numero === +n);
  return t?.progetto?.tipoPresuntoDalProgetto === 'sentiero';
}
export const cieloAperto = () => !!st().cielo;
export function moltiplicaBraccati(q) { if (!st().braccati) return q; st().braccati = false; log(`Braccati: il numero di creature raddoppia (${q} → ${q * 2}).`); return q * 2; }
const trasforma = voce => voce;

/** Ponti (22, 25, 42) e pozzi (15, 26, 35, 36, 41, 63, 65) si attivano in base al NUMERO della tessera tirata (le tessere del progetto non coincidono col disegno del manuale). */
export async function dopoStanza(t) {
  if (!inSilvani() || !t) return;
  const n = +t.n, s = st();
  if ([22, 25, 42].includes(n)) {
    const x = await dado('Tipo di ponte (1-2 pietra, 3-6 legno)'), r = riga(D().tabelle.tipoPonte, x.totale);
    (s.ponti = s.ponti || {})[t.id] = { tipo: r.tipo, alberi: [25, 42].includes(n) };
    const tx = `Ponte di ${r.tipo}${r.tipo === 'legno' && [25, 42].includes(n) ? ' vicino agli alberi (rischio d’incendio)' : ''}: si combatte come in un corridoio; con volanti o acquatici non si può distruggerlo per fuggire.`;
    if (t.contenuto) t.contenuto.testo += ` · ${tx}`; log(tx);
  }
  if ([15, 26, 35, 36, 41, 63, 65].includes(n)) { t.pozzo = true; const tx = 'C’è un pozzo (si beve dagli Strumenti: ogni creatura una sola volta).'; if (t.contenuto) t.contenuto.testo += ` · ${tx}`; log(tx); }
  if (s.incendi?.[t.id]) log('Quest’area è in fiamme: per attraversarla serve il tiro salvezza (Strumenti).');
  modificato();
}

// =============================================================
//  CONTENUTI E TABELLE
// =============================================================
export async function braccati() {
  const s = st();
  const k = await scelta('Braccati', 'Spendi 1 indizio, oppure raddoppia le creature del prossimo incontro con mostri minori.', [['indizio', 'Spendi 1 indizio'], ['raddoppia', 'Raddoppia i mostri minori del prossimo incontro']]);
  const e = eroiVivi().find(x => (x.indizi || 0) > 0);
  if (k === 'indizio' && e) { e.indizi--; modificato('party'); return `${e.nome} spende 1 indizio: nessun effetto.`; }
  s.braccati = true; return k === 'indizio' ? 'Nessun indizio disponibile: il prossimo incontro con minori avrà il doppio delle creature.' : 'Il prossimo incontro con minori avrà il doppio delle creature.';
}
export function cacciaProdigiosa() { eroiVivi().forEach(e => { if (e.stato === 'ok') e.pv = Math.min(e.pvMax, e.pv + 1); }); modificato('party'); return 'Caccia prodigiosa: ogni personaggio recupera 1 PV.'; }
export async function pista() {
  const e = await K.eroeScelto('Trovata una pista: chi riceve l’indizio?', x => x.stato === 'ok' && !x.png); if (!e) return 'Pista: nessun indizio assegnato.';
  await G.aggiungiIndizio(e); return `Trovata una pista: ${e.nome} guadagna 1 indizio.`;
}
/** Banda di guerrieri: su un sentiero un boss; in una radura un boss con i suoi seguaci (seguaci con un leader). */
export async function bandaGuerrieri(t, corr) {
  if (corr) { const b = await G.monstroDa('boss'); G.avviaIncontro(b, t); return `Banda di guerrieri su un sentiero: ${b.nome}.`; }
  const segu = await G.monstroDa('seguaci'), boss = await G.monstroDa('boss');
  boss.reazioni = [[1, 6, 'combatte-sempre']]; boss.noMorale = true; segu.leaderInc = boss; boss.tessera = t.id;
  G.avviaIncontro(segu, t);
  return `Banda di guerrieri: ${segu.nome} ×${segu.n} con il leader ${boss.nome} (un campione può sfidare il leader mentre gli altri affrontano i seguaci).`;
}
/** Angelo della luce: al secondo risultato 1 si incontra la tigre dai denti a sciabola. */
export function sostituisci(voce, nomeTab) {
  if (!inSilvani() || voce.id !== 's-angelo-luce') return voce;
  const s = st(); if (!s.angelo) { s.angelo = true; return voce; }
  log('Gli angeli sono rari: al loro posto compare la tigre dai denti a sciabola.'); return D().creatureExtra.find(x => x.id === 's-tigre-sciabola') || voce;
}

export async function evento(t) {
  const s = st();
  for (;;) {
    const row = riga(tabella('eventi'), (await dado('Evento speciale della selva (d6)')).totale);
    if (row.azione === 'pegasi' && s.pegasi) { log('Pegasi: già incontrati, al loro posto un borgo (Scoperta 1).'); return `${row.nome}: ${await borgo()}`; }
    return `${row.nome}: ${await eseguiEvento(row, t)}`;
  }
}
async function eseguiEvento(row, t) {
  const s = st();
  switch (row.azione) {
    case 'incendio': return await incendioEvento(t);
    case 'mandria': {
      await C.salvaTutti('Mandria in fuga (fuga)', 3, e => bonusFuga(e), async e => { const q = (await tira('1d3', 'PV persi nella mandria')).totale; C.perdiPV(e, q, 'mandria in fuga'); });
      return 'Chi ha fallito il tiro salvezza perde 1d3 PV (con un 1 naturale perde anche gli oggetti tenuti in mano: a mano).';
    }
    case 'pegasi': {
      s.pegasi = true; const n = (await tira('1d3', 'Numero di pegasi')).totale;
      const e = await K.eroeScelto('Pegasi pacifici: chi tenta di domarne uno? (TS L5)', x => x.stato === 'ok' && !x.png); if (!e) return `${n} pegasi pacifici (nessuno tenta di domarli).`;
      const b = (e.classe === 'signore-bestie' ? e.livello : e.classe === 'barbaro' ? mezzo(e) : e.classe === 'mezzuomo' ? 1 : 0);
      let ok = await C.salva(e, 5, b, 'Domare un pegaso'), usatoFortuna = false;
      if (!ok && e.classe === 'mezzuomo' && (e.usi.fortuna || 0) < e.livello + 1 && await confirmBox(`${e.nome} spende un punto fortuna per ripetere il tiro?`)) { e.usi.fortuna++; usatoFortuna = true; ok = await C.salva(e, 5, b, 'Domare un pegaso (ripetuto)'); }
      if (ok) { await daiCavalcatura(e, 's-pegaso'); return `${n} pegasi: ${e.nome} ne doma uno${usatoFortuna ? ' (con un punto fortuna)' : ''}: cavalcatura volante.`; }
      return `${n} pegasi: ${e.nome} non riesce a domarli.`;
    }
    case 'festeggiamenti': {
      const ids = await sceltaMultipla('Festeggiamenti sfrenati', 'Chi si unisce ai festeggiamenti? (esclusi i monaci e chi è accompagnato da una megera)', vivi().filter(e => !e.png).map(e => [e.id, e.nome]));
      if (!ids.length) return 'Nessuno si unisce ai festeggiamenti.';
      const out = [];
      for (const id of ids) {
        const e = eroePerId(id), b = (e.classe === 'mezzuomo' || e.culto === 'chierico-korimnos' || e.classe === 'spadaccino') ? mezzo(e) : 0;
        if (await C.salva(e, 3, b, 'Accoppiamento')) { const q = (await tira('1d3', 'PV recuperati')).totale; e.pv = Math.min(e.pvMax, e.pv + q); await G.aggiungiIndizio(e); out.push(`${e.nome} +1 indizio e ${q} PV`); } else { C.perdiPV(e, 1, 'festeggiamenti'); out.push(`${e.nome} -1 PV`); }
      }
      return out.join('; ') + '.';
    }
    case 'prigioniero': return await prigioniero();
    case 'mappa-tesoro': {
      const n = (await tira('1d3', 'Indizi della mappa del tesoro (solo per un tesoro segreto)')).totale; s.indiziTesoro = (s.indiziTesoro || 0) + n; modificato();
      return `+${n} indizi utilizzabili solo per localizzare un tesoro segreto (totale ${s.indiziTesoro}; ne bastano 2 con una vanga, altrimenti 3: Strumenti).`;
    }
  }
  return row.testo;
}
const bonusFuga = e => (['barbaro', 'elfo', 'elfo-silvano', 'guida-terre-selvagge', 'signore-bestie'].includes(e.classe) ? 1 : 0) - (['mezzuomo', 'nano'].includes(e.classe) ? 1 : 0);

/** Borgo (Scoperta 1): etnia, locanda, tempio con 5-6 su 1d6. */
async function borgo() {
  const et = riga(D().tabelle.tipoVillaggio, (await dado('Etnia del borgo (1-4 umani, 5 mezzuomini, 6 elfi)')).totale), tem = (await dado('Tempio nel borgo? (5-6)')).totale >= 5;
  st().borgo = { etnia: et.id, tempio: tem };
  return `piccolo borgo di ${et.id}: si compra e vende ogni oggetto del manuale base; locanda 1 p.o. al giorno per 1 PV per giorno di riposo${tem ? '; c’è un tempio (pozioni di guarigione, acqua santa, Benedizione, resurrezioni ai prezzi normali)' : ''}.`;
}

/** Evento 1: domare un incendio è un combattimento contro un aberrante L5 con PV pari ai quadretti di alberi adiacenti. */
async function incendioEvento(t) {
  const n = await scelta('Incendio nella foresta', 'Quanti quadretti di alberi sono adiacenti all’area (scegli la zona più vasta; minimo 3 PV)?', [3, 4, 5, 6, 8, 10, 12, 16].map(k => [k, `${k} quadretti`]));
  const asce = await sceltaMultipla('Incendio nella foresta', 'Chi combatte il fuoco con un’ascia (+2 all’attacco)?', vivi().filter(e => !e.png).map(e => [e.id, e.nome]));
  const x = D().creatureExtra.find(c => c.id === 's-incendio'), pv = Math.max(3, n || 3);
  const inc = creaIncontro('aberranti', { ...x, pv }, 1);
  inc.sv = { ...poteriMostro(x), incendio: true, immuneMagia: true, senzaXp: true, asce }; inc.maggioreContato = true; inc.qx = { ignoraSoloArmatura: true };   // vale lo scudo, non l'armatura
  G.avviaIncontro(inc, t);
  return `un incendio (L5, ${pv} PV = quadretti di alberi): ogni PV perso è un quadretto abbattuto. Vale il bonus degli scudi, non quello dell'armatura; le asce danno +2; solo Getto d’acqua, Controllo del clima o Estingui fuoco lo colpiscono.`;
}

// =============================================================
//  PRIGIONIERI, MISSIONI E RECINTO DEGLI SCHIAVI
// =============================================================
async function prigioniero() {
  const s = st(); s.prigionieri = s.prigionieri || [];
  const e0 = await K.eroeScelto('Trovi un prigioniero: chi riceve 1 indizio?', x => x.stato === 'ok' && !x.png); if (e0) await G.aggiungiIndizio(e0);
  const r = await d66('Prigioniero (d66)'), row = riga(D().tabelle.prigionieri, r.totale);
  let tx = `${row.nome}: ${row.testo}`;
  const f = await dado('Il prigioniero è in una fossa nascosta? (1-3)');
  if (f.totale <= 3) {
    const v = vivi().filter(x => !x.png), e = v[0];
    if (!v.length) tx += ' (fossa nascosta)';
    else if (v.length === 1 && !(await C.salva(e, 6, 0, 'Arrampicarsi fuori dalla fossa'))) { C.perdiPV(e, e.pv, 'intrappolato nella fossa'); tx += ` ${e.nome}, solo nella fossa, resta intrappolato e muore.`; }
    else {
      const arm = (e.armatura === 'leggera' ? 1 : e.armatura === 'pesante' ? 2 : 0), b = (e.classe === 'furfante' ? e.livello : 0) + (['elfo', 'mezzuomo', 'elfo-silvano'].includes(e.classe) ? 1 : 0) - arm;
      if (!(await C.salva(e, 4, b, 'Fossa nascosta (trappola)'))) { C.perdiPV(e, 1, 'fossa nascosta'); tx += ` ${e.nome} cade nella fossa (-1 PV).`; } else tx += ` ${e.nome} evita la fossa.`;
    }
  }
  const p = { id: uid(), tipo: row.id, nome: row.nome, testo: row.testo, riga: row.da };
  if (row.id === 's-prigioniero-guaritrice') { eroiVivi().forEach(e => { if (e.stato === 'ok') e.pv = Math.min(e.pvMax, e.pv + 1); }); tx += ' Tutti recuperano 1 PV.'; }
  if (row.id === 's-prigioniero-chierico') { s.benedizioniPrigioniero = (s.benedizioniPrigioniero || 0) + 1; }
  if (row.missione) { (s.missioni = s.missioni || []).push({ id: uid(), nome: row.missione.nome, da: row.nome, ricompensa: row.missione.ricompensaEpica, oggetto: row.missione.oggetto || null, fatta: false }); tx += ` Missione «${row.missione.nome}» registrata (Strumenti).`; }
  if (row.id === 's-prigioniero-nano' && (await dado('Al posto del nano c’è Harros Davanzu? (1, solo con Acque Oscure)')).totale === 1 && R.acque) tx += ' (Harros Davanzu, Scoperta 3 di Acque Oscure: gestito a mano).';
  s.prigionieri.push(p); modificato();
  return tx;
}
/** Consegna le ricompense dei prigionieri riportati in salvo (a fine avventura o da un borgo). */
export async function riportaACasa() {
  const s = st(), lista = s.prigionieri || []; if (!lista.length) return toast('Nessun prigioniero al seguito.', 'warn');
  for (const p of [...lista]) {
    let tx = `${p.nome} è in salvo.`;
    switch (p.tipo) {
      case 's-prigioniero-guaritrice': { const q = (await tira('1d6x5', 'Ricompensa della guaritrice')).totale; bottino({ tipo: 'oro', testo: `${q} pezzi d’oro (guaritrice riportata a casa)`, valore: q }); tx += ` Ricompensa ${q} p.o.`; break; }
      case 's-prigioniero-spia': { const n = (await tira('1d3', 'Indizi della spia')).totale; const e = await K.eroeScelto('La spia dà indizi: a chi?', x => x.stato === 'ok' && !x.png); if (e) for (let k = 0; k < n; k++) await G.aggiungiIndizio(e, { semplice: true }); tx += ` ${n} indizi.`; break; }
      case 's-prigioniero-contadino': { const n = (await tira('1d6+3', 'Razioni del contadino')).totale; bottino({ tipo: 'oggetto', nome: 'Razioni (per 1 giorno)', testo: 'Razioni (per 1 giorno)', qta: n, valore: 1 }); tx += ` ${n} razioni di cibo.`; if (await confirmBox('Il contadino offre una delle sue figlie in sposa (alleata di livello 0, 2 PV, MOR -1, arma leggera). Accetti?')) { const c = nuovoEroe('guerriero', 'Figlia del contadino'); Object.assign(c, { livello: 0, pvMax: 2, pv: 2, png: 'compagno', armi: ['leggera-taglio'], armaPrincipale: 'leggera-taglio', armatura: 'nessuna', note: 'Coniuge alleata (contadino riconoscente).' }); S.party.eroi.push(c); S.party.ordine.push(c.id); tx += ' La figlia si unisce al gruppo.'; } break; }
      case 's-prigioniero-oste': tx += ' Da ora si beve gratis a vita nella sua locanda (ogni PG può iniziare un’avventura ubriaco: ripete il primo TS contro la paura o il primo tiro follia, ma -1 alle armi da lancio per tutta l’avventura: a mano).'; break;
      case 's-prigioniero-maestro': { const e = await K.eroeScelto('Il maestro insegna gratis 1 abilità avanzata: a chi? (livello avanzato)', x => x.stato === 'ok' && !x.png && x.livello >= 5); if (e) { const lista2 = A.abilitaPerClasse(e).filter(a => a.id === 'resistente' || !(e.abilita || []).some(x => x.id === a.id)); if (lista2.length) { const id = await scelta('Abilità avanzata', 'Quale abilità insegna il maestro?', lista2.map(a => [a.id, a.nome, a.effetto])); const voce = id && await A.sceltaAbilita(lista2.find(a => a.id === id)); if (voce) { A.impara(e, voce); e.saltaAvventura = true; tx += ` ${e.nome} impara ${voce.nome || id} ma salta la prossima avventura.`; } } } else tx += ' Nessun personaggio di livello avanzato: il maestro aspetta.'; break; }
      case 's-prigioniero-chierico': tx += ' La Benedizione resta disponibile finché non la usi.'; break;
    }
    log(tx); s.prigionieri = s.prigionieri.filter(x => x.id !== p.id);
  }
  modificato();
}
export async function missioneCompiuta(m) {
  m.fatta = true;
  if (m.oggetto === 's-pipa-incantata-nano') { adv().ricompense = [...(adv().ricompense || []), 'L’oro di Kerrak Dar']; bottino({ tipo: 'magico', nome: 'Pipa incantata del nano', testo: 'Pipa incantata del nano: guarisce 1 PV dopo ogni combattimento', valore: 250 }); G.aggiungiES(`Missione «${m.nome}» compiuta (${m.da})`); log('Missione del nano compiuta: ricompensa epica «L’oro di Kerrak Dar» (a mano) e la pipa incantata (250 p.o.).'); return modificato(); }
  const r = await dado('Ricompensa epica (d6)'), row = riga(tabella('ricompense'), r.totale);
  adv().ricompense = [...(adv().ricompense || []), row.nome]; G.aggiungiES(`Missione «${m.nome}» compiuta (${m.da})`);
  log(`Missione «${m.nome}» compiuta: ricompensa epica ${row.nome} – ${row.testo}`); toast(`Ricompensa epica: ${row.nome}`); modificato();
}

// =============================================================
//  COMPAGNI ANIMALI E CAVALCATURE
// =============================================================
const ANIMALI = () => D().oggetti.filter(o => o.categoria === 'compagno-animale');
const CAVALCATURE = () => D().oggetti.filter(o => o.categoria === 'cavalcatura');
export const animaliDi = e => S.party.eroi.filter(a => a.anim && a.padroneId === e.id && a.stato !== 'morto');
/** Quanti compagni combattenti può avere un personaggio: 1, o 1 ogni 3 livelli (per eccesso) per il signore delle bestie. */
export const maxCompagni = e => (e.classe === 'signore-bestie' ? Math.max(1, Math.ceil(e.livello / 3)) : 1);
const nomeAnimale = (o, padrone) => { const base = `${o.nome.split(' (')[0].replace(/ giovane$/, '')} di ${padrone.nome}`, usati = new Set(S.party.eroi.map(x => x.nome)); let n = base, k = 2; while (usati.has(n)) n = `${base} ${k++}`; return n; };
/** Il compagno animale entra nel gruppo come alleato (png «animale»), accanto al padrone nell'ordine di marcia. */
export function creaAnimale(padrone, o) {
  const a = nuovoEroe('guerriero', nomeAnimale(o, padrone));
  Object.assign(a, { livello: o.liv, pvMax: o.pv, pv: o.pv, png: 'animale', padroneId: padrone.id, armi: [], armaPrincipale: null, armatura: 'nessuna', scudo: false, oro: 0, lanterna: false, posizione: adv()?.stanzaCorrente || padrone.posizione || null,
    anim: { id: o.id, tipo: o.nome, liv: o.liv, att: o.modAttacco ?? 0, dif: o.modDifesa ?? 0, mor: o.mor, pvBase: o.pv, add: { att: 0, dif: 0, mor: 0, ts: 0, pv: 0 }, armatura: false, aiuta: false }, note: o.effetto });
  S.party.eroi.push(a); const k = S.party.ordine.indexOf(padrone.id); S.party.ordine.splice(k >= 0 ? k + 1 : S.party.ordine.length, 0, a.id);
  log(`${a.nome} si unisce a ${padrone.nome} come compagno animale (LIV ${o.liv}, ${o.pv} PV).`); return a;
}
const incompatibile = (e, o) => {
  const mie = animaliDi(e).map(a => a.anim.id);
  if (o.id === 's-ombra-foresta' && (mie.includes('s-cane-guerra') || mie.includes('s-orsolupo'))) return 'L’ombra della foresta è incompatibile con cani da guerra, lupi e orsilupi.';
  if ((o.id === 's-cane-guerra' || o.id === 's-orsolupo') && mie.includes('s-ombra-foresta')) return 'Cani da guerra, lupi e orsilupi sono incompatibili con l’ombra della foresta.';
  return null;
};
export function puoAvereAnimale(e, o) {
  if (e.png) return 'Solo i personaggi possono avere un compagno.';
  if (o.liv > e.livello) return 'Un compagno animale non può essere di livello più alto del padrone.';
  if (animaliDi(e).length >= maxCompagni(e)) return `${e.nome} ha già ${maxCompagni(e) === 1 ? 'il suo compagno animale combattente' : 'tutti i compagni consentiti'}.`;
  if (o.soloClassi && !o.soloClassi.includes(e.classe)) return `Riservato a ${o.soloClassi.join(', ')}.`;
  if (o.nonAccettatoDa?.includes(e.classe)) return 'Un nano non lo accetta.';
  return incompatibile(e, o);
}
const pagaGruppo = (e, costo) => {
  let resto = costo; const lista = [e, ...eroiVivi().filter(x => x.id !== e.id && !x.png)];
  for (const x of lista) { const k = Math.min(x.oro || 0, resto); x.oro = (x.oro || 0) - k; resto -= k; if (!resto) break; }
  return resto === 0;
};
const oroGruppo = e => (e.oro || 0) + eroiVivi().filter(x => x.id !== e.id && !x.png).reduce((a, x) => a + (x.oro || 0), 0);
export function prezzoCompagno(e, o) { return o.gratisPer?.includes(e.classe) ? 0 : o.prezzo; }
export function compraAnimale(e, o) {
  const m = puoAvereAnimale(e, o); if (m) return toast(m, 'warn');
  const p = prezzoCompagno(e, o); if (p > oroGruppo(e)) return toast('Oro insufficiente.', 'warn');
  pagaGruppo(e, p); creaAnimale(e, o); log(`${e.nome} ${p ? `compra ${o.nome} per ${p} p.o.` : `ottiene ${o.nome} gratis`}.`); modificato('party');
}
export async function daiCavalcatura(e, id, stato = null) {
  const o = D().oggetti.find(x => x.id === id); if (!o) return;
  if (e.cavalcatura && !(await confirmBox(`${e.nome} ha già ${e.cavalcatura.nome}: la sostituisci?`))) return;
  e.cavalcatura = { id: o.id, nome: stato?.nome || o.nome.split(' (')[0], liv: o.liv, pv: o.pv, pvMax: o.pv, carico: o.carico === 'x3' ? 3 : 2, volante: !!o.volante || id === 's-pegaso', combatte: !o.nonCombatte };
  log(`${e.nome} ha una cavalcatura: ${e.cavalcatura.nome}.`); modificato('party');
}
export function compraCavalcatura(e, o) {
  if (o.soloClassi && !o.soloClassi.includes(e.classe)) return toast(`Riservato a ${o.soloClassi.join(', ')}.`, 'warn');
  if (o.cavalcabileDa && !['mezzuomo', 'nano'].includes(e.classe)) return toast('Cavalcabile solo da creature di taglia mezzuomo o nano.', 'warn');
  if (o.prezzo > oroGruppo(e)) return toast('Oro insufficiente.', 'warn');
  pagaGruppo(e, o.prezzo); log(`${e.nome} compra ${o.nome} per ${o.prezzo} p.o.`); daiCavalcatura(e, o.id);
}
export const caricoCavalcatura = e => (e.cavalcatura && e.cavalcatura.carico) || 1;
const primaFila = e => (S.party.ordine || []).slice(0, 2).includes(e.id);
/** Sezione del negozio: compagni animali e cavalcature (le cavalcature vive non entrano nei dungeon: la selva è all'aperto). */
export function sezioneNegozio(e, rinfresca) {
  if (!silvaniAttivi() || !e) return null;
  const box = h('div', { class: 'shop' }, h('h4', {}, 'Animali addomesticati (Labirinti Silvani)'));
  for (const o of ANIMALI().filter(x => x.prezzo)) {
    const m = puoAvereAnimale(e, o), p = prezzoCompagno(e, o);
    box.append(h('div', { class: 'row', title: o.effetto }, h('span', { class: 'grow' }, `${o.nome} (LIV ${o.liv}, ${o.pv} PV)`), h('span', { class: 'price' }, `${p} p.o.`), h('button', { disabled: !!m, title: m || '', onclick: () => { compraAnimale(e, o); rinfresca(); } }, 'Compra')));
  }
  for (const o of CAVALCATURE().filter(x => x.prezzo)) box.append(h('div', { class: 'row', title: o.effetto }, h('span', { class: 'grow' }, o.nome.split(' (')[0]), h('span', { class: 'price' }, `${o.prezzo} p.o.`), h('button', { onclick: () => { compraCavalcatura(e, o); rinfresca(); } }, 'Compra')));
  box.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Vanga (2 indizi bastano per la mappa del tesoro)'), h('span', { class: 'price' }, '4 p.o.'), h('button', { disabled: oroGruppo(e) < 4, onclick: () => { pagaGruppo(e, 4); (e.oggetti = e.oggetti || []).push({ nome: 'Vanga', qta: 1 }); log(`${e.nome} compra una vanga.`); modificato('party'); rinfresca(); } }, 'Compra')));
  box.append(h('small', { class: 'hint' }, 'Armatura leggera su misura per cani da guerra e lupi: 50 p.o. (dal riquadro del compagno nel pannello «Silvani» degli Strumenti).'));
  return box;
}

/** Bonus di addestramento del signore delle bestie: metà livello da ripartire tra attacco, difesa, morale, TS e PV dei compagni. */
export function addestramento(e) {
  const tot = mezzo(e), ani = animaliDi(e); if (!ani.length) return toast('Nessun compagno animale.', 'warn');
  modal(`Bonus di addestramento di ${e.nome} (${tot} da ripartire)`, (b, close) => {
    const campi = ['att', 'dif', 'mor', 'ts', 'pv'], et = { att: 'Attacco', dif: 'Difesa', mor: 'Morale', ts: 'Salvezza', pv: 'PV' }, input = {};
    ani.forEach(a => { const riga_ = h('div', { class: 'row wrap' }, h('b', {}, a.nome)); input[a.id] = {}; campi.forEach(c => { input[a.id][c] = h('input', { type: 'number', min: 0, value: a.anim.add[c] || 0, style: 'width:56px', title: et[c] }); riga_.append(h('label', {}, et[c], input[a.id][c])); }); b.append(riga_); });
    b.append(h('div', { class: 'row end' }, h('button', { onclick: close }, 'Annulla'), h('button', { class: 'primary', onclick: () => {
      let somma = 0; ani.forEach(a => campi.forEach(c => { somma += Math.max(0, +input[a.id][c].value || 0); }));
      if (somma > tot) return toast(`Troppi punti: ${somma} su ${tot}.`, 'warn');
      ani.forEach(a => { campi.forEach(c => { a.anim.add[c] = Math.max(0, +input[a.id][c].value || 0); }); a.pvMax = a.anim.pvBase + a.anim.add.pv; a.pv = Math.min(a.pvMax, Math.max(a.pv, 1)); });
      log(`${e.nome} ripartisce il bonus di addestramento (${somma}/${tot}).`); modificato('party'); close();
    } }, 'Conferma')));
  });
}
/** Aumenta di 1 il livello del compagno (1 tiro ES riuscito): +1 PV e +1 ad attacco o difesa; mai oltre il livello del padrone. */
export async function promuovi(e, a) {
  if (a.anim.liv >= e.livello) return toast('Il compagno non può superare il livello del padrone.', 'warn');
  const k = await scelta('Promozione del compagno', `${a.nome}: +1 livello, +1 PV e +1 a...`, [['att', 'Attacco'], ['dif', 'Difesa']]); if (!k) return;
  a.anim.liv++; a.livello++; a.anim.pvBase++; a.pvMax++; a.pv++; a.anim[k]++; log(`${a.nome} sale al livello ${a.anim.liv} (+1 PV, +1 ${k === 'att' ? 'attacco' : 'difesa'}).`); modificato('party');
}
/** Un'animale caduto: il druido riceve 1 punto follia. */
export function eroeCaduto(e, causa) {
  if (e.png === 'evocato') { S.party.eroi = S.party.eroi.filter(x => x.id !== e.id); S.party.ordine = S.party.ordine.filter(id => id !== e.id); log(`${e.nome} scompare.`); return; }
  if (e.anim) {
    const p = eroePerId(e.padroneId);
    if (p && p.classe === 'druido' && p.stato !== 'morto') { log(`${e.nome} è morto: ${p.nome} (druido) riceve 1 punto follia; fuori dal dungeon ne arriverà un altro.`); K.follia(p, 1); }
    S.party.eroi = S.party.eroi.filter(x => x.id !== e.id); S.party.ordine = S.party.ordine.filter(id => id !== e.id); modificato('party');
  }
}
/** Il cane da guerra subisce al posto del padrone il danno con 5-6 su 1d6. Restituisce i PV che restano al padrone. */
export function dirottaDanno(e, n, causa) {
  if (n <= 0 || e.anim || e.png === 'evocato') return n;
  const cane = animaliDi(e).find(a => a.anim.id === 's-cane-guerra' && a.stato === 'ok'); if (!cane) return n;
  const x = d6();
  if (x >= 5) { C.nota(`${cane.nome} subisce il danno al posto di ${e.nome} (1d6: ${x}).`); C.perdiPV(cane, n, causa); return 0; }
  C.nota(`${cane.nome} non riesce a proteggere ${e.nome} (1d6: ${x}).`); return n;
}

// =============================================================
//  CLASSI: dotazione iniziale, scheda, poteri dei chierici
// =============================================================
/** Dopo la creazione: il druido e il signore delle bestie ricevono un compagno animale (di livello 0 o 1 per il signore). */
export async function dotazioneIniziale(e, auto = false) {
  if (!['druido', 'signore-bestie'].includes(e.classe)) return;
  const lista = ANIMALI().filter(o => o.prezzo && o.liv <= 1 && !puoAvereAnimale(e, o));
  if (!lista.length) return;
  let o;
  if (auto) o = casuale(lista);
  else {
    const k = await scelta(`Compagno animale di ${e.nome}`, e.classe === 'druido' ? 'Il druido può avere 1 compagno animale gratuito (si unisce di spontanea volontà: costo solo 1 p.o. di cibo).' : 'Il signore delle bestie inizia con 1 compagno animale di livello 0 o 1.', [...lista.map(x => [x.id, x.nome.split(' (')[0], x.effetto.slice(0, 110)]), [null, 'Nessun compagno']]);
    o = lista.find(x => x.id === k);
  }
  if (!o) return;
  creaAnimale(e, o);
  if (e.classe === 'druido' && (e.oro || 0) >= 1) { e.oro--; log(`${e.nome} offre 1 p.o. di cibo al suo nuovo compagno.`); }
  modificato('party');
}
/** Abilità avanzate di una classe silvana (i nomi sono quelli di «Contro l'Abisso»). */
export const abilitaNomi = classe => D().abilitaPerClasse[classe] || [];
/** Incantesimo predefinito di un posto di memoria del druido. */
export const incantesimoPredefinito = e => (e.classe === 'druido' ? 'Evoca bestia' : null);
/** Incantesimi che il druido può preparare: tutta la lista base e gli avanzati appresi. */
export const incantesimiDruido = e => [...NOMI_DRUIDO(), ...(e.avanzati || [])];
export const avanzatiDisponibili = e => NOMI_AVANZATI().filter(n => !(e.avanzati || []).includes(n));
export const descrizioneIncantesimo = nome => incantesimo(nome)?.effetto || '';
/** Sezione della scheda eroe: compagni, cavalcatura, cotta di fogliacciaio, incantesimi avanzati, arma lunga. */
export function sezioneScheda(e, rinfresca) {
  if (!silvaniAttivi() || e.anim) return null;
  const box = h('div', {});
  const ani = animaliDi(e);
  box.append(h('h4', {}, 'Labirinti Silvani'));
  if (ani.length || e.classe === 'signore-bestie') {
    ani.forEach(a => box.append(h('div', { class: 'row wrap' }, h('b', { class: 'grow' }, `${a.anim.tipo.split(' (')[0]}: ${a.nome} · LIV ${a.anim.liv} · ${a.pv}/${a.pvMax} PV · ATT ${(a.anim.att + a.anim.add.att) >= 0 ? '+' : ''}${a.anim.att + a.anim.add.att} · DIF ${a.anim.dif + a.anim.add.dif + (a.anim.armatura ? 1 : 0)}`),
      ['s-cane-guerra'].includes(a.anim.id) && !a.anim.armatura ? h('button', { class: 'mini', disabled: (e.oro || 0) < 50, onclick: () => { e.oro -= 50; a.anim.armatura = true; log(`${a.nome} indossa un’armatura leggera su misura (+1 difesa, 50 p.o.).`); modificato('party'); rinfresca(); } }, 'Armatura 50 p.o.') : null,
      h('button', { class: 'mini', title: 'Spende un tiro ES pendente: se riesce +1 livello', onclick: () => promuoviConES(e, a) }, 'Promuovi (ES)'),
      h('button', { class: 'mini', onclick: () => { S.party.eroi = S.party.eroi.filter(x => x.id !== a.id); S.party.ordine = S.party.ordine.filter(id => id !== a.id); log(`${a.nome} lascia il gruppo.`); modificato('party'); rinfresca(); } }, 'Congeda'))));
    if (e.classe === 'signore-bestie') box.append(h('button', { onclick: () => addestramento(e) }, `Ripartisci il bonus di addestramento (${mezzo(e)})`), h('small', { class: 'hint' }, `Compagni consentiti: ${maxCompagni(e)} (1 ogni 3 livelli). Il bonus vale per attacco, difesa, morale, TS e PV, non per le cavalcature.`));
  }
  if (e.cavalcatura) box.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, `Cavalcatura: ${e.cavalcatura.nome}${e.cavalcatura.volante ? ' (volante)' : ''} · ${e.cavalcatura.pv}/${e.cavalcatura.pvMax} PV`),
    e.livello >= 5 && e.cavalcatura.combatte ? h('button', { class: 'mini', title: 'Spende 1 tiro ES: diventa un compagno animale (+1/2L ad attacco e difesa, 1 attacco)', onclick: () => cavalcaturaInCompagno(e) }, 'Compagno (ES)') : null,
    h('button', { class: 'mini', onclick: () => { log(`${e.nome} congeda ${e.cavalcatura.nome}.`); e.cavalcatura = null; modificato('party'); rinfresca(); } }, 'Congeda')));
  if (e.cottaFoglia > 0) box.append(h('small', { class: 'hint' }, `Cotta di fogliacciaio: ancora ${e.cottaFoglia} avventur${e.cottaFoglia === 1 ? 'a' : 'e'} (vale come armatura pesante, +2 difesa, senza penalità a nuotare e scalare).`));
  box.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!e.armaLunga, onchange: ev => { e.armaLunga = ev.target.checked; modificato('party'); } }), 'Impugna un’arma lunga (alabarda, bastone ferrato, falcione, lancia, lancia lunga, naginata, picca): colpisce i volanti nelle aree ampie'));
  if (e.classe === 'guida-terre-selvagge') box.append(h('label', {}, `Ripetizioni di un tiro usate (massimo ${2 * e.livello} per avventura)`, h('input', { type: 'number', min: 0, value: e.usi.ripeti || 0, onchange: ev => { e.usi.ripeti = Math.max(0, +ev.target.value || 0); modificato('party'); } })));
  if (e.classe === 'druido') {
    box.append(h('p', { class: 'hint' }, `Incantesimi: ${2 + e.livello} posti (conosce tutta la lista base). Avanzati appresi: ${(e.avanzati || []).join(', ') || 'nessuno'}.`));
    if (e.livello >= 5) {
      const sel = h('select', {}, avanzatiDisponibili(e).map(n => h('option', { value: n, title: descrizioneIncantesimo(n) }, n)));
      if (sel.children.length) box.append(h('div', { class: 'row' }, sel, h('button', { onclick: () => { (e.avanzati = e.avanzati || []).push(sel.value); log(`${e.nome} impara l’incantesimo avanzato «${sel.value}».`); modificato('party'); rinfresca(); } }, 'Impara un avanzato (ricompensa epica, 3 indizi o pergamena)')));
      (e.oggetti || []).filter(o => o.tipo === 'pergamena' && NOMI_AVANZATI().includes(o.incantesimo) && !(e.avanzati || []).includes(o.incantesimo)).forEach(o => box.append(h('button', { onclick: () => { consuma(e, o); (e.avanzati = e.avanzati || []).push(o.incantesimo); log(`${e.nome} impara «${o.incantesimo}» dalla pergamena (che si distrugge).`); modificato('party'); rinfresca(); } }, `Impara ${o.incantesimo} dalla pergamena`)));
    } else box.append(h('small', { class: 'hint' }, 'Gli incantesimi avanzati si imparano dal 5° livello.'));
  }
  return box;
}
async function promuoviConES(e, a) {
  const es = (adv().esPendenti || [])[0]; if (!es) return toast('Nessun tiro ES disponibile.', 'warn');
  if (a.anim.liv >= e.livello) return toast('Il compagno non può superare il livello del padrone.', 'warn');
  await G.tiroES(es, e, { tipo: 'promozione-compagno', animaleId: a.id });
}
async function cavalcaturaInCompagno(e) {
  const es = (adv().esPendenti || [])[0]; if (!es) return toast('Nessun tiro ES disponibile.', 'warn');
  await G.tiroES(es, e, { tipo: 'cavalcatura-compagno' });
}
/** Esiti dei tiri ES che non fanno salire di livello (promozione di un compagno, cavalcatura che diventa compagno). */
export async function applicaPosta(e, posta) {
  if (posta.tipo === 'incantesimo-druido') { (e.avanzati = e.avanzati || []).push(posta.nome); log(`${e.nome} impara l’incantesimo avanzato «${posta.nome}».`); modificato('party'); return true; }
  if (posta.tipo === 'promozione-compagno') { const a = eroePerId(posta.animaleId); if (a) await promuovi(e, a); return true; }
  if (posta.tipo === 'cavalcatura-compagno' && e.cavalcatura) {
    const c = e.cavalcatura, o = D().oggetti.find(x => x.id === c.id) || {}; const a = creaAnimale(e, { ...o, id: c.id, nome: c.nome, liv: c.liv ?? 1, pv: c.pvMax, modAttacco: mezzo(e), modDifesa: mezzo(e), mor: 'ST', effetto: 'Ex cavalcatura: bonus +1/2L ad attacco e difesa, al massimo 1 attacco per turno.' });
    e.cavalcatura = null; log(`${c.nome} diventa il compagno animale di ${e.nome}.`); void a; modificato('party'); return true;
  }
  return false;
}

// ---- poteri dei chierici ----
/** Musica dell'armonia (Elidra): 1 Benedizione al posto di un attacco; 1d6+livello contro il LIV; la reazione la sceglie il giocatore. */
async function musicaArmonia(e, i) {
  if ((e.usi.benedizione || 0) >= 3) return toast('Benedizioni esaurite.', 'warn');
  e.usi.benedizione++; if (i.agito) i.agito[e.id] = true;
  const r = await C.d6e(e, `Musica dell’armonia di ${e.nome} (contro LIV ${i.liv})`), tot = r.totale + e.livello;
  if (r.naturale === 1 || tot < i.liv) { C.nota(`${e.nome} suona la Musica dell’armonia ma ${i.nome} non ne è toccato (${tot} contro LIV ${i.liv}).`); return modificato(); }
  const opz = [...new Map(i.reazioni.map(x => [x[2], x])).values()];
  const k = await scelta('Musica dell’armonia', `Il tiro riesce (${tot} contro LIV ${i.liv}): scegli la reazione di ${i.nome}.`, opz.map((x, n) => [n, x[2]]));
  const re = opz[k ?? 0]; C.nota(`Musica dell’armonia (${tot}): ${e.nome} sceglie la reazione «${re[2]}» per ${i.nome}.`);
  await C.eseguiReazione(i, [re[0], re[1], re[2], re[3], re[4], re[5]], tot); modificato();
}
/** Animali pacifici (Korimnos): 1 Benedizione al posto di un attacco; un animale naturale (o un gruppo) diventa pacifico. */
async function animaliPacifici(e, i) {
  if ((e.usi.benedizione || 0) >= 3) return toast('Benedizioni esaurite.', 'warn');
  if (!(i.tag || []).includes('animale') && !(await confirmBox(`${i.nome} è un animale naturale (esiste anche nel mondo reale)?`))) return;
  e.usi.benedizione++; if (i.agito) i.agito[e.id] = true;
  C.nota(`${e.nome} invoca Korimnos: ${i.nome} è pacifico.`);
  i.reazione = { azione: 'pacifico', tiro: 0 }; i.stato = 'speciale'; modificato();
}
/** Azioni del pannello di scheda dell'incontro prima dello scontro (musica, animali pacifici, acque). */
export function preIncontro(i, btn) {
  const out = [];
  if (!silvaniAttivi()) return out;
  for (const e of eroiAttivi()) {
    if (e.culto === 'chierico-elidra' && (e.usi.benedizione || 0) < 3) out.push(btn(`Musica dell’armonia (${e.nome}, 1 Benedizione)`, () => musicaArmonia(e, i)));
    if (e.culto === 'chierico-korimnos' && (e.usi.benedizione || 0) < 3) out.push(btn(`Animali pacifici (${e.nome}, 1 Benedizione)`, () => animaliPacifici(e, i)));
  }
  return out;
}

// =============================================================
//  INCANTESIMI DEL DRUIDO (e Raccolto abbondante)
// =============================================================
const comb = () => { const i = C.inc(); return i && i.stato === 'combattimento' ? i : null; };
/** Tiro di incantesimo contro il LIV del bersaglio (`extra` = modificatori aggiuntivi). */
async function tiroIncantesimo(e, nome, i, extra = 0, mod = null) {
  const r = await C.d6e(e, `${nome} di ${e.nome}`);
  const m = mod !== null ? mod : modAttacco(e, { ...C.contestoAttacco(e), incantesimo: true, nomeIncantesimo: nome }).tot;
  const tot = r.totale + m + extra, L = i.livControDistanza || i.liv;
  return { r, tot, L, ok: r.naturale !== 1 && tot >= L };
}
/** Palla di Fuoco o altro incantesimo di fuoco nella selva: 2 su 1d6 di causare un incendio nell'area. */
export async function incendioDaFuoco(e, nome) {
  if (!inSilvani()) return;
  const x = await dado(`${nome} nella selva: scoppia un incendio? (1-2)`);
  if (x.totale > 2) return;
  const s = st(), t = G.tileById(adv().stanzaCorrente); if (!t) return;
  (s.incendi = s.incendi || {})[t.id] = true; C.nota(`Un incendio divampa nell’area ${t.nome}: attraversarla richiede un tiro salvezza (soffio del drago L5: -2 PV se fallito, -1 se riuscito). Dura finché il gruppo non lascia la selva.`); modificato();
}
const IMMUNE_FUOCO = i => (i.sv?.immuni || []).includes('fuoco') || (i.tag || []).includes('fuoco');
const IMMUNE_FULMINE = i => (i.sv?.immuni || []).includes('fulmine') || i.immuneIncantesimi?.includes('Fulmine Magico');
/** Lancia un incantesimo del druido (chiamato da combat.lancia, dopo i controlli generali). */
export async function lancia(e, nome, annulla, bersaglioId) {
  const i = comb(), nota = t => (i ? C.nota(`${e.nome} lancia ${nome}: ${t}`) : log(`${e.nome} lancia ${nome}: ${t}`));
  const serveCombattimento = () => { annulla(); toast('Serve un combattimento in corso.', 'warn'); };
  const dest = eroePerId(bersaglioId) || e;
  if (i?.sv?.immuneMagia && !['Getto d’acqua', 'Getto d\'acqua', 'Controllo del clima'].includes(nome)) { nota(`${i.nome} è immune alla magia (solo Getto d’acqua, Controllo del clima o Estingui fuoco).`); return modificato(); }
  switch (nome) {
    case 'Aspetto dell\'orso': {
      if (!i) return serveCombattimento();
      if (e.orso) { annulla(); return toast('Il druido è già un orso.', 'warn'); }
      const pv = Math.max(8, e.pv), liv = Math.max(3, e.livello); e.orso = { pv, pvMax: pv, liv, subite: 0 };
      if (i) i.agito[e.id] = true; nota(`dal turno successivo e fino a fine combattimento è un orso: attacca come guerriero di ${liv}° livello con ${pv} PV, senza incantesimi. A fine incontro subisce metà (per difetto) delle ferite prese come orso.`); break;
    }
    case 'Controllo del clima': {
      const k = await scelta('Controllo del clima', 'Solo all’aperto. Che effetto scegli?', [['clima', 'Maltempo: -1 al LIV nei tiri a distanza (non incantesimi), +1 a Richiama il fulmine'], ['elementale', '2 danni automatici a un elementale d’aria o di fuoco'], ['incendio', 'Spegni un incendio naturale']]);
      if (k === 'clima') { if (!i) { annulla(); return toast('Serve un combattimento in corso.', 'warn'); } i.clima = true; nota('maltempo lieve: -1 al livello dei mostri nei tiri a distanza (non incantesimi), +1 a ogni Richiama il fulmine.'); }
      else if (k === 'elementale') { if (!i || !/elementale/i.test(i.nome) || !['aria', 'fuoco'].includes(i.sv?.tipoEl?.id)) { annulla(); return toast('Serve un elementale d’aria o di fuoco in combattimento.', 'warn'); } nota('2 danni automatici.'); await C.applicaDanni(2); }
      else if (k === 'incendio') { const s = st(); if (i?.sv?.incendio) { nota('l’incendio è spento.'); await C.applicaDanni(99); } else if (s.incendi && Object.keys(s.incendi).length) { s.incendi = {}; nota('gli incendi naturali della selva sono spenti.'); } else { annulla(); return toast('Nessun incendio da spegnere.', 'warn'); } }
      else annulla(); break;
    }
    case 'Disperdi infestanti': {
      if (!i) return serveCombattimento();
      if (i.tabella !== 'infestanti' || tipoNonVivente(i) === 'non-morto' || tipoNonVivente(i) === 'artificiale') { nota('funziona solo contro mostri infestanti (non non-morti né meccanici).'); break; }
      const r = await C.d6e(e, `Disperdi infestanti di ${e.nome}`), tot = r.totale + 2 * e.livello, colpi = r.naturale !== 1 && tot >= i.liv ? Math.max(1, Math.floor(tot / i.liv)) : 0;
      if (!colpi) { nota(`attacco in mischia a +${2 * e.livello}: ${tot} contro LIV ${i.liv} → mancato.`); break; }
      nota(`attacco in mischia a +${2 * e.livello}: ${tot} contro LIV ${i.liv} → ${colpi} dispers${colpi === 1 ? 'o' : 'i'} (nessun tesoro né componente).`); i.fonte = 'incantesimo'; i.tes = 'NO'; await C.applicaDanni(colpi); break;
    }
    case 'Evoca bestia': {
      if (!i) return serveCombattimento();
      if (S.party.eroi.some(x => x.png === 'evocato' && x.stato !== 'morto')) { annulla(); return toast('C’è già una bestia evocata.', 'warn'); }
      const b = nuovoEroe('guerriero', 'Bestia evocata'); Object.assign(b, { livello: 3, pvMax: 5, pv: 5, png: 'evocato', evocatoDa: e.id, armi: ['una-mano-taglio'], armaPrincipale: 'una-mano-taglio', armatura: 'nessuna', scudo: false, posizione: e.posizione, note: 'Bestia evocata dal druido: guerriero di 3° livello con 5 PV; scompare se muore, se il druido cade o a fine incontro.' });
      S.party.eroi.push(b); S.party.ordine.splice(Math.max(0, S.party.ordine.indexOf(e.id)) + 1, 0, b.id); if (i) i.agito[b.id] = true;
      nota('compare una grossa bestia naturale (guerriero di 3° livello, 5 PV) che combatte dal turno seguente.'); break;
    }
    case 'Frantuma legno': {
      const opz = [['altro', 'Distruggi un manufatto di legno (cassa, palizzata, porta)']];
      const ponte = Object.entries(st().ponti || {}).find(([id, p]) => p.tipo === 'legno' && id === adv().stanzaCorrente);
      if (ponte) opz.unshift(['ponte', 'Distruggi il ponte di legno qui']);
      if (i && /albero|legno|pianta|driad|uomini albero|golem di legno/i.test(`${i.nome} ${(i.tag || []).join(' ')}`)) opz.unshift(['danno', '2 danni automatici (creatura di legno o pianta)']);
      const k = await scelta('Frantuma legno', '', opz);
      if (k === 'danno') { nota(`2 danni automatici a ${i.nome}.`); await C.applicaDanni(2); }
      else if (k === 'ponte') await distruggiPonte(ponte[0], 'Frantuma legno');
      else if (k === 'altro') nota('il manufatto di legno è distrutto.'); else annulla(); break;
    }
    case 'Getto d’acqua': case 'Getto d\'acqua': {
      if (!i) { nota('disseta tutto il gruppo (con cavalcature e alleati) per 1 giorno.'); break; }
      const t = await scelta('Getto d’acqua', 'Dove ti trovi?', [[0, 'Terreno normale'], [1, 'Presso uno specchio d’acqua (+1)'], [-2, 'Zona desertica (-2)']]);
      const x = await tiroIncantesimo(e, nome, i, t || 0);
      if (!x.ok) { nota(`${x.tot} contro LIV ${x.L} → fallito.`); break; }
      const k = await scelta('Getto d’acqua', `Il tiro riesce (${x.tot} contro LIV ${x.L}). Scegli:`, [['a', '2 danni a una creatura di fuoco o a un fuoco naturale'], ['b', '2 infestanti dispersi'], ['c', '1 seguace perde i sensi'], ['d', '1 maggiore distratto: il gruppo si sottrae senza subire attacchi']]);
      i.fonte = 'incantesimo';
      if (k === 'a') { if (IMMUNE_FUOCO(i) || i.sv?.incendio) { nota('2 danni.'); await C.applicaDanni(2); } else nota('nessun effetto: il bersaglio non è una creatura di fuoco.'); }
      else if (k === 'b') { if (i.tabella === 'infestanti') { nota('2 infestanti dispersi.'); await C.applicaDanni(2); } else nota('nessun effetto: solo contro infestanti.'); }
      else if (k === 'c') { if (i.tabella === 'seguaci') { nota('1 seguace perde i sensi.'); await C.applicaDanni(1); } else nota('nessun effetto: solo contro seguaci.'); }
      else if (k === 'd') { if (!i.minore) { nota('il maggiore è distratto: il gruppo si sottrae senza subire attacchi.'); C.sottrarsiIndenne('Getto d’acqua'); } else nota('nessun effetto: solo contro un maggiore.'); }
      break;
    }
    case 'Impigliare': case 'Ragnatela': {
      if (!i) return serveCombattimento();
      const fuoco = IMMUNE_FUOCO(i), elem = /elementale/i.test(i.nome);
      if (nome === 'Ragnatela' && (fuoco || elem)) { nota(`${i.nome} è immune (creature di fuoco ed elementali).`); break; }
      if (nome === 'Impigliare' && elem) { nota(`${i.nome} è immune.`); break; }
      let ok = true;
      if (i.minore) { const x = (await tira('1d6', `${nome}: minori intrappolati`)).totale; ok = x >= i.n; nota(x >= i.n ? `intrappola tutti i ${i.n} mostri (1d6 = ${x}).` : `1d6 = ${x}: intrappola solo ${x} mostri su ${i.n}; il malus di livello vale solo se sono tutti intrappolati (nessun effetto).`); }
      else nota(`${i.nome} è intrappolato.`);
      if (ok) { i.liv = Math.max(0, i.liv - 1); i.livBase = Math.max(0, i.livBase - 1); nota(`-1 al livello in attacco e difesa fino a fine combattimento (LIV ${i.liv}). Un incantesimo di fuoco lo brucia.`); i.impigliato = true; }
      break;
    }
    case 'Passaforesta': st().passaforesta = { minuti: 10 * e.livello, druido: e.id }; nota(`per ${10 * e.livello} minuti la vegetazione si apre e il gruppo ignora alberi e vegetazione (il druido deve stare nelle prime 2 posizioni; gli alberi non vengono tagliati).`); break;
    case 'Pelle di corteccia': {
      let k = 'ally';
      if (i) k = await scelta('Pelle di corteccia', 'Su chi la lanci?', [['ally', `Su ${dest.nome}: +2 difesa, -2 TS di agilità e -2 in difesa contro il fuoco`], ['nemico', `Su ${i.nome}: +1 al suo livello, +3 agli attacchi di fuoco contro di lui (minimo 2 danni)`]]) || 'ally';
      if (k === 'nemico') { i.liv++; i.livBase++; i.corteccia = true; nota(`${i.nome} ha +1 al livello (LIV ${i.liv}) e subisce +3 dai fuochi.`); }
      else { dest.corteccia = true; nota(`${dest.nome} ha +2 ai tiri di difesa fino a fine combattimento (ma -2 ai TS di agilità e alla difesa contro il fuoco).`); }
      break;
    }
    case 'Richiama il fulmine': {
      if (!i) return serveCombattimento();
      if (IMMUNE_FULMINE(i)) { nota(`${i.nome} è immune al fulmine.`); break; }
      const x = await tiroIncantesimo(e, nome, i, i.clima ? 1 : 0);
      if (!x.ok) { nota(`${x.tot} contro LIV ${x.L} → fallito.`); break; }
      const q = i.minore ? 1 : Math.max(2, Math.floor(x.tot / x.L)); nota(`${x.tot} contro LIV ${x.L} → ${i.minore ? '1 ucciso' : q + ' ferite'}.`); i.fonte = 'incantesimo'; await C.applicaDanni(q); break;
    }
    case 'Sottomissione': if (!i) { annulla(); return toast('Serve un mostro da sottomettere.', 'warn'); } i.sottomissione = true; nota('le armi del gruppo non hanno più il -1 per sottomettere un mostro in questo incontro.'); break;
    // ---- avanzati ----
    case 'Distruggi la non-vita': {
      if (!i) return serveCombattimento();
      const nv = tipoNonVivente(i); if (nv !== 'non-morto' && nv !== 'artificiale') { nota('funziona solo contro non-morti, artificiali inorganici ed elementali.'); break; }
      const x = await tiroIncantesimo(e, nome, i); if (!x.ok) { nota(`${x.tot} contro LIV ${x.L} → fallito.`); break; }
      const q = Math.max(1, Math.floor(x.tot / x.L)); nota(`${x.tot} contro LIV ${x.L} → ${q} ${i.minore ? 'distrutti' : 'ferite'}.`); i.fonte = 'incantesimo'; await C.applicaDanni(q); break;
    }
    case 'Freccia di fuoco gemella': {
      if (!i) return serveCombattimento();
      if (IMMUNE_FUOCO(i)) { nota(`${i.nome} è immune al fuoco.`); break; }
      const mod = modAttacco(e, { ...C.contestoAttacco(e), incantesimo: true, nomeIncantesimo: nome }).tot - (e.livello - mezzo(e)), tiri = i.minore ? 2 : 1;
      if (!i.minore) nota('un solo bersaglio possibile: viene lanciata una sola freccia.');
      let tot = 0; i.fonte = 'incantesimo';
      for (let k = 0; k < tiri; k++) { const x = await tiroIncantesimo(e, `${nome} (freccia ${k + 1})`, i, 0, mod); if (x.ok) { const q = Math.max(1, Math.floor(x.tot / x.L)); tot += q; nota(`freccia ${k + 1}: ${x.tot} contro LIV ${x.L} → ${q}.`); } else nota(`freccia ${k + 1}: ${x.tot} contro LIV ${x.L} → mancata.`); }
      if (tot) await C.applicaDanni(tot); await incendioDaFuoco(e, nome); break;
    }
    case 'Furia della natura': if (!i) return serveCombattimento(); e.furiaNatura = true; nota('+2 ai tiri di attacco e +1 ai tiri di difesa fino a fine combattimento.'); break;
    case 'Guarigione armoniosa': { const t = S.party.eroi.filter(x => x.stato === 'ok'); t.forEach(x => { x.pv = Math.min(x.pvMax, x.pv + 1); }); nota(`${t.length} tra personaggi, alleati, compagni animali e cavalcature recuperano 1 PV.`); S.party.eroi.forEach(x => { if (x.cavalcatura) x.cavalcatura.pv = Math.min(x.cavalcatura.pvMax, x.cavalcatura.pv + 1); }); break; }
    case 'Nascondersi alla vista': if (!i) return serveCombattimento(); dest.nascosto = true; nota(`${dest.nome} è nascosto: i nemici lo attaccano solo se è l’ultimo in piedi (finché non attacca o lancia incantesimi).`); break;
    case 'Protezione da lacci e tagliole': st().protLacci = { bonus: e.livello }; nota(`il gruppo aggiunge ${e.livello} al primo tiro salvezza contro una trappola.`); break;
    case 'Svanire nella foresta': {
      if (!i) return serveCombattimento();
      e.svanito = true; nota(`${e.nome} svanisce nella foresta e non partecipa più allo scontro (conta come sottrarsi con successo, senza subire attacchi).`);
      if (!eroiAttivi().length) C.sottrarsiIndenne('Svanire nella foresta'); break;
    }
    case 'Raccolto abbondante': {
      const r = await dado('Raccolto abbondante: quadretti di foresta aperti (= tiro per l’incantesimo)'); nota(`apre un sentiero permanente attraverso fino a ${r.totale} quadretti di foresta (quanti il tiro per l’incantesimo).`); break;
    }
  }
  if (nome === 'Freccia di fuoco gemella') { /* l'incendio è già stato tirato */ }
  modificato();
}

// =============================================================
//  MOSTRI: poteri (inc.sv)
// =============================================================
const BASE_VOCE = ['id', 'nome', 'conta', 'tag', 'liv', 'att', 'pv', 'mor', 'tes', 'tesMolt', 'xp', 'note', 'reazioni', 'categoria', 'pagina'];
/** Poteri di un mostro: tutti i campi della voce che non sono statistiche di base (distruggeOggetti, rubaOggetto, drenaggio, rapimento, fetore, calderone…). */
export function poteriMostro(voce) {
  const sv = {};
  for (const [k, v] of Object.entries(voce)) if (!BASE_VOCE.includes(k)) sv[k] = JSON.parse(JSON.stringify(v));
  return sv;
}
const conteggio = (chi) => {
  const c = String(chi);
  if (/signore delle bestie/.test(c)) return eroiVivi().filter(e => e.classe === 'signore-bestie' && e.stato === 'ok').length;
  if (/^gufo$/.test(c)) return S.party.eroi.filter(a => a.anim?.id === 's-gufo' && a.stato !== 'morto').length;
  return 0;   // naturalisti, ranger, atrocità, mutanti… classi non collegate
};
const eroiMaghe = () => eroiVivi().filter(e => e.classe === 'mago' && e.stato === 'ok');
/** Dopo la creazione: sorpresa, tipo di elementale, modificatori alla reazione, scelte manuali (sesso e miscredenti). */
export async function postCrea(inc, voce) {
  const sv = inc.sv; if (!sv) return;
  const man = (sv.manuali = {});
  if (voce.id === 's-elementale') {
    const row = riga(D().tabelle.tipoElementale, (await dado('Tipo di elementale (1d6)')).totale);
    sv.tipoEl = { id: row.id, nome: row.nome, modArmi: row.modArmi || null, risucchio: row.risucchio || null };
    inc.nome = row.nome; sv.immuni = row.immuneA || []; if (row.volante) inc.tag = [...new Set([...inc.tag, 'volante'])]; if (row.id === 'fuoco') inc.tag = [...inc.tag, 'fuoco'];
    inc.note = `${inc.note} ${row.testo}`;
    inc.immuneIncantesimi = [...(inc.immuneIncantesimi || []), ...(row.id === 'fuoco' ? ['Palla di Fuoco'] : []), ...(row.id === 'fulmine' ? ['Fulmine Magico'] : [])];
    log(`Elementale: ${row.nome}.`);
  }
  if (voce.sorpresaProb && !inc.errante && !(voce.sorpresaSoloDungeon && inSilvani())) {
    const ani = S.party.eroi.filter(a => a.stato !== 'morto');
    const cane = ani.some(a => a.anim?.id === 's-cane-guerra') ? 1 : 0, falco = ani.some(a => a.anim?.id === 's-falco') && inForesta() ? 1 : 0;
    const talis = eroiVivi().some(e => oggetto(e, /talismano della vigilanza/i)) ? 1 : 0, elfo = inForesta() && eroiVivi().some(e => e.classe === 'elfo-silvano' && e.stato === 'ok') ? 1 : 0;
    const rid = cane + falco + Math.max(talis, elfo);   // cane e falco si sommano; talismano ed elfo non sono dichiarati cumulabili: vale il maggiore dei due
    const prob = Math.max(0, voce.sorpresaProb - rid);
    if (prob > 0) { const x = await dado(`${voce.nome}: sorprende il gruppo? (1-${prob}${rid ? `, ridotto di ${rid}` : ''})`); if (x.totale <= prob) { inc.sorpresa = true; log(`${voce.nome} sorprende il gruppo.`); } }
    else log(`${voce.nome}: probabilità di sorpresa ridotta a 0.`);
  }
  if (voce.id === 's-lupi-foreste') { const n = Math.min(2, conteggio('signore delle bestie')); if (n) { inc.moraleMod -= n; log(`Lupi: -${n} al morale per i signori delle bestie nel gruppo.`); } }
  if (voce.id === 's-uomini-gufo' && (await dado('Gli uomini gufo vendono una pozione? (5-6)')).totale >= 5) { sv.pozioni = (await tira('1d3', 'Pozioni in vendita')).totale; log(`Gli uomini gufo hanno ${sv.pozioni} pozion${sv.pozioni === 1 ? 'e' : 'i'} (fino a 100 p.o. l’una).`); }
  if (voce.id === 's-centauri' && await confirmBox('Nel gruppo ci sono personaggi di sesso femminile? (con loro i centauri hanno sempre la reazione Cattura)')) man.femmine = true;
  if (voce.id === 's-angelo-luce') { const n = await scelta('Angelo della luce', 'Quanti miscredenti ci sono nel gruppo? (cambioni, demonologhi, devoti di divinità del Caos, dei Demoni o della Morte, bestie della luna, succubi…)', [0, 1, 2, 3, 4].map(k => [k, String(k)])); man.miscredenti = n || 0; if (man.miscredenti) { inc.att += man.miscredenti; log(`L’angelo ha ATT ${inc.att} (+1 per miscredente).`); } }
  if (voce.id === 's-unicorno') { const n = await scelta('Unicorno', 'Quanti personaggi femminili vergini (di qualsiasi specie) o unicorchi ci sono nel gruppo? (-2 al tiro reazioni ciascuno)', [0, 1, 2, 3, 4].map(k => [k, String(k)])); man.vergini = n || 0; if (man.vergini) inc.modReazioni = (inc.modReazioni || 0) - 2 * man.vergini; }
  if (['s-lamia', 's-scoiattoli-malvagi'].includes(voce.id) && eroiMaghe().length) { const f = await sceltaMultipla(voce.nome, voce.id === 's-lamia' ? 'Quali maghi sono di sesso femminile? (maga: -1/2 del livello al tiro reazioni)' : 'Quali maghi sono di sesso femminile? (le maghe non vengono attaccate dagli scoiattoli)', eroiMaghe().map(e => [e.id, e.nome])); man.maghe = f; if (voce.id === 's-lamia' && f.length) inc.modReazioni = (inc.modReazioni || 0) - Math.max(...f.map(id => Math.floor((eroePerId(id)?.livello || 0) / 2))); }
  for (const m of sv.modReazione || []) { const k = conteggio(m.chi); if (k && typeof m.mod === 'number') inc.modReazioni = (inc.modReazioni || 0) + k * m.mod; }
  if (voce.id === 's-strega-nera') { sv.attBase = inc.att; sv.cubi = 0; }
  if (voce.att > 1 && inc.minore && ['s-uomini-gufo'].includes(voce.id)) sv.attacchiPerMostro = voce.att;
  if (voce.id === 's-mostro-occhio') { inc.attPerBersaglio = true; inc.attPerBersaglioN = 2; sv.occhio = true; sv.attMinus = {}; }
  if (voce.id === 's-genio') sv.genio = true;
}
/** Modificatore alla reazione dell'elfo silvano: «Amico degli abitanti della foresta» (±1 a scelta). */
export async function amicoForesta(i, tot) {
  const el = eroiAttivi().find(e => e.classe === 'elfo-silvano'); if (!el || !inForesta()) return tot;
  const az = v => (trovaReazione(i, v) || [1, 6, 'combatte'])[2];
  const opz = [[0, `Tieni ${tot}`]]; for (const d of [-1, 1]) if (tot + d >= 1 && tot + d <= 6) opz.push([d, `${d > 0 ? '+1' : '-1'} → ${tot + d}: ${az(tot + d)}`]);
  const k = await scelta('Amico degli abitanti della foresta', `${el.nome} può aumentare o diminuire di 1 il tiro di reazione (${tot}) delle creature della foresta.`, opz);
  if (k) { tot += k; C.nota(`${el.nome} (Amico della foresta) sposta il tiro di reazione a ${tot}.`); }
  return tot;
}
/** Reazione fissa: i centauri con femmine nel gruppo catturano sempre; l'angelo dipende dai miscredenti. */
export function reazioneForzata(i, re) {
  const m = i.sv?.manuali; if (!m) return re;
  if (i.id === 's-centauri' && m.femmine) return [1, 6, 'cattura'];
  if (i.id === 's-angelo-luce') return m.miscredenti > 0 ? [1, 6, 'morte'] : [1, 6, 'offre-riposo'];
  return re;
}

/** Reazione Enigma: un solo tentativo; l'enigma ha un livello (qui il LIV del mostro, il manuale base non lo precisa); i maghi aggiungono il livello. */
export async function enigma(i) {
  const bonus = e => (e.classe === 'mago' || e.classe === 'furfante' ? e.livello : 0);
  const liv = i.liv, opz = vivi().filter(e => !e.png).map(e => [e.id, `${e.nome} (${e.classe})`, `1d6${bonus(e) ? '+' + bonus(e) : ''} contro ${liv}`]);
  const k = await scelta(`Enigma: ${i.nome}`, `Il mostro propone un enigma di livello ${liv} (un solo tentativo: tira ${liv} o più su 1d6; maghi e furfanti aggiungono il livello).`, opz); if (!k) { i.stato = 'speciale'; return; }
  const e = eroePerId(k), r = await C.d6e(e, `Enigma di ${i.nome}: ${e.nome} (contro ${liv})`), tot = r.totale + bonus(e);
  if (r.naturale !== 1 && tot >= liv) {
    C.nota(`${e.nome} risolve l’enigma (${tot} contro ${liv}): ${i.nome} ti lascia andare.`); i.enigmaRisolto = true; i.reazione = { azione: 'pacifico', tiro: 0 }; i.stato = 'speciale';
    if (i.sv?.sottomettibile && i.id === 's-sfinge') C.nota('Una sfinge il cui enigma è stato risolto è considerata sottomessa (cavalcatura volante).');
    if (i.sv?.missione && i.id === 's-sfinge' && st().missioni?.some(m => m.oggetto === 'specchio d\'argento' && !m.fatta)) { bottino({ tipo: 'oggetto', nome: 'Specchio d’argento', testo: 'Specchio d’argento (dalla sfinge)' }); C.nota('La sfinge dà lo specchio d’argento delle arpie.'); }
  } else { C.nota(`${e.nome} fallisce l’enigma (${tot} contro ${liv}): ${i.nome} attacca per primo.`); i.mostriPrima = true; i.noMorale = true; await C.inizioScontro(); }
  modificato();
}
/** Attaccare la sfinge prima di risolvere l'enigma: +2 al livello. */
export function attaccaPrima(i) {
  if (i.sv?.livPiuSeAttaccataPrimaDellEnigma && !i.enigmaRisolto && !i.sfingeAumentata) { i.sfingeAumentata = true; i.liv += 2; i.livBase += 2; C.nota(`Attaccata prima dell’enigma: ${i.nome} ha +2 al livello (LIV ${i.liv}).`); }
}

// =============================================================
//  MOSTRI: combattimento
// =============================================================
const paralizza = (e, turni, i) => { e.paralizzato = true; e.paralisiQ = turni; if (i?.agito) i.agito[e.id] = true; C.nota(`${e.nome} è paralizzato per ${turni} turn${turni === 1 ? 'o' : 'i'}: non agisce e fallisce le difese.`); };
const istantanea = () => JSON.stringify({ e: eroiVivi().map(x => ({ id: x.id, pv: x.pv, stato: x.stato, usi: x.usi, inc: x.incantesimi, ogg: x.oggetti, armi: x.armi, oro: x.oro })) });
/** All'inizio dello scontro: fetore, attacco di sorpresa, masso, foto della scheda per il rakshasa. */
export async function inizioIncontro(i) {
  const sv = i.sv; if (!sv) return;
  if (sv.inversioneTempo) sv.foto = istantanea();
  if (sv.fetore) for (const e of eroiAttivi()) if (!(await C.salva(e, sv.fetore.liv, 0, 'Fetore degli uomini lucertola (veleno)'))) { e.vomito = (await tira('1d3', `Turni di vomito di ${e.nome}`)).totale; C.nota(`${e.nome} vomita per il fetore: non attacca per ${e.vomito} turn${e.vomito === 1 ? 'o' : 'i'}.`); }
  if (sv.attaccoSorpresa && i.sorpresa) for (const e of eroiAttivi()) { const es = await C.provaDifesa(e, i, sv.attaccoSorpresa.liv, {}); if (!es.ok) { const q = (await tira('1d3', 'Coltelli delle ruote viventi')).totale; C.perdiPV(e, q, 'coltelli delle ruote viventi'); } }
  if (sv.masso) for (const e of ordineMarcia().filter(x => x.stato === 'ok').slice(0, 2)) if (!(await C.salva(e, sv.masso.liv, e.classe === 'furfante' ? mezzo(e) : 0, 'Masso del gigante (schivare)'))) { const q = (await tira('1d3', 'Masso')).totale; C.perdiPV(e, q, 'masso del gigante'); }
  if (sv.gruppoAccessorio) C.nota(`${sv.gruppoAccessorio.nome}: non combattono e fuggono sempre.`);
  modificato();
}
/** Inizio di ogni turno: canto delle arpie, vomito, occhio del mostro occhio, creature nel calderone o in coma. */
export async function inizioTurno(i) {
  const sv = i.sv;
  for (const e of eroiAttivi()) { if (e.coma || e.calderone || e.rospo) i.agito[e.id] = true; if (e.vomito > 0) { i.agito[e.id] = true; e.vomito--; } }
  if (!sv) return;
  if (sv.paralisi?.quando === 'ogni turno delle arpie') for (const e of eroiAttivi()) { const b = (['mago', 'mezzuomo'].includes(e.classe) || e.culto === 'chierico-korimnos' && false) ? mezzo(e) : 0; if (!e.paralizzato && !(await C.salva(e, sv.paralisi.liv, b, 'Canto delle arpie (magia)'))) paralizza(e, 1, i); }
  if (sv.occhio) { sv.attMinus = {}; for (const e of eroiAttivi()) if (!sv.occhioColpito && (await C.salva(e, sv.tsInizioTurno.liv, ['mago', 'mezzuomo'].includes(e.classe) ? mezzo(e) : 0, 'Sguardo del mostro occhio (magia)'))) { sv.attMinus[e.id] = 1; C.nota(`${e.nome} riduce di 1 gli attacchi contro di sé.`); } }
}
const ordineOggetti = [[/formaggio/i, 'formaggio'], [/razion/i, 'razioni'], [/pergamena/i, 'pergamena'], [/pelle|cuoio|otre|zaino|mantello|cappa/i, 'oggetto di pelle']];
function sbranaOggetto(heroes) {
  const tutti = heroes.flatMap(e => (e.oggetti || []).map(o => [e, o]));
  for (const [re, nome] of ordineOggetti) { const t = tutti.find(([, o]) => re.test(o.nome || '') || (nome === 'pergamena' && o.tipo === 'pergamena')); if (t) { consuma(t[0], t[1]); return `${nome} (${t[1].nome}) di ${t[0].nome}`; } }
  const altro = tutti.find(([, o]) => !/arma|armatura|scudo|lanterna|grimaldelli|chiod|acqua santa|pozione|gemma|gioiell|corda|torcia|magic/i.test(o.nome || '') && o.tipo !== 'magico' && o.tipo !== 'gemma');
  if (altro) { consuma(altro[0], altro[1]); return `${altro[1].nome} di ${altro[0].nome}`; } return null;
}
/** Poteri all'inizio del turno dei mostri. Restituisce {salta:true} se il turno dei mostri non prosegue. */
export async function inizioTurnoMostri(i) {
  const sv = i.sv; if (!sv) return null;
  if (sv.distruggeOggetti && i.n > 0) {   // ratti della nebbia: ogni ratto per turno addenta un oggetto, nell'ordine indicato
    const persi = []; for (let k = 0; k < i.n; k++) { const x = sbranaOggetto(eroiVivi().filter(e => !e.png)); if (!x) break; persi.push(x); }
    C.nota(persi.length ? `I ratti addentano: ${persi.join('; ')}.` : 'I ratti non trovano più nulla da addentare.'); modificato('party');
  }
  if (sv.drenaggio && i.n > 0) for (const e of eroiAttivi().filter(x => !x.png)) {
    if ((sv.manuali?.maghe || []).includes(e.id)) { C.nota(`${e.nome} (maga) non è attaccata dagli scoiattoli.`); continue; }
    const r = await dado(`Scoiattoli malvagi su ${e.nome}: 1d6+livello contro ${i.n}`), tot = r.totale + e.livello;
    if (tot >= i.n) continue;
    if ((e.usi.fortuna || 0) < e.livello + 1 && e.classe === 'mezzuomo') { e.usi.fortuna = (e.usi.fortuna || 0) + 1; C.nota(`${e.nome} perde 1 punto fortuna (scoiattoli).`); }
    else if (e.classe === 'spadaccino' && e.maestria > 0) { e.maestria--; C.nota(`${e.nome} perde 1 punto maestria (scoiattoli).`); }
    else if (e.classe === 'chierico' && ((e.usi.guarigione || 0) < 3 || (e.usi.benedizione || 0) < 3)) { const k = (e.usi.guarigione || 0) < 3 ? 'guarigione' : 'benedizione'; e.usi[k]++; C.nota(`${e.nome} perde 1 potere (${k}) per gli scoiattoli.`); }
    else if ((e.incantesimi || []).some(s => !s.usato)) { const s = (e.incantesimi || []).find(x => !x.usato); s.usato = true; C.nota(`${e.nome} perde l’incantesimo «${s.nome}» (scoiattoli).`); }
    else C.perdiPV(e, 1, 'scoiattoli malvagi');
  }
  if (sv.duplicatoIllusorio && !i.minore) { const x = await tira('2d6', 'Lamia: duplicato illusorio? (meno dei PV rimasti)'); if (x.totale < i.pv && i.pv < i.pvMax) { C.nota(`${x.totale} < ${i.pv}: era un duplicato illusorio, i PV della lamia tornano a ${i.pvMax}.`); i.pv = i.pvMax; } }
  if (sv.calderone) {
    const nel = eroiVivi().filter(e => e.calderone && e.stato === 'ok'); for (const e of nel) C.perdiPV(e, 1, 'calderone bollente');
    const cand = eroiAttivi().filter(e => !e.calderone && !e.png).sort((a, b) => modAttacco(b, C.contestoAttacco(b)).tot - modAttacco(a, C.contestoAttacco(a)).tot)[0];
    if (cand && !nel.length) {
      const b = (['guerriero', 'paladino'].includes(cand.classe) ? mezzo(cand) : 0) + (cand.classe === 'mezzuomo' ? -1 : 0);
      if (!(await C.salva(cand, sv.calderone.liv, b, 'Calderone della strega (magia)'))) { cand.calderone = true; i.agito[cand.id] = true; C.nota(`${cand.nome} è imprigionato nel calderone: non attacca e perde 1 PV a turno; la strega perde 1 attacco.`); }
    }
    i.att = Math.max(0, (sv.attBase || i.att) - eroiVivi().filter(e => e.calderone).length);
  }
  if (sv.inversioneTempo && sv.foto) {
    const x = await dado('Rakshasa: inverte il tempo? (1)');
    if (x.totale <= sv.inversioneTempo.su) {
      const f = JSON.parse(sv.foto); for (const r of f.e) { const e = eroePerId(r.id); if (!e) continue; Object.assign(e, { pv: r.pv, stato: r.stato, usi: r.usi, incantesimi: r.inc, oggetti: r.ogg, armi: r.armi, oro: r.oro }); }
      i.pv = i.pvMax; i.liv = i.livBase; i.n = i.nIniziale; i.turno = 0; i.moraleFatto = false; i.sorpresa = false;
      C.nota('Il rakshasa inverte il corso del tempo: il combattimento ricomincia da capo (PV, incantesimi e poteri dei personaggi tornano allo stato iniziale; solo un incantesimo temporale lo impedirebbe).'); modificato('party'); return { salta: true };
    }
  }
  return null;
}
/** Un colpo a segno sul bersaglio: furto dei folletti, danni a dado, rapimento delle aquile. Restituisce true se il danno è già stato gestito. */
export async function colpoAlBersaglio(e, i, dif, r) {
  const sv = i.sv; if (!sv) return false;
  if (sv.rubaOggetto) {
    const lista = (e.oggetti || []).filter(o => !o.afferrato);
    if (lista.length) { const o = casuale(lista); consuma(e, o); C.nota(`Un folletto ruba «${o.nome}» a ${e.nome} e vola via.`); } else C.nota(`Il folletto non trova nulla da rubare a ${e.nome}.`);
    if (i.minore && i.n > 0) { i.n--; if (i.n === 0) await C.applicaDanni(0); }
    modificato('party'); return true;
  }
  const dd = sv.dannoDadi; if (dd) { const q = (await tira(dd, `Ferite di ${i.nome}`)).totale; C.perdiPV(e, q, i.nome); if (e.stato === 'ok') await effettoFerita(e, i, q, r, dif); return true; }
  if (sv.rapimento && !i.corridoio) {
    sv.colpiSu = sv.colpiSu || {}; const dn = i.danno || 1; C.perdiPV(e, dn, i.nome); sv.colpiSu[e.id] = (sv.colpiSu[e.id] || 0) + 1;
    if (e.stato === 'ok' && sv.colpiSu[e.id] === sv.rapimento.attacchiASegnoMin) { const es = await C.provaDifesa(e, i, sv.rapimento.liv, {}); if (!es.ok) C.perdiPV(e, e.pv, 'rapito dalle aquile e portato al nido', { noExtra: true }); else C.nota(`${e.nome} resiste al rapimento.`); }
    return true;
  }
  return false;
}
/** Effetti dopo una ferita: veleno dei vermi, coma del coatl, livello perso con la lamia, risucchio dell'elementale d'energia. */
export async function effettoFerita(e, i, dn, r, dif) {
  const sv = i.sv; if (!sv || e.stato !== 'ok') return;
  if (sv.paralisi?.quando === 'personaggio colpito' && !e.paralizzato && !(await C.salva(e, sv.paralisi.liv, 0, 'Vermi delle carogne (veleno)'))) paralizza(e, 2, i);
  if (sv.coma && !(await C.salva(e, sv.coma.liv, ['barbaro', 'mezzuomo', 'nano'].includes(e.classe) ? mezzo(e) : 0, 'Morso del coatl (veleno)'))) { e.coma = true; e.paralizzato = true; i.agito[e.id] = true; C.nota(`${e.nome} cade in coma fino a fine combattimento (se abbandonato viene mangiato).`); }
  if (sv.perditaLivello && !(await C.salva(e, sv.perditaLivello.liv, 0, 'Lamia (magia)'))) { A.perdiLivello(e, 1); e.livelloLamia = (e.livelloLamia || 0) + 1; C.nota(`${e.nome} perde 1 livello finché non riceve una Benedizione.`); }
  if (sv.tipoEl?.risucchio && !(await C.salva(e, sv.tipoEl.risucchio.liv, 0, 'Risucchio di energia'))) A.perdiLivello(e, 1);
}
/** Sangue velenoso dei centauri: chi li colpisce in mischia fa un TS veleno (L2) o perde 1 PV. */
export async function sangueVelenoso(e, i) {
  const sg = i.sv?.sangueVelenoso; if (!sg || e.stato !== 'ok') return;
  if (!(await C.salva(e, sg.liv, 0, 'Sangue velenoso dei centauri (veleno)'))) C.perdiPV(e, sg.perdita, 'sangue velenoso');
}
/** Dopo danni ai mostri: i lupi e gli uomini lucertola tirano il morale se colpiti da una Palla di Fuoco. */
export async function dopoDanni(i, prima, n) {
  const sv = i.sv; if (!sv?.moralePallaDiFuoco || !i.minore || i.fonte !== 'incantesimo' || !i.pdfColpita || i.noMorale || i.stato === 'finito') return;
  const uccisi = prima - i.n; if (uccisi < sv.moralePallaDiFuoco.uccisiMin || i.n <= 0) return;
  const tiri = 1 + ((sv.moralePallaDiFuoco.tiriMoraleSeSotto50 === 2 && i.n * 2 < i.nIniziale) ? 1 : 0);
  C.nota(`Palla di Fuoco: ${uccisi} uccisi, ${i.nome} deve tirare il morale${tiri > 1 ? ' due volte' : ''}.`);
  for (let k = 0; k < tiri && i.stato !== 'finito' && i.n > 0; k++) { i.moraleFatto = false; await C.tiraMorale(); }
}
/** A fine turno dei mostri: gli incantesimi della strega nera. */
export async function fineTurnoMostri(i) {
  const sv = i.sv; if (!sv?.incantesimiStrega || i.stato === 'finito') return;
  const x = await dado(`Incantesimo della strega nera (1d6${i.pv * 2 < i.pvMax ? ' +1' : ''}: persa più di metà dei PV)`), v = x.totale + (i.pv * 2 < i.pvMax ? 1 : 0), row = riga(D().tabelle.stregaIncantesimi, v);
  C.nota(`La strega lancia ${row.nome}.`);
  if (row.id === 'rospo-gigante') {
    const cand = eroiAttivi().filter(e => !e.calderone && !e.png).sort((a, b) => modAttacco(b, C.contestoAttacco(b)).tot - modAttacco(a, C.contestoAttacco(a)).tot)[0];
    if (cand && !(await C.salva(cand, 5, 0, 'Rospo gigante (magia)'))) {
      const sq = { armi: cand.armi, armaPrincipale: cand.armaPrincipale, armatura: cand.armatura, scudo: cand.scudo, oggetti: cand.oggetti };
      cand.sequestro = sq; cand.armi = []; cand.armaPrincipale = null; cand.armatura = 'nessuna'; cand.scudo = false; cand.oggetti = []; cand.rospo = true; cand.stato = 'pietra';
      const rospo = creaIncontro('boss', { id: 's-rospo-gigante', nome: `${cand.nome} (rospo gigante)`, liv: cand.livello + 3, att: 1, pv: Math.max(1, cand.pv), mor: 'NO', tes: 'NO', xp: false, reazioni: [[1, 6, 'combatte-sempre']] }, 1);
      rospo.rospoDi = cand.id; rospo.maggioreContato = true; rospo.tessera = i.tessera; (adv().coda = adv().coda || []).push(rospo);
      C.nota(`${cand.nome} è trasformato in un rospo gigante (attacca come mostro di LIV ${cand.livello + 3}): una Benedizione o la morte della strega lo riporta alla forma originale; armi ed equipaggiamento restano nel calderone.`);
    }
  } else if (row.id === 'prosciugare') {
    sv.cubi = (sv.cubi || 0) + 1; const bene = eroiVivi().filter(e => (e.classe === 'chierico' && (e.usi.benedizione || 0) < 3) || (e.incantesimi || []).some(s => s.nome === 'Benedizione' && !s.usato) || (e.oggetti || []).some(o => o.incantesimo === 'Benedizione' && o.cariche > 0));
    const e = casuale(bene.length ? bene : eroiVivi().filter(x => x.classe === 'chierico' && (x.usi.guarigione || 0) < 3));
    if (e && e.classe === 'chierico' && (e.usi.benedizione || 0) < 3 && bene.includes(e)) { e.usi.benedizione = 3; C.nota(`${e.nome} perde tutte le Benedizioni (prosciugate).`); }
    else if (e && bene.includes(e)) { const s = (e.incantesimi || []).find(x => x.nome === 'Benedizione' && !x.usato); if (s) s.usato = true; else { const o = e.oggetti.find(y => y.incantesimo === 'Benedizione' && y.cariche > 0); if (o) o.cariche--; } C.nota(`${e.nome} perde una Benedizione.`); }
    else if (e) { e.usi.guarigione = 3; C.nota(`${e.nome} perde i poteri di guarigione.`); }
    else { const t = eroiVivi().flatMap(x => (x.incantesimi || []).filter(s => !s.usato)); if (t.length) { casuale(t).usato = true; C.nota('Un incantesimo non utilizzato è risucchiato.'); } else C.nota('Nulla da prosciugare.'); }
  } else if (row.id === 'maledizione-apatia') { const e = casuale(eroiAttivi().filter(x => !x.png)); if (e) { e.apatia = true; C.nota(`${e.nome} è apatico: -1 a tutti gli attacchi (pozione di guarigione o Benedizione lo curano).`); } }
  else if (row.id === 'guarigione') {
    sv.cubi = (sv.cubi || 0) + 1;
    if (i.livBase - 2 < 3) C.nota('La strega non ha più livello per Guarigione: l’incantesimo fallisce.');
    else { i.pv = i.pvMax; i.livBase -= 2; i.liv = Math.max(0, i.liv - 2); C.nota(`La strega recupera tutti i PV e cancella gli effetti negativi, ma scende al livello ${i.liv}.`); }
  }
  modificato();
}
/** Guarigioni, Benedizioni e pozioni: tolgono i malus silvani (lamia, rospo, apatia, coma). */
export function cura(b, tipo) {
  if (b.livelloLamia) { b.livello += b.livelloLamia; b.pvMax += b.livelloLamia; b.livelliPersi = Math.max(0, (b.livelliPersi || 0) - b.livelloLamia); C.nota?.(`${b.nome} riacquista ${b.livelloLamia} livell${b.livelloLamia === 1 ? 'o' : 'i'}.`); b.livelloLamia = 0; }
  if (b.apatia) { b.apatia = false; log(`${b.nome} non è più apatico.`); }
  if (tipo === 'benedizione' && b.rospo) { b.rospo = false; if (b.stato === 'pietra') b.stato = 'ok'; adv().coda = (adv().coda || []).filter(c => c.rospoDi !== b.id); const r = C.inc(); if (r?.rospoDi === b.id) { r.stato = 'finito'; r.esito = 'sconfitti'; r.tesoroPreso = true; } log(`${b.nome} torna alla forma originale (le armi restano nel calderone finché la strega vive).`); }
}

// =============================================================
//  MODIFICATORI (chiamati da rules.js)
// =============================================================
export const classeSilvana = e => !!e && (['druido', 'elfo-silvano', 'guida-terre-selvagge', 'signore-bestie'].includes(e.classe) || !!e.anim);
/** Bonus di classe all'attacco: druido, elfo silvano, guida, signore delle bestie e compagni animali. */
export function attaccoClasse(e, ctx, bers, arma, add) {
  if (e.anim) { add(`${e.anim.tipo.split(' (')[0]}: bonus d’attacco`, (e.anim.att || 0) + (e.anim.add?.att || 0)); return; }
  const liv = e.livello;
  if (ctx.incantesimo) {
    if (e.classe === 'druido') { const ok = incantesimiDruido(e).includes(ctx.nomeIncantesimo) || ctx.nomeIncantesimo === 'Richiama il fulmine'; add(ok ? 'Livello (incantesimo del druido)' : 'Mezzo livello (incantesimo fuori lista)', ok ? liv : mezzo(e)); }
    else if (ctx.daPergamena) add('Pergamena (livello 1)', 0);
    return;
  }
  switch (e.classe) {
    case 'druido': if (e.orso) add('Forma d’orso (guerriero)', Math.max(3, liv)); else add('Mezzo livello', mezzo(e)); break;
    case 'signore-bestie': add('Mezzo livello', mezzo(e)); break;
    case 'elfo-silvano': if (inForesta() || ['arco', 'arco-corto'].includes(arma?.id)) add(inForesta() ? 'Livello (in foresta)' : 'Livello (con l’arco)', liv); else add('Mezzo livello', mezzo(e)); break;
  }
  if (e.orso) return;
  if (!arma) add('Disarmato', -2); else if (arma.mod) add(arma.nome, arma.mod);
}
/** Altri modificatori d'attacco della selva: volanti, sentieri, elementali, malus e bonus temporanei. */
export function attacco(e, ctx, bers, arma, add) {
  const sv = bers.sv || {};
  if (e.apatia) add('Maledizione dell’apatia', -1);
  if (e.furiaNatura) add('Furia della natura', 2);
  if (!ctx.incantesimo && (bers.tag || []).includes('volante') && arma?.lancio) add('Arma da lancio contro un volante', 1);
  if (!ctx.incantesimo && sv.modAttaccoSentiero && bers.corridoio) add('Sentiero o corridoio (aquile)', sv.modAttaccoSentiero);
  if (!ctx.incantesimo && sv.tipoEl?.modArmi && arma) { const m = sv.tipoEl.modArmi; if ((m.taglio && arma.tipo === 'taglio' && !arma.lancio) || (m.contundente && arma.tipo === 'contundente' && !arma.lancio) || (m.lancio && arma.lancio) || (m['metallo non dorato'] && arma.tipo === 'taglio')) add(`Armi contro l’elementale di ${sv.tipoEl.id}`, -1); }
  if (ctx.incantesimo) {
    if (sv.incantesimiMod && !sv.occhioColpito && ctx.nomeIncantesimo !== 'Sonno') add('Potere del mostro (incantesimi)', sv.incantesimiMod);
    if (ctx.nomeIncantesimo === 'Sonno' && sv.sonnoMod) add('Sonno contro il grifone', sv.sonnoMod);
    if (bers.corteccia && ['Palla di Fuoco', 'Freccia di fuoco gemella'].includes(ctx.nomeIncantesimo)) add('Pelle di corteccia del nemico (fuoco)', 3);
    if (S.party.eroi.some(a => a.anim?.id === 's-gufo' && a.padroneId === e.id && a.anim.aiuta && a.stato === 'ok')) add('Il gufo aiuta negli incantesimi', 1);
    if (ctx.nomeIncantesimo === 'Richiama il fulmine' && bers.clima) add('Maltempo (Controllo del clima)', 1);
  } else {
    if (bers.sottomettere && !bers.sottomissione) add('Colpire di piatto per sottomettere', -1);
    if (sv.incendio && (sv.asce || []).includes(e.id)) add('Ascia contro l’incendio', 2);
    if (e.cavalcatura?.combatte && !e.anim && primaFila(e) && inForesta()) add('In sella (prima fila)', 1);
  }
  const mantello = S.party.eroi.find(x => x.mantello && x.stato !== 'morto');
  if (mantello && mantello.id !== e.id && !e.anim) add('Mantello dell’oscurità: buio', -2);
}
/** Difesa: compagni animali, guida, elfo silvano, bonus temporanei. */
export function difesa(e, ctx, add) {
  if (e.anim) add(`${e.anim.tipo.split(' (')[0]}: difesa`, (e.anim.dif || 0) + (e.anim.add?.dif || 0) + (e.anim.armatura ? 1 : 0));
  if (e.classe === 'guida-terre-selvagge') add('Mezzo livello (guida)', mezzo(e));
  if (e.classe === 'elfo-silvano' && inForesta()) add('Livello (in foresta)', e.livello);
  if (e.furiaNatura) add('Furia della natura', 1);
  if (e.corteccia) { add('Pelle di corteccia', 2); if ((ctx.tag || []).includes('fuoco')) add('Pelle di corteccia contro il fuoco', -2); }
  if (e.apatia) { /* solo attacchi */ }
  if (e.cottaFoglia > 0 && e.armatura === 'pesante' && ctx.ignoraArmatura) { /* nessun bonus se l'armatura è ignorata: già escluso in rules */ }
  const mantello = S.party.eroi.find(x => x.mantello && x.stato !== 'morto');
  if (mantello) add(mantello.id === e.id ? 'Mantello dell’oscurità: vede al buio' : 'Mantello dell’oscurità: buio', mantello.id === e.id ? 3 : (e.anim ? 0 : -2));
}
const RE_TRAPPOLE = /botola|tagliola|laccio|fossa|buca|trappola|dardo|lance|masso|mannaia|gas|globo|catene/i;
/** Tiri salvezza: +2 per i gruppi di livello avanzato (5-9), trappole selvagge dell'elfo silvano, corteccia, protezione, doni dei geni. */
export function salvezza(e, L, inc, add) {
  if (inSilvani() && gruppoAvanzato()) add('Livello avanzato (Labirinti Silvani)', 2);
  if (e.anim?.add?.ts) add('Bonus di addestramento', e.anim.add.ts);
  if (e.corteccia && /scal|schiv|botola|tagliola|laccio|fossa|buca|trappola/i.test(L)) add('Pelle di corteccia (agilità)', -2);
  if (e.classe === 'elfo-silvano' && /botola|tagliola|laccio|fossa|buca/i.test(L)) add('Trappole delle terre selvagge', e.livello);
  if (ro().protLacci && RE_TRAPPOLE.test(L)) add('Protezione da lacci e tagliole', ro().protLacci.bonus);
  for (const t of e.tsPermanenti || []) if (new RegExp(t, 'i').test(L)) add('Dono del genio', 1);
}
/** Gli attacchi del gruppo contro una creatura volante in un'area ampia (12+ quadretti) richiedono un'arma lunga, da lancio o un incantesimo. */
export function controlloVolanti(e, i, arma) {
  if (inSilvani() && e.cavalcatura?.combatte && !e.anim && !primaFila(e) && !arma?.lancio) return 'In sella ma fuori dalla prima fila: si attacca solo con armi da lancio e incantesimi (il cavaliere in prima fila combatte in mischia).';
  if (!inSilvani() || !(i.tag || []).includes('volante') || !arma || arma.lancio) return null;
  const t = G.tileById(i.tessera), m = t && !t.corridoio ? (R.tilesSet?.foresta?.tiles?.[t.n]) : null;
  if (!m || (m.celle?.length || 0) < 12 || e.armaLunga) return null;
  return `${i.nome} vola in un’area ampia (12+ quadretti): si colpisce solo con incantesimi, armi lunghe (alabarda, bastone ferrato, falcione, lancia, lancia lunga, naginata, picca) o da lancio. Spunta «arma lunga» nella scheda se ne impugni una.`;
}
/** Scudo e armatura dell'eroe svanito, coma ecc.: bersagli degli attacchi dei mostri. */
export function filtraBersagli(ordine) {
  let o = ordine.filter(e => !e.nascosto && !e.calderone);
  if (!o.length) o = ordine.filter(e => !e.calderone);
  return o.length ? o : ordine;
}
/** Attacchi dei mostri con poteri che cambiano i bersagli: mostro occhio, genio, uomini gufo. Restituisce null se non serve. */
export function attacchiSpeciali(i, eleg) {
  const sv = i.sv; if (!sv) return null;
  if (sv.occhio) return eleg.flatMap(e => Array(Math.max(1, (sv.occhioColpito ? 1 : 2) - (sv.attMinus?.[e.id] || 0))).fill({ eroeId: e.id }));
  if (sv.genio) {
    const l = [{ eroeId: casuale(eleg).id }];
    for (const e of eleg) { if (e.armatura === 'pesante') l.push({ eroeId: e.id }); if (e.scudo) l.push({ eroeId: e.id }); }
    return l;
  }
  return null;
}
/** Uomini gufo e cani: ogni coppia colpisce sempre lo stesso bersaglio. */
export const attacchiPerMostro = i => i.sv?.attacchiPerMostro || 1;

// =============================================================
//  FINE INCONTRO, VITTORIA, BOTTINO
// =============================================================
/** Morte o fuga della strega: l'equipaggiamento rimasto nel calderone torna ai proprietari (e i rospi ridiventano personaggi). */
function restituisciSequestro() {
  for (const e of S.party.eroi.filter(x => x.sequestro)) { const q = e.sequestro; e.armi = q.armi; e.armaPrincipale = q.armaPrincipale; e.armatura = q.armatura; e.scudo = q.scudo; e.oggetti = q.oggetti; delete e.sequestro; if (e.rospo) { e.rospo = false; if (e.stato === 'pietra') e.stato = 'ok'; } log(`${e.nome} riprende l’equipaggiamento dal calderone.`); }
}
export function fineIncontro(i) {
  for (const e of S.party.eroi) {
    if (e.furiaNatura || e.corteccia || e.nascosto || e.svanito || e.vomito) { delete e.furiaNatura; delete e.corteccia; e.nascosto = false; e.svanito = false; e.vomito = 0; }
    if (e.orso) { const q = Math.floor(e.orso.subite / 2); e.orso = null; if (q) { log(`${e.nome} torna uomo: subisce metà (${q}) delle ferite prese come orso.`); C.perdiPV(e, q, 'forma d’orso', { noExtra: true, noDirotta: true }); } else log(`${e.nome} torna uomo.`); }
    if (e.coma) { e.coma = false; e.paralizzato = false; }
    if (e.calderone) delete e.calderone;
    if (e.pv > 0 && e.stato === 'ok' && oggetto(e, /pipa incantata/i)) { e.pv = Math.min(e.pvMax, e.pv + 1); log(`${e.nome}: la pipa incantata del nano guarisce 1 PV.`); }
  }
  for (const e of S.party.eroi.filter(x => x.png === 'evocato')) { S.party.eroi = S.party.eroi.filter(x => x.id !== e.id); S.party.ordine = S.party.ordine.filter(id => id !== e.id); log('La bestia evocata scompare a fine incontro.'); }
  if (i?.sv?.calderone && i.stato === 'finito' && ['sconfitti', 'fuga'].includes(i.esito)) restituisciSequestro();
  if (adv()?.silvani?.clima) adv().silvani.clima = false;
  modificato('party');
}
/** Dopo una vittoria o una fuga dei mostri: sottomissione, desiderio del genio, rospi, catturati, acqua fertile. */
export async function vittoria(i, esito) {
  if (i.sv?.calderone && ['sconfitti', 'fuga'].includes(esito)) { restituisciSequestro(); adv().coda = (adv().coda || []).filter(c => !c.rospoDi); }
  if (i.rospoDi) { const e = eroePerId(i.rospoDi); if (e && esito === 'sconfitti') { e.stato = 'morto'; e.rospo = false; log(`${e.nome}, trasformato in rospo, è stato ucciso.`); } }
  if (i.sv?.sottomettibile && !i.minore && (i.sottomettere || i.sedato || i.enigmaRisolto) && ['sconfitti'].includes(esito)) await sottometti(i);
  if (i.sv?.fugaSottomesso && esito === 'fuga') await desiderioGenio(i);
  if (i.id === 's-sfinge' && i.enigmaRisolto) await sottometti(i);
}
/** Un maggiore sottomesso diventa cavalcatura (o si vende a 5 p.o. per livello). */
async function sottometti(i) {
  const k = await scelta(`${i.nome} sottomesso`, `Dopo 10 minuti recupera metà dei PV. Ogni personaggio (tranne il signore delle bestie) controlla al massimo 1 mostro sottomesso.`, [['cav', 'Tienilo come cavalcatura'], ['vendi', `Vendilo (${5 * i.livBase} p.o.)`], [null, 'Lascialo andare']]);
  if (k === 'vendi') { bottino({ tipo: 'oro', testo: `${5 * i.livBase} pezzi d’oro (${i.nome} venduto a un mago o a un gladiatore)`, valore: 5 * i.livBase }); return; }
  if (k !== 'cav') return;
  const cand = eroiVivi().filter(e => e.stato === 'ok' && !e.png && !e.cavalcatura); if (!cand.length) { toast('Nessun personaggio senza cavalcatura.', 'warn'); return; }
  const e = cand.length === 1 ? cand[0] : eroePerId(await scelta('Chi lo cavalca?', 'Un solo cavaliere (2 mezzuomini contano come 1; gli unicorni solo donzelle vergini).', cand.map(x => [x.id, x.nome])));
  if (!e) return;
  e.cavalcatura = { id: `sottomesso-${i.id}`, nome: `${i.nome.replace(/ \(erranti\)$/, '')} (sottomesso)`, liv: i.livBase, pv: Math.floor(i.pvMax / 2), pvMax: i.pvMax, carico: 2, volante: (i.tag || []).includes('volante'), combatte: true };
  log(`${e.nome} cavalca ${e.cavalcatura.nome}.`); modificato('party');
}
async function desiderioGenio(i) {
  const e = await K.eroeScelto('Il genio fugge ed è considerato sottomesso: chi esprime il desiderio minore?', x => x.stato === 'ok' && !x.png); if (!e) return;
  const k = await scelta('Desiderio minore', `${i.nome} concede 1 desiderio minore.`, [['fortuna', 'Un uso di un punto fortuna (come il mezzuomo)'], ['tesoro', 'Un tesoro o equipaggiamento non magico fino a 100 p.o.'], ['pergamena', 'Una pergamena con un incantesimo a scelta (non avanzato)'], ['ts', '+1 permanente a uno specifico tiro salvezza']]);
  if (k === 'fortuna') { e.fortunaExtra = (e.fortunaExtra || 0) + 1; log(`${e.nome} ottiene 1 punto fortuna.`); }
  else if (k === 'tesoro') bottino(await oggettoBase(100));
  else if (k === 'pergamena') { const nome = await scelta('Pergamena', 'Quale incantesimo?', R.equipaggiamento.incantesimi.filter(s => !s.caos).map(s => [s.nome, s.nome])); if (nome) bottino({ tipo: 'pergamena', testo: `Pergamena: ${nome}`, incantesimo: nome }); }
  else if (k === 'ts') { const t = await scelta('Tiro salvezza', 'Quale tipo?', [['veleno', 'Veleno'], ['paura|terrore|orrore', 'Paura'], ['magi', 'Magia'], ['botola|tagliola|laccio|fossa|trappola', 'Trappole'], ['soffio', 'Soffio'], ['malattia', 'Malattia']]); if (t) { (e.tsPermanenti = e.tsPermanenti || []).push(t); log(`${e.nome}: +1 permanente ai TS contro «${t}».`); } }
  modificato('party');
}
/** Tesori particolari: gemme delle aquile, angelo, lamia, strega, rakshasa. Restituisce 'solo' se la tabella dei tesori non va tirata. */
export async function saccheggioExtra(i) {
  const sv = i.sv; const out = [];
  for (const e of S.party.eroi.filter(x => x.stato === 'prigioniero' && x.venduto)) {   // schiavi venduti a un boss: fanno parte del suo tesoro
    if ((e.venduto === 'boss' && i.tabella === 'boss' && !i.minore) || (i.bossFinale)) { e.venduto = null; e.stato = 'ok'; e.pv = Math.max(1, e.pv); log(`${e.nome}, venduto come schiavo, è fra i beni di ${i.nome}: è libero.`); out.push('liberato'); }
  }
  if (!sv) return null;
  const cubo = n => { for (let k = 0; k < n; k++) bottino({ tipo: 'oggetto', nome: 'Cubo anima', testo: 'Cubo anima (restituisce 1 carica a un oggetto magico; 50 p.o.)', valore: 50 }); };
  if (sv.tesoroFisso?.gemme) {
    const n = (await tira(sv.tesoroFisso.gemme, 'Numero di gemme')).totale, tot = (await tira(sv.tesoroFisso.valoreTotale, 'Valore totale delle gemme')).totale, v = Math.max(1, Math.floor(tot / n));
    for (let k = 0; k < n; k++) bottino({ tipo: 'gemma', testo: `Gemma da ${v} p.o.`, valore: v }); C.nota(`Tesoro: ${n} gemme per ${tot} p.o. in tutto.`); return 'solo';
  }
  if (sv.tesoroFisso?.pergamena) { bottino({ tipo: 'pergamena', testo: `Pergamena: ${sv.tesoroFisso.pergamena}`, incantesimo: sv.tesoroFisso.pergamena }); bottino({ tipo: 'gioiello', testo: `Gioiello da ${sv.tesoroFisso.gioiello} p.o.`, valore: sv.tesoroFisso.gioiello }); C.nota('Tesoro: una pergamena con Benedizione e un gioiello da 30 p.o.'); return 'solo'; }
  if (sv.tesoroExtra) {
    if (sv.tesoroExtra.cuboAnima) cubo(sv.tesoroExtra.cuboAnima);
    if (sv.tesoroExtra.cubiAnima) cubo((await tira(sv.tesoroExtra.cubiAnima, 'Cubi anima')).totale);
    if (sv.tesoroExtra.bomba) bottino({ tipo: 'oggetto', nome: 'Bomba alchemica', testo: 'Bomba alchemica (strano oggetto alchemico: 1 azione, serve fuoco; vale 40 p.o.)', valore: 40 });
    if (sv.tesoroExtra.pergamena === 's-raccolto-abbondante') bottino({ tipo: 'pergamena', testo: 'Pergamena: Raccolto abbondante', incantesimo: 'Raccolto abbondante' });
    if (sv.tesoroExtra.oggettoMagico) { const o = await baseTesoroMagico(); if (o) bottino(o); }
  }
  if (sv.cubi) cubo(sv.cubi);
  if (!i.minore && st().missioni?.some(m => /specchio/.test(m.oggetto || '') && !m.fatta) && (await dado('Specchio d’argento fra i beni del maggiore? (1)')).totale === 1) { bottino({ tipo: 'oggetto', nome: 'Specchio d’argento', testo: 'Specchio d’argento (per le arpie)' }); }
  return null;
}
async function baseTesoroMagico() {
  const tab = R.tabelle.tesoriMagici, k = await scelta('Rakshasa: oggetto magico', 'Scegli un oggetto magico dalla tabella Tesori magici del manuale base.', tab.map((r, n) => [n, r.nome, r.testo?.slice(0, 90)]));
  const row = tab[k ?? 0]; return { tipo: 'magico', nome: row.nome, testo: `${row.nome}: ${row.testo}`, manuale: true };
}
export function fineAvventura(esito) {
  if (!silvaniAttivi() && !S.party.eroi.some(e => e.sequestro || e.cottaFoglia)) return;
  const s = ro();
  for (const e of S.party.eroi) { if (e.orso || e.svanito || e.nascosto || e.vomito || e.apatia) Object.assign(e, { orso: null, svanito: false, nascosto: false, vomito: 0, apatia: false }); delete e.calderone; if (e.sequestro) { const q = e.sequestro; e.armi = q.armi; e.armaPrincipale = q.armaPrincipale; e.armatura = q.armatura; e.scudo = q.scudo; e.oggetti = q.oggetti; delete e.sequestro; e.rospo = false; } }
  for (const e of S.party.eroi) if (e.cottaFoglia > 0) { e.cottaFoglia--; if (!e.cottaFoglia) { e.armatura = 'nessuna'; log(`${e.nome}: la cotta di fogliacciaio si secca e diventa inservibile.`); } }
  if ((s.prigionieri || []).length) log(`Prigionieri al seguito: ${s.prigionieri.map(p => p.nome).join(', ')} (riportali a casa dagli Strumenti per le ricompense).`);
}
export async function inizioAvventura() {
  if (!silvaniAttivi() && !S.party.eroi.some(e => e.anim || e.cavalcatura || e.cottaFoglia || e.orso)) return;   // nessun effetto sugli altri set
  adv().silvani = {};
  for (const e of S.party.eroi) { if (e.orso || e.svanito || e.nascosto || e.vomito || e.apatia || e.mantello) Object.assign(e, { orso: null, svanito: false, nascosto: false, vomito: 0, apatia: false, mantello: false }); delete e.calderone; delete e.furiaNatura; delete e.corteccia; if (e.coma) e.coma = false; }
  S.party.eroi = S.party.eroi.filter(e => e.png !== 'evocato'); S.party.ordine = S.party.ordine.filter(id => eroePerId(id));
  for (const e of S.party.eroi.filter(x => x.anim?.id === 's-ombra-foresta' && !['druido', 'signore-bestie'].includes(eroePerId(x.padroneId)?.classe))) if ((await dado(`${e.nome}: se ne va a inizio avventura? (1)`)).totale === 1) { log(`${e.nome} se ne va.`); S.party.eroi = S.party.eroi.filter(x => x.id !== e.id); S.party.ordine = S.party.ordine.filter(id => id !== e.id); }
  for (const e of S.party.eroi.filter(x => x.saltaAvventura)) { e.saltaAvventura = false; log(`Ricorda: ${e.nome} avrebbe dovuto saltare questa avventura (maestro premuroso): gestiscilo a mano.`); }
  for (const e of S.party.eroi) { if (e.anim) { e.pv = e.pvMax; e.stato = 'ok'; } if (e.cavalcatura) e.cavalcatura.pv = e.cavalcatura.pvMax; }
}

// =============================================================
//  OGGETTI, TESORI E PERGAMENE
// =============================================================
/** Un oggetto del manuale base fino a `max` p.o. (tesoro, desiderio del genio). */
export async function oggettoBase(max = 20) {
  const voci = [...R.equipaggiamento.armi.filter(a => a.costo > 0 && a.costo <= max && !a.suppl).map(a => [a.nome, a.costo]), ...R.equipaggiamento.oggetti.filter(o => o.costo <= max && !['benedizione', 'rituale', 'acqua-santa', 'pozione', 'occhiali'].includes(o.id)).map(o => [o.nome, o.costo])];
  const k = await scelta('Oggetto del manuale base', `Scegli un oggetto del valore massimo di ${max} p.o.:`, voci.map(([n, c]) => [n, n, `${c} p.o.`]));
  const nome = k || voci[0][0]; return { tipo: 'oggetto', nome, testo: nome, valore: voci.find(v => v[0] === nome)?.[1] };
}
export async function pergamenaInutile() {
  const row = riga(D().tabelle.pergameneInutili, (await dado('Pergamena con incantesimo inutile (d6)')).totale);
  return { tipo: 'oggetto', nome: `Pergamena inutile: ${row.nome}`, testo: `Pergamena inutile: ${row.nome} (solo maghi; vale ${row.prezzoVendita} p.o.). ${row.testo}`, valore: row.prezzoVendita, nota: row.testo };
}
/** Pergamena: tipo (mago o druido, 1d6: 1-4 mago, 5-6 druido), lista base o avanzata del druido, poi 1d12. */
export async function generaPergamena() {
  const t = await dado('Pergamena: mago (1-4) o druido (5-6)');
  if (t.totale <= 4) { const lista = tabella('incantesimoCaso'), n = lista.length === 12 ? (await dado('Incantesimo a caso (d6)')).totale + (Math.random() < 0.5 ? 0 : 6) : (await dado('Incantesimo a caso (d6)')).totale, nome = lista[n - 1]; return { tipo: 'pergamena', testo: `Pergamena: ${nome}`, incantesimo: nome }; }
  const l = await dado('Pergamena del druido: lista base (1-4) o avanzata (5-6)'), tab = l.totale <= 4 ? D().tabelle.incantesimiDruidoBase : D().tabelle.incantesimiDruidoAvanzati;
  const a = await dado('Incantesimo del druido (d12, prima metà)'), b = await dado('Incantesimo del druido (d12, seconda metà)'), v = (b.totale <= 3 ? 0 : 6) + a.totale, row = riga(tab, v);
  return { tipo: 'pergamena', testo: `Pergamena del druido: ${row.nome}`, incantesimo: row.nome };
}
/** Tesori magici della selva: i 6 oggetti con effetto automatico dove numerico. */
export async function tesoroMagico() {
  const row = riga(tabella('tesoriMagici'), (await dado('Tesori magici (d6)')).totale);
  const base = { tipo: 'magico', nome: row.nome, testo: `${row.nome}: ${row.testo}`, valore: typeof row.prezzo === 'number' ? row.prezzo : null, manuale: false, abi: row.oggetto };
  if (row.oggetto === 's-cintura-cambio-sesso') return { ...base, cariche: 1, caricheMax: 1, incantesimo: 'Benedizione', valore: (await tira('2d6', 'Valore della cintura')).totale, nome: 'Cintura del cambio di sesso' };
  if (row.oggetto === 's-scarabeo-morte-vivente') return { ...base, manuale: true };
  if (row.oggetto === 's-balsamo-nicodemo') return { ...base, cariche: 1, caricheMax: 1 };
  return base;
}
/** Azioni degli oggetti durante il combattimento: balsamo di Nicodemo, mantello dell'oscurità, bomba, acqua santa sui folletti, occhio grosso, gufo. */
export function azioniCombattimento(e, i, azione, btn) {
  const out = [];
  if (!silvaniAttivi()) return out;
  const balsamo = oggetto(e, /balsamo di nicodemo/i);
  if (balsamo && (i.tag || []).includes('non-morto')) out.push(azione(e, 'Balsamo di Nicodemo (annulla l’immunità alle armi non magiche)', async () => {
    consuma(e, balsamo); i.agito[e.id] = true; const ok = ['mago', 'alchimista'].includes(e.classe) || (await dado('Balsamo di Nicodemo: funziona? (1-2 per chi non è mago o alchimista)')).totale <= 2;
    if (ok) { i.balsamo = true; i.vulnerabileSolo = false; C.nota(`${e.nome} getta il balsamo: l’immunità di ${i.nome} alle armi non magiche è annullata.`); } else C.nota(`${e.nome} getta il balsamo ma non funziona.`); modificato();
  }, 'accent'));
  const bomba = oggetto(e, /^bomba/i);
  if (bomba && !suppl()) out.push(azione(e, 'Lancia la bomba alchemica', () => O.lanciaBomba(e, bomba), 'accent'));   // senza il supplemento del Caos il pulsante non c'è
  const mant = oggetto(e, /mantello dell.oscurit/i);
  if (mant) out.push(btn(`Mantello dell’oscurità: ${e.mantello ? 'togli il cappuccio' : 'indossa (invisibile, +3 difesa; gli altri -2)'}`, () => { e.mantello = !e.mantello; C.nota(e.mantello ? `${e.nome} si copre col cappuccio: ogni luce si spegne, lui vede e ha +3 in difesa, gli altri hanno -2.` : `${e.nome} toglie il cappuccio: le luci tornano.`); modificato('party'); }, e.mantello ? 'accent' : ''));
  const ac = oggetto(e, /acqua santa/i);
  if (ac && i.sv?.acquaSantaUccide) out.push(azione(e, `Acqua santa sui folletti (ne uccide ${i.sv.acquaSantaUccide})`, async () => { consuma(e, ac); i.agito[e.id] = true; C.nota(`${e.nome} getta l’acqua santa: ${i.sv.acquaSantaUccide} folletti muoiono all’istante.`); await C.applicaDanni(i.sv.acquaSantaUccide); }, 'accent'));
  if (i.sv?.occhioGrosso && !i.sv.occhioColpito) out.push(azione(e, 'Colpisci l’occhio grosso (attacco a -3)', async () => {
    i.agito[e.id] = true; const r = await C.d6e(e, `Occhio grosso: attacco di ${e.nome} (-3)`), tot = r.totale + modAttacco(e, C.contestoAttacco(e)).tot - 3;
    if (r.naturale !== 1 && tot >= i.liv) { i.sv.occhioColpito = true; C.nota(`${e.nome} colpisce l’occhio grosso (${tot} contro LIV ${i.liv}): niente danni, ma cade il -2 agli incantesimi e gli attacchi su ogni membro scendono a 1.`); } else C.nota(`${e.nome} manca l’occhio grosso (${tot} contro LIV ${i.liv}).`); modificato();
  }, 'accent'));
  const gufo = S.party.eroi.find(a => a.anim?.id === 's-gufo' && a.padroneId === e.id && a.stato === 'ok');
  if (gufo) out.push(btn(`Gufo: ${gufo.anim.aiuta ? 'attacca' : 'aiuta negli incantesimi (+1)'}`, () => { gufo.anim.aiuta = !gufo.anim.aiuta; C.nota(gufo.anim.aiuta ? `${gufo.nome} aiuta ${e.nome}: +1 ai suoi incantesimi.` : `${gufo.nome} torna ad attaccare.`); modificato('party'); }));
  if (e.classe === 'druido' && i.sv?.sottomettibile === undefined) void 0;
  if (!i.minore && i.sv?.sottomettibile && i.stato === 'combattimento') out.push(btn(i.sottomettere ? 'Smetti di sottomettere' : 'Sottometti il mostro (attacchi a -1; serve una corda)', () => { i.sottomettere = !i.sottomettere; C.nota(i.sottomettere ? `Il gruppo cerca di sottomettere ${i.nome} colpendolo di piatto (-1 all’attacco, senza il -1 con Sottomissione).` : 'Si combatte normalmente.'); modificato(); }));
  return out;
}
/** Poteri e azioni di classe in combattimento (Musica dell'armonia, Animali pacifici). */
export function azioniClasse(e, i, azione) {
  const out = [];
  if (e.culto === 'chierico-elidra') out.push(azione(e, `Musica dell’armonia (${3 - (e.usi.benedizione || 0)})`, () => musicaArmonia(e, i), 'accent', { disabled: (e.usi.benedizione || 0) >= 3 }));
  if (e.culto === 'chierico-korimnos') out.push(azione(e, `Animali pacifici (${3 - (e.usi.benedizione || 0)})`, () => animaliPacifici(e, i), 'accent', { disabled: (e.usi.benedizione || 0) >= 3 }));
  return out;
}
/** Arco della rapidità: nel primo turno una freccia in più. */
export const attacchiExtra = (e, arma) => (inSilvani() || silvaniAttivi()) && arma?.id === 'arco' && (C.inc()?.turno || 1) <= 1 && oggetto(e, /arco della rapidit/i) ? 1 : 0;

// =============================================================
//  REAZIONI: corruzione con risorse, mercanti, missione, cattura
// =============================================================
const conteggioRisorsa = re => {
  const razioni = eroiVivi().reduce((a, e) => a + (e.oggetti || []).filter(o => /razion/i.test(o.nome)).reduce((b, o) => b + (o.qta || 1), 0), 0);
  const gemme = eroiVivi().flatMap(e => (e.oggetti || []).filter(o => o.tipo === 'gemma').flatMap(o => Array.from({ length: o.qta || 1 }, () => [e, o])));
  const gioielli = eroiVivi().flatMap(e => (e.oggetti || []).filter(o => o.tipo === 'gioiello').map(o => [e, o]));
  const magici = eroiVivi().flatMap(e => (e.oggetti || []).filter(o => ['magico', 'arma-magica', 'armatura-magica'].includes(o.tipo)).map(o => [e, o]));
  return { razioni, gemme, gioielli, magici };
};
const togliRazioni = n => { let resto = n; for (const e of eroiVivi()) for (const o of [...(e.oggetti || [])]) { if (!resto) return; if (!/razion/i.test(o.nome)) continue; const k = Math.min(o.qta || 1, resto); resto -= k; if ((o.qta || 1) > k) o.qta -= k; else e.oggetti = e.oggetti.filter(x => x !== o); } };
/** Corruzione pagata con una risorsa diversa dall'oro (razioni di cibo, gemme, gioielli, oggetti magici, cibo magico). */
export function cartaCorruzione(i, btn) {
  const re = i.reazione, ris = re.risorsa || '', p = re.param, tot = re.tipoCorr === 'totale', q = typeof p === 'number' ? (tot ? p : p * i.n) : null, r = conteggioRisorsa();
  const paga = (testo) => { C.nota(`${testo}: ${i.nome} è corrotto.`); C.paga(0, false, true); };
  const chiesto = typeof p !== 'number' ? `${p}` : /gioielli/.test(ris) ? `gioielli per almeno ${p} p.o.` : `${q} ${ris || 'p.o.'}${tot ? ' in tutto' : ` (${p} a mostro)`}`;
  const out = [h('p', {}, `${i.nome} chiede ${chiesto}.`)];
  if (/razion/.test(ris)) out.push(btn(`Cedi ${q} razioni di cibo (hai ${r.razioni})`, () => { togliRazioni(q); paga(`Cedute ${q} razioni`); modificato('party'); }, 'primary', { disabled: r.razioni < q }));
  else if (/^gemma/.test(ris)) out.push(btn(`Cedi ${q} gemm${q === 1 ? 'a' : 'e'} (hai ${r.gemme.length})`, () => { const s = [...r.gemme].sort((a, b) => a[1].valore - b[1].valore).slice(0, q); for (const [e, o] of s) consuma(e, o); paga(`Cedute ${q} gemme`); modificato('party'); }, 'primary', { disabled: r.gemme.length < q }));
  else if (/gioielli/.test(ris)) { const min = typeof p === 'number' ? p : 100, ord = [...r.gioielli].sort((a, b) => a[1].valore - b[1].valore); let somma = 0; const sc = []; const unico = ord.find(g => g[1].valore >= min); if (unico) { sc.push(unico); somma = unico[1].valore; } else for (const g of ord.reverse()) { if (somma >= min) break; sc.push(g); somma += g[1].valore; }
    out.push(btn(`Cedi gioielli per almeno ${min} p.o. (hai ${r.gioielli.reduce((a, g) => a + g[1].valore, 0)} p.o. in gioielli)`, () => { for (const [e, o] of sc) consuma(e, o); paga(`Ceduti gioielli per ${somma} p.o.`); modificato('party'); }, 'primary', { disabled: somma < min })); }
  else if (/oggetti magici/.test(`${p} ${ris}`)) out.push(btn(`Cedi tutti gli oggetti magici del gruppo (${r.magici.length})`, async () => { if (!(await confirmBox('Cedere TUTTI gli oggetti magici del gruppo (anche armi e armature magiche)?'))) return; for (const [e, o] of r.magici) consuma(e, o); eroiVivi().forEach(e => { e.bonusMagico = 0; e.bonusDifesa = 0; e.scudoMagico = false; }); paga('Ceduti tutti gli oggetti magici'); modificato('party'); }, 'primary'));
  else if (/cibo magico/.test(`${p}`)) out.push(btn('Offri un cibo magico (da gestire a mano)', () => { paga('Offerto un cibo magico'); }, 'primary'));
  else if (typeof p === 'number') out.push(btn(`Paga ${q} p.o.`, () => C.paga(q), 'primary', { disabled: q > C.oroTotale() }));
  out.push(btn('Rifiuta e combatti', () => C.rifiutaCorruzione(), 'danger'));
  return h('div', { class: 'card' }, h('h4', {}, 'I mostri chiedono una tangente'), ...out);
}
/** Reazione Mercanti: come Pacifico; vendono oggetti non magici sotto 101 p.o. (e pozioni, gli uomini gufo). */
export function cartaMercanti(i, btn) {
  const pozioni = i.sv?.pozioni || 0;
  return h('div', { class: 'card' }, h('h4', {}, `${i.nome}: mercanti`), h('p', {}, `${i.nome} è pacifico e vende oggetti non magici e non viventi di valore inferiore a 101 p.o.${pozioni ? ` Hanno anche ${pozioni} pozion${pozioni === 1 ? 'e' : 'i'} (fino a 100 p.o.).` : ''}`),
    h('div', { class: 'row wrap' }, btn('Compra dai mercanti', () => negozioMercanti(i), 'primary'), btn('Attacca', () => { i.mostriPrima = true; return C.inizioScontro(); }, 'danger'), btn('Chiudi (se ne vanno)', () => C.chiudiIncontro())));
}
function negozioMercanti(i) {
  modal(`Mercanti: ${i.nome}`, (b, close) => {
    const sel = h('select', {}, eroiVivi().filter(e => !e.png).map(e => h('option', { value: e.id }, `${e.nome} (${e.oro || 0} p.o.)`)));
    const voci = [...R.equipaggiamento.armi.filter(a => a.costo > 0 && a.costo < 101 && !a.fuoco).map(a => ({ nome: a.nome, costo: a.costo, arma: a.id })), ...R.equipaggiamento.oggetti.filter(o => o.costo < 101 && !['benedizione', 'rituale', 'acqua-santa', 'pozione'].includes(o.id)).map(o => ({ nome: o.nome, costo: o.costo, id: o.id })), ...D().oggetti.filter(o => o.categoria === 'equipaggiamento' && o.prezzo && o.prezzo < 101 && o.id !== 's-razione-cibo').map(o => ({ nome: o.nome.split(' (')[0], costo: o.prezzo }))];
    const lista = h('div', { class: 'shop' }), compra = (v) => {
      const e = eroePerId(sel.value); if (!e) return; if (v.costo > oroGruppo(e)) return toast('Oro insufficiente.', 'warn');
      pagaGruppo(e, v.costo); if (v.arma) { (e.armi = e.armi || []).push(v.arma); if (!e.armaPrincipale) e.armaPrincipale = v.arma; } else if (v.pozione) i.sv.pozioni--; else { const ex = (e.oggetti = e.oggetti || []).find(o => o.nome === v.nome); if (ex) ex.qta = (ex.qta || 1) + 1; else e.oggetti.push({ nome: v.nome, qta: 1 }); }
      log(`${e.nome} compra ${v.nome} da ${i.nome} per ${v.costo} p.o.`); modificato('party'); close();
    };
    if (i.sv?.pozioni > 0) voci.unshift({ nome: 'Pozione di guarigione', costo: 100, pozione: true });
    voci.forEach(v => lista.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, v.nome), h('span', { class: 'price' }, `${v.costo} p.o.`), h('button', { onclick: () => compra(v) }, 'Compra'))));
    b.append(h('label', {}, 'Acquirente', sel), lista, h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: close }, 'Chiudi')));
  }, { wide: true });
}
/** Accettare la missione fissa di un mostro («Portatemelo!», «Lo voglio vivo!»…). */
export function accettaMissione(i) {
  const m = i.sv?.missione; const nome = m?.nome; if (!nome) return false;
  (st().missioni = st().missioni || []).push({ id: uid(), nome, da: i.nome, oggetto: m.oggetto || null, fatta: false }); i.missione = nome;
  C.nota(`Missione accettata da ${i.nome}: «${nome}»${m.oggetto ? ` (${m.oggetto})` : ''}. Completala dagli Strumenti (ricompensa epica, 1 tiro ES e il mostro conta come sconfitto).`); modificato(); return true;
}
/** Un eroe ridotto a 0 PV da un mostro con reazione Cattura viene catturato; un mostro fugge con lui. Restituisce true se la morte è evitata. */
export function catturato(e, causa) {
  const i = C.inc(); if (!i || !i.cattura || i.stato === 'finito' || causa !== i.nome || e.anim || e.png) return false;
  e.pv = 0; e.stato = 'prigioniero'; e.catturatoDa = { nome: i.nome, tabella: i.tabella, voce: i.id, n: i.minore ? i.nIniziale : 1 };
  const sq = { armi: e.armi, armaPrincipale: e.armaPrincipale, armatura: e.armatura, scudo: e.scudo, oggetti: e.oggetti, oro: e.oro }; e.venduto = null;
  e.armi = []; e.armaPrincipale = null; e.armatura = 'nessuna'; e.scudo = false; e.oggetti = []; e.oro = 0; void sq;
  const s = st(); s.catturatori = { tabella: i.tabella, voce: i.id, nome: i.nome, n: i.minore ? i.nIniziale : 1 };
  C.nota(`${e.nome} è catturato da ${i.nome}: incatenato, spogliato e portato in un rifugio segreto (servono 3 indizi per trovarlo: Strumenti).`);
  if (i.minore) { i.n = Math.max(0, i.n - 1); C.nota('Un mostro fugge con il prigioniero, senza poter essere attaccato; gli altri continuano a catturare.'); if (i.n === 0) setTimeout(() => C.applicaDanni(0), 0); }
  else { i.stato = 'finito'; i.esito = 'fuga'; i.tesoroPreso = true; C.nota(`${i.nome} fugge con il prigioniero.`); }
  return true;
}
const catturati = () => S.party.eroi.filter(e => e.stato === 'prigioniero' && e.catturatoDa);
/** Rifugio segreto dei catturati: guardiani doppi, altri prigionieri, sorte di ogni catturato sul Recinto degli schiavi. */
async function scopriRifugio() {
  const s = st(), ind = eroiVivi().reduce((a, e) => a + (e.indizi || 0), 0);
  if (ind < 3 && !(await confirmBox(`Hai solo ${ind} indizi (ne servono 3 per il segreto «Qualcuno è stato imprigionato»). Procedere comunque?`))) return;
  let resto = 3; for (const e of eroiVivi()) { const k = Math.min(e.indizi || 0, resto); e.indizi = (e.indizi || 0) - k; resto -= k; }
  const a = (await tira('1d6', 'Rifugio: lato A (2d6)')).totale, b = (await tira('1d6', 'Rifugio: lato B')).totale, altri = (await tira('3d6', 'Altri prigionieri (LIV 0, 1 PV)')).totale;
  const c = s.catturatori || { n: 4 }; s.rifugio = { dim: `2d6×2d6`, guardiani: c, altri, stato: 'scoperto' };
  log(`Rifugio dei catturati scoperto: complesso sotterraneo di 2d6×2d6 quadretti vicino a qui, sorvegliato da ${c.n * 2} ${c.nome || 'creature'} (il doppio); ${altri} altri prigionieri di livello 0 con 1 PV, uno dei quali pittoresco.`); void a; void b; modificato();
}
async function guardiani() {
  const s = st(), c = s.rifugio?.guardiani; if (!c?.voce) return toast('Mostri sconosciuti: crea l’incontro a mano.', 'warn');
  const voce = [...D().mostri.infestanti, ...D().mostri.seguaci, ...D().mostri.aberranti, ...D().mostri.boss].find(m => m.id === c.voce) || [...R.mostri.infestanti, ...R.mostri.seguaci].find(m => m.id === c.voce);
  if (!voce) return toast('Mostro non trovato.', 'warn');
  const inc = creaIncontro(c.tabella, voce, c.n * 2, { pvExtra: scala(), livExtra: scala() }); inc.tessera = adv().stanzaCorrente; if (voce.id.startsWith('s-')) { inc.sv = poteriMostro(voce); await postCrea(inc, voce); }
  G.avviaIncontro(inc, G.tileById(adv().stanzaCorrente)); s.rifugio.stato = 'guardiani';
}
async function liberaPrigionieri() {
  const s = st(), lista = catturati(); if (!lista.length) return toast('Nessun catturato.', 'warn');
  for (const e of lista) {
    const r = await tira('2d6', `Sorte di ${e.nome} (2d6 + livello ${e.livello})`), v = r.totale + e.livello, row = riga(D().tabelle.recintoSchiavi, v);
    let tx = `${e.nome} (2d6+${e.livello} = ${v}): ${row.nome}.`;
    if (row.azione === 'morto-o-mangiato') { const m = (await dado('Ucciso (1-3) o mangiato (4-6)')).totale >= 4; e.stato = 'morto'; if (m) e.nonResuscitabile = true; tx += m ? ' Mangiato: non può essere resuscitato.' : ' Ucciso.'; }
    else if (row.azione === 'comprabile') {
      const costo = e.livello > 0 ? (await tira(`${e.livello * 2}d6`, `Mazzetta (2d6 p.o. per livello)`)).totale : (await tira('1d6', 'Mazzetta (livello 0)')).totale;
      if (oroGruppo(e) >= costo && await confirmBox(`Pagare ${costo} p.o. di mazzetta per liberare ${e.nome}?`)) { pagaGruppo(e, costo); e.stato = 'ok'; e.pv = (await tira('1d3', 'PV')).totale; e.catturatoDa = null; tx += ` Comprato per ${costo} p.o., con ${e.pv} PV.`; } else tx += ` Mazzetta ${costo} p.o.: resta prigioniero.`;
    } else { e.venduto = row.azione === 'venduto-boss' ? 'boss' : 'finale'; e.pv = 1; tx += ` Fa parte del tesoro del prossimo ${row.azione === 'venduto-boss' ? 'boss' : 'boss finale'}.`; }
    log(tx);
  }
  if (s.rifugio) { const p = riga(D().tabelle.prigionieri, (await d66('Prigioniero pittoresco (d66)')).totale); log(`Prigioniero pittoresco: ${p.nome} – ${p.testo}`); s.rifugio = null; }
  modificato('party');
}

// =============================================================
//  STRUMENTI DELLA SELVA (azioni guidate: tirano e scrivono l'esito nel registro)
// =============================================================
/** Nuotare: per ogni quadretto un tiro (L3) o -1 PV; armatura e scudo penalizzano, barbari e spadaccini nuotano da soli. */
async function nuotare() {
  const n = await scelta('Nuotare', 'Quanti quadretti di corso d’acqua si attraversano a nuoto? (volando o con un ponte non serve)', [1, 2, 3, 4, 5, 6, 8, 10].map(k => [k, `${k} quadretti`])); if (!n) return;
  for (const e of eroiVivi().filter(x => x.stato === 'ok' && !x.png)) {
    if (['barbaro', 'spadaccino'].includes(e.classe) || haAbilita(e, 'nuotare') || haAbilita(e, 'p-nuotatore')) { log(`${e.nome} nuota senza tirare.`); continue; }
    const mod = (e.armatura === 'pesante' && !(e.cottaFoglia > 0) ? -2 : e.armatura === 'leggera' ? -1 : 0) + (e.scudo ? -1 : 0) + (['elfo', 'elfo-silvano', 'mezzuomo', 'nano'].includes(e.classe) ? -1 : 0);
    let persi = 0; for (let k = 0; k < n && e.stato === 'ok'; k++) if (!(await C.salva(e, 3, mod, 'Nuotare'))) { persi++; C.perdiPV(e, 1, 'nuotare'); }
    log(`${e.nome} attraversa ${n} quadretti a nuoto (modificatore ${mod}): ${persi} PV persi.`);
  }
  modificato('party');
}
/** Abbattere alberi: 20 minuti (2 tiri erranti) per quadretto; con un'ascia 10 minuti (1 tiro). */
async function abbattiAlberi() {
  const n = await scelta('Abbattere alberi', 'Quanti quadretti di alberi vuoi abbattere?', [1, 2, 3, 4, 5].map(k => [k, `${k} quadretti`])); if (!n) return;
  const asce = await confirmBox('C’è un’ascia nel gruppo? (10 minuti e 1 solo tiro per quadretto invece di 20 minuti e 2 tiri)');
  for (let k = 1; k <= n; k++) for (let t = 0; t < (asce ? 1 : 2); t++) {
    const x = await dado(`Abbattere alberi, quadretto ${k}/${n}: mostri erranti? (1)`);
    if (x.totale <= 1) { const m = await G.monstroErrante(); log(`Il rumore attira mostri erranti mentre si abbattono gli alberi (quadretto ${k}).`); G.avviaIncontro(m, G.tileById(adv().stanzaCorrente)); return; }
  }
  log(`${n} quadretti di alberi abbattuti${asce ? ' con un’ascia' : ''}: ora si può passare tra le aree.`); modificato();
}
async function attraversaIncendio(tid) {
  const s = st(), t = G.tileById(tid);
  for (const e of eroiVivi().filter(x => x.stato === 'ok')) if (!(await C.salva(e, 5, 0, 'Incendio (soffio del drago)'))) C.perdiPV(e, 2, 'incendio'); else C.perdiPV(e, 1, 'incendio');
  const x = await dado('L’incendio si propaga a un’area adiacente? (1)');
  if (x.totale <= 1) {
    const vic = (adv().tessere || []).filter(a => !a.pending && a.id !== tid && !s.incendi[a.id] && vicina(t, a));
    if (vic.length) { const a = casuale(vic); s.incendi[a.id] = true; log(`L’incendio si propaga all’area ${a.nome}.`); } else log('L’incendio non ha aree adiacenti in cui propagarsi.');
  }
  modificato();
}
const vicina = (a, b) => { try { return !!a && !!b && !!table.vicine(a, b); } catch { return false; } };
async function distruggiPonte(tid, metodo) {
  const s = st(), p = s.ponti?.[tid]; if (!p) return;
  p.distrutto = true; const t = G.tileById(tid); log(`Il ponte di ${p.tipo} (${t?.nome}) viene distrutto con ${metodo}.`);
  if (p.tipo === 'legno' && p.alberi && /fuoco|fulmine/i.test(metodo)) { const x = await dado('Il ponte brucia vicino agli alberi: incendio? (1-2)'); if (x.totale <= 2) { (s.incendi = s.incendi || {})[tid] = true; log('Scoppia un incendio nell’area del ponte.'); } }
  const i = comb(); if (i && i.tessera === tid && !(i.tag || []).includes('volante') && !(i.tag || []).includes('acquatico')) C.sottrarsiIndenne('ponte distrutto');
  modificato();
}
async function ponteTool(tid) {
  const p = st().ponti[tid], t = G.tileById(tid);
  const opz = p.tipo === 'legno' ? [['Frantuma legno', 'Frantuma legno'], ['Fulmine magico', 'Fulmine magico'], ['Palla di fuoco', 'Palla di fuoco']] : [['una bomba', 'Bomba alchemica'], ['un desiderio', 'Desiderio']];
  const k = await scelta(`Ponte di ${p.tipo}: ${t?.nome}`, p.tipo === 'pietra' ? 'Il ponte di pietra non cede agli incantesimi fino al 9° livello: solo bomba o desiderio.' : 'Distruggilo per fuggire senza essere attaccato (non contro volanti o acquatici).', opz); if (k) await distruggiPonte(tid, k);
}
async function pozzo(t) {
  t.pozzoBevute = t.pozzoBevute || [];
  const tipo = t.pozzoTipo || null;
  modal(`Pozzo (${t.nome})`, (b, close) => {
    b.append(h('p', { class: 'hint' }, 'Il gruppo decide prima del tiro se bere. 1d6: 1 avvelenato (TS veleno L3 o -1d3 PV), 2-3 normale, 4-6 rigenerante (+1 PV). Ogni personaggio, alleato o cavalcatura beve una sola volta.'));
    S.party.eroi.filter(e => e.stato !== 'morto').forEach(e => b.append(h('button', { class: 'item-btn', disabled: t.pozzoBevute.includes(e.id), onclick: async () => {
      if (!t.pozzoTipo) { const x = await dado('Pozzo: 1 avvelenato, 2-3 normale, 4-6 rigenerante'), r = riga(D().tabelle.pozzo, x.totale); t.pozzoTipo = r.effetto; log(`Pozzo: ${r.nome}.`); }
      t.pozzoBevute.push(e.id);
      if (t.pozzoTipo === 'veleno') { if (!(await C.salva(e, 3, 0, 'Pozzo avvelenato (veleno)'))) C.perdiPV(e, (await tira('1d3', 'PV persi')).totale, 'pozzo avvelenato'); else log(`${e.nome} beve senza danni.`); }
      else if (t.pozzoTipo === 'cura') { e.pv = Math.min(e.pvMax, e.pv + 1); log(`${e.nome} beve dal pozzo rigenerante: +1 PV.`); } else log(`${e.nome} beve dal pozzo: nessun effetto.`);
      modificato('party'); close(); } }, h('b', {}, e.nome), h('span', {}, t.pozzoBevute.includes(e.id) ? 'ha già bevuto' : `${e.pv}/${e.pvMax} PV`))));
    b.append(h('div', { class: 'row end' }, h('button', { onclick: close }, 'Chiudi')));
  });
  void tipo;
}
async function fogliacciaio(e) {
  const x = await dado(`Cespuglio di fogliacciaio nell’area? (${e.nome}: 1)`);
  if (x.totale > 1) return log('Nessun cespuglio di fogliacciaio in quest’area.');
  const grande = await confirmBox('Si fabbrica una cotta per una creatura grande come un troll o un ogre? (6 ore invece di 4)');
  e.armatura = 'pesante'; e.cottaFoglia = 2; log(`${e.nome} fabbrica una cotta di fogliacciaio in ${grande ? 6 : 4} ore: vale come armatura pesante (+2 difesa) senza penalità, per 2 avventure.`);
  const y = await dado('Raccogliere le foglie attira mostri erranti? (1-2)');
  if (y.totale <= 2) { const m = await G.monstroErrante(); log('Mostri erranti delle terre selvagge attirati dalla raccolta.'); G.avviaIncontro(m, G.tileById(adv().stanzaCorrente)); }
  modificato('party');
}
async function localizzaTesoro() {
  const s = st(), vanga = eroiVivi().some(e => oggetto(e, /vanga/i)), serve = vanga ? 2 : 3;
  if ((s.indiziTesoro || 0) < serve) return toast(`Servono ${serve} indizi della mappa del tesoro${vanga ? ' (con la vanga)' : ' (2 con una vanga da 4 p.o.)'}: ne hai ${s.indiziTesoro || 0}.`, 'warn');
  s.indiziTesoro -= serve; const t = G.tileById(adv().stanzaCorrente); await G.tesoroNascosto(t); modificato();
}
async function scarabeo(e, o) {
  const cand = eroiVivi().filter(x => x.stato === 'ok' && !x.png); const t = casuale(cand);
  C.nota?.(`Lo scarabeo della morte vivente è toccato da ${t.nome} (scelto a caso).`);
  if (!(await C.salva(t, 6, t.classe === 'negromante' ? t.livello : 0, 'Scarabeo della morte vivente (magia)'))) { log(`${t.nome} muore toccando lo scarabeo (appuntato su un morto lo rialzerebbe come non-morto senziente).`); C.perdiPV(t, t.pv, 'scarabeo della morte vivente', { noExtra: true }); } else log(`${t.nome} resiste allo scarabeo.`);
  void e; void o; modificato('party');
}
/** Carta «Labirinti Silvani» degli Strumenti. */
export function carta(btn) {
  if (!silvaniAttivi()) return null;
  const s = st(), out = [], t = G.tileById(adv().stanzaCorrente);
  if (adv().attiva) {
    out.push(btn('Nuotare (attraversa un corso d’acqua)', nuotare), btn('Abbattere alberi', abbattiAlberi));
    out.push(h('label', { class: 'chk', title: 'Dungeon a cielo aperto: si tira 1d3 invece di 1d6 sulle tabelle dei mostri (solo volanti)' }, h('input', { type: 'checkbox', checked: !!s.cielo, onchange: ev => { s.cielo = ev.target.checked; modificato(); } }), 'Dungeon a cielo aperto (solo mostri volanti, 1d3)'));
    for (const [id, p] of Object.entries(s.ponti || {})) { const tt = G.tileById(id); if (!p.distrutto) out.push(btn(`Ponte di ${p.tipo} (${tt?.nome || id}): distruggi`, () => ponteTool(id))); }
    for (const id of Object.keys(s.incendi || {})) out.push(btn(`Attraversa l’area in fiamme (${G.tileById(id)?.nome || id})`, () => attraversaIncendio(id), 'danger'));
    if (t?.pozzo) out.push(btn(`Bevi dal pozzo (${t.nome})`, () => pozzo(t)));
    if ((s.indiziTesoro || 0) > 0) out.push(btn(`Localizza il tesoro segreto (${s.indiziTesoro} indizi)`, localizzaTesoro));
    for (const e of eroiVivi().filter(x => x.classe === 'elfo-silvano' && x.stato === 'ok')) out.push(btn(`Cespuglio di fogliacciaio (${e.nome})`, () => fogliacciaio(e)));
    for (const e of eroiVivi().filter(x => x.classe === 'guida-terre-selvagge' && x.stato === 'ok')) { const u = e.usi.ripeti || 0, max = 2 * e.livello; out.push(btn(`Ripeti un tiro nelle terre selvagge (${e.nome}: ${max - u}/${max})`, () => { e.usi.ripeti = u + 1; log(`${e.nome} (guida) ripete un tiro su una tabella dell’ambiente selvaggio (ripetilo a mano; non vale nei dungeon).`); modificato('party'); }, '', { disabled: u >= max })); }
    for (const e of eroiVivi()) { const sc = oggetto(e, /scarabeo della morte/i); if (sc) out.push(btn(`Scarabeo della morte vivente (${e.nome}): qualcuno lo tocca`, () => scarabeo(e, sc))); }
    if (s.benedizioniPrigioniero > 0) out.push(btn(`Chierico gioviale: Benedizione (${s.benedizioniPrigioniero})`, async () => { const b = await K.eroeScelto('Chi riceve la Benedizione?', x => x.stato !== 'morto'); if (!b) return; s.benedizioniPrigioniero--; Object.assign(b, { maledetto: false, malattia: false, sfortuna: 0 }); if (b.stato === 'pietra') b.stato = 'ok'; cura(b, 'benedizione'); log(`Il chierico gioviale benedice ${b.nome}.`); modificato('party'); }));
  }
  for (const m of (s.missioni || []).filter(x => !x.fatta)) out.push(btn(`Missione compiuta: «${m.nome}» (${m.da})`, () => missioneCompiuta(m), 'accent'));
  if ((s.prigionieri || []).length) out.push(btn(`Riporta i prigionieri in salvo (${s.prigionieri.map(p => p.nome).join(', ')})`, riportaACasa, 'accent'));
  if (catturati().length) {
    out.push(h('p', { class: 'hint' }, `Catturati: ${catturati().map(e => e.nome).join(', ')}.${s.rifugio ? ` Rifugio: ${s.rifugio.guardiani.n * 2} guardiani, ${s.rifugio.altri} altri prigionieri.` : ' Servono 3 indizi per trovare il rifugio.'}`),
      btn('Scopri il rifugio (3 indizi)', scopriRifugio, '', { disabled: !!s.rifugio }), btn('Affronta i guardiani del rifugio', guardiani, 'danger', { disabled: !s.rifugio }), btn('Libera i prigionieri (sorte di ciascun catturato)', liberaPrigionieri, 'accent', { disabled: !s.rifugio && !adv().incontro }));
  }
  if (!out.length) return null;
  return h('div', { class: 'card' }, h('h3', {}, 'Labirinti Silvani'), h('div', { class: 'tools' }, ...out), h('small', { class: 'hint' }, 'Movimento su mappa, aree e quadretti non sono modellati: queste azioni tirano per te e scrivono l’esito nel registro.'));
}

/** Benedizione dell'angelo della luce quando offre cibo e bevande: tutto il gruppo è benedetto. */
export async function benedizioneAngelo() {
  eroiVivi().forEach(b => { Object.assign(b, { maledetto: false, malattia: false, sfortuna: 0 }); if (b.stato === 'pietra' && !b.rospo) b.stato = 'ok'; cura(b, 'benedizione'); });
  C.nota('L’angelo della luce benedice il gruppo (Benedizione su tutti).'); modificato('party');
}

// ---- tiri ES: incantesimi avanzati del druido, compagni animali e cavalcature ----
/** Voci aggiuntive per la scelta della posta del tiro ES. */
export function postaExtra(e) {
  if (!silvaniAttivi() || e.png) return [];
  const o = [];
  if (e.classe === 'druido' && e.livello >= 5 && avanzatiDisponibili(e).length) o.push(['silv:druido', 'Imparare un incantesimo avanzato del druido', `${avanzatiDisponibili(e).length} disponibili`]);
  if (animaliDi(e).some(a => a.anim.liv < e.livello)) o.push(['silv:promozione', 'Aumentare il livello di un compagno animale', '+1 livello, +1 PV, +1 attacco o difesa']);
  if (e.livello >= 5 && e.cavalcatura?.combatte) o.push(['silv:cavalcatura', 'Trasformare la cavalcatura in compagno animale', '+1/2L ad attacco e difesa, 1 attacco per turno']);
  return o;
}
export async function risolviPosta(e, k) {
  if (k === 'silv:druido') { const n = await scelta('Incantesimo avanzato', 'Quale incantesimo vuoi imparare?', avanzatiDisponibili(e).map(x => [x, x, descrizioneIncantesimo(x).slice(0, 120)])); return n ? { tipo: 'incantesimo-druido', nome: n } : null; }
  if (k === 'silv:promozione') { const a = animaliDi(e).filter(x => x.anim.liv < e.livello); const id = a.length === 1 ? a[0].id : await scelta('Compagno animale', 'Quale compagno sale di livello?', a.map(x => [x.id, x.nome])); return id ? { tipo: 'promozione-compagno', animaleId: id } : null; }
  if (k === 'silv:cavalcatura') return { tipo: 'cavalcatura-compagno' };
  return null;
}
/** Scelta della posta del tiro ES senza «Contro l'Abisso»: livello, promozione di un compagno, cavalcatura. */
export async function sceltaPostaES(e, puoSalire = true) {
  const opz = [...(puoSalire ? [['livello', 'Salire di livello', `${e.livello}° → ${e.livello + 1}°`]] : []), ...postaExtra(e).filter(x => x[0] !== 'silv:druido')];
  if (!opz.length) { toast('Nessuna scelta possibile con questo tiro.', 'warn'); return null; }
  if (opz.length === 1 && opz[0][0] === 'livello') return { tipo: 'livello' };
  const k = await scelta(`Tiro ES di ${e.nome}`, 'Che cosa tenti con questo tiro? (la scelta si fa prima di tirare)', opz);
  if (!k) return null; return k === 'livello' ? { tipo: 'livello' } : await risolviPosta(e, k);
}
export const haPoste = e => postaExtra(e).length > 0;
/** Classi che possono imparare un'abilità (nomi di «Contro l'Abisso») e abilità Nuotare. */
export const classiAbilita = nome => Object.entries(D().abilitaPerClasse).filter(([, l]) => l.includes(nome)).map(([c]) => c);
export const abilitaNuotare = () => ({ id: 'nuotare', nome: 'Nuotare', classi: Object.keys(R.classi), testo: 'Abilità avanzata per le classi che non nuotano da sole: dà accesso al tiro di nuotare (L3).' });
/** Etichette di stato nella scheda compatta del gruppo. */
export function statiSilvani(e) {
  const t = [];
  if (e.orso) t.push(['Orso', 'green', `Forma d’orso: ${e.orso.subite}/${e.orso.pvMax} ferite`]);
  if (e.nascosto) t.push(['Nascosto', 'green', 'Attaccato solo se è l’ultimo in piedi']);
  if (e.calderone) t.push(['Nel calderone', 'red', 'Non attacca; -1 PV a turno']);
  if (e.rospo) t.push(['Rospo', 'red', 'Una Benedizione o la morte della strega lo riportano normale']);
  if (e.coma) t.push(['In coma', 'red', 'Fino a fine combattimento']);
  if (e.apatia) t.push(['Apatico', 'red', '-1 agli attacchi (pozione di guarigione o Benedizione)']);
  if (e.mantello) t.push(['Mantello', 'amber', 'Mantello dell’oscurità indossato']);
  if (e.cavalcatura) t.push([e.cavalcatura.nome, 'amber', 'Cavalcatura']);
  if (e.cottaFoglia > 0) t.push([`Cotta ${e.cottaFoglia}`, 'green', 'Cotta di fogliacciaio (avventure rimaste)']);
  if (e.livelloLamia) t.push([`Lamia -${e.livelloLamia}`, 'red', 'Livelli persi finché non riceve una Benedizione']);
  if (e.png === 'animale') t.push(['Compagno animale', 'amber', e.note || '']);
  if (e.stato === 'prigioniero' && e.catturatoDa) t.push(['Catturato', 'red', `Catturato da ${e.catturatoDa.nome}: serve trovare il rifugio`]);
  return t;
}

/** Armi vietate alle classi silvane (druido: leggere e da lancio; guida: leggere e fionda; elfo silvano: niente due mani; signore delle bestie: niente armi da fuoco). */
export function armaVietata(e, a) {
  if (e.anim) return 'Gli animali non usano armi.';
  const leggera = a.categoria === 'leggera';
  if (e.classe === 'druido' && !(leggera || ['fionda', 'arco-corto', 'giavellotto'].includes(a.id))) return `${a.nome}: il druido usa solo armi leggere e da lancio (arco corto, fionda, giavellotto).`;
  if (e.classe === 'guida-terre-selvagge' && !(leggera || a.id === 'fionda')) return `${a.nome}: la guida usa solo armi leggere e la fionda.`;
  if (e.classe === 'elfo-silvano' && !(leggera || a.categoria === 'una-mano' || ['arco', 'balestra', 'bolas', 'boomerang'].includes(a.id))) return `${a.nome}: l’elfo silvano non usa armi a due mani né da fuoco.`;
  if (e.classe === 'signore-bestie' && a.fuoco) return 'Il signore delle bestie non usa armi da fuoco.';
  return null;
}
