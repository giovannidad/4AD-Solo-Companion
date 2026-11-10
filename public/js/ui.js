// Pannelli di destra: Dungeon, Incontro, Strumenti, Registro.
import { R, S, log, modificato, eroiVivi, eroiAttivi, eroePerId, ordineMarcia, livelloMax } from './state.js';
import { h, modal, toast, confirmBox, scelta } from './util.js';
import * as K from './caos.js';
import { dado, tira, d6Esplosivo } from './dice.js';
import * as G from './game.js';
import * as C from './combat.js';
import * as table from './map2d.js';
import { descriviMostro, reazioniElenco, modAttacco, modDifesa, armaDi, nomeClasse, gruppoHaLanterna, haNano, riga, tabella, SETS, incantesimoACasoLista } from './rules.js';
import { riposa, scheda } from './party.js';

const adv = () => S.adv;
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
      h('label', { class: 'chk', title: 'Dal 3° livello puoi passare alle tabelle avanzate; «Caverne del Caos» è il dungeon a tema del supplemento «Contro il Caos».' }, 'Tabelle del dungeon ',
        h('select', { onchange: ev => { S.party.set = ev.target.value; modificato('party'); } }, Object.entries(SETS).map(([v, t]) => h('option', { value: v, selected: (S.party.set || 'base') === v }, t)))),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!S.party.supplCaos, onchange: ev => { S.party.supplCaos = ev.target.checked; modificato('party'); } }), 'Usa il supplemento «Contro il Caos» (nuovi incantesimi, armi, classi, tratti e traguardi)'),
      btn('Inizia una nuova avventura', async () => { if (await G.iniziaAvventura()) table.setView('fit'); }, 'primary big')));
    return;
  }
  const pend = a.tessere.find(t => t.pending);
  if (a.set && a.set !== 'base') box.append(h('div', { class: 'tag' }, SETS[a.set]));
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
      (() => { const cur = G.tileById(a.stanzaCorrente); return cur?.contenuto?.vuota && !cur.perquisita ? btn(`Perquisisci la stanza attuale (${cur.nome})`, () => perquisisciUI(cur), 'accent big') : null; })(),
      h('label', { class: 'chk' }, fin, 'Nessuna porta da aprire: ultima stanza = boss finale'),
      h('label', { class: 'chk' }, seg, 'Stanza segreta (mostri sorpresi, -1 LIV al primo turno)')));
  }

  // elenco stanze
  const lista = h('div', { class: 'rooms' });
  [...a.tessere].filter(t => !t.pending).reverse().forEach(t => {
    const c = t.contenuto;
    lista.append(h('div', { class: `room ${a.stanzaCorrente === t.id ? 'cur' : ''}`, onclick: () => { table.selectTile(t.id); a.stanzaCorrente = t.id; modificato('avventura'); } },
      h('img', { src: t.src, alt: '' }),
      h('div', { class: 'grow' }, h('b', {}, `${t.nome}${t.corridoio ? ' · corridoio' : ''}`), h('small', {}, c ? c.testo : '—')),
      h('div', { class: 'col' },
        c?.vuota && !t.perquisita ? btn('Perquisisci', () => perquisisciUI(t), 'mini') : (t.perquisita ? h('small', {}, 'P') : null),
        t.sospeso ? btn('Rientra', () => { C.riprendiIncontro(t); }, 'mini') : null)));
  });
  box.append(h('h4', {}, 'Mappa esplorata'), lista);

  box.append(h('div', { class: 'card' },
    h('h3', {}, 'Fine dell’avventura'),
    h('div', { class: 'row wrap' },
      btn('Boss ucciso e uscito dal dungeon', async () => { if (await confirmBox('Concludere l’avventura con successo?')) G.terminaAvventura('Missione compiuta: boss finale sconfitto e uscita dal dungeon'); }, 'primary'),
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
      box.append(h('div', { class: 'card done' }, h('h4', {}, i.esito === 'sconfitta' ? 'Il gruppo è stato sconfitto' : i.esito === 'corrotto' ? 'Mostri corrotti' : i.esito === 'fuga' ? 'Mostri fuggiti' : 'Incontro vinto!'),
        h('div', { class: 'row wrap' },
          bottino && i.tes !== 'NO' && !i.errante ? btn('Saccheggia (tira il tesoro)', () => C.saccheggia(), 'primary') : null,
          btn('Chiudi incontro', () => C.chiudiIncontro(), i.tesoroPreso || !bottino ? 'primary' : ''))));
      break;
    }
  }
  renderBottino(box);
  if (i.cronaca?.length) box.append(h('h4', {}, 'Cronaca dell’incontro'), h('div', { class: 'chron' }, [...i.cronaca].reverse().slice(0, 14).map(t => h('div', {}, t))));
}

