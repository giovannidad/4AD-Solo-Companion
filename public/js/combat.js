// Incontri e combattimento: reazioni, attacchi, incantesimi, difese, morale, bottino.
import { R, S, log, modificato, eroiVivi, eroiAttivi, eroePerId, ordineMarcia, livelloMax } from './state.js';
import { dado, tira, d6Esplosivo, migliorDi } from './dice.js';
import { modAttacco, modDifesa, trovaReazione, gruppoHaLanterna, haNano, armaDi, armaPrincipale } from './rules.js';
import { tesoro, vittoria, terminaAvventura, monstroErrante, avviaIncontro } from './game.js';
import { toast, pick, scelta } from './util.js';
import * as K from './caos.js';
import * as T from './tratti.js';

export const inc = () => S.adv.incontro;
const livAtt = i => (i.livPrimoTurno && i.turno <= 1) ? i.livPrimoTurno : i.liv;
const livDif = (i, e) => (i.livPrimoTurno && i.turno <= 1) ? i.livPrimoTurno : (i.livDifesaFerito && e.pv < e.pvMax ? i.livDifesaFerito : i.liv);
const casuale = arr => arr[Math.floor(Math.random() * arr.length)];

export function nota(testo) {
  const i = inc();
  if (i) { i.cronaca = i.cronaca || []; i.cronaca.push(testo); }
  log(testo);
}
const finisci = (esito) => { const i = inc(); i.stato = 'finito'; i.esito = esito; modificato(); };

// ---------------- avvio e reazioni ----------------
export async function inizioScontro() {
  const i = inc(); if (i.inizioFatto) return; i.inizioFatto = true;
  i.stato = 'combattimento'; i.turno = 1; i.agito = {}; i.protetti = {}; i.difeso = {}; i.sparati = {};
  S.party.eroi.forEach(e => { if (e.classe === 'elfo-fuoco') (e.incantesimi || []).forEach(sp => { sp.usato = false; }); });   // la vista di fuoco si ricarica a ogni scontro
  if (i.id === 'catoblepa') await salvaTutti('Sguardo del catoblepa', 4, () => 0, e => perdiPV(e, 1, 'sguardo'));
  if (i.id === 'medusa') await salvaTutti('Sguardo della medusa', 4, e => (e.classe === 'furfante' ? Math.floor(e.livello / 2) : 0), e => { e.stato = 'pietra'; T.evento(e, 'trasformazione'); nota(`${e.nome} è trasformato in pietra!`); });
  if (i.id === 'signore-caos' || i.id === 'd-signore-caos') await poteriCaos();
  if (i.attDadi) {
    const x = await tira(i.attDadi, `Attacchi di ${i.nome}`); i.att = x.totale;
    if (i.id === 'c-avatar') { i.livBase = i.liv = x.totale >= 5 ? 5 : 6; nota(`${i.nome}: ${x.totale} attacchi di LIV ${i.liv}.`); }
    else nota(`${i.nome}: ${x.totale} attacchi per turno.`);
  }
  if (i.speciale === 'schiavisti' && !i.errante) {
    const lead = ordineMarcia().find(e => e.stato === 'ok');
    if (lead) {
      const b = (['elfo', 'mezzuomo'].includes(lead.classe) ? 1 : 0) + (lead.classe === 'furfante' ? lead.livello : 0);
      nota('Gli schiavisti hanno preparato una tagliola!');
      if (!(await salva(lead, 4, b, 'Tagliola degli schiavisti'))) { perdiPV(lead, 1, 'tagliola'); if (lead.stato === 'ok') { lead.zoppo = true; nota(`${lead.nome} zoppica.`); } }
    }
  }
  if (i.id === 'c-avatar') await salvaTutti('Avatar di Xichtul (prima visione)', 6, () => 0, e => nota(`${e.nome} lascia cadere 1 oggetto (anche un’arma o almeno 20 p.o.; senza oggetti perde 1 PV).`));
  modificato();
}

async function poteriCaos() {
  const r = await dado('Poteri del signore del caos (d6)');
  const i = inc(); const av = i.id === 'd-signore-caos';
  if (av) {
    if (r.totale <= 4) { i.potere = 'malocchio'; nota('Malocchio: tutti salvano (L4) o -1 a tutte le difese fino alla sua morte.'); await salvaTutti('Malocchio', 4, () => 0, e => { e.maledetto = true; }); }
    else if (r.totale === 5) { i.potere = 'risucchio'; nota('Risucchio di energia: ogni volta che un personaggio è ferito salva (L4) o perde 1 livello.'); }
    else { i.potere = 'raggio'; nota('Raggio di fuoco infernale minore: tutti salvano (L5, chierici +½L) o perdono 2 PV.'); await salvaTutti('Raggio infernale minore', 5, e => (e.classe === 'chierico' ? Math.floor(e.livello / 2) : 0), e => perdiPV(e, 2, 'raggio')); }
    return;
  }
  if (r.totale <= 3) { i.potere = 'nessuno'; nota('Signore del caos: nessun potere speciale.'); }
  else if (r.totale === 4) { i.potere = 'malocchio'; nota('Malocchio: tutti salvano (L4) o -1 a tutte le difese fino alla sua morte.'); await salvaTutti('Malocchio', 4, () => 0, e => { e.maledetto = true; }); }
  else if (r.totale === 5) { i.potere = 'risucchio'; nota('Risucchio di energia: ogni volta che un personaggio è ferito salva (L4) o perde 1 livello.'); }
  else { i.potere = 'raggio'; nota('Raggio di fuoco infernale: tutti salvano (L6, chierici +½L) o perdono 2 PV.'); await salvaTutti('Raggio infernale', 6, e => (e.classe === 'chierico' ? Math.floor(e.livello / 2) : 0), e => perdiPV(e, 2, 'raggio')); }
}

