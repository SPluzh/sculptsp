import TR from './GuiTR.js';
import Enums from '../misc/Enums.js';
import Tools from '../editing/tools/Tools.js';
import getOptionsURL from '../misc/getOptionsURL.js';
import GuiSculptingTools from './GuiSculptingTools.js';
import Indicator from './Indicator.js';
import Mesh from '../mesh/Mesh.js';
import {
  createIcons,
  Brush, Wind, RotateCw, Waves, ChevronsDownUp, Shrink, PenLine, Move, Paintbrush, Hand, Shield, Expand, Grid, Layers, CircleDot, Network, Ruler, Activity, Spline, Scissors, Eye, Blend, Square
} from 'lucide';

const toolIcons = {
  Brush, Wind, RotateCw, Waves, ChevronsDownUp, Shrink, PenLine, Move, Paintbrush, Hand, Shield, Expand, Grid, Layers, CircleDot, Network, Ruler, Activity, Spline, Scissors, Eye, Blend, Square
};

var GuiTools = GuiSculptingTools.tools;

class GuiSculpting {

  constructor(guiParent, ctrlGui) {
    this._main = ctrlGui._main; // main application
    this._ctrlGui = ctrlGui; // main gui
    this._sculptManager = ctrlGui._main.getSculptManager(); // sculpting management
    this._toolOnRelease = -1; // tool to apply when the mouse or the key is released
    this._invertSign = false; // invert sign of tool (add/sub)

    this._modalBrushRadius = false; // modal brush radius change
    this._modalBrushIntensity = false; // modal brush intensity change
    this._modalBrushFocalShift = false; // modal brush focal shift change
    this._modalTopologyDetail = false; // modal topology detail change

    // modal stuffs (not canvas based, because no 3D picking involved)
    this._lastPageX = 0;
    this._lastPageY = 0;
    // for modal radius
    this._refX = 0;
    this._refY = 0;
    // for modal intensity
    this._intensityRefX = 0;
    this._intensityRefY = 0;
    // for modal focal shift
    this._focalShiftRefX = 0;
    this._focalShiftRefY = 0;
    // for modal topology detail
    this._topologyDetailRefX = 0;
    this._topologyDetailRefY = 0;

    this._menu = null;
    this._ctrlSculpt = null;
    this._ctrlContinuous = null;
    this._ctrlTitleCommon = null;
    this._intensityInd = new Indicator({ label: TR('sculptIntensity').split(' (')[0], unit: '%', min: 0, max: 100 });
    this._focalShiftInd = new Indicator({ label: TR('sculptFocalShift').split(' (')[0], unit: '%', min: 0, max: 100 });
    this._topologyDetailInd = new Indicator({ label: TR('sculptTopologyDetail'), unit: '', min: 0, max: 100 });
    this.init(guiParent);
  }

  init(guiParent) {
    var menu = this._menu = guiParent.addMenu(TR('sculptTitle'));
    menu.open();

    menu.addTitle(TR('sculptTool'));

    // sculpt tool
    var optTools = [];
    for (var i = 0, nbTools = Tools.length; i < nbTools; ++i) {
      if (Tools[i]) optTools[i] = TR(Tools[i].uiName);
    }
    this._ctrlSculpt = menu.addCombobox(TR('sculptTool'), this._sculptManager.getToolIndex(), this.onChangeTool.bind(this), optTools);

    var toolGrid = document.createElement('div');
    toolGrid.className = 'tool-icon-grid';

    for (var i = 0, nbTools = Tools.length; i < nbTools; ++i) {
      if (!Tools[i]) continue;
      var btn = document.createElement('button');
      btn.className = 'tool-icon-btn';
      btn.setAttribute('data-tooltip', TR(Tools[i].uiName));
      btn.setAttribute('data-tool-index', i);
      
      const iconName = Tools[i].icon || 'Brush';
      const kebabName = iconName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      btn.innerHTML = `<i data-lucide="${kebabName}"></i>`;
      
      btn.addEventListener('click', (e) => {
        var target = e.currentTarget;
        var idx = parseInt(target.getAttribute('data-tool-index'));
        this.onChangeTool(idx);
      });
      toolGrid.appendChild(btn);
    }
    this._toolGrid = toolGrid;
    
    var domLine = document.createElement('li');
    domLine.className = 'tool-icon-grid-container';
    domLine.appendChild(toolGrid);
    menu.domUl.appendChild(domLine);

    createIcons({
      icons: toolIcons,
      root: toolGrid
    });

    GuiSculptingTools.initGuiTools(this._sculptManager, this._menu, this._main);

    this._ctrlTitleCommon = menu.addTitle(TR('sculptCommon'));
    // continuous
    this._ctrlContinuous = menu.addCheckbox(TR('sculptContinuous'), this._sculptManager, '_continuous');

    // dynamic brush size
    this._ctrlDynamicBrush = menu.addCheckbox(TR('sculptDynamicBrushSize'), this._sculptManager.getDynamicBrushSize(), (val) => {
      this._sculptManager.setDynamicBrushSize(val);
      this._main.getPicking().updateLocalAndWorldRadius2();
      this._main.renderSelectOverRtt();
      if (this._ctrlGui._toolbar) {
        this._ctrlGui._toolbar.updateActiveToolText();
      }
    });

    GuiSculptingTools.show(this._sculptManager.getToolIndex());
    this.addEvents();
    this.onChangeTool(this._sculptManager.getToolIndex());
  }

