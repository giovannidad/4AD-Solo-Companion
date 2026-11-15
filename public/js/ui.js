// Pannelli di destra: Dungeon, Incontro, Strumenti, Registro.
import { R, S, log, modificato, emit, eroiVivi, eroiAttivi, eroePerId, ordineMarcia, livelloMax, inCampo } from './state.js';
import { h, modal, toast, confirmBox, scelta, uid } from './util.js';
import * as K from './caos.js';
import * as T from './tratti.js';
import * as Coop from './coop.js';
import * as Rit from './ritratti.js';
import * as Eff from './effetti.js';
import * as O from './oggetti.js';
import { equipaggiabile, equipaggia } from './equip.js';
import { nomeDungeon } from './nomi.js';
import { dado, tira, d6Esplosivo, estremo } from './dice.js';
import * as G from './game.js';
import * as C from './combat.js';
import * as table from './map2d.js';
import { descriviMostro, reazioniElenco, modAttacco, modDifesa, armaDi, nomeClasse, gruppoHaLanterna, haNano, riga, tabella, SETS, incantesimoACasoLista, suppl, tratto, haAbilita } from './rules.js';
import { riposa, scheda } from './party.js';

const adv = () => S.adv;
/** Firma dello stato locale dell'interfaccia (selezioni non salvate) che influisce sul disegno del pannello. */
export const firmaUI = () => JSON.stringify([ui.assegn, ui.assegnKey, ui.furioso, ui.arma, ui.bersaglio, ui.spell, ui.mostraReazioni]);
const ui = { assegn: null, assegnKey: '', furioso: {}, arma: {}, bersaglio: {}, spell: {}, mostraReazioni: false };

const btn = (txt, fn, cls = '', extra = {}) => h('button', { class: cls, onclick: async ev => { const b = ev.currentTarget; b.disabled = true; try { await fn(ev); } catch (e) { console.error(e); toast(String(e.message || e), 'warn'); } finally { b.disabled = false; } }, ...extra }, txt);

