// Avventure scritte («moduli»): collegamento fra il formato del file (modulo.js) e il gioco.
// Il modulo descrive stanze, porte e contenuto; le regole (combattimento, tesori, trappole, erranti, riposo) restano quelle del gioco.
import { R, S, log, modificato, eroiVivi } from './state.js';
import { tira } from './dice.js';
import { creaIncontro, inAbisso, inProfondita, SETS } from './rules.js';
import * as G from './game.js';
import * as Eff from './effetti.js';
import * as A from './abisso.js';
import * as P from './profondita.js';
import * as AL from './aldila.js';
import * as table from './map2d.js';
import * as M from './modulo.js';
import { h, modal, toast, scelta, uid } from './util.js';

const adv = () => S.adv;
export const attivo = () => !!S.adv?.modulo;
const def = () => S.adv.modulo.def;
const stanzaDef = id => def().stanze.find(s => s.id === id);
const FILE_SET = { diabolici: 'avanzate', caos: 'caos', abisso: 'abisso', aldila: 'aldila', profondita: 'profondita', acque: 'acque', coboldi: 'coboldi' };

/** Voce di mostro nelle tabelle del gioco (quelle del set scelto dal modulo e, in coda, quelle del manuale base). */
export function cercaVoce(set, tabella, id) {
  const propri = FILE_SET[set] ? R[FILE_SET[set]]?.mostri?.[tabella] : null;
  return [propri, R.mostri?.[tabella]].map(l => (Array.isArray(l) ? l.find(m => m.id === id) : null)).find(Boolean) || null;
}

/** Legge il testo di un file di avventura: restituisce { def, errori, avvisi } (def è nullo se il JSON non si può leggere). */
export function leggiModulo(testo) {
  let def;
  try { def = JSON.parse(testo); } catch (e) { return { def: null, errori: [`Il file non è un JSON valido (${e.message}).`], avvisi: [] }; }
  const { errori, avvisi } = M.valida(def, { cerca: cercaVoce });
  return { def: errori.length ? null : def, errori, avvisi };
}

// ---------------- avvio ----------------
/** Finestra di presentazione del modulo: dati, livello consigliato e confronto con il gruppo. Inizia l'avventura se si conferma. */
export function presenta(def, avvisi = []) {
  const vivi = eroiVivi().filter(e => !e.merc), lv = vivi.map(e => e.livello);
  const l = def.livello, fuori = l && lv.length && (Math.max(...lv) < l.min || Math.min(...lv) > l.max);
  const nEroi = def.eroi && vivi.length && (vivi.length < def.eroi.min || vivi.length > def.eroi.max);
  modal(def.nome, (b, close) => {
    b.append(...[
      h('p', { class: 'hint' }, [def.autore ? `di ${def.autore}` : null, def.licenza ? `licenza: ${def.licenza}` : null].filter(Boolean).join(' · ')),
      def.descrizione ? h('p', {}, def.descrizione) : null,
      h('div', { class: 'stats' },
        h('div', {}, h('b', {}, l ? (l.min === l.max ? l.min : `${l.min}-${l.max}`) : '?'), h('small', {}, 'livello')),
        h('div', {}, h('b', {}, def.eroi ? (def.eroi.min === def.eroi.max ? def.eroi.min : `${def.eroi.min}-${def.eroi.max}`) : '?'), h('small', {}, 'eroi')),
        h('div', {}, h('b', {}, def.stanze.filter(s => s.tipo !== 'corridoio').length), h('small', {}, 'stanze'))),
      h('p', { class: 'hint' }, `Tabelle: ${SETS[def.set || 'base']}.`),
      fuori ? h('p', { class: 'warn-box' }, `Il gruppo ha livello ${Math.min(...lv) === Math.max(...lv) ? Math.min(...lv) : `${Math.min(...lv)}-${Math.max(...lv)}`}, ma l'avventura è pensata per il livello ${l.min === l.max ? l.min : `${l.min}-${l.max}`}. Si può giocare lo stesso, ma sarà troppo facile o troppo difficile.`) : null,
      nEroi ? h('p', { class: 'warn-box' }, `L'avventura è pensata per ${def.eroi.min === def.eroi.max ? def.eroi.min : `${def.eroi.min}-${def.eroi.max}`} eroi; il gruppo ne ha ${vivi.length}.`) : null,
      avvisi.length ? h('details', {}, h('summary', {}, `${avvisi.length} avviso/i del controllo`), h('ul', {}, avvisi.map(a => h('li', {}, a)))) : null,
      def.obiettivo ? h('p', {}, h('b', {}, 'Obiettivo: '), def.obiettivo) : null,
      h('div', { class: 'row end' },
        h('button', { onclick: close }, 'Annulla'),
        h('button', { class: 'primary', onclick: async () => { close(); if (await G.iniziaAvventura(def)) table.setView('fit'); } }, 'Inizia l’avventura'))].filter(Boolean));   // append(null) scriverebbe «null»
  }, { wide: true });
}

