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

    // Default screenshot settings
    this._screenshotPreset = '1080p';
    this._screenshotWidth = 1920;
    this._screenshotHeight = 1080;
    this._screenshotShowGrid = false;
    this._screenshotShowContour = false;

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
    this._ctrlSafeMargin = menu.addCheckbox(TR('cameraSafeMargin'), camera._useSafeMargin, this.onSafeMarginChange.bind(this));

    // speed settings
    menu.addTitle(TR('cameraSpeedTitle'));
    menu.addSlider(TR('cameraSpeedTranslate'), this._main, '_cameraSpeedTranslate', 0.05, 5.0, 0.001);
    menu.addSlider(TR('cameraSpeedZoom'), this._main, '_cameraSpeedZoom', 0.05, 5.0, 0.001);
    menu.addSlider(TR('cameraSpeedRotate'), this._main, '_cameraSpeedRotate', 0.05, 5.0, 0.001);
    menu.addSlider(TR('cameraSpeedRoll'), this._main, '_cameraSpeedRoll', 0.05, 5.0, 0.001);

    // screenshot settings
    menu.addTitle(TR('cameraScreenshotTitle'));
    var screenshotPresets = {
      'viewport': 'Viewport size',
      '1080p': '1080p (1920x1080)',
      '2k': '2K (2560x1440)',
      '4k': '4K (3840x2160)',
      'custom': 'Custom'
    };
    this._ctrlScreenshotPreset = menu.addCombobox(TR('cameraScreenshotPreset'), this._screenshotPreset, this.onScreenshotPresetChange.bind(this), screenshotPresets);
    this._ctrlScreenshotWidth = menu.addSlider(TR('cameraScreenshotWidth'), this._screenshotWidth, this.onScreenshotWidthChange.bind(this), 256, 7680, 1);
    this._ctrlScreenshotHeight = menu.addSlider(TR('cameraScreenshotHeight'), this._screenshotHeight, this.onScreenshotHeightChange.bind(this), 256, 4320, 1);
    this._ctrlScreenshotShowGrid = menu.addCheckbox(TR('cameraScreenshotShowGrid'), this._screenshotShowGrid, this.onScreenshotShowGridChange.bind(this));
    this._ctrlScreenshotShowContour = menu.addCheckbox(TR('cameraScreenshotShowContour'), this._screenshotShowContour, this.onScreenshotShowContourChange.bind(this));
    menu.addButton(TR('cameraScreenshotAction'), this, 'takeScreenshot');

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

    // reference images
    menu.addTitle(TR('cameraRefTitle'));
    this._ctrlRef2DMode = menu.addCheckbox(TR('cameraRef2DMode'), camera.getRef2DMode(), this.onRef2DModeChange.bind(this));
    this._ctrlRefDrag = menu.addCheckbox(TR('cameraRefDrag'), camera.getRefDragEnabled(), this.onRefDragChange.bind(this));
    menu.addButton(TR('cameraRefReset2D'), this, 'onReset2DView');
    menu.addButton(TR('cameraRefAdd'), this, 'importRefImage');
    this._ctrlRefImagesCombobox = menu.addCombobox('Active Image', -1, this.onActiveRefImageChange.bind(this), {});
    this._ctrlRefVisible = menu.addCheckbox('Visible', true, this.onRefVisibleChange.bind(this));
    this._ctrlRefOpacity = menu.addSlider(TR('cameraRefOpacity'), 0.5, this.onRefOpacityChange.bind(this), 0.0, 1.0, 0.01);
    this._ctrlRefScale = menu.addSlider(TR('cameraRefScale'), 1.0, this.onRefScaleChange.bind(this), 0.05, 5.0, 0.01);
    this._ctrlRefOffsetX = menu.addSlider(TR('cameraRefOffsetX'), 0.0, this.onRefOffsetXChange.bind(this), -2.0, 2.0, 0.01);
    this._ctrlRefOffsetY = menu.addSlider(TR('cameraRefOffsetY'), 0.0, this.onRefOffsetYChange.bind(this), -2.0, 2.0, 0.01);
    this._ctrlRefRemove = menu.addButton(TR('cameraRefRemove'), this, 'onRemoveRefImage');
    this._ctrlRefClearAll = menu.addButton(TR('cameraRefClearAll'), this, 'onClearAllRefImages');

    this.refreshRefImagesList();
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
    case Enums.KeyAction.CAMERA_PROJECTION:
      var current = camera.getProjectionType();
      var target = (current === Enums.Projection.PERSPECTIVE) ? Enums.Projection.ORTHOGRAPHIC : Enums.Projection.PERSPECTIVE;
      this.onCameraTypeChange(target);
      if (this._main._gui) {
        this._main._gui.refreshForCamera(camera);
      }
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

  onSafeMarginChange(value) {
    var camera = this._camera;
    camera._useSafeMargin = value;
    if (this._main._cameraRight) this._main._cameraRight._useSafeMargin = value;
    camera.optimizeNearFar();
    if (this._main._cameraRight) this._main._cameraRight.optimizeNearFar();
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

  importRefImage() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      var files = e.target.files;
      if (!files.length) return;
      var file = files[0];
      var reader = new FileReader();
      reader.onload = (evt) => {
        this._main.addRefImageToCamera(evt.target.result, file.name);
        this.refreshRefImagesList();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  onActiveRefImageChange(value) {
    this._camera.setActiveRefIdx(parseInt(value, 10));
    this.refreshRefImagesList();
    this._main.render();
  }

  onRefVisibleChange(val) {
    var camera = this._camera;
    var activeImg = camera.getRefImages()[camera.getActiveRefIdx()];
    if (activeImg) {
      activeImg.setVisible(val);
      this._main.render();
    }
  }

  onRefOpacityChange(val) {
    var camera = this._camera;
    var activeImg = camera.getRefImages()[camera.getActiveRefIdx()];
    if (activeImg) {
      activeImg.setOpacity(val);
      this._main.render();
    }
  }

  onRefScaleChange(val) {
    var camera = this._camera;
    var activeImg = camera.getRefImages()[camera.getActiveRefIdx()];
    if (activeImg) {
      activeImg.setScale(val);
      this._main.render();
    }
  }

  onRefOffsetXChange(val) {
    var camera = this._camera;
    var activeImg = camera.getRefImages()[camera.getActiveRefIdx()];
    if (activeImg) {
      activeImg.setOffsetX(val);
      this._main.render();
    }
  }

  onRefOffsetYChange(val) {
    var camera = this._camera;
    var activeImg = camera.getRefImages()[camera.getActiveRefIdx()];
    if (activeImg) {
      activeImg.setOffsetY(val);
      this._main.render();
    }
  }

  onRef2DModeChange(val) {
    this._camera.setRef2DMode(val);
    if (this._ctrlRef2DMode) {
      if (val) {
        this._ctrlRef2DMode.domContainer.style.background = '#4488ff';
        this._ctrlRef2DMode.domContainer.style.color = '#fff';
      } else {
        this._ctrlRef2DMode.domContainer.style.background = '';
        this._ctrlRef2DMode.domContainer.style.color = '';
      }
    }
    this._main.render();
  }

  onRefDragChange(val) {
    this._camera.setRefDragEnabled(val);
    if (this._ctrlRefDrag) {
      if (val) {
        this._ctrlRefDrag.domContainer.style.background = '#4488ff';
        this._ctrlRefDrag.domContainer.style.color = '#fff';
      } else {
        this._ctrlRefDrag.domContainer.style.background = '';
        this._ctrlRefDrag.domContainer.style.color = '';
      }
    }
    this._main.render();
  }

  onReset2DView() {
    this._camera.resetView2D();
    this.updateRef2DDisplay();
    this._main.render();
  }

  updateRef2DDisplay() {
    this._main.render();
  }

  onRemoveRefImage() {
    var camera = this._camera;
    var idx = camera.getActiveRefIdx();
    if (idx >= 0 && idx < camera.getRefImages().length) {
      camera.removeRefImage(idx);
      this.refreshRefImagesList();
      this._main.render();
    }
  }

  onClearAllRefImages() {
    var camera = this._camera;
    var len = camera.getRefImages().length;
    for (var i = len - 1; i >= 0; i--) {
      camera.removeRefImage(i);
    }
    this.refreshRefImagesList();
    this._main.render();
  }

  refreshRefImagesList() {
    var camera = this._camera;
    var refImages = camera.getRefImages();
    var activeIdx = camera.getActiveRefIdx();

    var options = {};
    if (refImages.length === 0) {
      options[-1] = 'No Images Loaded';
    } else {
      for (var i = 0; i < refImages.length; i++) {
        options[i] = refImages[i].getName();
      }
    }

    this.updateComboboxOptions(this._ctrlRefImagesCombobox, options);
    this._ctrlRefImagesCombobox.setValue(activeIdx, true);

    var hasActive = (activeIdx >= 0 && activeIdx < refImages.length);
    this._ctrlRefVisible.setVisibility(hasActive);
    this._ctrlRefOpacity.setVisibility(hasActive);
    this._ctrlRefScale.setVisibility(hasActive);
    this._ctrlRefOffsetX.setVisibility(hasActive);
    this._ctrlRefOffsetY.setVisibility(hasActive);
    this._ctrlRefRemove.setVisibility(hasActive);
    this._ctrlRefClearAll.setVisibility(refImages.length > 0);

    if (hasActive) {
      var activeImg = refImages[activeIdx];
      this._ctrlRefVisible.setValue(activeImg.getVisible(), true);
      this._ctrlRefOpacity.setValue(activeImg.getOpacity(), true);
      this._ctrlRefScale.setValue(activeImg.getScale(), true);
      this._ctrlRefOffsetX.setValue(activeImg.getOffsetX(), true);
      this._ctrlRefOffsetY.setValue(activeImg.getOffsetY(), true);
    }
  }

  updateComboboxOptions(ctrl, options) {
    if (!ctrl) return;
    ctrl.domSelect.innerHTML = '';
    ctrl.isArray = options.length !== undefined;
    ctrl.addOptions(options);
  }

  updateRefImageSliders(activeImg) {
    if (activeImg) {
      this._ctrlRefOffsetX.setValue(activeImg.getOffsetX(), true);
      this._ctrlRefOffsetY.setValue(activeImg.getOffsetY(), true);
    }
  }

  selectRefImage(idx) {
    this._camera.setActiveRefIdx(idx);
    this.refreshRefImagesList();
  }

  refreshForCamera(camera) {
    if (this._ctrlProjection) this._ctrlProjection.setValue(camera.getProjectionType(), true);
    if (this._ctrlFov) {
      this._ctrlFov.setValue(camera.getFov(), true);
      this._ctrlFov.setVisibility(camera.getProjectionType() === Enums.Projection.PERSPECTIVE);
    }
    if (this._ctrlPivot) this._ctrlPivot.setValue(camera.getUsePivot(), true);
    if (this._ctrlSafeMargin) this._ctrlSafeMargin.setValue(camera._useSafeMargin, true);
    
    if (this._ctrlRef2DMode) {
      var val = camera.getRef2DMode();
      this._ctrlRef2DMode.setValue(val, true);
      if (val) {
        this._ctrlRef2DMode.domContainer.style.background = '#4488ff';
        this._ctrlRef2DMode.domContainer.style.color = '#fff';
      } else {
        this._ctrlRef2DMode.domContainer.style.background = '';
        this._ctrlRef2DMode.domContainer.style.color = '';
      }
    }
    if (this._ctrlRefDrag) {
      var valDrag = camera.getRefDragEnabled();
      this._ctrlRefDrag.setValue(valDrag, true);
      if (valDrag) {
        this._ctrlRefDrag.domContainer.style.background = '#4488ff';
        this._ctrlRefDrag.domContainer.style.color = '#fff';
      } else {
        this._ctrlRefDrag.domContainer.style.background = '';
        this._ctrlRefDrag.domContainer.style.color = '';
      }
    }
    this.refreshRefImagesList();
  }

  onScreenshotPresetChange(value) {
    this._screenshotPreset = value;
    if (value === 'viewport') {
      var canvas = this._main.getCanvas();
      var pr = this._main.getPixelRatio();
      this._screenshotWidth = Math.round(canvas.clientWidth * pr);
      this._screenshotHeight = Math.round(canvas.clientHeight * pr);
      this._ctrlScreenshotWidth.setValue(this._screenshotWidth, true);
      this._ctrlScreenshotHeight.setValue(this._screenshotHeight, true);
    } else if (value === '1080p') {
      this._screenshotWidth = 1920;
      this._screenshotHeight = 1080;
      this._ctrlScreenshotWidth.setValue(this._screenshotWidth, true);
      this._ctrlScreenshotHeight.setValue(this._screenshotHeight, true);
    } else if (value === '2k') {
      this._screenshotWidth = 2560;
      this._screenshotHeight = 1440;
      this._ctrlScreenshotWidth.setValue(this._screenshotWidth, true);
      this._ctrlScreenshotHeight.setValue(this._screenshotHeight, true);
    } else if (value === '4k') {
      this._screenshotWidth = 3840;
      this._screenshotHeight = 2160;
      this._ctrlScreenshotWidth.setValue(this._screenshotWidth, true);
      this._ctrlScreenshotHeight.setValue(this._screenshotHeight, true);
    }
  }

  onScreenshotWidthChange(value) {
    this._screenshotWidth = Math.round(value);
    if (this._screenshotPreset !== 'custom') {
      this._screenshotPreset = 'custom';
      this._ctrlScreenshotPreset.setValue('custom', true);
    }
  }

  onScreenshotHeightChange(value) {
    this._screenshotHeight = Math.round(value);
    if (this._screenshotPreset !== 'custom') {
      this._screenshotPreset = 'custom';
      this._ctrlScreenshotPreset.setValue('custom', true);
    }
  }

  onScreenshotShowGridChange(value) {
    this._screenshotShowGrid = value;
  }

  onScreenshotShowContourChange(value) {
    this._screenshotShowContour = value;
  }

  takeScreenshot() {
    this._main.takeScreenshot(this._screenshotWidth, this._screenshotHeight, {
      showGrid: this._screenshotShowGrid,
      showContour: this._screenshotShowContour
    });
  }
}

export default GuiCamera;
