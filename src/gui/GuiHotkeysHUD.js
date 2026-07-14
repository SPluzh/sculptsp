import TR from './GuiTR.js';

class GuiHotkeysHUD {

  constructor(guiParent, ctrlGui) {
    this._main = ctrlGui._main; // main application
    this.domContainer = null;
    this.init(guiParent);
  }

  init(guiParent) {
    this.domContainer = document.createElement('div');
    this.domContainer.className = 'viewport-hud-hotkeys';

    var title = document.createElement('div');
    title.className = 'viewport-hud-hotkeys-title';
    title.textContent = TR('hudHotkeysTitle');
    this.domContainer.appendChild(title);

    var hotkeys = [
      { key: 'q', descKey: 'hudMoveTool' },
      { key: 'w', descKey: 'hudClayBuildup' },
      { key: 'e', descKey: 'hudCrease' },
      { key: 'r', descKey: 'hudPinch' },
      { key: 'a', descKey: 'hudBrushIntensity' },
      { key: 's', descKey: 'hudBrushSize' },
      { key: 'x', descKey: 'hudRemeshResolution' },
      { key: 'ctrl + x', descKey: 'hudQuadVoxelRemesh' }
    ];

    hotkeys.forEach((item) => {
      var row = document.createElement('div');
      row.className = 'viewport-hud-hotkeys-row';

      var keySpan = document.createElement('span');
      keySpan.className = 'viewport-hud-hotkeys-key';
      keySpan.textContent = item.key;

      var descSpan = document.createElement('span');
      descSpan.className = 'viewport-hud-hotkeys-desc';
      descSpan.textContent = TR(item.descKey);

      row.appendChild(keySpan);
      row.appendChild(descSpan);
      this.domContainer.appendChild(row);
    });

    guiParent.appendChild(this.domContainer);
  }
}

export default GuiHotkeysHUD;
