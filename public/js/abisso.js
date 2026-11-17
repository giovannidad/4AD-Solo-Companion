// Supplemento «Contro l'Abisso» (livelli 5-9): dungeon dell'Abisso, pericoli (follia, licantropia, peste, vampirismo), abilità, incantesimi avanzati, alleati.
// Lo stato di gioco sta tutto in S.adv e S.party (eroi, avventura): qui ci sono solo le regole.
import { R, S, log, modificato, eroiVivi, eroiAttivi, eroePerId, ordineMarcia, nuovoEroe } from './state.js';
import { dado, tira, dado8 } from './dice.js';
import { riga, tabella, mostriTabella, creaIncontro, inAbisso, abissoAttivo, haAbilita, oggettoEffetto, modAttacco, modDifesa, gruppoHaLanterna, trovaReazione } from './rules.js';
import { h, modal, toast, scelta, sceltaMultipla, confirmBox, uid } from './util.js';
import * as G from './game.js';
import * as C from './combat.js';
import * as V from './silvani.js';
import * as K from './caos.js';
import * as P from './profondita.js';
import * as Q from './acque.js';
import * as AL from './aldila.js';

const adv = () => S.adv;
const casuale = arr => arr[Math.floor(Math.random() * arr.length)];
const bottino = o => { (adv().bottino = adv().bottino || []).push({ id: uid(), ...o }); };
const mezzo = e => Math.floor(e.livello / 2);
const inv = (e, re) => oggettoEffetto(e, re);
const prendiOro = (q, da = eroiVivi()) => { let resto = q; for (const x of [...da].sort((a, b) => (b.oro || 0) - (a.oro || 0))) { const k = Math.min(x.oro || 0, resto); x.oro = (x.oro || 0) - k; resto -= k; if (!resto) break; } return q - resto; };
const oroGruppo = () => eroiVivi().reduce((a, e) => a + (e.oro || 0), 0);
export const NOMI_AVANZATI = () => R.abisso.incantesimi.map(s => s.nome);
const TIPI_BERSAGLIO_AB = ['Seguace', 'Aberrante', 'Boss'];

// =============================================================
//  CONTENUTI DELLE STANZE: eventi, caratteristiche, trappole, banchetto, complicazioni
// =============================================================
/** Eventi unici: ognuno una sola volta per avventura; esauriti si tira sulle Trappole. */
export async function evento(t) {
  const usati = adv().eventiUsati = adv().eventiUsati || [];
  const tab = tabella('eventi');
  if (usati.length >= tab.length) return `Eventi esauriti → ${await G.trappola()}`;
  let row;
  do { row = riga(tab, (await dado('Evento unico (d6)')).totale); } while (usati.includes(row.azione));
  usati.push(row.azione);
  return `${row.nome}: ${await eseguiEvento(row, t)}`;
}
async function eseguiEvento(row, t) {
  const vivi = eroiAttivi();
  switch (row.azione) {
    case 'libro': {
      const e = await K.eroeScelto('Chi legge il libro?', x => x.stato === 'ok'); if (!e) return row.testo;
      const x = await tira('1d6', 'Indizi dal libro'); for (let i = 0; i < x.totale; i++) await G.aggiungiIndizio(e);
      const ok = await C.salva(e, x.totale + 2, e.classe === 'mago' ? mezzo(e) : 0, 'Libro dei segreti');
      if (!ok) { const f = await tira('1d3', 'Follia dal libro'); K.follia(e, f.totale); }
      return `${e.nome} guadagna ${x.totale} indizi${ok ? '' : ', ma perde un po’ di sanità'}.`;
    }
    case 'peste': { const e = casuale(vivi); if (!e) return ''; await esponiPeste(e, 5, 'Peste oscura (evento)'); return `${e.nome} è esposto alla peste oscura.`; }
    case 'sciame': {
      const maghi = vivi.filter(e => (e.incantesimi || []).some(s => s.nome === 'Palla di Fuoco' && !s.usato));
      if (maghi.length && await scelta('Sciame di insetti', 'Un incantesimo Palla di Fuoco può distruggere lo sciame. Lo lanci?', [[true, 'Sì, lancia Palla di Fuoco'], [false, 'No: tutti subiscono 1 ferita']])) {
        maghi[0].incantesimi.find(s => s.nome === 'Palla di Fuoco' && !s.usato).usato = true; modificato('party'); return 'Lo sciame è distrutto dalla Palla di Fuoco.';
      }
      vivi.forEach(e => C.perdiPV(e, 1, 'sciame di insetti')); return 'Tutti subiscono 1 ferita.';
    }
    case 'scala': {
      const s = await scelta('Scala segreta', 'Passaggio al livello superiore (non l’ingresso né le stanze adiacenti). Se sali, 1 su 1d6 di incontrare mostri erranti all’arrivo.', [['su', 'Sali le scale (tira gli erranti)'], ['no', 'Ignora']]);
      if (s === 'su' && (await dado('Erranti all’arrivo (1 = arrivano)')).totale === 1) { const m = await G.monstroErrante(); G.avviaIncontro(m, t); }
      return 'Una scala segreta porta al livello superiore (senza livello superiore: stanza casuale senza uscita, tira due volte il contenuto e scegli).';
    }
    case 'fantasma': {
      const paga = oroGruppo() >= 100 ? await scelta('Il fantasma dell’oro', 'Puoi placare lo spirito sacrificando un tesoro da 100 p.o. (monete).', [[true, 'Sacrifica 100 p.o.'], [false, 'No: tutti hanno -1 in difesa']]) : false;
      if (paga) { prendiOro(100); return 'Lo spirito è placato (100 p.o. sacrificati).'; }
      eroiVivi().forEach(e => { e.maledetto = true; }); return 'Il fantasma maledice tutti: -1 in difesa finché non ricevono una Benedizione (usa la scheda dell’eroe o l’incantesimo).';
    }
    case 'risucchio': {
      let persi = 0;
      for (const e of vivi) for (const sp of (e.incantesimi || [])) if (!sp.usato && !(await C.salva(e, 7, mezzo(e), `Risucchio di mana (${sp.nome})`))) { sp.usato = true; persi++; }
      modificato('party'); return `${persi} incantesimi perduti (oggetti e pergamene sono immuni).`;
    }
  }
  return row.testo;
}

/** Caratteristiche speciali. */
export async function caratteristica(row) {
  const vivi = eroiAttivi();
  switch (row.azione) {
    case 'banchetto': {
      const chi = await sceltaMultipla(row.nome, 'Chi si serve alla tavola? (decidi prima di leggere le conseguenze)', vivi.map(e => [e.id, e.nome]));
      const esiti = [];
      for (const id of chi) esiti.push(await banchetto(eroePerId(id)));
      return esiti.join(' ') || 'Nessuno mangia.';
    }
    case 'lava': {
      const e = await K.eroeScelto('Chi tenta di saltare il fiume di lava?', x => x.stato === 'ok'); if (!e) return row.testo;
      const b = (e.classe === 'furfante' ? e.livello : 0) + (['elfo', 'mezzuomo'].includes(e.classe) ? 1 : 0) - (e.classe === 'nano' ? 1 : 0) - (e.armatura === 'pesante' ? 1 : 0);
      if (!(await C.salva(e, 6, b, 'Salto sul fiume di lava'))) return `${e.nome} rinuncia o cade: nessun oggetto.`;
      const o = await oggettoMagico(); bottino(o);
      const ritorno = await C.salva(e, 6, b, 'Salto di ritorno sul fiume di lava');
      if (!ritorno) { const d = await tira('1d6', 'Ferite da lava'); C.perdiPV(e, d.totale, 'fiume di lava'); }
      return `${e.nome} prende ${o.nome}${ritorno ? '' : ' ma cade nel salto di ritorno'}.`;
    }
    case 'orrori': {
      vivi.forEach(e => K.follia(e, 1));
      await C.salvaTutti('Stanza degli orrori (paura)', 6, e => (['mago', 'chierico'].includes(e.classe) ? 1 : 0), e => { e.orrore = true; log(`${e.nome}: -1 in attacco finché non riceve una Benedizione.`); });
      return 'Tutti ricevono 1 follia; chi fallisce ha -1 in attacco fino a una Benedizione.';
    }
    case 'incatenato': {
      const x = await dado('Mostro incatenato (tabella boss)'); const m = mostriTabella('boss')[x.totale - 1];
      const s = await scelta('Mostro incatenato', `${m.nome} è tenuto prigioniero.`, [['lascia', 'Lascialo stare'], ['uccidi', 'Uccidilo (niente ES né tesoro)'], ['libera', 'Liberalo']]);
      if (s === 'libera') {
        const o = await tira('1d6x1d6', 'Dono del mostro'); bottino({ tipo: 'oro', testo: `${o.totale} pezzi d’oro (dono del mostro liberato)`, valore: o.totale });
        const e = await K.eroeScelto('Chi riceve l’indizio?'); if (e) await G.aggiungiIndizio(e);
        adv().liberato = m.nome; log(`${m.nome} liberato: 2 su 1d6 di trovarlo con il boss finale.`);
      }
      return `Prigioniero: ${m.nome} (${s || 'lasciato'}).`;
    }
    case 'biblioteca': {
      if ((await dado('Erranti durante la ricerca (1 = arrivano)')).totale === 1) { const m = await G.monstroErrante(); G.avviaIncontro(m, G.tileById(adv().stanzaCorrente)); }
      const e = await K.eroeScelto('Chi fa la ricerca?', x => x.stato === 'ok'); if (!e) return 'Nessuno studia i libri.';
      await G.aggiungiIndizio(e);
      const f = await dado8('Follia dalla ricerca (1-2 = +1 follia)'); if (f.totale <= 2) K.follia(e, 1);
      return `${e.nome} consulta la biblioteca.`;
    }
    case 'rompicapo': return await rompicapo();
  }
  return row.testo;
}
async function rompicapo() {
  const e = await K.eroeScelto('Chi tenta il rompicapo?', x => x.stato === 'ok'); if (!e) return 'Nessuno tenta il rompicapo.';
  const L = (await tira('1d8+4', 'Livello del rompicapo (1d8+4)')).totale;
  for (;;) {
    const r = await C.dE(e, `Rompicapo di L${L} – ${e.nome}`);
    const tot = r.totale + (['mago', 'furfante'].includes(e.classe) ? e.livello : 0) + (haAbilita(e, 'mente-brillante') ? 1 : 0);
    if (r.naturale !== 1 && tot >= L) { log(`${e.nome} risolve il rompicapo (${tot} contro L${L}).`); return `Rompicapo risolto: ${await G.tesoro()}`; }
    const s = await scelta('Rompicapo', `${e.nome} fallisce (${tot} contro L${L}). Paghi:`, [['pv', 'Perdi 1 PV'], ['follia', 'Ricevi 1 punto follia']]);
    if (s === 'follia') K.follia(e, 1); else C.perdiPV(e, 1, 'rompicapo');
    if (e.stato !== 'ok') return 'Il rompicapo resta irrisolto.';
    if (!(await scelta('Rompicapo', 'Riprovi?', [[true, 'Riprova'], [false, 'Rinuncia']]))) return 'Il rompicapo resta irrisolto.';
  }
}

/** Banchetto incantato: un tiro per ogni personaggio che mangia. */
async function banchetto(e) {
  const tab = tabella('banchettoIncantato');
  let row;
  do { row = riga(tab, (await dado(`Banchetto incantato – ${e.nome}`)).totale); } while (row.azione === 'ogre' && adv().ogreVisto);
  switch (row.azione) {
    case 'cibo-magico': {
      e.pv = Math.min(e.pvMax, e.pv + 3);
      const x = await tira('1d6x1d6', 'Furto della creatura fatata');
      const preziosi = (e.oggetti || []).filter(o => o.tipo === 'magico' || o.tipo === 'gemma' || o.tipo === 'gioiello' || o.tipo === 'arma-magica' || o.tipo === 'armatura-magica').sort((a, b) => (b.valore || 0) - (a.valore || 0));
      if (!(e.oro > 0) && !preziosi.length) { e.campanellini = true; return `${e.nome} recupera 3 PV ma è maledetto dai campanellini: gli erranti arrivano con 1-3 su 1d6 (Benedizione per toglierlo).`; }
      const scegliOggetto = preziosi.length && (!(e.oro > 0) || await scelta('Creatura fatata', `${e.nome} perde ${x.totale} p.o. oppure l’oggetto più prezioso (${preziosi[0].nome}).`, [[false, `${x.totale} p.o.`], [true, preziosi[0].nome]]));
      if (scegliOggetto) { e.oggetti.splice(e.oggetti.indexOf(preziosi[0]), 1); return `${e.nome} recupera 3 PV e perde ${preziosi[0].nome}.`; }
      const q = Math.min(e.oro || 0, x.totale); e.oro -= q; return `${e.nome} recupera 3 PV e perde ${q} p.o.`;
    }
    case 'cura': e.pv = Math.min(e.pvMax, e.pv + 1); return `${e.nome} recupera 1 PV.`;
    case 'avvelenato': {
      const ok = await C.salva(e, 7, (e.classe === 'mezzuomo' ? e.livello : 0) + (e.classe === 'barbaro' ? 1 : 0), 'L’agnello era guasto (veleno)');
      if (!ok) { e.avvelenatoAtt = 2; return `${e.nome}: -1 in attacco per 2 incontri.`; } return `${e.nome} resiste al veleno.`;
    }
    case 'visioni': {
      const ok = await C.salva(e, 6, ['chierico', 'mago'].includes(e.classe) ? mezzo(e) : 0, 'Pasto fantasma (magia)');
      if (!ok) K.follia(e, 1); return `${e.nome} ${ok ? 'resiste alle visioni' : 'riceve 1 punto follia'}.`;
    }
    case 'ogre': {
      adv().ogreVisto = true;
      const o = R.abisso.creatureExtra.find(c => c.id === 'a-ogre-due-teste');
      const i = creaIncontro('boss', o, 1); i.sorpresa = true; i.mostriPrima = true; i.primoBersaglio = e.id; i.reazione = { azione: 'combatte-sempre', tiro: 0 }; i.noMorale = true;
      G.avviaIncontro(i, G.tileById(adv().stanzaCorrente)); return `Un ogre a due teste attacca ${e.nome} di sorpresa!`;
    }
    case 'incantesimo-fatato': {
      if (e.classe === 'barbaro') return `${e.nome} (barbaro) ignora il banchetto fatato.`;
      const lista = R.tabelle.incantesimoCaso; const n = lista[(await dado('Incantesimo del banchetto fatato')).totale - 1];
      (e.oggetti = e.oggetti || []).push({ nome: `Incantesimo del banchetto: ${n}`, qta: 1, tipo: 'pergamena', nota: 'Banchetto fatato: un solo lancio', cariche: 1, caricheMax: 1, incantesimo: n, consuma: true });
      return `${e.nome} può lanciare una volta ${n} (nello zaino).`;
    }
  }
  return row.testo;
}