function renderCombattimento(box, i) {
  const gruppo = ordineMarcia().filter(e => e.stato === 'ok');
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
      h('div', { class: 'ahead' }, h('b', {}, e.nome), h('small', {}, `${nomeClasse(e)} ${e.livello} · ${e.pv}/${e.pvMax} PV`), h('span', { class: 'mod', title: m.parti.map(p => `${p[0]} ${p[1] > 0 ? '+' : ''}${p[1]}`).join('\n') || 'Nessun modificatore' }, `ATT ${m.tot >= 0 ? '+' : ''}${m.tot}`)),
      h('div', { class: 'arow' },
        fronte ? [armiSel, fur, btn('Attacca', async () => { const furioso = !!ui.furioso[e.id] && (e.usi.furie || 0) < Math.ceil(e.livello / 2); ui.furioso[e.id] = false; await C.attacca(e, { armaId: ui.arma[e.id], furioso }); }, 'primary')] : h('small', {}, 'In seconda fila: solo incantesimi e armi da lancio.'),
        e.classe === 'assassino' && fronte ? btn('Marchia', () => C.marchia(e), 'accent') : null,
        ...azioniMagiche(e, pronti)));
    eroiBox.append(rowEl);
  });
  const sezGruppo = [h('h4', {}, 'Turno del gruppo'), eroiBox];

  // mostri
  const key = `${i.id}-${i.turno}-${i.n}-${i.pv}-${gruppo.map(g => g.id).join('')}-${i.sorpresa}`;
  if (ui.assegnKey !== key) { ui.assegn = C.propostaAttacchi(); ui.assegnKey = key; }
  const as = h('div', { class: 'assign' });
  ui.assegn.forEach((a, k) => as.append(h('div', { class: 'row' }, h('span', {}, `Attacco ${k + 1} →`), h('select', { onchange: ev => { a.eroeId = ev.target.value; } }, gruppo.map(g => h('option', { value: g.id, selected: g.id === a.eroeId }, g.nome))))));
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
    out.push(sel, bersagli, btn('Lancia', () => C.lancia(e, +(sel.value), { bersaglioId: bersagli.value })));
  }
  if (e.classe === 'chierico') {
    const bers = h('select', {}, S.party.eroi.filter(x => x.stato !== 'morto').map(x => h('option', { value: x.id }, x.nome)));
    out.push(bers, btn(`Cura (${3 - (e.usi.guarigione || 0)})`, () => C.guarisci(e, eroePerId(bers.value)), '', { disabled: (e.usi.guarigione || 0) >= 3 }),
      btn(`Benedizione (${3 - (e.usi.benedizione || 0)})`, () => C.usaBenedizione(e, eroePerId(bers.value)), '', { disabled: (e.usi.benedizione || 0) >= 3 }));
  }
  return out;
}

// =============================================================
//  BOTTINO
// =============================================================
function renderBottino(box) {
  const b = adv().bottino || [];
  if (!b.length) return;
  box.append(h('h4', {}, 'Bottino da assegnare'));
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
  if (x.tipo === 'oro') e.oro = (e.oro || 0) + x.valore;
  else if (x.tipo === 'cristallo') await K.usaCristallo(e);
  else if (x.bonusDifesa) { e.bonusDifesa = Math.max(e.bonusDifesa || 0, x.bonusDifesa); (e.oggetti = e.oggetti || []).push({ nome: x.testo.split('.')[0], qta: 1 }); }
  else if (x.bonusArma) { e.bonusMagico = Math.max(e.bonusMagico || 0, x.bonusArma); (e.oggetti = e.oggetti || []).push({ nome: x.testo.split('.')[0], qta: 1 }); }
  else (e.oggetti = e.oggetti || []).push({ nome: x.testo, qta: 1, valore: x.valore, tipo: x.tipo });
  if (x.tipo === 'pergamena' && e.incantesimi) { /* resta come oggetto: usala da “Lancia” in scheda */ }
  adv().bottino = adv().bottino.filter(y => y.id !== x.id);
  log(`${e.nome} prende: ${x.testo}`); modificato();
}
function dividiOro() {
  const monete = adv().bottino.filter(x => x.tipo === 'oro'); const tot = monete.reduce((a, x) => a + x.valore, 0);
  const vivi = S.party.eroi.filter(e => e.stato !== 'morto'); if (!vivi.length) return;
  let resto = tot; const nani = vivi.filter(e => e.classe === 'nano');
  nani.forEach(n => { if (resto > 0) { n.oro = (n.oro || 0) + 1; resto--; } });
  const quota = Math.floor(resto / vivi.length); vivi.forEach(e => { e.oro = (e.oro || 0) + quota; });
  const avanzo = resto - quota * vivi.length; if (avanzo) vivi[0].oro += avanzo;
  adv().bottino = adv().bottino.filter(x => x.tipo !== 'oro');
  log(`Oro diviso tra tutti: ${tot} p.o.`); modificato();
}