export function attaccaSubito() {
  const i = inc(); i.reazione = { azione: 'attacco-subito', testo: 'Attacchi per primo.' };
  i.mostriPrima = false; i.sorpresa = false; return inizioScontro();
}

export async function tiraReazione() {
  const i = inc();
  if (i.speciale === 'gremlin') return;
  const r = await dado(`Reazione di ${i.nome} (d6)`);
  let re = trovaReazione(i, r.totale);
  if (!re) { re = [1, 6, 'combatte']; }
  let azione = re[2];
  if (i.id === 'troll' && haNano() && ['combatte'].includes(azione)) azione = 'morte';
  if (azione === 'fugge-inf' && eroiAttivi().length <= i.n) azione = 'combatte';
  i.reazione = { tiro: r.totale, azione, param: re[3], tipoCorr: re[4] };
  nota(`Reazione (${r.totale}): ${i.nome} → ${azione === 'corruzione' ? `Corruzione (${re[3]} p.o.${re[4] === 'totale' ? ' in tutto' : ' a mostro'})` : azione}.`);
  if (azione === 'fugge' || azione === 'fugge-inf') { i.stato = 'finito'; i.esito = 'fuga'; nota(`${i.nome} fugge: nessun bottino.`); }
  else if (azione === 'corruzione') {
    if (i.id === 'ferrofago') i.reazione.param = (await tira('1d6', 'Corruzione ferrofago')).totale;
    else if (typeof re[3] === 'string' && /d6/.test(re[3])) i.reazione.param = (await tira(re[3], 'Tangente')).totale;
    i.stato = 'corruzione';
  } else if (azione === 'banchetto') {
    const x = await tira('1d6+3', 'Veleno del banchetto'); nota(`${i.nome} mangia il cibo avvelenato: subisce ${x.totale} PV!`);
    i.mostriPrima = false; await inizioScontro(); await applicaDanni(x.totale);
  } else if (azione === 'combatte' || azione === 'morte' || azione === 'combatte-sempre' || azione === 'tenzone') {
    if (azione === 'tenzone') nota('Singolar tenzone: combatte solo il capo o il campione del nemico (1 contro 1).');
    if (azione !== 'combatte') i.noMorale = true;
    i.mostriPrima = true; await inizioScontro();
  } else if (azione === 'dorme') { i.bonusPrimoAttacco = 2; await inizioScontro(); }
  else i.stato = 'speciale';
  modificato();
}

export function costoCorruzione() {
  const i = inc(), p = i.reazione?.param;
  if (typeof p !== 'number') return null;
  return i.reazione.tipoCorr === 'totale' ? p : p * i.n;
}
export const oroTotale = () => eroiVivi().reduce((a, e) => a + (e.oro || 0), 0);
export function haOroStolti() { return eroiVivi().some(e => (e.oggetti || []).some(o => /oro degli stolti/i.test(o.nome))); }

export function paga(costo, stolti = false) {
  const i = inc();
  if (stolti) {
    for (const e of eroiVivi()) { const k = (e.oggetti || []).findIndex(o => /oro degli stolti/i.test(o.nome)); if (k >= 0) { e.oggetti.splice(k, 1); break; } }
    nota(`Oro degli stolti usato: ${i.nome} corrotto.`);
  } else {
    let resto = costo;
    for (const e of [...eroiVivi()].sort((a, b) => b.oro - a.oro)) { const q = Math.min(e.oro || 0, resto); e.oro -= q; resto -= q; if (!resto) break; }
    nota(`Pagati ${costo} p.o.: ${i.nome} corrotto e considerato sconfitto.`);
  }
  vittoria(i); finisci('corrotto');
}
export function rifiutaCorruzione() { const i = inc(); nota('Corruzione rifiutata: si combatte.'); i.mostriPrima = true; return inizioScontro(); }

// ---------------- helper ----------------
function ctxGruppo() {
  const i = inc();
  return { senzaLanterna: !gruppoHaLanterna(), inferiorita: eroiAttivi().length > i.n };
}
export function perdiPV(e, n, causa = '', opz = {}) {
  if (e.malattia && !opz.noExtra && n > 0) { n += 1; causa = (causa ? causa + ', ' : '') + 'malattia della melma verde'; }
  e.pv -= n;
  nota(`${e.nome} perde ${n} PV${causa ? ' (' + causa + ')' : ''}${e.pv <= 0 ? ' e cade a terra, ferito mortalmente!' : ` → ${e.pv}/${e.pvMax}`}`);
  if (e.pv <= 0) { e.pv = 0; e.stato = 'morto'; if (e.caosTrasf) document.dispatchEvent(new CustomEvent('caos-rinasci', { detail: e.id })); }
  controllaSconfitta(); modificato();
}
function controllaSconfitta() {
  if (!eroiVivi().some(e => e.stato === 'ok')) { terminaAvventura('Il gruppo è stato sconfitto'); if (inc()) { inc().stato = 'finito'; inc().esito = 'sconfitta'; } }
}
export async function salva(e, liv, bonus = 0, label = 'Tiro salvezza') {
  const r = await d6Esplosivo(`${label} – ${e.nome} (L${liv})`);
  const tot = r.totale + bonus;
  const ok = r.naturale !== 1 && tot >= liv;
  nota(`${label}: ${e.nome} tira ${tot} contro L${liv} → ${ok ? 'salvo' : 'FALLITO'}.`);
  if (!ok && /veleno/i.test(label)) T.evento(e, 'veleno');
  if (ok && /sguardo/i.test(label)) T.evento(e, 'sguardo');
  return ok;
}
export async function salvaTutti(label, liv, bonusFn, onFail) {
  for (const e of eroiAttivi()) if (!(await salva(e, liv, bonusFn(e), label))) await onFail(e);
  modificato();
}

