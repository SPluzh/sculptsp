import yagui from './ui/UIAdapter.js';

class PanelContainer {
  constructor(id, toolbarDom) {
    this.id = id;
    this._toolbarDom = toolbarDom;
    this._main = null; // set later via setMain()

    // Outer custom floating panel container
    this._dom = document.createElement('div');
    this._dom.className = 'vtoolbar-panel';
    this._dom.style.display = 'none';
    document.body.appendChild(this._dom);

    // Track mouse over panel to update _focusGui
    this._dom.addEventListener('mouseenter', () => {
      if (this._main) this._main._focusGui = true;
    });
    this._dom.addEventListener('mouseleave', () => {
      if (this._main) this._main._focusGui = false;
      var active = document.activeElement;
      if (active && (active.tagName === 'SELECT' || active.tagName === 'INPUT') && this._dom.contains(active)) {
        active.blur();
      }
    });

    // Inner yagui-compatible sidebar container
    this._yaGuiSidebar = this._createYaguiSidebar();
  }

  /** Link to the main app instance for _focusGui control */
  setMain(main) {
    this._main = main;
  }

  _createYaguiSidebar() {
    // Create a dummy viewport div (required by GuiMain)
    var fakeViewport = document.createElement('div');
    fakeViewport.style.display = 'none';
    document.body.appendChild(fakeViewport);

    // Instantiate a temporary GuiMain to get a configured Sidebar
    var guiMain = new yagui.GuiMain(fakeViewport, () => {});
    var sidebar = guiMain.addRightSidebar();

    // Patch BaseContainer.prototype.addCombobox to automatically blur select elements on change
    var proto = Object.getPrototypeOf(sidebar);
    var baseProto = Object.getPrototypeOf(proto);
    if (baseProto && baseProto.addCombobox && !baseProto.addCombobox.isPatched) {
      var originalAddCombobox = baseProto.addCombobox;
      baseProto.addCombobox = function () {
        var widget = originalAddCombobox.apply(this, arguments);
        if (widget && widget.domSelect) {
          widget.domSelect.addEventListener('change', function () {
            widget.domSelect.blur();
          });
        }
        return widget;
      };
      baseProto.addCombobox.isPatched = true;
    }

    // Hide/remove the resize handle since floating panels have fixed width
    if (sidebar.domResize) {
      sidebar.domResize.style.display = 'none';
      if (sidebar.domResize.parentNode) {
        sidebar.domResize.parentNode.removeChild(sidebar.domResize);
      }
    }

    // Move the sidebar's DOM element into our floating panel container
    this._dom.appendChild(sidebar.domSidebar);

    // Clean up GuiMain's container and fake viewport
    if (guiMain.domMain && guiMain.domMain.parentNode) {
      guiMain.domMain.parentNode.removeChild(guiMain.domMain);
    }
    fakeViewport.parentNode.removeChild(fakeViewport);

    return sidebar;
  }

  // YAGUI API Proxying
  addMenu(title) {
    return this._yaGuiSidebar.addMenu(title);
  }

  show() {
    this._dom.style.display = 'block';
  }

  hide() {
    this._dom.style.display = 'none';
    // Ensure _focusGui is cleared when panel is hidden
    if (this._main) this._main._focusGui = false;
  }

  destroy() {
    if (this._dom.parentNode) {
      this._dom.parentNode.removeChild(this._dom);
    }
  }
}

export default PanelContainer;
