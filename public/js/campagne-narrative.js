// Campagne narrative: scelta della campagna, poi dell'avventura, poi del gruppo (quello attuale, eroi di un'altra partita salvata oppure un gruppo nuovo).
// Nota di vocabolario: la «partita salvata» è lo slot del menu in alto (gruppo + dungeon); la «campagna narrativa» è una serie di avventure collegate.
import { R, S, log, modificato, eroiVivi, nuovoEroe, nuovaPartita } from './state.js';
import { api } from './api.js';
import { h, modal, toast } from './util.js';
import { tira } from './dice.js';
import { classeDisponibile, nomeClasse } from './rules.js';
import { equipaggiamentoIniziale, nomeCasuale, sistemaSlot } from './party.js';
import * as V from './silvani.js';
import * as AL from './aldila.js';
import * as MG from './modulo-gioco.js';

const livelli = l => (!l ? '?' : l.min === l.max ? `${l.min}` : `${l.min}-${l.max}`);
const OPZIONI_GRUPPO = ['supplCaos', 'supplAbisso', 'supplProfondita', 'supplAcque', 'supplSilvani', 'supplAldila', 'tema'];   // impostazioni che il nuovo gruppo eredita
const ORO_PER_LIVELLO = 30;   // ricchezza in più per ogni livello oltre il primo (equipaggiamento di avanzamento)

// ---------------- dati ----------------
const cache = new Map();
async function carica(file) {
  if (!cache.has(file)) {
    const r = await fetch(`assets/moduli/${file}`);
    cache.set(file, r.ok ? MG.leggiModulo(await r.text()) : { def: null, errori: ['file non trovato'], avvisi: [] });
  }
  return cache.get(file);
}
async function elenco() {
  const r = await fetch('assets/moduli/campagne.json'); if (!r.ok) return [];
  const out = [];
  for (const c of await r.json()) {
    const av = [];
    for (const f of c.avventure || []) { const x = await carica(f); if (x.def) av.push({ file: f, def: x.def, avvisi: x.avvisi }); }
    if (!av.length) continue;
    const l = av.map(a => a.def.livello).filter(Boolean);
    out.push({ ...c, av, livello: l.length ? { min: Math.min(...l.map(x => x.min)), max: Math.max(...l.map(x => x.max)) } : null });
  }
  return out;
}

// ---------------- finestre (una alla volta) ----------------
let corrente = null;
function vai(titolo, costruisci) {
  const prima = corrente; corrente = null; prima?.();
  const m = modal(titolo, (b, close) => costruisci(b, close), { wide: true, onClose: () => { if (corrente === m?.close) corrente = null; } });
  corrente = m.close;
}
const pulsante = (titolo, righe, onclick, disabilitato) => h('button', { class: 'item-btn', onclick, disabled: !!disabilitato }, h('b', {}, titolo), ...righe.filter(Boolean).map(r => h('span', {}, r)));
const fine = (...bt) => h('div', { class: 'row end' }, ...bt);
const indietro = (testo, fn) => h('button', { onclick: fn }, `← ${testo}`);

export async function apri() {
  let lista;
  try { lista = await elenco(); } catch (e) { toast('Non riesco a leggere le campagne: ' + (e.message || e), 'warn'); return; }
  if (!lista.length) { toast('Nessuna campagna disponibile.', 'warn'); return; }
  schermataCampagne(lista);
}

