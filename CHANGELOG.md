# Changelog

## 1.8.0
- **Arlecchino:** fino a 3 attacchi in mischia per turno con 2-3 armi leggere o a una mano (prima il turno finiva dopo il primo); mezzo livello solo con una sola arma.
- **Trappole e fantasmi:** finestra di scelta (disarmare, far scattare, risolvere a mano; il chierico scaccia il fantasma) per trappole, evento Fantasma e complicazioni del tesoro nascosto.
- **Negozio:** si può pagare con l'oro del gruppo (poi le gemme); gli elfi del fuoco non condividono l'oro.
- **Riposo:** stanze vuote o ripulite evidenziate in verde sulla mappa e nell'elenco; conferma se si riposa altrove.
- **Spostamenti:** muovendo gruppo o eroi fra stanze visitate si tira 1d6 per stanza (1 = mostri erranti) e si riprendono gli scontri sospesi.
- **Esporta mappa** in PNG o PDF; **nomi evocativi** per i dungeon; il pulsante «Boss ucciso e uscita dal dungeon» si attiva solo dopo aver sconfitto il boss finale.
- **Azioni di classe** negli Strumenti (disattiva trappola, scassina, travestimento, fiuta il tesoro), spente se manca la classe adatta.
- **Numero della stanza** sempre al centro della stanza (l'ingresso nel primo quadretto bianco).

## 1.7.3
- **Banner fisso in basso** che invita ad acquistare i manuali di Four Against Darkness (link Amazon dell'autore).

## 1.7.2
- **Prestazioni:** ridisegno a parti (gruppo, pannello, segnalini solo se il loro stato è cambiato); server con cache in memoria, ETag/304,
  compressione brotli/gzip e cache lunga per immagini e librerie; three.js e cannon-es caricati in differita; cooperativa a differenze
  (solo i pezzi di stato cambiati) e correzione degli ascoltatori doppi.
- **Mappa:** foglio quadrettato disegnato con pochi comandi (≈10 volte più veloce), segnalini prerenderizzati, livelli di risoluzione per le tessere.
- **Tiri veloci** (Impostazioni, attivi di default): i dadi 3D rotolano solo per attacchi, difese, salvezze, incantesimi, nuove stanze e tiri liberi.
- **Cooperativa:** la porta di rete la sceglie l'utente (errore chiaro se è occupata).
- **Ritratti degli eroi:** ritratto predefinito per classe (SVG) o immagine caricata dall'utente (ritagliata e ridotta nel browser, salvata in `ritratti.json`); compare su schede, righe di combattimento, segnalini della mappa e in cooperativa.
- **Impostazioni:** ombra dei dadi spenta di default, bordi smussati di default, nuova opzione «effetto scrittura a matita» (attiva di default).

## 1.7.1
- **Cooperativa:** la scheda mostra l'IP pubblico della macchina che ospita, con il link da condividere (serve l'inoltro della porta sul router o un tunnel).

## 1.7.0
- **Poteri dei mostri avanzati automatici:** nani posseduti (si rialzano), doppelganger (smarrimento e imitazione), manto predatore (caduta, avvolti),
  spettro (lanterne, risucchio, solo armi magiche), grosso troll e troll (rigenerazione, fuoco, a pezzi), demone scheletrico (scheletri dal sangue),
  gremlin del caos (sfortuna), manticora (artigli/morso/pungiglione e coda), mutante tentacolato (oggetti afferrati), leader dei seguaci del caos.
- **Posizionamento assistito:** le tessere conoscono le loro uscite (porte e bracci aperti); la nuova stanza si appoggia a una porta libera,
  porta contro porta, con frecce per scegliere l'uscita e pulsanti per le posizioni alternative (opzione in Impostazioni).
- **Modalità cooperativa online** (vedi `docs/COOPERATIVA.md`): un giocatore ospita, gli altri guidano i propri eroi dal browser; chat inclusa.
- **Gruppo casuale:** classi estratte a caso e nomi sempre diversi nel gruppo (anche creando o rinominando gli eroi).

## 1.6.0
- **Tessere vettoriali** ricavate dal manuale: le 36 stanze e i 6 ingressi sono SVG, si adattano alla dimensione e alla griglia del foglio.
- **Snap to grid** opzionale (Impostazioni); Alt mentre trascini per spostare liberamente. Le stanze si affiancano a pavimento contro pavimento.
- **Traguardi** con conteggio automatico (uccisioni, salvezze, bottino, missioni, avventure).

## 1.5.1
- **Combattimento:** i tasti non vengono più attenuati per errore; chi ha già agito nel turno ha i tasti spenti e, se li preme, riceve l'avviso che ha terminato gli attacchi.
- **Oggetti con cariche:** bacchette, bastoni e pergamene trovati nel dungeon si equipaggiano con le loro cariche e si lanciano dal combattimento.
- **Negozio:** vendita di gemme, armi e oggetti; le gemme valgono come moneta negli acquisti.
- **Dadi:** spigoli smussati; nuova schermata **Impostazioni** (colore dei dadi, smussatura, ombre).

## 1.5.0
- **Tabelle avanzate «Nemici diabolici»** e **«Caverne del Caos»** del supplemento «Contro il Caos»; al 3° livello di tutto il
  gruppo l'app chiede quali tabelle usare (selettore nel pannello *Dungeon*).
- **Caverne del Caos:** 6 missioni, contenuti, trappole, eventi unici, tesori, mostri, «Toccato dal caos», follia, incantesimi del caos.
- **Supplemento (opzionale):** 6 nuovi incantesimi (d12), 5 nuove classi, 6 nuove armi, tratti e traguardi.

## 1.4.1
- **Barbaro:** la spunta «Furioso» si azzera dopo ogni attacco e non resta attiva a usi esauriti.

## 1.4.0
- **Prestazioni:** i dadi 3D si disegnano solo mentre rotolano (a riposo 0 fotogrammi); ombre più leggere; la mappa non
  disegna le tessere fuori schermo e non usa più ombre sfocate per il foglio.
- **Qualità «Leggera»:** interruttore in alto (attivo da solo su computer con 2 core o 2 GB di RAM): niente dadi 3D, ombre
  né animazione a matita.
- **Peso:** tessere in WebP (da 9,1 a 1,2 MB), three.js minificata; pacchetti più piccoli di circa 7 MB.
- I salvataggi vecchi continuano a funzionare.

## 1.3.0
- **Nuove tessere:** al posto di quelle del manuale ora si usano le tessere a colori in pietra di `tiles-base.pdf`, abbinate
  alle 36 del d66 e ai 6 ingressi (vedi `docs/ASSET.md` e `docs/confronto-tessere.png`).

## 1.2.0
- **Foglio quadrettato espandibile:** parte da 20×28 quadretti e cresce in tutte le direzioni insieme al dungeon;
  il posizionamento automatico delle stanze non è più limitato al foglio e «Adatta» inquadra tutto.
- **Pannello Incontro:** chi agisce per primo (gruppo o mostri) sta in cima al quadrante di destra.

## 1.1.0
- **Perquisire una stanza vuota** ora segue davvero la tabella: si tira il d6 (−1 nei corridoi), si mostra l'esito
  in una finestra e se ne applicano gli effetti: 1 = arrivano i mostri erranti, 2-4 = stanza vuota,
  5-6 = scegli porta segreta, tesoro nascosto o indizio.
- Il mezzuomo può ritirare la perquisizione spendendo un punto fortuna.
- Pulsante «Perquisisci la stanza attuale» ben visibile nella scheda Dungeon.
- Mappa: tolto l'aggancio alla griglia; le stanze si posizionano liberamente.

## 1.0.0
- Primo rilascio: gruppo, mappa 2D con effetto matita, segnalini, dadi 3D, tabelle e combattimento, app Electron.
