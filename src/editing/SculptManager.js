import Selection from '../drawables/Selection.js';
import Tools from './tools/Tools.js';
import Enums from '../misc/Enums.js';

class SculptManager {

  constructor(main) {
    this._main = main;

    this._toolIndex = Enums.Tools.CLAYBUILDUP; // sculpting mode
    this._tools = []; // the sculpting tools

    // symmetry stuffs
    this._symmetry = true; // if symmetric sculpting is enabled  

    this._dynamicBrushSize = false; // dynamic brush size

    // continuous stuffs
    this._continuous = false; // continuous sculpting
    this._sculptTimer = -1; // continuous interval timer

    this._selection = new Selection(main._gl); // the selection geometry (red hover circle)

    // AccuCurve global settings
    this._accuCurve = false;
    this._accuCurveLUT = new Float32Array(256);
    this._accuCurveExponent = 1.7;
    this._accuCurveType = 'sharp';
    this._accuCurveP1 = [0.25, 0.75];
    this._accuCurveP2 = [0.75, 0.25];
    this.updateAccuCurveLUT();

    this.init();
    
    // Activate the default tool
    var defaultTool = this.getCurrentTool();
    if (defaultTool) {
      if (defaultTool.onActivate) {
        defaultTool.onActivate();
      }
    }
  }

  setToolIndex(id) {
    var oldTool = this.getCurrentTool();
    if (oldTool) {
      if (oldTool.onDeactivate) {
        oldTool.onDeactivate();
      }
    }
    this._toolIndex = id;
    var newTool = this.getCurrentTool();
    if (newTool) {
      if (newTool.onActivate) {
        newTool.onActivate();
      }
    }
  }

  getToolIndex() {
    return this._toolIndex;
  }

  getDynamicBrushSize() {
    return this._dynamicBrushSize;
  }

  setDynamicBrushSize(val) {
    this._dynamicBrushSize = val;
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
    case Enums.Tools.ZSPHERE:
    case Enums.Tools.MEASURE:
    case Enums.Tools.ELASTIC:
    case Enums.Tools.CURVE_DEFORM:
    case Enums.Tools.DIVIDER:
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
    var canEdit = tool.start(ctrl);
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

  postRender(camera, vpX) {
    if ((this._main._measureTool && this._main._measureTool.isActive()) || (this._main._dividerTool && this._main._dividerTool.isActive()))
      return;
    this.getCurrentTool().postRender(this._selection, camera, vpX);
  }

  addSculptToScene(scene) {
    this.getCurrentTool().addSculptToScene(scene);
  }

  getAccuCurve() {
    return this._accuCurve;
  }

  setAccuCurve(val) {
    this._accuCurve = val;
  }

  updateAccuCurveLUT() {
    for (var i = 0; i < 256; ++i) {
      var x = i / 255.0;
      if (this._accuCurveType === 'sharp') {
        this._accuCurveLUT[i] = Math.pow(1.0 - x, this._accuCurveExponent);
      } else {
        this._accuCurveLUT[i] = this.evaluateBezier(x, this._accuCurveP1[0], this._accuCurveP1[1], this._accuCurveP2[0], this._accuCurveP2[1]);
      }
    }
  }

  evaluateBezier(x, p1x, p1y, p2x, p2y) {
    if (x <= 0.0) return 1.0;
    if (x >= 1.0) return 0.0;

    var tMin = 0.0;
    var tMax = 1.0;
    var t = 0.5;
    for (var step = 0; step < 16; ++step) {
      t = (tMin + tMax) * 0.5;
      var xt = 3.0 * (1.0 - t) * (1.0 - t) * t * p1x + 3.0 * (1.0 - t) * t * t * p2x + t * t * t;
      if (Math.abs(xt - x) < 1e-5) {
        break;
      }
      if (xt < x) {
        tMin = t;
      } else {
        tMax = t;
      }
    }

    var mt = 1.0 - t;
    var yt = mt * mt * mt * 1.0 + 3.0 * mt * mt * t * p1y + 3.0 * mt * t * t * p2y;
    return Math.max(0.0, Math.min(1.0, yt));
  }

  getAccuCurveWeight(dist) {
    if (dist >= 1.0) return 0.0;
    var floatIndex = dist * 255.0;
    if (floatIndex > 254.0) floatIndex = 254.0;
    var index = floatIndex | 0;
    var fract = floatIndex - index;
    return this._accuCurveLUT[index] * (1.0 - fract) + this._accuCurveLUT[index + 1] * fract;
  }
}

export default SculptManager;
