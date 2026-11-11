// Gestione del gruppo: schede eroi, creazione, equipaggiamento, ordine di marcia, negozio.
import { R, S, modificato, log, nuovoEroe, eroePerId, eroiVivi, livelloMax } from './state.js';
import { h, modal, toast, confirmBox, sign, uid } from './util.js';
import { tira } from './dice.js';
import { armaDi, nomeClasse, sovraccarico, incantatore, NOME_ARMATURA, gruppoHaLanterna } from './rules.js';
import { tiroES, eroePuoSalire } from './game.js';
import * as T from './tratti.js';

const NOMI = ['Bruggo', 'Aldric', 'Thora', 'Kenna', 'Marcus', 'Elowen', 'Dollom', 'Grimli', 'Sera', 'Tobin', 'Vesna', 'Rurik', 'Ilya', 'Fenn', 'Mirela', 'Orsolo', 'Brannoc', 'Zadi', 'Nerys', 'Cael'];
const ICONE = { arlecchino: '\u{1F3AD}', assassino: '\u{1F5E1}', 'elfo-fuoco': '\u{1F525}', tiratore: '\u{1F3AF}', veterano: '\u{1F396}', barbaro: '\u{1FA93}', chierico: '✡', elfo: '\u{1F3F9}', furfante: '\u{1F5E1}', guerriero: '⚔', mago: '✨', mezzuomo: '\u{1F344}', nano: '⛏' };
export const iconaClasse = c => ICONE[c] || '✦';

export function slotIncantesimi(e) {
  if (e.classe === 'mago') return 2 + e.livello;
  if (e.classe === 'elfo') return e.livello;
  if (e.classe === 'elfo-fuoco') return 1;
  return 0;
}
export function sistemaSlot(e) {
  const n = slotIncantesimi(e);
  e.incantesimi = e.incantesimi || [];
  while (e.incantesimi.length < n) e.incantesimi.push({ nome: e.classe === 'elfo-fuoco' ? 'Palla di Fuoco' : 'Sonno', usato: false });
  if (e.classe === 'elfo-fuoco') e.incantesimi.forEach(s => { s.nome = 'Palla di Fuoco'; });
  if (e.incantesimi.length > n) e.incantesimi.length = n;
}

export function equipaggiamentoIniziale(e) {
  const A = id => { e.armi.push(id); if (!e.armaPrincipale) e.armaPrincipale = id; };
  switch (e.classe) {
    case 'barbaro': case 'guerriero': case 'nano': A('una-mano-taglio'); e.armatura = 'leggera'; e.scudo = true; break;
    case 'chierico': A('una-mano-contundente'); e.armatura = 'leggera'; e.scudo = true; break;
    case 'elfo': A('una-mano-taglio'); e.armi.push('arco'); e.armatura = 'leggera'; break;
    case 'furfante': A('leggera-taglio'); e.armatura = 'leggera'; e.oggetti.push({ nome: 'Corda', qta: 1 }, { nome: 'Grimaldelli', qta: 1 }); break;
    case 'mago': A('leggera-taglio'); e.oggetti.push({ nome: 'Libro di incantesimi', qta: 1 }, { nome: 'Strumenti per scrivere', qta: 1 }); break;
    case 'arlecchino': A('leggera-taglio'); e.armi.push('leggera-taglio', 'una-mano-taglio'); e.armatura = 'leggera'; e.oggetti.push({ nome: 'Costume da menestrello', qta: 1 }, { nome: 'Grimaldelli', qta: 1 }); break;
    case 'assassino': A('una-mano-taglio'); e.armi.push('leggera-taglio'); e.armatura = 'leggera'; e.oggetti.push({ nome: 'Grimaldelli', qta: 1 }); break;
    case 'elfo-fuoco': A('una-mano-taglio'); e.armatura = 'leggera'; break;
    case 'tiratore': A('arco'); e.armi.push('leggera-taglio'); e.armatura = 'leggera'; break;
    case 'veterano': A('leggera-taglio'); e.lanterna = true; break;
    case 'mezzuomo': A('leggera-taglio'); e.armi.push('fionda'); e.oggetti.push({ nome: 'Razioni', qta: 3 }); break;
  }
  sistemaSlot(e);
}