/** Complicazione di un tesoro nascosto (tabella dell'Abisso). Restituisce eventuali modifiche al tesoro {molt}. */
export async function complicazione(row, t) {
  switch (row.azione) {
    case 'errante': { const i = await G.monstroErrante(); G.avviaIncontro(i, t); break; }
    case 'illusione': for (const e of eroiAttivi().filter(x => x.classe === 'nano')) if (!(await C.salva(e, 5, 0, 'Tesoro illusorio'))) K.follia(e, 1); break;
    case 'trappola': {
      const liv = (await dado('Livello della trappola del tesoro (d6)')).totale;
      const furf = ordineMarcia().find(x => x.stato === 'ok' && x.classe === 'furfante');
      if (furf) { const r = await C.dE(furf, `Disattivare la trappola (${furf.nome})`); if (r.naturale !== 1 && r.totale + furf.livello > liv) { log(`${furf.nome} disattiva la trappola.`); break; } }
      const e = casuale(eroiAttivi()); if (e && !(await C.salva(e, liv, 0, `Trappola del tesoro (L${liv})`))) { const d = await tira('1d3', 'Ferite della trappola'); C.perdiPV(e, d.totale, 'trappola del tesoro'); }
      break;
    }
    case 'ingombrante': {
      const due = await sceltaMultipla('Tesoro ingombrante', 'Chi lo porta? Servono 2 personaggi (-1 in difesa contro gli erranti). Il valore è raddoppiato.', eroiAttivi().map(e => [e.id, e.nome]));
      due.slice(0, 2).forEach(id => { const e = eroePerId(id); if (e) e.cestoIngombrante = true; });
      return { molt: 2 };
    }
    case 'lite': {
      const v = eroiAttivi(); if (v.length < 2) break;
      const a = casuale(v), b = casuale(v.filter(x => x !== a));
      if (!(await C.salva(a, b.livello + 1, 0, `Lite con ${b.nome}`))) C.perdiPV(a, 1, 'lite');
      if (!(await C.salva(b, a.livello + 1, 0, `Lite con ${a.nome}`))) C.perdiPV(b, 1, 'lite');
      break;
    }
    case 'cassa': {
      const o = R.abisso.creatureExtra.find(c => c.id === 'a-cassa-assassina'); const i = creaIncontro('aberranti', o, 1);
      const furf = ordineMarcia().find(x => x.stato === 'ok' && x.classe === 'furfante');
      let allarme = false;
      if (furf) { const r = await C.dE(furf, `Allarme della cassa (${furf.nome}, contro LIV 5)`); allarme = r.totale + furf.livello > 5; }
      i.sorpresa = !allarme; i.mostriPrima = !allarme; i.reazione = { azione: 'combatte-sempre', tiro: 0 }; i.noMorale = true; i.tes = 'NO';
      G.avviaIncontro(i, t); break;
    }
  }
  return null;
}

/** Trappole dell'Abisso (le salvezze usano il d8 per i personaggi di livello avanzato). */
export async function risolviTrappola(t) {
  const vivi = ordineMarcia().filter(e => e.stato === 'ok'); if (!vivi.length) return;
  const T = adv().trappolaAttiva = t;
  const rnd = () => casuale(vivi), L = t.liv, ferisci = (e, n) => C.perdiPV(e, n, t.nome);
  const furf = (e, f = 'L') => (e.classe === 'furfante' ? e.livello : 0);
  switch (t.riga) {
    case 1: { const e = rnd(); if (!(await C.salva(e, L, 0, `${t.nome} (L${L})`)) && !(await C.salva(e, 4, furf(e) + (e.classe === 'mezzuomo' ? e.livello : 0) + (e.classe === 'barbaro' ? 1 : 0), 'Veleno del dardo'))) ferisci(e, 2); break; }
    case 2: for (const e of vivi) { const b = furf(e) + (['elfo', 'mezzuomo', 'spadaccino'].includes(e.classe) ? mezzo(e) : 0) + (!['furfante', 'elfo', 'mezzuomo', 'spadaccino'].includes(e.classe) ? (e.armatura === 'pesante' ? 1 : 0) + (e.scudo ? 1 : 0) : 0); if (!(await C.salva(e, L, b, `${t.nome} (L${L})`))) ferisci(e, 1); } break;
    case 3: {
      const e = rnd();
      if (!(await C.salva(e, L, 0, `${t.nome} (L${L})`))) {
        ferisci(e, 1);
        if (e.stato === 'ok') {
          const c = creaIncontro('aberranti', R.abisso.creatureExtra.find(x => x.id === 'a-coccodrillo-spinato'), 1);
          Object.assign(c, { mostriPrima: true, noMorale: true, solo: e.id, reazione: { azione: 'morte', tiro: 0 } });
          G.avviaIncontro(c, G.tileById(adv().stanzaCorrente)); toast(`${e.nome} cade nella fossa: il coccodrillo attacca per primo (con una corda i compagni lo aiutano).`, 'warn');
        }
      }
      break;
    }
    case 4: { const e = rnd(); if (!(await C.salva(e, L, furf(e) + (['elfo', 'mezzuomo', 'spadaccino'].includes(e.classe) ? 1 : 0), `${t.nome} (L${L})`))) ferisci(e, 3); break; }
    case 5: for (const e of vivi) if (!(await C.salva(e, L, 0, `${t.nome} (elettricità, L${L})`))) ferisci(e, 1); break;
    case 6: {
      let liv = L, ferma = false;
      for (const e of vivi) {
        if (ferma || e.stato !== 'ok') continue;
        let come = 'schiva';
        if (e.scudo) come = await scelta('Lancia di metallo', `${e.nome}: schivi (L${liv}) o pari con lo scudo (difesa contro L${liv + 2})?`, [['schiva', 'Schiva'], ['para', 'Para con lo scudo']]) || 'schiva';
        if (come === 'schiva') { if (await C.salva(e, liv, furf(e) + (['elfo', 'mezzuomo'].includes(e.classe) ? mezzo(e) : 0), `Schivata della lancia (L${liv})`)) continue; }
        else {
          const r = await C.dE(e, `Parata della lancia – ${e.nome} (L${liv + 2})`);
          const tot = r.totale + modDifesa(e, { nome: t.nome }).tot + (['barbaro', 'guerriero', 'nano'].includes(e.classe) ? e.livello : 0);
          if (C.esplode(e, r) || (r.naturale !== 1 && tot > liv + 2)) { if (!e.scudoMagico && !e.srv?.scudo) { e.scudo = false; log(`${e.nome} devia la lancia: lo scudo è distrutto.`); } else log(`${e.nome} devia la lancia con lo scudo infrangibile.`); ferma = true; continue; }
        }
        ferisci(e, 3); liv = Math.max(0, liv - 1);
      }
      break;
    }
  }
  adv().trappolaAttiva = null; modificato();
}

/** Oggetto magico dei Tesori magici dell'Abisso (d6). */
export async function oggettoMagico() {
  const row = riga(tabella('tesoriMagici'), (await dado('Tesori magici (d6)')).totale);
  const o = { tipo: 'magico', testo: `${row.nome}: ${row.testo}`, nome: row.nome, abi: row.id };
  if (row.id === 'a-anello-tre-desideri') { const n = (await tira('1d3', 'Desideri dell’anello')).totale; Object.assign(o, { cariche: n, caricheMax: n, manuale: false, testo: `${row.nome} (${n} desideri): ${row.testo}` }); }
  if (['a-pergamena-esilio', 'a-filtro-soffio-fuoco'].includes(row.id)) Object.assign(o, { cariche: 1, caricheMax: 1, manuale: false });
  if (row.id === 'a-pergamena-esilio') o.solo = ['mago', 'chierico'];
  return o;
}
/** Difese magiche dell'Abisso (d6): bonus applicati automaticamente dal nome dell'oggetto. */
export async function difesaMagica() {
  const row = riga(tabella('difeseMagiche'), (await dado('Difese magiche (d6)')).totale);
  const speciali = { 'a-cotta-elfica': 'armatura leggera +2', 'a-armatura-incantata': 'armatura pesante +3' };
  return { tipo: row.id === 'a-cotta-elfica' ? 'oggetto' : 'magico', nome: row.nome, testo: `${row.nome}${speciali[row.id] ? ' (' + speciali[row.id] + ')' : ''}: ${row.testo}`, abi: row.id, noBarbaro: row.id === 'a-scudo-magico' };
}
/** Oggetto utile dell'Abisso (d6). */
export async function oggettoUtile() {
  const row = riga(tabella('oggettiUtili'), (await dado('Oggetti utili (d6)')).totale);
  if (row.azione === 'scelta-equip') {
    const k = await scelta(row.nome, 'Scegli:', ['Corda', 'Lanterna', 'Arma a una mano da taglio', 'Arma a una mano contundente'].map(x => [x, x]));
    return { tipo: 'oggetto', testo: k || 'Corda', nome: k || 'Corda' };
  }
  let q = 1; if (row.dadi) q = (await tira(row.dadi, row.nome)).totale;
  const o = { tipo: 'oggetto', nome: row.nome, testo: `${row.nome}${q > 1 ? ' ×' + q : ''}: ${row.testo}`, abi: row.id, qta: q };
  if (row.id === 'a-ferro-cavallo') o.noBarbaro = true;
  return o;
}

// =============================================================
//  MOSTRI: creazione, leader, tenzone, effetti
// =============================================================
/** Dopo la creazione di un incontro: sorpresa dell'urlatore e leader con 1d6. */
export async function postCrea(inc, voce) {
  if (voce.sorpresaProb && !inc.errante) { const x = await dado(`${voce.nome}: sorprende il gruppo? (1-${voce.sorpresaProb})`); if (x.totale <= voce.sorpresaProb) { inc.sorpresa = true; log(`${voce.nome} sorprende il gruppo.`); } }
  if (inc.errante && abissoAttivo() && ordineMarcia().some((x, k) => k >= 2 && x.stato === 'ok' && haAbilita(x, 'sesto-senso'))) { inc.sorpresa = false; inc.sestoSenso = true; log('Sesto senso: il gruppo non è sorpreso dagli erranti e colpisce per primo.'); }
  if (voce.scorta) {
    const x = await dado(`${voce.nome}: ha una scorta? (1-${voce.scorta.probabilita})`);
    if (x.totale <= voce.scorta.probabilita) {
      const n = (await tira(voce.scorta.numero, 'Numero scheletri guerrieri')).totale; const sc = R.abisso.creatureExtra.find(c => c.id === voce.scorta.id);
      inc.scortaInc = creaIncontro('seguaci', { ...sc, id: sc.id, mor: 'NO', xp: false }, n); inc.scortaInc.dannoSu1 = sc.dannoSu1;
    }
  }
}
export async function leaderAbisso(voce, inc) {
  const L = voce.leaderDati, prob = voce.leaderProb || 1;
  const x = await dado(`${voce.nome}: c'è un leader? (1-${prob} su 1d6)`);
  if (x.totale > prob) return null;
  const val = async (v, label) => (typeof v === 'string' && /d/.test(v) ? (await tira(v, label)).totale : +v);
  let l;
  if (L.rif === 'boss') l = creaIncontro('boss', mostriTabella('boss').find(m => m.id === L.id), 1);
  else l = creaIncontro('boss', { id: L.id, nome: L.nome, liv: await val(L.liv, `Livello: ${L.nome}`), att: L.att, pv: await val(L.pv, `PV: ${L.nome}`), tag: [...(voce.tag || [])], mor: L.mor, tes: L.tes, xp: true, reazioni: [[1, 6, 'combatte-sempre']] }, 1);
  l.reazioni = [[1, 6, 'combatte-sempre']];
  log(`${voce.nome}: ${l.nome} è il leader (LIV ${l.liv}, ATT ${l.att}, PV ${l.pv}); fuori dalle stanze si affronta dopo i seguaci, in stanza puoi scegliere un campione.`);
  return l;
}
/** Un incontro con scorta (lich): gli scheletri si affrontano subito dopo (il manuale chiede di dividere il gruppo). */
export function codaScorta(inc) { if (inc.scortaInc) { (adv().coda = adv().coda || []).push(inc.scortaInc); inc.scortaInc.tessera = inc.tessera; log(`${inc.nome}: ${inc.scortaInc.n} scheletri guerrieri a difesa (da affrontare dopo; il manuale prevede combattimenti in parallelo con il gruppo diviso).`); inc.scortaInc = null; } }

