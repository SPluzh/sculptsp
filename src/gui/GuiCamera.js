import TR from './GuiTR.js';
import getOptionsURL from '../misc/getOptionsURL.js';
import Enums from '../misc/Enums.js';
import Indicator from './Indicator.js';

class GuiCamera {

  constructor(guiParent, ctrlGui) {
    this._main = ctrlGui._main; // main application
    this._menu = null; // ui menu
    this._cameraTimer = -1; // interval id (used for zqsd/wasd/arrow moves)
    this._cbTranslation = this.cbOnTranslation.bind(this);

    this._modalFov = false; // modal camera fov change
    this._lastPageX = 0;
    this._lastPageY = 0;
    this._fovRefX = 0;
    this._fovRefY = 0;
    this._initFovInd();

    this.init(guiParent);
  }

  get _camera() {
    return this._main.getCamera();
  }

  _initFovInd() {
    this._fovInd = new Indicator({
      label: TR('cameraFov').split(' (')[0],
      unit: ' mm',
      min: 10,
      max: 200
    });
  }

  _updateFovIndicator(x, y) {
    if (this._modalFov) {
      var val = Math.round(this._camera.getFov());
      var fillPercent = Math.max(0, Math.min(100, Math.round((val - 10) / 190 * 100)));
      this._fovInd.show(x, y, val, fillPercent);
    } else {
      this._fovInd.hide();
    }
  }

  removeEvents() {
    this._fovInd.destroy();
  }

  init(guiParent) {
    var camera = this._camera;

    // Camera fold
    var menu = this._menu = guiParent.addMenu(TR('cameraTitle'));

    // reset camera
    menu.addTitle(TR('cameraReset'));
    menu.addDualButton(TR('cameraCenter'), TR('cameraFront'), this.resetCamera.bind(this), this.resetFront.bind(this));
    menu.addDualButton(TR('cameraLeft'), TR('cameraTop'), this.resetLeft.bind(this), this.resetTop.bind(this));

    // camera type
    this._ctrlProjectionTitle = menu.addTitle(TR('cameraProjection'));
    var optionsType = [];
    optionsType[Enums.Projection.PERSPECTIVE] = TR('cameraPerspective');
    optionsType[Enums.Projection.ORTHOGRAPHIC] = TR('cameraOrthographic');
    this._ctrlProjection = menu.addCombobox('', camera.getProjectionType(), this.onCameraTypeChange.bind(this), optionsType);

    // camera fov
    this._ctrlFov = menu.addSlider(TR('cameraFov'), camera.getFov(), this.onFovChange.bind(this), 10, 200, 1);
    this._ctrlFov.setVisibility(camera.getProjectionType() === Enums.Projection.PERSPECTIVE);

    // camera mode
    menu.addTitle(TR('cameraMode'));
    var optionsMode = [];
    optionsMode[Enums.CameraMode.ORBIT] = TR('cameraOrbit');
    optionsMode[Enums.CameraMode.SPHERICAL] = TR('cameraSpherical');
    optionsMode[Enums.CameraMode.PLANE] = TR('cameraPlane');
    menu.addCombobox('', camera.getMode(), this.onCameraModeChange.bind(this), optionsMode);
    this._ctrlPivot = menu.addCheckbox(TR('cameraPivot'), camera.getUsePivot(), this.onPivotChange.bind(this));
    this._ctrlRmbOnly = menu.addCheckbox(TR('cameraRmbOnly'), this._main, '_cameraRmbOnly');

    // speed settings
    menu.addTitle(TR('cameraSpeedTitle'));
    menu.addSlider(TR('cameraSpeedTranslate'), this._main, '_cameraSpeedTranslate', 0.05, 5.0, 0.001);
    menu.addSlider(TR('cameraSpeedZoom'), this._main, '_cameraSpeedZoom', 0.05, 5.0, 0.001);
    menu.addSlider(TR('cameraSpeedRotate'), this._main, '_cameraSpeedRotate', 0.05, 5.0, 0.001);

    // split viewport
    menu.addTitle(TR('splitViewportTitle'));
    var splitOptions = {};
    splitOptions[0] = TR('splitViewportOff');
    splitOptions[1] = TR('splitViewportMirror');
    splitOptions[2] = TR('splitViewportIndependent');
    this._ctrlSplitViewport = menu.addCombobox('', 0, function(val) {
      var modes = [null, 'mirror', 'independent'];
      this._main.setSplitMode(modes[val]);
      if (this._ctrlSplitShowInactiveCursor) {
        this._ctrlSplitShowInactiveCursor.setVisibility(val > 0);
      }
    }.bind(this), splitOptions);
    this._ctrlSplitShowInactiveCursor = menu.addCheckbox(TR('splitViewportShowInactiveCursor'), this._main._splitShowInactiveCursor, this.onSplitShowInactiveCursorChange.bind(this));
    this._ctrlSplitShowInactiveCursor.setVisibility(false);
  }

  onSplitShowInactiveCursorChange(value) {
    this._main._splitShowInactiveCursor = value;
    this._main.render();
  }

  onCameraModeChange(value) {
    this._camera.setMode(value);
    this._camera.pushState();
    this._main.render();
  }