// =============================================================
//  DUNGEON
// =============================================================
export function renderDungeon(box) {
  box.replaceChildren();
  const a = adv();
  if (!a.attiva) {
    box.append(h('div', { class: 'hero-cta' },
      h('h3', {}, a.fine ? 'Avventura conclusa' : 'Pronto a scendere?'),
      h('p', {}, a.fine ? `Esito: ${a.fine}.` : 'Il gruppo si prepara all’ingresso del dungeon. Verrà tirato un d6 per la stanza d’ingresso; le ferite guariscono e poteri e incantesimi si ricaricano.'),
      h('label', { class: 'chk', title: 'Scegli il manuale da cui prendere le tabelle del dungeon; tra parentesi il livello dei personaggi a cui è destinato.' }, 'Tabelle del dungeon ',
        h('select', { onchange: ev => { S.party.set = ev.target.value; modificato('party'); } }, Object.entries(SETS).map(([v, t]) => h('option', { value: v, selected: (S.party.set || 'base') === v }, t)))),
      h('label', { class: 'chk', title: 'Aspetto delle stanze e dello sfondo della mappa per il prossimo dungeon.' }, 'Stile della mappa ',
        h('select', { onchange: ev => { S.party.tema = ev.target.value; modificato('party'); } }, [['carta', '4 Against Darkness (originale)'], ['classico', 'Dungeon classico'], ['foresta', 'Foresta']].map(([v, t]) => h('option', { value: v, selected: (S.party.tema || 'carta') === v }, t)))),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!S.party.supplCaos, onchange: ev => { S.party.supplCaos = ev.target.checked; modificato('party'); } }), 'Usa il supplemento «Contro il Caos» (nuovi incantesimi, armi, classi, tratti e traguardi)'),
      btn('Inizia una nuova avventura', async () => { if (await G.iniziaAvventura()) table.setView('fit'); }, 'primary big')));
    return;
  }
  const pend = a.tessere.find(t => t.pending);
  box.append(h('div', { class: 'dungeon-nome' }, h('h3', {}, a.nomeDungeon || `Dungeon n. ${a.numero}`),
    h('button', { class: 'mini', title: 'Cambia il nome del dungeon', onclick: async () => { const n = prompt('Nome del dungeon', a.nomeDungeon || ''); if (n && n.trim()) { a.nomeDungeon = n.trim().slice(0, 60); log(`Il dungeon prende il nome «${a.nomeDungeon}».`); modificato(); } } }, '✎'),
    h('button', { class: 'mini', title: 'Un altro nome a caso', onclick: () => { a.nomeDungeon = nomeDungeon(a.nomeDungeon); modificato(); } }, '🎲')));
  if (a.set && a.set !== 'base') box.append(h('div', { class: 'tag' }, SETS[a.set]));
  if (a.muroGhiaccio) box.append(h('div', { class: 'tag' }, 'Muro di Ghiaccio attivo (fino a fine avventura, distrutto dal fuoco)'));
  if (a.missione) box.append(cartaMissione(a.missione));
  box.append(h('div', { class: 'stats' },
    h('div', {}, h('b', {}, a.stanze), h('small', {}, 'stanze')),
    h('div', {}, h('b', {}, a.maggioriSconfitti || 0), h('small', {}, 'maggiori sconfitti')),
    h('div', {}, h('b', {}, `${a.incontriSeguaci || 0}/10`), h('small', {}, 'incontri seguaci')),
    h('div', {}, h('b', {}, a.numero), h('small', {}, 'avventura'))));

  if (pend) {
    const corr = h('input', { type: 'checkbox', checked: !!pend.corridoio, onchange: ev => { pend.corridoio = ev.target.checked; } });
    box.append(h('div', { class: 'card pending' },
      h('h3', {}, `Stanza ${pend.n} da posizionare`),
      h('img', { class: 'thumb', src: pend.src, alt: `Tessera ${pend.n}` }),
      (() => { const ai = table.assistInfo(pend.id); return ai ? h('div', { class: 'row wrap' },
        btn('‹', () => table.assistNext(-1), 'mini', { title: 'Posizione precedente' }), h('b', {}, `Posizione assistita ${ai.k + 1}/${ai.n}`), btn('›', () => table.assistNext(1), 'mini', { title: 'Posizione successiva' }),
        h('small', { class: 'hint' }, 'Porta contro porta. Clicca una freccia sulla mappa per usare un’altra uscita.')) : null; })(),
      h('p', { class: 'hint' }, 'Trascina la tessera sul foglio, fai combaciare una porta con la stanza precedente. Puoi ruotarla, specchiarla e allungare i corridoi.'),
      h('div', { class: 'row wrap' },
        btn('⟲', () => { table.selectTile(pend.id); table.rotateSelected(-1); }, 'mini', { title: 'Ruota a sinistra' }),
        btn('⟳', () => { table.selectTile(pend.id); table.rotateSelected(1); }, 'mini', { title: 'Ruota a destra' }),
        btn('⇄ Specchia', () => { table.selectTile(pend.id); table.flipSelected(); }),
        btn('−', () => { table.selectTile(pend.id); table.scaleSelected(0.93); }, 'mini', { title: 'Riduci (di norma non serve: si adatta da sola)' }),
        btn('+', () => { table.selectTile(pend.id); table.scaleSelected(1.07); }, 'mini', { title: 'Ingrandisci' }),
        btn('Auto', () => { pend.scale = 1; table.selectTile(pend.id); table.autoPlace(pend, G.tileById(adv().stanzaCorrente), adv().tessere); table.upsertTile(pend); table.ensureVisible(pend); }, '', { title: 'Rimetti in scala e riposiziona accanto alla stanza attuale' })),
      h('label', { class: 'chk' }, corr, 'Corridoio (largo 1 quadretto)'),
      h('div', { class: 'row wrap' },
        btn('Conferma e tira il contenuto', () => G.confermaStanza(pend, corr.checked), 'primary'),
        btn('Non entra: vicolo cieco', () => { pend.corridoio = corr.checked; return G.scartaStanza(pend); }),
        btn('Annulla', () => G.annullaStanza(pend), 'danger'))));
  } else {
    const fin = h('input', { type: 'checkbox' }), seg = h('input', { type: 'checkbox' });
    box.append(h('div', { class: 'card' },
      h('h3', {}, 'Esplora'),
      h('p', { class: 'hint' }, 'Scegli una porta o un corridoio non ancora esplorato e tira una nuova stanza.'),
      btn('Tira la nuova stanza (d66)', () => G.nuovaStanza({ finale: fin.checked, segreta: seg.checked }), 'primary big'),
      (() => { const cur = G.tileById(a.stanzaCorrente); return G.perquisibile(cur) ? btn(`Perquisisci la stanza attuale (${cur.nome})`, () => perquisisciUI(cur), 'accent big') : null; })(),
      h('label', { class: 'chk' }, fin, 'Nessuna porta da aprire: ultima stanza = boss finale'),
      h('label', { class: 'chk' }, seg, 'Stanza segreta (mostri sorpresi, -1 LIV al primo turno)')));
  }

  // elenco stanze
  const lista = h('div', { class: 'rooms' });
  [...a.tessere].filter(t => !t.pending).reverse().forEach(t => {
    const c = t.contenuto;
    lista.append(h('div', { class: `room ${a.stanzaCorrente === t.id ? 'cur' : ''} ${G.stanzaSicura(t) ? 'sicura' : ''}`, onclick: () => { table.selectTile(t.id); a.stanzaCorrente = t.id; modificato('avventura'); } },
      h('img', { src: t.src, alt: '' }),
      h('div', { class: 'grow' }, h('b', {}, `${t.nome}${t.corridoio ? ' · corridoio' : ''}`), G.stanzaSicura(t) ? h('span', { class: 'tag green', title: 'Stanza vuota o ripulita: ci si può riposare senza problemi' }, 'Riposo sicuro') : null, t.prigionieri ? h('span', { class: 'tag amber', title: 'Giovani legati da liberare (missione Salvataggio)' }, `${t.prigionieri} prigionier${t.prigionieri === 1 ? 'o' : 'i'}`) : null, h('small', {}, c ? c.testo : '—')),
      h('div', { class: 'col' },
        G.perquisibile(t) ? btn('Perquisisci', () => perquisisciUI(t), 'mini') : (t.perquisita ? h('small', {}, 'P') : null),
        t.sospeso ? btn('Rientra', () => { C.riprendiIncontro(t); }, 'mini') : null)));
  });
  box.append(h('h4', {}, 'Mappa esplorata'), lista);

  box.append(h('div', { class: 'card' },
    h('h3', {}, 'Fine dell’avventura'),
    h('div', { class: 'row wrap' },
      (() => {
        const esplora = a.missione?.id === 'esplorazione' && a.stanze >= 10;   // «Esplorazione e fuga»: niente boss, basta uscire con la mappa
        return btn(esplora ? 'Consegna la mappa e uscita dal dungeon' : 'Boss ucciso e uscita dal dungeon', async () => {
          if (!(await confirmBox('Concludere l’avventura con successo?'))) return;
          if (esplora && !a.missione.completata) await K.completaMissione();
          G.terminaAvventura(esplora ? 'Missione compiuta: mappa consegnata e uscita dal dungeon' : 'Missione compiuta: boss finale sconfitto e uscita dal dungeon');
        }, 'primary', { disabled: !a.bossFinaleUcciso && !esplora, title: a.bossFinaleUcciso || esplora ? '' : 'Si attiva solo dopo aver sconfitto il boss finale' });
      })(),
      btn('Ritirata dal dungeon', async () => { if (await confirmBox('Abbandonare il dungeon?')) G.terminaAvventura('Il gruppo ha abbandonato il dungeon'); }))));
}

/** Perquisire una stanza vuota: tira il d6, mostra l'esito della tabella e applica ciò che indica. */
async function perquisisciUI(t) {
  if (t.perquisita) { toast('Questa stanza è già stata perquisita (P).', 'warn'); return; }
  let res = await G.tiraPerquisizione(t);
  const mostra = () => modal(`Perquisire la stanza ${t.nome}`, (b, close) => {
    const fort = eroiAttivi().find(e => e.classe === 'mezzuomo' && (e.usi.fortuna || 0) < e.livello + 1);
    b.append(h('p', {}, h('b', {}, `Tiro: ${res.v}`), t.corridoio ? ' (compreso −1 per il corridoio)' : ''),
      h('div', { class: 'card' }, res.row.testo));
    const chiudi = async () => { close(); await G.concludiPerquisizione(t, res); };
    if (fort) b.append(btn(`Ritira con un punto fortuna (${fort.nome})`, async () => {
      fort.usi.fortuna = (fort.usi.fortuna || 0) + 1; log(`${fort.nome} spende un punto fortuna per ritirare la perquisizione.`); modificato('party');
      close(); res = await G.tiraPerquisizione(t); mostra();
    }));
    if (res.v >= 5) {
      b.append(h('p', { class: 'hint' }, 'Scegli cosa trovi:'),
        btn('Porta segreta', async () => {
          close(); await G.concludiPerquisizione(t, res);
          const sc = await G.portaSegreta();
          toast(sc ? 'Scorciatoia sicura verso l’uscita!' : 'Porta segreta: tira la stanza collegata.');
          await G.nuovaStanza({ segreta: true });
        }, 'item-btn'),
        btn('Tesoro nascosto', async () => { close(); await G.concludiPerquisizione(t, res); const x = await G.tesoroNascosto(t); modalTesto('Tesoro nascosto', `Complicazione (${x.c}): ${x.complicazione.testo} Oro trovato: ${x.oro} p.o. (vedi Bottino).`); }, 'item-btn'),
        btn('Indizio', () => { close(); G.concludiPerquisizione(t, res); scegliEroe('Chi trova l’indizio?', e => G.aggiungiIndizio(e)); }, 'item-btn'));
    } else b.append(h('div', { class: 'row end' }, btn(res.v === 1 ? 'Arrivano i mostri erranti!' : 'Ok', chiudi, 'primary')));
  });
  mostra();
}
function scegliEroe(titolo, fn, filtro = e => e.stato !== 'morto') {
  modal(titolo, (b, close) => {
    S.party.eroi.filter(filtro).forEach(e => b.append(h('button', { class: 'item-btn', onclick: () => { close(); fn(e); } }, h('b', {}, e.nome), h('span', {}, `${nomeClasse(e)} liv. ${e.livello}`))));
  });
}

