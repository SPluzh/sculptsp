import TR from 'gui/GuiTR';
import Enums from 'misc/Enums';
import Tools from 'editing/tools/Tools';
import getOptionsURL from 'misc/getOptionsURL';
import GuiSculptingTools from 'gui/GuiSculptingTools';

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

    this._menu = null;
    this._ctrlSculpt = null;
    this._ctrlSymmetry = null;
    this._ctrlContinuous = null;
    this._ctrlTitleCommon = null;
    this._initIntensityIndicator();
    this._initFocalShiftIndicator();
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

    GuiSculptingTools.initGuiTools(this._sculptManager, this._menu, this._main);

    this._ctrlTitleCommon = menu.addTitle(TR('sculptCommon'));
    // symmetry
    this._ctrlSymmetry = menu.addCheckbox(TR('sculptSymmetry'), this._sculptManager._symmetry, this.onSymmetryChange.bind(this));
    // continuous
    this._ctrlContinuous = menu.addCheckbox(TR('sculptContinuous'), this._sculptManager, '_continuous');

    GuiSculptingTools.show(this._sculptManager.getToolIndex());
    this.addEvents();
    this.onChangeTool(this._sculptManager.getToolIndex());
  }

  onSymmetryChange(value) {
    this._sculptManager._symmetry = value;
    this._main.render();
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
    if (this._intensityIndicator && this._intensityIndicator.parentNode) {
      this._intensityIndicator.parentNode.removeChild(this._intensityIndicator);
    }
    if (this._focalShiftIndicator && this._focalShiftIndicator.parentNode) {
      this._focalShiftIndicator.parentNode.removeChild(this._focalShiftIndicator);
    }
  }

  _initIntensityIndicator() {
    var indicator = this._intensityIndicator = document.createElement('div');
    indicator.style.position = 'absolute';
    indicator.style.background = 'rgba(20, 20, 20, 0.85)';
    indicator.style.backdropFilter = 'blur(6px)';
    indicator.style.webkitBackdropFilter = 'blur(6px)';
    indicator.style.color = '#ffffff';
    indicator.style.padding = '8px 12px';
    indicator.style.borderRadius = '6px';
    indicator.style.fontFamily = "'Open Sans', sans-serif";
    indicator.style.fontSize = '12px';
    indicator.style.fontWeight = '600';
    indicator.style.pointerEvents = 'none';
    indicator.style.display = 'none';
    indicator.style.zIndex = '99999';
    indicator.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    indicator.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
    indicator.style.minWidth = '110px';
    indicator.style.flexDirection = 'column';
    indicator.style.gap = '6px';
    indicator.style.transform = 'translate(-50%, -100%)';
    indicator.style.webkitTransform = 'translate(-50%, -100%)';

    var label = this._intensityIndicatorLabel = document.createElement('div');
    label.style.display = 'flex';
    label.style.justifyContent = 'space-between';
    indicator.appendChild(label);

    var labelText = this._intensityIndicatorLabelText = document.createElement('span');
    var labelValue = this._intensityIndicatorLabelValue = document.createElement('span');
    labelValue.style.color = '#3b97e3';
    label.appendChild(labelText);
    label.appendChild(labelValue);

    var track = document.createElement('div');
    track.style.width = '100%';
    track.style.height = '5px';
    track.style.background = 'rgba(255, 255, 255, 0.2)';
    track.style.borderRadius = '3px';
    track.style.overflow = 'hidden';

    var fill = this._intensityIndicatorFill = document.createElement('div');
    fill.style.width = '0%';
    fill.style.height = '100%';
    fill.style.background = '#3b97e3';
    fill.style.borderRadius = '3px';
    fill.style.transition = 'width 0.05s ease-out';

    track.appendChild(fill);
    indicator.appendChild(track);

    document.body.appendChild(indicator);
  }

  _updateIntensityIndicator(x, y) {
    var wid = GuiTools[this.getSelectedTool()];
    if (this._modalBrushIntensity && wid && wid._ctrlIntensity) {
      var val = Math.round(wid._ctrlIntensity.getValue());
      var name = TR('sculptIntensity').split(' (')[0];
      this._intensityIndicatorLabelText.textContent = name;
      this._intensityIndicatorLabelValue.textContent = val + '%';
      this._intensityIndicatorFill.style.width = val + '%';
      this._intensityIndicator.style.left = x + 'px';
      this._intensityIndicator.style.top = (y - 25) + 'px';
      this._intensityIndicator.style.display = 'flex';
    } else {
      this._intensityIndicator.style.display = 'none';
    }
  }

  _initFocalShiftIndicator() {
    var indicator = this._focalShiftIndicator = document.createElement('div');
    indicator.style.position = 'absolute';
    indicator.style.background = 'rgba(20, 20, 20, 0.85)';
    indicator.style.backdropFilter = 'blur(6px)';
    indicator.style.webkitBackdropFilter = 'blur(6px)';
    indicator.style.color = '#ffffff';
    indicator.style.padding = '8px 12px';
    indicator.style.borderRadius = '6px';
    indicator.style.fontFamily = "'Open Sans', sans-serif";
    indicator.style.fontSize = '12px';
    indicator.style.fontWeight = '600';
    indicator.style.pointerEvents = 'none';
    indicator.style.display = 'none';
    indicator.style.zIndex = '99999';
    indicator.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    indicator.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
    indicator.style.minWidth = '110px';
    indicator.style.flexDirection = 'column';
    indicator.style.gap = '6px';
    indicator.style.transform = 'translate(-50%, -100%)';
    indicator.style.webkitTransform = 'translate(-50%, -100%)';

    var label = this._focalShiftIndicatorLabel = document.createElement('div');
    label.style.display = 'flex';
    label.style.justifyContent = 'space-between';
    indicator.appendChild(label);

    var labelText = this._focalShiftIndicatorLabelText = document.createElement('span');
    var labelValue = this._focalShiftIndicatorLabelValue = document.createElement('span');
    labelValue.style.color = '#3b97e3';
    label.appendChild(labelText);
    label.appendChild(labelValue);

    var track = document.createElement('div');
    track.style.width = '100%';
    track.style.height = '5px';
    track.style.background = 'rgba(255, 255, 255, 0.2)';
    track.style.borderRadius = '3px';
    track.style.overflow = 'hidden';

    var fill = this._focalShiftIndicatorFill = document.createElement('div');
    fill.style.width = '0%';
    fill.style.height = '100%';
    fill.style.background = '#3b97e3';
    fill.style.borderRadius = '3px';
    fill.style.transition = 'width 0.05s ease-out';

    track.appendChild(fill);
    indicator.appendChild(track);

    document.body.appendChild(indicator);
  }

  _updateFocalShiftIndicator(x, y) {
    var wid = GuiTools[this.getSelectedTool()];
    if (this._modalBrushFocalShift && wid && wid._ctrlFocalShift) {
      var val = Math.round(wid._ctrlFocalShift.getValue());
      var name = TR('sculptFocalShift').split(' (')[0];
      this._focalShiftIndicatorLabelText.textContent = name;
      this._focalShiftIndicatorLabelValue.textContent = val + '%';
      
      var fillPercent = Math.max(0, Math.min(100, (val + 100) / 2));
      this._focalShiftIndicatorFill.style.width = fillPercent + '%';
      this._focalShiftIndicator.style.left = x + 'px';
      this._focalShiftIndicator.style.top = (y - 25) + 'px';
      this._focalShiftIndicator.style.display = 'flex';
    } else {
      this._focalShiftIndicator.style.display = 'none';
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
    GuiSculptingTools.hide(this._sculptManager.getToolIndex());
    this._sculptManager.setToolIndex(newValue);
    GuiSculptingTools.show(newValue);

    var showContinuous = this._sculptManager.canBeContinuous() === true;
    this._ctrlContinuous.setVisibility(showContinuous);

    var showSym = newValue !== Enums.Tools.TRANSFORM;
    this._ctrlSymmetry.setVisibility(showSym);

    this._ctrlTitleCommon.setVisibility(showContinuous || showSym);

    this._main.getPicking().updateLocalAndWorldRadius2();
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
      if (gTool && gTool._ctrlAlpha) gTool._ctrlAlpha.addOptions(opts);
    }
  }

  updateMesh() {
    this._menu.setVisibility(!!this._main.getMesh());
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

    var main = this._main;
    var shk = getOptionsURL.getShortKey(event.which);
    event.stopPropagation();

    if (!main._focusGui || shk === Enums.KeyAction.RADIUS || shk === Enums.KeyAction.INTENSITY || shk === Enums.KeyAction.FOCAL_SHIFT)
      event.preventDefault();

    event.handled = true;
    if (this._checkModifierKey(event))
      return;

    if (main._action !== Enums.Action.NOTHING)
      return;

    if (shk !== undefined && Tools[shk])
      return this._ctrlSculpt.setValue(shk);

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
