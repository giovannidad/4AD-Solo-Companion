// Avventure scritte («moduli»): formato del file, validazione e disegno delle stanze.
// Questo file non dipende dal resto dell'app (né dal DOM): lo usano sia il gioco sia `tools/valida-modulo.js`.
// Il formato è descritto in docs/MODULI.md.

export const FORMATO = '4ad-avventura';
export const VERSIONE = 1;
/** Tabelle (set di regole) che un modulo può scegliere per i tiri casuali: tesori, mostri erranti, eventi. */
export const SET = ['base', 'coboldi', 'acque', 'diabolici', 'caos', 'abisso', 'aldila', 'profondita'];   // «Labirinti Silvani» è escluso: le sue regole dipendono dalle tessere numerate della selva
export const LATI = { n: [0, -1], s: [0, 1], o: [-1, 0], e: [1, 0] };
export const TIPI_STANZA = ['ingresso', 'stanza', 'corridoio'];
export const TIPI_ELEMENTO = ['vuota', 'testo', 'mostri', 'tesoro', 'trappola', 'caratteristica', 'evento'];
export const TIPI_OGGETTO = ['oro', 'gemma', 'gioiello', 'oggetto', 'magico', 'pergamena', 'arma-magica', 'armatura-magica'];
export const TRAPPOLE_BASE = ['Botola', 'Dardo', 'Gas velenoso', 'Lance', 'Masso gigante', 'Tagliola'];
export const REAZIONI = ['combatte', 'combatte-sempre', 'fugge', 'fugge-inf', 'morte', 'corruzione', 'dorme', 'pacifico', 'amichevole'];
/** Poteri dei mostri personalizzati che il gioco sa applicare da solo (tutto il resto va scritto in `note`). */
export const POTERI = { immuneIncantesimi: 'array', immuneContundenti: 'bool', contundentePiu: 'bool', orda: 'bool', dissangua: 'bool', attPerBersaglio: 'bool', livPrimoTurno: 'int', livDifesaFerito: 'int', danno: 'int' };
export const LIMITI = { stanze: 80, lato: 60, testo: 4000 };

const reId = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const reDadi = /^\d{0,2}d\d{1,2}([+-]\d{1,3})?$/i;
const intero = v => Number.isInteger(v);
const testoOk = v => typeof v === 'string' && v.trim().length > 0 && v.length <= LIMITI.testo;
const chiave = (x, y) => x + ',' + y;

/** Contenuto di una stanza sempre come elenco di elementi (accetta anche un solo oggetto, una stringa o nulla). */
export function elementiDi(stanza) {
  const c = stanza?.contenuto;
  if (c == null) return [];
  const l = Array.isArray(c) ? c : [c];
  return l.map(e => (typeof e === 'string' ? { tipo: 'testo', testo: e } : e));
}

/** Quadretti (coordinate del modulo) di una stanza: `rettangolo` [x, y, larghezza, altezza] oppure `celle` [[x, y], …]. */
export function celleDi(s) {
  if (Array.isArray(s.celle)) return s.celle.map(c => [c[0], c[1]]);
  if (Array.isArray(s.rettangolo)) { const [x, y, w, h] = s.rettangolo, out = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push([x + i, y + j]); return out; }
  return [];
}

/**
 * Controlla un modulo. `cerca(set, tabella, id)` (facoltativo) restituisce la voce di mostro delle tabelle del gioco (o nulla se non esiste).
 * Restituisce { errori: [], avvisi: [] }: con almeno un errore il modulo non si può usare.
 */