// =============================================================
//  INCONTRO
// =============================================================
export function renderIncontro(box) {
  box.replaceChildren();
  const i = C.inc();
  if (!i) {
    box.append(h('div', { class: 'empty' }, h('p', {}, 'Nessun incontro in corso.'), h('p', { class: 'hint' }, 'Gli incontri compaiono quando generi una stanza con mostri.'),
      btn('Mostro errante (test)', async () => { const m = await G.monstroErrante(); G.avviaIncontro(m, G.tileById(adv().stanzaCorrente)); })));
    return;
  }
  const maggiore = !i.minore;
  box.append(h('div', { class: `monster ${i.stato}` },
    h('div', { class: 'mhead' }, h('h3', {}, i.nome), i.bossFinale ? h('span', { class: 'tag red' }, 'BOSS FINALE') : null, i.errante ? h('span', { class: 'tag amber' }, 'Errante') : null),
    h('div', { class: 'mstats' }, descriviMostro(i)),
    i.note ? h('p', { class: 'hint' }, i.note) : null,
    h('div', { class: 'counter' },
      maggiore
        ? [h('span', {}, 'Punti vita'), btn('−', () => { i.pv = Math.max(0, i.pv - 1); modificato('avventura'); }, 'mini'), h('b', {}, `${i.pv}/${i.pvMax}`), btn('+', () => { i.pv = Math.min(i.pvMax, i.pv + 1); modificato('avventura'); }, 'mini')]
        : [h('span', {}, 'Mostri rimasti'), btn('−', () => { i.n = Math.max(0, i.n - 1); modificato('avventura'); }, 'mini'), h('b', {}, `${i.n}/${i.nIniziale}`), btn('+', () => { i.n++; modificato('avventura'); }, 'mini')]),
    i.reazione && i.reazioni.length ? h('details', {}, h('summary', {}, 'Elenco reazioni'), h('small', {}, reazioniElenco(i))) : null));

  if (S.adv.coda?.length) box.append(h('small', { class: 'hint' }, `In coda: ${S.adv.coda.map(x => x.nome).join(', ')}`));

  if (i.speciale === 'gremlin') {
    box.append(h('div', { class: 'card' }, h('p', {}, 'I gremlin non si possono combattere: hanno già rubato gli oggetti.'), btn('Chiudi incontro', () => C.chiudiIncontro())));
    return;
  }

  switch (i.stato) {
    case 'nuovo': {
      box.append(h('div', { class: 'card' },
        h('h4', {}, 'Come affronti l’incontro?'),
        i.errante || i.sorpresa
          ? [h('p', { class: 'hint' }, 'I mostri erranti ti sorprendono: combattono sempre e colpiscono per primi.'), btn('Combatti (i mostri attaccano per primo)', async () => { i.mostriPrima = true; i.noMorale = i.noMorale; await C.inizioScontro(); }, 'primary')]
          : [btn('Attacca per primo', () => C.attaccaSubito(), 'primary'), btn('Aspetta e tira la reazione', () => C.tiraReazione())],
        ...(suppl() ? preIncontro(i) : []),
        haNano() && !i.errante ? btn('Fiuta il tesoro del nano (1d6 + livello ≥ 6)', async () => {
          const n = eroiVivi().find(e => e.classe === 'nano'); const r = await dado('Fiuto del nano'); const tot = r.totale + n.livello;
          toast(tot >= 6 ? 'Il nano fiuta il tesoro: puoi conoscerlo prima di attaccare.' : `Fiuto fallito (${tot}).`);
        }) : null));
      break;
    }
    case 'corruzione': {
      const costo = C.costoCorruzione();
      const nani = eroiVivi().filter(e => e.classe === 'nano').length;
      box.append(h('div', { class: 'card' }, h('h4', {}, 'I mostri chiedono una tangente'),
        h('p', {}, costo != null ? `${costo} pezzi d’oro (hai ${C.oroTotale()}).` : (i.reazione.param || '')),
        nani >= 2 ? h('p', { class: 'warn-box' }, 'Con 2 o più nani nel gruppo non puoi corrompere i mostri.') : null,
        h('div', { class: 'row wrap' },
          btn(`Paga ${costo ?? ''} p.o.`, () => C.paga(costo), 'primary', { disabled: nani >= 2 || costo == null || costo > C.oroTotale() }),
          C.haOroStolti() ? btn('Usa l’oro degli stolti', () => C.paga(0, true)) : null,
          btn('Rifiuta e combatti', () => C.rifiutaCorruzione(), 'danger'))));
      break;
    }
    case 'speciale': {
      box.append(h('div', { class: 'card' }, h('p', {}, i.reazione?.azione === 'pacifico' ? `${i.nome} è pacifico: puoi lasciarlo stare (nessun tesoro) oppure attaccarlo.` : `Reazione speciale: ${i.reazione?.azione}. Risolvila a parole oppure combatti.`),
        i.reazione?.azione === 'missione' ? btn('Accetta la missione (tira)', async () => { const r = await dado('Missione (d6)'); const row = riga(R.tabelle.missioni, r.totale); C.nota(`Missione: ${row.nome} – ${row.testo}`); i.missione = row.nome; modificato('avventura'); }) : null,
        btn('Combatti', () => { i.mostriPrima = true; return C.inizioScontro(); }, 'danger'),
        btn('Chiudi (il mostro se ne va)', () => { C.chiudiIncontro(); })));
      break;
    }
    case 'combattimento': renderCombattimento(box, i); break;
    case 'finito': {
      const bottino = ['sconfitti', 'fuga'].includes(i.esito) && !i.tesoroPreso && i.reazione?.azione !== 'fugge';
      box.append(h('div', { class: 'card done' }, h('h4', {}, i.esito === 'sconfitta' ? 'Il gruppo è stato sconfitto' : i.esito === 'soloCaduto' ? 'Il personaggio è caduto nell’imboscata' : i.esito === 'corrotto' ? 'Mostri corrotti' : i.esito === 'fuga' ? 'Mostri fuggiti' : 'Incontro vinto!'),
        h('div', { class: 'row wrap' },
          bottino && (i.tes !== 'NO' || i.oroFisso) && !i.errante ? btn('Saccheggia (tira il tesoro)', () => C.saccheggia(), 'primary') : null,
          btn('Chiudi incontro', () => C.chiudiIncontro(), i.tesoroPreso || !bottino ? 'primary' : ''))));
      break;
    }
  }
  renderBottino(box);
  if (i.cronaca?.length) box.append(h('h4', {}, 'Cronaca dell’incontro'), h('div', { class: 'chron' }, [...i.cronaca].reverse().slice(0, 14).map(t => h('div', {}, t))));
}