const PER_PAGINA = 3;   // campagne mostrate per pagina
let paginaCampagne = 0, ricercaCampagne = '';
const senzaAccenti = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Ricerca con un solo campo: le parole cercano nel nome della campagna o delle sue avventure; un numero («3») o un intervallo («2-4») cerca per livello. */
function corrisponde(c, testo) {
  const nomi = senzaAccenti([c.nome, ...c.av.map(a => a.def.nome)].join(' '));
  return testo.split(/\s+/).filter(Boolean).every(t => {
    const m = t.match(/^(?:liv(?:ello)?\.?)?(\d+)(?:-(\d+))?$/);
    if (!m) return nomi.includes(senzaAccenti(t));
    const da = +m[1], a = m[2] ? +m[2] : da;
    return c.av.some(x => x.def.livello && x.def.livello.min <= Math.max(da, a) && x.def.livello.max >= Math.min(da, a));
  });
}
function schermataCampagne(lista) {
  vai('Campagne narrative', (b, close) => {
    const cerca = h('input', { type: 'search', placeholder: 'Cerca per nome o livello (es. «pozzo», «3», «2-4»)', value: ricercaCampagne, 'aria-label': 'Cerca campagne' });
    const elencoEl = h('div', {}), navEl = h('div', {});
    const disegna = () => {
      const trovate = lista.filter(c => corrisponde(c, ricercaCampagne));
      const pagine = Math.max(1, Math.ceil(trovate.length / PER_PAGINA));
      paginaCampagne = Math.min(paginaCampagne, pagine - 1);
      const p = paginaCampagne;
      elencoEl.replaceChildren(trovate.length
        ? h('div', { class: 'list' }, trovate.slice(p * PER_PAGINA, (p + 1) * PER_PAGINA).map(c => pulsante(c.nome, [c.descrizione, `Livelli ${livelli(c.livello)} · ${c.av.length} ${c.av.length === 1 ? 'avventura' : 'avventure'}`], () => schermataAvventure(lista, c))))
        : h('p', { class: 'warn-box' }, 'Nessuna campagna corrisponde alla ricerca.'));
      navEl.replaceChildren(...[pagine > 1 ? h('div', { class: 'row end' },
        h('button', { disabled: p === 0, onclick: () => { paginaCampagne = p - 1; disegna(); } }, '‹ Precedenti'),
        h('span', { class: 'hint' }, `Pagina ${p + 1} di ${pagine}`),
        h('button', { disabled: p >= pagine - 1, onclick: () => { paginaCampagne = p + 1; disegna(); } }, 'Successive ›')) : null].filter(Boolean));
    };
    cerca.addEventListener('input', () => { ricercaCampagne = cerca.value.trim(); paginaCampagne = 0; disegna(); });
    disegna();
    b.append(h('p', { class: 'hint' }, 'Scegli una campagna, poi l’avventura da giocare e infine il gruppo.'), cerca, elencoEl, navEl, fine(h('button', { onclick: close }, 'Chiudi')));
  });
}

const conclusa = def => !!(def.serie && S.party?.scelteModuli?.[`${def.serie.id}:${def.serie.numero}`]);

function schermataAvventure(lista, c) {
  vai(c.nome, (b, close) => {
    b.append(h('p', {}, c.descrizione), h('p', { class: 'hint' }, `Livelli ${livelli(c.livello)}. Le avventure si possono scegliere in qualsiasi ordine; le «✓» sono già concluse in questa partita.`),
      h('div', { class: 'list' }, c.av.map(a => {
        const d = a.def;
        return pulsante(`${d.serie ? `${d.serie.numero}. ` : ''}${d.nome}${conclusa(d) ? '  ✓' : ''}`,
          [d.descrizione, `Livello ${livelli(d.livello)} · ${d.eroi ? `${livelli(d.eroi)} eroi · ` : ''}${d.stanze.length} stanze`], () => schermataGruppo(lista, c, a));
      })),
      fine(indietro('Campagne', () => schermataCampagne(lista)), h('button', { onclick: close }, 'Chiudi')));
  });
}

// ---------------- scelta del gruppo ----------------
const livelloMin = def => def.livello?.min || 1;
const eroiGiocabili = () => eroiVivi().filter(e => !e.merc && e.stato === 'ok');

function nomePartitaAttuale() { return api.elencoCampagne().then(l => l.find(x => x.id === S.camp)?.nome || '').catch(() => ''); }

