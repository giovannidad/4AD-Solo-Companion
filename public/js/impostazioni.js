// Schermata Impostazioni: aspetto dei dadi (colore, spigoli smussati, ombre).
import { h, modal } from './util.js';
import * as dice from './dice.js';
import * as mappa from './map2d.js';

const NOMI = { avorio: 'Avorio', rosso: 'Rosso', blu: 'Blu', verde: 'Verde', nero: 'Nero', oro: 'Oro' };

export async function apriImpostazioni({ leggera } = {}) {
  const dadi3d = await import('./table3d.js');   // caricato solo se servono le opzioni dei dadi
  modal('Impostazioni', (b, close) => {
    const a = dadi3d.aspetto;
    if (leggera) b.append(h('p', { class: 'warn-box' }, 'La qualità «Leggera» disattiva i dadi 3D: scegli «Alta» in alto per usare queste opzioni.'));
    b.append(h('h4', {}, 'Mappa'));
    b.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: mappa.opzioni.snap, onchange: ev => mappa.setSnap(ev.target.checked) }), 'Snap to grid: le stanze si agganciano ai quadretti del foglio (tieni premuto Alt mentre trascini per muoverle liberamente)'));
    b.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: mappa.opzioni.assist, onchange: ev => mappa.setAssist(ev.target.checked) }), 'Posizionamento assistito: la nuova stanza si appoggia a una porta libera della precedente (frecce arancioni; clicca una freccia per scegliere un’altra uscita)'));
    b.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: mappa.opzioni.matita, onchange: ev => mappa.setMatita(ev.target.checked) }), 'Effetto scrittura a matita: le stanze vengono «disegnate» sul foglio (se disattivato compaiono subito)'));
    b.append(h('h4', {}, 'Dadi'));
    const sw = h('div', { class: 'swatches' });
    const rSw = () => {
      sw.replaceChildren(...Object.entries(dadi3d.COLORI_DADI).map(([k, c]) => h('button', {
        class: `swatch${a.colore === k ? ' on' : ''}`, title: NOMI[k] || k, style: `background:${c.bg};border-color:${c.edge};color:${c.pip}`,
        onclick: () => { dadi3d.setAspetto({ colore: k }); rSw(); }
      }, a.colore === k ? '✓' : '')));
      const pick = h('input', { type: 'color', value: a.custom, title: 'Colore personalizzato', oninput: ev => { dadi3d.setAspetto({ colore: 'custom', custom: ev.target.value }); } , onchange: () => rSw() });
      sw.append(h('label', { class: `swatch custom${a.colore === 'custom' ? ' on' : ''}`, title: 'Colore personalizzato' }, 'Altro', pick));
    };
    rSw();
    b.append(h('label', {}, 'Colore dei dadi'), sw);
    b.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: dice.settings.veloci, onchange: ev => dice.setVeloci(ev.target.checked) }), 'Tiri veloci: i dadi 3D rotolano solo per attacchi, difese, salvezze, incantesimi, nuove stanze e tiri liberi; gli altri tiri (numero di mostri, tabelle, morale…) sono immediati'));
    b.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: a.smussato, onchange: ev => dadi3d.setAspetto({ smussato: ev.target.checked }) }), 'Spigoli e angoli smussati'));
    b.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: a.distingui, onchange: ev => dadi3d.setAspetto({ distingui: ev.target.checked }) }), 'Distingui i dadi secondari (decine del d66, 2° dado) in rosso'));
    b.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: a.ombre, onchange: ev => dadi3d.setAspetto({ ombre: ev.target.checked }) }), 'Ombre dei dadi'));
    b.append(h('div', { class: 'row end' },
      h('button', { disabled: !!leggera, onclick: () => dice.tira('2d6', 'Prova dadi') }, 'Lancia due dadi di prova'),
      h('button', { class: 'primary', onclick: close }, 'Chiudi')));
  });
}
