// Effetti con scelta del giocatore: trappole, fantasmi e simili. Ogni effetto apre una finestra con le azioni possibili.
import { S, log, modificato, ordineMarcia, eroiVivi } from './state.js';
import { dado } from './dice.js';
import { modDifesa, suppl, tratto, bonusSalvezza, comeFurfante } from './rules.js';
import * as T from './tratti.js';
import { toast, scelta } from './util.js';
import * as C from './combat.js';
import * as K from './caos.js';
import * as G from './game.js';
import * as A from './abisso.js';
import * as P from './profondita.js';
import * as Q from './acque.js';

const adv = () => S.adv;
const viviOra = () => ordineMarcia().filter(e => e.stato === 'ok');
const nomeCl = e => (e.classe || '').replace('-', ' ');
/** Tratto «Abilità meccanica»: +1 per disattivare o evitare trappole. */
const meccanica = e => (suppl() && tratto(e, 'abilita-meccanica') ? 1 : 0);

/** Eroi in grado di disarmare/scassinare: furfante (con livello) e arlecchino (senza livello). */
export const scassinatori = () => viviOra().filter(e => ['furfante', 'arlecchino'].includes(e.classe));

/** Tenta di disarmare una trappola con un eroe. Restituisce true se riesce. */
export async function disarma(t, e) {
  const r = await C.dE(e, `Disarmare la trappola (${e.nome})`);
  const tot = r.totale + (e.classe === 'furfante' ? e.livello : 0) + meccanica(e);
  const ok = C.esplode(e, r) || (r.naturale !== 1 && tot > t.liv);
  log(`${e.nome} ${ok ? 'disinnesca' : 'non riesce a disinnescare'} la trappola (${tot} contro L${t.liv}).`);
  return ok;
}

/** Finestra di scelta quando scatta una trappola. */
export async function proponiTrappola(t) {
  const opz = scassinatori().map(e => ['d:' + e.id, `${e.nome} (${nomeCl(e)}) prova a disarmarla`, e.classe === 'furfante' ? `Tiro 1d6+${e.livello} contro L${t.liv}` : `Tiro 1d6 contro L${t.liv} (l’arlecchino non aggiunge il livello)`]);
  opz.push(['scatta', 'Lascia che la trappola scatti', 'Si risolvono automaticamente i tiri di difesa e salvezza previsti']);
  opz.push(['ignora', 'Risolvo io a mano', 'La trappola viene chiusa senza effetti automatici']);
  const k = await scelta(`Trappola: ${t.nome} (L${t.liv})`, t.testo, opz);
  if (k === null) return;                                   // finestra chiusa: la carta resta negli Strumenti
  if (k === 'ignora') { adv().trappolaAttiva = null; modificato(); return; }
  if (k.startsWith('d:')) {
    const e = viviOra().find(x => x.id === k.slice(2)); if (!e) return;
    if (await disarma(t, e)) { toast(`${e.nome} disinnesca la trappola.`); adv().trappolaAttiva = null; modificato(); return; }
    toast('Fallito: la trappola scatta.', 'warn');
  }
  await risolviTrappola(t);
}


