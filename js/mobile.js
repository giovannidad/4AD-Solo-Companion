// Versione per telefono e tablet (sotto gli 861 px): barra a schede in basso, menu «⋯» dell'intestazione, suggerimenti al tocco
// e dadi 3D spenti sui telefoni. Sul desktop non crea nulla: gli elementi nascono solo quando lo schermo è stretto.
import { $, $$, h, toast } from './util.js';
import { S, onChange } from './state.js';
import * as dice from './dice.js';
import * as table from './map2d.js';

const MQ = matchMedia('(max-width: 860px)');
// icone al tratto (stesso stile su ogni dispositivo, niente emoji a colori)
const ICONE = {
  gruppo: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c3 .2 5 2.2 5 5.3"/>',
  mappa: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  dungeon: '<path d="M5 21V10a7 7 0 0 1 14 0v11z"/><path d="M12 21v-7M9 21v-4M15 21v-4"/>',
  impostazioni: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'
};
const icona = k => h('span', { class: 'ic', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" width="24" height="24">${ICONE[k]}</svg>` });
const SCHEDE = [['gruppo', 'Gruppo'], ['mappa', 'Mappa'], ['dungeon', 'Dungeon']];
const memo = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* ok */ } } };

// ---------------- dadi 3D: sui telefoni partono spenti, finché l'utente non sceglie ----------------
const telefono = () => matchMedia('(pointer: coarse)').matches && innerWidth < 861;
function dadiSuTelefono() {
  const casella = $('#dicePhys'); if (!casella) return;
  let pref = null; try { pref = localStorage.getItem('fad-dadi3d'); } catch { /* ok */ }
  if (telefono()) {
    dice.settings.fisici = pref === '1'; casella.checked = pref === '1';   // senza scelta salvata: spenti
    casella.addEventListener('change', () => { try { localStorage.setItem('fad-dadi3d', casella.checked ? '1' : '0'); } catch { /* ok */ } });
  }
}

// ---------------- barra in basso, menu, ripiego ----------------
let barra = null, menuBtn = null, espToggle = null;
let scheda = 'gruppo';
const PALLINI = { gruppo: () => (S.adv?.esPendenti || []).length > 0, mappa: () => !!S.adv?.tessere?.some(t => t.pending), dungeon: () => !!S.adv?.incontro && S.adv.incontro.stato !== 'finito' };
const TITOLI = { gruppo: 'Ci sono tiri esperienza da fare', mappa: 'C’è una stanza da posizionare sulla mappa', dungeon: 'Incontro in corso' };

export function vaiA(nome) {
  scheda = nome; document.body.dataset.scheda = nome; memo.set('fad-scheda', nome);
  barra?.querySelectorAll('button[data-scheda]').forEach(b => { const on = b.dataset.scheda === nome; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  chiudiMenu();
}
function chiudiMenu() { document.body.classList.remove('menu-aperto'); menuBtn?.setAttribute('aria-expanded', 'false'); }
function pallini() {
  if (!barra) return;
  for (const [k, f] of Object.entries(PALLINI)) {
    const b = barra.querySelector(`button[data-scheda=${k}]`); if (!b) continue;
    let on = false; try { on = f(); } catch { /* stato non ancora pronto */ }
    const p = b.querySelector('.pallino');
    if (on && !p) b.append(h('i', { class: 'pallino', title: TITOLI[k], 'aria-label': TITOLI[k] })); else if (!on && p) p.remove();
  }
}
const chiudiFuori = ev => { if (document.body.classList.contains('menu-aperto') && !ev.target.closest('.camp, #menuBtn')) chiudiMenu(); };

function monta() {
  if (barra) return;
  barra = h('nav', { id: 'barraSchede', 'aria-label': 'Schede' },
    SCHEDE.map(([k, t]) => h('button', { dataset: { scheda: k }, onclick: () => vaiA(k) }, icona(k), t)),
    h('button', { class: 'imp', title: 'Aspetto dei dadi e altre opzioni', onclick: () => $('#impostazioni')?.click() }, icona('impostazioni'), 'Impostazioni'));
  $('#layout').after(barra);
  menuBtn = h('button', { id: 'menuBtn', 'aria-label': 'Menu: campagna, qualità, cooperativa', 'aria-expanded': 'false', onclick: ev => { ev.stopPropagation(); const a = document.body.classList.toggle('menu-aperto'); menuBtn.setAttribute('aria-expanded', String(a)); } }, '⋯');
  $('#top').append(menuBtn);
  $$('.camp button').forEach(b => b.addEventListener('click', chiudiMenu));
  espToggle = h('button', { id: 'espToggle', title: 'Esporta la mappa o le schede', onclick: () => $('#stageTop').classList.toggle('esp-aperto') }, '⋯');
  $('#stageTop .seg').append(espToggle);
  // il banner di acquisto va in fondo alla scheda Gruppo, il registro dei tiri resta visibile in ogni scheda
  $('#left').append($('#banner')); document.body.append($('#rollLog'));
  document.addEventListener('click', chiudiFuori);
  vaiA(memo.get('fad-scheda') || 'gruppo'); pallini();
}
function smonta() {
  if (!barra) return;
  barra.remove(); menuBtn.remove(); espToggle.remove(); barra = menuBtn = espToggle = null;
  $('#stageTop')?.classList.remove('esp-aperto');
  $('#layout').after($('#banner')); $('#diceBar').after($('#rollLog'));
  document.removeEventListener('click', chiudiFuori);
  document.body.classList.remove('menu-aperto'); delete document.body.dataset.scheda;
}
function adatta() { if (MQ.matches) monta(); else smonta(); }
MQ.addEventListener('change', adatta);
// girando il telefono la mappa si riadatta al nuovo foglio visibile
const giro = () => { if (MQ.matches) setTimeout(() => table.setView('fit'), 350); };
matchMedia('(orientation: portrait)').addEventListener('change', giro);
onChange(pallini);

// ---------------- suggerimenti al tocco: sul desktop sono i title al passaggio del mouse ----------------
// Tocco su una sigla/etichetta con title: il testo compare in un avviso; pressione prolungata su un pulsante: idem (senza premerlo).
const INTERATTIVI = 'button, a, input, select, textarea, summary, option';
let timer = 0, lungo = false, p0 = null;
function suggerimenti() {
  const ferma = () => { clearTimeout(timer); timer = 0; };
  document.addEventListener('pointerdown', ev => {
    ferma(); lungo = false; if (!MQ.matches || ev.pointerType !== 'touch') return;
    const el = ev.target.closest?.('button[title], a[title], select[title], label[title]'); if (!el || el.closest('#diceLayer')) return;
    p0 = [ev.clientX, ev.clientY];
    timer = setTimeout(() => { lungo = true; toast(el.title); navigator.vibrate?.(15); }, 550);
  }, true);
  document.addEventListener('pointermove', ev => { if (timer && p0 && Math.hypot(ev.clientX - p0[0], ev.clientY - p0[1]) > 10) ferma(); }, true);
  ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, ferma, true));
  document.addEventListener('contextmenu', ev => { if (MQ.matches && (timer || lungo)) ev.preventDefault(); }, true);
  document.addEventListener('click', ev => {
    if (!MQ.matches) return;
    if (lungo) { lungo = false; ev.preventDefault(); ev.stopPropagation(); return; }   // la pressione lunga non deve anche premere il pulsante
    const t = ev.target.closest?.('[title]');
    if (t && !t.closest(INTERATTIVI) && !ev.target.closest(INTERATTIVI) && t.title) toast(t.title);
  }, true);
}

dadiSuTelefono(); suggerimenti(); adatta();