// ---------------- attacco ----------------
export function contestoAttacco(e, opz = {}) {
  const i = inc();
  return { bersaglio: i, arma: opz.armaId, ...ctxGruppo(), extra: opz.extra || 0, bonusGruppo: (i.bonusPrimoAttacco && i.turno === 1 ? i.bonusPrimoAttacco : 0) + (opz.bonusGruppo || 0), bonusGruppoTxt: 'Bonus del gruppo' };
}

export async function attacca(e, opz = {}) {
  const i = inc();
  if (!i.inizioFatto) await inizioScontro();
  if (i.speciale === 'gremlin') return;
  if (e.inghiottito) { toast(`${e.nome} è stato inghiottito e non può attaccare.`, 'warn'); return; }
  const L = livAtt(i);
  const arma0 = opz.armaId !== undefined ? armaDi(opz.armaId) : armaPrincipale(e);
  if (arma0?.fuoco) {
    if ((e.rotte || []).includes(arma0.id)) { toast(`${arma0.nome} è esplosa: va riparata in città.`, 'warn'); return; }
    i.sparati = i.sparati || {};
    if (i.sparati[e.id + arma0.id]) { toast(`${arma0.nome}: un solo colpo per incontro.`, 'warn'); return; }
    i.sparati[e.id + arma0.id] = true;
  }
  if (arma0 && arma0.lancio && e.classe === 'elfo-fuoco') { toast('Gli elfi del fuoco non usano armi a distanza.', 'warn'); return; }
  const ctx = contestoAttacco(e, opz);
  const furioso = !!opz.furioso;
  const r = furioso ? await migliorDi(3, `Attacco furioso di ${e.nome}`) : await d6Esplosivo(`Attacco di ${e.nome}`);
  if (r.naturale === 1 && e.infettoCaos) { e.infettoCaos = false; await K.toccatoDalCaos(e); }
  const m = modAttacco(e, ctx);
  const totale = r.totale + m.tot;
  const auto1 = r.naturale === 1;
  let colpi = !auto1 && totale >= L ? Math.max(1, Math.floor(totale / L)) : 0;
  const armaUsata = opz.armaId !== undefined ? armaDi(opz.armaId) : armaPrincipale(e);
  if (armaUsata && !armaUsata.lancio) e.mischia = true;
  if (arma0?.fuoco && r.naturale === 1) {
    const x = await tira('1d3', `Esplosione di ${arma0.nome}`); perdiPV(e, x.totale, `${arma0.nome} esplode`);
    (e.rotte = e.rotte || []).push(arma0.id);
  }
  if (arma0?.id === 'archibugio') { const x = await dado('Lo sparo attira i mostri erranti? (1-2 sì)'); if (x.totale <= 2) { nota('Lo sparo attira i mostri erranti: arriveranno dopo questo combattimento.'); const m = await monstroErrante(); avviaIncontro(m, null); } }
  if (colpi && e.classe === 'tiratore' && arma0?.lancio) colpi = Math.max(2, colpi + 1);
  if (colpi && i.marchio?.eroeId === e.id) {
    const nonViv = i.tag.includes('non-morto') || /golem|melma|cubo|liquame|gelatina|blob|muffa|vespe/i.test(i.nome);
    if (!nonViv || e.specializzato) { colpi *= 3; nota(`${e.nome} colpisce il bersaglio marchiato: danni TRIPLI!`); }
    i.marchio = null;
  }
  if (colpi && i.immuneContundenti && armaUsata?.tipo === 'contundente') { nota(`${e.nome} colpisce, ma ${i.nome} è immune alle armi contundenti.`); colpi = 0; modificato(); return { colpi: 0, totale }; }
  if (furioso && colpi) colpi *= 2;
  if (furioso) e.usi.furie = (e.usi.furie || 0) + 1;
  i.agito[e.id] = true;
  const desc = `${e.nome} attacca: ${r.totale}${m.tot ? (m.tot > 0 ? '+' : '') + m.tot : ''} = ${totale} contro LIV ${L}${auto1 ? ' (1 naturale: fallimento automatico)' : ''}`;
  if (!colpi) { nota(`${desc} → mancato.`); modificato(); return { colpi: 0, totale }; }
  nota(`${desc} → ${i.minore ? `${colpi} uccis${colpi === 1 ? 'o' : 'i'}` : `${colpi} ferit${colpi === 1 ? 'a' : 'e'}`}${furioso ? ' (furioso: danni doppi)' : ''}.`);
  const pre = { n: i.n, pv: i.pv };
  await applicaDanni(colpi);
  T.uccisioni(e, i, pre, { mischia: !armaUsata?.lancio });
  return { colpi, totale };
}