export function valida(m, { cerca = null } = {}) {
  const errori = [], avvisi = [];
  const E = t => errori.push(t), A = t => avvisi.push(t);
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { errori: ['Il file non contiene un oggetto JSON.'], avvisi };
  if (m.formato !== FORMATO) E(`«formato» deve valere "${FORMATO}".`);
  if (m.versione !== VERSIONE) E(`«versione» deve valere ${VERSIONE}.`);
  if (typeof m.nome !== 'string' || !m.nome.trim() || m.nome.length > 60) E('«nome» è obbligatorio (testo di al massimo 60 caratteri).');
  for (const k of ['autore', 'licenza', 'descrizione', 'introduzione', 'conclusione']) if (m[k] != null && (typeof m[k] !== 'string' || m[k].length > LIMITI.testo)) E(`«${k}» deve essere un testo.`);
  if (m.obiettivo != null && !testoOk(m.obiettivo)) E('«obiettivo» deve essere un testo non vuoto.');
  if (m.serie != null && (typeof m.serie !== 'object' || typeof m.serie.id !== 'string' || !reId.test(m.serie.id) || !intero(m.serie.numero) || !intero(m.serie.di) || m.serie.numero < 1 || m.serie.di < m.serie.numero)) E('«serie» deve essere {"id": "nome-serie", "numero": n, "di": n} (capitolo n di una campagna).');
  if (m.introduzioneSe != null) {
    if (typeof m.introduzioneSe !== 'object' || Array.isArray(m.introduzioneSe)) E('«introduzioneSe» deve essere un oggetto {"numero:finale": "testo"}.');
    else for (const [k, v] of Object.entries(m.introduzioneSe)) { if (!/^\d+:[a-z0-9_-]+$/.test(k)) E(`«introduzioneSe»: la chiave «${k}» deve essere del tipo "1:finale" (capitolo e id del finale scelto).`); if (!testoOk(v)) E(`«introduzioneSe»: il testo di «${k}» deve essere un testo non vuoto.`); }
  }
  if (m.finali != null) {
    if (!Array.isArray(m.finali) || m.finali.length < 2 || m.finali.length > 6) E('«finali» deve essere un elenco da 2 a 6 finali a scelta, ciascuno {"id", "nome", "testo"}.');
    else { const visti = new Set(); m.finali.forEach((f, i) => { const d = `Finale n. ${i + 1}`; if (!f || typeof f.id !== 'string' || !reId.test(f.id)) E(`${d}: «id» obbligatorio (minuscole, cifre, - e _).`); else if (visti.has(f.id)) E(`${d}: «id» duplicato.`); else visti.add(f.id); if (!f || typeof f.nome !== 'string' || !f.nome.trim() || f.nome.length > 60) E(`${d}: «nome» obbligatorio (max 60 caratteri).`); if (!f || !testoOk(f.testo)) E(`${d}: «testo» obbligatorio.`); if (f?.scelta != null && !testoOk(f.scelta)) E(`${d}: «scelta» deve essere un testo (la domanda o la descrizione mostrata sul pulsante).`); }); }
  }
  if (!m.autore) A('Manca «autore».');
  if (!m.descrizione) A('Manca «descrizione».');
  const set = m.set ?? 'base';
  if (!SET.includes(set)) E(`«set» non valido: usa uno tra ${SET.join(', ')}.${set === 'silvani' ? ' I Labirinti Silvani non sono supportati dai moduli.' : ''}`);
  const l = m.livello;
  if (l == null) A('Manca «livello» (livello consigliato dei personaggi, es. {"min": 3, "max": 5}).');
  else if (typeof l !== 'object' || !intero(l.min) || !intero(l.max) || l.min < 1 || l.max < l.min || l.max > 30) E('«livello» deve essere {"min": n, "max": n} con 1 ≤ min ≤ max ≤ 30.');
  if (m.eroi != null && (typeof m.eroi !== 'object' || !intero(m.eroi.min) || !intero(m.eroi.max) || m.eroi.min < 1 || m.eroi.max < m.eroi.min || m.eroi.max > 12)) E('«eroi» deve essere {"min": n, "max": n} (numero di personaggi consigliato).');
  if (m.fine != null && !['boss', 'libera'].includes(m.fine)) E('«fine» deve essere "boss" (si esce dopo il boss finale, predefinito) oppure "libera".');
  if (m.tema != null) A('«tema» non è usato: le stanze del modulo sono sempre disegnate dal gioco.');

  const stanze = m.stanze;
  if (!Array.isArray(stanze) || !stanze.length) { E('«stanze» deve essere un elenco con almeno una stanza.'); return { errori, avvisi }; }
  if (stanze.length > LIMITI.stanze) E(`Troppe stanze (massimo ${LIMITI.stanze}).`);

  const ids = new Map(), occupato = new Map();   // id -> stanza ; "x,y" -> id
  let ingressi = 0, bossFinale = 0;
  stanze.forEach((s, n) => {
    const dove = `Stanza n. ${n + 1}${s?.id ? ` («${s.id}»)` : ''}`;
    if (!s || typeof s !== 'object') { E(`${dove}: deve essere un oggetto.`); return; }
    if (typeof s.id !== 'string' || !reId.test(s.id)) { E(`${dove}: «id» obbligatorio, solo lettere minuscole, cifre, - e _ (max 32).`); return; }
    if (ids.has(s.id)) { E(`${dove}: «id» duplicato.`); return; }
    ids.set(s.id, s);
    if (typeof s.nome !== 'string' || !s.nome.trim() || s.nome.length > 60) E(`${dove}: «nome» obbligatorio (max 60 caratteri).`);
    const tipo = s.tipo ?? 'stanza';
    if (!TIPI_STANZA.includes(tipo)) E(`${dove}: «tipo» deve essere ${TIPI_STANZA.join(', ')}.`);
    if (tipo === 'ingresso') ingressi++;
    if (s.testo != null && !testoOk(s.testo)) E(`${dove}: «testo» deve essere un testo non vuoto.`);
    // geometria
    if (s.celle != null && s.rettangolo != null) E(`${dove}: usa «celle» oppure «rettangolo», non entrambi.`);
    let celle = [];
    if (s.rettangolo != null) {
      const r = s.rettangolo;
      if (!Array.isArray(r) || r.length !== 4 || !r.every(intero) || r[2] < 1 || r[3] < 1 || r[2] > LIMITI.lato || r[3] > LIMITI.lato) E(`${dove}: «rettangolo» deve essere [x, y, larghezza, altezza] con numeri interi e dimensioni ≥ 1.`);
      else celle = celleDi(s);
    } else if (s.celle != null) {
      if (!Array.isArray(s.celle) || !s.celle.length || !s.celle.every(c => Array.isArray(c) && c.length === 2 && c.every(intero))) E(`${dove}: «celle» deve essere un elenco di coppie [x, y] intere.`);
      else celle = celleDi(s);
    } else E(`${dove}: manca «rettangolo» o «celle».`);
    const propri = new Set();
    for (const [x, y] of celle) {
      const k = chiave(x, y);
      if (propri.has(k)) { E(`${dove}: il quadretto [${x}, ${y}] è ripetuto.`); continue; }
      propri.add(k);
      if (occupato.has(k)) E(`${dove}: il quadretto [${x}, ${y}] è già occupato dalla stanza «${occupato.get(k)}».`);
      else occupato.set(k, s.id);
    }
    if (celle.length) {   // una stanza è un'unica area: tutti i quadretti devono toccarsi per un lato
      const visti = new Set([chiave(...celle[0])]), pila = [celle[0]];
      while (pila.length) { const [x, y] = pila.pop(); for (const [dx, dy] of Object.values(LATI)) { const k = chiave(x + dx, y + dy); if (propri.has(k) && !visti.has(k)) { visti.add(k); pila.push([x + dx, y + dy]); } } }
      if (visti.size !== propri.size) E(`${dove}: i quadretti non formano un'area unica (due parti non si toccano).`);
    }
    // contenuto
    let elementi;
    try { elementi = elementiDi(s); } catch { elementi = []; }
    if (s.contenuto != null && !Array.isArray(s.contenuto) && typeof s.contenuto !== 'object' && typeof s.contenuto !== 'string') E(`${dove}: «contenuto» deve essere un elenco di elementi.`);
    elementi.forEach((el, k) => {
      const q = `${dove}, contenuto n. ${k + 1}`;
      if (!el || typeof el !== 'object') { E(`${q}: deve essere un oggetto.`); return; }
      if (!TIPI_ELEMENTO.includes(el.tipo)) { E(`${q}: «tipo» deve essere uno tra ${TIPI_ELEMENTO.join(', ')}.`); return; }
      if (el.tipo === 'testo' && !testoOk(el.testo)) E(`${q}: «testo» obbligatorio.`);
      if (el.tipo === 'vuota' && elementi.some(x => ['mostri', 'trappola'].includes(x?.tipo))) A(`${q}: «vuota» insieme a mostri o trappole: la stanza non conta come vuota.`);
      if (el.tipo === 'mostri') {
        if (el.finale) bossFinale++;
        validaMostri(el, q, set, E, A, cerca);
      }
      if (el.tipo === 'tesoro') validaTesoro(el, q, E);
      if (el.tipo === 'trappola') {
        if (el.tira) { if (el.modello || el.nome) A(`${q}: con «tira» si ignorano «modello» e «nome».`); }
        else if (el.modello != null) {
          if (!TRAPPOLE_BASE.includes(el.modello)) E(`${q}: «modello» deve essere uno tra ${TRAPPOLE_BASE.join(', ')}.`);
          if (!intero(el.liv) || el.liv < 1 || el.liv > 30) E(`${q}: «liv» (livello della trappola) obbligatorio, intero ≥ 1.`);
        } else {
          if (typeof el.nome !== 'string' || !el.nome.trim()) E(`${q}: indica «tira», «modello» oppure «nome» e «testo» (trappola risolta a mano).`);
          if (!testoOk(el.testo)) E(`${q}: «testo» obbligatorio per una trappola personalizzata.`);
          if (el.liv != null && (!intero(el.liv) || el.liv < 1)) E(`${q}: «liv» deve essere un intero ≥ 1.`);
        }
      }
      if (el.tipo === 'caratteristica' || el.tipo === 'evento') {
        if (!el.tira && !testoOk(el.testo)) E(`${q}: indica «tira»: true oppure «testo».`);
      }
    });
    if (tipo === 'corridoio' && elementi.some(x => x?.tipo === 'mostri' && x.finale)) A(`${dove}: il boss finale in un corridoio.`);
  });
  if (ingressi === 0) E('Serve una stanza con «tipo»: "ingresso".');
  if (ingressi > 1) E('Può esserci una sola stanza di tipo «ingresso».');
  if ((m.fine ?? 'boss') === 'boss' && !bossFinale) A('Nessun «mostri» con «finale»: true: il boss finale non esiste e non si potrà concludere l\'avventura (usa «fine»: "libera" per un\'uscita libera).');
  if (bossFinale > 1) A('Più di un mostro con «finale»: true.');

  // porte
  const porte = Array.isArray(m.porte) ? m.porte : [];
  if (m.porte != null && !Array.isArray(m.porte)) E('«porte» deve essere un elenco.');
  const viste = new Set(), grafo = new Map([...ids.keys()].map(i => [i, []]));
  porte.forEach((p, n) => {
    const q = `Porta n. ${n + 1}`;
    if (!p || typeof p !== 'object') { E(`${q}: deve essere un oggetto.`); return; }
    const da = ids.get(p.da), a = ids.get(p.a);
    if (!da) { E(`${q}: «da» non è una stanza («${p.da}»).`); return; }
    if (!a) { E(`${q}: «a» non è una stanza («${p.a}»).`); return; }
    if (p.da === p.a) { E(`${q}: collega una stanza a se stessa.`); return; }
    if (!LATI[p.lato]) { E(`${q}: «lato» deve essere n, s, e oppure o (nord, sud, est, ovest).`); return; }
    if (!intero(p.x) || !intero(p.y)) { E(`${q}: «x» e «y» devono essere interi.`); return; }
    if (occupato.get(chiave(p.x, p.y)) !== p.da) { E(`${q}: il quadretto [${p.x}, ${p.y}] non appartiene alla stanza «${p.da}».`); return; }
    const [dx, dy] = LATI[p.lato];
    if (occupato.get(chiave(p.x + dx, p.y + dy)) !== p.a) { E(`${q}: oltre il lato «${p.lato}» del quadretto [${p.x}, ${p.y}] non c'è la stanza «${p.a}».`); return; }
    if (p.tipo != null && !['normale', 'segreta'].includes(p.tipo)) E(`${q}: «tipo» deve essere "normale" o "segreta".`);
    if (p.nota != null && !testoOk(p.nota)) E(`${q}: «nota» deve essere un testo.`);
    const k = [p.x, p.y, p.lato].join(',');
    if (viste.has(k)) { E(`${q}: c'è già una porta in quel punto.`); return; }
    viste.add(k);
    const k2 = [p.x + dx, p.y + dy, Object.keys(LATI).find(l => LATI[l][0] === -dx && LATI[l][1] === -dy)].join(',');
    if (viste.has(k2)) { E(`${q}: coincide con un'altra porta (la stessa apertura vista dall'altra stanza).`); return; }
    viste.add(k2);
    grafo.get(p.da).push([p.a, p.tipo === 'segreta']); grafo.get(p.a).push([p.da, p.tipo === 'segreta']);
  });
  if (!porte.length && stanze.length > 1) E('Mancano le «porte» che collegano le stanze.');
  const ing = stanze.find(s => s?.tipo === 'ingresso');
  if (ing && ids.has(ing.id)) {
    const raggiunte = (conSegrete) => { const v = new Set([ing.id]), pila = [ing.id]; while (pila.length) { for (const [b, seg] of grafo.get(pila.pop()) || []) if ((conSegrete || !seg) && !v.has(b)) { v.add(b); pila.push(b); } } return v; };
    const tutte = raggiunte(true), visibili = raggiunte(false);
    for (const id of ids.keys()) {
      if (!tutte.has(id)) E(`La stanza «${id}» non è raggiungibile dall'ingresso.`);
      else if (!visibili.has(id)) A(`La stanza «${id}» si raggiunge solo da porte segrete.`);
    }
  }
  return { errori, avvisi };
}

