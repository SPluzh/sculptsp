import TR from './GuiTR.js';
import Tablet from '../misc/Tablet.js';

class GuiTablet {

  constructor(guiParent) {
    this._menu = null; // ui menu
    this._liveTitle = null; // diagnostic status title
    this.init(guiParent);
  }

  init(guiParent) {
    // Pen tablet ui stuffs
    var menu = this._menu = guiParent.addMenu(TR('pressureTitle'));

    var isElectron = (typeof process !== 'undefined') &&
                     process.versions &&
                     process.versions.electron;
    var isTauri = (typeof window !== 'undefined') && window.__TAURI__ !== undefined;
    if (isElectron || isTauri) {
      menu.addTitle(TR('pressureInput'));
      var optionsApi = [];
      optionsApi[0] = TR('pressureInputWindowsInk');
      optionsApi[1] = TR('pressureInputWintab');
      menu.addCombobox('', Tablet.useWintab ? 1 : 0, this.onApiChange.bind(this), optionsApi);

      this._liveTitle = menu.addTitle('');
      this.updateDiagnostics();
      setInterval(this.updateDiagnostics.bind(this), 100);
    }

    menu.addTitle(TR('pressureRadius'));
    menu.addSlider('', Tablet, 'radiusFactor', 0, 1, 0.01);

    menu.addTitle(TR('pressureIntensity'));
    menu.addSlider('', Tablet, 'intensityFactor', 0, 1, 0.01);
  }

  updateDiagnostics() {
    if (!this._liveTitle) return;

    var statusStr = '';
    if (Tablet.useWintab) {
      if (Tablet.isWintabActive) {
        statusStr = TR('pressureStatusWinTabActive');
      } else {
        statusStr = TR('pressureStatusWinTabInactive');
      }
    } else {
      statusStr = TR('pressureStatusWindowsInk');
    }

    var pressureVal = Tablet.pressure || 0.0;
    var barLength = Math.round(pressureVal * 15);
    var barStr = '[' + '='.repeat(barLength) + ' '.repeat(15 - barLength) + ']';

    this._liveTitle.setText(statusStr + '<br>' + TR('pressureLivePressure') + (pressureVal * 100).toFixed(0) + '% ' + barStr);
  }

  onApiChange(value) {
    Tablet.useWintab = (value === 1);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('useWintab', Tablet.useWintab ? 'true' : 'false');
    }
    if (typeof Tablet.applyApi === 'function') {
      Tablet.applyApi();
    }
  }
}

export default GuiTablet;