// ---------------- pannello gruppo ----------------
export function renderGruppo(box) {
  box.replaceChildren();
  const P = S.party;
  P.ordine = P.ordine.filter(id => eroePerId(id));
  P.eroi.forEach(e => { if (!P.ordine.includes(e.id)) P.ordine.push(e.id); });
  const lant = gruppoHaLanterna();
  box.append(h('div', { class: 'panel-head' },
    h('h2', {}, 'Il gruppo'),
    h('div', { class: 'btns' },
      h('button', { class: 'primary', onclick: creaEroe, disabled: P.eroi.filter(e => e.stato !== 'morto').length >= 4 && false }, '+ Eroe'),
      h('button', { onclick: negozio, title: 'Compra e vendi equipaggiamento' }, 'Negozio'))));
  if (P.eroi.length && !lant) box.append(h('div', { class: 'warn-box' }, 'Nessuna lanterna in mano al gruppo: -2 a tutti gli attacchi e alle difese (regola della lanterna).'));
  const stat = h('div', { class: 'party-stats' },
    h('span', {}, `Oro del gruppo: `, h('b', {}, eroiVivi().reduce((a, e) => a + (e.oro || 0), 0))),
    h('span', {}, `Livello max: `, h('b', {}, livelloMax())));
  box.append(stat);
  if (!P.eroi.length) box.append(h('div', { class: 'empty' }, h('p', {}, 'Nessun eroe. Crea il tuo gruppo di quattro avventurieri.'), h('button', { class: 'primary', onclick: creaGruppoVeloce }, 'Crea gruppo casuale')));
  P.ordine.forEach((id, idx) => {
    const e = eroePerId(id); if (!e) return;
    box.append(schedaCompatta(e, idx));
  });
  const es = (S.adv.esPendenti || []);
  if (es.length) {
    const b = h('div', { class: 'es-box' }, h('h4', {}, 'Tiri esperienza disponibili'));
    es.forEach(x => b.append(h('button', { class: 'accent', onclick: () => scegliPerES(x) }, `Tira ES: ${x.motivo}${x.meno1 ? ' (-1)' : ''}`)));
    box.append(b);
  }
}

function schedaCompatta(e, idx) {
  const pct = Math.max(0, Math.min(100, e.pv / e.pvMax * 100));
  const stati = [];
  if (e.lanterna) stati.push(h('span', { class: 'tag amber', title: 'Porta la lanterna' }, 'Lanterna'));
  if (e.maledetto) stati.push(h('span', { class: 'tag red' }, 'Maledetto'));
  if (e.zoppo) stati.push(h('span', { class: 'tag red' }, 'Zoppo'));
  if (e.stato === 'pietra') stati.push(h('span', { class: 'tag gray' }, 'Pietrificato'));
  if (e.stato === 'morto') stati.push(h('span', { class: 'tag dead' }, 'Caduto'));
  if (sovraccarico(e)) stati.push(h('span', { class: 'tag red', title: 'Troppo carico: -1 alla difesa' }, 'Sovraccarico'));
  const arma = armaDi(e.armaPrincipale);
  const eq = [arma?.nome, e.armatura !== 'nessuna' ? NOME_ARMATURA[e.armatura] : null, e.scudo ? 'Scudo' : null].filter(Boolean).join(' · ') || 'Disarmato';
  return h('div', { class: `hero ${e.stato}`, dataset: { id: e.id } },
    h('div', { class: 'hero-top' },
      h('div', { class: 'pos' }, h('b', {}, idx + 1)),
      h('div', { class: 'hero-name' }, h('span', { class: 'ico' }, iconaClasse(e.classe)), h('b', {}, e.nome), h('small', {}, `${nomeClasse(e)} · liv. ${e.livello}`)),
      h('div', { class: 'upd' },
        h('button', { class: 'mini', title: 'Sposta avanti', onclick: () => sposta(idx, -1), disabled: idx === 0 }, '▲'),
        h('button', { class: 'mini', title: 'Sposta indietro', onclick: () => sposta(idx, 1) }, '▼'))),
    h('div', { class: 'hpline' },
      h('button', { class: 'mini', onclick: () => cambiaPV(e, -1) }, '−'),
      h('div', { class: 'hpbar' }, h('i', { style: `width:${pct}%` }), h('span', {}, `${e.pv}/${e.pvMax} PV`)),
      h('button', { class: 'mini', onclick: () => cambiaPV(e, 1) }, '+'),
      h('span', { class: 'gold', title: 'Pezzi d’oro' }, `${e.oro || 0} ●`)),
    h('div', { class: 'eq' }, eq),
    stati.length ? h('div', { class: 'tags' }, stati) : null,
    h('div', { class: 'hero-btns' },
      h('button', { onclick: () => scheda(e.id) }, 'Scheda'),
      h('button', { onclick: () => { e.lanterna = !e.lanterna; modificato(); }, class: e.lanterna ? 'on' : '' }, 'Lanterna'),
      h('button', { onclick: () => usaOggetto(e) }, 'Oggetti')));
}