/** Assassino: rinuncia a un attacco per nascondersi e marchiare il bersaglio. */
export async function marchia(e) {
  const i = inc();
  if (!i || i.stato !== 'combattimento') { toast('Serve un combattimento in corso.', 'warn'); return; }
  if (i.marchio && i.marchio.eroeId !== e.id) { toast('Solo un assassino alla volta può marchiare un bersaglio.', 'warn'); return; }
  const r = await d6Esplosivo(`Furtività di ${e.nome} (contro LIV ${i.liv})`);
  const tot = r.totale + e.livello; i.agito[e.id] = true;
  if (r.naturale !== 1 && tot >= i.liv) { i.marchio = { eroeId: e.id }; nota(`${e.nome} si nasconde nell’ombra e marchia ${i.nome} (${tot} contro ${i.liv}): il prossimo attacco infliggerà danni tripli.`); }
  else { nota(`${e.nome} viene scoperto (${tot} contro ${i.liv}): ${i.nome} lo attacca subito.`); await eseguiDifese([{ eroeId: e.id }]); }
  modificato();
}

export async function applicaDanni(n) {
  const i = inc();
  if (i.orda) {
    i.liv = Math.max(0, i.liv - n); nota(`${i.nome}: il suo livello scende a ${i.liv}.`);
    if (i.liv === 0) return vittoriaScontro();
    return modificato();
  }
  if (i.minore) {
    i.n = Math.max(0, i.n - n);
    if (i.n === 0) return vittoriaScontro();
    if (!i.moraleFatto && !i.noMorale && i.n * 2 < i.nIniziale) { i.moralePendente = true; nota(`Rimasti ${i.n} su ${i.nIniziale}: serve un tiro di morale.`); }
  } else {
    i.pv = Math.max(0, i.pv - n);
    if (i.pv === 0) return vittoriaScontro();
    if (i.pv * 2 < i.pvMax && i.liv === i.livBase) { i.liv = Math.max(1, i.livBase - 1); nota(`${i.nome} è ferito gravemente: il suo livello scende a ${i.liv}.`); if (!i.moraleFatto && !i.noMorale) { i.moralePendente = true; nota('Serve un tiro di morale.'); } }
  }
  modificato();
}

export async function tiraMorale(extra = 0) {
  const i = inc();
  const r = await dado(`Morale di ${i.nome}`);
  const tot = r.totale + (i.moraleMod || 0) + extra;
  i.moraleFatto = true; i.moralePendente = false;
  if (tot <= 3) { nota(`Morale ${tot}: ${i.nome} fugge!`); return vittoriaScontro('fuga'); }
  nota(`Morale ${tot}: ${i.nome} continua a combattere.`); modificato();
}

function vittoriaScontro(esito = 'sconfitti') {
  const i = inc();
  i.stato = 'finito'; i.esito = esito; i.n = esito === 'fuga' ? i.n : 0;
  nota(esito === 'fuga' ? `${i.nome} in fuga: conta come sconfitto.` : `${i.nome} sconfitto!`);
  vittoria(i); modificato();
}

export async function saccheggia() {
  const i = inc();
  if (i.tesoroPreso) return; i.tesoroPreso = true;
  if (i.tes === 'NO' || i.errante) { nota(i.errante ? 'I mostri erranti non hanno tesori.' : 'Nessun tesoro.'); modificato(); return; }
  const mod = typeof i.tes === 'number' ? i.tes : 0;
  const molt = i.tes === 'x2' ? 2 : (i.tesMolt || 1);
  const t = await tesoro(mod, { molt, finale: i.bossFinale, orcoSenzaMagia: i.tag.includes('orco') });
  nota(`Saccheggio: ${t}`); modificato();
}

export function chiudiIncontro() {
  const i = inc(); if (!i) return;
  S.adv.incontro = (S.adv.coda || []).shift() || null;
  S.party.eroi.forEach(e => {
    e.inghiottito = false; e.mischia = false; e.bonusIncontro = 0;
    if (e.stato === 'ok' && (e.traguardi || []).some(t => t.id === 'passo-morte')) {   // 1 PV e nessuna guarigione per 6 incontri = 1 punto
      if (e.pv === 1) { e.passoMorte = (e.passoMorte || 0) + 1; if (e.passoMorte >= 6) { e.passoMorte = 0; T.evento(e, 'passo-morte'); } } else e.passoMorte = 0;
    }
  });
  modificato();
}

// ---------------- incantesimi e poteri ----------------
export const incantesimiPronti = e => (e.incantesimi || []).map((s, idx) => ({ ...s, idx })).filter(s => !s.usato);

