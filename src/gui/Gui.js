import yagui from './ui/UIAdapter.js';
import TR from './GuiTR.js';
import GuiBackground from './GuiBackground.js';
import GuiCamera from './GuiCamera.js';
import GuiConfig from './GuiConfig.js';
import GuiFiles from './GuiFiles.js';
import GuiMesh from './GuiMesh.js';
import GuiTopology from './GuiTopology.js';
import GuiRendering from './GuiRendering.js';
import GuiScene from './GuiScene.js';
import GuiSculpting from './GuiSculpting.js';
import GuiStates from './GuiStates.js';
import GuiTablet from './GuiTablet.js';
import ShaderContour from '../render/shaders/ShaderContour.js';
import UIPopup from './UIPopup.js';
import VerticalToolbar from './VerticalToolbar.js';
import PanelContainer from './PanelContainer.js';

import Export from '../files/Export.js';

class Gui {

  constructor(main) {
    this._main = main;

    this._guiMain = null;
    this._sidebar = null;
    this._topbar = null;

    this._ctrlTablet = null;
    this._ctrlFiles = null;
    this._ctrlScene = null;
    this._ctrlStates = null;
    this._ctrlCamera = null;
    this._ctrlBackground = null;

    this._ctrlSculpting = null;
    this._ctrlTopology = null;
    this._ctrlRendering = null;

    this._ctrlNotification = null;

    this._ctrls = []; // list of controllers

    // upload
    this._notifications = {};
    this._xhrs = {};

    // Phase 4 & 5
    this._popup = null;
    this._shelf = null;
    this._toolbar = null;

    this._onMouseMovePopup = null;
    this._onKeyDownPopup = null;
    this._onContextMenu = null;
    this._lastMouseX = 0;
    this._lastMouseY = 0;
  }