async function schermataGruppo(lista, c, a) {
  const def = a.def, min = livelloMin(def), vivi = eroiGiocabili();
  const sotto = vivi.filter(e => e.livello < min), attuale = vivi.length > 0 && !sotto.length;
  const nome = await nomePartitaAttuale();
  const prev = def.serie && def.serie.numero > 1 && !S.party?.scelteModuli?.[`${def.serie.id}:${def.serie.numero - 1}`];
  vai(def.nome, (b, close) => {
    b.append(
      h('p', {}, def.obiettivo || def.descrizione || ''),
      h('p', { class: 'hint' }, `Per giocarla serve un gruppo di livello ${min} o superiore (consigliato ${livelli(def.livello)}${def.eroi ? `, ${livelli(def.eroi)} eroi` : ''}).`),
      prev ? h('p', { class: 'warn-box' }, 'Il capitolo precedente non risulta concluso in questa partita: la storia potrebbe non tornare, ma si può giocare lo stesso.') : null,
      h('div', { class: 'list' },
        pulsante(`Usa il gruppo attuale${nome ? ` («${nome}»)` : ''}`,
          [vivi.length ? vivi.map(e => `${e.nome} (${nomeClasse(e)} ${e.livello})`).join(', ') : 'Nessun eroe in questa partita.',
            !attuale && vivi.length ? `Non utilizzabile: ${sotto.map(e => e.nome).join(', ')} ha livello inferiore a ${min}.` : null],
          () => { close(); MG.presenta(def, a.avvisi); }, !attuale),
        pulsante('Carica gli eroi da un’altra partita salvata', ['Gli eroi vengono copiati in una nuova partita; quella originale non cambia.'], () => schermataCarica(lista, c, a)),
        pulsante(`Crea un nuovo gruppo di livello ${min}`, ['Scegli classe e nome degli eroi: vengono portati al livello richiesto.'], () => schermataNuovo(lista, c, a))),
      fine(indietro(c.nome, () => schermataAvventure(lista, c)), h('button', { onclick: close }, 'Chiudi')));
  });
}

// ---------------- apertura di una nuova partita ----------------
/** Cambia partita come se la si scegliesse dal menu in alto e aspetta che sia caricata. */
async function apriPartita(id) {
  const pronta = new Promise(res => { const f = ev => { if (ev.detail === id) { document.removeEventListener('campagna-aperta', f); res(); } }; document.addEventListener('campagna-aperta', f); });
  document.dispatchEvent(new CustomEvent('campagne-cambiate', { detail: id }));
  await Promise.race([pronta, new Promise((_, ko) => setTimeout(() => ko(new Error('la nuova partita non si apre')), 8000))]);
  await new Promise(r => setTimeout(r, 150));   // lascia finire il disegno della mappa
}
const nomeNuovaPartita = (c, def) => (def.serie ? `Cap. ${def.serie.numero} ${def.nome}` : def.nome).slice(0, 40).trim();
function partitaBase(sorgente) {
  const p = nuovaPartita();
  OPZIONI_GRUPPO.forEach(k => { if (sorgente?.[k] !== undefined) p[k] = sorgente[k]; });
  return p;
}

// ---------------- eroi di un'altra partita ----------------
async function schermataCarica(lista, c, a) {
  const def = a.def, min = livelloMin(def);
  let partite = [];
  try { partite = (await api.elencoCampagne()).filter(x => x.id !== S.camp); } catch (e) { toast('Non riesco a leggere le partite salvate.', 'warn'); return; }
  const dati = [];
  for (const p of partite) { try { const party = await api.leggi(p.id, 'party'); if (party?.eroi?.length) dati.push({ ...p, party }); } catch { /* partita illeggibile: si salta */ } }
  vai('Eroi da un’altra partita', (b, close) => {
    b.append(h('p', { class: 'hint' }, `Scegli la partita da cui prendere gli eroi (servono eroi vivi di livello ${min} o superiore).`),
      dati.length ? h('div', { class: 'list' }, dati.map(p => {
        const ok = p.party.eroi.filter(e => e.stato === 'ok' && !e.merc);
        return pulsante(p.nome, [ok.length ? ok.map(e => `${e.nome} (${e.livello})`).join(', ') : 'Nessun eroe utilizzabile.'], () => schermataEroi(lista, c, a, p), !ok.some(e => e.livello >= min));
      })) : h('p', { class: 'warn-box' }, 'Non ci sono altre partite salvate con degli eroi.'),
      fine(indietro('Gruppo', () => schermataGruppo(lista, c, a)), h('button', { onclick: close }, 'Chiudi')));
  });
}