export async function lancia(e, idx, { bersaglioId, daPergamena, oggetto } = {}) {
  const i = inc();
  const s = oggetto ? { nome: oggetto.incantesimo, usato: false } : e.incantesimi[idx];
  if (!s || s.usato) return;
  if (oggetto) {
    if (!(oggetto.cariche > 0)) return toast(`${oggetto.nome}: nessuna carica.`, 'warn');
    oggetto.cariche--;
    if (oggetto.cariche <= 0 && oggetto.consuma) e.oggetti = e.oggetti.filter(o => o !== oggetto);
    nota(`${e.nome} usa ${oggetto.nome} (cariche rimaste: ${oggetto.cariche}).`);
  }
  const rimborsa = () => { if (oggetto) { oggetto.cariche++; if (!e.oggetti.includes(oggetto)) e.oggetti.push(oggetto); } };
  s.usato = true; i && (i.agito[e.id] = true);
  const nome = s.nome;
  if (nome === 'Protezione') { const b = eroePerId(bersaglioId) || e; i.protetti[b.id] = true; nota(`${e.nome} lancia Protezione su ${b.nome}: +2 alle difese per questo combattimento.`); return modificato(); }
  if (nome === 'Benedizione') { const b = eroePerId(bersaglioId) || e; b.maledetto = false; b.malattia = false; if (b.stato === 'pietra') b.stato = 'ok'; nota(`${e.nome} lancia Benedizione su ${b.nome}.`); return modificato(); }
  if (nome === 'Fuga') { nota(`${e.nome} lancia Fuga e riappare nella stanza d’ingresso.`); e.fuga = true; return modificato(); }
  if (nome === 'Comunicazione a Distanza') { nota(`${e.nome} lancia Comunicazione a Distanza: condivide con il gruppo gli indizi ottenuti lontano da esso (nessun tiro).`); return modificato(); }
  if (nome === 'Muro di Ghiaccio') { nota(`${e.nome} erige un Muro di Ghiaccio: il gruppo può sottrarsi indenne e i nemici non lo inseguono (salvo immateriali, volanti e creature di ghiaccio/gelo). Dura fino a fine avventura, salvo fuoco.`); return modificato(); }
  if (nome === 'Ondata di Forza') { const b = eroePerId(bersaglioId) || e; nota(`${e.nome} lancia Ondata di Forza su ${b.nome}: per 6 stanze usa armi da mischia a due mani con una mano e non subisce penalità di peso.`); return modificato(); }
  if (nome === 'Ponte Illusorio') { nota(`${e.nome} crea un Ponte Illusorio: il gruppo attraversa ogni ostacolo invalicabile; può farlo sparire sotto gli inseguitori.`); return modificato(); }
  if (nome === 'Dono d’Oro') {
    const oro = (S.adv.bottino || []).filter(x => x.tipo === 'oro' && !x.raddoppiato);
    oro.forEach(x => { x.valore *= 2; x.raddoppiato = true; x.testo = `${x.valore} pezzi d’oro (raddoppiati dal Dono d’Oro)`; });
    nota(`${e.nome} lancia Dono d’Oro: ${oro.length ? 'l’oro del tesoro è raddoppiato' : 'nessun tesoro d’oro da raddoppiare'}.`);
    return modificato();
  }
  if (nome === 'Teletrasporto del Caos') { s.usato = false; const ok = await K.teletrasporto(e); if (ok) s.usato = true; return modificato(); }
  if (!i || i.stato !== 'combattimento') { toast('Serve un combattimento in corso.', 'warn'); s.usato = false; rimborsa(); return; }
  if (i.immuneIncantesimi?.includes(nome)) { nota(`${e.nome} lancia ${nome}: ${i.nome} è immune.`); return modificato(); }
  const L = livAtt(i);
  if (nome === 'Missile del Caos') {
    nota(`${e.nome} lancia Missile del Caos (automatico): ${i.minore ? 'nessun effetto sui mostri minori' : '2 PV al mostro maggiore'}; 1 PV all’incantatore.`);
    if (!i.minore) await applicaDanni(2);
    perdiPV(e, 1, 'Missile del Caos'); return modificato();
  }
  if (nome === 'Bacio di Xichtul') {
    nota(`${e.nome} lancia Bacio di Xichtul: tutti tirano 1d6 (esplosivo): chi supera il proprio livello perde 1 PV.`);
    for (const x of eroiAttivi()) { const q = await d6Esplosivo(`Bacio di Xichtul – ${x.nome}`); if (q.totale > x.livello) perdiPV(x, 1, 'Bacio di Xichtul'); }
    if (inc() === i && i.stato === 'combattimento') { const q = await d6Esplosivo(`Bacio di Xichtul – ${i.nome}`); if (q.totale > i.liv) { nota(`${i.nome} subisce 1 PV.`); await applicaDanni(1); } }
    return modificato();
  }
  if (nome === 'Scarica Oculare') K.follia(e, 1);
  const preInc = { n: i.n, pv: i.pv };
  const ctx = { ...contestoAttacco(e), incantesimo: true, daPergamena: !!daPergamena };
  const r = await d6Esplosivo(`${nome} di ${e.nome}`);
  const m = modAttacco(e, ctx);
  const totale = r.totale + m.tot + (nome === 'Scarica Oculare' && ['elfo', 'mago'].includes(e.classe) ? 0 : 0);
  const colpisce = r.naturale !== 1 && totale >= L;
  const base = `${e.nome} lancia ${nome}: ${totale} contro LIV ${L}`;
  if (e.classe === 'elfo-fuoco' && r.naturale === 1) {
    const x = await tira(e.armatura === 'pesante' ? '1d6' : '1d3', 'Fiamme che avvolgono l’elfo del fuoco'); perdiPV(e, x.totale, 'vista di fuoco');
    for (const a of eroiAttivi()) if (a.id !== e.id && !(await salva(a, e.livello, ['elfo-fuoco', 'furfante'].includes(a.classe) ? a.livello : 0, 'Fiamme dell’elfo del fuoco'))) perdiPV(a, 1, 'fiamme');
  }
  if (!colpisce) { nota(`${base} → fallito.`); return modificato(); }
  if (nome === 'Distruggi Aberranti') {
    if (i.tabella !== 'aberranti') { nota(`${base} → nessun effetto (solo mostri aberranti).`); return modificato(); }
    const q = 3 + (totale >= L * 2 ? 1 : 0); nota(`${base} → ${q} PV.`); await applicaDanni(q); return modificato();
  }
  if (nome === 'Scarica Oculare') { const q = 2 + (r.tiri.length > 1 ? 1 : 0); nota(`${base} → ${i.minore ? q + ' uccisi' : q + ' ferite'}.`); await applicaDanni(q); return modificato(); }
  if (nome === 'Occhio del Terrore') {
    const immune = i.drago || i.tag.includes('non-morto') || i.noMorale || /melma|cubo|liquame|gelatina|golem/i.test(i.nome);
    if (immune) { nota(`${base} → nessun effetto (${i.nome} non tira il morale).`); return modificato(); }
    nota(`${base} → tutti gli avversari tirano il morale a -1.`); i.moraleFatto = false; await tiraMorale(-1); return modificato();
  }
  if (nome === 'Illusione') {
    const k = await scelta('Illusione', `${base}: l’inganno riesce. Scegli l’effetto:`, [
      ['corr', 'Corrompi la creatura (come l’oro degli stolti)'], ['reaz', 'Scegli una reazione dall’elenco (non Fugge né Missione)'],
      ['mor', 'Costringi i seguaci a un tiro di morale'], ['bers', 'Crea un bersaglio illusorio (attira tutti gli attacchi per 1 turno)']]);
    if (k === 'corr') {
      if (!i.reazioni.some(x => x[2] === 'corruzione')) nota('Questa creatura non ha Corruzione fra le reazioni: nessun effetto.');
      else { nota(`${i.nome} è corrotto dall’illusione e se ne va (poi ti odierà).`); vittoria(i); finisci('corrotto'); }
    } else if (k === 'reaz') {
      const ok = i.reazioni.filter(x => !['fugge', 'fugge-inf', 'missione'].includes(x[2]));
      const sc = await scelta('Scegli la reazione', '', ok.map((x, n) => [n, x[2]]));
      nota(`Illusione: ${i.nome} reagisce con «${ok[sc ?? 0]?.[2]}».`);
      if (ok[sc ?? 0]?.[2] === 'corruzione') { vittoria(i); finisci('corrotto'); }
    } else if (k === 'mor') { if (i.minore && !i.noMorale) { i.moraleFatto = false; await tiraMorale(); } else nota('Nessun effetto (solo seguaci con morale).'); }
    else if (k === 'bers') { i.bersaglioIllusorio = true; nota('Un bersaglio illusorio attira tutti gli attacchi dei nemici per 1 turno.'); }
    return modificato();
  }
  if (nome === 'Fulmine Magico') {
    const q = i.minore ? 1 : Math.max(2, Math.floor(totale / L));
    nota(`${base} → ${i.minore ? '1 ucciso' : q + ' ferite'}.`); await applicaDanni(q);
  } else if (nome === 'Palla di Fuoco') {
    if (i.drago && !i.tag.includes('non-morto')) { nota(`${base} → nessun effetto sui draghi.`); return modificato(); }
    if (i.orda) { nota(`${base} → l’intero sciame è distrutto.`); await applicaDanni(99); return modificato(); }
    const bonus2 = i.id === 'mummia' ? 2 : 0;
    const q = i.minore ? Math.max(1, totale + bonus2 - L) : Math.max(1, Math.floor((totale + bonus2) / L));
    nota(`${base} → ${i.minore ? q + ' uccisi' : q + ' ferite'}.`); await applicaDanni(q);
  } else if (nome === 'Sonno') {
    if (i.tag.includes('non-morto') || i.drago) { nota(`${base} → nessun effetto (non-morti/draghi immuni).`); return modificato(); }
    if (i.minore) { const x = await tira('1d6', 'Mostri addormentati'); const q = x.totale + e.livello; i.sedato += Math.min(q, i.n); nota(`${base} → ${Math.min(q, i.n)} mostri addormentati (contano come uccisi).`); await applicaDanni(q); }
    else { i.sedato = 1; nota(`${base} → ${i.nome} si addormenta (conta come sconfitto; puoi legarlo con una corda).`); await applicaDanni(i.pv); }
  } else { nota(`${base} → effetto: vedi regole.`); }
  T.uccisioni(e, i, preInc, { incantesimo: nome });
  modificato();
}