/** Azioni del supplemento prima di decidere come affrontare l'incontro: segno di Xichtul e «Molti nemici, molta gloria». */
function preIncontro(i) {
  const out = [];
  for (const e of eroiAttivi()) {
    const segno = O.oggettoDi(e, 'segno');
    if (segno && i.minore && (i.tag || []).includes('caos') && !(e.usi || {}).segno) out.push(btn(`Segno di Xichtul (${e.nome}): 1d8 + livello contro il LIV`, () => O.usaSegno(e, segno)));
    if (e.perm?.missioni && !e.perm.missioneOttenuta && i.reazioni?.some(x => x[2] === 'missione') && !i.errante) out.push(btn(`Ottieni la reazione Missione (${e.nome}, Sempre in missione)`, () => {
      e.perm.missioneOttenuta = true; i.reazione = { azione: 'missione', tiro: 0 }; i.stato = 'speciale'; C.nota(`${e.nome} ottiene automaticamente la reazione Missione da ${i.nome}.`); modificato('avventura');
    }));
    if (tratto(e, 'nemici-gloria') && i.tabella === 'seguaci' && i.contaExpr && !i.errante && !i.solo && !(e.usi || {}).nemiciGloria) out.push(btn(`Molti nemici, molta gloria (${e.nome})`, () => {
      e.usi = e.usi || {}; e.usi.nemiciGloria = 1;
      i.n = i.nIniziale = estremo(i.contaExpr) + 2; i.solo = e.id; i.soloTurni = 1; i.contaDoppio = true;
      C.nota(`${e.nome} affronta da solo ${i.n} ${i.nome} per 1 turno; l’incontro conta doppio per il tiro ES.`); modificato('avventura');
    }));
  }
  return out;
}

/** Azione di un eroe in combattimento: se ha già agito nel turno, avvisa e non fa nulla. Il tasto appare «spento» (ma cliccabile). */
const speso = e => !!inc0()?.agito?.[e.id];
const inc0 = () => S.adv?.incontro;
const avviso = e => toast(`${e.nome} ha terminato gli attacchi per questo turno.`, 'warn');
const azione = (e, txt, fn, cls = '', extra = {}, cmd = null) => btn(txt, async ev => {
  if (speso(e)) return avviso(e);
  if (Coop.sonoOspite()) { if (cmd) await Coop.comando({ ...cmd(), eroeId: e.id }); return; }   // l'ospite chiede, l'ospitante esegue
  await fn(ev);
}, `${cls}${speso(e) ? ' spent' : ''} ok-ospite`.trim(), { ...extra, ...(Coop.sonoOspite() && !Coop.eMio(e.id) ? { disabled: true, title: 'Non è il tuo eroe' } : {}) });

function renderCombattimento(box, i) {
  const gruppo = ordineMarcia().filter(e => e.stato === 'ok' && inCampo(e));
  const lanternaOk = gruppoHaLanterna();
  box.append(h('div', { class: 'turn' }, `Turno ${i.turno}`, i.mostriPrima ? ' · i mostri agiscono per primi' : ' · agisce il gruppo',
    i.corridoio ? h('span', { class: 'tag' }, 'Corridoio: combattono solo i primi 2') : null));
  if (!lanternaOk) box.append(h('div', { class: 'warn-box' }, 'Senza lanterna: -2 ad attacchi e difese.'));
  if (i.moralePendente && !i.moraleFatto && !i.noMorale) box.append(h('div', { class: 'warn-box' }, 'Tiro di morale richiesto! ', btn('Tira morale', () => C.tiraMorale(), 'accent')));

  const eroiBox = h('div', { class: 'actors' });
  gruppo.forEach((e, idx) => {
    const fronte = !i.corridoio || idx < 2;
    const m = modAttacco(e, C.contestoAttacco(e, { armaId: ui.arma[e.id] }));
    const armiSel = (e.armi || []).length > 1 ? h('select', { onchange: ev => { ui.arma[e.id] = ev.target.value; modificato('avventura'); } }, e.armi.map(id => h('option', { value: id, selected: (ui.arma[e.id] || e.armaPrincipale) === id }, armaDi(id)?.nome))) : null;
    const fur = e.classe === 'barbaro' ? h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!ui.furioso[e.id] && (e.usi.furie || 0) < Math.ceil(e.livello / 2), disabled: (e.usi.furie || 0) >= Math.ceil(e.livello / 2), onchange: ev => { ui.furioso[e.id] = ev.target.checked; } }), `Furioso (${Math.ceil(e.livello / 2) - (e.usi.furie || 0)})`) : null;
    const pronti = (e.incantesimi || []).map((s, idx2) => ({ ...s, idx2 })).filter(s => !s.usato);
    const rowEl = h('div', { class: `actor ${i.agito?.[e.id] ? 'done' : ''}` },
      h('div', { class: 'ahead' }, Rit.immagine(e, 28, 'mini'), h('b', {}, e.nome), h('small', {}, `${nomeClasse(e)} ${e.livello} · ${e.pv}/${e.pvMax} PV`), h('span', { class: 'mod', title: m.parti.map(p => `${p[0]} ${p[1] > 0 ? '+' : ''}${p[1]}`).join('\n') || 'Nessun modificatore' }, `ATT ${m.tot >= 0 ? '+' : ''}${m.tot}`)),
      h('div', { class: 'arow' },
        fronte ? [armiSel, fur, azione(e, 'Attacca', async () => { const furioso = !!ui.furioso[e.id] && (e.usi.furie || 0) < Math.ceil(e.livello / 2); ui.furioso[e.id] = false; await C.attacca(e, { armaId: ui.arma[e.id], furioso }); }, 'primary', {}, () => { const furioso = !!ui.furioso[e.id] && (e.usi.furie || 0) < Math.ceil(e.livello / 2); ui.furioso[e.id] = false; return { tipo: 'attacca', armaId: ui.arma[e.id], furioso }; })] : h('small', {}, 'In seconda fila: solo incantesimi e armi da lancio.'),
        i.id === 'c-manticora' && !i.codaFerita && fronte ? azione(e, 'Attacca la coda', () => C.attacca(e, { coda: true }), 'accent', {}, () => ({ tipo: 'attacca', coda: true })) : null,
        e.classe === 'assassino' && fronte ? azione(e, 'Marchia', () => C.marchia(e), 'accent', {}, () => ({ tipo: 'marchia' })) : null,
        ...azioniMagiche(e, pronti), ...(suppl() ? azioniSupplemento(e, i) : [])));
    eroiBox.append(rowEl);
  });
  const sezGruppo = [h('h4', {}, 'Turno del gruppo'), eroiBox];

  // mostri
  const key = `${i.id}-${i.turno}-${i.n}-${i.pv}-${gruppo.map(g => g.id).join('')}-${i.sorpresa}`;
  if (ui.assegnKey !== key) { ui.assegn = C.propostaAttacchi(); ui.assegnKey = key; }
  const as = h('div', { class: 'assign' });
  ui.assegn.forEach((a, k) => {
    const vet = eroePerId(a.eroeId)?.classe === 'veterano';
    as.append(h('div', { class: 'row' }, h('span', {}, `Attacco ${k + 1} →`), h('select', { onchange: ev => { a.eroeId = ev.target.value; if (eroePerId(a.eroeId)?.classe !== 'veterano') a.protettoreId = null; emit(); } }, gruppo.map(g => h('option', { value: g.id, selected: g.id === a.eroeId }, g.nome))),
      vet ? h('select', { title: 'Un compagno può rinunciare a un attacco e tirare la difesa al posto del veterano', onchange: ev => { a.protettoreId = ev.target.value || null; emit(); } },
        [h('option', { value: '' }, 'nessuna protezione'), ...gruppo.filter(g => g.id !== a.eroeId && !g.png && !i.agito?.[g.id]).map(g => h('option', { value: g.id, selected: g.id === a.protettoreId }, `protetto da ${g.nome}`))]) : null));
  });
  const sezMostri = [h('h4', {}, 'Turno dei mostri'),
    i.mostriPrima && i.turno === 1 ? h('p', { class: 'hint' }, 'I mostri colpiscono per primi in questo turno.') : '',
    h('div', { class: 'card' }, ui.assegn.length ? as : h('small', {}, 'Nessun attacco da risolvere.'),
      h('div', { class: 'row wrap' },
        btn('Tira le difese', async () => { const l = ui.assegn.map(a => ({ ...a })); ui.assegnKey = ''; await C.eseguiDifese(l); }, 'primary'),
        btn('Tira morale', () => C.tiraMorale(), '', { disabled: i.noMorale || i.moraleFatto }))),
    h('div', { class: 'row wrap' },
      btn('Ritirata (+1 difesa, serve una porta)', () => C.sottrarsi('ritirata')),
      btn('Fuga (niente scudo)', () => C.sottrarsi('fuga'), 'danger'),
      btn('Mostri in fuga / sconfitti', async () => { i.stato = 'finito'; i.esito = 'sconfitti'; C.nota('Combattimento concluso.'); modificato('avventura'); }))];
  // chi agisce per primo sta in cima al pannello
  box.append(...(i.mostriPrima ? [...sezMostri, ...sezGruppo] : [...sezGruppo, ...sezMostri]));
}