/** Inizio dello scontro: attacca per primo, follia e paura del lich. */
export async function inizioIncontro(i) {
  i.feriti = {};
  if (i.attaccaPerPrimo && !ordineMarcia().some(x => x.stato === 'ok' && haAbilita(x, 'sesto-senso'))) i.mostriPrima = true;
  if (i.folliaIncontro) for (const e of eroiAttivi()) K.follia(e, i.folliaIncontro);
  if (i.paura) { i.pauraEroi = {}; for (const e of eroiAttivi()) if (!(await C.salva(e, i.paura.tsLiv, 0, 'Paura del lich'))) { i.pauraEroi[e.id] = true; C.nota(`${e.nome}: -1 in attacco finché il lich non ha 2 ferite.`); } }
  if (i.marchiatura) for (const e of eroiAttivi()) if (!e.marchiato && (await dado(`Marcatura chimica su ${e.nome} (1-${i.marchiatura.probabilita})`)).totale <= i.marchiatura.probabilita) { e.marchiato = true; C.nota(`${e.nome} è marchiato: -1 in difesa contro gli uomini formica (Benedizione o acqua per toglierlo).`); }
  if (i.nonAttacca && i.attiraErranti) C.nota(`${i.nome}: uccidili tutti entro 2 turni, o arrivano i mostri erranti.`);
  for (const e of S.party.eroi) { e.dichiara = {}; e.illuso = false; }
}
/** Blocchi a inizio turno: illusioni del drago dei miraggi e aura del cervello tentacolato. */
export async function inizioTurno(i) {
  if (i.illusione) for (const e of eroiAttivi()) {
    e.illuso = false;
    if (!(await C.salva(e, i.illusione.tsLiv, (e.classe === 'mago' ? e.livello : 0) + (e.classe === 'elfo' ? 1 : 0), 'Illusione del drago'))) { e.illuso = true; i.agito[e.id] = true; C.nota(`${e.nome} è illuso: non attacca né lancia incantesimi e ha -1 in difesa.`); }
  }
  if (i.auraOgniTurno) for (const e of eroiAttivi()) if (!(await C.salva(e, i.auraOgniTurno.tsLiv, e.classe === 'mago' ? e.livello : 0, 'Potere del cervello tentacolato'))) { C.perdiPV(e, 1, 'cervello tentacolato'); K.follia(e, 1); }
}
/** All'inizio del turno dei mostri. Restituisce { salta } o { assegnazioni }. */
export async function inizioTurnoMostri(i, assegnazioni) {
  if (i.rubaOro) { const q = i.n * (i.rubaOro.perTurnoPerMostro || 1), tolto = prendiOro(q); if (tolto) C.nota(`I brounie rubano ${tolto} p.o. al gruppo.`); }
  if (i.stritolato) {
    const e = eroePerId(i.stritolato);
    if (e && e.stato === 'ok') { C.perdiPV(e, 1, 'stritolato dal serpente'); return { salta: true }; }
    i.stritolato = null;
  }
  if (i.sofLiv && i.sofSoloPrimoTurno && i.turno === 1) {
    C.nota(`${i.nome} sputa una fiammata!`);
    await C.salvaTutti('Soffio di fuoco di drago', i.sofLiv, e => (i.sofBonus?.[e.classe] || 0), e => C.perdiPV(e, i.sofDanno || 1, 'soffio'));
    return { salta: true };
  }
  if (i.elettricita) {
    const x = await dado(`Elettricità di ${i.nome} (1-${i.elettricita.probabilita})`);
    if (x.totale <= i.elettricita.probabilita) {
      C.nota(`${i.nome} scarica elettricità!`);
      const altri = [];
      for (const e of eroiAttivi()) { if (e.armatura === 'pesante') C.perdiPV(e, i.elettricita.ferite, 'elettricità'); else altri.push({ eroeId: e.id }); }
      return { assegnazioni: altri };
    }
  }
  return null;
}
/** Attacchi dei mostri con poteri speciali che limitano i bersagli (illusione). */
export function filtraBersagli(i, ordine) { return i.illusione ? ordine.filter(e => e.illuso) : ordine; }

/** Dopo ogni ferita subita: paralisi, vampirismo, licantropia (segnata), stritolamento, lame infette. */
export async function effettoFerita(e, i, dn) {
  if (!abissoAttivo() && !inAbisso()) return;
  i.feriti = i.feriti || {}; i.feriti[e.id] = (i.feriti[e.id] || 0) + dn;
  if (i.paralisi && e.stato === 'ok' && !e.paralizzato && !(e.pozioni?.sangue) && !(i.paralisi.elfiImmuni && e.classe === 'elfo')) {
    const b = i.paralisi.bonusElfi === 'L' && e.classe === 'elfo' ? e.livello : 0;
    if (!(await C.salva(e, i.paralisi.liv, b, 'Paralisi (veleno)'))) { e.paralizzato = true; i.agito[e.id] = true; C.nota(`${e.nome} è paralizzato: sarà colpito in automatico (Benedizione per liberarlo).`); }
  }
  if (i.vampirismo && e.stato === 'ok') {
    if (e.pozioni?.aglio) C.nota(`${e.nome}: l’impiastro di aglio lo protegge dalla perdita di livello.`);
    else if (!(await C.salva(e, i.vampirismo.tsLiv, 0, 'Morso del vampiro (magia)'))) perdiLivello(e, 1, true);
  }
  if (i.stritola && !i.stritolato && e.stato === 'ok') { i.stritolato = e.id; C.nota(`${e.nome} è stritolato: perde 1 PV a turno finché il serpente non muore (Fuga o teletrasporto lo liberano).`); }
}
/** Perdita di livello (vampiri): -1 PV massimo e vantaggi collegati; a livello 0 il PG torna come vampiro. */
export function perdiLivello(e, n = 1, vampiro = false) {
  for (let k = 0; k < n && e.livello > 0; k++) {
    e.livello--; e.livelliPersi = (e.livelliPersi || 0) + 1; e.pvMax = Math.max(1, e.pvMax - 1); e.pv = Math.min(e.pv, e.pvMax);
    const s = (e.incantesimi || []).map((x, idx) => [x, idx]).reverse().find(([x]) => !x.usato); if (s && ['mago', 'elfo'].includes(e.classe)) e.incantesimi.splice(s[1], 1);
    C.nota(`${e.nome} perde un livello (ora ${e.livello}).`);
  }
  if (vampiro && e.livello <= 0) { e.stato = 'morto'; e.vampirizzato = true; C.nota(`${e.nome} muore e tornerà come vampiro: niente resurrezione finché il corpo non è bruciato o il vampiro ucciso.`); }
  modificato('party');
}
/** Pericoli a fine incontro: lame infette, licantropia, vittoria con premi dei mostri, ritorno della tenzone. */
export async function fineIncontro(i, esito) {
  if (i.lameInfette && i.feriti) for (const [id, n] of Object.entries(i.feriti)) { const e = eroePerId(id); if (!e || e.stato !== 'ok') continue; const x = await dado(`Lame infette su ${e.nome} (1 o meno di ${n} = -1 PV)`); if (x.totale === 1 || x.totale < n) C.perdiPV(e, 1, 'lame infette'); }
  if (i.licantropia && i.feriti) for (const id of Object.keys(i.feriti)) {
    const e = eroePerId(id); if (!e || e.stato === 'morto' || e.licantropia || e.licantropiaImmune) continue;
    if (!(await C.salva(e, i.licantropia.tsLiv, ['elfo', 'mezzuomo'].includes(e.classe) ? mezzo(e) : 0, 'Maledizione del lupo mannaro'))) { e.licantropia = true; e.lanterna = false; C.nota(`${e.nome} è infettato dalla licantropia: getta via l’argento e rifiuta la lanterna.`); }
  }
  if (i.vampirismo && esito === 'fuga') { adv().vampiroFuggito = { id: i.id, pv: i.pv, tabella: i.tabella }; log(`${i.nome} è fuggito ferito: puoi rincontrarlo spendendo indizi (Strumenti).`); }
  if (esito !== 'fuga' && i.premioMorte) for (const e of eroiVivi().filter(x => x.stato === 'ok')) { e.fortunaExtra = (e.fortunaExtra || 0) + 1; }
  if (i.premioMorte && esito !== 'fuga') log('Il fortundrago è morto: ogni superstite ha 1 punto fortuna fino a fine avventura (ripeti un tiro).');
  if (i.trasformatoId) { const e = eroePerId(i.trasformatoId); if (e) { if (i.sedato) { e.stato = 'ok'; log(`${e.nome} dorme e torna in sé a fine avventura (licantropia da curare).`); } else { e.stato = 'morto'; log(`${e.nome}, lupo mannaro, è morto.`); } } }
  if (/fung/i.test(i.nome || '') && i.n === 0) for (const e of eroiVivi().filter(x => x.stato === 'ok' && haAbilita(x, 'alchimia-delle-spore'))) { (e.oggetti = e.oggetti || []).push({ nome: 'Spore dei funghi (Sonno)', qta: 1, tipo: 'spore', nota: 'Alchimia delle spore: un uso di Sonno', cariche: 1, caricheMax: 1, incantesimo: 'Sonno', consuma: true, solo: [e.classe] }); log(`${e.nome} prepara le spore: un uso di Sonno.`); }
  for (const e of S.party.eroi) { e.illuso = false; e.vendetta = false; e.incenso = false; if (e.srv?.armaiolo) delete e.srv.armaiolo; if (e.avvelenatoAtt > 0) e.avvelenatoAtt--; }
}
/** Il lupo mannaro del giocatore: la follia ha superato il livello. */
export function trasformaLupo(e) {
  const v = R.abisso.creatureExtra.find(c => c.id === 'a-lupo-mannaro-pg');
  e.stato = 'lupo'; e.licantropia = true;
  const i = creaIncontro('boss', { ...v, nome: `${e.nome} trasformato in lupo mannaro` }, 1);
  Object.assign(i, { trasformatoId: e.id, reazione: { azione: 'morte', tiro: 0 }, noMorale: true, tes: 'NO', mostriPrima: !ordineMarcia().some(x => x.stato === 'ok' && x.id !== e.id && haAbilita(x, 'sesto-senso')) });
  log(`${e.nome} impazzisce e si trasforma in lupo mannaro: attacca il gruppo (Sonno lo addormenta senza ucciderlo).`);
  if (adv().attiva) G.avviaIncontro(i, G.tileById(adv().stanzaCorrente));
}
export function impazzisce(e) { e.stato = 'pazzo'; log(`${e.nome} impazzisce: fugge dal dungeon portando con sé tutti i suoi averi, scomparendo per sempre.`); moraleMercenari(e.nome); modificato('party'); }
/** Dopo ogni cambiamento della follia: oltre il livello (il mago conta uno in più) il PG impazzisce o, se licantropo, si trasforma. */
export function controllaPazzia(e) {
  if (!abissoAttivo() || ['morto', 'pazzo', 'lupo'].includes(e.stato) || e.merc) return;
  if ((e.follia || 0) > e.livello + (e.classe === 'mago' ? 1 : 0) + P.livelloFollia(e)) { if (e.licantropia) trasformaLupo(e); else impazzisce(e); }
}

/** Singolar tenzone: duello fra un PG scelto e il campione dei mostri (1d6 turni). */
export async function tenzone(i) {
  const e = await K.eroeScelto('Singolar tenzone: chi duella?', x => x.stato === 'ok' && !x.merc) || eroiAttivi()[0];
  if (!e) return;
  const duellante = i.leaderInc && i.leaderInc.pv > 0 ? i.leaderInc : null;
  const mon = duellante ? { nome: duellante.nome, liv: duellante.liv, pv: duellante.pv, att: duellante.att, danno: duellante.danno || 1, tag: duellante.tag } : i.minore ? { nome: `campione dei ${i.nome}`, liv: i.liv + 2, pv: 1, att: 1, danno: i.danno || 1, tag: i.tag } : { nome: i.nome, liv: i.liv, pv: i.pv, att: i.att, danno: i.danno || 1, tag: i.tag };
  const turni = (await tira('1d6', 'Durata della singolar tenzone (turni)')).totale;
  const primo = (await dado('Chi attacca per primo? (1-3 il PG, 4-6 i mostri)')).totale <= 3;
  C.nota(`Singolar tenzone: ${e.nome} contro ${mon.nome} (LIV ${mon.liv}) per ${turni} turni; attacca per primo ${primo ? e.nome : mon.nome}.`);
  let ferEroe = 0, ferMostro = 0, pvM = mon.pv, k = 0;
  const colpoEroe = async () => {
    const ctx = { ...C.contestoAttacco(e, {}), bersaglio: { ...i, tag: mon.tag, liv: mon.liv, minore: false, nome: mon.nome }, tenzone: true, inferiorita: false };
    const r = await C.dE(e, `Attacco di ${e.nome} (tenzone, LIV ${mon.liv})`), m = modAttacco(e, ctx), tot = r.totale + m.tot;
    const c = r.naturale !== 1 && tot >= mon.liv ? Math.max(1, Math.floor(tot / mon.liv)) : 0;
    C.nota(`${e.nome} attacca: ${tot} contro LIV ${mon.liv} → ${c ? c + ' ferite' : 'mancato'}.`); ferMostro += c; pvM -= c;
  };
  const colpoMostro = async () => {
    for (let a = 0; a < mon.att && e.stato === 'ok'; a++) {
      const ctx = { tag: mon.tag, nome: mon.nome, tenzone: true, senzaLanterna: !gruppoHaLanterna(), sorpreso: false };
      const r = await C.dE(e, `Difesa di ${e.nome} (tenzone, LIV ${mon.liv})`), tot = r.totale + modDifesa(e, ctx).tot;
      if (C.esplode(e, r) || (r.naturale !== 1 && tot > mon.liv)) C.nota(`${e.nome} si difende (${tot}).`); else { C.nota(`${e.nome} è colpito (${tot} contro LIV ${mon.liv}).`); ferEroe += mon.danno; C.perdiPV(e, mon.danno, 'tenzone'); }
    }
  };
  for (;;) {
    k++;
    for (const chi of primo ? ['e', 'm'] : ['m', 'e']) { if (e.stato !== 'ok' || pvM <= 0) break; if (chi === 'e') await colpoEroe(); else await colpoMostro(); }
    if (e.stato !== 'ok' || pvM <= 0) break;
    if (k >= turni && ferEroe !== ferMostro) break;
  }
  const eroeVince = pvM <= 0 || (e.stato === 'ok' && ferMostro > ferEroe);
  C.nota(`Tenzone conclusa: ${e.nome} ha inflitto ${ferMostro} ferite e ne ha subite ${ferEroe}: ${eroeVince ? 'vince il PG' : 'vincono i mostri'}.`);
  if (eroeVince) {
    if (pvM <= 0 && !i.minore && !duellante) { await C.applicaDanni(i.pv); return; }
    i.stato = 'finito'; i.esito = 'tenzone'; i.tesoroPreso = true; i.tenzoneVinta = e.id;
    C.nota(`I mostri perdono il duello: ti lasciano passare finché ${e.nome} è nel gruppo e in grado di combattere (nessun bottino).`);
  } else { i.stato = 'speciale'; i.reazione = { azione: 'tenzone-persa', tiro: 0 }; C.nota('I mostri hanno vinto: pretendono che il gruppo lasci la stanza (altrimenti combattono con +1 al LIV).'); }
  modificato();
}
export function attaccaDopoTenzone(i) { i.liv++; i.livBase++; i.tenzone = true; i.mostriPrima = true; C.nota(`${i.nome} combatte con +1 al LIV (${i.liv}).`); return C.inizioScontro(); }

