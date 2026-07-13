import PanelContainer from './PanelContainer.js';

class VerticalToolbar {
  constructor(container, main) {
    this._main = main;
    this._activeId = null;
    this._panels = new Map();  // id → PanelContainer instance
    this._buttons = new Map(); // id → btnDom
    this._meshInfoDom = null;

    this._dom = this._buildToolbar();
    container.appendChild(this._dom);
  }

  _buildToolbar() {
    var bar = document.createElement('div');
    bar.className = 'vtoolbar';
    // Block hotkeys while mouse is over the toolbar
    bar.addEventListener('mouseenter', () => {
      if (this._main) this._main._focusGui = true;
    });
    bar.addEventListener('mouseleave', () => {
      if (this._main) this._main._focusGui = false;
    });
    return bar;
  }

  /**
   * Register a button on the toolbar.
   * @param {string}   id       — unique identifier
   * @param {string}   icon     — emoji or text icon
   * @param {string}   tooltip  — tooltip text
   * @param {Function} buildFn  — callback (panelContainer) to populate panel
   */
  addButton(id, icon, tooltip, buildFn) {
    var btn = document.createElement('div');
    btn.className = 'vtb-btn';
    btn.setAttribute('data-tooltip', tooltip);
    btn.innerHTML = icon;
    btn.addEventListener('click', () => {
      this._toggle(id, buildFn);
      // Return focus to document so hotkeys keep working
      btn.blur();
      if (document.activeElement && document.activeElement !== document.body)
        document.activeElement.blur();
    });
    this._buttons.set(id, btn);
    this._dom.appendChild(btn);
    return btn;
  }

  addSeparator() {
    var sep = document.createElement('div');
    sep.className = 'vtb-sep';
    this._dom.appendChild(sep);
  }

  /** Mesh info block at the bottom of the toolbar */
  getMeshInfoDom() {
    if (!this._meshInfoDom) {
      this._meshInfoDom = document.createElement('div');
      this._meshInfoDom.className = 'vtb-mesh-info';
      this._dom.appendChild(this._meshInfoDom);
    }
    return this._meshInfoDom;
  }

  registerPanel(id, panel) {
    this._panels.set(id, panel);
  }

  _toggle(id, buildFn) {
    if (this._activeId === id) {
      this._closeActive();
      return;
    }
    this._closeActive();

    var panel = this._panels.get(id);
    if (!panel) {
      panel = new PanelContainer(id, this._dom);
      if (buildFn) buildFn(panel);
      this._panels.set(id, panel);
    }
    panel.show();
    this._buttons.get(id).classList.add('active');
    this._activeId = id;
  }

  _closeActive() {
    if (this._activeId) {
      var activePanel = this._panels.get(this._activeId);
      if (activePanel) activePanel.hide();
      var activeBtn = this._buttons.get(this._activeId);
      if (activeBtn) activeBtn.classList.remove('active');
      this._activeId = null;
    }
  }

  setVisibility(bool) {
    this._dom.style.display = bool ? 'flex' : 'none';
    if (!bool) this._closeActive();
  }

  destroy() {
    this._closeActive();
    this._panels.forEach(p => p.destroy());
    this._panels.clear();
    this._buttons.clear();
    if (this._dom.parentNode) {
      this._dom.parentNode.removeChild(this._dom);
    }
  }
}

export default VerticalToolbar;