function sposta(idx, d) {
  const o = S.party.ordine; const j = idx + d; if (j < 0 || j >= o.length) return;
  [o[idx], o[j]] = [o[j], o[idx]]; modificato('party');
}
function cambiaPV(e, d) {
  e.pv = Math.max(0, Math.min(e.pvMax, e.pv + d));
  if (e.pv <= 0) { e.stato = 'morto'; log(`${e.nome} cade a terra, ferito mortalmente.`); }
  else if (e.stato === 'morto') { e.stato = 'ok'; }
  modificato('party');
}

async function scegliPerES(x) {
  modal(`Tiro esperienza: ${x.motivo}`, (b, close) => {
    b.append(h('p', {}, `Scegli l’eroe che tenta di salire di livello (tira 1d6 e deve superare il livello attuale${x.meno1 ? '; questo tiro è a -1' : ''}). Lo stesso eroe non può salire due volte di fila.`));
    for (const e of eroiVivi()) {
      const ok = eroePuoSalire(e);
      b.append(h('button', { class: 'item-btn', disabled: !ok, onclick: async () => { close(); const r = await tiroES(x, e); toast(r.ok ? `${e.nome} sale di livello!` : `${e.nome} non sale (tiro ${r.tot}).`); } },
        h('b', {}, `${e.nome} – ${nomeClasse(e)} liv. ${e.livello}`), h('span', {}, ok ? 'Può tentare' : (S.adv.ultimoLivello === e.id ? 'Ha già guadagnato l’ultimo livello' : 'Livello massimo raggiunto'))));
    }
    b.append(h('div', { class: 'row end' }, h('button', { onclick: close }, 'Più tardi')));
  });
}

// ---------------- creazione eroi ----------------
export async function creaEroe() {
  if (S.party.eroi.filter(e => e.stato !== 'morto').length >= 4) { if (!(await confirmBox('Hai già 4 eroi vivi: ne aggiungi uno extra (es. PNG o sostituto)?'))) return; }
  modal('Nuovo eroe', (b, close) => {
    let classe = 'guerriero';
    const nome = h('input', { type: 'text', value: NOMI[Math.floor(Math.random() * NOMI.length)], maxlength: 24 });
    const grid = h('div', { class: 'class-grid' });
    const info = h('p', { class: 'class-info' });
    const aggiorna = () => {
      [...grid.children].forEach(c => c.classList.toggle('sel', c.dataset.c === classe));
      const c = R.classi[classe];
      info.textContent = `${c.tratti} Vita iniziale: ${c.vitaBase + 1}. Ricchezza: ${c.oro} p.o.`;
    };
    Object.entries(R.classi).filter(([, c]) => !c.suppl || S.party.supplCaos).forEach(([id, c]) => grid.append(h('button', { class: 'class-card', dataset: { c: id }, onclick: () => { classe = id; aggiorna(); } }, h('span', { class: 'ico' }, iconaClasse(id)), c.nome)));
    b.append(h('label', {}, 'Nome', nome), grid, info,
      h('div', { class: 'row end' }, h('button', { onclick: close }, 'Annulla'),
        h('button', { class: 'primary', onclick: async () => {
          const e = nuovoEroe(classe, nome.value.trim() || 'Senza nome');
          equipaggiamentoIniziale(e);
          close();
          const r = await tira(R.classi[classe].oro, `Ricchezza iniziale di ${e.nome} (${R.classi[classe].oro})`);
          e.oro = r.totale;
          S.party.eroi.push(e); S.party.ordine.push(e.id);
          if (!S.party.eroi.some(x => x.lanterna)) e.lanterna = true;
          log(`${e.nome}, ${nomeClasse(e)} di livello 1, si unisce al gruppo con ${e.oro} p.o.`);
          modificato('party'); scheda(e.id);
        } }, 'Crea e tira la ricchezza')));
    aggiorna();
  });
}