// ---- campione contro il leader ----
export function scegliCampione(e) { const i = C.inc(); i.campione = e.id; C.nota(`${e.nome} è il campione: combatte in duello il leader ${i.leaderInc.nome} mentre gli altri affrontano i seguaci.`); modificato(); }
export async function attaccoControLeader(e, opz = {}) {
  const i = C.inc(), L = i.leaderInc; i.agito[e.id] = true;
  const ctx = { ...C.contestoAttacco(e, opz), bersaglio: L, inferiorita: false };
  const r = await C.dE(e, `Attacco di ${e.nome} contro ${L.nome} (LIV ${L.liv})`), m = modAttacco(e, ctx), tot = r.totale + m.tot;
  const c = r.naturale !== 1 && tot >= L.liv ? Math.max(1, Math.floor(tot / L.liv)) : 0;
  C.nota(`${e.nome} attacca il leader: ${tot} contro LIV ${L.liv} → ${c ? c + (c === 1 ? ' ferita' : ' ferite') : 'mancato'}.`);
  if (c) { L.pv = Math.max(0, L.pv - c); if (L.pv <= 0) await leaderCaduto(i); }
  modificato();
}
async function leaderCaduto(i) {
  const L = i.leaderInc; L.morto = true; i.campione = null; C.nota(`${L.nome} è caduto!`);
  G.vittoria(L);
  if (i.tes !== 'NO') { i.tes = L.tes; i.tesMolt = L.tesMolt; }
  if (i.n > 0 && !i.noMorale) { i.moraleMod = (i.moraleMod || 0) - 1; i.moraleFatto = false; await C.tiraMorale(); }
}
/** Il leader attacca il campione. */
export async function turnoLeader(i) {
  const L = i.leaderInc, e = i.campione ? eroePerId(i.campione) : null;
  if (!L || L.morto || !e || e.stato !== 'ok') { if (i.campione && (!e || e.stato !== 'ok')) i.campione = null; return; }
  for (let a = 0; a < L.att && e.stato === 'ok'; a++) {
    const es = await C.provaDifesa(e, L, L.liv, {});
    if (es.ok) C.nota(`${e.nome} para il leader (${es.tot} > ${L.liv}).`); else { C.nota(`${e.nome} è colpito dal leader (${es.tot} contro LIV ${L.liv}).`); C.perdiPV(e, L.danno || 1, L.nome); }
  }
}
/** Il PG è morto: elisir di lunga vita, Muori combattendo e morale dei mercenari. */
export async function dopoMorte(e) {
  if (e.pozioni?.elisir) {
    const x = await tira('1d6', `Elisir di lunga vita: 1d6+${e.livello} (6 o più = non muori)`);
    if (x.totale + e.livello >= 6) { const c = await tira('1d6', 'PV recuperati'); e.stato = 'ok'; e.pv = Math.min(e.pvMax, c.totale); e.pozioni.elisir = false; log(`${e.nome} sopravvive grazie all’elisir di lunga vita (${e.pv} PV).`); modificato('party'); return; }
  }
  const i = C.inc();
  if (haAbilita(e, 'muori-combattendo') && !e.merc && i && i.stato === 'combattimento') { log(`${e.nome} (Muori combattendo) attacca a +1 prima di morire.`); await C.attacca(e, { bonusGruppo: 1, secondo: true }); }
  await moraleMercenari(e);
}
/** Veleno dell'esperto: il 1° attacco; contro un maggiore 1d8+L contro il suo livello riduce il LIV di 1. */
export async function consumaVeleno(e, i) {
  const v = e.srv.veleno; v.usato = true;
  if (i.minore || i.drago || (i.tag || []).includes('non-morto')) { log(`${e.nome} usa l’arma avvelenata${i.minore && !(i.tag || []).includes('non-morto') ? ' (+1 al 1° attacco)' : ': immune al veleno'}.`); return; }
  const x = await tira('1d8', `Veleno di ${e.nome}: 1d8+${e.livello} contro LIV ${i.liv}`);
  if (x.totale + e.livello >= i.liv) { i.liv = Math.max(1, i.liv - 1); i.livBase = Math.min(i.livBase, i.liv); C.nota(`Il veleno riduce il LIV di ${i.nome} a ${i.liv}.`); } else C.nota('Il veleno non basta.');
}
/** Vampiri: si colpiscono solo con armi magiche, incantesimi, Cacciatore di vampiri, acqua santa, paletti o colpi da 2 ferite. */
export function puoColpireVampiro(e, arma, colpi) {
  return (e.bonusMagico || 0) > 0 || haAbilita(e, 'cacciatore-di-vampiri') || e.settaVampiri || colpi >= 2 || !!inv(e, /paletti/i) || (arma && (e.armiMagiche || []).includes(arma.id));
}
/** Teschi volanti: con 1 naturale l'arma resta tra le fauci e il teschio fugge portandola via. */
export async function disarmato(e, i, arma) {
  const k = (e.armi || []).indexOf(arma.id); if (k < 0) return;
  e.armi.splice(k, 1); if (e.armaPrincipale === arma.id && !e.armi.includes(arma.id)) e.armaPrincipale = e.armi[0] || null;
  (adv().armiRubate = adv().armiRubate || []).push({ arma: arma.id, nome: arma.nome, eroe: e.nome });
  C.nota(`L’arma di ${e.nome} (${arma.nome}) resta stretta fra i denti di un teschio, che fugge: la ritroverai nella tana del boss finale.`);
  await C.applicaDanni(1);
}
/** Fabbricante di scudi: ripete il 1° tiro di difesa fallito (non contro attacchi che ignorano gli scudi). */
export async function ripetiDifesa(e, i) {
  if (!e.srv?.scudoRipeti || i.ignoraArmatura || i.psionico) return false;
  e.srv.scudoRipeti = false; C.nota(`${e.nome} ripete la difesa fallita (scudo rinforzato).`); return true;
}
/** Reazioni: sarto (corruzione) e Benedizione sul drago del caos. */
export async function modReazione(i, tot) {
  if (!abissoAttivo()) return tot;
  const az = v => (trovaReazione(i, v) || [1, 6, 'combatte'])[2];
  const sarto = eroiVivi().find(x => x.srv?.sarto);
  if (sarto && az(tot) !== 'corruzione') for (const d of [-1, 1]) if (tot + d >= 1 && tot + d <= 6 && az(tot + d) === 'corruzione') {
    if (await confirmBox(`${sarto.nome} (sarto) può spostare il tiro di reazione (${tot}) a ${tot + d} per ottenere Corruzione. Lo fai? (una sola volta)`)) { tot += d; sarto.srv.sarto = false; log(`${sarto.nome} (sarto) sposta la reazione a ${tot}.`); }
    break;
  }
  if (i.benedizioneModReazione) {
    const c = eroiAttivi().find(x => i.benedizioneModReazione.classi.includes(x.classe) && (x.classe === 'chierico' ? (x.usi?.benedizione || 0) < 3 : (x.incantesimi || []).some(s => s.nome === 'Benedizione' && !s.usato)));
    if (c) {
      const opz = [[0, `Tieni ${tot}: ${az(tot)}`]]; for (const d of [-1, 1]) if (tot + d >= 1 && tot + d <= 6) opz.push([d, `${d > 0 ? '+1' : '-1'} → ${tot + d}: ${az(tot + d)}`]);
      const k = await scelta('Benedizione sul drago', `${c.nome} può lanciare Benedizione per spostare di 1 il tiro di reazione (${tot}).`, opz);
      if (k) { tot += k; if (c.classe === 'chierico') c.usi.benedizione++; else c.incantesimi.find(s => s.nome === 'Benedizione' && !s.usato).usato = true; log(`${c.nome} lancia Benedizione: reazione ${tot}.`); }
    }
  }
  return tot;
}

/** Morale: se cade un mercenario o un PG i mercenari tirano 1d6 (4+, 3+ con Leader carismatico). */
export async function moraleMercenari(chi) {
  const m = S.party.eroi.filter(x => x.merc && x.stato === 'ok' && !x.fanatico); if (!m.length) return;
  const lead = ordineMarcia().slice(0, 2).some(x => x.stato === 'ok' && haAbilita(x, 'leader-carismatico'));
  for (const x of m) {
    const r = await dado(`Morale di ${x.nome} (mercenario)`), cantastorie = eroiVivi().some(y => y.srv?.cantastorie && !y.srv.cantastorieUsato) && !x.moraleFatto;
    const tot = r.totale + (x.mercMor || 0) + (lead ? 1 : 0) + (cantastorie ? 1 : 0) + (x.parteTesoro ? 1 : 0); x.moraleFatto = true;
    if (cantastorie) eroiVivi().forEach(y => { if (y.srv?.cantastorie) y.srv.cantastorieUsato = true; });
    if (tot < 4) { log(`${x.nome} (mercenario) fugge dopo la morte di ${chi?.nome || chi}: non tornerà mai.`); S.party.eroi = S.party.eroi.filter(y => y !== x); S.party.ordine = S.party.ordine.filter(id => id !== x.id); } else log(`${x.nome} resiste (morale ${tot}).`);
  }
  modificato('party');
}

// =============================================================
//  ABILITÀ E INCANTESIMI AVANZATI
// =============================================================
/** Catalogo delle abilità avanzate dell'Abisso, filtrate per classe. */
export const abilitaPerClasse = e => R.abisso.abilita.filter(a => a.classi.includes(e.classe) || V.abilitaNomi(e.classe).includes(a.nome) || AL.abilitaNomi(e.classe).includes(a.nome));   // + le classi dei Labirinti Silvani
/** Voce di abilità con eventuale scelta del bersaglio (Nemico giurato, Resistente). Restituisce null se annullato. */
export async function sceltaAbilita(a) {
  const voce = { id: a.id };
  if (a.id === 'nemico-giurato' || a.id === 'resistente') {
    const tabs = a.id === 'resistente' ? ['infestanti', 'seguaci'] : ['seguaci', 'aberranti', 'boss'];
    const opz = []; for (const t of tabs) for (const m of mostriTabella(t) || []) opz.push([m.id, m.nome, t]);
    for (const src of [R.mostri, R.avanzate.mostri, R.caos.mostri, R.abisso.mostri]) for (const t of tabs) for (const m of src[t] || []) if (!opz.some(o => o[0] === m.id)) opz.push([m.id, m.nome, t]);
    const k = await scelta(a.nome, `Contro quale tipo di mostro (${tabs.join(', ')})?`, opz.map(([id, n, t]) => [id, n, t]));
    if (!k) return null; voce.bersaglio = k;
  }
  return voce;
}
const incantesimiAvanzatiHero = e => e.avanzati = e.avanzati || [];
/** Aggiunge l'abilità all'eroe (rispettando le abilità non ripetibili). */
export function impara(e, voce) {
  const a = R.abisso.abilita.find(x => x.id === voce.id) || R.profondita?.abilita.find(x => x.id === voce.id);
  (e.abilita = e.abilita || []).push(voce);
  log(`${e.nome} impara l’abilità avanzata «${a?.nome || voce.id}».`);
  if (voce.id === 'furia-del-berserker') log('Un attacco furioso in più per avventura.');
  modificato('party');
}
export function pozioniDisponibili() { return R.abisso.artigiani.find(a => a.id === 'r-alchimista').pozioni; }