/** Riquadro «Avventura scritta» del pannello Dungeon: moduli inclusi nel programma oppure un file scelto dal dispositivo. */
export function riquadroAvvio() {
  const box = h('div', { class: 'card' },
    h('h4', {}, 'Avventura scritta'),
    h('p', { class: 'hint' }, 'Un dungeon già disegnato, con stanze, mostri e tesori decisi dall’autore. Scegli una campagna, poi l’avventura e il gruppo. Le regole restano quelle del gioco. Formato descritto in docs/MODULI.md.'));
  const apriC = h('button', { class: 'primary', onclick: () => import('./campagne-narrative.js').then(m => m.apri()).catch(e => toast('Non riesco ad aprire le campagne: ' + (e.message || e), 'warn')) }, 'Campagne narrative…');
  const apri = async testo => {
    const r = leggiModulo(testo);
    if (!r.def) { modal('Avventura non valida', (b, close) => { b.append(...[h('p', { class: 'warn-box' }, 'Il file non si può usare:'), h('ul', {}, r.errori.slice(0, 15).map(e => h('li', {}, e))), r.errori.length > 15 ? h('small', {}, `…e altri ${r.errori.length - 15} errori.`) : null, h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: close }, 'Chiudi'))].filter(Boolean)); }, { wide: true }); return; }
    presenta(r.def, r.avvisi);
  };
  const carica = h('button', { onclick: () => {
    const inp = h('input', { type: 'file', accept: '.json,application/json', onchange: async () => { if (inp.files[0]) await apri(await inp.files[0].text()); } });
    inp.click();
  } }, 'Carica da file…');
  box.append(h('div', { class: 'row wrap' }, apriC, carica));
  return box;
}

/** Crea la tessera di una stanza del modulo (stessa forma delle tessere del gioco, con in più `geom` e `stanzaModulo`). */
function creaTessera(s, ingresso = false) {
  const st = adv().modulo, g = M.costruisciTessera(st.def, s, st.off, new Set(st.rivelate));
  return {
    id: uid(), tipo: ingresso ? 'ingresso' : 'stanza', n: s.id, src: g.src, svg: true, geom: g.geom,
    w: g.w, h: g.h, cx: g.cx, cy: g.cy, ox: g.ox, oy: g.oy, x: g.x, z: g.z,
    rot: 0, flip: false, scale: 1, pending: false, nome: s.nome, corridoio: s.tipo === 'corridoio', contenuto: null, perquisita: false,
    stanzaModulo: s.id
  };
}

/** Prepara lo stato dell'avventura scritta e restituisce la tessera d'ingresso (già inserita nell'avventura). */
export function avviaModulo(def) {
  adv().modulo = { def, off: M.scostamento(def), visitate: [], rivelate: [] };
  const s = def.stanze.find(x => x.tipo === 'ingresso'), t = creaTessera(s, true);
  t.contenuto = { testo: s.testo || 'Stanza d’ingresso.', vuota: true, ingresso: true };
  adv().modulo.visitate.push(s.id);
  adv().tessere.push(t); adv().stanzaCorrente = t.id;
  S.party.eroi.forEach(e => { e.posizione = t.id; });
  return t;
}

