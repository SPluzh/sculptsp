import yagui from './ui/UIAdapter.js';

class PanelContainer {
  constructor(id, toolbarDom) {
    this.id = id;
    this._toolbarDom = toolbarDom;

    // Outer custom floating panel container
    this._dom = document.createElement('div');
    this._dom.className = 'vtoolbar-panel';
    this._dom.style.display = 'none';
    document.body.appendChild(this._dom);

    // Inner yagui-compatible sidebar container
    this._yaGuiSidebar = this._createYaguiSidebar();
  }

  _createYaguiSidebar() {
    // Create a dummy viewport div (required by GuiMain)
    var fakeViewport = document.createElement('div');
    fakeViewport.style.display = 'none';
    document.body.appendChild(fakeViewport);

    // Instantiate a temporary GuiMain to get a configured Sidebar
    var guiMain = new yagui.GuiMain(fakeViewport, () => {});
    var sidebar = guiMain.addRightSidebar();

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

  // YAGUI API Proxiing
  addMenu(title) {
    return this._yaGuiSidebar.addMenu(title);
  }

  show() {
    this._dom.style.display = 'block';
  }

  hide() {
    this._dom.style.display = 'none';
  }

  destroy() {
    if (this._dom.parentNode) {
      this._dom.parentNode.removeChild(this._dom);
    }
  }
}

export default PanelContainer;