async function creaGruppoVeloce() {
  const classi = ['guerriero', 'chierico', 'mago', 'furfante'];
  for (const c of classi) {
    const e = nuovoEroe(c, NOMI[Math.floor(Math.random() * NOMI.length)]);
    equipaggiamentoIniziale(e);
    e.oro = (await tira(R.classi[c].oro, `Ricchezza di ${e.nome}`)).totale;
    S.party.eroi.push(e); S.party.ordine.push(e.id);
  }
  S.party.eroi[0].lanterna = true;
  log('Gruppo casuale creato: guerriero, chierico, mago e furfante. Ricordati di preparare gli incantesimi del mago.');
  modificato('party');
}

// ---------------- scheda completa ----------------
export function scheda(id) {
  const e = eroePerId(id); if (!e) return;
  sistemaSlot(e);
  modal(`${e.nome} – ${nomeClasse(e)}`, (b, close) => {
    const num = (label, key, opts = {}) => h('label', {}, label, h('input', { type: 'number', value: e[key] ?? 0, min: opts.min ?? 0, onchange: ev => { e[key] = +ev.target.value; if (key === 'livello') { sistemaSlot(e); } modificato('party'); } }));
    const sel = (label, key, opzioni) => h('label', {}, label, h('select', { onchange: ev => { e[key] = ev.target.value; modificato('party'); } }, opzioni.map(([v, t]) => h('option', { value: v, selected: e[key] === v }, t))));
    const chk = (label, key) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!e[key], onchange: ev => { e[key] = ev.target.checked; modificato('party'); } }), label);

    b.append(h('div', { class: 'grid2' },
      h('label', {}, 'Nome', h('input', { type: 'text', value: e.nome, onchange: ev => { e.nome = ev.target.value; modificato('party'); } })),
      sel('Stato', 'stato', [['ok', 'In forma'], ['pietra', 'Pietrificato'], ['pazzo', 'Pazzo'], ['morto', 'Caduto / morto']]),
      num('Livello', 'livello', { min: 0 }), num('PV massimi', 'pvMax', { min: 1 }), num('PV attuali', 'pv'), num('Pezzi d’oro', 'oro'),
      num('Bonus arma magica', 'bonusMagico', { min: 0 }), num('Bonus difesa magico', 'bonusDifesa', { min: 0 }), num('Indizi (0-2)', 'indizi'), num('Punti follia', 'follia', { min: 0 })),
      h('div', { class: 'chk-row' }, chk('Porta la lanterna', 'lanterna'), chk('Maledetto (-1 difesa)', 'maledetto'), chk('Zoppicante', 'zoppo'), chk('Si sta trasformando (caos)', 'caosTrasf'), chk('Malattia della melma verde', 'malattia')),
      h('p', { class: 'hint' }, R.classi[e.classe].tratti));

    // equipaggiamento
    const armi = h('div', { class: 'list' });
    const rArmi = () => {
      armi.replaceChildren();
      (e.armi || []).forEach((id, k) => {
        const a = armaDi(id);
        armi.append(h('div', { class: 'row' },
          h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'ap', checked: e.armaPrincipale === id, onchange: () => { e.armaPrincipale = id; modificato('party'); } }), `${a?.nome} (${a.mod >= 0 ? '+' : ''}${a.mod})`),
          h('button', { class: 'mini', onclick: () => { e.armi.splice(k, 1); if (e.armaPrincipale === id) e.armaPrincipale = e.armi[0] || null; rArmi(); modificato('party'); } }, '×')));
      });
      if (!e.armi?.length) armi.append(h('small', {}, 'Nessuna arma (attacca a mani nude: -2).'));
    };
    rArmi();
    const aggArma = h('select', {}, R.equipaggiamento.armi.filter(a => !a.suppl || S.party.supplCaos).map(a => h('option', { value: a.id }, a.nome)));
    b.append(h('h4', {}, 'Armi (spunta quella impugnata)'), armi,
      h('div', { class: 'row' }, aggArma, h('button', { onclick: () => { (e.armi = e.armi || []).push(aggArma.value); if (!e.armaPrincipale) e.armaPrincipale = aggArma.value; rArmi(); modificato('party'); } }, 'Aggiungi arma')),
      h('div', { class: 'grid2' }, sel('Armatura', 'armatura', Object.entries(NOME_ARMATURA)), chk('Scudo', 'scudo')));

    // incantesimi
    if (slotIncantesimi(e)) {
      const sl = h('div', { class: 'list' });
      const rs = () => {
        sl.replaceChildren();
        const permessi = R.equipaggiamento.incantesimi.filter(s => (e.classe === 'mago' || s.id !== 'benedizione') && (!s.suppl || S.party.supplCaos) && (!s.caos || S.party.supplCaos) && (e.classe !== 'elfo-fuoco' || s.nome === 'Palla di Fuoco'));
        e.incantesimi.forEach((s, k) => sl.append(h('div', { class: 'row' },
          h('select', { onchange: ev => { s.nome = ev.target.value; modificato('party'); } }, permessi.map(p => h('option', { value: p.nome, selected: p.nome === s.nome }, p.nome))),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!s.usato, onchange: ev => { s.usato = ev.target.checked; modificato('party'); } }), 'usato'))));
      };
      rs();
      b.append(h('h4', {}, `Incantesimi preparati (${slotIncantesimi(e)})`), sl, h('p', { class: 'hint' }, 'Prima di ogni avventura scegli liberamente gli incantesimi (anche copie dello stesso).'));
    }
    if (e.classe === 'chierico') b.append(h('div', { class: 'grid2' }, num2(e, 'Benedizioni usate (max 3)', 'benedizione'), num2(e, 'Guarigioni usate (max 3)', 'guarigione')));
    if (e.classe === 'mezzuomo') b.append(h('div', { class: 'grid2' }, num2(e, `Punti fortuna usati (max ${e.livello + 1})`, 'fortuna')));
    if (e.classe === 'barbaro') b.append(h('div', { class: 'grid2' }, num2(e, `Attacchi furiosi usati (max ${Math.ceil(e.livello / 2)})`, 'furie')));

    // oggetti
    const og = h('div', { class: 'list' });
    const ro = () => {
      og.replaceChildren();
      (e.oggetti || []).forEach((o, k) => {
        const car = o.cariche != null ? [
          h('button', { class: 'mini', title: 'Una carica in meno', onclick: () => { o.cariche = Math.max(0, o.cariche - 1); ro(); modificato('party'); } }, '−'),
          h('b', { title: 'Cariche / usi rimasti' }, `${o.cariche}/${o.caricheMax ?? o.cariche}`),
          h('button', { class: 'mini', title: 'Una carica in più', onclick: () => { o.cariche = Math.min(o.caricheMax ?? 99, o.cariche + 1); ro(); modificato('party'); } }, '+'),
          o.manuale ? h('button', { class: 'mini', disabled: o.cariche <= 0, title: 'Usa una carica (registra nel diario)', onclick: () => { o.cariche--; log(`${e.nome} usa ${o.nome} (rimaste: ${o.cariche}).`); ro(); modificato('party'); } }, 'Usa') : null
        ] : [];
        og.append(h('div', { class: 'row', title: o.nota || '' }, h('span', { class: 'grow' }, `${o.nome}${o.qta > 1 ? ` ×${o.qta}` : ''}${o.valore ? ` (${o.valore} p.o.)` : ''}`), ...car, h('button', { class: 'mini', onclick: () => { e.oggetti.splice(k, 1); ro(); modificato('party'); } }, '×')));
      });
      if (!e.oggetti?.length) og.append(h('small', {}, 'Nessun oggetto.'));
    };
    ro();
    const nuovo = h('input', { type: 'text', placeholder: 'Nome oggetto (es. Pozione di guarigione)' });
    if (S.party.supplCaos) b.append(T.sezione(e, () => scheda(e.id)));
    b.append(h('h4', {}, 'Oggetti e bottino'), og, h('div', { class: 'row' }, nuovo, h('button', { onclick: () => { if (!nuovo.value.trim()) return; (e.oggetti = e.oggetti || []).push({ nome: nuovo.value.trim(), qta: 1 }); nuovo.value = ''; ro(); modificato('party'); } }, 'Aggiungi')));
    if ((e.segreti || []).length) b.append(h('h4', {}, 'Segreti scoperti'), h('ul', {}, e.segreti.map(s => h('li', {}, s))));
    b.append(h('label', {}, 'Note', h('textarea', { rows: 3, onchange: ev => { e.note = ev.target.value; modificato('party'); } }, e.note || '')));
    b.append(h('div', { class: 'row between' },
      h('button', { class: 'danger', onclick: async () => { if (await confirmBox(`Eliminare definitivamente ${e.nome}?`)) { S.party.eroi = S.party.eroi.filter(x => x.id !== e.id); S.party.ordine = S.party.ordine.filter(x => x !== e.id); log(`${e.nome} lascia il gruppo.`); modificato('party'); close(); } } }, 'Elimina eroe'),
      h('button', { class: 'primary', onclick: close }, 'Chiudi')));
  }, { wide: true });
}
function num2(e, label, k) {
  return h('label', {}, label, h('input', { type: 'number', min: 0, value: e.usi[k] || 0, onchange: ev => { e.usi[k] = +ev.target.value; modificato('party'); } }));
}

