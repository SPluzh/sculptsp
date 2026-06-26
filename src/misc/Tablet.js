var Tablet = {
  radiusFactor: 0.0, // the pen pressure acts on the tool's radius
  intensityFactor: 1.0, // the pen pressure acts on the tool's intensity
  pressure: 0.5,
  tiltX: 0,
  tiltY: 0,
  isWintabActive: false,
  useWintab: typeof localStorage !== 'undefined' && localStorage.getItem('useWintab') !== null
    ? localStorage.getItem('useWintab') === 'true'
    : true
};

Tablet.getPressureIntensity = function () {
  return 1.0 + Tablet.intensityFactor * (Tablet.pressure * 2.0 - 1.0);
};

Tablet.getPressureRadius = function () {
  return 1.0 + Tablet.radiusFactor * (Tablet.pressure * 2.0 - 1.0);
};

// Запуск WinTab поллинга (только в Electron)
Tablet.initWintab = function () {
  // Проверяем окружение Electron
  var isElectron = (typeof process !== 'undefined') &&
                   process.versions &&
                   process.versions.electron;
  if (!isElectron) return;

  var ipcRenderer;
  try {
    ipcRenderer = window.require('electron').ipcRenderer;
  } catch (e) {
    return;
  }

  var lastPenDown = false;

  function checkWintabActive() {
    ipcRenderer.invoke('wintab:isActive').then(function (active) {
      if (active) {
        Tablet.isWintabActive = true;
        console.log('[Tablet] WinTab active — using native pressure');
        startPolling();
      } else {
        // Пробуем снова через 100ms
        setTimeout(checkWintabActive, 100);
      }
    }).catch(function (err) {
      console.error('[Tablet] Failed to check Wintab active status:', err);
    });
  }

  function startPolling() {
    ipcRenderer.on('wintab:data', function (event, data) {
      if (!Tablet.useWintab) return;
      if (data && data.active) {
        Tablet.pressure = data.penDown ? data.pressure : 0.0;
        Tablet.tiltX    = data.tiltX;
        Tablet.tiltY    = data.tiltY;

        if (data.penDown !== lastPenDown || (data.penDown && data.pressure > 0.0)) {
          console.log('[Tablet] Received data: pressure=' + data.pressure.toFixed(3) + ', penDown=' + data.penDown + ', tiltX=' + data.tiltX + ', tiltY=' + data.tiltY);
          lastPenDown = data.penDown;
        }
      }
    });
  }

  checkWintabActive();
};

Tablet.initWintab();

export default Tablet;