function azioniMagiche(e, pronti) {
  const out = [];
  const ts = ui.bersaglio[e.id] || e.id;
  const bersagli = h('select', { onchange: ev => { ui.bersaglio[e.id] = ev.target.value; } }, S.party.eroi.filter(x => x.stato !== 'morto' || true).map(x => h('option', { value: x.id, selected: x.id === ts }, x.nome)));
  if (pronti.length) {
    const sel = h('select', { onchange: ev => { ui.spell[e.id] = ev.target.value; } }, pronti.map(s => h('option', { value: s.idx2, selected: String(ui.spell[e.id]) === String(s.idx2) }, s.nome)));
    out.push(sel, bersagli, azione(e, 'Lancia', () => C.lancia(e, +(sel.value), { bersaglioId: bersagli.value }), '', {}, () => ({ tipo: 'lancia', idx: +(sel.value), bersaglioId: bersagli.value })));
  }
  (e.oggetti || []).filter(o => o.incantesimo && o.cariche > 0 && !o.afferrato).forEach(o => {
    if (o.solo && !o.solo.includes(e.classe)) return;
    if (o.tipo === 'pergamena' && e.classe === 'barbaro') return;
    out.push(azione(e, `${o.incantesimo} da ${o.nome.replace(/^Pergamena: /, 'pergamena')} (${o.cariche})`, () => C.lancia(e, -1, { bersaglioId: bersagli.value, oggetto: o, daPergamena: o.tipo === 'pergamena' }), 'accent', {}, () => ({ tipo: 'lancia', og: e.oggetti.indexOf(o), bersaglioId: bersagli.value })));
  });
  if (e.classe === 'chierico') {
    const bers = h('select', {}, S.party.eroi.filter(x => x.stato !== 'morto').map(x => h('option', { value: x.id }, x.nome)));
    out.push(bers, azione(e, `Cura (${3 - (e.usi.guarigione || 0)})`, () => C.guarisci(e, eroePerId(bers.value)), '', { disabled: (e.usi.guarigione || 0) >= 3 }, () => ({ tipo: 'cura', bersaglioId: bers.value })),
      azione(e, `Benedizione (${3 - (e.usi.benedizione || 0)})`, () => C.usaBenedizione(e, eroePerId(bers.value)), '', { disabled: (e.usi.benedizione || 0) >= 3 }, () => ({ tipo: 'benedizione', bersaglioId: bers.value })));
  }
  return out;
}

/** Armi, oggetti e abilità del supplemento utilizzabili in combattimento. */
function azioniSupplemento(e, i) {
  const out = [], arma = armaDi(ui.arma[e.id] || e.armaPrincipale);
  if (arma?.id === 'balestra' && e.balestraScarica) out.push(azione(e, 'Ricarica la balestra', () => C.ricaricaBalestra(e), 'accent'));
  if (i.intrappolato) out.push(azione(e, 'Lega il bersaglio', () => C.legaBersaglio(e), 'accent'));
  for (const [k, o] of O.oggettiCombattimento(e)) {
    if (k === 'bomba') out.push(azione(e, 'Lancia la bomba', () => O.lanciaBomba(e, o), 'accent'));
    else if (k === 'triboli') out.push(azione(e, 'Triboli (sottrarsi)', () => O.usaTriboli(e, o), 'accent'));
    else if (k === 'polvere') out.push(azione(e, `Polvere melmicida (${o.cariche})`, () => O.usaPolvere(e, o), 'accent'));
    else if (k === 'invocazione') out.push(azione(e, 'Invocazione dell’ordine', () => O.usaInvocazione(e, o), 'accent'));
    else if (k === 'cappuccio') out.push(azione(e, 'Cappuccio: +3 in mischia', () => O.usaCappuccio(e), 'accent', (e.usi || {}).cappuccio ? { disabled: true } : {}));
    else if (k === 'amuleto') out.push(azione(e, `Amuleto (${o.cariche} PV)`, async () => { const b = await K.eroeScelto('Chi guarisce?', x => x.stato !== 'morto'); if (b) await O.usaAmuleto(e, o, b); }, 'accent'));
  }
  if (haAbilita(e, 'assistenza')) out.push(azione(e, 'Assistenza', () => O.assistenza(e), 'accent'));
  if (haAbilita(e, 'sputafuoco')) out.push(azione(e, 'Sputafuoco', () => O.sputafuoco(e), 'accent', (e.usi || {}).sputafuoco ? { disabled: true } : {}));
  if ((e.perm?.benGratis || 0) > 0) out.push(btn(`Benedizione divina gratuita (${e.perm.benGratis})`, async () => { const b = await K.eroeScelto('Chi riceve la Benedizione?', x => x.stato !== 'morto'); if (b) O.benedizioneDivina(e, b); }, 'accent', { disabled: Coop.sonoOspite() }));
  return out;
}