export async function guarisci(e, bersaglio) {
  if ((e.usi.guarigione || 0) >= 3) return toast('Guarigioni esaurite.', 'warn');
  const r = await tira('1d6', `Guarigione di ${e.nome}`);
  const q = r.totale + e.livello + (e.simboloSacro ? 2 : 0);
  const prima = bersaglio.pv;
  bersaglio.pv = Math.min(bersaglio.pvMax, bersaglio.pv + q);
  e.usi.guarigione++;
  if (inc()) inc().agito[e.id] = true;
  nota(`${e.nome} cura ${bersaglio.nome}: +${bersaglio.pv - prima} PV (tiro ${q}) → ${bersaglio.pv}/${bersaglio.pvMax}.`);
  modificato();
}
export function usaBenedizione(e, bersaglio) {
  if ((e.usi.benedizione || 0) >= 3) return toast('Benedizioni esaurite.', 'warn');
  e.usi.benedizione++; bersaglio.maledetto = false; bersaglio.malattia = false; if (bersaglio.stato === 'pietra') bersaglio.stato = 'ok';
  nota(`${e.nome} lancia Benedizione su ${bersaglio.nome}.`); modificato();
}

// ---------------- turno dei mostri ----------------
const ODIATI = { nano: ['troll', 'goblin', 'coboldo'], elfo: ['orco'], chierico: ['non-morto'] };
const odia = (inc_, e) => (ODIATI[e.classe] || []).some(t => inc_.tag.includes(t));

