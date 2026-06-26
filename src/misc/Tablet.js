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
  var isListening = false;

  function startPolling() {
    if (isListening) return;
    isListening = true;
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

  Tablet.applyApi = function () {
    if (Tablet.useWintab) {
      ipcRenderer.invoke('wintab:enable').then(function (active) {
        Tablet.isWintabActive = active;
        if (active) {
          console.log('[Tablet] WinTab enabled & active');
          startPolling();
        } else {
          console.log('[Tablet] WinTab enabled but inactive (no tablet device / failed context)');
        }
      }).catch(function (err) {
        console.error('[Tablet] Failed to enable Wintab:', err);
      });
    } else {
      ipcRenderer.invoke('wintab:disable').then(function () {
        Tablet.isWintabActive = false;
        console.log('[Tablet] WinTab disabled (using Windows Ink)');
      }).catch(function (err) {
        console.error('[Tablet] Failed to disable Wintab:', err);
      });
    }
  };

  // Инициализация при старте на основе сохраненного значения
  Tablet.applyApi();
};

Tablet.initWintab();

export default Tablet;