// =============================================================
//  BOTTINO
// =============================================================
function renderBottino(box) {
  const b = adv().bottino || [];
  if (!b.length) return;
  box.append(h('h4', {}, 'Bottino da assegnare'));
  const avidi = suppl() ? eroiVivi().filter(x => tratto(x, 'avido')) : [];
  if (avidi.length) box.append(h('small', { class: 'hint' }, `${avidi.map(x => x.nome).join(', ')} ${avidi.length > 1 ? 'sono Avidi' : 'è Avido'}: deve ricevere la quota maggiore del tesoro o l’oggetto magico di maggior valore, altrimenti lascia il gruppo.`));
  const lista = h('div', { class: 'loot' });
  b.forEach(x => {
    const sel = h('select', {}, S.party.eroi.filter(e => e.stato !== 'morto').map(e => h('option', { value: e.id }, e.nome)));
    lista.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, x.testo), sel,
      btn(x.tipo === 'oro' ? 'Dai' : 'Prendi', () => assegna(x, eroePerId(sel.value)), 'mini primary')));
  });
  if (b.some(x => x.tipo === 'oro')) lista.append(btn('Dividi l’oro tra tutti (almeno 1 a ogni nano)', () => dividiOro(), 'accent'));
  box.append(lista);
}
async function assegna(x, e) {
  if (!e) return;
  if (e.classe === 'barbaro' && (['magico', 'pergamena'].includes(x.tipo) || x.noBarbaro)) { toast('I barbari non usano oggetti magici né pergamene.', 'warn'); return; }
  if (e.classe === 'elfo-fuoco' && x.tipo === 'pergamena') { toast('Gli elfi del fuoco sono ciechi: non leggono pergamene.', 'warn'); return; }
  if (x.tipo === 'oro' && suppl() && e.classe === 'veterano') {   // il veterano non porta più di 200 p.o.
    const posto = Math.max(0, 200 - (e.oro || 0)), q = Math.min(posto, x.valore);
    if (q <= 0) { toast(`${e.nome} (veterano) non può portare più di 200 p.o.`, 'warn'); return; }
    if (q < x.valore) { e.oro = (e.oro || 0) + q; x.valore -= q; x.testo = `${x.valore} pezzi d’oro (non portati dal veterano)`; log(`${e.nome} prende ${q} p.o. (limite di 200 p.o. del veterano).`); modificato(); return; }
  }
  if (x.tipo === 'oro') e.oro = (e.oro || 0) + x.valore;
  else if (x.tipo === 'cristallo') await K.usaCristallo(e);
  else if (x.bonusDifesa) { e.bonusDifesa = Math.max(e.bonusDifesa || 0, x.bonusDifesa); (e.oggetti = e.oggetti || []).push({ nome: x.testo.split('.')[0], qta: 1 }); }
  else if (x.bonusArma) { e.bonusMagico = Math.max(e.bonusMagico || 0, x.bonusArma); (e.oggetti = e.oggetti || []).push({ nome: x.testo.split('.')[0], qta: 1 }); }
  else if (x.cariche != null) (e.oggetti = e.oggetti || []).push({ nome: x.nome || x.testo, qta: 1, tipo: x.tipo, valore: x.valore, nota: x.testo, cariche: x.cariche, caricheMax: x.caricheMax ?? x.cariche, incantesimo: x.incantesimo, solo: x.solo, manuale: !!x.manuale, curativo: x.curativo });
  else if (x.tipo === 'pergamena' && x.incantesimo) (e.oggetti = e.oggetti || []).push({ nome: x.testo, qta: 1, tipo: 'pergamena', nota: x.testo, cariche: 1, caricheMax: 1, incantesimo: x.incantesimo, consuma: true });
  else (e.oggetti = e.oggetti || []).push({ nome: x.testo, qta: 1, valore: x.valore, tipo: x.tipo });
  if (x.tipo === 'gemma' && x.valore >= 50) T.evento(e, 'gemme');
  if (x.tipo === 'pergamena') T.evento(e, 'pergamene');
  T.oggettoMagicoRicevuto(e, x); T.controllaOro();
  adv().bottino = adv().bottino.filter(y => y.id !== x.id);
  log(`${e.nome} prende: ${x.testo}`); modificato();
  const preso = (e.oggetti || [])[(e.oggetti || []).length - 1];
  if (preso && x.tipo !== 'oro' && equipaggiabile(preso)) {
    const k = await scelta('Equipaggiare?', `${e.nome} ha preso: ${preso.nome}`, [['si', 'Equipaggia subito', 'Diventa l’arma impugnata o l’armatura indossata'], ['no', 'Tieni nello zaino', 'Potrai equipaggiarlo più tardi dalla scheda']]);
    if (k === 'si') await equipaggia(e, preso);
  }
}
function dividiOro() {
  const monete = adv().bottino.filter(x => x.tipo === 'oro'); const tot = monete.reduce((a, x) => a + x.valore, 0);
  let vivi = S.party.eroi.filter(e => e.stato !== 'morto'); if (!vivi.length) return;
  const sup = suppl();
  if (sup && vivi.some(e => e.classe === 'elfo-fuoco') && vivi.some(e => e.classe !== 'elfo-fuoco')) { vivi = vivi.filter(e => e.classe !== 'elfo-fuoco'); toast('Gli elfi del fuoco non condividono l’oro con le altre razze: assegna a mano la loro parte.', 'warn'); }
  const dai = (e, q) => { const posto = sup && e.classe === 'veterano' ? Math.max(0, 200 - (e.oro || 0)) : Infinity, g = Math.min(q, posto); e.oro = (e.oro || 0) + g; return g; };   // il veterano non porta più di 200 p.o.
  let resto = tot; const nani = vivi.filter(e => e.classe === 'nano');
  nani.forEach(n => { if (resto > 0) resto -= dai(n, 1); });
  const quota = Math.floor(resto / vivi.length); vivi.forEach(e => { resto -= dai(e, quota); });
  for (const e of [...vivi.filter(x => sup && tratto(x, 'avido')), ...vivi]) { if (resto <= 0) break; resto -= dai(e, resto); }   // l'avanzo va prima all'Avido
  adv().bottino = adv().bottino.filter(x => x.tipo !== 'oro');
  if (resto > 0) adv().bottino.push({ id: uid(), tipo: 'oro', testo: `${resto} pezzi d’oro (non portabili dal veterano)`, valore: resto });
  log(`Oro diviso tra tutti: ${tot - resto} p.o.`); T.controllaOro(); modificato();
}