function validaMostri(el, q, set, E, A, cerca) {
  const quantita = el.quantita;
  if (quantita != null && !(intero(quantita) && quantita >= 1 && quantita <= 99) && !(typeof quantita === 'string' && reDadi.test(quantita))) E(`${q}: «quantita» deve essere un numero (1-99) o un tiro come "1d6+2".`);
  if (el.tabella != null || el.id != null) {   // voce delle tabelle del gioco
    if (typeof el.tabella !== 'string' || typeof el.id !== 'string') E(`${q}: per un mostro delle tabelle servono «tabella» e «id».`);
    else if (cerca) {
      const v = cerca(set, el.tabella, el.id);
      if (!v) E(`${q}: nelle tabelle «${set}» non c'è il mostro «${el.id}» (tabella «${el.tabella}»).`);
      else if (v.speciale === 'scheletri-o-zombi' || v.varianti || v.sottotabella) E(`${q}: «${el.id}» ha una scelta interna (varianti o sottotabella) che i moduli non gestiscono: usa un mostro personalizzato.`);
    }
    for (const k of ['liv', 'att', 'pv', 'nome']) if (el[k] != null && k !== 'nome') A(`${q}: «${k}» è ignorato per i mostri delle tabelle (usa un mostro personalizzato per cambiarlo).`);
    return;
  }
  // mostro personalizzato
  if (typeof el.nome !== 'string' || !el.nome.trim() || el.nome.length > 60) E(`${q}: «nome» del mostro obbligatorio (oppure «tabella» e «id»).`);
  if (!intero(el.liv) || el.liv < 1 || el.liv > 40) E(`${q}: «liv» (livello del mostro) obbligatorio, intero da 1 a 40.`);
  if (!intero(el.att) || el.att < 1 || el.att > 10) E(`${q}: «att» (numero di attacchi) obbligatorio, intero da 1 a 10.`);
  if (!intero(el.pv) || el.pv < 1 || el.pv > 200) E(`${q}: «pv» obbligatorio, intero da 1 a 200.`);
  if (el.mor != null && !(intero(el.mor) || el.mor === 'NO')) E(`${q}: «mor» (modificatore al morale) deve essere un intero oppure "NO" (non fa morale).`);
  if (el.tes != null && !(intero(el.tes) || el.tes === 'NO' || el.tes === 'x2')) E(`${q}: «tes» (tesoro) deve essere un intero (modificatore al tiro), "NO" oppure "x2".`);
  if (el.xp != null && typeof el.xp !== 'boolean') E(`${q}: «xp» deve essere true o false.`);
  if (el.maggiore != null && typeof el.maggiore !== 'boolean') E(`${q}: «maggiore» deve essere true o false.`);
  if (el.maggiore && quantita != null && quantita !== 1) E(`${q}: un mostro «maggiore» è sempre uno solo.`);
  if (el.finale && !el.maggiore) E(`${q}: il boss «finale» deve essere un mostro «maggiore»: true.`);
  if (el.tag != null && !(Array.isArray(el.tag) && el.tag.every(t => typeof t === 'string'))) E(`${q}: «tag» deve essere un elenco di testi (es. ["non-morto"]).`);
  if (el.note != null && !testoOk(el.note)) E(`${q}: «note» deve essere un testo.`);
  if (el.reazioni != null) {
    if (!Array.isArray(el.reazioni) || !el.reazioni.length) E(`${q}: «reazioni» deve essere un elenco come [[1, 2, "fugge"], [3, 6, "combatte"]].`);
    else {
      const copre = new Set();
      for (const r of el.reazioni) {
        if (!Array.isArray(r) || r.length < 3 || !intero(r[0]) || !intero(r[1]) || r[0] < 1 || r[1] > 6 || r[0] > r[1] || !REAZIONI.includes(r[2])) { E(`${q}: reazione non valida: ogni voce è [da, a, azione] con da ≤ a tra 1 e 6 e azione tra ${REAZIONI.join(', ')}.`); break; }
        for (let v = r[0]; v <= r[1]; v++) copre.add(v);
      }
      if (copre.size && copre.size < 6) A(`${q}: le reazioni non coprono tutti i risultati da 1 a 6.`);
    }
  }
  for (const [k, tipoP] of Object.entries(POTERI)) {
    if (el[k] == null) continue;
    const v = el[k];
    if (tipoP === 'bool' && typeof v !== 'boolean') E(`${q}: «${k}» deve essere true o false.`);
    if (tipoP === 'int' && !intero(v)) E(`${q}: «${k}» deve essere un intero.`);
    if (tipoP === 'array' && !(Array.isArray(v) && v.every(t => typeof t === 'string'))) E(`${q}: «${k}» deve essere un elenco di testi.`);
  }
  const noti = new Set(['tipo', 'nome', 'liv', 'att', 'pv', 'mor', 'tes', 'xp', 'maggiore', 'tag', 'note', 'reazioni', 'quantita', 'finale', 'id', 'tabella', ...Object.keys(POTERI)]);
  for (const k of Object.keys(el)) if (!noti.has(k)) A(`${q}: il campo «${k}» non è riconosciuto e viene ignorato.`);
}