// ---------------- introduzione, obiettivo e finali ----------------
const scelte = () => (S.party.scelteModuli = S.party.scelteModuli || {});
const par = t => String(t || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
/** Testi dell'introduzione: quella del modulo più le varianti dovute ai finali scelti nei capitoli precedenti della serie. */
export function testiIntroduzione(def) {
  const out = par(def.introduzione), sid = def.serie?.id;
  if (sid && def.introduzioneSe) for (const [k, v] of Object.entries(def.introduzioneSe)) { const [cap, fin] = k.split(':'); if (scelte()[`${sid}:${cap}`] === fin) out.push(...par(v)); }
  return out;
}
/** Finestra di apertura: introduzione epica e obiettivo. Si chiude con «Entra nel dungeon» (o con la X). Scrive il testo anche nel registro. */
export function introduzione(def, riletta = false) {
  const testi = testiIntroduzione(def);
  if (!riletta) { testi.forEach(t => log(t)); if (def.obiettivo) log(`Obiettivo: ${def.obiettivo}`); }
  if (!testi.length && !def.obiettivo) return Promise.resolve();
  return new Promise(res => modal(def.nome, (b, close) => {
    b.append(...[
      def.serie ? h('p', { class: 'hint' }, `Capitolo ${def.serie.numero} di ${def.serie.di}`) : null,
      ...testi.map(t => h('p', { class: 'intro-epica' }, t)),
      def.obiettivo ? h('div', { class: 'card' }, h('h4', {}, 'Obiettivo'), h('p', {}, def.obiettivo)) : null,
      h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: close }, riletta ? 'Chiudi' : 'Entra nel dungeon'))].filter(Boolean));
  }, { wide: true, onClose: () => res() }));
}
/** Finali a scelta: alla conclusione con successo il giocatore sceglie come finisce; la scelta resta nella campagna. */
export async function scegliFinale(def) {
  if (!def.finali?.length) return null;
  let k = null;
  while (!k) k = await scelta('Come finisce?', def.conclusione || 'L’avventura è conclusa: scegli il finale.', def.finali.map(f => [f.id, f.nome, f.scelta || '']));   // chiudere la finestra non basta: il finale va scelto
  const f = def.finali.find(x => x.id === k);
  if (def.serie) scelte()[`${def.serie.id}:${def.serie.numero}`] = f.id;
  log(`Finale — ${f.nome}: ${f.testo}`);
  await new Promise(res => modal(f.nome, (b, close) => { b.append(...par(f.testo).map(t => h('p', { class: 'intro-epica' }, t)), h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: close }, 'Fine'))); }, { wide: true, onClose: () => res() }));
  modificato('party');
  return f;
}

// ---------------- esplorazione ----------------
const NOMI_LATO = { n: 'nord', s: 'sud', e: 'est', o: 'ovest' };
const tessDi = id => adv().tessere.find(t => t.stanzaModulo === id);
/** Porte della stanza in cui si trova il gruppo: quelle normali e le segrete già scoperte. */
export function uscite() {
  const cur = G.tileById(adv().stanzaCorrente); if (!cur?.stanzaModulo) return [];
  const st = adv().modulo;
  return M.porteDi(st.def, cur.stanzaModulo).filter(p => p.tipo !== 'segreta' || st.rivelate.includes(p.k)).map(p => ({ ...p, visitata: st.visitate.includes(p.verso), nomeVerso: stanzaDef(p.verso).nome }));
}

/** Passa per una porta: entra in una stanza nuova (con il suo contenuto) o torna in una già visitata (con i tiri di spostamento). */
export async function attraversa(porta) {
  const a = adv(), st = a.modulo;
  if (a.incontro && a.incontro.stato !== 'finito') { toast('C’è uno scontro in corso: concludilo prima di muoverti.', 'warn'); return; }
  const da = G.tileById(a.stanzaCorrente);
  if (st.visitate.includes(porta.verso)) {
    const dest = tessDi(porta.verso);
    G.muoviGruppo(da.id, dest.id); a.stanzaCorrente = dest.id; table.selectTile(null); modificato();   // prima ci si sposta, poi si tirano i dadi (come con il doppio clic sulla mappa)
    await G.spostamento(da.id, dest.id);
    return;
  }
  const s = stanzaDef(porta.verso), t = creaTessera(s);
  t.pending = true; t.descrizione = s.testo || '';
  st.visitate.push(s.id);
  a.tessere.push(t);
  if (porta.nota) log(`Porta: ${porta.nota}`);
  await G.confermaStanza(t, t.corridoio, () => eseguiContenuto(t, s));
  table.ensureVisible(t);
}

