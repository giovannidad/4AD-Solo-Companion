// Utilità comuni: DOM, numeri casuali, toast
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}

export const d6 = () => Math.floor(Math.random() * 6) + 1;
export const uid = () => Math.random().toString(36).slice(2, 9);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const sign = n => (n >= 0 ? `+${n}` : `${n}`);

export function toast(msg, kind = '') {
  let box = $('#toasts');
  if (!box) { box = h('div', { id: 'toasts' }); document.body.append(box); }
  const t = h('div', { class: `toast ${kind}` }, msg);
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3200);
}

/** Finestra modale semplice. Restituisce {close, body}. */
export function modal(title, build, opts = {}) {
  const body = h('div', { class: 'modal-body' });
  const box = h('div', { class: `modal ${opts.wide ? 'wide' : ''}` },
    h('div', { class: 'modal-head' }, h('h3', {}, title), h('button', { class: 'x', onclick: () => close(), 'aria-label': 'Chiudi' }, '×')), body);
  const back = h('div', { class: 'backdrop', onmousedown: e => { if (e.target === back) close(); } }, box);
  const onKey = e => { if (e.key === 'Escape') close(); };
  function close() { back.remove(); document.removeEventListener('keydown', onKey); opts.onClose?.(); }
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  build(body, close);
  return { close, body };
}

export const confirmBox = (msg) => new Promise(res => {
  modal('Conferma', (b, close) => {
    b.append(h('p', {}, msg), h('div', { class: 'row end' },
      h('button', { onclick: () => { res(false); close(); } }, 'Annulla'),
      h('button', { class: 'primary', onclick: () => { res(true); close(); } }, 'Conferma')));
  }, { onClose: () => res(false) });
});