  addEvents() {
    var cbLoadAlpha = this.loadAlpha.bind(this);
    document.getElementById('alphaopen').addEventListener('change', cbLoadAlpha, false);
    this.removeCallback = function () {
      document.getElementById('alphaopen').removeEventListener('change', cbLoadAlpha, false);
    };
  }

  removeEvents() {
    if (this.removeCallback) this.removeCallback();
    this._intensityInd.destroy();
    this._focalShiftInd.destroy();
    this._topologyDetailInd.destroy();
  }

  _updateIntensityIndicator(x, y) {
    var wid = GuiTools[this.getSelectedTool()];
    if (this._modalBrushIntensity && wid && wid._ctrlIntensity) {
      var val = Math.round(wid._ctrlIntensity.getValue());
      this._intensityInd.show(x, y, val);
    } else {
      this._intensityInd.hide();
    }
  }

  _updateFocalShiftIndicator(x, y) {
    var wid = GuiTools[this.getSelectedTool()];
    if (this._modalBrushFocalShift && wid && wid._ctrlFocalShift) {
      var val = Math.round(wid._ctrlFocalShift.getValue());
      var fillPercent = Math.max(0, Math.min(100, (val + 100) / 2));
      this._focalShiftInd.show(x, y, val, fillPercent);
    } else {
      this._focalShiftInd.hide();
    }
  }

  _updateTopologyDetailIndicator(x, y) {
    var wid = GuiTools[this.getSelectedTool()];
    if (this._modalTopologyDetail && wid && wid._ctrlDetail) {
      var val = Math.round(wid._ctrlDetail.getValue());
      this._topologyDetailInd.show(x, y, val);
    } else {
      this._topologyDetailInd.hide();
    }
  }

  getSelectedTool() {
    return this._ctrlSculpt.getValue();
  }

  releaseInvertSign() {
    if (!this._invertSign)
      return;
    this._invertSign = false;
    var tool = GuiTools[this.getSelectedTool()];
    if (tool.toggleNegative)
      tool.toggleNegative();
  }