/** Porta segreta trovata perquisendo: mostra una porta nascosta della stanza attuale (se ce n'è più d'una, si sceglie). */
export async function portaSegreta() {
  const cur = G.tileById(adv().stanzaCorrente), st = adv().modulo;
  const nascoste = M.porteDi(st.def, cur.stanzaModulo).filter(p => p.tipo === 'segreta' && !st.rivelate.includes(p.k));
  if (!nascoste.length) { toast('Nessuna porta segreta in questa stanza: l’autore non ne ha previste.', 'warn'); log('Porta segreta: in questa stanza non ce ne sono.'); return false; }
  let p = nascoste[0];
  if (nascoste.length > 1) { const k = await scelta('Porta segreta', 'Quale porta nascosta si trova?', nascoste.map((x, i) => [i, `Verso ${NOMI_LATO[x.lato]}: ${stanzaDef(x.verso).nome}`])); p = nascoste[k ?? 0]; }
  st.rivelate.push(p.k);
  for (const id of [cur.stanzaModulo, p.verso]) {   // ridisegna le stanze già visitate con la porta nuova
    const t = tessDi(id); if (!t) continue;
    const g = M.costruisciTessera(st.def, stanzaDef(id), st.off, new Set(st.rivelate)); t.src = g.src; t.geom = g.geom;
    table.removeTile(t.id); table.upsertTile(t);
  }
  log(`Porta segreta trovata (${NOMI_LATO[p.lato]}) verso «${stanzaDef(p.verso).nome}».${p.nota ? ' ' + p.nota : ''}`);
  toast(`Porta segreta verso ${NOMI_LATO[p.lato]}: ${stanzaDef(p.verso).nome}.`);
  modificato(); return true;
}

// ---------------- contenuto delle stanze ----------------
async function quantitaDi(q, etichetta) {
  if (q == null) return null;
  return typeof q === 'number' ? q : (await tira(q, etichetta)).totale;
}

/** Crea lo scontro per un elemento «mostri»: voce delle tabelle del gioco oppure mostro personalizzato. */
async function creaMostri(el) {
  const finale = !!el.finale;
  let voce, tab, n;
  if (el.tabella) {
    voce = { ...cercaVoce(adv().set, el.tabella, el.id) }; tab = el.tabella;
    if (String(voce.id).startsWith('o-')) voce = await AL.risolviVoce(voce);   // Aldilà: livello, PV e attacchi a dado
    n = await quantitaDi(el.quantita, `Numero ${voce.nome}`);
    if (n == null) n = voce.conta && /^\d*d\d+([+-]\d+)?$/i.test(voce.conta) ? (await tira(voce.conta, `Numero ${voce.nome}`)).totale : 1;
  } else {
    voce = M.voceMostro(el); tab = el.maggiore ? 'boss' : 'infestanti';
    n = (await quantitaDi(el.quantita, `Numero ${el.nome}`)) ?? 1;
  }
  const inc = creaIncontro(tab, voce, n, { bossFinale: finale });
  if (el.tabella) {   // gli stessi ritocchi che applica il gioco ai mostri estratti dalle tabelle dei supplementi
    if (inAbisso()) await A.postCrea(inc, voce);
    if (inProfondita()) await P.postCrea(inc, voce);
    if (inc.al) await AL.postCrea(inc, voce, {});
  }
  return inc;
}