function schermataEroi(lista, c, a, p) {
  const def = a.def, min = livelloMin(def);
  vai(`Eroi di «${p.nome}»`, (b, close) => {
    const righe = p.party.eroi.map(e => {
      const motivo = e.merc ? 'mercenario' : e.stato !== 'ok' ? `stato: ${e.stato}` : e.livello < min ? `livello ${e.livello}, ne serve ${min}` : '';
      const el = h('input', { type: 'checkbox', checked: !motivo, disabled: !!motivo });
      return { e, el, riga: h('label', { class: 'chk' }, el, `${e.nome} — ${e.classe ? (R.classi[e.culto || e.classe]?.nome || e.classe) : ''} di livello ${e.livello}${motivo ? ` (${motivo})` : ''}`) };
    });
    const crea = h('button', { class: 'primary', onclick: async () => {
      const scelti = righe.filter(x => x.el.checked).map(x => x.e);
      if (!scelti.length) { toast('Scegli almeno un eroe.', 'warn'); return; }
      crea.disabled = true; close();
      try {
        const nuova = await api.creaCampagna(nomeNuovaPartita(c, def));
        const party = partitaBase(p.party);
        party.eroi = scelti.map(e => { const x = structuredClone(e); delete x.posizione; x.pv = x.pvMax; return x; });
        const ids = new Set(party.eroi.map(e => e.id));
        party.ordine = [...(p.party.ordine || []).filter(id => ids.has(id)), ...party.eroi.map(e => e.id).filter(id => !(p.party.ordine || []).includes(id))];
        if (scelti.length === p.party.eroi.filter(e => e.stato === 'ok' && !e.merc).length) party.oroComune = p.party.oroComune || 0;
        party.scelteModuli = { ...(p.party.scelteModuli || {}) };
        if (!party.eroi.some(e => e.lanterna)) party.eroi[0].lanterna = true;
        await api.scrivi(nuova.id, 'party', party);
        const rit = await api.leggi(p.id, 'ritratti').catch(() => null);
        if (rit) { const mio = {}; ids.forEach(id => { if (rit[id]) mio[id] = rit[id]; }); if (Object.keys(mio).length) await api.scrivi(nuova.id, 'ritratti', mio); }
        await apriPartita(nuova.id);
        log(`Nuova partita «${nuova.nome}»: ${S.party.eroi.map(e => `${e.nome} (${nomeClasse(e)} ${e.livello})`).join(', ')}, dalla partita «${p.nome}».`);
        MG.presenta(def, a.avvisi);
      } catch (e) { toast('Non riesco a creare la partita: ' + (e.message || e), 'warn'); }
    } }, 'Crea la nuova partita e continua');
    b.append(h('p', { class: 'hint' }, 'Gli eroi spuntati vengono copiati in una nuova partita con le loro schede, l’equipaggiamento e i ritratti. La partita originale resta com’è.'),
      ...righe.map(x => x.riga), fine(indietro('Partite', () => schermataCarica(lista, c, a)), crea));
  });
}

// ---------------- gruppo nuovo ----------------
const classiDisponibili = () => Object.entries(R.classi).filter(([, c]) => classeDisponibile(c)).map(([id]) => id);
function portaAlLivello(e, n) {
  if (n <= 1) return;
  e.livello = n; e.pvMax += n - 1; e.pv = e.pvMax; e.oro = (e.oro || 0) + ORO_PER_LIVELLO * (n - 1);
  sistemaSlot(e);   // incantesimi e simili dipendono dal livello
}