// ---------------- azioni specifiche di classe (Strumenti) ----------------
/** Azioni di classe: ogni voce dice quali classi la sanno eseguire (il pulsante resta spento se nel gruppo non c'è nessuna). */
export const AZIONI_CLASSE = [
  { id: 'disarma', nome: 'Disattiva trappola', classi: ['furfante', 'arlecchino'], info: 'Furfante: 1d6+livello; arlecchino: 1d6 senza livello. Serve una trappola attiva.' },
  { id: 'scassina', nome: 'Scassina serratura', classi: ['furfante', 'arlecchino'], info: 'Tiro 1d6 (+livello solo il furfante) contro la difficoltà scelta.' },
  { id: 'travestimento', nome: 'Travestimento / furtività', classi: ['arlecchino'], info: 'L’arlecchino aggiunge il livello ai tiri di travestimento e furtività.' },
  { id: 'fiuta', nome: 'Fiuta il tesoro', classi: ['nano'], info: '1d6+livello >= 6: il nano vede il tesoro prima di attaccare.' }
];
export const eroiPerAzione = az => viviOra().filter(e => az.classi.includes(e.classe));
async function sceglieEroe(titolo, lista) {
  if (lista.length === 1) return lista[0];
  const k = await scelta(titolo, 'Chi lo fa?', lista.map(e => [e.id, `${e.nome} (${nomeCl(e)} ${e.livello})`]));
  return lista.find(e => e.id === k) || null;
}
export async function eseguiAzioneClasse(id) {
  const az = AZIONI_CLASSE.find(a => a.id === id); if (!az) return;
  const lista = eroiPerAzione(az);
  if (!lista.length) { toast(`Serve ${az.classi.join(' o ')} nel gruppo.`, 'warn'); return; }
  const e = await sceglieEroe(az.nome, lista); if (!e) return;
  if (id === 'disarma') {
    const t = adv().trappolaAttiva; if (!t) { toast('Nessuna trappola attiva da disattivare.', 'warn'); return; }
    if (await disarma(t, e)) { toast(`${e.nome} disinnesca la trappola.`); adv().trappolaAttiva = null; modificato(); } else { toast('Fallito: la trappola scatta.', 'warn'); await risolviTrappola(t); }
    return;
  }
  if (id === 'fiuta') {
    const r = await dado(`Fiuta il tesoro (${e.nome})`); const tot = r.totale + e.livello;
    log(`${e.nome} fiuta il tesoro: ${tot} → ${tot >= 6 ? 'riesce a vederlo prima di attaccare' : 'niente da fare'}.`); toast(tot >= 6 ? 'Il nano fiuta il tesoro: lo vedi prima di attaccare.' : 'Il nano non fiuta nulla.'); modificato(); return;
  }
  const L = await scelta(az.nome, 'Difficoltà (L) della prova:', [2, 3, 4, 5, 6, 7, 8].map(n => [n, `L${n}`]));
  if (L === null) return;
  const r = await C.dE(e, `${az.nome} – ${e.nome} (L${L})`);
  const tot = r.totale + ((id === 'scassina' && e.classe === 'furfante') || id === 'travestimento' ? e.livello : 0) + (id === 'scassina' && suppl() && e.perm?.serrature ? 1 : 0);   // padronanza delle serrature: +1
  const ok = C.esplode(e, r) || (r.naturale !== 1 && tot >= L);
  if (ok && id === 'scassina') T.evento(e, 'serrature');
  log(`${az.nome}: ${e.nome} tira ${tot} contro L${L} → ${ok ? 'riesce' : 'fallisce'}.`); toast(`${e.nome} ${ok ? 'riesce' : 'fallisce'} (${tot} contro L${L}).`, ok ? '' : 'warn'); modificato();
}

/** Fantasma (evento o guardiano di un tesoro): il giocatore sceglie come reagire. */
export async function proponiFantasma({ liv = 4, scacciabile = false, motivo = 'Un fantasma attraversa il gruppo' } = {}) {
  const chierici = viviOra().filter(e => e.classe === 'chierico');
  const opz = [];
  if (scacciabile) chierici.forEach(e => opz.push(['s:' + e.id, `${e.nome} (chierico) tenta di scacciarlo`, `1d6+livello contro LIV ${liv}`]));
  opz.push(['paura', 'Tutti affrontano la paura', `Tiro salvezza di ciascuno contro L${liv} (chierici +livello): chi fallisce perde 1 PV`]);
  opz.push(['ignora', 'Risolvo io a mano', 'Nessun effetto automatico']);
  const k = await scelta('Fantasma', motivo + '.', opz);
  if (k === null || k === 'ignora') return;
  if (k.startsWith('s:')) {
    const e = viviOra().find(x => x.id === k.slice(2)); if (!e) return;
    const r = await C.dE(e, `Scacciare il fantasma (${e.nome})`);
    if (r.totale + e.livello >= liv) { log(`${e.nome} scaccia il fantasma (${r.totale + e.livello} contro LIV ${liv}).`); toast('Il fantasma è scacciato.'); modificato(); return; }
    log(`${e.nome} non riesce a scacciare il fantasma.`);
  }
  for (const e of viviOra()) if (!(await C.salva(e, liv, e.classe === 'chierico' ? e.livello : 0, 'Paura del fantasma'))) C.perdiPV(e, 1, 'fantasma');
  modificato();
}

