# Modalità cooperativa online

Chi **ospita** esegue tutto il gioco (dungeon, mostri, dadi) e pubblica lo stato; gli **ospiti** vedono mappa, gruppo, incontro e registro in
tempo reale e comandano soltanto gli eroi che l'ospitante ha assegnato loro (attacco, incantesimi, oggetti con cariche, cure, benedizioni,
spostamento del segnalino, tiri di dado). Chat inclusa.

## Come si gioca
1. L'ospitante apre il gioco, sceglie la campagna e preme **Cooperativa → Avvia la stanza**: compaiono il codice e i link da inviare.
2. Gli ospiti aprono il link nel browser (`http://<indirizzo>:<porta>/?coop=CODICE`) oppure, dall'app, usano **Cooperativa → Unisciti**.
3. L'ospitante spunta, per ogni giocatore, gli eroi che deve guidare. Gli eroi non assegnati restano all'ospitante.
4. Le assegnazioni sono salvate nella campagna (`party.coopEroi`, per nome del giocatore): chi rientra con lo stesso nome ritrova i suoi eroi.

## Rete
- Quando si avvia la stanza il programma apre una **seconda porta**, **scelta dall'utente** nella finestra Cooperativa (da 1024 a 65535, predefinita 3001; se è occupata compare un errore), sulla rete locale. Serve solo i file del gioco e
  `/api/coop`: le campagne salvate non sono mai raggiungibili dalla rete. Il server principale resta su `127.0.0.1`.
- **LAN**: basta il link con l'indirizzo IP del computer ospitante.
- **Internet**: inoltra la porta del router verso il computer ospitante o usa un tunnel/VPN (Tailscale, ngrok, cloudflared…) e invia l'indirizzo
  risultante seguito da `/?coop=CODICE`. Chi conosce il codice può entrare: non condividerlo con sconosciuti.
- Il computer ospitante può chiedere al firewall di consentire le connessioni in ingresso.

## Limiti attuali
- Le stanze vivono in memoria: se l'ospitante chiude il gioco la stanza termina (gli ospiti vengono rimandati alla pagina iniziale).
- Gli ospiti non vedono i dadi 3D rotolare, ma ricevono ogni tiro nel registro dei dadi.
- Turno dei mostri, generazione delle stanze, bottino, negozio e schede sono dell'ospitante.
- Protocollo: Server-Sent Events + POST (nessuna dipendenza); il codice è in `coop.js` (server) e `public/js/coop.js` (client).