  onCameraTypeChange(value) {
    this._camera.setProjectionType(value);
    this._ctrlFov.setVisibility(value === Enums.Projection.PERSPECTIVE);
    this._camera.pushState();
    this._main.render();
  }

  onFovChange(value) {
    this._camera.setFov(value);
    this._camera.pushStateDebounced();
    this._main.render();
  }

  onKeyDown(event) {
    if (event.handled === true)
      return;

    var key = event.which;
    if (event.altKey && !event.ctrlKey && key === 90) {
      event.stopPropagation();
      event.preventDefault();
      event.handled = true;
      if (event.shiftKey) {
        this.cameraRedo();
      } else {
        this.cameraUndo();
      }
      return;
    }

    var main = this._main;
    var shk = getOptionsURL.getShortKey(event.which);
    event.stopPropagation();

    if (!main._focusGui || shk === Enums.KeyAction.CAMERA_FOV)
      event.preventDefault();

    event.handled = true;

    if (main._focusGui && shk !== Enums.KeyAction.CAMERA_FOV)
      return;

    if (event.shiftKey && main._action === Enums.Action.CAMERA_ROTATE) {
      this._camera.snapClosestRotation();
      main.render();
    }

    switch (shk) {
    case Enums.KeyAction.CAMERA_FOV:
      if (!this._modalFov) {
        this._fovRefX = this._lastPageX;
        this._fovRefY = this._lastPageY;
      }
      this._modalFov = main._focusGui = true;
      this._updateFovIndicator(this._fovRefX, this._fovRefY);
      break;
    case Enums.KeyAction.STRIFE_LEFT:
      this._camera._moveX = -1;
      break;
    case Enums.KeyAction.STRIFE_RIGHT:
      this._camera._moveX = 1;
      break;
    case Enums.KeyAction.STRIFE_UP:
      this._camera._moveZ = -1;
      break;
    case Enums.KeyAction.STRIFE_DOWN:
      this._camera._moveZ = 1;
      break;
    default:
      event.handled = false;
    }

    if (event.handled === true && this._cameraTimer === -1 && shk !== Enums.KeyAction.CAMERA_FOV) {
      this._cameraTimer = window.setInterval(this._cbTranslation, 16.6);
    }
  }

  cbOnTranslation() {
    var main = this._main;
    main.getCamera().updateTranslation();
    main.render();
  }

  /** Key released event */
  onKeyUp(event) {
    if (event.handled === true)
      return;

    var key = event.which;
    if (event.altKey && !event.ctrlKey && key === 90) {
      event.stopPropagation();
      event.preventDefault();
      event.handled = true;
      return;
    }

    event.stopPropagation();
    var shk = getOptionsURL.getShortKey(event.which);
    if (this._main._focusGui && shk !== Enums.KeyAction.CAMERA_FOV)
      return;

    event.preventDefault();
    event.handled = true;
    var camera = this._camera;

    switch (shk) {
    case Enums.KeyAction.CAMERA_FOV:
      this._modalFov = this._main._focusGui = false;
      this._updateFovIndicator();
      camera.pushState();
      break;
    case Enums.KeyAction.STRIFE_LEFT:
    case Enums.KeyAction.STRIFE_RIGHT:
      camera._moveX = 0;
      break;
    case Enums.KeyAction.STRIFE_UP:
    case Enums.KeyAction.STRIFE_DOWN:
      camera._moveZ = 0;
      break;
    case Enums.KeyAction.CAMERA_RESET:
      this.resetCamera();
      break;
    case Enums.KeyAction.CAMERA_FRONT:
      this.resetFront();
      break;
    case Enums.KeyAction.CAMERA_TOP:
      this.resetTop();
      break;
    case Enums.KeyAction.CAMERA_LEFT:
      this.resetLeft();
      break;
    default:
      event.handled = false;
    }

    if (this._cameraTimer !== -1 && camera._moveX === 0 && camera._moveZ === 0) {
      clearInterval(this._cameraTimer);
      this._cameraTimer = -1;
      camera.pushState();
    }
  }

  onMouseMove(event) {
    if (this._modalFov) {
      var newVal = this._camera.getFov() + (event.pageX - this._lastPageX);
      newVal = Math.max(10, Math.min(200, newVal));
      this._camera.setFov(newVal);
      if (this._ctrlFov) this._ctrlFov.setValue(newVal);
      this._main.render();
      this._updateFovIndicator(this._fovRefX, this._fovRefY);
    }
    this._lastPageX = event.pageX;
    this._lastPageY = event.pageY;
  }

  onMouseOver(event) {
    this._lastPageX = event.pageX;
    this._lastPageY = event.pageY;
  }

  resetCamera() {
    this._camera.resetView();
    this._main.render();
  }

  resetFront() {
    this._camera.toggleViewFront();
    this._main.render();
  }

  resetLeft() {
    this._camera.toggleViewLeft();
    this._main.render();
  }

  resetTop() {
    this._camera.toggleViewTop();
    this._main.render();
  }

  onPivotChange() {
    this._camera.toggleUsePivot();
    this._camera.pushState();
    this._main.render();
  }

  cameraUndo() {
    this._camera.undo();
    this._main.render();
  }

  cameraRedo() {
    this._camera.redo();
    this._main.render();
  }
}

export default GuiCamera;
