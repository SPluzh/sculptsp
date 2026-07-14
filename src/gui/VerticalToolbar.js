import PanelContainer from './PanelContainer.js';
import {
  createIcons,
  Brush, Wind, RotateCw, Waves, ChevronsDownUp, Shrink, PenLine, Move, Paintbrush, Hand, Shield, Expand, Grid, Layers, CircleDot, Network, Ruler, Activity, Spline, Scissors
} from 'lucide';

const toolIcons = {
  Brush, Wind, RotateCw, Waves, ChevronsDownUp, Shrink, PenLine, Move, Paintbrush, Hand, Shield, Expand, Grid, Layers, CircleDot, Network, Ruler, Activity, Spline, Scissors
};

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
    var btn = this._buttons.get(id);
    if (btn) btn.classList.add('active');
    if (id === 'sculpting' && this._activeToolBtn) {
      this._activeToolBtn.classList.add('active');
    }
    this._activeId = id;
  }

  _closeActive() {
    if (this._activeId) {
      var activePanel = this._panels.get(this._activeId);
      if (activePanel) activePanel.hide();
      var activeBtn = this._buttons.get(this._activeId);
      if (activeBtn) activeBtn.classList.remove('active');
      if (this._activeId === 'sculpting' && this._activeToolBtn) {
        this._activeToolBtn.classList.remove('active');
      }
      this._activeId = null;
    }
  }

  addActiveToolButton(id) {
    var btn = document.createElement('div');
    btn.className = 'vtb-btn vtb-btn--active-tool';
    btn.setAttribute('data-tooltip', 'Active Tool');
    btn.innerHTML = '<i data-lucide="brush"></i>';
    btn.addEventListener('click', () => {
      this._toggle(id, null);
      btn.blur();
      if (document.activeElement && document.activeElement !== document.body)
        document.activeElement.blur();
    });
    this._activeToolBtn = btn;
    this._dom.insertBefore(btn, this._dom.firstChild);
    
    var sep = document.createElement('div');
    sep.className = 'vtb-sep';
    this._dom.insertBefore(sep, btn.nextSibling);
    
    return btn;
  }

  setActiveToolIcon(iconName) {
    if (!this._activeToolBtn || !iconName) return;
    const kebabName = iconName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    this._activeToolBtn.innerHTML = `<i data-lucide="${kebabName}"></i>`;
    const iconObj = toolIcons[iconName];
    if (iconObj) {
      createIcons({
        icons: { [iconName]: iconObj },
        root: this._activeToolBtn
      });
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