  initGui() {
    this.deleteGui();

    var viewport = this._main.getViewport();
    this._guiMain = new yagui.GuiMain(viewport, this._main.onCanvasResize.bind(this._main));

    // Initialize VerticalToolbar first so it's available for eager panel creation
    this._toolbar = new VerticalToolbar(viewport, this._main);

    var ctrls = this._ctrls;
    ctrls.length = 0;
    var idc = 0;

    // Eagerly initialize all panels as PanelContainers
    var panelFiles = new PanelContainer('file', this._toolbar);
    this._toolbar.registerPanel('file', panelFiles);
    ctrls[idc++] = this._ctrlFiles = new GuiFiles(panelFiles, this);

    var panelScene = new PanelContainer('scene', this._toolbar);
    this._toolbar.registerPanel('scene', panelScene);
    ctrls[idc++] = this._ctrlScene = new GuiScene(panelScene, this);

    var panelStates = new PanelContainer('history', this._toolbar);
    this._toolbar.registerPanel('history', panelStates);
    ctrls[idc++] = this._ctrlStates = new GuiStates(panelStates, this);

    var panelSculpting = new PanelContainer('sculpting', this._toolbar);
    this._toolbar.registerPanel('sculpting', panelSculpting);
    ctrls[idc++] = this._ctrlSculpting = new GuiSculpting(panelSculpting, this);

    var panelTopology = new PanelContainer('topology', this._toolbar);
    this._toolbar.registerPanel('topology', panelTopology);
    ctrls[idc++] = this._ctrlTopology = new GuiTopology(panelTopology, this);

    var panelRendering = new PanelContainer('rendering', this._toolbar);
    this._toolbar.registerPanel('rendering', panelRendering);
    ctrls[idc++] = this._ctrlRendering = new GuiRendering(panelRendering, this);

    var panelCamera = new PanelContainer('camera', this._toolbar);
    this._toolbar.registerPanel('camera', panelCamera);
    ctrls[idc++] = this._ctrlCamera = new GuiCamera(panelCamera, this);

    var panelBackground = new PanelContainer('background', this._toolbar);
    this._toolbar.registerPanel('background', panelBackground);
    ctrls[idc++] = this._ctrlBackground = new GuiBackground(panelBackground, this);

    var panelTablet = new PanelContainer('tablet', this._toolbar);
    this._toolbar.registerPanel('tablet', panelTablet);
    ctrls[idc++] = this._ctrlTablet = new GuiTablet(panelTablet, this);

    var panelConfig = new PanelContainer('settings', this._toolbar);
    this._toolbar.registerPanel('settings', panelConfig);
    ctrls[idc++] = this._ctrlConfig = new GuiConfig(panelConfig, this);

    // Eagerly initialize mesh info panel as a HUD inside the viewport
    ctrls[idc++] = this._ctrlMesh = new GuiMesh(viewport, this);

    // Register all buttons on the VerticalToolbar in the correct order
    this._toolbar.addButton('file', '📁', 'File');
    this._toolbar.addButton('scene', '🌐', 'Scene');
    this._toolbar.addButton('history', '↺', 'History');
    this._toolbar.addSeparator();
    this._toolbar.addButton('sculpting', '🎨', 'Sculpting');
    this._toolbar.addButton('topology', '⬡', 'Topology');
    this._toolbar.addButton('rendering', '💡', 'Rendering');
    this._toolbar.addSeparator();
    this._toolbar.addButton('camera', '📷', 'Camera');
    this._toolbar.addButton('background', '🖼', 'Background');
    this._toolbar.addButton('tablet', '🖊', 'Tablet');
    this._toolbar.addButton('settings', '⚙', 'Settings');

    this.updateMesh();
    this.setVisibility(true);

    // Phase 4 — UIPopup (bound to F1, contextmenu is prevented for RMB camera control)
    this._popup = new UIPopup();
    var canvas = this._main.getCanvas();
    this._onContextMenu = (e) => {
      e.preventDefault();
    };
    canvas.addEventListener('contextmenu', this._onContextMenu);

    this._onMouseMovePopup = (e) => {
      this._lastMouseX = e.pageX;
      this._lastMouseY = e.pageY;
    };
    this._onKeyDownPopup = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        var x = this._lastMouseX || window.innerWidth / 2;
        var y = this._lastMouseY || window.innerHeight / 2;
        this._openContextPopup(x, y);
      }
    };
    window.addEventListener('mousemove', this._onMouseMovePopup);
    window.addEventListener('keydown', this._onKeyDownPopup);

    if (window.postprocessGui) window.postprocessGui();
  }

  getNotification(notifName) {
    var notif = this._notifications[notifName];
    if (!notif) {
      // Create folder inside the Files panel
      var parent = this._ctrlFiles ? this._ctrlFiles._parent : this._toolbar._panels.get('file');
      notif = parent.addMenu();
      notif.isVisible = function () {
        return !this.domContainer.hidden;
      };
      notif.setMessage = function (msg) {
        this.domContainer.innerHTML = msg;
        this.setVisibility(!!msg);
      };

      notif.domContainer.style.color = 'red';
      notif.setMessage('');

      this._notifications[notifName] = notif;
      return notif;
    }

    if (this._xhrs[notifName] && notif.isVisible()) {
      if (window.confirm('Abort ' + notifName + ' previous upload?')) {
        this._xhrs[notifName].abort();
        this._xhrs[notifName].isAborted = true;
        notif.setMessage(null);
      }
      return;
    }

    return notif;
  }

  initPrint(guiParent) {
    var menu = guiParent.addMenu('Print it!');
    // menu.addButton('with Sculpteo', this, 'exportSculpteo');
    menu.addButton('Go to Materialise!', this, 'exportMaterialise');
  }

  exportSculpteo() {
    this._export('sculpteo');
  }

  exportMaterialise() {
    if (window.confirm('A new webpage will be opened. Start upload?')) {
      this._export('materialise');
    }
  }

  exportSketchfab() {
    this._export('sketchfab');
  }

  _export(notifName) {
    var mesh = this._main.getMesh();
    if (!mesh) return;

    var notif = this.getNotification(notifName);
    if (!notif) return;

    var fName = 'export' + notifName.charAt(0).toUpperCase() + notifName.slice(1);
    this._xhrs[notifName] = Export[fName](this._main, notif);
  }

  updateMesh() {
    this._ctrlRendering.updateMesh();
    this._ctrlTopology.updateMesh();
    this._ctrlSculpting.updateMesh();
    this._ctrlScene.updateMesh();
    this.updateMeshInfo();
  }

  updateMeshInfo() {
    this._ctrlMesh.updateMeshInfo();
  }

  getFlatShading() {
    return this._ctrlRendering.getFlatShading();
  }

  getWireframe() {
    return this._ctrlRendering.getWireframe();
  }

  getShaderType() {
    return this._ctrlRendering.getShaderType();
  }

  addAlphaOptions(opts) {
    this._ctrlSculpting.addAlphaOptions(opts);
  }

  deleteGui() {
    if (!this._guiMain || !this._guiMain.domMain.parentNode)
      return;
    this.callFunc('removeEvents');
    this.setVisibility(false);
    this._guiMain.domMain.parentNode.removeChild(this._guiMain.domMain);
    if (this._shelf) { this._shelf.destroy(); this._shelf = null; }
    if (this._popup) { this._popup.destroy(); this._popup = null; }
    if (this._toolbar) { this._toolbar.destroy(); this._toolbar = null; }

    var canvas = this._main.getCanvas();
    if (this._onContextMenu) {
      canvas.removeEventListener('contextmenu', this._onContextMenu);
      this._onContextMenu = null;
    }
    if (this._onMouseMovePopup) {
      window.removeEventListener('mousemove', this._onMouseMovePopup);
      this._onMouseMovePopup = null;
    }
    if (this._onKeyDownPopup) {
      window.removeEventListener('keydown', this._onKeyDownPopup);
      this._onKeyDownPopup = null;
    }
  }

  /** Build context-menu items and open the popup */
  _openContextPopup(x, y) {
    if (!this._popup) return;
    var self = this;
    this._popup.open(x, y, function (container) {
      var items = [
        { label: '↺  Undo',       action: function () { self._main.getStateManager().undo(); self._main.render(); } },
        { label: '↻  Redo',       action: function () { self._main.getStateManager().redo(); self._main.render(); } },
        { label: '⬡  Subdivide',  action: function () { var t = self._ctrlTopology;  if (t && t.subdivide) t.subdivide(); } },
        { label: '◈  Remesh',     action: function () { var t = self._ctrlTopology;  if (t && t.remesh) t.remesh(); } },
        { label: '◻  Flat shade', action: function () {
          var r = self._ctrlRendering;
          if (r && r._ctrlFlat) r._ctrlFlat.setValue(!r._ctrlFlat.getValue());
        }},
        { label: '⬡  Wireframe',  action: function () {
          var r = self._ctrlRendering;
          if (r && r._ctrlWireframe) r._ctrlWireframe.setValue(!r._ctrlWireframe.getValue());
        }},
      ];
      items.forEach(function (item) {
        var btn = document.createElement('button');
        btn.textContent = item.label;
        btn.className = 'shelf-btn';
        btn.style.cssText = 'display:block;width:100%;margin:2px 0;text-align:left;';
        btn.addEventListener('click', function () {
          self._popup.close();
          item.action();
        });
        container.appendChild(btn);
      });
    });
  }

  /** Returns this Gui instance (used by CommandRegistry) */
  getCtrlGui() {
    return this;
  }

  setVisibility(bool) {
    this._guiMain.setVisibility(bool);
  }

  callFunc(func, event) {
    for (var i = 0, ctrls = this._ctrls, nb = ctrls.length; i < nb; ++i) {
      var ct = ctrls[i];
      if (ct && ct[func])
        ct[func](event);
    }
  }
}

export default Gui;