// ---------------- oggetti d'uso ----------------
function usaOggetto(e) {
  modal(`Oggetti di ${e.nome}`, (b, close) => {
    b.append(h('p', { class: 'hint' }, 'Azioni rapide (ogni uso viene registrato).'));
    const azioni = [];
    azioni.push(h('button', { onclick: () => { if (e.usi.bende) return toast('Bende già usate in questa avventura.', 'warn'); const k = (e.oggetti || []).findIndex(o => /bende/i.test(o.nome)); if (k < 0) return toast('Nessuna benda.', 'warn'); e.usi.bende = 1; e.pv = Math.min(e.pvMax, e.pv + 1); log(`${e.nome} applica le bende (+1 PV).`); modificato('party'); close(); } }, 'Applica bende (+1 PV, fuori dal combattimento)'));
    azioni.push(h('button', { onclick: () => { const k = (e.oggetti || []).findIndex(o => /pozione/i.test(o.nome)); if (k < 0) return toast('Nessuna pozione di guarigione.', 'warn'); if (e.classe === 'barbaro') return toast('I barbari non usano pozioni.', 'warn'); e.oggetti.splice(k, 1); e.pv = e.pvMax; log(`${e.nome} beve una pozione di guarigione: PV al massimo.`); modificato('party'); close(); } }, 'Bevi pozione di guarigione'));
    azioni.push(h('button', { onclick: () => { const k = (e.oggetti || []).findIndex(o => /razion/i.test(o.nome)); if (k >= 0) { e.oggetti[k].qta--; if (e.oggetti[k].qta <= 0) e.oggetti.splice(k, 1); } log(`${e.nome} consuma una razione.`); modificato('party'); close(); } }, 'Consuma razione'));
    b.append(h('div', { class: 'col' }, azioni));
    const trasf = h('select', {}, S.party.eroi.filter(x => x.id !== e.id).map(x => h('option', { value: x.id }, x.nome)));
    const q = h('input', { type: 'number', min: 1, value: 10 });
    b.append(h('h4', {}, 'Dai monete a un compagno'), h('div', { class: 'row' }, q, trasf, h('button', { onclick: () => { const dst = eroePerId(trasf.value); const n = Math.min(+q.value || 0, e.oro || 0); if (!dst || n <= 0) return; e.oro -= n; dst.oro = (dst.oro || 0) + n; log(`${e.nome} dà ${n} p.o. a ${dst.nome}.`); modificato('party'); close(); } }, 'Trasferisci')));
  });
}