/** Propone chi viene attaccato da ogni attacco dei mostri. Restituisce [{eroeId}] */
export function propostaAttacchi({ tuttiAttaccano = false } = {}) {
  const i = inc();
  let attacchi = i.attPerBersaglio ? eroiAttivi().length : (i.minore ? i.n * 1 : i.att);
  if (i.minore && i.corridoio && !tuttiAttaccano) attacchi = Math.min(attacchi, 2);
  const ordine = ordineMarcia().filter(e => e.stato === 'ok');
  if (!ordine.length) return [];
  let eleg = ordine;
  if (i.corridoio) {
    const dietro = i.sorpresa && i.errante;
    eleg = dietro ? ordine.slice(-2) : ordine.slice(0, 2);
  }
  const lista = [];
  const prima = [...eleg].sort((a, b) => (odia(i, b) - odia(i, a)) || (b.pv - a.pv));
  if (attacchi <= eleg.length) for (let k = 0; k < attacchi; k++) lista.push({ eroeId: prima[k].id });
  else {
    const per = Math.floor(attacchi / eleg.length);
    eleg.forEach(e => { for (let k = 0; k < per; k++) lista.push({ eroeId: e.id }); });
    const extra = attacchi - per * eleg.length;
    const ex = [...eleg].sort((a, b) => (odia(i, b) - odia(i, a)) || (a.pv - b.pv));
    for (let k = 0; k < extra; k++) lista.push({ eroeId: ex[k % ex.length].id });
  }
  if (!i.minore && i.att > 1 && lista.length) { // attacchi multipli del maggiore: a caso fra i bersagli possibili
    return lista.map(() => ({ eroeId: casuale(eleg).id }));
  }
  return lista;
}

async function effettoFerita(e) {
  const i = inc();
  if (e.stato !== 'ok') return;
  if (i.id === 'ratti') { const x = await dado(`Infezione dei ratti per ${e.nome} (1 = perde 1 PV)`); if (x.totale === 1) perdiPV(e, 1, 'infezione'); }
  if (i.id === 'millepiedi') { if (!(await salva(e, 2, 0, 'Veleno millepiedi'))) perdiPV(e, 1, 'veleno'); }
  if (i.id === 'fungoidi') { if (!(await salva(e, 3, e.classe === 'mezzuomo' ? e.livello : 0, 'Veleno fungoidi'))) perdiPV(e, 1, 'veleno'); }
  if (i.id === 'ragno') { if (!(await salva(e, 3, 0, 'Veleno del ragno'))) perdiPV(e, 1, 'veleno'); }
  if (i.veleno) { if (!(await salva(e, i.veleno, 0, 'Veleno'))) perdiPV(e, 1, 'veleno'); }
  if (i.petrifica && e.stato === 'ok') { if (!(await salva(e, i.petrifica, 0, 'Pietrificazione'))) { e.stato = 'pietra'; T.evento(e, 'trasformazione'); nota(`${e.nome} è trasformato in pietra!`); } }
  if (i.dissangua) { i.dissanguati = i.dissanguati || {}; i.dissanguati[e.id] = true; }
  if (i.follia && e.stato === 'ok') K.follia(e, 1);
  if (i.potere === 'risucchio' && e.livello > 0) { if (!(await salva(e, 4, 0, 'Risucchio di energia'))) { e.livello--; e.pvMax = Math.max(1, e.pvMax - 1); e.pv = Math.min(e.pv, e.pvMax); nota(`${e.nome} perde un livello (ora ${e.livello}).`); } }
}

async function ferrofago(e) {
  if (e.armatura !== 'nessuna') { nota(`Il ferrofago divora l’armatura di ${e.nome}!`); e.armatura = 'nessuna'; }
  else if (e.scudo) { e.scudo = false; nota(`Il ferrofago divora lo scudo di ${e.nome}!`); }
  else if (e.armaPrincipale) { const a = armaDi(e.armaPrincipale); e.armi = (e.armi || []).filter(x => x !== e.armaPrincipale); e.armaPrincipale = e.armi[0] || null; nota(`Il ferrofago divora l’arma (${a?.nome}) di ${e.nome}!`); }
  else { const x = await tira('3d6', 'Oro divorato'); const q = Math.min(e.oro || 0, x.totale); e.oro -= q; nota(`Il ferrofago ruba ${q} p.o. a ${e.nome}.`); }
}