/** Incantesimi avanzati (si lanciano una volta per avventura come gli altri: tasto «Lancia»). */
export const AVANZATI_LANCIABILI = ['Aura di Terrore', 'Dardo Infallibile', 'Ondata di Guarigione', 'Scambio Vitale', 'Teletrasporto di Massa'];
export async function lanciaAvanzato(e, nome, rimborsa, bersaglioId) {
  const i = C.inc(), inCombattimento = i && i.stato === 'combattimento';
  const livCaster = ['mago', 'elfo'].includes(e.classe) ? e.livello : 1;
  const nota = t => C.nota(`${e.nome} lancia ${nome}: ${t}`);
  switch (nome) {
    case 'Ondata di Guarigione': {
      for (const x of eroiVivi().filter(y => y.id !== e.id && y.stato !== 'morto')) x.pv = Math.min(x.pvMax, x.pv + 2);
      nota('tutti i compagni recuperano 2 PV.'); if (inCombattimento && (i.tag || []).includes('vampiro')) { nota('il vampiro subisce 2 ferite.'); await C.applicaDanni(2); } break;
    }
    case 'Scambio Vitale': {
      const b = eroePerId(bersaglioId) !== e && bersaglioId ? eroePerId(bersaglioId) : null;
      if (inCombattimento && (i.tag || []).includes('vampiro') && await scelta('Scambio Vitale', 'Lo dirigi contro il vampiro?', [[true, 'Sì, contro il vampiro'], [false, 'No, cura un compagno']])) {
        const n = await scelta('Scambio Vitale', 'Quante ferite infliggi a entrambi?', Array.from({ length: Math.max(1, e.pv - 1) }, (_, k) => [k + 1, String(k + 1)])) || 1;
        nota(`${n} ferite al vampiro e a ${e.nome}.`); C.perdiPV(e, n, 'Scambio Vitale'); await C.applicaDanni(n); break;
      }
      const dst = b || (await K.eroeScelto('Chi viene curato?', x => x.id !== e.id && x.stato === 'ok' && x.pv < x.pvMax));
      if (!dst) { rimborsa(); return; }
      const max = Math.min(e.pv - 1, dst.pvMax - dst.pv); if (max < 1) { rimborsa(); toast('Nessuno scambio possibile.', 'warn'); return; }
      const n = await scelta('Scambio Vitale', `Quanti PV perde ${e.nome} per curare ${dst.nome}?`, Array.from({ length: max }, (_, k) => [k + 1, String(k + 1)])) || 1;
      C.perdiPV(e, n, 'Scambio Vitale'); dst.pv = Math.min(dst.pvMax, dst.pv + n); nota(`${dst.nome} guarisce ${n} PV.`); break;
    }
    case 'Teletrasporto di Massa': {
      const stanze = (adv().tessere || []).filter(t => !t.pending);
      const dest = await scelta('Teletrasporto di Massa', 'Dove vai? (qualunque stanza già visitata)', stanze.map(t => [t.id, t.nome + (t.corridoio ? ' (corridoio)' : '')]));
      if (!dest) { rimborsa(); return; }
      const compagni = await sceltaMultipla('Teletrasporto di Massa', `Chi viene trasportato con ${e.nome}? (1 ferita per ogni altro essere)`, S.party.eroi.filter(x => x.id !== e.id && x.stato !== 'morto' && x.stato !== 'pazzo').map(x => [x.id, x.nome]));
      if (compagni.length) C.perdiPV(e, compagni.length, 'Teletrasporto di Massa');
      for (const id of [e.id, ...compagni]) { const x = eroePerId(id); if (x) x.posizione = dest; }
      adv().stanzaCorrente = dest; nota(`il gruppo si sposta in ${G.tileById(dest)?.nome}.`);
      if (inCombattimento && eroiAttivi().every(x => x.posizione === dest) && i.tessera !== dest) C.sottrarsiIndenne('Teletrasporto di Massa'); break;
    }
    case 'Aura di Terrore': {
      if (!inCombattimento) { rimborsa(); toast('Serve un combattimento in corso.', 'warn'); return; }
      if ((i.tag || []).includes('non-morto') || i.noMorale || i.paura || i.bossFinale) { nota(`${i.nome} è immune.`); break; }
      if (i.minore && i.leaderInc && !i.leaderInc.morto) {
        const L = i.leaderInc, r = await dado(`Morale del leader ${L.nome}`);
        if (r.totale + (L.moraleMod || 0) <= 3) { nota(`${L.nome} fugge e i seguaci con lui.`); i.leaderInc = null; i.tesoroPreso = true; await C.sottraiFuga(); } else nota(`${L.nome} resiste: i seguaci non tirano il morale.`);
        break;
      }
      nota(`${i.nome} deve tirare il morale.`); i.moraleFatto = false; await C.tiraMorale(); break;
    }
    case 'Dardo Infallibile': {
      if (!inCombattimento) { rimborsa(); toast('Serve un combattimento in corso.', 'warn'); return; }
      let tot = 0; const dardi = e.livello >= 8 ? 2 : 1;
      for (let d = 0; d < dardi; d++) { tot++; for (let k = 0; k < 8; k++) { const x = await dado8(`Dardo Infallibile di ${e.nome} (7-8 = ferita in più)`); if (x.totale >= 7) tot++; else break; } }
      nota(`${tot} ${i.minore ? 'uccisi' : 'ferite'} (${dardi} dard${dardi > 1 ? 'i' : 'o'}).`); i.fonte = 'incantesimo'; await C.applicaDanni(tot); break;
    }
  }
  modificato();
}
/** Rifletti Sguardo: lanciato in automatico quando si deve salvare da uno sguardo. Restituisce true se l'eroe è al sicuro. */
export async function rifletti(e) {
  const s = (e.incantesimi || []).find(x => x.nome === 'Rifletti Sguardo' && !x.usato); if (!s) return false;
  s.usato = true; const i = C.inc();
  C.nota(`${e.nome} lancia Rifletti Sguardo: è al sicuro dallo sguardo.`);
  if (i && i.stato === 'combattimento') {
    const x = await tira('1d8', `Rifletti Sguardo: 1d8+L di ${e.nome} contro LIV ${i.liv}`);
    if (x.totale + e.livello >= i.liv) { C.nota(`${i.nome} subisce il proprio sguardo!`); await C.applicaDanni(i.id === 'catoblepa' ? 1 : i.pv); }
  }
  modificato('party'); return true;
}

// =============================================================
//  PERICOLI: peste, licantropia, cure, follia
// =============================================================
export async function esponiPeste(e, liv = 10, motivo = 'Peste oscura') {
  if (e.peste || e.pesteImmune || e.pozioni?.vigore || e.stato === 'morto') return false;
  const ok = await C.salva(e, liv, e.classe === 'mezzuomo' ? mezzo(e) : 0, `${motivo} (malattia)`);
  if (ok) { e.pesteImmune = true; log(`${e.nome} è immune alla peste per questa avventura.`); } else { e.peste = true; log(`${e.nome} è ammalato di peste oscura: a ogni stanza tira 1d8 e con 1 perde 1 PV.`); }
  modificato('party'); return !ok;
}
/** Dopo ogni stanza: gli infetti tirano 1d8 (con 1 perdono 1 PV) e contagiano i compagni. */
export async function dopoStanza() {
  if (!abissoAttivo()) return;
  const infetti = eroiVivi().filter(e => e.peste && e.stato === 'ok'); if (!infetti.length) return;
  for (const e of infetti) { const x = await dado8(`Peste oscura: ${e.nome} (1 = -1 PV)`); if (x.totale === 1) C.perdiPV(e, 1, 'peste oscura'); }
  for (const e of eroiVivi().filter(x => x.stato === 'ok' && !x.peste)) await esponiPeste(e, 10, 'Contagio di peste oscura');
}
export function curaPeste(e) { e.peste = false; e.pesteImmune = true; log(`${e.nome} guarisce dalla peste oscura ed è immune per l’avventura.`); modificato('party'); }
/** Benedizione lanciata su `b` (da `inc`): toglie malus e malattie semplici, prova a curare la peste, toglie 1 follia. */
export async function dopoBenedizione(incantatore, b) {
  AL.dopoBenedizione(b);
  b.marchiato = false; b.orrore = false; b.campanellini = false; b.paralizzato = false;
  if (!abissoAttivo()) return;
  if (b.peste) { const x = await tira('1d8', `Benedizione contro la peste: 1d8+${incantatore.livello}`); if (x.totale + incantatore.livello >= 10) curaPeste(b); else log('La Benedizione non basta: la peste resta.'); }
  if ((b.follia || 0) > 0) { K.follia(b, -1); }
  modificato('party');
}
export async function curaLicantropia(e) {
  if (!e.licantropia) return;
  if (!(await confirmBox(`Il monastero chiede 400 p.o. Procedere con la cura di ${e.nome}?`))) return;
  if (prendiOro(400, [e, ...eroiVivi().filter(x => x !== e)]) < 400 && oroGruppo() < 0) return;
  const r = await C.dE(e, `Cura della licantropia – ${e.nome} (maledizione L5, +1)`), tot = r.totale + 1 + (['elfo', 'mezzuomo'].includes(e.classe) ? mezzo(e) : 0);
  if (r.naturale === 1) { e.stato = 'morto'; log(`${e.nome} muore avvelenato dall’infuso (resurrezione 1000 p.o., resterà maledetto).`); }
  else if (tot >= 5) { e.licantropia = false; if (r.tiri.length > 1) { e.licantropiaImmune = true; log(`${e.nome} è guarito e immune per sempre alla licantropia.`); } else log(`${e.nome} è guarito dalla licantropia.`); }
  else log(`${e.nome} non guarisce: può riprovare per altri 400 p.o.`);
  modificato('party');
}
/** Costo di cure e rituali dei pericoli per il pannello dello stato. */
export const statiAbisso = e => [e.follia > 0 && `Follia ${e.follia}`, e.licantropia && 'Licantropia', e.peste && 'Peste oscura', e.vampirizzato && 'Vampirizzato', e.livelliPersi > 0 && `Livelli persi ${e.livelliPersi}`, e.paralizzato && 'Paralizzato', e.marchiato && 'Marchiato'].filter(Boolean);

// =============================================================
//  INGRESSO, FINE AVVENTURA, TIRI ES
// =============================================================
/** Avviso quando non tutti i personaggi sono almeno al 5° livello. Restituisce false se l'utente rinuncia. */
export async function controlloIngresso() {
  const bassi = eroiVivi().filter(e => !e.png && e.livello < 5);
  if (!bassi.length) return true;
  return await confirmBox(`Il supplemento «Contro l’Abisso» è pensato per gruppi di 5° livello che hanno speso 1 tiro ES o 500 p.o. a testa. Non tutti i personaggi lo sono (${bassi.map(e => `${e.nome} ${e.livello}°`).join(', ')}): il manuale lo sconsiglia (meglio almeno il 3° livello) ma non lo vieta. Scendere comunque? I personaggi di livello base tirano il d6.`);
}
/** Dado del tiro ES: nell'Abisso 1d8+2 per gli esperti; in un dungeon base 1d6 (set base) o 1d6+1 (avanzate e caos). */
export function profiloES(e, set) {
  const esperto = abissoAttivo() && e.livello >= 5;
  if (!esperto) return { d8: false, bonus: 0, esperto };
  if (set === 'abisso' || set === 'profondita' || set === 'aldila') return { d8: true, bonus: 2, esperto };
  return { d8: false, bonus: set === 'base' ? 0 : 1, esperto };
}
/** Tiri ES e incontri con seguaci/infestanti nell'Abisso. */
export const ES_PER_MAGGIORE = 2;
export const INCONTRI_PER_ES = 5;
/** Pannello di scelta della posta del tiro ES: livello, abilità avanzata o incantesimo avanzato. Restituisce null se annullato. */
export async function sceltaPostaES(e, puoSalire = true) {
  const opz = puoSalire ? [['livello', 'Salire di livello', `${e.livello}° → ${e.livello + 1}°`]] : [];
  if (e.livello >= 5) opz.push(['abilita', 'Imparare un’abilità avanzata', `${abilitaPerClasse(e).filter(a => !(e.abilita || []).some(x => x.id === a.id && a.id !== 'resistente')).length} disponibili`]);
  if (e.livello >= 5 && ['mago', 'elfo'].includes(e.classe)) opz.push(['incantesimo', 'Imparare un incantesimo avanzato', `${NOMI_AVANZATI().filter(n => !incantesimiAvanzatiHero(e).includes(n)).length} disponibili`]);
  opz.push(...V.postaExtra(e));   // druido: incantesimi avanzati; compagni animali e cavalcature
  if (!opz.length) { toast('Nessuna scelta possibile con questo tiro.', 'warn'); return null; }
  if (opz.length === 1 && opz[0][0] === 'livello') return { tipo: 'livello' };
  const k = await scelta(`Tiro ES di ${e.nome}`, 'Che cosa tenti con questo tiro? (la scelta si fa prima di tirare)', opz);
  if (!k) return null;
  if (k === 'livello') return { tipo: 'livello' };
  if (String(k).startsWith('silv:')) return await V.risolviPosta(e, k);
  if (k === 'abilita') {
    const mie = e.abilita || [], lista = abilitaPerClasse(e).filter(a => a.id === 'resistente' || !mie.some(x => x.id === a.id));
    if (!lista.length) { toast('Nessuna abilità disponibile.', 'warn'); return null; }
    const id = await scelta('Abilità avanzata', 'Quale abilità vuoi imparare?', lista.map(a => [a.id, a.nome, a.effetto]));
    if (!id) return null; const voce = await sceltaAbilita(lista.find(a => a.id === id)); return voce ? { tipo: 'abilita', voce } : null;
  }
  const lista = R.abisso.incantesimi.filter(s => !incantesimiAvanzatiHero(e).includes(s.nome));
  const n = await scelta('Incantesimo avanzato', 'Quale incantesimo vuoi imparare?', lista.map(s => [s.nome, s.nome, s.effetto]));
  return n ? { tipo: 'incantesimo', nome: n } : null;
}
export function applicaPosta(e, posta) {
  if (['promozione-compagno', 'cavalcatura-compagno', 'incantesimo-druido'].includes(posta.tipo)) { V.applicaPosta(e, posta).catch(err => console.error(err)); return; }
  if (posta.tipo === 'abilita') impara(e, posta.voce);
  else if (posta.tipo === 'incantesimo') { incantesimiAvanzatiHero(e).push(posta.nome); log(`${e.nome} aggiunge «${posta.nome}» al grimorio.`); modificato('party'); }
}

