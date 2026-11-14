// App desktop: avvia il server locale e mostra il gioco in una finestra.
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(app.getPath('userData'), 'campagne');
fs.mkdirSync(dataDir, { recursive: true });
process.env.FAD_DATA = dataDir;
process.env.PORT = '0'; // porta libera scelta dal sistema

if (!app.requestSingleInstanceLock()) app.quit();

let win;
async function avvia() {
  const { server } = require(path.join(__dirname, '..', 'server.js'));
  if (!server.listening) await new Promise(r => server.once('listening', r));
  const port = server.address().port;
  win = new BrowserWindow({
    width: 1500, height: 920, minWidth: 1000, minHeight: 640, backgroundColor: '#120d09', title: 'Four Against Darkness', icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false, v8CacheOptions: 'bypassHeatCheck' }   // niente correttore ortografico; il codice JavaScript compilato viene messo in cache fin dal primo avvio
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.loadURL(`http://127.0.0.1:${port}/`);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'Apri cartella dei salvataggi', click: () => shell.openPath(dataDir) },
      { type: 'separator' }, process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }] },
    { role: 'editMenu' },
    { label: 'Vista', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }] }
  ]));
}
app.whenReady().then(avvia).catch(e => { dialog.showErrorBox('Errore', String(e)); app.quit(); });
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) avvia(); });
