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

// Запуск WinTab поллинга (Electron и Tauri)
Tablet.initWintab = function () {
  var isElectron = (typeof process !== 'undefined') &&
                   process.versions &&
                   process.versions.electron;
  var isTauri = (typeof window !== 'undefined') && window.__TAURI__ !== undefined;
  if (!isElectron && !isTauri) return;

  var ipcRenderer;
  if (isElectron) {
    try {
      ipcRenderer = window.require('electron').ipcRenderer;
    } catch (e) {
      return;
    }
  }

  var lastPenDown = false;
  var isListening = false;

  function startPolling() {
    if (isListening) return;
    isListening = true;

    if (isElectron) {
      ipcRenderer.on('wintab:data', function (event, data) {
        handleWintabData(data);
      });
    } else if (isTauri) {
      window.__TAURI__.event.listen('wintab:data', function (event) {
        handleWintabData(event.payload);
      });
    }
  }

  function handleWintabData(data) {
    if (!Tablet.useWintab) return;
    if (data && data.active) {
      Tablet.pressure = data.penDown ? data.pressure : 0.0;
      Tablet.tiltX    = data.tiltX;
      Tablet.tiltY    = data.tiltY;

      if (data.penDown !== lastPenDown || (data.penDown && data.pressure > 0.0)) {
        lastPenDown = data.penDown;
      }
    }
  }

  Tablet.applyApi = function () {
    if (Tablet.useWintab) {
      if (isElectron) {
        ipcRenderer.invoke('wintab:enable').then(function (active) {
          onEnabled(active);
        }).catch(function (err) {
          console.error('[Tablet] Failed to enable Wintab:', err);
        });
      } else if (isTauri) {
        window.__TAURI__.core.invoke('wintab_enable').then(function (active) {
          onEnabled(active);
        }).catch(function (err) {
          console.error('[Tablet] Failed to enable Wintab:', err);
        });
      }
    } else {
      if (isElectron) {
        ipcRenderer.invoke('wintab:disable').then(function () {
          onDisabled();
        }).catch(function (err) {
          console.error('[Tablet] Failed to disable Wintab:', err);
        });
      } else if (isTauri) {
        window.__TAURI__.core.invoke('wintab_disable').then(function () {
          onDisabled();
        }).catch(function (err) {
          console.error('[Tablet] Failed to disable Wintab:', err);
        });
      }
    }
  };

  function onEnabled(active) {
    Tablet.isWintabActive = active;
    if (active) {
      startPolling();
    }
  }

  function onDisabled() {
    Tablet.isWintabActive = false;
  }


  // Инициализация при старте на основе сохраненного значения
  Tablet.applyApi();
};

Tablet.initWintab();

export default Tablet;