/** All'inizio dell'avventura nell'Abisso o con il supplemento attivo: oggetti creati dalle abilità, stati da ripristinare. */
export async function inizioAvventura() {
  if (!abissoAttivo()) return;
  S.party.servigi = S.party.servigi || 0;
  for (const e of S.party.eroi) {
    if (e.stato === 'morto' || e.merc) continue;
    Object.assign(e, { paralizzato: false, marchiato: false, illuso: false, orrore: false, campanellini: false, avvelenatoAtt: 0, cestoIngombrante: false, vendetta: false, incenso: false, settaVampiri: false, segretiAb: [], fortunaExtra: 0, folliaRimossa: false, attesa4: false });
    if (e.stato === 'lupo') e.stato = 'ok';
    if (haAbilita(e, 'creare-acqua-santa') && (e.oro || 0) >= 10) { e.oro -= 10; (e.oggetti = e.oggetti || []).push({ nome: 'Acqua santa', qta: 1, nota: 'Fiala creata (10 p.o.): 1 ferita a un vampiro' }); log(`${e.nome} crea una fiala di acqua santa (10 p.o.).`); }
    if (haAbilita(e, 'creare-pergamene') && (e.oro || 0) >= 80) {
      const nomi = [...new Set(e.classe === 'chierico' ? ['Benedizione'] : [...(e.incantesimi || []).map(s => s.nome), ...(e.avanzati || [])])];
      if (nomi.length) { const n = await scelta('Creare pergamene', `${e.nome} scrive una pergamena (80 p.o. di materiali). Quale incantesimo?`, [...nomi.map(x => [x, x]), [null, 'Nessuna']]); if (n) { e.oro -= 80; (e.oggetti = e.oggetti || []).push({ nome: `Pergamena: ${n}`, qta: 1, tipo: 'pergamena', nota: `Pergamena creata: ${n}`, cariche: 1, caricheMax: 1, incantesimo: n, consuma: true }); log(`${e.nome} scrive una pergamena di ${n}.`); } }
    }
  }
}
/** Alla fine dell'avventura: follia recuperata, alchimista, congedo dei mercenari, ripristino degli stati temporanei. */
export async function fineAvventura(esito) {
  if (!abissoAttivo() && !(S.party.alchimista)) return;
  const sconfitta = /sconfitt/i.test(esito || '');
  for (const e of S.party.eroi) {
    if (e.stato === 'morto' || e.merc) continue;
    if (!sconfitta && (adv().maggioriSconfitti || 0) > 0 && (e.follia || 0) > 0 && !e.folliaRimossa) { e.folliaRimossa = true; K.follia(e, -1); log(`${e.nome} esce dal dungeon e recupera 1 punto follia.`); }
    e.pozioni = {}; e.srv = {}; e.pesteImmune = false; e.paralizzato = false; e.illuso = false; e.vendetta = false; e.settaVampiri = false; e.cestoIngombrante = false; e.avvolto = false;
    if (e.stato === 'lupo') e.stato = 'ok';
  }
  const m = S.party.eroi.filter(x => x.merc);
  if (m.length) { S.party.eroi = S.party.eroi.filter(x => !x.merc); S.party.ordine = S.party.ordine.filter(id => !m.some(x => x.id === id)); log(`I mercenari (${m.map(x => x.nome).join(', ')}) sono congedati: il compenso valeva per una sola avventura.`); }
  const al = S.party.alchimista;
  if (al) {
    const p = pozioniDisponibili().find(x => x.id === al.pozione), dest = eroePerId(al.eroeId) || eroiVivi()[0];
    const r = p.difficolta ? (await dado(`Alchimista: ${p.nome} (1d6 deve superare ${p.difficolta})`)).totale : 7;
    if (dest && r > (p.difficolta || 0)) { (dest.oggetti = dest.oggetti || []).push({ nome: p.nome, qta: 1, pozId: p.id === 'guarigione' ? undefined : p.id, nota: p.effetto }); log(`L’alchimista consegna ${p.nome} a ${dest.nome}.`); } else log(`L’alchimista fallisce: ${p.nome} non è riuscita (materiali persi).`);
    S.party.alchimista = null;
  }
  S.party.servigi = 0;
  modificato('party');
}

// =============================================================
//  ALLEATI: mercenari e artigiani (negozio) e azioni degli oggetti
// =============================================================
const ARMI_MERC = { 'm-accolito': ['una-mano-contundente', 'leggera'], 'm-armigero': ['una-mano-taglio', 'leggera', true], 'm-attendente': ['leggera-taglio', 'leggera'], 'm-cerusico': ['leggera-taglio', 'nessuna'],
  'm-guardia-corpo': ['una-mano-taglio', 'leggera', true], 'm-guida': ['leggera-taglio', 'leggera'], 'm-lanterniere': ['una-mano-taglio', 'leggera'], 'm-menestrello': ['leggera-taglio', 'nessuna'],
  'm-portatore': ['leggera-taglio', 'leggera'], 'm-sterminatore-ratti': ['una-mano-taglio', 'leggera'] };
function creaMercenario(m, livelliGuida = 1) {
  const e = nuovoEroe('guerriero', m.nome), [arma, arm, scudo] = ARMI_MERC[m.id] || ['leggera-taglio', 'nessuna'];
  Object.assign(e, { livello: 0, pvMax: m.pv, pv: m.pv, oro: 0, png: 'mercenario', merc: m.id, mercMor: m.mor || 0, mercAtt: m.modAttacco || 0, armi: [arma], armaPrincipale: arma, armatura: arm, scudo: !!scudo,
    lanterna: m.id === 'm-lanterniere', posizione: adv().stanzaCorrente || null, note: `${m.effetto} (mercenario: livello 0, d6, compenso per una sola avventura).` });
  if (m.id === 'm-guida') e.guidaLivelli = livelliGuida;
  return e;
}
export async function ingaggia(m) {
  const attivi = S.party.eroi.filter(x => x.merc && x.stato !== 'morto').length;
  if (attivi >= (R.abisso.mercenariRegole.massimo || 2)) { toast('Al massimo 2 mercenari.', 'warn'); return false; }
  if (m.requisiti?.length && m.id === 'm-accolito' && !eroiVivi().some(e => e.classe === 'chierico')) { toast('L’accolito serve un chierico nel gruppo.', 'warn'); return false; }
  if (m.id === 'm-armigero' && eroiVivi().some(e => ['barbaro', 'guerriero', 'nano'].includes(e.classe))) { toast('L’armigero si assolda solo se nel gruppo non ci sono barbari, guerrieri o nani.', 'warn'); return false; }
  let costo = m.costo, liv = 1;
  if (m.id === 'm-guida') { liv = await scelta('Guida', 'Quanti livelli? (7 p.o. per livello, ogni livello = 1 ripetizione di tiro per avventura)', [1, 2, 3, 4].map(n => [n, `${n} livell${n > 1 ? 'i' : 'o'}`, `${7 * n} p.o.`])); if (!liv) return false; costo = 7 * liv; }
  if (oroGruppo() < costo) { toast(`Servono ${costo} p.o. (compenso anticipato).`, 'warn'); return false; }
  prendiOro(costo); const e = creaMercenario(m, liv);
  S.party.eroi.push(e); S.party.ordine.push(e.id); log(`${m.nome} si unisce al gruppo (compenso ${costo} p.o., livello 0, d6).`);
  modificato('party'); return true;
}
const servigiRimasti = () => 3 - (S.party.servigi || 0);
/** Servigio di un artigiano su un eroe (effetto registrato in e.srv per la prossima avventura). */
export async function assolda(a) {
  if (servigiRimasti() <= 0) { toast('Al massimo 3 servigi di artigiani tra un’avventura e l’altra.', 'warn'); return false; }
  const vivi = eroiVivi().filter(e => !e.merc && e.stato !== 'pietra');
  const chi = await K.eroeScelto(`${a.nome}: per chi?`, x => !x.merc && x.stato !== 'morto' && x.stato !== 'pazzo') || vivi[0]; if (!chi) return false;
  let costo = a.costo; const sr = chi.srv = chi.srv || {};
  if (a.id === 'r-chiromante' && chi.classe === 'barbaro') { toast('I barbari non vanno dalla chiromante.', 'warn'); return false; }
  if (a.id === 'r-esperto-veleni' && !(chi.classe === 'furfante' && chi.livello >= 5)) { toast('Serve un furfante di 5° livello o più.', 'warn'); return false; }
  if (a.id === 'r-confessore' && (chi.folliaRimossa || (chi.follia || 0) < 1)) { toast(chi.folliaRimossa ? 'Ha già rimosso 1 punto follia in questa pausa.' : 'Non ha punti follia.', 'warn'); return false; }
  if (a.id === 'r-fabbro') { const due = await scelta('Fabbro', 'Che cosa rivesti d’argento?', [[20, 'Arma da taglio a una mano (20 p.o.)'], [40, 'Arma da taglio a due mani (40 p.o.)'], [20, 'Punte di 5 frecce (20 p.o.)']]); if (!due) return false; costo = due; }
  if (a.id === 'r-alchimista') {
    if (S.party.alchimista) { toast('Hai già un alchimista al lavoro (uno solo).', 'warn'); return false; }
    const p = await scelta('Alchimista', 'Quale pozione prepara? (materiali pagati in anticipo; a fine avventura 1d6 deve superare la difficoltà)', pozioniDisponibili().map(x => [x.id, `${x.nome} (${x.costo} p.o.)`, `${x.difficolta ? 'Difficoltà ' + x.difficolta : 'Automatica'} · ${x.effetto}`]));
    if (!p) return false; const pz = pozioniDisponibili().find(x => x.id === p); costo += pz.costo;
    if (oroGruppo() < costo) { toast(`Servono ${costo} p.o.`, 'warn'); return false; }
    prendiOro(costo); S.party.alchimista = { pozione: p, eroeId: chi.id }; S.party.servigi = (S.party.servigi || 0) + 1; log(`L’alchimista lavora su ${pz.nome} per ${chi.nome} (${costo} p.o.).`); modificato('party'); return true;
  }
  if (oroGruppo() < costo) { toast(`Servono ${costo} p.o.`, 'warn'); return false; }
  switch (a.id) {
    case 'r-armaiolo': sr.armaiolo = true; break;
    case 'r-cantastorie': sr.cantastorie = true; break;
    case 'r-chiromante': { const x = await tira('2d8', 'Chiromante (2d8: scegli un risultato)'); const k = await scelta('Chiromante', `Hai tirato ${x.dadi.join(' e ')}. Quale risultato conservi?`, x.dadi.map(v => [v, String(v)])); chi.chiromante = k || x.dadi[0]; log(`${chi.nome} conserva il valore ${chi.chiromante} (sostituisce un tiro qualsiasi).`); break; }
    case 'r-confessore': K.follia(chi, -1); chi.folliaRimossa = true; break;
    case 'r-erborista': sr.erborista = true; break;
    case 'r-esperto-veleni': sr.veleno = { usato: false }; break;
    case 'r-fabbricante-scudi': sr.scudo = true; sr.scudoRipeti = true; break;
    case 'r-fabbro': (chi.armiArgento = chi.armiArgento || []).push(chi.armaPrincipale); break;
    case 'r-saggio': sr.saggio = true; break;
    case 'r-sarto': sr.sarto = true; break;
  }
  prendiOro(costo); S.party.servigi = (S.party.servigi || 0) + 1; log(`${a.nome}: ${costo} p.o. per ${chi.nome} (${a.effetto}).`);
  modificato('party'); return true;
}
/** Sezione «Alleati» del negozio. */
export function sezioneAlleati(rinfresca) {
  const box = h('div', { class: 'tratti' });
  const m = R.abisso.mercenari, ar = R.abisso.artigiani, attivi = S.party.eroi.filter(x => x.merc);
  box.append(h('h4', {}, `Mercenari (max 2, compenso anticipato per una avventura) – ingaggiati: ${attivi.map(x => x.nome).join(', ') || 'nessuno'}`));
  m.forEach(x => box.append(h('div', { class: 'row', title: x.effetto }, h('span', { class: 'grow' }, h('b', {}, x.nome), ` (${x.id === 'm-guida' ? '7 p.o. per livello' : x.costo + ' p.o.'}, ${x.pv} PV) – ${x.effetto}`), h('button', { class: 'mini', onclick: async () => { if (await ingaggia(x)) rinfresca(); } }, 'Ingaggia'))));
  box.append(h('h4', {}, `Artigiani (servigi usati tra le avventure: ${S.party.servigi || 0}/3)`));
  ar.forEach(x => box.append(h('div', { class: 'row', title: x.effetto }, h('span', { class: 'grow' }, h('b', {}, x.nome), ` (${x.costo ? x.costo + ' p.o.' : ''}) – ${x.effetto}`), h('button', { class: 'mini', onclick: async () => { if (await assolda(x)) rinfresca(); } }, 'Assolda'))));
  if (S.party.alchimista) box.append(h('small', { class: 'hint' }, `Alchimista al lavoro: ${pozioniDisponibili().find(x => x.id === S.party.alchimista.pozione)?.nome}.`));
  return box;
}