// =============================================================
//  STRUMENTI
// =============================================================
export function renderStrumenti(box) {
  box.replaceChildren();
  const a = adv();
  if (a.trappolaAttiva) box.append(cartaTrappola(a.trappolaAttiva));
  box.append(h('div', { class: 'card' }, h('h3', {}, 'Azioni di classe'),
    h('div', { class: 'tools' }, ...Eff.AZIONI_CLASSE.map(az => { const chi = Eff.eroiPerAzione(az); return h('button', { class: chi.length ? '' : 'spent', disabled: !chi.length, title: chi.length ? `${az.info} (${chi.map(e => e.nome).join(', ')})` : `Serve ${az.classi.join(' o ')} nel gruppo`, onclick: () => Eff.eseguiAzioneClasse(az.id) }, az.nome); }))));
  if (suppl()) box.append(cartaSupplemento());
  box.append(h('div', { class: 'card' }, h('h3', {}, 'Azioni di gioco'),
    h('div', { class: 'tools' },
      btn('Mostro errante', async () => { const m = await G.monstroErrante(); G.avviaIncontro(m, G.tileById(a.stanzaCorrente)); }),
      btn('Trappola', () => G.trappola()),
      btn('Tesoro (d6)', async () => { const t = await G.tesoro(); toast(t); }),
      btn('Oggetto magico', async () => { const o = await G.oggettoMagico(); a.bottino = [...(a.bottino || []), { id: Math.random().toString(36).slice(2), ...o }]; log(`Oggetto magico: ${o.testo}`); modificato(); }),
      btn('Pergamena a caso', async () => { const r = await dado('Incantesimo a caso'); const lista = incantesimoACasoLista(); const n = lista[(lista.length === 12 ? r.totale + (Math.random() < 0.5 ? 0 : 6) : r.totale) - 1]; toast(`Pergamena: ${n}`); a.bottino = [...(a.bottino || []), { id: Math.random().toString(36).slice(2), tipo: 'pergamena', testo: `Pergamena: ${n}`, incantesimo: n }]; log(`Pergamena: ${n}`); modificato(); }),
      btn('Caratteristica speciale', () => G.caratteristica()),
      btn('Missione', async () => { const r = await dado('Missione (d6)'); const row = riga(R.tabelle.missioni, r.totale); modalTesto(row.nome, row.testo); log(`Missione: ${row.nome} – ${row.testo}`); }),
      btn('Ricompensa epica', async () => { const r = await dado('Ricompensa epica (d6)'); const row = riga(tabella('ricompense'), r.totale); modalTesto(row.nome, row.testo); a.ricompense = [...(a.ricompense || []), row.nome]; log(`Ricompensa epica: ${row.nome}`); modificato(); }),
      btn('Riposa (stanza sicura)', async () => { if (!G.stanzaSicura(G.tileById(a.stanzaCorrente)) && !(await confirmBox('La stanza attuale non è vuota né ripulita (le stanze sicure sono evidenziate in verde). Riposare comunque?'))) return; riposa(); const m = await G.monstroErrante(); toast('Mentre riposi arrivano mostri erranti: prima tu se hai inchiodato le porte.'); G.avviaIncontro(m, G.tileById(a.stanzaCorrente)); }))));

  const ritorno = h('input', { type: 'number', min: 1, value: 1, style: 'width:64px' });
  box.append(h('div', { class: 'card' }, h('h3', {}, 'Ritorno sui passi / Usciamo da qui!'),
    h('p', { class: 'hint' }, 'Per ogni stanza già visitata che attraversi tira 1d6: con 1 attaccano i mostri erranti (alle spalle). Con un personaggio di pietra trascinato: 1-2.'),
    h('div', { class: 'row' }, h('span', {}, 'Stanze attraversate'), ritorno,
      btn('Tira', async () => {
        for (let k = 0; k < +ritorno.value; k++) { const r = await dado(`Ritorno sui passi, stanza ${k + 1}`); if (r.totale === 1) { const m = await G.monstroErrante(); log('Mostri erranti sorprendono il gruppo durante il ritorno!'); G.avviaIncontro(m, G.tileById(a.stanzaCorrente)); break; } }
      }))));

  box.append(h('div', { class: 'card' }, h('h3', {}, 'Indizi'),
    btn('Un eroe trova un indizio', () => scegliEroe('Chi trova l’indizio?', e => G.aggiungiIndizio(e)))));
  renderBottino(box);
}

/** Azioni degli oggetti, dei tratti e dei traguardi del supplemento che non dipendono da un combattimento. */
function cartaSupplemento() {
  const bt = [];
  for (const e of eroiVivi()) {
    if (e.stato === 'morto') continue;
    if (e.ondataForza > 0 && e.ondataForzaProp) bt.push(btn(`Sfonda una porta (${e.nome}, Ondata di Forza: ${e.ondataForza} stanze)`, () => O.sfondaPorta(e)));
    if (e.perm?.tomo) bt.push(btn(`Studia il tomo (${e.nome})`, () => O.studiaTomo(e), '', { disabled: !!(e.usi || {}).tomo, title: '1 volta per avventura: 2 indizi e 1 punto follia' }));
    const filtro = O.oggettoDi(e, 'filtro'); if (filtro) bt.push(btn(`Filtro della calma mentale (${e.nome})`, () => O.usaFiltro(e, filtro)));
    const am = O.oggettoDi(e, 'amuleto'); if (am && am.cariche > 0) bt.push(btn(`Amuleto curativo (${e.nome}, ${am.cariche} PV)`, async () => { const b = await K.eroeScelto('Chi guarisce?', x => x.stato !== 'morto'); if (b) await O.usaAmuleto(e, am, b); }));
    const cap = O.oggettoDi(e, 'cappuccio'); if (cap && !e.cappuccioIndossato) bt.push(btn(`Indossa il cappuccio del caos (${e.nome})`, async () => { e.cappuccioIndossato = true; await O.indossaCappuccio(e); }));
  }
  return h('div', { class: 'card' }, h('h3', {}, 'Oggetti e poteri del supplemento'), bt.length ? h('div', { class: 'tools' }, ...bt) : h('small', { class: 'hint' }, 'Nessun oggetto o potere da usare ora. Le azioni di combattimento (bomba, polvere, Assistenza, Sputafuoco…) sono nella scheda dell’incontro.'));
}