/** Trappola che protegge un tesoro nascosto: livello pari al tiro; la scelta è del giocatore. */
export async function proponiTrappolaTesoro(liv) {
  const t = { nome: 'Trappola del tesoro', liv, testo: `L'oro è protetto da una trappola di livello ${liv}: attacca un avventuriero a caso (1 PV se fallisce il tiro salvezza, 2 PV con un 1 sul dado).`, tesoro: true };
  const opz = scassinatori().map(e => ['d:' + e.id, `${e.nome} (${nomeCl(e)}) prova a disattivarla`]);
  opz.push(['scatta', 'Lascia che attacchi un avventuriero a caso']); opz.push(['ignora', 'Risolvo io a mano']);
  const k = await scelta('Trappola del tesoro', t.testo, opz);
  if (k === null || k === 'ignora') return;
  if (k.startsWith('d:')) { const e = viviOra().find(x => x.id === k.slice(2)); if (e && await disarma(t, e)) { toast('Trappola disattivata.'); return; } }
  const e = viviOra()[Math.floor(Math.random() * viviOra().length)]; if (!e) return;
  const r = await C.dE(e, `Trappola del tesoro: tiro salvezza di ${e.nome} (L${liv})`);
  if (r.naturale === 1) C.perdiPV(e, 2, 'trappola del tesoro'); else if (r.totale < liv) C.perdiPV(e, 1, 'trappola del tesoro'); else log(`${e.nome} evita la trappola.`);
  modificato();
}

export async function risolviTrappola(t) {
  if (t.abisso) return A.risolviTrappola(t);   // trappole di «Contro l'Abisso»
  if (t.acque) return Q.risolviTrappola(t);       // trappole acquatiche
  if (t.prof) return P.risolviTrappola(t);       // trappole delle Profondità Dimenticate (LMP+GR+2)
  const vivi = viviOra(); if (!vivi.length) return;
  const casuale = () => vivi[Math.floor(Math.random() * vivi.length)];
  const n = t.nome;
  const prova = async (e, { salvezza, extra = 0, ctx = {} }) => {
    const r = await C.dE(e, `${n}: ${salvezza ? 'tiro salvezza' : 'difesa'} di ${e.nome}`);
    let mod = extra;
    if (salvezza) { mod += e.armatura === 'leggera' && n === 'Botola' ? -1 : e.armatura === 'pesante' && n === 'Botola' ? -2 : 0; if (['elfo', 'mezzuomo'].includes(e.classe) && ['Botola', 'Tagliola'].includes(n)) mod += 1; if (comeFurfante(e)) mod += e.livello; if (e.zoppo) mod -= 2; mod += bonusSalvezza(e, n).tot; }
    else mod += modDifesa(e, ctx).tot;
    mod += meccanica(e);
    const tot = r.totale + mod;
    const ok = salvezza ? (r.naturale !== 1 && tot >= t.liv) : (C.esplode(e, r) || (r.naturale !== 1 && tot > t.liv));
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
    case 'Gas lacrimogeno': for (const e of vivi) if (!(await C.salva(e, 5, (['barbaro', 'nano'].includes(e.classe) ? e.livello : 0) + meccanica(e), 'Gas lacrimogeno'))) { ferisci(e, 1); log(`${e.nome} ha la vista sfocata per 2 incontri (niente armi a distanza né pergamene).`); } break;
    case 'Globo del caos': {
      const giri = [vivi, [...vivi].reverse()]; let fermo = false;
      for (const giro of giri) { for (const e of giro) {
        if (fermo || e.stato !== 'ok') continue;
        let come = 'schiva';
        if (e.scudo) come = await scelta('Globo del caos', `${e.nome}: schivi o pari con lo scudo?`, [['schiva', 'Schiva'], ['para', 'Para con lo scudo']]) || 'schiva';
        if (come === 'schiva') {
          if (await C.salva(e, 7, (e.classe === 'furfante' ? e.livello : ['elfo', 'mezzuomo'].includes(e.classe) ? Math.floor(e.livello / 2) : 0) + meccanica(e), 'Schivata del globo')) continue;
        } else {
          const r = await C.dE(e, `Parata del globo – ${e.nome} (L8)`);
          const tot = r.totale + modDifesa(e, {}).tot + (['barbaro', 'guerriero', 'nano'].includes(e.classe) ? e.livello : 0);
          if (C.esplode(e, r) || (r.naturale !== 1 && tot > 8)) { e.scudo = false; log(`${e.nome} para il globo: lo scudo è distrutto e il globo si ferma.`); fermo = true; continue; }
        }
        ferisci(e, 3);
      } }
      break;
    }
    case 'Tagliola': { const e = vivi[0]; if (!(await prova(e, { salvezza: true }))) { ferisci(e, 1); if (e.stato === 'ok') { e.zoppo = true; log(`${e.nome} zoppica (-1 attacco e difesa).`); } } break; }
  }
  adv().trappolaAttiva = null; modificato();
}

