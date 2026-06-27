import Selection from '../drawables/Selection.js';
import Tools from './tools/Tools.js';
import Enums from '../misc/Enums.js';

class SculptManager {

  constructor(main) {
    this._main = main;

    this._toolIndex = Enums.Tools.BRUSH; // sculpting mode
    this._tools = []; // the sculpting tools

    // symmetry stuffs
    this._symmetry = true; // if symmetric sculpting is enabled  

    // continuous stuffs
    this._continuous = false; // continuous sculpting
    this._sculptTimer = -1; // continuous interval timer

    this._selection = new Selection(main._gl); // the selection geometry (red hover circle)

    this.init();
    
    // Activate the default tool
    var defaultTool = this.getCurrentTool();
    if (defaultTool) {
      console.log('Activating default tool:', this._toolIndex);
      if (defaultTool.onActivate) {
        defaultTool.onActivate();
      }
    }
  }

  setToolIndex(id) {
    var oldTool = this.getCurrentTool();
    if (oldTool) {
      console.log('Deactivating tool:', this._toolIndex);
      if (oldTool.onDeactivate) {
        oldTool.onDeactivate();
      }
    }
    this._toolIndex = id;
    var newTool = this.getCurrentTool();
    if (newTool) {
      console.log('Activating tool:', id);
      if (newTool.onActivate) {
        newTool.onActivate();
      }
    }
  }

  getToolIndex() {
    return this._toolIndex;
  }

  getCurrentTool() {
    return this._tools[this._toolIndex];
  }

  getSymmetry() {
    return this._symmetry;
  }

  getTool(index) {
    return this._tools[index];
  }

  getSelection() {
    return this._selection;
  }

  init() {
    var main = this._main;
    var tools = this._tools;
    for (var i = 0, nb = Tools.length; i < nb; ++i) {
      if (Tools[i]) tools[i] = new Tools[i](main);
    }
  }

  canBeContinuous() {
    switch (this._toolIndex) {
    case Enums.Tools.TWIST:
    case Enums.Tools.MOVE:
    case Enums.Tools.DRAG:
    case Enums.Tools.LOCALSCALE:
    case Enums.Tools.TRANSFORM:
      return false;
    default:
      return true;
    }
  }

  isUsingContinuous() {
    return this._continuous && this.canBeContinuous();
  }

  start(ctrl) {
    var tool = this.getCurrentTool();
    console.log('[SculptManager] start: tool is', tool ? tool.constructor.name : 'null');
    var canEdit = tool.start(ctrl);
    console.log('[SculptManager] start: tool.start returned', canEdit, 'mesh is', this._main.getMesh() ? this._main.getMesh().getID() : 'null', 'total meshes in scene:', this._main.getMeshes().length);
    if (this._main.getPicking().getMesh() && this.isUsingContinuous())
      this._sculptTimer = window.setInterval(tool._cbContinuous, 16.6);
    return canEdit;
  }

  end() {
    this.getCurrentTool().end();
    if (this._sculptTimer !== -1) {
      clearInterval(this._sculptTimer);
      this._sculptTimer = -1;
    }
  }

  preUpdate() {
    this.getCurrentTool().preUpdate(this.canBeContinuous());
  }

  update() {
    if (this.isUsingContinuous())
      return;
    this.getCurrentTool().update();
  }

  postRender() {
    this.getCurrentTool().postRender(this._selection);
  }

  addSculptToScene(scene) {
    this.getCurrentTool().addSculptToScene(scene);
  }
}

export default SculptManager;
