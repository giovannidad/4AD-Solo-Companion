// Stato globale dell'app + salvataggio automatico su file (data/campagne/<id>/...)
import { api } from './api.js';
import { uid } from './util.js';

export const R = {};   // regole caricate da data/rules
export const S = { camp: null, party: null, adv: null };
const listeners = new Set();
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
let timers = {};

export const nuovaPartita = () => ({ eroi: [], ordine: [], oroComune: 0, note: '', creata: Date.now() });
export const nuovaAvventura = () => ({
  attiva: false, numero: 0, stanze: 0, tessere: [], stanzaCorrente: null, incontro: null,
  maggioriSconfitti: 0, incontriSeguaci: 0, ultimoLivello: null, indizi: [],
  guaritoreVisto: false, alchimistaVisto: false, fontanaUsata: false, dama: false, ricompense: [],
  fine: null, set: 'base', missione: null, eventiUsati: [],
  fiume: null, sezione: null, cittadella: null,   // Profondità: fiume in corso (con la barca), rovine/tumulo/idolo e Cittadella in corso
  silvani: null,   // Labirinti Silvani: ponti, pozzi, incendi, prigionieri, missioni, rifugio dei catturati (vedi silvani.js)
  aldila: null   // Orrori dall'Aldilà: spedizione a esagoni (giorno, terreno, razioni, obiettivo…), vedi aldila.js; non si azzera a ogni dungeon
});

export async function caricaRegole() {
  const nomi = ['classi', 'equipaggiamento', 'mostri', 'tabelle', 'tiles', 'tiles-classico', 'tiles-foresta', 'avanzate', 'caos', 'abisso', 'aldila', 'profondita', 'acque', 'coboldi', 'silvani', 'tratti', 'traguardi'];
  const dati = await Promise.all(nomi.map(n => api.regola(n)));
  nomi.forEach((n, i) => { R[n] = dati[i]; });
  R.tilesSet = { classico: R['tiles-classico'], foresta: R['tiles-foresta'] };   // geometria delle tessere dei set tematici
}

export async function apriCampagna(id) {
  S.camp = id;
  S.party = (await api.leggi(id, 'party')) || nuovaPartita();
  S.adv = Object.assign(nuovaAvventura(), (await api.leggi(id, 'avventura')) || {});
  S.adv.tessere.forEach(t => { t.src = t.src.replace(/\.png$/, '.webp').replace(/^\/assets\//, 'assets/'); });   // salvataggi vecchi (.png; percorso assoluto -> relativo, per le sottocartelle)
  S.registro = (await api.leggi(id, 'registro')).split('\n').filter(Boolean);
  S.ritratti = (await api.leggi(id, 'ritratti').catch(() => null)) || {};
  localStorage.setItem('4ad-campagna', id);
  emit();
  document.dispatchEvent(new CustomEvent('campagna-aperta', { detail: id }));
}

export function emit() { listeners.forEach(f => f()); }

/** Salva (con piccolo ritardo) i file modificati. */
export function salva(...quali) {
  if (!S.camp || S.ospite) return;   // l'ospite di una partita cooperativa non salva nulla: lo stato è dell'ospitante
  const files = quali.length ? quali : ['party', 'avventura'];
  for (const f of files) {
    clearTimeout(timers[f]);
    timers[f] = setTimeout(() => api.scrivi(S.camp, f, S[{ avventura: 'adv', party: 'party', ritratti: 'ritratti' }[f] || 'party']).catch(e => console.error('salvataggio', e)), 250);
  }
}
export function modificato(...quali) { salva(...quali); emit(); }

export function log(testo) {
  const t = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const riga = `[${t}] ${testo}`;
  S.registro = S.registro || [];
  S.registro.push(riga);
  if (S.camp && !S.ospite) api.riga(S.camp, riga).catch(() => {});
  emit();
}

// ---- helper sul gruppo ----
export const eroiVivi = () => S.party.eroi.filter(e => e.stato !== 'morto' && e.stato !== 'pazzo');
/** Eroe che partecipa all'incontro in corso: negli scontri «da solo» (imboscate, «Molti nemici») combatte uno solo. */
export const inCampo = e => { const i = S.adv?.incontro; if (e.svanito) return false; return !(i && i.solo && i.stato !== 'finito' && (!i.soloTurni || i.turno <= i.soloTurni)) || i.solo === e.id; };
export const eroiAttivi = () => S.party.eroi.filter(e => e.stato === 'ok' && inCampo(e));
export const livelloMax = () => Math.max(1, ...S.party.eroi.filter(e => e.stato !== 'morto').map(e => e.livello));
export const eroePerId = id => S.party.eroi.find(e => e.id === id);
export const ordineMarcia = () => S.party.ordine.map(eroePerId).filter(Boolean);

export function nuovoEroe(classe, nome) {
  const c = R.classi[classe];
  const e = {
    id: uid(), nome, classe: c.base || classe, livello: 1, pvMax: c.vitaBase + 1, pv: c.vitaBase + 1, oro: 0,
    armi: [], armaPrincipale: null, armatura: 'nessuna', scudo: false, lanterna: false,
    oggetti: [], incantesimi: [], usi: { benedizione: 0, guarigione: 0, furie: 0, fortuna: 0 },
    indizi: 0, follia: 0, stato: 'ok', maledetto: false, zoppo: false, note: ''
  };
  if (c.base) e.culto = classe;   // chierici di Elidra e Korimnos: classe «chierico» con un culto (valgono tutte le regole del chierico)
  return e;
}