// =============================================================
//  STRUMENTI
// =============================================================
export function renderStrumenti(box) {
  box.replaceChildren();
  const a = adv();
  if (a.trappolaAttiva) box.append(cartaTrappola(a.trappolaAttiva));
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
      btn('Riposa (stanza sicura)', async () => { riposa(); const m = await G.monstroErrante(); toast('Mentre riposi arrivano mostri erranti: prima tu se hai inchiodato le porte.'); G.avviaIncontro(m, G.tileById(a.stanzaCorrente)); }))));

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

function cartaMissione(m) {
  const d = K.differenzaLivello();
  return h('div', { class: `card ${m.completata ? 'done' : ''}` }, h('h3', {}, `Missione: ${m.nome} (L${m.liv})${m.completata ? ' ✓' : ''}`), h('p', {}, m.testo),
    h('p', { class: 'hint' }, `Obiettivo: ${m.obiettivo}.${d ? ` Gruppo di ${d} livell${d === 1 ? 'o' : 'i'} sopra il consigliato: +${d} mostri minori e +${d} PV ai maggiori.` : ''} Qui ogni tiro ES è a +1 e gli infestanti contano come seguaci.`),
    h('div', { class: 'row wrap' },
      ['cuoco', 'arazzo', 'signore', 'ascia'].includes(m.id) && !m.completata ? btn(m.id === 'cuoco' ? 'Incontra il signore del caos' : m.id === 'arazzo' ? 'Trova l’arazzo (custode)' : 'Genera il boss della missione', () => K.generaBossMissione()) : null,
      !m.completata ? btn('Missione compiuta', () => K.completaMissione(), 'primary') : null));
}

function modalTesto(titolo, testo) { modal(titolo, (b, close) => { b.append(h('p', {}, testo), h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: close }, 'Ok'))); }); }

function cartaTrappola(t) {
  const front = ordineMarcia().filter(e => e.stato === 'ok');
  const furf = front[0]?.classe === 'furfante' ? front[0] : null;
  return h('div', { class: 'card trap' }, h('h3', {}, `Trappola: ${t.nome} (L${t.liv})`), h('p', {}, t.testo),
    h('div', { class: 'row wrap' },
      furf ? btn('Il furfante prova a disarmarla', async () => {
        const r = await d6Esplosivo(`Disarmare la trappola (${furf.nome})`); const tot = r.totale + furf.livello;
        const ok = r.naturale === 6 || (r.naturale !== 1 && tot > t.liv);
        log(`${furf.nome} ${ok ? 'disinnesca' : 'non riesce a disinnescare'} la trappola (${tot} contro L${t.liv}).`);
        if (ok) { adv().trappolaAttiva = null; modificato(); } else toast('Fallito: la trappola scatta.', 'warn');
      }) : null,
      btn('Risolvi la trappola', () => risolviTrappola(t), 'primary'),
      t.caos ? btn('Tira «Toccato dal caos»', async () => { const e = await K.eroeScelto('Chi è toccato dal caos?', x => x.stato === 'ok'); if (e) await K.toccatoDalCaos(e); }) : null,
      btn('Ignora', () => { adv().trappolaAttiva = null; modificato(); })));
}