/** Azioni degli oggetti dell'Abisso fuori dal combattimento (finestra «Oggetti» dell'eroe). */
export function azioniOggetti(e, close) {
  const out = [];
  for (const o of (e.oggetti || []).filter(x => x.pozId)) out.push(h('button', { onclick: () => { (e.pozioni = e.pozioni || {})[o.pozId] = true; e.oggetti = e.oggetti.filter(x => x !== o); log(`${e.nome} usa ${o.nome}: ${o.nota}`); modificato('party'); close(); } }, `Usa: ${o.nome}`));
  const pane = inv(e, /pane elfico/i);
  if (pane) out.push(h('button', { onclick: () => {
    if (e.usi?.pane) return toast('Ha già mangiato pane elfico in questa avventura.', 'warn');
    e.usi = e.usi || {}; e.usi.pane = 1; const q = e.classe === 'elfo' ? 3 : 1; e.pv = Math.min(e.pvMax, e.pv + q); if (e.peste) curaPeste(e);
    if ((pane.qta || 1) > 1) pane.qta--; else e.oggetti = e.oggetti.filter(x => x !== pane); log(`${e.nome} mangia pane elfico (+${q} PV).`); modificato('party'); close();
  } }, 'Mangia pane elfico (1 PV, elfi 3; cura la peste)'));
  const ferro = inv(e, /ferro di cavallo/i);
  if (ferro && e.classe !== 'barbaro') out.push(h('button', { onclick: () => { e.oggetti = e.oggetti.filter(x => x !== ferro); log(`${e.nome} usa il ferro di cavallo fortunato: ripete un tiro (da fare a mano).`); modificato('party'); close(); } }, 'Usa il ferro di cavallo (ripeti 1 tiro)'));
  if ((e.fortunaExtra || 0) > 0) out.push(h('button', { onclick: () => { e.fortunaExtra--; log(`${e.nome} spende un punto fortuna: ripete un tiro (da fare a mano).`); modificato('party'); close(); } }, `Punto fortuna (${e.fortunaExtra}): ripeti un tiro`));
  if (e.chiromante) out.push(h('button', { onclick: () => { log(`${e.nome} usa il valore del chiromante (${e.chiromante}) al posto di un tiro.`); e.chiromante = 0; modificato('party'); close(); } }, `Usa il valore del chiromante (${e.chiromante})`));
  if (e.stato === 'ok' && e.classe === 'chierico') { /* le benedizioni sono nella scheda dell'incontro */ }
  return out;
}

/** Carta «Alleati e segreti» negli Strumenti. */
export function cartaAbisso() {
  const bt = [];
  for (const e of eroiVivi().filter(x => x.stato === 'ok')) {
    if (haAbilita(e, 'conciatore-arcano')) for (const [n, nota] of [['Pelle di drago', 'Veste non magica: +1 ai TS contro il soffio e +1 in difesa contro i draghi'], ['Pelliccia di pantera distorcente', 'Cappa: Fuga come mago di 6° livello, 1 volta per avventura (non per barbari)']]) bt.push(h('button', { onclick: () => { (e.oggetti = e.oggetti || []).push({ nome: n, qta: 1, nota }); log(`${e.nome} (Conciatore arcano) crea: ${n}.`); modificato('party'); } }, `Conciatore arcano: crea ${n.toLowerCase()} (${e.nome})`));
    if (e.merc === 'm-cerusico') for (const p of eroiVivi().filter(x => !x.merc && x.stato === 'ok')) if (!(p.usi || {}).cerusico && p.pv < p.pvMax) bt.push(h('button', { onclick: () => { p.usi = p.usi || {}; p.usi.cerusico = 1; p.pv = Math.min(p.pvMax, p.pv + 2); log(`${e.nome} cura ${p.nome} di 2 PV.`); modificato('party'); } }, `Cerusico: cura ${p.nome} (+2 PV)`));
    if (e.merc === 'm-menestrello' && !(e.usi || {}).canzone) bt.push(h('button', { onclick: () => { e.usi = e.usi || {}; e.usi.canzone = 1; eroiVivi().filter(x => !x.merc && (x.follia || 0) > 0).forEach(x => K.follia(x, -1)); log(`${e.nome} canta: -1 follia a tutti.`); } }, 'Menestrello: canzone (-1 follia a tutti)'));
    if (haAbilita(e, 'udito-formidabile') && !adv().anticipato) bt.push(h('button', { onclick: () => ascolta(e) }, `Ascolta alla porta (${e.nome}, Udito formidabile)`));
    for (const s of e.segretiAb || []) bt.push(h('button', { onclick: () => usaSegreto(e, s) }, `Segreto «${s.nome}» (${e.nome})`));
  }
  const vf = adv().vampiroFuggito;
  if (vf && !adv().vampiroDaRincontrare) {
    const costo = eroiVivi().some(x => haAbilita(x, 'cacciatore-di-vampiri')) ? 1 : 2, indizi = eroiVivi().reduce((a, x) => a + (x.indizi || 0), 0);
    bt.push(h('button', { disabled: indizi < costo, title: `Servono ${costo} indizi (ne hai ${indizi})`, onclick: () => {
      let resto = costo; for (const x of [...eroiVivi()].sort((a, b) => (b.indizi || 0) - (a.indizi || 0))) { const k = Math.min(x.indizi || 0, resto); x.indizi -= k; resto -= k; }
      adv().vampiroDaRincontrare = vf; log(`Spesi ${costo} indizi: il vampiro fuggito attende nella prossima stanza (contenuto non tirato).`); modificato('party');
    } }, `Rincontra il vampiro fuggito (${costo} indizi)`));
  }
  if (!bt.length) return h('small', { class: 'hint' }, 'Nessuna azione di alleati, segreti o abilità da usare ora.');
  return h('div', { class: 'tools' }, ...bt);
}
async function ascolta(e) {
  const r = await C.dE(e, `Udito formidabile – ${e.nome} (6 o più)`);
  if (r.naturale === 1 || r.totale < 6) { log(`${e.nome} non sente nulla di chiaro dietro la porta.`); return; }
  const x = await tira('2d6', 'Contenuto della stanza (anticipato)'); adv().anticipato = x.totale; log(`${e.nome} ascolta alla porta: il contenuto è già tirato (${x.totale}); i mostri non sorprenderanno il gruppo.`); modificato();
}

// ---- segreti dell'Abisso ----
export const segretiDisponibili = e => R.abisso.segreti.filter(s => {
  const cl = s.requisiti.join(' '), vivi = eroiVivi();
  if (/solo un elfo/.test(cl) && (e.classe !== 'elfo' || adv().principe)) return false;
  if (/chierico/.test(cl) && !vivi.some(x => x.classe === 'chierico')) return false;
  if (/mago o un nano/.test(cl) && !vivi.some(x => ['mago', 'nano'].includes(x.classe))) return false;
  if (/mezzuomo/.test(cl) && !vivi.some(x => x.classe === 'mezzuomo')) return false;
  return true;
});
/** Indizi nell'Abisso: a 3 indizi un tiro ES e la scelta tra un segreto del manuale base subito o attendere il 4° indizio per un segreto dell'Abisso. */
export async function indizio(eroe) {
  if (eroe.indizi >= 3 && !eroe.attesa4) {
    G.aggiungiES(`${eroe.nome}: segreto scoperto (3 indizi)`);
    const k = await scelta(`${eroe.nome} ha 3 indizi`, 'Che cosa scegli?', [...(abissoAttivo() && ['chierico', 'guerriero', 'paladino'].includes(eroe.classe) && S.party.supplAldila || adv().set === 'aldila' && ['chierico', 'guerriero', 'paladino'].includes(eroe.classe) ? [['aldila', 'Un segreto dell’Aldilà (Marchio dei dimenticati o Magione oscura)']] : []), ['base', 'Un segreto del manuale base (3 indizi)'], ['abisso', 'Aspetta il 4° indizio per un segreto dell’Abisso', 'Il tiro ES è già guadagnato']]);
    if (k === 'aldila') { eroe.indizi = 0; await AL.segretoAldila(eroe); return; }
    if (k === 'abisso') { eroe.attesa4 = true; log(`${eroe.nome} tiene 3 indizi in attesa del 4° (segreto dell’Abisso).`); return; }
    eroe.indizi = 0; await G.scegliSegreto(eroe); return;
  }
  if (eroe.indizi >= 4 && eroe.attesa4) {
    eroe.indizi = 0; eroe.attesa4 = false;
    const lista = segretiDisponibili(eroe);
    const id = await scelta(`${eroe.nome}: segreto dell’Abisso`, 'Scegli un segreto (costa 4 indizi):', lista.map(s => [s.id, s.nome, s.effetto]));
    const s = lista.find(x => x.id === id); if (!s) { eroe.indizi = 4; eroe.attesa4 = true; return; }
    await applicaSegreto(eroe, s);
  }
}
export async function applicaSegreto(e, s) {
  eroeSegreto(e, s.nome); log(`${e.nome} sceglie il segreto dell’Abisso «${s.nome}».`);
  switch (s.id) {
    case 'a-setta-ammazzavampiri': e.settaVampiri = true; break;
    case 'a-ascolta-mia-storia': eroiVivi().forEach(x => { if ((x.follia || 0) > 0) K.follia(x, -1); }); break;
    case 'a-divinita-proteggono': adv().divinita = { fallito: false }; break;
    case 'a-so-cucinarlo': adv().cucinato = true; break;
    case 'a-principe-elfico': adv().principe = e.id; e.segretiAb = [...(e.segretiAb || []), { id: s.id, nome: 'Principe elfico: cura fino a 4 ferite' }]; break;
    case 'a-saloni-mio-popolo': if (await confirmBox('Trovi subito una porta segreta in una stanza già visitata (disegna la stanza collegata). Procedere?')) await G.nuovaStanza({ segreta: true }); break;
    default: (e.segretiAb = e.segretiAb || []).push({ id: s.id, nome: s.nome });
  }
  modificato('party');
}
const eroeSegreto = (e, nome) => { e.segreti = [...(e.segreti || []), nome]; };
async function usaSegreto(e, s) {
  e.segretiAb = (e.segretiAb || []).filter(x => x !== s);
  switch (s.id) {
    case 'a-principe-elfico': { e.pv = Math.min(e.pvMax, e.pv + 4); log(`${e.nome} (principe elfico) si cura fino a 4 ferite. A fine avventura paga 100 p.o. di festa o perde 1 livello.`); break; }
    case 'a-hai-ucciso-miei-fratelli': e.vendetta = true; log(`${e.nome}: sete di vendetta (-1 difesa, 2 ferite per colpo contro il maggiore; combatte fino alla morte).`); break;
    case 'a-caos-si-muove': adv().caosMuove = true; log('Il caos si sta muovendo: il prossimo incontro con seguaci sarà con i fanatici del caos (1d6), +1 difesa nel 1° turno.'); break;
    case 'a-mostro-pieno-oro': adv().pienoOro = true; log('Mostro pieno d’oro: alla fine dell’incontro con il maggiore raddoppia le monete (o 50+5d6 p.o.).'); break;
    default: log(`Segreto «${s.nome}»: ${s.testo || 'applicalo a mano (vedi manuale)'}`);
  }
  modificato('party');
}

