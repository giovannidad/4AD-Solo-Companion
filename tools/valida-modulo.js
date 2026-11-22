#!/usr/bin/env node
// Controlla uno o più file di avventura scritta (formato «4ad-avventura», vedi docs/MODULI.md).
// Uso: node tools/valida-modulo.js file.json [altro.json …]      Esce con codice 1 se c'è almeno un errore.
// Controlla anche che i mostri presi dalle tabelle (campi «tabella» e «id») esistano nel set scelto dal modulo.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const regole = nome => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'rules', nome + '.json'), 'utf8'));
// il file modulo.js è un modulo ES del browser: lo si carica da testo, così funziona con qualunque versione di Node
async function caricaModulo() {
  const src = fs.readFileSync(path.join(ROOT, 'public', 'js', 'modulo.js'), 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
}
const FILE_SET = { diabolici: 'avanzate', caos: 'caos', abisso: 'abisso', aldila: 'aldila', profondita: 'profondita', acque: 'acque', coboldi: 'coboldi', silvani: 'silvani' };
const cache = {};
function cerca(set, tabella, id) {
  const base = (cache.base ||= regole('mostri'));
  const propri = FILE_SET[set] ? (cache[set] ||= regole(FILE_SET[set]).mostri || {}) : {};
  return [propri[tabella], base[tabella]].map(l => (Array.isArray(l) ? l.find(m => m.id === id) : null)).find(Boolean) || null;
}

(async () => {
  const files = process.argv.slice(2).filter(f => path.basename(f) !== 'campagne.json' && !f.endsWith('.schema.json'));   // l'elenco delle campagne incluse e lo schema non sono avventure
  if (!files.length) { console.error('Uso: node tools/valida-modulo.js file.json [altro.json …]'); process.exit(2); }
  const M = await caricaModulo();
  let ko = 0;
  for (const f of files) {
    let dati;
    try { dati = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`✗ ${f}\n   JSON non valido: ${e.message}`); ko++; continue; }
    const { errori, avvisi } = M.valida(dati, { cerca });
    console.log(`${errori.length ? '✗' : '✓'} ${f}${dati?.nome ? ` – «${dati.nome}»` : ''}${errori.length ? '' : ` (${dati.stanze.length} stanze)`}`);
    errori.forEach(t => console.log('   ERRORE:  ' + t));
    avvisi.forEach(t => console.log('   avviso:  ' + t));
    if (errori.length) ko++;
  }
  process.exit(ko ? 1 : 0);
})();