export async function eseguiDifese(assegnazioni, opz = {}) {
  const i = inc();
  if (i.speciale === 'gremlin') return;
  // effetti all'inizio del turno dei mostri
  if (i.richiamo) { const x = await tira(`1d${i.richiamo}`, 'Belato: richiamo'); if (x.totale === 1) { i.n++; i.nIniziale++; nota(`${i.nome}: un altro mostro accorre in mischia!`); } }
  for (const e of eroiAttivi()) if (i.dissanguati?.[e.id]) perdiPV(e, 1, 'uccelli stigei');
  if (i.speciale === 'cubo') {
    for (const e of eroiAttivi()) {
      if (e.inghiottito) continue;
      if (!(await salva(e, e.mischia ? 4 : 2, 0, 'Inghiottito dal cubo'))) { e.inghiottito = true; nota(`${e.nome} è inghiottito dal cubo gelatinoso!`); }
      e.mischia = false;
    }
    return fineTurnoMostri();
  }
  // soffi e poteri che sostituiscono gli attacchi
  if (i.id === 'chimera' || i.id === 'c-chimera-sputo' || i.drago) {
    const x = await dado(`${i.nome}: soffio? (1-2 = soffia)`);
    if (x.totale <= 2) {
      nota(`${i.nome} soffia fuoco su tutti!`);
      await salvaTutti(`Soffio di ${i.nome}`, i.drago ? (i.sofLiv || 6) : 4, e => (i.drago ? Math.floor(e.livello / 2) : 0), async e => {
        const q = i.sofDanno ? (await tira(i.sofDanno, 'Danno del soffio')).totale : 1; perdiPV(e, q, 'soffio');
      });
      return fineTurnoMostri();
    }
  }
  for (const a of assegnazioni) {
    const e = eroePerId(a.eroeId);
    if (!e || e.stato !== 'ok') continue;
    const liv = livDif(i, e);
    const ctx = {
      tag: i.tag, sorpreso: i.sorpresa && i.turno <= 1, ritirata: opz.ritirata, fuga: opz.fuga,
      ignoraArmatura: i.id === 'c-vespe' || i.psionico, extra: i.psionico ? Math.floor(e.livello / 2) : 0,
      protezione: i.protetti?.[e.id], senzaLanterna: !gruppoHaLanterna(),
      ignoraPesante: i.id === 'ferrofago', primoMinotauro: i.id === 'minotauro' && !i.difeso[e.id]
    };
    const m = modDifesa(e, ctx);
    const r = await d6Esplosivo(`Difesa di ${e.nome} (contro LIV ${liv})`);
    const tot = r.totale + m.tot;
    if (r.naturale === 1 && e.infettoCaos) { e.infettoCaos = false; await K.toccatoDalCaos(e); }
    const ok = r.naturale === 6 || (r.naturale !== 1 && tot > liv);
    i.difeso[e.id] = true;
    if (ok) nota(`${e.nome} si difende: ${tot} > ${liv} → nessun danno.`);
    else {
      nota(`${e.nome} difesa fallita: ${tot} contro LIV ${liv}${r.naturale === 1 ? ' (1 naturale)' : ''}.`);
      if (i.id === 'ferrofago') await ferrofago(e);
      else if (i.speciale === 'melma') {
        nota(`${i.nome} colpisce senza far danni: tiro salvezza contro la malattia.`);
        if (!(await salva(e, 4, e.classe === 'mezzuomo' ? Math.floor(e.livello / 2) : 0, 'Malattia della melma verde'))) { e.malattia = true; nota(`${e.nome} è contagiato: ogni PV perso ne costa 1 in più (Benedizione per guarire).`); }
      } else {
        const dn = (i.dannoSu1 && r.naturale === 1) ? i.dannoSu1 : (i.danno || 1);
        perdiPV(e, dn, i.nome);
        if (i.rompeScudo && e.scudo && e.stato !== 'morto') { e.scudo = false; nota(`${i.nome} distrugge lo scudo di ${e.nome}!`); }
        await effettoFerita(e);
      }
    }
  }
  fineTurnoMostri();
}
function fineTurnoMostri() {
  const i = inc(); i.turno++; i.sorpresa = false; i.mostriPrima = false; i.agito = {}; i.protetti = i.protetti || {};
  if (i.id === 'troll' && i.n === 0) nota('Ricorda: i troll uccisi possono rigenerarsi (5-6 su 1d6 ciascuno) se non usi incantesimi o non li fai a pezzi.');
  modificato();
}

export async function sottrarsi(tipo) {
  const i = inc();
  nota(`Il gruppo ${tipo === 'ritirata' ? 'si ritira' : 'fugge'}!`);
  const lista = propostaAttacchi({ tuttiAttaccano: true });
  await eseguiDifese(lista, { ritirata: tipo === 'ritirata', fuga: tipo === 'fuga' });
  if (S.adv.incontro === i && i.stato !== 'finito') {
    const t = S.adv.tessere.find(x => x.id === i.tessera);
    if (t) { t.sospeso = i; S.adv.incontro = (S.adv.coda || []).shift() || null; nota(`Mostri rimasti nella stanza ${t.n}.`); }
  }
  modificato();
}
export function riprendiIncontro(t) {
  if (!t.sospeso) return;
  const i = t.sospeso; t.sospeso = null;
  i.inizioFatto = false; i.stato = 'nuovo'; i.turno = 0;
  if (S.adv.incontro && S.adv.incontro.stato !== 'finito') (S.adv.coda = S.adv.coda || []).push(i); else S.adv.incontro = i;
  modificato();
}
