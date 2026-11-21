#!/usr/bin/env node
// Scrive docs/MOSTRI-MODULI.md: i mostri delle tabelle che un'avventura scritta può richiamare con «tabella» e «id».
// Uso: node tools/elenco-mostri.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const regole = n => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'rules', n + '.json'), 'utf8'));
const SETS = [
  ['base', 'Four Against Darkness (livelli 1-2)', null],
  ['diabolici', 'Nemici diabolici (livelli 3-5)', 'avanzate'],
  ['caos', 'Contro il Caos (livelli 3-6)', 'caos'],
  ['acque', 'Acque Oscure (livelli 1-4)', 'acque'],
  ['coboldi', 'Schiavisti Coboldi (livelli 1-2)', 'coboldi'],
  ['abisso', 'Contro l\'Abisso (livelli 5-9)', 'abisso'],
  ['aldila', 'Orrori dall\'Aldilà (livelli 6-9)', 'aldila'],
  ['profondita', 'Contro le Profondità Dimenticate (livelli 10-19)', 'profondita']
];
let out = '# Mostri delle tabelle utilizzabili nei moduli\n\n'
  + 'File generato da `tools/elenco-mostri.js`: non modificarlo a mano. Per ogni set (campo `set` del modulo) sono elencate le voci che si possono richiamare con\n'
  + '`{"tipo": "mostri", "tabella": "…", "id": "…"}`. Le voci del manuale base («base») valgono sempre, anche negli altri set. «LIV» e «PV» sono quelli stampati\n'
  + 'nella tabella; per le voci con formule (livello del gruppo, grado) il gioco calcola i valori al momento della creazione.\n';
for (const [set, titolo, file] of SETS) {
  const tab = {};
  if (file) Object.assign(tab, regole(file).mostri || {});
  else Object.assign(tab, regole('mostri'));
  out += `\n## ${titolo}\n\n\`"set": "${set}"\`\n`;
  for (const [t, lista] of Object.entries(tab)) {
    if (!Array.isArray(lista) || !lista.length || !lista[0]?.id) continue;
    out += `\n**Tabella \`${t}\`**\n\n| id | nome | LIV | PV | numero |\n|---|---|---|---|---|\n`;
    for (const m of lista) out += `| \`${m.id}\` | ${String(m.nome).replace(/\|/g, '/')} | ${m.livFormula ? 'formula' : m.liv ?? ''} | ${m.pvFormula || m.pvMod !== undefined ? 'formula' : m.pv ?? ''} | ${m.speciale === 'scheletri-o-zombi' || m.varianti || m.sottotabella ? '(scelta interna: non utilizzabile, usa un mostro personalizzato)' : m.conta ?? ''} |\n`;
  }
}
fs.writeFileSync(path.join(ROOT, 'docs', 'MOSTRI-MODULI.md'), out);
console.log('docs/MOSTRI-MODULI.md scritto (' + out.length + ' caratteri)');
