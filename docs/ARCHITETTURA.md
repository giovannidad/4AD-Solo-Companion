# Architettura

## Panoramica

```
Browser / Electron  ──HTTP──▶  server.js  ──▶  data/campagne/<id>/{party.json, avventura.json, registro.txt}
   public/ (ES modules)                    └──▶  data/rules/*.json  (sola lettura)
```

- **Nessun bundler e nessun framework.** Il frontend è JavaScript in moduli ES, caricati con un `importmap`
  (three.js e cannon-es sono copiati in `public/vendor/`).
- **Server (`server.js`)**: solo moduli standard di Node. Espone:
  - `GET/POST /api/campagne`, `DELETE /api/campagne/:id`
  - `GET/PUT /api/campagne/:id/{party|avventura|registro}`, `POST …/registro` (aggiunge una riga)
  - file statici da `public/`, `/assets/…` e `/rules/…`
  Scrive con file temporaneo + rename (atomico). I nomi dei file ammessi sono una lista fissa.
- **Variabile `FAD_DATA`**: cartella delle campagne (usata da Electron per salvare nella cartella dati dell'utente).
- **Electron (`electron/main.js`)**: avvia il server su una porta libera e apre una finestra.

## Moduli frontend

| Modulo | Responsabilità |
|---|---|
| `state.js` | stato globale (`S.party`, `S.adv`), regole caricate (`R`), salvataggio con ritardo, registro |
| `dice.js` | espressioni (`2d6+1`, `3d6x3d6`, `d66`), 6 esplosivo, "migliore di N"; usa i dadi fisici o un ripiego virtuale |
| `table3d.js` | scena three.js trasparente sopra la mappa + fisica cannon-es; legge la faccia superiore |
| `map2d.js` | canvas 2D: foglio, tessere, effetto matita, segnalini, pan/zoom, trascinamento |
| `rules.js` | modificatori di attacco/difesa, creazione incontri, helper sulle tabelle |
| `game.js` | avventura, tessere, contenuto stanze, tesori, perquisire, esperienza, indizi |
| `combat.js` | reazioni, attacchi, incantesimi, difese, morale, ritirata, bottino |
| `party.js` | scheda eroe, creazione, negozio, riposo |
| `ui.js` | pannelli Dungeon / Incontro / Strumenti / Registro |
| `main.js` | avvio, campagne, barra dadi, segnalini |

## Modello dati

- **Eroe** (`party.json → eroi[]`): `id, nome, classe, livello, pv, pvMax, oro, armi[], armaPrincipale, armatura, scudo,
  lanterna, oggetti[], incantesimi[{nome, usato}], usi{…}, indizi, stato (ok|pietra|morto), posizione (id tessera)`.
- **Avventura** (`avventura.json`): `attiva, numero, stanze, tessere[], stanzaCorrente, incontro, coda[],
  maggioriSconfitti, incontriSeguaci, esPendenti[], bottino[]`.
- **Tessera**: `id, tipo (ingresso|stanza), n, src, w, h (px), cx, cy, ox, oy (griglia misurata), x, z (centro in quadretti),
  rot (0-3), flip, scale, pending, corridoio, idx, contenuto{testo, vuota}, perquisita`.
- **Incontro**: creato da `rules.creaIncontro`; contiene livello, PV, numero di mostri, reazioni, stato
  (`nuovo → combattimento → finito`) e la cronaca.

## Mappa

Le immagini hanno una griglia propria, misurata in `data/rules/tiles.json` (`cx, cy` = pixel per quadretto
sui due assi, `ox, oy` = scostamento della prima linea). Il disegno scala ogni asse in modo che il quadretto
dell'immagine coincida con quello del foglio. **Non c'è aggancio alla griglia**: si posiziona liberamente;
il posizionamento automatico (`autoPlace`) mette la stanza a contatto con quella attuale, nel primo spazio libero.

L'effetto matita rivela l'immagine con un tratto a zig-zag (maschera `destination-in`) e disegna una matita
alla punta del tratto.

## Aggiungere o modificare contenuti

- Nuovi mostri/tabelle: modifica `data/rules/mostri.json` e `tabelle.json` (nessun codice da toccare per i casi comuni).
- Reazioni dei mostri: `[da, a, azione, parametro?, "totale"?]` con azioni `fugge, fugge-inf, corruzione, combatte, morte,
  combatte-sempre, dorme, missione`.
- Effetti speciali per singolo mostro (veleno, soffi, sguardi…): `combat.js` (`inizioScontro`, `effettoFerita`, `eseguiDifese`).