// ---------------- negozio ----------------
const gemme = e => (e.oggetti || []).filter(o => o.tipo === 'gemma' && o.valore > 0);
const valGemme = e => gemme(e).reduce((a, o) => a + o.valore * (o.qta || 1), 0);

/** Prezzo di vendita di un oggetto del personaggio (null = non vendibile). Gli oggetti magici generici valgono 1d6×1d6 (tirati alla vendita). */
function prezzoOggetto(o) {
  if (o.tipo === 'gemma') return { v: o.valore };
  const n = o.nome || '';
  if (o.cariche != null && o.incantesimo) return { v: 100 * Math.max(0, o.cariche), nota: `100 p.o. per carica (${o.cariche})` };
  if (/bacchetta del potere/i.test(n)) return { v: 25 * Math.max(0, o.cariche ?? 0), nota: '25 p.o. per carica' };
  if (/rosario/i.test(n)) return { v: 10 * Math.max(0, o.cariche ?? 0), nota: '10 p.o. per grano' };
  if (/pozione|anello/i.test(n)) return { v: 50 };
  if (o.tipo === 'pergamena' || /pergamena/i.test(n)) return { v: 100 };
  const m = /vale (\d+) p\.o\./i.exec(o.nota || '');
  if (m) return { v: +m[1] };
  if (o.tipo === 'magico' || o.tipo === 'arma-magica' || o.tipo === 'armatura-magica') return { dadi: '1d6x1d6' };
  const cat = R.equipaggiamento.oggetti.find(x => x.nome === n);
  if (cat) return { v: Math.floor(cat.costo / 2) };
  if (o.valore) return { v: o.valore };
  return null;
}