/** Esegue gli elementi del contenuto di una stanza, in ordine, e ne scrive il riassunto. */
async function eseguiContenuto(t, s) {
  const els = M.elementiDi(s), parti = [];
  let vuota = els.length === 0 || els.some(e => e.tipo === 'vuota');
  if (s.testo) {   // descrizione da leggere: si mostra prima di tirare qualunque dado
    log(`«${s.nome}»: ${s.testo}`);
    await scelta(s.nome, s.testo, [['ok', 'Prosegui']]);
  }
  for (const el of els) {
    switch (el.tipo) {
      case 'testo': parti.push(el.testo); log(el.testo); break;
      case 'mostri': {
        const inc = await creaMostri(el);
        G.avviaIncontro(inc, t); vuota = false;
        parti.push(`${inc.nome}${inc.minore ? ` ×${inc.n}` : ''}${inc.bossFinale ? ' (BOSS FINALE)' : ''}`);
        break;
      }
      case 'tesoro': {
        if (el.fisso) {
          const voci = el.fisso.map(o => ({ id: uid(), ...M.voceBottino(o) }));
          adv().bottino = [...(adv().bottino || []), ...voci];
          const x = `Tesoro: ${voci.map(v => v.testo).join('; ')}`; parti.push(x); log(x); modificato();
        }
        if (el.tira) parti.push(await G.tesoro(el.mod || 0));
        break;
      }
      case 'trappola': {
        if (el.tira) { parti.push(await G.trappola()); break; }
        const base = el.modello ? (R.tabelle.trappole.find(r => r.nome === el.modello) || {}) : {};
        const tr = { nome: el.modello || el.nome, liv: el.liv || 0, testo: el.testo || base.testo || '', caos: false, abisso: false, prof: false, acque: false, riga: null, manuale: !el.modello };
        const x = `Trappola – ${tr.nome}${tr.liv ? ` (L${tr.liv})` : ''}: ${tr.testo}`;
        adv().trappolaAttiva = tr; parti.push(x); log(x); modificato();
        document.dispatchEvent(new CustomEvent('apri-tab', { detail: 'strumenti' }));
        if (el.modello) await Eff.proponiTrappola(tr); else await scelta(`Trappola: ${tr.nome}`, `${tr.testo} (si risolve a mano)`, [['ok', 'Ok']]);
        break;
      }
      case 'caratteristica': {
        if (el.tira) { parti.push(await G.caratteristica()); vuota = true; break; }
        const x = `${el.nome ? el.nome + ': ' : ''}${el.testo}`; parti.push(x); log(x); vuota = true; break;
      }
      case 'evento': {
        if (el.tira) { parti.push(await G.evento(t)); break; }
        const x = `${el.nome ? el.nome + ': ' : ''}${el.testo}`; parti.push(x); log(x); break;
      }
    }
  }
  t.contenuto = { testo: parti.join(' · ') || 'Stanza vuota (si può perquisire).', vuota };
  modificato();
}

// ---------------- pannello Dungeon ----------------
/** Scheda «Esplora» di un'avventura scritta: descrizione della stanza attuale e porte per proseguire. */
export function cartaEsplora() {
  const a = adv(), cur = G.tileById(a.stanzaCorrente), box = h('div', { class: 'card' }), btn = (txt, fn, cls = '') => h('button', { class: cls, onclick: async ev => { const b = ev.currentTarget; b.disabled = true; try { await fn(); } catch (e) { console.error(e); toast(String(e.message || e), 'warn'); } finally { b.disabled = false; } } }, txt);
  box.append(h('h3', {}, 'Esplora'));
  if (def().introduzione || def().obiettivo) box.append(h('div', { class: 'row' }, btn('Rileggi introduzione e obiettivo', () => introduzione(def(), true))));
  if (!cur?.stanzaModulo) { box.append(h('p', { class: 'hint' }, 'Seleziona una stanza dall’elenco della mappa esplorata.')); return box; }
  const s = stanzaDef(cur.stanzaModulo);
  box.append(...[h('p', {}, h('b', {}, s.nome)), s.testo ? h('p', { class: 'hint' }, s.testo) : null].filter(Boolean));
  const us = uscite();
  if (!us.length) box.append(h('p', { class: 'hint' }, 'Nessuna uscita visibile. Perquisire la stanza può rivelare una porta segreta.'));
  for (const u of us) {
    box.append(h('div', { class: 'row' },
      btn(u.visitata ? `Torna in «${u.nomeVerso}»` : `Apri la porta a ${NOMI_LATO[u.lato]}`, () => attraversa(u), u.visitata ? '' : 'primary big'),
      u.visitata ? null : h('small', { class: 'hint' }, 'stanza non ancora esplorata'),
      u.tipo === 'segreta' ? h('small', { class: 'hint' }, 'porta segreta') : null));
  }
  return box;
}
