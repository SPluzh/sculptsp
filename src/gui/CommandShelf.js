import { createIcons, Undo2, Redo2, ChevronsUpDown, Sparkles, Square, Grid } from 'lucide';

/**
 * CommandShelf — горизонтальная панель избранных команд.
 *
 * Располагается под topbar (top: 40px), высота 32px.
 * Конфигурация сохраняется в localStorage под ключом 'sculptsp.shelf'.
 * Каждая кнопка выполняет команду через CommandRegistry.
 *
 * Использует CSS-классы `.command-shelf` и `.shelf-btn` из yagui.css.
 */

// ---------------------------------------------------------------------------
// CommandRegistry — диспетчер команд
// ---------------------------------------------------------------------------
class CommandRegistry {
  /**
   * Реестр команд.
   * Каждая запись: (main) => void
   * main — экземпляр SculptSP (главный контроллер приложения).
   */
  static commands = {
    'topology.subdivide': (main) => {
      var ctrl = main.getCtrlGui && main.getCtrlGui()._ctrlTopology;
      if (ctrl && ctrl.subdivide) ctrl.subdivide();
    },
    'topology.remesh': (main) => {
      var ctrl = main.getCtrlGui && main.getCtrlGui()._ctrlTopology;
      if (ctrl && ctrl.remesh) ctrl.remesh();
    },
    'topology.remeshMC': (main) => {
      var ctrl = main.getCtrlGui && main.getCtrlGui()._ctrlTopology;
      if (ctrl && ctrl.remeshMC) ctrl.remeshMC();
    },
    'states.undo': (main) => {
      if (main.getStateManager) main.getStateManager().undo();
      if (main.render) main.render();
    },
    'states.redo': (main) => {
      if (main.getStateManager) main.getStateManager().redo();
      if (main.render) main.render();
    },
    'rendering.toggleFlat': (main) => {
      var gui = main.getCtrlGui && main.getCtrlGui();
      if (!gui) return;
      var rendering = gui._ctrlRendering;
      if (rendering && rendering._ctrlFlat) {
        var newVal = !rendering._ctrlFlat.getValue();
        rendering._ctrlFlat.setValue(newVal);
      }
    },
    'rendering.toggleWireframe': (main) => {
      var gui = main.getCtrlGui && main.getCtrlGui();
      if (!gui) return;
      var rendering = gui._ctrlRendering;
      if (rendering && rendering._ctrlWireframe) {
        var newVal = !rendering._ctrlWireframe.getValue();
        rendering._ctrlWireframe.setValue(newVal);
      }
    },
  };

  static execute(id, main) {
    var cmd = this.commands[id];
    if (cmd) {
      try {
        cmd(main);
      } catch (e) {
        console.warn('[CommandShelf] Command "' + id + '" failed:', e);
      }
    } else {
      console.warn('[CommandShelf] Unknown command:', id);
    }
  }
}

// ---------------------------------------------------------------------------
// CommandShelf — UI-компонент
// ---------------------------------------------------------------------------

/** @type {Array<{id: string, label: string, icon: string, action: string}>} */
var DEFAULT_SHELF = [
  { id: 'undo',      label: 'Undo',    icon: 'undo-2',            action: 'states.undo' },
  { id: 'redo',      label: 'Redo',    icon: 'redo-2',            action: 'states.redo' },
  { id: 'subdivide', label: 'Subdiv',  icon: 'chevrons-up-down',  action: 'topology.subdivide' },
  { id: 'remesh',    label: 'Remesh',  icon: 'sparkles',          action: 'topology.remesh' },
  { id: 'flat',      label: 'Flat',    icon: 'square',            action: 'rendering.toggleFlat' },
  { id: 'wire',      label: 'Wire',    icon: 'grid',              action: 'rendering.toggleWireframe' },
];

var STORAGE_KEY = 'sculptsp.shelf';

class CommandShelf {
  /**
   * @param {HTMLElement} container — родительский элемент (обычно viewport или body)
   * @param {object}      main      — ссылка на главный контроллер SculptSP
   */
  constructor(container, main) {
    this._main = main;
    this._items = this._loadItems();
    this._dom = null;
    this._build(container);
  }

  // ---- public ----

  /** Удалить панель из DOM */
  destroy() {
    if (this._dom && this._dom.parentNode) {
      this._dom.parentNode.removeChild(this._dom);
    }
    this._dom = null;
  }

  // ---- private ----

  _loadItems() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return DEFAULT_SHELF.slice();
  }

  _saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._items));
    } catch (e) { /* ignore */ }
  }

  _build(container) {
    var shelf = this._dom = document.createElement('div');
    shelf.className = 'command-shelf';

    this._items.forEach(item => this._addButton(shelf, item));

    container.appendChild(shelf);

    createIcons({
      icons: {
        Undo2,
        Redo2,
        ChevronsUpDown,
        Sparkles,
        Square,
        Grid
      },
      root: shelf
    });
  }

  _addButton(shelf, item) {
    var btn = document.createElement('button');
    btn.className = 'shelf-btn';
    btn.title = item.label;
    btn.setAttribute('data-shelf-id', item.id);

    var iconMap = {
      'undo': 'undo-2',
      'redo': 'redo-2',
      'subdivide': 'chevrons-up-down',
      'remesh': 'sparkles',
      'flat': 'square',
      'wire': 'grid'
    };
    var iconName = iconMap[item.id] || 'help-circle';

    var icon = document.createElement('span');
    icon.innerHTML = `<i data-lucide="${iconName}"></i>`;
    icon.style.fontSize = '14px';
    icon.style.lineHeight = '1';

    var text = document.createElement('span');
    text.textContent = item.label;

    btn.appendChild(icon);
    btn.appendChild(text);

    btn.addEventListener('click', () => {
      CommandRegistry.execute(item.action, this._main);
    });

    shelf.appendChild(btn);
    return btn;
  }
}

export { CommandRegistry };
export default CommandShelf;
