import TR from './GuiTR.js';
import getOptionsURL from '../misc/getOptionsURL.js';
import Enums from '../misc/Enums.js';

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
    this._initFovIndicator();

    this.init(guiParent);
  }

  get _camera() {
    return this._main.getCamera();
  }

  _initFovIndicator() {
    var indicator = this._fovIndicator = document.createElement('div');
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

    var label = this._fovIndicatorLabel = document.createElement('div');
    label.style.display = 'flex';
    label.style.justifyContent = 'space-between';
    indicator.appendChild(label);

    var labelText = this._fovIndicatorLabelText = document.createElement('span');
    var labelValue = this._fovIndicatorLabelValue = document.createElement('span');
    labelValue.style.color = '#3b97e3';
    label.appendChild(labelText);
    label.appendChild(labelValue);

    var track = document.createElement('div');
    track.style.width = '100%';
    track.style.height = '5px';
    track.style.background = 'rgba(255, 255, 255, 0.2)';
    track.style.borderRadius = '3px';
    track.style.overflow = 'hidden';

    var fill = this._fovIndicatorFill = document.createElement('div');
    fill.style.width = '0%';
    fill.style.height = '100%';
    fill.style.background = '#3b97e3';
    fill.style.borderRadius = '3px';
    fill.style.transition = 'width 0.05s ease-out';

    track.appendChild(fill);
    indicator.appendChild(track);

    document.body.appendChild(indicator);
  }

  _updateFovIndicator(x, y) {
    if (this._modalFov) {
      var val = Math.round(this._camera.getFov());
      var name = TR('cameraFov').split(' (')[0];
      this._fovIndicatorLabelText.textContent = name;
      this._fovIndicatorLabelValue.textContent = val + ' mm';
      var fillPercent = Math.max(0, Math.min(100, Math.round((val - 10) / 190 * 100)));
      this._fovIndicatorFill.style.width = fillPercent + '%';
      this._fovIndicator.style.left = x + 'px';
      this._fovIndicator.style.top = (y - 25) + 'px';
      this._fovIndicator.style.display = 'flex';
    } else {
      this._fovIndicator.style.display = 'none';
    }
  }

  removeEvents() {
    if (this._fovIndicator && this._fovIndicator.parentNode) {
      this._fovIndicator.parentNode.removeChild(this._fovIndicator);
    }
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
    this._main.render();
  }

  onCameraTypeChange(value) {
    this._camera.setProjectionType(value);
    this._ctrlFov.setVisibility(value === Enums.Projection.PERSPECTIVE);
    this._main.render();
  }

  onFovChange(value) {
    this._camera.setFov(value);
    this._main.render();
  }

  onKeyDown(event) {
    if (event.handled === true)
      return;

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
    this._main.render();
  }
}

export default GuiCamera;