// =============================================================
//  AZIONI IN COMBATTIMENTO (bottoni) E PRIMA DELL'INCONTRO
// =============================================================
const eliminaOggetto = (e, o) => { if ((o.cariche != null && o.cariche > 1)) o.cariche--; else if ((o.qta || 1) > 1) o.qta--; else e.oggetti = e.oggetti.filter(x => x !== o); };
/** Pulsanti dei personaggi con abilità, oggetti e segreti dell'Abisso nel combattimento. `azione` è il costruttore dei pulsanti dell'interfaccia. */
export function azioniCombattimento(e, i, azione) {
  const out = [], ab = id => haAbilita(e, id), tag = i.tag || [];
  const spesa = () => { i.agito[e.id] = true; };
  const casella = (k, testo) => h('label', { class: 'chk', title: 'Da dichiarare prima del tiro di attacco' }, h('input', { type: 'checkbox', checked: !!e.dichiara?.[k], onchange: ev => { e.dichiara = e.dichiara || {}; e.dichiara[k] = ev.target.checked; modificato('party'); } }), testo);
  if (ab('colpo-mortale') && !(i.usati?.[e.id + 'cm'])) out.push(casella('colpoMortale', 'Colpo mortale'));
  if (ab('vortice-di-lame') && i.minore && !(i.usati?.[e.id + 'vl'])) out.push(casella('vortice', 'Vortice di lame'));
  if (ab('scacciare-i-non-morti') && tag.includes('non-morto') && !(i.usati?.[e.id + 'sc'])) out.push(azione(e, 'Scacciare i non-morti', async () => {
    (i.usati = i.usati || {})[e.id + 'sc'] = true; spesa();
    const n = (await tira('1d6', 'Non-morti scacciati')).totale, r = await dado(`Scacciare i non-morti: 1d6+${mezzo(e)} contro LIV ${i.liv}`);
    if (r.totale + mezzo(e) >= i.liv) { C.nota(`${e.nome} scaccia ${i.minore ? Math.min(n, i.n) : 1} non-morti.`); if (i.minore) await C.applicaDanni(n); else await C.sottraiFuga(); } else C.nota(`${e.nome} non riesce a scacciarli.`);
  }, 'accent'));
  if (ab('incenso-protettivo') && !(i.usati?.[e.id + 'in'])) out.push(azione(e, 'Incenso protettivo', () => { (i.usati = i.usati || {})[e.id + 'in'] = true; const b = eroiAttivi().find(x => x.id !== e.id) || e; b.incenso = true; C.nota(`${e.nome} protegge ${b.nome} con l’incenso: +1 in difesa contro demoni e non-morti.`); modificato(); }, 'accent'));
  if (ab('combattente-acrobatico')) out.push(azione(e, 'Scambia posto (costa il turno)', async () => { const o = await K.eroeScelto('Scambia posto con chi?', x => x.id !== e.id && x.stato === 'ok'); if (!o) return; const ord = S.party.ordine, a = ord.indexOf(e.id), b = ord.indexOf(o.id); [ord[a], ord[b]] = [ord[b], ord[a]]; spesa(); C.nota(`${e.nome} e ${o.nome} si scambiano di posto.`); modificato('party'); }, 'accent'));
  const acqua = inv(e, /acqua santa/i);
  if (acqua && tag.includes('vampiro')) out.push(azione(e, 'Lancia acqua santa (1 ferita al vampiro)', async () => { eliminaOggetto(e, acqua); spesa(); C.nota(`${e.nome} getta l’acqua santa sul vampiro: 1 ferita.`); await C.applicaDanni(1); }, 'accent'));
  const esilio = (e.oggetti || []).find(o => o.abi === 'a-pergamena-esilio' && o.cariche > 0);
  if (esilio && ['mago', 'chierico'].includes(e.classe)) out.push(azione(e, 'Pergamena di esilio (2 ferite a demone/non-morto)', async () => { if (!tag.includes('non-morto') && !/demone/i.test(i.nome)) return toast('Funziona solo su demoni e non-morti.', 'warn'); e.oggetti = e.oggetti.filter(x => x !== esilio); spesa(); C.nota(`${e.nome} legge la pergamena di esilio: 2 ferite automatiche.`); await C.applicaDanni(2); }, 'accent'));
  const filtro = (e.oggetti || []).find(o => o.abi === 'a-filtro-soffio-fuoco');
  if (filtro && !i.drago) out.push(azione(e, 'Filtro del soffio di fuoco (2 ferite / 2 minori)', async () => { e.oggetti = e.oggetti.filter(x => x !== filtro); spesa(); C.nota(`${e.nome} soffia fuoco: ${i.minore ? '2 mostri uccisi' : '2 ferite'}.`); await C.applicaDanni(2); }, 'accent'));
  const anello = (e.oggetti || []).find(o => o.abi === 'a-anello-tre-desideri' && o.cariche > 0);
  if (anello) out.push(azione(e, `Anello: desiderio di 2 ferite (${anello.cariche})`, async () => { eliminaOggetto(e, anello); spesa(); C.nota(`${e.nome} esprime un desiderio: ${i.minore ? '2 mostri uccisi' : '2 ferite'}.`); await C.applicaDanni(2); }, 'accent'));
  const aconito = inv(e, /aconito/i);
  if (aconito && (tag.includes('licantropo') || /lup[oi]/i.test(i.nome))) out.push(azione(e, 'Lancia aconito (morale immediato)', async () => { eliminaOggetto(e, aconito); spesa(); C.nota(`${e.nome} lancia l’aconito: ${i.nome} tira il morale.`); i.moraleFatto = false; await C.tiraMorale(); }, 'accent'));
  const pell = inv(e, /pelliccia di pantera/i);
  if (pell && e.classe !== 'barbaro' && !(e.usi || {}).pelliccia) out.push(azione(e, 'Pelliccia di pantera: Fuga', () => { e.usi = e.usi || {}; e.usi.pelliccia = 1; spesa(); C.nota(`${e.nome} indossa la pelliccia: Fuga (come mago di 6° livello) e riappare all’ingresso.`); e.fuga = true; modificato(); }, 'accent'));
  for (const s of e.segretiAb || []) if (['a-hai-ucciso-miei-fratelli'].includes(s.id) && !i.minore) out.push(azione(e, `Segreto: ${s.nome}`, () => usaSegreto(e, s), 'accent'));
  if (e.merc === 'm-sterminatore-ratti' && /ratt|topo/i.test(i.nome) && !(i.usati?.[e.id])) out.push(azione(e, 'Sterminatore di ratti: uccide 1d6 ratti', async () => { (i.usati = i.usati || {})[e.id] = true; spesa(); const n = (await tira('1d6', 'Ratti uccisi')).totale; C.nota(`${e.nome} uccide ${n} ratti.`); await C.applicaDanni(i.minore ? n : 1); }, 'accent'));
  return out;
}
/** Azioni prima di decidere come affrontare l'incontro: medaglione dei serpenti, protezione dai folletti, segreti. */
export function preIncontro(i, btn) {
  const out = [];
  for (const e of eroiAttivi()) {
    const med = inv(e, /medaglione dell.incantatore di serpenti/i);
    if (med && (i.tag || []).includes('serpente') && i.minore && !(e.usi || {}).medaglione) out.push(btn(`Medaglione dei serpenti (${e.nome}): 1d8 + livello contro il LIV`, async () => {
      e.usi = e.usi || {}; e.usi.medaglione = 1; const x = await tira('1d8', `Medaglione: 1d8+${e.livello} contro LIV ${i.liv}`);
      if (x.totale + e.livello >= i.liv) { C.nota(`${i.nome} diventa amichevole e ignora il gruppo.`); i.reazione = { azione: 'amichevole', tiro: 0 }; i.stato = 'speciale'; } else C.nota('Il medaglione non funziona.'); modificato('avventura');
    }));
    const prot = inv(e, /protezione dai folletti/i);
    if (prot && (i.tag || []).includes('folletto') && !i.noMorale && !(e.usi || {}).protezioneF) out.push(btn(`Protezione dai folletti (${e.nome}): morale immediato`, async () => { e.usi = e.usi || {}; e.usi.protezioneF = 1; i.moraleFatto = false; await C.tiraMorale(); }));
  }
  return out;
}
/** Il tiro del tipo di mostro errante / contenuti ritirabili dai segreti: promemoria sulla carta. */
export const sogliaErranti = () => Math.max(eroiVivi().some(e => e.campanellini) ? 3 : 1, Q.sogliaErranti());

/** Carta della scheda dell'incontro: leader e campione. */
export function cartaLeader(i, btn) {
  const L = i.leaderInc; if (!L || L.morto) return null;
  const campione = i.campione ? eroePerId(i.campione) : null;
  const sel = h('select', {}, eroiAttivi().map(e => h('option', { value: e.id }, e.nome)));
  return h('div', { class: 'card' }, h('h4', {}, `Leader: ${L.nome} (LIV ${L.liv}, ${L.pv}/${L.pvMax} PV)`),
    h('p', { class: 'hint' }, i.corridoio ? 'In corridoio il leader si può attaccare solo dopo aver sconfitto tutti i seguaci. Gli incantesimi e le armi da lancio lo colpiscono solo nel 1° turno.' : (campione ? `${campione.nome} è il campione: combatte il leader in duello (usa il suo tasto «Attacca»); gli altri combattono i seguaci. Finché il leader è vivo i seguaci non tirano il morale.` : 'In una stanza un PG può essere il campione e duellare con il leader mentre gli altri combattono i seguaci. Il campione non può ritirarsi finché i seguaci non sono sconfitti.')),
    !i.corridoio && !campione ? h('div', { class: 'row' }, sel, btn('Sfida il leader', () => scegliCampione(eroePerId(sel.value)), 'accent')) : null);
}

// =============================================================
//  SCHEDA DELL'EROE: stati persistenti, addestramento, perquisizione, corruzione
// =============================================================
/** Sezione «Stati dell'Abisso» della scheda: follia, licantropia, peste oscura, vampirismo e livelli persi (modificabili). */
export function sezioneStati(e, rinfresca) {
  const box = h('div', { class: 'tratti' });
  const chk = (testo, k, titolo) => h('label', { class: 'chk', title: titolo }, h('input', { type: 'checkbox', checked: !!e[k], onchange: ev => { e[k] = ev.target.checked; modificato('party'); rinfresca(); } }), testo);
  const soglia = e.livello + (e.classe === 'mago' ? 1 : 0) + P.livelloFollia(e);
  box.append(h('h4', {}, 'Stati dell’Abisso (persistenti tra le avventure)'),
    h('p', { class: 'hint' }, `Follia ${e.follia || 0}: oltre ${soglia} punti (il mago conta un livello in più) il personaggio impazzisce${e.licantropia ? ' e, essendo licantropo, si trasforma in lupo mannaro' : ' e scompare per sempre'}. Con almeno 1 punto non può scambiare oggetti o tesoro.`),
    h('div', { class: 'chk-row' }, chk('Licantropia', 'licantropia', 'Rifiuta la lanterna e l’argento'), chk('Immune alla licantropia', 'licantropiaImmune'), chk('Peste oscura', 'peste', 'A ogni stanza 1d8: con 1 perde 1 PV'), chk('Vampirizzato (niente resurrezione)', 'vampirizzato', 'Si spegne bruciando il corpo o uccidendo il vampiro'),
      chk('Paralizzato', 'paralizzato'), chk('Marchiato (uomini formica)', 'marchiato')),
    h('div', { class: 'grid2' }, h('label', {}, 'Livelli persi (informativo: il livello è già ridotto)', h('input', { type: 'number', min: 0, value: e.livelliPersi || 0, onchange: ev => { e.livelliPersi = +ev.target.value; modificato('party'); } }))),
    h('div', { class: 'row wrap' },
      e.licantropia ? h('button', { onclick: async () => { await curaLicantropia(e); rinfresca(); } }, 'Cura al monastero (400 p.o.)') : null,
      e.peste ? h('button', { onclick: async () => { const x = await dado('Cura alla chiesa (chierico di 5° livello: 1d6, 5-6)'); if (x.totale >= 5) curaPeste(e); else toast('La cura non riesce: la peste resta.', 'warn'); rinfresca(); } }, 'Cura alla chiesa (1d6: 5-6)') : null,
      (e.follia || 0) > 0 ? h('button', { onclick: () => { K.follia(e, -1); rinfresca(); } }, 'Togli 1 punto follia') : null));
  return box;
}
export async function addestramento() {
  if (adv().attiva) return toast('L’addestramento si fa tra due avventure.', 'warn');
  if (adv().numero > 0 && !adv().esTirati) return toast('Nell’ultima avventura il gruppo non ha fatto nemmeno 1 tiro ES: non puoi addestrarti di nuovo.', 'warn');
  const lista = eroiVivi().filter(e => !e.merc && !e.png && !e.addestrato && e.stato === 'ok');
  if (!lista.length) return toast('Nessun eroe può addestrarsi.', 'warn');
  const chi = await sceltaMultipla('Addestramento (regola opzionale)', '100 p.o. per livello, pagati in anticipo (non rimborsati se il tiro fallisce); una sola volta a testa tra due avventure. Si paga prima per tutti, poi si tira.', lista.map(e => [e.id, `${e.nome} (${e.livello}° livello): ${100 * e.livello} p.o.`]));
  const sel = chi.map(eroePerId).filter(Boolean), costo = sel.reduce((a, e) => a + 100 * e.livello, 0);
  if (!sel.length) return;
  if (oroGruppo() < costo) return toast(`Servono ${costo} p.o. (il gruppo ne ha ${oroGruppo()}).`, 'warn');
  prendiOro(costo, sel.concat(eroiVivi().filter(x => !sel.includes(x))));
  for (const e of sel) { e.addestrato = true; G.aggiungiES(`Addestramento di ${e.nome}`, false, 1, { soloEroe: e.id }); }
  log(`Addestramento: ${sel.map(e => e.nome).join(', ')} (${costo} p.o.).`); modificato('party');
}
/** Abilità e artigiani che modificano il tiro per perquisire: da decidere prima del tiro. */
export async function preparaPerquisizione() {
  if (!abissoAttivo()) return {};
  const vivi = eroiVivi().filter(e => e.stato === 'ok'), opz = {};
  const inv = vivi.find(e => haAbilita(e, 'investigatore')), mast = vivi.find(e => haAbilita(e, 'mastro-tagliapietre'));
  if (inv && await confirmBox(`${inv.nome} usa Investigatore? (+1 al tiro, ma il successo dà solo un indizio)`)) opz.investigatore = true;
  else if (mast && await confirmBox(`${mast.nome} usa Mastro tagliapietre? (un 4 vale 5, ma solo per trovare una porta segreta)`)) opz.mastro = true;
  if (!opz.investigatore && vivi.some(e => haAbilita(e, 'intuizione'))) opz.intuizione = true;
  return opz;
}
/** Corruzione alternativa (lich): un oggetto magico degli averi del gruppo; principe elfico: corruzione gratis. */
export function corruzioneAlternativa(i, btn) {
  const out = [];
  if (i.corruzioneAlternativa) {
    const magici = eroiVivi().flatMap(e => (e.oggetti || []).filter(o => ['magico', 'arma-magica', 'armatura-magica'].includes(o.tipo)).map(o => [e, o]));
    if (magici.length) out.push(btn('Cedi un oggetto magico a caso', () => { const [e, o] = casuale(magici); e.oggetti = e.oggetti.filter(x => x !== o); C.nota(`${e.nome} cede ${o.nome}.`); C.paga(0, false, true); }));
  }
  const pr = eroiVivi().find(e => (e.segretiAb || []).some(s => s.id === 'a-principe-elfico') && adv().principe === e.id);
  if (pr) out.push(btn('Principe elfico: corrompi gratis', () => { C.paga(0, false, true); }));
  return out;
}
export const nomeMostro = id => { for (const src of [R.mostri, R.avanzate.mostri, R.caos.mostri, R.abisso.mostri]) for (const t of Object.keys(src)) { const m = (src[t] || []).find(x => x.id === id); if (m) return m.nome; } return id; };

/** Rincontro del vampiro fuggito: la stanza non ha contenuto, il vampiro ha ancora le ferite e 2 su 1d6 è con dei seguaci. */
export async function rincontroVampiro(t) {
  const vf = adv().vampiroDaRincontrare; adv().vampiroDaRincontrare = null; adv().vampiroFuggito = null;
  const voce = mostriTabella(vf.tabella).find(m => m.id === vf.id), i = creaIncontro(vf.tabella, voce, 1);
  i.pv = Math.max(1, vf.pv); G.avviaIncontro(i, t);
  let testo = `Il ${i.nome} fuggito è tornato (${i.pv}/${i.pvMax} PV)`;
  if ((await dado('Il vampiro è con dei seguaci? (1-2 sì)')).totale <= 2) { const s = await G.monstroDa('seguaci'); G.avviaIncontro(s, t); testo += ` con ${s.nome} ×${s.n}`; }
  return testo + '.';
}