  onChangeTool(newValue) {
    var oldToolIndex = this._sculptManager.getToolIndex();
    if (newValue === Enums.Tools.TOPOLOGY) {
      if (oldToolIndex !== Enums.Tools.TOPOLOGY) {
        this._prevTool = oldToolIndex;
        if (this._ctrlGui && this._ctrlGui._ctrlRendering && this._ctrlGui._ctrlRendering._ctrlShowWireframe) {
          this._prevWireframe = this._ctrlGui._ctrlRendering._ctrlShowWireframe.getValue();
          this._ctrlGui._ctrlRendering._ctrlShowWireframe.setValue(true);
        }
      }
    } else {
      if (oldToolIndex === Enums.Tools.TOPOLOGY) {
        if (this._prevWireframe !== undefined && this._ctrlGui && this._ctrlGui._ctrlRendering && this._ctrlGui._ctrlRendering._ctrlShowWireframe) {
          this._ctrlGui._ctrlRendering._ctrlShowWireframe.setValue(this._prevWireframe);
        }
      }
    }

    var transformTool = this._sculptManager.getTool(Enums.Tools.TRANSFORM);
    if (transformTool && transformTool._editPivot) {
      transformTool._editPivot = false;
      var transformGui = GuiTools[Enums.Tools.TRANSFORM];
      if (transformGui && transformGui.updateButton) {
        transformGui.updateButton();
      }
    }

    GuiSculptingTools.hide(this._sculptManager.getToolIndex());

    var oldTool = this._sculptManager.getCurrentTool();
    var oldRadius = oldTool ? oldTool._radius : null;

    this._sculptManager.setToolIndex(newValue);

    if ((newValue === Enums.Tools.SMOOTH || newValue === Enums.Tools.MASKING || newValue === Enums.Tools.TOPOLOGY) && oldRadius !== null) {
      var targetTool = this._sculptManager.getTool(newValue);
      targetTool._radius = oldRadius;
      var targetGui = GuiSculptingTools.tools[newValue];
      if (targetGui && targetGui._ctrlRadius) {
        targetGui._ctrlRadius.setValue(oldRadius, true);
      }
    }

    GuiSculptingTools.show(newValue);

    var showContinuous = this._sculptManager.canBeContinuous() === true;
    this._ctrlContinuous.setVisibility(showContinuous);

    var showSym = newValue !== Enums.Tools.TRANSFORM && newValue !== Enums.Tools.MEASURE && newValue !== Enums.Tools.DIVIDER;
    if (this._ctrlDynamicBrush) {
      this._ctrlDynamicBrush.setVisibility(showSym);
    }
    if (this._ctrlGui._ctrlSymmetry) {
      this._ctrlGui._ctrlSymmetry.updateSymmetryVisibility(newValue);
    }
    if (this._ctrlGui._toolbar) {
      this._ctrlGui._toolbar.setSymmetryVisibility(showSym);
      this._ctrlGui._toolbar.updateActiveToolText();
      this._ctrlGui._toolbar.setTopologyToolActive(newValue === Enums.Tools.TOPOLOGY);
    }

    this._ctrlTitleCommon.setVisibility(showContinuous || showSym);

    this._main.getPicking().updateLocalAndWorldRadius2();
    this._main.renderSelectOverRtt();

    if (this._ctrlSculpt && this._ctrlSculpt.domSelect) {
      this._ctrlSculpt.domSelect.blur();
    }

    if (this._ctrlSculpt && this._ctrlSculpt.getValue() !== newValue) {
      this._ctrlSculpt.setValue(newValue, true);
    }

    if (this._toolGrid) {
      var buttons = this._toolGrid.querySelectorAll('.tool-icon-btn');
      buttons.forEach(btn => {
        var idx = parseInt(btn.getAttribute('data-tool-index'));
        if (idx === newValue) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    var activeToolClass = Tools[newValue];
    if (activeToolClass && activeToolClass.icon && this._ctrlGui._toolbar) {
      this._ctrlGui._toolbar.setActiveToolIcon(activeToolClass.icon);
    }

    if (this._ctrlGui && this._ctrlGui._ctrlScene && this._ctrlGui._ctrlScene.refreshOutliner) {
      this._ctrlGui._ctrlScene.refreshOutliner();
    }
  }

  loadAlpha(event) {
    if (event.target.files.length === 0)
      return;

    var file = event.target.files[0];
    if (!file.type.match('image.*'))
      return;

    var reader = new FileReader();
    var main = this._main;
    var tool = GuiTools[this._sculptManager.getToolIndex()];

    reader.onload = function (evt) {
      var img = new Image();
      img.src = evt.target.result;
      img.onload = main.onLoadAlphaImage.bind(main, img, file.name || 'new alpha', tool);
    };

    document.getElementById('alphaopen').value = '';
    reader.readAsDataURL(file);
  }

  addAlphaOptions(opts) {
    for (var i = 0, nbTools = GuiTools.length; i < nbTools; ++i) {
      var gTool = GuiTools[i];
      if (gTool && gTool._ctrlAlpha) {
        gTool._ctrlAlpha.addOptions(opts);
        if (gTool.tool && gTool.tool._idAlpha !== undefined) {
          gTool._ctrlAlpha.setValue(gTool.tool._idAlpha, true);
        }
      }
    }
  }

  updateMesh() {
    this._menu.setVisibility(true);
  }

  _startModalBrushRadius() {
    var cur = GuiTools[this.getSelectedTool()];
    if (cur._ctrlRadius) {
      this._main.getSculptManager().getSelection().setOffsetX(0.0);
      this._main.renderSelectOverRtt();
    }
  }

  _checkModifierKey(event) {
    var selectedTool = this.getSelectedTool();
    if (selectedTool === Enums.Tools.ZSPHERE || selectedTool === Enums.Tools.MEASURE || selectedTool === Enums.Tools.CURVE_DEFORM || selectedTool === Enums.Tools.DIVIDER || selectedTool === Enums.Tools.VISIBILITY)
      return false;

    if (this._main._action === Enums.Action.NOTHING) {
      if (event.shiftKey && !event.altKey && !event.ctrlKey) {
        // smoothing on shift key
        if (selectedTool !== Enums.Tools.SMOOTH) {
          this._toolOnRelease = selectedTool;
          this._ctrlSculpt.setValue(Enums.Tools.SMOOTH);
        }
      }
      if (event.ctrlKey && !event.shiftKey && !event.altKey) {
        // masking on ctrl key
        if (selectedTool !== Enums.Tools.MASKING) {
          this._toolOnRelease = selectedTool;
          this._ctrlSculpt.setValue(Enums.Tools.MASKING);
        }
      }
    }
    if (event.altKey) {
      // invert sign on alt key
      if (this._invertSign || event.shiftKey) return true;
      this._invertSign = true;
      var curTool = GuiTools[selectedTool];
      if (curTool.toggleNegative)
        curTool.toggleNegative();
      return true;
    }
    return false;
  }

  ////////////////
  // KEY EVENTS
  //////////////// 
  onKeyDown(event) {
    if (event.handled === true)
      return;

    var key = event.which;
    // Do not intercept camera undo/redo (Alt+Z / Alt+Shift+Z)
    if (event.altKey && !event.ctrlKey && key === 90)
      return;

    // Do not intercept Ctrl/Cmd keyboard shortcuts (e.g. Ctrl+Z, Ctrl+Y, Ctrl+D, Ctrl+S)
    if ((event.ctrlKey || event.metaKey) && key !== 17 && key !== 91 && key !== 93 && key !== 224)
      return;

    var main = this._main;
    var shk = getOptionsURL.getShortKey(event.which);
    event.stopPropagation();

    if (!main._focusGui || shk === Enums.KeyAction.RADIUS || shk === Enums.KeyAction.INTENSITY || shk === Enums.KeyAction.FOCAL_SHIFT || shk === Enums.KeyAction.TOPOLOGY_DETAIL)
      event.preventDefault();

    event.handled = true;
    if (this._checkModifierKey(event))
      return;

    if (main._action !== Enums.Action.NOTHING)
      return;

    if (shk !== undefined && Tools[shk]) {
      if (shk === Enums.Tools.TOPOLOGY && this.getSelectedTool() === Enums.Tools.TOPOLOGY) {
        var prev = this._prevTool !== undefined ? this._prevTool : Enums.Tools.BRUSH;
        this.onChangeTool(prev);
      } else {
        this._ctrlSculpt.setValue(shk);
      }
      return;
    }

    var cur = GuiTools[this.getSelectedTool()];

    switch (shk) {
    case Enums.KeyAction.DELETE:
      main.deleteCurrentSelection();
      break;
    case Enums.KeyAction.INTENSITY:
      if (!this._modalBrushIntensity) {
        this._intensityRefX = this._lastPageX;
        this._intensityRefY = this._lastPageY;
      }
      this._modalBrushIntensity = main._focusGui = true;
      this._updateIntensityIndicator(this._intensityRefX, this._intensityRefY);
      break;
    case Enums.KeyAction.RADIUS:
      if (!this._modalBrushRadius) this._startModalBrushRadius();
      this._modalBrushRadius = main._focusGui = true;
      break;
    case Enums.KeyAction.FOCAL_SHIFT:
      if (!this._modalBrushFocalShift) {
        this._focalShiftRefX = this._lastPageX;
        this._focalShiftRefY = this._lastPageY;
      }
      this._modalBrushFocalShift = main._focusGui = true;
      this._updateFocalShiftIndicator(this._focalShiftRefX, this._focalShiftRefY);
      break;
    case Enums.KeyAction.TOPOLOGY_DETAIL:
      if (this.getSelectedTool() === Enums.Tools.TOPOLOGY) {
        if (!this._modalTopologyDetail) {
          this._topologyDetailRefX = this._lastPageX;
          this._topologyDetailRefY = this._lastPageY;
        }
        this._modalTopologyDetail = main._focusGui = true;
        this._updateTopologyDetailIndicator(this._topologyDetailRefX, this._topologyDetailRefY);
      }
      break;
    case Enums.KeyAction.NEGATIVE:
      if (cur.toggleNegative) cur.toggleNegative();
      break;
    case Enums.KeyAction.PICKER:
      var ctrlPicker = cur._ctrlPicker;
      if (ctrlPicker && !ctrlPicker.getValue()) ctrlPicker.setValue(true);
      break;
    default:
      event.handled = false;
    }
  }

  onKeyUp(event) {
    if (event.handled === true)
      return;

    var key = event.which;
    // Do not intercept camera undo/redo (Alt+Z / Alt+Shift+Z)
    if (event.altKey && !event.ctrlKey && key === 90)
      return;

    // Do not intercept Ctrl/Cmd keyboard shortcuts (e.g. Ctrl+Z, Ctrl+Y, Ctrl+D, Ctrl+S)
    if ((event.ctrlKey || event.metaKey) && key !== 17 && key !== 91 && key !== 93 && key !== 224)
      return;

    var releaseTool = this._main._action === Enums.Action.NOTHING && this._toolOnRelease !== -1 && !event.ctrlKey && !event.shiftKey;
    if (!event.altKey || releaseTool)
      this.releaseInvertSign();

    if (releaseTool) {
      this._ctrlSculpt.setValue(this._toolOnRelease);
      this._toolOnRelease = -1;
    }

    var main = this._main;
    switch (getOptionsURL.getShortKey(event.which)) {
    case Enums.KeyAction.RADIUS:
      this._modalBrushRadius = main._focusGui = false;
      var selRadius = this._main.getSculptManager().getSelection();
      selRadius.setOffsetX(0.0);
      event.pageX = this._lastPageX;
      event.pageY = this._lastPageY;
      main.setMousePosition(event);
      main.getPicking().intersectionMouseMeshes();
      main.renderSelectOverRtt();
      break;
    case Enums.KeyAction.PICKER:
      var cur = GuiTools[this.getSelectedTool()];
      var ctrlPicker = cur._ctrlPicker;
      if (ctrlPicker && ctrlPicker.getValue()) ctrlPicker.setValue(false);
      break;
    case Enums.KeyAction.INTENSITY:
      this._modalBrushIntensity = main._focusGui = false;
      this._updateIntensityIndicator();
      break;
    case Enums.KeyAction.FOCAL_SHIFT:
      this._modalBrushFocalShift = main._focusGui = false;
      this._updateFocalShiftIndicator();
      break;
    case Enums.KeyAction.TOPOLOGY_DETAIL:
      if (this._modalTopologyDetail) {
        this._modalTopologyDetail = main._focusGui = false;
        this._updateTopologyDetailIndicator();
      }
      break;
    }
  }

  ////////////////
  // MOUSE EVENTS
  ////////////////
  onMouseUp(event) {
    if (this._toolOnRelease !== -1 && !event.ctrlKey && !event.shiftKey) {
      this.releaseInvertSign();
      this._ctrlSculpt.setValue(this._toolOnRelease);
      this._toolOnRelease = -1;
    }
  }

  onMouseMove(event) {
    var wid = GuiTools[this.getSelectedTool()];

    if (this._modalBrushRadius && wid._ctrlRadius) {
      wid._ctrlRadius.setValue(wid._ctrlRadius.getValue() + event.pageX - this._lastPageX);
      this._main.renderSelectOverRtt();
    }

    if (this._modalBrushIntensity && wid._ctrlIntensity) {
      wid._ctrlIntensity.setValue(wid._ctrlIntensity.getValue() + event.pageX - this._lastPageX);
      this._updateIntensityIndicator(this._intensityRefX, this._intensityRefY);
    }

    if (this._modalBrushFocalShift && wid._ctrlFocalShift) {
      wid._ctrlFocalShift.setValue(wid._ctrlFocalShift.getValue() + event.pageX - this._lastPageX);
      this._updateFocalShiftIndicator(this._focalShiftRefX, this._focalShiftRefY);
    }

    if (this._modalTopologyDetail && wid._ctrlDetail) {
      wid._ctrlDetail.setValue(wid._ctrlDetail.getValue() + event.pageX - this._lastPageX);
      this._updateTopologyDetailIndicator(this._topologyDetailRefX, this._topologyDetailRefY);
    }

    this._lastPageX = event.pageX;
    this._lastPageY = event.pageY;
  }

  onMouseOver(event) {
    if (this._modalBrushRadius) {
      this._lastPageX = event.pageX;
      this._lastPageY = event.pageY;
      this._startModalBrushRadius();
    }
  }
}

export default GuiSculpting;