function cartaMissione(m) {
  const d = K.differenzaLivello(), t = G.tileById(adv().stanzaCorrente), ex = [];
  if (m.indiziNecessari && !m.sbloccata) ex.push(h('p', { class: 'hint' }, `Indizi di missione: ${m.indiziMissione || 0}/${m.indiziNecessari}`),
    btn(`Spendi ${m.indiziNecessari} indizi: l’obiettivo è nella prossima stanza`, () => K.spendiIndiziMissione(), '', { disabled: (m.indiziMissione || 0) < m.indiziNecessari }));
  if (m.indiziNecessari && m.sbloccata && !m.bossGenerato) ex.push(h('p', { class: 'hint' }, 'Indizi spesi: il boss della missione comparirà nella prossima stanza che esplori.'));
  if (m.id === 'esplorazione') ex.push(h('p', { class: 'hint' }, `Stanze mappate: ${adv().stanze}/10${adv().stanze >= 10 ? ' – esci dal dungeon per consegnare la mappa.' : '. Se il dungeon finisce prima, trovi una porta segreta che lo prolunga.'}`));
  if (m.id === 'cuoco') ex.push(h('p', { class: 'hint' }, `Stanza ${adv().stanze}/10: il signore del caos compare alla 10ª stanza se il mezzuomo cuoco è vivo.`));
  if (m.id === 'salvataggio') {
    ex.push(h('p', { class: 'hint' }, `Giovani rapiti: ${m.giovani ?? '?'} · trovati: ${m.apparsi || 0} · al seguito: ${(m.prigionieri || []).length} · in salvo: ${m.salvati || 0}`));
    (m.prigionieri || []).forEach((p, k) => ex.push(h('div', { class: 'row' }, h('span', { class: 'grow' }, `Giovane ${k + 1}: ${p.pv}/2 PV`),
      btn('−', () => K.feritaPrigioniero(k, -1), 'mini'), btn('+', () => K.feritaPrigioniero(k, 1), 'mini'))));
    ex.push(h('div', { class: 'row wrap' },
      btn('Libera il prigioniero della stanza', () => K.liberaPrigioniero(), '', { disabled: !t?.prigionieri }),
      btn('Porta i giovani in salvo (all’ingresso)', () => K.portaFuoriPrigionieri(), '', { disabled: !(m.prigionieri || []).length }),
      btn('Ultima stanza: gli altri giovani', () => K.ultimaStanzaPrigionieri(), '', { title: 'Nell’ultima stanza del dungeon compaiono tutti i giovani rimasti' })));
  }
  if (m.id === 'arazzo' && m.arazzoTrovato && !m.portatoreArazzo && !m.arazzoLasciato) ex.push(btn('Prendi l’arazzo (chi lo porta?)', async () => { const e = await K.eroeScelto('Chi porta l’arazzo?', x => x.stato === 'ok'); if (e) K.prendiArazzo(e); }));
  if (m.id === 'arazzo' && m.portatoreArazzo) ex.push(h('p', { class: 'hint' }, `L’arazzo è portato da ${eroePerId(m.portatoreArazzo)?.nome}: niente armi a due mani né archi, difesa a -1.`), btn('Lascia cadere l’arazzo', () => K.lasciaArazzo()));
  if (m.id === 'arazzo' && m.arazzoLasciato) ex.push(btn('Riprendi l’arazzo (1 azione)', async () => { const e = await K.eroeScelto('Chi lo riprende?', x => x.stato === 'ok'); if (e) K.riprendiArazzo(e); }));
  if (m.id === 'ascia' && m.asciaTrovata && !m.asciaPresa) ex.push(btn('Prendi l’ascia di Nydann (chi la impugna?)', async () => { const e = await K.eroeScelto('Chi prende l’ascia?', x => x.stato === 'ok'); if (e) K.prendiAscia(e); }));
  return h('div', { class: `card ${m.completata ? 'done' : ''}` }, h('h3', {}, `Missione: ${m.nome} (L${m.liv})${m.completata ? ' ✓' : ''}`), h('p', {}, m.testo),
    h('p', { class: 'hint' }, `Obiettivo: ${m.obiettivo}.${d ? ` Gruppo di ${d} livell${d === 1 ? 'o' : 'i'} sopra il consigliato: +${d} mostri minori e +${d} PV ai maggiori.` : ''} Qui ogni tiro ES è a +1 e gli infestanti contano come seguaci.`),
    ...ex,
    h('div', { class: 'row wrap' },
      ['cuoco', 'arazzo', 'signore', 'ascia'].includes(m.id) && !m.completata ? btn(m.id === 'cuoco' ? 'Incontra il signore del caos (a mano)' : m.id === 'arazzo' ? 'Genera il custode (a mano)' : 'Genera il boss della missione (a mano)', () => K.generaBossMissione()) : null,
      !m.completata ? btn('Missione compiuta', () => K.completaMissione(), 'primary') : null));
}

function modalTesto(titolo, testo) { modal(titolo, (b, close) => { b.append(h('p', {}, testo), h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: close }, 'Ok'))); }); }

function cartaTrappola(t) {
  return h('div', { class: 'card trap' }, h('h3', {}, `Trappola: ${t.nome} (L${t.liv})`), h('p', {}, t.testo),
    h('div', { class: 'row wrap' },
      btn('Scegli come affrontarla…', () => Eff.proponiTrappola(t), 'primary'),
      t.caos ? btn('Tira «Toccato dal caos»', async () => { const e = await K.eroeScelto('Chi è toccato dal caos?', x => x.stato === 'ok'); if (e) await K.toccatoDalCaos(e); }) : null,
      btn('Ignora', () => { adv().trappolaAttiva = null; modificato(); })));
}

// =============================================================
//  REGISTRO
// =============================================================
export function renderRegistro(box) {
  box.replaceChildren();
  const nota = h('input', { type: 'text', placeholder: 'Aggiungi una nota al registro…', onkeydown: ev => { if (ev.key === 'Enter' && nota.value.trim()) { log(`✎ ${nota.value.trim()}`); nota.value = ''; } } });
  box.append(h('div', { class: 'row' }, nota, btn('Aggiungi', () => { if (nota.value.trim()) { log(`✎ ${nota.value.trim()}`); nota.value = ''; } })));
  const l = h('div', { class: 'log' });
  [...(S.registro || [])].reverse().slice(0, 300).forEach(r => l.append(h('div', {}, r)));
  box.append(l, h('small', { class: 'hint' }, 'Il registro è salvato in data/campagne/<campagna>/registro.txt'));
}
