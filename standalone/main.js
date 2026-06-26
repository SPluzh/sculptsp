const { app, BrowserWindow, ipcMain } = require('electron');
const windowStateKeeper = require('./electron-window-state');
const path = require('path');

var mainWindow;
var wintab = null;

function initWintab() {
  try {
    const arch = process.arch; // 'x64' or 'ia32'
    const addonName = `wintab-${arch}.node`;
    const addonPath = path.join(__dirname, addonName);
    console.log('[WinTab] Loading addon from: ' + addonPath);
    wintab = require(addonPath);
    console.log('[WinTab] Addon loaded successfully');

    const hwnd = mainWindow.getNativeWindowHandle(); // возвращает Buffer с HWND
    console.log('[WinTab] HWND Buffer length: ' + hwnd.length);
    const ok = wintab.initialize(hwnd);

    if (ok) {
      wintab.startPolling();
      startPushLoop();
      console.log('[WinTab] Initialized OK for arch ' + arch);
    } else {
      console.log('[WinTab] initialize() returned false (no tablet / context failure)');
      wintab = null;
    }
  } catch (e) {
    console.log('[WinTab] Addon load failed:', e.message);
    wintab = null;
  }
}

ipcMain.handle('wintab:isActive', () => wintab !== null);

let pushTimer = null;
let lastPressure = -1;
let lastPenDown = false;
let lastTiltX = -999;
let lastTiltY = -999;

function startPushLoop() {
  if (pushTimer) clearInterval(pushTimer);
  pushTimer = setInterval(() => {
    if (!wintab || !mainWindow) return;
    const data = wintab.getData();
    if (!data || !data.active) return;

    const changed = data.penDown !== lastPenDown ||
                    Math.abs(data.pressure - lastPressure) > 0.0005 ||
                    data.tiltX !== lastTiltX ||
                    data.tiltY !== lastTiltY;

    if (changed) {
      lastPressure = data.pressure;
      lastPenDown = data.penDown;
      lastTiltX = data.tiltX;
      lastTiltY = data.tiltY;
      mainWindow.webContents.send('wintab:data', data);
    }
  }, 2); // Poll and push every 2ms (~500Hz)
}


function createWindow() {
  let mainWindowState = windowStateKeeper({
    defaultWidth: 1366,
    defaultHeight: 768
  });

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.removeMenu();

  mainWindowState.manage(mainWindow);

  initWintab();

  mainWindow.loadURL(`file://${__dirname}/app/index.html`);

  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (wintab) {
    wintab.stopPolling();
    wintab.destroy();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
