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

## Modalità locale (PWA, senza server)

- `public/js/api.js` ha due implementazioni con la stessa interfaccia: **server** (rotte `/api/campagne`) e **locale** (IndexedDB `4ad-companion`,
  un record per campagna con gli stessi identificatori e gli stessi testi dei file: `party`, `avventura`, `registro`, `ritratti`).
  `inizializzaApi()` (chiamata in `main.js`) sceglie: se `/api/campagne` risponde con un elenco JSON si usa il server, altrimenti IndexedDB.
  `?locale=1` forza la modalità locale. In locale: `navigator.storage.persist()`, pulsanti Esporta/Importa campagna nelle Impostazioni
  (file JSON `{formato:'4ad-campagna', …}`; l'importazione crea sempre una nuova campagna), pulsante Cooperativa disattivato.
- `public/sw.js` + `public/js/pwa.js`: il service worker è registrato SOLO in modalità locale; in modalità server viene rimosso (con le sue cache `4ad-*`)
  se presente. Cache `4ad-<versione>-<impronta>`, risposta dalla cache con aggiornamento in background; una nuova versione resta in attesa e
  compare l'avviso «Aggiornamento disponibile, ricarica». Non intercetta mai `/api/`.
- `tools/prepara-statico.js [cartella]` crea la cartella da pubblicare (public/ + `assets/` + `rules/`), scrive `versione.json` (da `package.json`),
  `elenco-file.json` (file da mettere in cache) e inserisce l'impronta in `sw.js`. Senza questo passaggio il service worker funziona lo stesso,
  ma mette in cache solo i file indispensabili e quelli usati man mano.
- Percorsi relativi alla pagina (`css/`, `js/`, `vendor/`, `assets/`, `rules/`, `versione.json`), quindi l'app può stare in una sottocartella.
  Il percorso delle tessere salvate in `avventura.json` è ora `assets/…` (i vecchi salvataggi `/assets/…` vengono convertiti al caricamento).
  Restano assoluti solo `/api/…` (esistono solo col server).
- Limiti: i dati stanno nella memoria del browser (cancellabile); nessuna cooperativa; niente sincronizzazione tra dispositivi.
- Pubblicazione: il sito sta su GitHub Pages dal ramo `gh-pages` (contenuto di `web-statico/`, indirizzo `https://giovannidad.github.io/4AD-Solo-Companion/`). Va aggiornato a ogni release: ricreare `web-statico/` con `prepara-statico.js` e fare un push forzato di quella cartella sul ramo `gh-pages` (un commit orfano, con un file `.nojekyll`).
- Prova: `node server.js` e aprire `http://localhost:3000/?locale=1`; oppure `node tools/prepara-statico.js /tmp/web` e servire la cartella con un server statico qualsiasi.

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
| `modulo.js` | avventure scritte: formato del file, validazione e disegno SVG delle stanze (nessuna dipendenza dal DOM; lo usa anche `tools/valida-modulo.js`) |
| `modulo-gioco.js` | avventure scritte nel gioco: presentazione e avvio, porte, porte segrete, esecuzione del contenuto delle stanze |
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

## Avventure scritte

`iniziaAvventura(modulo)` salta la scelta del set e il tiro d'ingresso e chiama `modulo-gioco.avviaModulo`. Lo stato è in `avventura.json → modulo` (`{def, off, visitate[], rivelate[]}`: il modulo
intero, lo scostamento sul foglio, le stanze visitate e le porte segrete scoperte). Ogni stanza è una tessera normale con in più `stanzaModulo` (id nel modulo) e `geom` (celle e porte nello
stesso formato di `tiles.json`, che `map2d.metaDi` preferisce); l'immagine è un SVG incorporato (`data:`) generato da `modulo.costruisciTessera`. Entrare in una stanza passa per
`confermaStanza(t, corridoio, generatore)` con il contenuto del modulo al posto del tiro 2d6, così restano attivi tutti i controlli dei supplementi (`K/A/P/V.dopoStanza`).
`nuovaStanza` (d66) è disattivata durante un'avventura scritta. Il formato è in [MODULI.md](MODULI.md).

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

## Prestazioni e qualità

- `table3d.js` non ha un ciclo di animazione fisso: parte con un lancio e si ferma quando i dadi sono addormentati.
  Il contatore `stats.frames` permette di misurare il carico.
- `map2d.js` ridisegna solo su richiesta (`invalidate`), salta le tessere fuori schermo e, con `qualita.leggera`, evita ombre sfocate e animazione.
- Modalità **Leggera** (`localStorage` → `fad-qualita`): non crea il livello WebGL e usa tiri virtuali. Si attiva da sola se
  `navigator.hardwareConcurrency <= 2` o `deviceMemory <= 2`.

## Pacchetti per Mac (firma)

`package.json → build.mac`: `identity: "-"` firma l'app in modo *ad-hoc* (senza certificato). Con `identity: null` la firma non viene rifatta e, su
Apple Silicon, resta quella originale di Electron, ormai non valida per il pacchetto modificato: macOS risponde «l'app è danneggiata». Verifica:
`codesign --verify --deep --strict "dist/mac-arm64/Four Against Darkness.app"` (deve terminare senza errori). I due `.dmg` (x64 e arm64)
sono separati; la notarizzazione Apple richiederebbe un account sviluppatore a pagamento.