export function negozio() {
  modal('Negozio e vendite', (b, close) => {
    const vivi = () => S.party.eroi.filter(e => e.stato !== 'morto');
    const eroeSel = h('select', {});
    const rSel = (id) => eroeSel.replaceChildren(...vivi().map(x => h('option', { value: x.id, selected: x.id === id }, `${x.nome} (${x.oro || 0} p.o.${valGemme(x) ? ` + gemme ${valGemme(x)}` : ''})`)));
    const lista = h('div', { class: 'shop' });
    const venditaBox = h('div', { class: 'shop' });
    const aggiorna = (e) => { rSel(e.id); modificato('party'); rLista(); };
    const rLista = () => {
      lista.replaceChildren(); venditaBox.replaceChildren();
      const e = eroePerId(eroeSel.value); if (!e) return;
      const fondi = (e.oro || 0) + valGemme(e);
      const voci = [
        ...R.equipaggiamento.armi.map(a => ({ nome: a.nome, costo: a.costo, arma: a.id })),
        ...R.equipaggiamento.oggetti.map(o => ({ nome: o.nome, costo: o.costo, id: o.id }))
      ];
      lista.append(h('p', { class: 'hint' }, `Fondi: ${e.oro || 0} p.o.${valGemme(e) ? ` + ${valGemme(e)} p.o. in gemme (usate come moneta se l’oro non basta)` : ''}.`));
      voci.forEach(v => lista.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, v.nome), h('span', { class: 'price' }, `${v.costo} p.o.`),
        h('button', { disabled: fondi < v.costo, title: (e.oro || 0) < v.costo ? 'Pagherai con le gemme' : '', onclick: () => compra(e, v) }, (e.oro || 0) < v.costo && fondi >= v.costo ? 'Compra (gemme)' : 'Compra'))));

      // vendita
      venditaBox.append(h('h4', {}, `Vendi (${e.nome})`));
      let n = 0;
      (e.oggetti || []).forEach(o => {
        const p = prezzoOggetto(o); if (!p) return; n++;
        venditaBox.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, `${o.nome}${o.qta > 1 ? ` ×${o.qta}` : ''}`),
          h('span', { class: 'price' }, p.dadi ? '1d6×1d6 p.o.' : `${p.v * (o.tipo === 'gemma' ? 1 : 1)} p.o.${p.nota ? ` (${p.nota})` : ''}`),
          h('button', { onclick: async () => {
            let v = p.v; if (p.dadi) { const x = await tira(p.dadi, `Vendita di ${o.nome}`); v = x.totale; }
            if (o.qta > 1) o.qta--; else e.oggetti = e.oggetti.filter(y => y !== o);
            e.oro = (e.oro || 0) + v; log(`${e.nome} vende ${o.nome} per ${v} p.o.`); aggiorna(e);
          } }, 'Vendi')));
      });
      (e.armi || []).forEach((id, k) => {
        const a = armaDi(id); if (!a || !(a.costo > 0)) return; n++;
        venditaBox.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, a.nome), h('span', { class: 'price' }, `${Math.floor(a.costo / 2)} p.o.`),
          h('button', { onclick: () => { e.armi.splice(k, 1); if (e.armaPrincipale === id && !e.armi.includes(id)) e.armaPrincipale = e.armi[0]; const v = Math.floor(a.costo / 2); e.oro = (e.oro || 0) + v; log(`${e.nome} vende ${a.nome} per ${v} p.o.`); aggiorna(e); } }, 'Vendi')));
      });
      if (gemme(e).length > 1) venditaBox.append(h('button', { class: 'accent', onclick: () => { const v = valGemme(e); e.oggetti = e.oggetti.filter(o => o.tipo !== 'gemma'); e.oro = (e.oro || 0) + v; log(`${e.nome} vende tutte le gemme per ${v} p.o.`); aggiorna(e); } }, `Vendi tutte le gemme (${valGemme(e)} p.o.)`));
      if (!n) venditaBox.append(h('small', {}, 'Niente da vendere.'));
    };
    const compra = (e, v) => {
      let da = v.costo;
      const usaOro = Math.min(e.oro || 0, da); e.oro = (e.oro || 0) - usaOro; da -= usaOro;
      let nota = '';
      if (da > 0) {   // paga il resto con le gemme (prima le più piccole che bastano); l'eventuale resto torna in oro
        const gs = gemme(e).flatMap(o => Array.from({ length: o.qta || 1 }, () => o)).sort((a, b) => a.valore - b.valore);
        const scelte = []; let somma = 0;
        const unica = gs.find(g => g.valore >= da);
        if (unica) { scelte.push(unica); somma = unica.valore; } else for (const g of gs.reverse()) { if (somma >= da) break; scelte.push(g); somma += g.valore; }
        scelte.forEach(g => { if (g.qta > 1) g.qta--; else e.oggetti = e.oggetti.filter(y => y !== g); });
        e.oro += somma - da; nota = ` (pagando con ${scelte.length} gemm${scelte.length === 1 ? 'a' : 'e'} da ${somma} p.o.${somma > da ? `; resto ${somma - da} p.o.` : ''})`;
      }
      if (v.arma) { (e.armi = e.armi || []).push(v.arma); if (!e.armaPrincipale) e.armaPrincipale = v.arma; }
      else if (v.id === 'armatura-leggera') e.armatura = e.armatura === 'pesante' ? 'pesante' : 'leggera';
      else if (v.id === 'armatura-pesante') e.armatura = 'pesante';
      else if (v.id === 'scudo') e.scudo = true;
      else if (v.id === 'lanterna') e.lanterna = true;
      else { const ex = (e.oggetti = e.oggetti || []).find(o => o.nome === v.nome); if (ex) ex.qta++; else e.oggetti.push({ nome: v.nome, qta: 1 }); }
      log(`${e.nome} compra ${v.nome} per ${v.costo} p.o.${nota}`);
      aggiorna(e);
    };
    eroeSel.onchange = rLista;
    rSel();
    b.append(h('label', {}, 'Personaggio', eroeSel), lista, venditaBox,
      h('p', { class: 'hint' }, 'Vendita: armi a metà prezzo (arrotondato per difetto); gemme al loro valore; pozioni e anelli magici 50 p.o.; bacchette, bastoni e pergamene 100 p.o. per incantesimo; altri oggetti magici 1d6×1d6 p.o. (o il valore indicato). Le gemme si possono anche usare direttamente come moneta negli acquisti.'),
      h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: close }, 'Chiudi')));
    rLista();
  }, { wide: true });
}

// ---------------- riposo ----------------
export function riposa() {
  eroiVivi().forEach(e => {
    if (e.stato !== 'ok') return;
    e.pv = Math.min(e.pvMax, e.pv + 1);
    const u = (e.incantesimi || []).find(s => s.usato); if (u) u.usato = false;
    if (e.usi.guarigione) e.usi.guarigione--; else if (e.usi.benedizione) e.usi.benedizione--;
  });
  log('Il gruppo si riposa: +1 PV, +1 incantesimo/potere recuperato per ognuno.');
  modificato('party');
}