function validaTesoro(el, q, E) {
  if (!el.tira && !el.fisso) E(`${q}: un «tesoro» ha «tira»: true (tiro sulla tabella dei tesori) e/o «fisso» (elenco di oggetti).`);
  if (el.mod != null && (!intero(el.mod) || el.mod < -5 || el.mod > 5)) E(`${q}: «mod» deve essere un intero tra -5 e 5.`);
  if (el.fisso == null) return;
  if (!Array.isArray(el.fisso) || !el.fisso.length) { E(`${q}: «fisso» deve essere un elenco di oggetti.`); return; }
  el.fisso.forEach((o, k) => {
    const w = `${q}, oggetto n. ${k + 1}`;
    if (!o || typeof o !== 'object' || !TIPI_OGGETTO.includes(o.tipo)) { E(`${w}: «tipo» deve essere uno tra ${TIPI_OGGETTO.join(', ')}.`); return; }
    if (['oro', 'gemma', 'gioiello'].includes(o.tipo)) { if (!intero(o.valore) || o.valore < 1) E(`${w}: «valore» (in pezzi d'oro) obbligatorio, intero ≥ 1.`); }
    else if (!testoOk(o.testo)) E(`${w}: «testo» obbligatorio.`);
    if (o.bonusArma != null && (!intero(o.bonusArma) || o.bonusArma < 1 || o.bonusArma > 5)) E(`${w}: «bonusArma» deve essere un intero da 1 a 5.`);
    if (o.bonusDifesa != null && (!intero(o.bonusDifesa) || o.bonusDifesa < 1 || o.bonusDifesa > 5)) E(`${w}: «bonusDifesa» deve essere un intero da 1 a 5.`);
    if (o.cariche != null && (!intero(o.cariche) || o.cariche < 1)) E(`${w}: «cariche» deve essere un intero ≥ 1.`);
    if (o.solo != null && !(Array.isArray(o.solo) && o.solo.every(t => typeof t === 'string'))) E(`${w}: «solo» deve essere un elenco di classi (es. ["mago"]).`);
  });
}

