# Changelog

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