function schermataNuovo(lista, c, a) {
  const def = a.def, min = livelloMin(def), classi = classiDisponibili();
  const quanti = Math.min(Math.max(4, def.eroi?.min || 1), def.eroi?.max || 6);
  const pesca = n => { const mazzo = [...classi].sort(() => Math.random() - 0.5), out = []; while (out.length < n) { if (!mazzo.length) mazzo.push(...[...classi].sort(() => Math.random() - 0.5)); out.push(mazzo.shift()); } return out; };
  let righe = [];
  const casuale = n => { const cl = pesca(n), nomi = []; righe = cl.map(k => { const nome = nomeCasuale(nomi); nomi.push(nome); return { classe: k, nome }; }); };
  casuale(quanti);
  vai(`Nuovo gruppo di livello ${min}`, (b, close) => {
    const box = h('div', {});
    const disegna = () => {
      box.replaceChildren(...righe.map((r, i) => h('div', { class: 'row' },
        h('select', { onchange: ev => { r.classe = ev.target.value; } }, classi.map(k => h('option', { value: k, selected: k === r.classe }, R.classi[k].nome))),
        h('input', { type: 'text', value: r.nome, maxlength: 24, oninput: ev => { r.nome = ev.target.value; } }),
        h('button', { class: 'mini', title: 'Togli questo eroe', disabled: righe.length <= 1, onclick: () => { righe.splice(i, 1); disegna(); } }, '✕'))));
    };
    disegna();
    const crea = h('button', { class: 'primary', onclick: async () => {
      const usati = new Set(), specs = righe.map(r => {
        let n = (r.nome || '').trim() || 'Senza nome', k = n, i = 1;
        while (usati.has(n.toLowerCase())) n = `${k} ${['', 'II', 'III', 'IV', 'V', 'VI'][i++] || i}`;
        usati.add(n.toLowerCase()); return { classe: r.classe, nome: n };
      });
      crea.disabled = true; close();
      try {
        const nuova = await api.creaCampagna(nomeNuovaPartita(c, def));
        await api.scrivi(nuova.id, 'party', partitaBase(S.party));
        await apriPartita(nuova.id);
        for (const s of specs) {
          const e = nuovoEroe(s.classe, s.nome);
          equipaggiamentoIniziale(e);
          e.oro = (await tira(R.classi[s.classe].oro, `Ricchezza di ${e.nome}`)).totale;
          S.party.eroi.push(e); S.party.ordine.push(e.id);
          await V.dotazioneIniziale(e, true); await AL.dotazioneIniziale(e, true);
          portaAlLivello(e, min);
        }
        S.party.eroi[0].lanterna = true;
        log(`Nuovo gruppo di livello ${min}: ${S.party.eroi.map(e => `${e.nome} (${nomeClasse(e)})`).join(', ')}.${min > 1 ? ` Ogni eroe parte con l’equipaggiamento base e ${ORO_PER_LIVELLO * (min - 1)} p.o. di avanzamento.` : ''}${S.party.eroi.some(e => e.classe === 'mago') ? ' Ricordati di preparare gli incantesimi del mago.' : ''}`);
        modificato('party');
        MG.presenta(def, a.avvisi);
      } catch (e) { toast('Non riesco a creare il gruppo: ' + (e.message || e), 'warn'); }
    } }, 'Crea il gruppo e continua');
    b.append(
      h('p', { class: 'hint' }, `Scegli classe e nome di ogni eroe. Partono con l’equipaggiamento e la ricchezza di un eroe nuovo e vengono portati al livello ${min}${min > 1 ? ` (+1 punto vita per livello, incantesimi in base al livello, +${ORO_PER_LIVELLO} p.o. per livello oltre il primo)` : ''}. Verrà creata una nuova partita salvata.`),
      box,
      h('div', { class: 'row' },
        h('button', { onclick: () => { if (righe.length < 6) { righe.push({ classe: pesca(1)[0], nome: nomeCasuale(righe.map(r => r.nome)) }); disegna(); } } }, '＋ Aggiungi eroe'),
        h('button', { onclick: () => { casuale(righe.length); disegna(); } }, '🎲 Rimescola tutto')),
      fine(indietro('Gruppo', () => schermataGruppo(lista, c, a)), crea));
  });
}