/** Voce di tesoro fissa del modulo → voce di bottino del gioco (stessa forma di quelle prodotte dai tiri). */
export function voceBottino(o) {
  const v = { tipo: o.tipo };
  if (o.tipo === 'oro') v.testo = `${o.valore} pezzi d’oro`;
  else if (o.tipo === 'gemma') v.testo = o.testo || `Gemma da ${o.valore} p.o.`;
  else if (o.tipo === 'gioiello') v.testo = o.testo || `Gioiello da ${o.valore} p.o.`;
  else v.testo = o.testo;
  if (o.valore != null) v.valore = o.valore;
  for (const k of ['nome', 'bonusArma', 'bonusDifesa', 'armaTipo', 'armaturaTipo', 'cariche', 'incantesimo', 'solo']) if (o[k] != null) v[k] = o[k];
  if (o.cariche != null) v.caricheMax = o.cariche;
  if (o.tipo === 'pergamena' && o.incantesimo == null) v.manuale = true;
  return v;
}

/** Voce di mostro del gioco (stessa forma delle tabelle) da un elemento «mostri» personalizzato. */
export function voceMostro(el) {
  const maggiore = !!el.maggiore;
  const v = {
    id: `mod-${String(el.nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    nome: el.nome, conta: '1', tag: [...(el.tag || [])], liv: el.liv, att: el.att, pv: el.pv,
    mor: el.mor ?? 0, tes: el.tes ?? (maggiore ? 1 : 'NO'), xp: el.xp !== false,
    note: el.note || '', reazioni: el.reazioni || [[1, 6, 'combatte']]
  };
  for (const k of Object.keys(POTERI)) if (el[k] != null) v[k] = el[k];
  return v;
}

// ---------------- geometria e disegno delle stanze ----------------
/** Scostamento da sommare alle coordinate del modulo perché il suo angolo in alto a sinistra cada nel quadretto (1, 1) del foglio. */
export function scostamento(m) {
  let x0 = Infinity, y0 = Infinity;
  for (const s of m.stanze) for (const [x, y] of celleDi(s)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); }
  return [1 - x0, 1 - y0];
}

/** Porte di una stanza (con il lato, in coordinate del modulo). `rivelate`: insieme di chiavi "da>a>x,y,lato" delle porte segrete scoperte. */
export const chiavePorta = p => `${p.da}>${p.a}>${p.x},${p.y},${p.lato}`;
export function porteDi(m, id) {
  const out = [];
  for (const p of m.porte || []) {
    if (p.da === id) out.push({ ...p, verso: p.a, x: p.x, y: p.y, lato: p.lato, k: chiavePorta(p) });
    else if (p.a === id) {
      const [dx, dy] = LATI[p.lato], opposto = Object.keys(LATI).find(l => LATI[l][0] === -dx && LATI[l][1] === -dy);
      out.push({ ...p, verso: p.da, x: p.x + dx, y: p.y + dy, lato: opposto, k: chiavePorta(p) });
    }
  }
  return out;
}

const PX = 128, PAD = 0.25;   // pixel per quadretto e margine intorno alla stanza (come le tessere vettoriali del gioco)
/**
 * Dati di una tessera per il foglio: immagine SVG vettoriale della stanza (pavimento, griglia, pareti, porte) e geometria
 * (`celle`, `porte`) nello stesso formato di data/rules/tiles.json, così funzionano uscite e posizionamento.
 */
export function costruisciTessera(m, s, [ox, oy], rivelate = new Set()) {
  const abs = celleDi(s);
  const x0 = Math.min(...abs.map(c => c[0])), y0 = Math.min(...abs.map(c => c[1]));
  const x1 = Math.max(...abs.map(c => c[0])), y1 = Math.max(...abs.map(c => c[1]));
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const celle = abs.map(([x, y]) => [x - x0, y - y0]);
  const set = new Set(celle.map(c => chiave(c[0], c[1])));
  const porte = porteDi(m, s.id).filter(p => p.tipo !== 'segreta' || rivelate.has(p.k));
  const gp = porte.map(p => {
    const i = p.x - x0, j = p.y - y0;
    return p.lato === 'n' ? ['h', i, j] : p.lato === 's' ? ['h', i, j + 1] : p.lato === 'o' ? ['v', i, j] : ['v', i + 1, j];
  });
  const f = n => +n.toFixed(3);
  let pav = '', griglia = '', pareti = '', porteSvg = '';
  for (const [i, j] of celle) {
    pav += `M${i} ${j}h1v1h-1z`;
    griglia += `M${i + 1} ${j}v1M${i} ${j + 1}h1`;
    if (!set.has(chiave(i, j - 1))) pareti += `M${i} ${j}h1`;
    if (!set.has(chiave(i, j + 1))) pareti += `M${i} ${j + 1}h1`;
    if (!set.has(chiave(i - 1, j))) pareti += `M${i} ${j}v1`;
    if (!set.has(chiave(i + 1, j))) pareti += `M${i + 1} ${j}v1`;
  }
  for (const [o, i, j] of gp) {
    porteSvg += o === 'h'
      ? `<rect x="${f(i + 0.14)}" y="${f(j - 0.1)}" width="0.72" height="0.2" rx=".04" fill="#9a6532" stroke="#2c1a0b" stroke-width=".04"/>`
      : `<rect x="${f(i - 0.1)}" y="${f(j + 0.14)}" width="0.2" height="0.72" rx=".04" fill="#9a6532" stroke="#2c1a0b" stroke-width=".04"/>`;
  }
  const w = (bw + 2 * PAD) * PX, h = (bh + 2 * PAD) * PX;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${-PAD} ${-PAD} ${bw + 2 * PAD} ${bh + 2 * PAD}">`
    + `<path d="${pav}" fill="#d9d2c0"/><path d="${griglia}" fill="none" stroke="#9c9482" stroke-width=".02" stroke-linecap="round"/>`
    + `<path d="${pareti}" fill="none" stroke="#1c1a1f" stroke-width=".1" stroke-linecap="round" stroke-linejoin="round"/>${porteSvg}</svg>`;
  return {
    w, h, cx: PX, cy: PX, ox: PX * PAD, oy: PX * PAD, svg: true,
    src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
    x: ox + x0 + bw / 2, z: oy + y0 + bh / 2,
    geom: { w, h, cx: PX, cy: PX, ox: PX * PAD, oy: PX * PAD, svg: true, celle, porte: gp }
  };
}