async function risolviTrappola(t) {
  const vivi = ordineMarcia().filter(e => e.stato === 'ok'); if (!vivi.length) return;
  const casuale = () => vivi[Math.floor(Math.random() * vivi.length)];
  const n = t.nome;
  const prova = async (e, { salvezza, extra = 0, ctx = {} }) => {
    const r = await d6Esplosivo(`${n}: ${salvezza ? 'tiro salvezza' : 'difesa'} di ${e.nome}`);
    let mod = extra;
    if (salvezza) { mod += e.armatura === 'leggera' && n === 'Botola' ? -1 : e.armatura === 'pesante' && n === 'Botola' ? -2 : 0; if (['elfo', 'mezzuomo'].includes(e.classe) && ['Botola', 'Tagliola'].includes(n)) mod += 1; if (e.classe === 'furfante') mod += e.livello; if (e.zoppo) mod -= 2; }
    else mod += modDifesa(e, ctx).tot;
    const tot = r.totale + mod;
    const ok = salvezza ? (r.naturale !== 1 && tot >= t.liv) : (r.naturale === 6 || (r.naturale !== 1 && tot > t.liv));
    log(`${n}: ${e.nome} tira ${tot} contro L${t.liv} → ${ok ? 'evita' : 'colpito'}.`);
    return ok;
  };
  const ferisci = (e, k) => C.perdiPV(e, k, n);
  switch (n) {
    case 'Botola': { const e = vivi[0]; if (!(await prova(e, { salvezza: true }))) { ferisci(e, 1); toast(`${e.nome} cade nella botola: serve un compagno per tirarlo fuori.`); } break; }
    case 'Dardo': { const e = casuale(); if (!(await prova(e, {}))) ferisci(e, 1); break; }
    case 'Gas velenoso': for (const e of vivi) if (!(await prova(e, { ctx: { ignoraArmatura: true } }))) ferisci(e, 1); break;
    case 'Lance': { for (let k = 0; k < 2; k++) { const e = casuale(); if (!(await prova(e, {}))) ferisci(e, 1); } break; }
    case 'Masso gigante': { const e = vivi[vivi.length - 1]; if (!(await prova(e, { ctx: { ignoraScudo: true } }))) ferisci(e, 2); break; }
    case 'Lancia dardi avvelenati': {
      const e = casuale();
      if (!(await prova(e, { salvezza: true, extra: e.classe === 'mezzuomo' ? 1 : 0 }))) {
        if (!(await C.salva(e, 4, e.classe === 'barbaro' ? 1 : 0, 'Veleno del dardo'))) { e.infettoCaos = true; log(`${e.nome} è infettato dal caos: al primo 1 tirerà su «Toccato dal caos».`); toast(`${e.nome} è infettato dal caos.`, 'warn'); }
      }
      break;
    }
    case 'Catene del caos': { const e = casuale(); if (!(await prova(e, { salvezza: true, extra: ['furfante'].includes(e.classe) ? 0 : e.classe === 'mezzuomo' ? e.livello : e.classe === 'elfo' ? 1 : 0 }))) { ferisci(e, 1); K.follia(e, 1); } break; }
    case 'Fossa del mostro': {
      const e = casuale(); const extra = (e.classe === 'elfo' ? e.livello : 0) + (e.classe === 'nano' ? -1 : 0);
      let ok = await prova(e, { salvezza: true, extra }); if (!ok && e.classe === 'mezzuomo') ok = await prova(e, { salvezza: true, extra });
      if (!ok) {
        ferisci(e, 1);
        const m = await G.monstroDa('aberranti'); m.nome += ' (nella fossa)'; m.mostriPrima = true; m.noMorale = true;
        G.avviaIncontro(m, G.tileById(adv().stanzaCorrente));
        toast(`${e.nome} cade nella fossa: il mostro attacca per primo. I compagni possono aiutarlo.`, 'warn');
      }
      break;
    }
    case 'Mannaia gigante': { const e = casuale(); if (!(await prova(e, { salvezza: true, extra: ['elfo', 'mezzuomo'].includes(e.classe) ? 1 : 0 }))) ferisci(e, 2); break; }
    case 'Gas lacrimogeno': for (const e of vivi) if (!(await C.salva(e, 5, ['barbaro', 'nano'].includes(e.classe) ? e.livello : 0, 'Gas lacrimogeno'))) { ferisci(e, 1); log(`${e.nome} ha la vista sfocata per 2 incontri (niente armi a distanza né pergamene).`); } break;
    case 'Globo del caos': {
      const giri = [vivi, [...vivi].reverse()]; let fermo = false;
      for (const giro of giri) { for (const e of giro) {
        if (fermo || e.stato !== 'ok') continue;
        let come = 'schiva';
        if (e.scudo) come = await scelta('Globo del caos', `${e.nome}: schivi o pari con lo scudo?`, [['schiva', 'Schiva'], ['para', 'Para con lo scudo']]) || 'schiva';
        if (come === 'schiva') {
          if (await C.salva(e, 7, (e.classe === 'furfante' ? e.livello : ['elfo', 'mezzuomo'].includes(e.classe) ? Math.floor(e.livello / 2) : 0), 'Schivata del globo')) continue;
        } else {
          const r = await d6Esplosivo(`Parata del globo – ${e.nome} (L8)`);
          const tot = r.totale + modDifesa(e, {}).tot + (['barbaro', 'guerriero', 'nano'].includes(e.classe) ? e.livello : 0);
          if (r.naturale === 6 || (r.naturale !== 1 && tot > 8)) { e.scudo = false; log(`${e.nome} para il globo: lo scudo è distrutto e il globo si ferma.`); fermo = true; continue; }
        }
        ferisci(e, 3);
      } }
      break;
    }
    case 'Tagliola': { const e = vivi[0]; if (!(await prova(e, { salvezza: true }))) { ferisci(e, 1); if (e.stato === 'ok') { e.zoppo = true; log(`${e.nome} zoppica (-1 attacco e difesa).`); } } break; }
  }
  adv().trappolaAttiva = null; modificato();
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
