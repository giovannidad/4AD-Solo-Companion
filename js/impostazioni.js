// Schermata Impostazioni: aspetto dei dadi (colore, spigoli smussati, ombre).
import { h, modal, toast } from './util.js';
import * as dice from './dice.js';
import * as mappa from './map2d.js';
import { api } from './api.js';
import { S } from './state.js';

// Copia di sicurezza (solo modalità locale): la memoria del browser può essere cancellata (pulizia dei dati, poco spazio, disinstallazione).
async function esportaCampagna() {
  await new Promise(r => setTimeout(r, 400));   // lascia finire il salvataggio ritardato
  const f = await api.esporta(S.camp);
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(f, null, 1)], { type: 'application/json' })), download: `campagna-${f.id}.json` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function importaCampagna() {
  const inp = h('input', { type: 'file', accept: '.json,application/json', onchange: async () => {
    try {
      const nuova = await api.importa(JSON.parse(await inp.files[0].text()));
      toast(`Campagna «${nuova.nome}» importata come nuova campagna.`);
      document.dispatchEvent(new CustomEvent('campagne-cambiate', { detail: nuova.id }));
    } catch (e) { toast(e.message || 'File non valido', 'warn'); }
  } });
  inp.click();
}

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
    b.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: mappa.nebbia.attiva, onchange: ev => mappa.setNebbia(ev.target.checked) }), 'Nebbia di guerra: la mappa è scura tranne attorno ai personaggi; chi porta la lanterna illumina di più.'));
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
    if (api.modalita === 'locale') {
      b.append(h('h4', {}, 'Campagne su questo dispositivo'),
        h('p', { class: 'warn-box' }, 'Le campagne sono salvate solo nella memoria di questo browser: se i dati del sito vengono cancellati (o l’app viene disinstallata) si perdono, e non passano da un dispositivo all’altro. Fai ogni tanto una copia con «Esporta campagna».'),
        h('div', { class: 'row' },
          h('button', { onclick: () => esportaCampagna().catch(e => toast(e.message, 'warn')) }, 'Esporta campagna'),
          h('button', { onclick: importaCampagna }, 'Importa campagna')));
    }
    const ver = h('p', { class: 'hint' }, 'Versione: …');
    b.append(h('h4', {}, 'Informazioni'), ver);
    fetch('versione.json', { cache: 'no-store' }).then(r => r.json()).then(v => { ver.textContent = v.versione ? `Versione ${v.versione}${v.build ? ` (build ${v.build})` : ''}` : 'Versione non disponibile'; }).catch(() => { ver.textContent = 'Versione non disponibile'; });
    b.append(h('div', { class: 'row end' },
      h('button', { disabled: !!leggera, onclick: () => dice.tira('2d6', 'Prova dadi') }, 'Lancia due dadi di prova'),
      h('button', { class: 'primary', onclick: close }, 'Chiudi')));
  });
}
