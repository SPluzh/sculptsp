import './misc/Polyfill.js';
import { vec3 } from 'gl-matrix';
import { Manager as HammerManager, Pan, Pinch, Tap } from 'hammerjs';
import Tablet from './misc/Tablet.js';
import Enums from './misc/Enums.js';
import Utils from './misc/Utils.js';
import Scene from './Scene.js';
import Multimesh from './mesh/multiresolution/Multimesh.js';

var MOUSE_LEFT = 1;
var MOUSE_MIDDLE = 2;
var MOUSE_RIGHT = 3;

// Manage events
class SculptSP extends Scene {

  constructor() {
    super();

    // all x and y position are canvas based

    // controllers stuffs
    this._mouseX = 0;
    this._mouseY = 0;
    this._lastMouseX = 0;
    this._lastMouseY = 0;
    this._lastScale = 0;

    // NOTHING, MASK_EDIT, SCULPT_EDIT, CAMERA_ZOOM, CAMERA_ROTATE, CAMERA_PAN, CAMERA_PAN_ZOOM_ALT
    this._action = Enums.Action.NOTHING;
    this._lastNbPointers = 0;
    this._isWheelingIn = false;

    // masking
    this._maskX = 0;
    this._maskY = 0;
    this._hammer = new HammerManager(this._canvas);

    this._eventProxy = {};

    this.initHammer();
    this.addEvents();
  }

  addEvents() {
    var canvas = this._canvas;

    var cbMouseWheel = this.onMouseWheel.bind(this);
    var cbOnPointer = this.onPointer.bind(this);

    // pointer
    window.addEventListener('pointerdown', cbOnPointer, false);
    window.addEventListener('pointermove', cbOnPointer, false);
    window.addEventListener('pointerup', cbOnPointer, false);
    window.addEventListener('pointercancel', cbOnPointer, false);

    // mouse
    canvas.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    canvas.addEventListener('mouseup', this.onMouseUp.bind(this), false);
    canvas.addEventListener('mouseout', this.onMouseOut.bind(this), false);
    canvas.addEventListener('mouseover', this.onMouseOver.bind(this), false);
    canvas.addEventListener('mousemove', Utils.throttle(this.onMouseMove.bind(this), 16.66), false);
    canvas.addEventListener('mousewheel', cbMouseWheel, false);
    canvas.addEventListener('DOMMouseScroll', cbMouseWheel, false);

    //key
    window.addEventListener('keydown', this.onKeyDown.bind(this), false);
    window.addEventListener('keyup', this.onKeyUp.bind(this), false);

    var cbLoadFiles = this.loadFiles.bind(this);
    var cbStopAndPrevent = this.stopAndPrevent.bind(this);
    // misc
    canvas.addEventListener('webglcontextlost', this.onContextLost.bind(this), false);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored.bind(this), false);
    window.addEventListener('dragenter', cbStopAndPrevent, false);
    window.addEventListener('dragover', cbStopAndPrevent, false);
    window.addEventListener('drop', cbLoadFiles, false);
    document.getElementById('fileopen').addEventListener('change', cbLoadFiles, false);
  }

  onPointer(event) {
    if (!(Tablet.isWintabActive && Tablet.useWintab)) {
      if (event.type === 'pointerup' || event.type === 'pointercancel') {
        Tablet.pressure = 0.0;
      } else {
        Tablet.pressure = event.pressure;
      }
      console.log('[WinInk] pointer event: pressure = ' + event.pressure.toFixed(3) + ', type = ' + event.type + ', pointerType = ' + event.pointerType);
    }
  }

  initHammer() {
    this._hammer.options.enable = true;
    this._initHammerRecognizers();
    this._initHammerEvents();
  }

  _initHammerRecognizers() {
    var hm = this._hammer;
    // double tap
    hm.add(new Tap({
      event: 'doubletap',
      pointers: 1,
      taps: 2,
      time: 250, // def : 250.  Maximum press time in ms.
      interval: 450, // def : 300. Maximum time in ms between multiple taps.
      threshold: 5, // def : 2. While doing a tap some small movement is allowed.
      posThreshold: 50 // def : 30. The maximum position difference between multiple taps.
    }));

    // double tap 2 fingers
    hm.add(new Tap({
      event: 'doubletap2fingers',
      pointers: 2,
      taps: 2,
      time: 250,
      interval: 450,
      threshold: 5,
      posThreshold: 50
    }));

    // pan
    hm.add(new Pan({
      event: 'pan',
      pointers: 0,
      threshold: 0
    }));

    // pinch
    hm.add(new Pinch({
      event: 'pinch',
      pointers: 2,
      threshold: 0.1 // Set a minimal thresold on pinch event, to be detected after pan
    }));
    hm.get('pinch').recognizeWith(hm.get('pan'));
  }

  _initHammerEvents() {
    var hm = this._hammer;
    hm.on('panstart', this.onPanStart.bind(this));
    hm.on('panmove', this.onPanMove.bind(this));
    hm.on('panend pancancel', this.onPanEnd.bind(this));

    hm.on('doubletap', this.onDoubleTap.bind(this));
    hm.on('doubletap2fingers', this.onDoubleTap2Fingers.bind(this));
    hm.on('pinchstart', this.onPinchStart.bind(this));
    hm.on('pinchin pinchout', this.onPinchInOut.bind(this));
  }

  stopAndPrevent(event) {
    event.stopPropagation();
    event.preventDefault();
  }

  onContextLost() {
    window.alert('Oops... WebGL context lost.');
  }

  onContextRestored() {
    window.alert('Wow... Context is restored.');
  }

  ////////////////
  // KEY EVENTS
  ////////////////
  onKeyDown(e) {
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA')
      return;
    this._gui.callFunc('onKeyDown', e);
  }

  onKeyUp(e) {
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA')
      return;
    this._gui.callFunc('onKeyUp', e);
  }

  ////////////////
  // MOBILE EVENTS
  ////////////////
  onPanStart(e) {
    if (e.pointerType === 'mouse')
      return;
    this._focusGui = false;
    var evProxy = this._eventProxy;
    evProxy.pageX = e.center.x;
    evProxy.pageY = e.center.y;
    this.onPanUpdateNbPointers(Math.min(3, e.pointers.length));
  }

  onPanMove(e) {
    if (e.pointerType === 'mouse')
      return;
    var evProxy = this._eventProxy;
    evProxy.pageX = e.center.x;
    evProxy.pageY = e.center.y;

    var nbPointers = Math.min(3, e.pointers.length);
    if (nbPointers !== this._lastNbPointers) {
      this.onDeviceUp();
      this.onPanUpdateNbPointers(nbPointers);
    }
    this.onDeviceMove(evProxy);

    if (this._isIOS()) {
      window.clearTimeout(this._timerResetPointer);
      this._timerResetPointer = window.setTimeout(function () {
        this._lastNbPointers = 0;
      }.bind(this), 60);
    }
  }

  _isIOS() {
    if (this._isIOS !== undefined) return this._isIOS;
    this._isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return this._isIOS;
  }

  onPanUpdateNbPointers(nbPointers) {
    // called on panstart or panmove (not consistent)
    var evProxy = this._eventProxy;
    evProxy.which = nbPointers === 1 && this._lastNbPointers >= 1 ? 3 : nbPointers;
    this._lastNbPointers = nbPointers;
    this.onDeviceDown(evProxy);
  }

  onPanEnd(e) {
    if (e.pointerType === 'mouse')
      return;
    this.onDeviceUp();
    // we need to detect when all fingers are released
    window.setTimeout(function () {
      if (!e.pointers.length) this._lastNbPointers = 0;
    }.bind(this), 60);
  }

  onDoubleTap(e) {
    if (this._focusGui) {
      return;
    }

    var evProxy = this._eventProxy;
    evProxy.pageX = e.center.x;
    evProxy.pageY = e.center.y;
    this.setMousePosition(evProxy);

    var picking = this._picking;
    var res = picking.intersectionMouseMeshes();
    var cam = this._camera;
    var pivot = [0.0, 0.0, 0.0];
    if (!res) {
      return this.resetCameraMeshes();
    }

    vec3.transformMat4(pivot, picking.getIntersectionPoint(), picking.getMesh().getMatrix());
    var zoom = cam._trans[2];
    if (!cam.isOrthographic()) {
      zoom = Math.min(zoom, vec3.dist(pivot, cam.computePosition()));
    }

    cam.setAndFocusOnPivot(pivot, zoom);
    this.render();
  }

  onDoubleTap2Fingers() {
    if (this._focusGui) return;
    this.resetCameraMeshes();
  }

  onPinchStart(e) {
    this._focusGui = false;
    this._lastScale = e.scale;
  }

  onPinchInOut(e) {
    var dir = (e.scale - this._lastScale) * 25;
    this._lastScale = e.scale;
    this.onDeviceWheel(dir);
  }

  resetCameraMeshes(meshes) {
    if (!meshes) meshes = this._meshes;

    if (meshes.length > 0) {
      var pivot = [0.0, 0.0, 0.0];
      var box = this.computeBoundingBoxMeshes(meshes);
      var zoom = 0.8 * this.computeRadiusFromBoundingBox(box);
      zoom *= this._camera.computeFrustumFit();
      vec3.set(pivot, (box[0] + box[3]) * 0.5, (box[1] + box[4]) * 0.5, (box[2] + box[5]) * 0.5);
      this._camera.setAndFocusOnPivot(pivot, zoom);
    } else {
      this._camera.resetView();
    }

    this.render();
  }

  ////////////////
  // LOAD FILES
  ////////////////
  getFileType(name) {
    var lower = name.toLowerCase();
    if (lower.endsWith('.obj')) return 'obj';
    if (lower.endsWith('.sgl')) return 'sgl';
    if (lower.endsWith('.stl')) return 'stl';
    if (lower.endsWith('.ply')) return 'ply';
    return;
  }

  loadFiles(event) {
    event.stopPropagation();
    event.preventDefault();
    var files = event.dataTransfer ? event.dataTransfer.files : event.target.files;
    for (var i = 0, nb = files.length; i < nb; ++i) {
      var file = files[i];
      var fileType = this.getFileType(file.name);
      this.readFile(file, fileType);
    }
  }

  readFile(file, ftype) {
    var fileType = ftype || this.getFileType(file.name);
    if (!fileType)
      return;

    var reader = new FileReader();
    var self = this;
    reader.onload = function (evt) {
      self.loadScene(evt.target.result, fileType);
      document.getElementById('fileopen').value = '';
    };

    if (fileType === 'obj')
      reader.readAsText(file);
    else
      reader.readAsArrayBuffer(file);
  }

  ////////////////
  // MOUSE EVENTS
  ////////////////
  onMouseDown(event) {
    event.stopPropagation();
    event.preventDefault();

    this._gui.callFunc('onMouseDown', event);
    this.onDeviceDown(event);
  }

  onMouseMove(event) {
    event.stopPropagation();
    event.preventDefault();

    this._gui.callFunc('onMouseMove', event);
    this.onDeviceMove(event);
  }

  onMouseOver(event) {
    this._focusGui = false;
    this._gui.callFunc('onMouseOver', event);
  }

  onMouseOut(event) {
    this._focusGui = true;
    this._gui.callFunc('onMouseOut', event);
    this.onMouseUp(event);
  }

  onMouseUp(event) {
    event.preventDefault();

    this._gui.callFunc('onMouseUp', event);
    this.onDeviceUp();
  }

  onMouseWheel(event) {
    event.stopPropagation();
    event.preventDefault();

    this._gui.callFunc('onMouseWheel', event);
    var dir = event.wheelDelta === undefined ? -event.detail : event.wheelDelta;
    this.onDeviceWheel(dir > 0 ? 1 : -1);
  }

  ////////////////
  // HANDLES EVENTS
  ////////////////
  onDeviceUp() {
    var altKey = this._isAltDown;
    this._isAltDown = false;
    this._isCtrlDown = false;
    this.setCanvasCursor('default');
    Multimesh.RENDER_HINT = Multimesh.NONE;
    this._sculptManager.end();

    if (this._action === Enums.Action.MASK_EDIT) {
      var maskingTool = this.getSculptManager().getTool(Enums.Tools.MASKING);
      if (this._mesh) {
        if (this._lastMouseX === this._maskX && this._lastMouseY === this._maskY) {
          maskingTool.invert();
        } else {
          var applied = maskingTool.endLasso(altKey);
          if (!applied) {
            maskingTool.clear();
          }
        }
      } else {
        maskingTool.endLasso(altKey);
      }
      maskingTool.destroyLassoOverlay();
    }

    this._action = Enums.Action.NOTHING;
    this.render();
    this._stateManager.cleanNoop();
  }

  onDeviceWheel(dir) {
    if (dir > 0.0 && !this._isWheelingIn) {
      this._isWheelingIn = true;
      this._camera.start(this._mouseX, this._mouseY);
    }
    this._camera.zoom(dir * 0.02 * (this._cameraSpeedZoom / 0.25));
    Multimesh.RENDER_HINT = Multimesh.CAMERA;
    this.render();
    // workaround for "end mouse wheel" event
    if (this._timerEndWheel)
      window.clearTimeout(this._timerEndWheel);
    this._timerEndWheel = window.setTimeout(this._endWheel.bind(this), 300);
  }

  _endWheel() {
    Multimesh.RENDER_HINT = Multimesh.NONE;
    this._isWheelingIn = false;
    this.render();
  }

  setMousePosition(event) {
    this._mouseX = this._pixelRatio * (event.pageX - this._canvasOffsetLeft);
    this._mouseY = this._pixelRatio * (event.pageY - this._canvasOffsetTop);
  }

  onDeviceDown(event) {
    if (this._focusGui)
      return;

    this._isAltDown = event.altKey;
    this._isCtrlDown = event.ctrlKey;

    this.setMousePosition(event);

    var mouseX = this._mouseX;
    var mouseY = this._mouseY;
    var button = event.which;

    // Clear ZSphere hover/selected states on right/middle click
    if (button !== MOUSE_LEFT) {
      var zsphereTool = this._sculptManager.getTool(Enums.Tools.ZSPHERE);
      if (zsphereTool && zsphereTool._graph && (zsphereTool._graph._selected || zsphereTool._graph._hoveredLink || zsphereTool._graph._previewNode)) {
        zsphereTool._graph._selected = null;
        zsphereTool._graph._hoveredLink = null;
        zsphereTool._graph._previewNode = null;
        this.render();
      }
    }

    var canEdit = false;
    if (button === MOUSE_LEFT) {
      console.log('[SculptSP] onDeviceDown: Left click at (' + mouseX + ', ' + mouseY + '). active tool index: ' + this._sculptManager.getToolIndex());
      canEdit = this._sculptManager.start(event.shiftKey);
      console.log('[SculptSP] onDeviceDown: canEdit result: ' + canEdit);
    }

    if (button === MOUSE_LEFT && canEdit) {
      var maskingTool = this.getSculptManager().getTool(Enums.Tools.MASKING);
      if (event.ctrlKey && maskingTool._useLasso) {
        this.setCanvasCursor('default');
      } else {
        this.setCanvasCursor('none');
      }
    }

    if (this._cameraRmbOnly) {
      if (button === MOUSE_RIGHT) {
        if (event.ctrlKey)
          this._action = Enums.Action.CAMERA_ZOOM;
        else if (event.altKey)
          this._action = Enums.Action.CAMERA_PAN_ZOOM_ALT;
        else
          this._action = Enums.Action.CAMERA_ROTATE;
      } else if (button === MOUSE_LEFT && event.ctrlKey) {
        var maskingTool = this.getSculptManager().getTool(Enums.Tools.MASKING);
        if (maskingTool._useLasso || !canEdit) {
          this._maskX = mouseX;
          this._maskY = mouseY;
          this._action = Enums.Action.MASK_EDIT;
          maskingTool.startLasso(mouseX, mouseY, event.altKey);
        } else {
          this._action = Enums.Action.SCULPT_EDIT;
        }
      } else if (button === MOUSE_LEFT && canEdit) {
        this._action = Enums.Action.SCULPT_EDIT;
      } else {
        this._action = Enums.Action.NOTHING;
      }
    } else {
      if (button === MOUSE_RIGHT && event.ctrlKey)
        this._action = Enums.Action.CAMERA_ZOOM;
      else if (button === MOUSE_MIDDLE)
        this._action = Enums.Action.CAMERA_PAN;
      else if (event.ctrlKey) {
        var maskingTool = this.getSculptManager().getTool(Enums.Tools.MASKING);
        if (maskingTool._useLasso || !canEdit) {
          this._maskX = mouseX;
          this._maskY = mouseY;
          this._action = Enums.Action.MASK_EDIT;
          maskingTool.startLasso(mouseX, mouseY, event.altKey);
        } else {
          this._action = Enums.Action.SCULPT_EDIT;
        }
      } else if ((!canEdit || button === MOUSE_RIGHT) && event.altKey)
        this._action = Enums.Action.CAMERA_PAN_ZOOM_ALT;
      else if (button === MOUSE_RIGHT || (button === MOUSE_LEFT && !canEdit && !this._cameraRmbOnly))
        this._action = Enums.Action.CAMERA_ROTATE;
      else
        this._action = Enums.Action.SCULPT_EDIT;
    }

    if (this._action === Enums.Action.CAMERA_ROTATE || this._action === Enums.Action.CAMERA_ZOOM)
      this._camera.start(mouseX, mouseY);

    this._lastMouseX = mouseX;
    this._lastMouseY = mouseY;
  }

  getSpeedTranslateFactor() {
    return this._cameraSpeedTranslate / (this._canvasHeight * this.getPixelRatio());
  }

  getSpeedZoomFactor() {
    return this._cameraSpeedZoom / (this._canvasHeight * this.getPixelRatio());
  }

  onDeviceMove(event) {
    if (this._focusGui)
      return;

    this._isAltDown = event.altKey;
    this._isCtrlDown = event.ctrlKey;

    this.setMousePosition(event);

    var mouseX = this._mouseX;
    var mouseY = this._mouseY;
    var action = this._action;

    if (action === Enums.Action.CAMERA_ZOOM) {

      Multimesh.RENDER_HINT = Multimesh.CAMERA;
      this._camera.zoom((mouseX - this._lastMouseX + mouseY - this._lastMouseY) * this.getSpeedZoomFactor());
      this.render();

    } else if (action === Enums.Action.CAMERA_PAN_ZOOM_ALT || action === Enums.Action.CAMERA_PAN) {

      Multimesh.RENDER_HINT = Multimesh.CAMERA;
      this._camera.translate((mouseX - this._lastMouseX) * this.getSpeedTranslateFactor(), (mouseY - this._lastMouseY) * this.getSpeedTranslateFactor());
      this.render();

    } else if (action === Enums.Action.CAMERA_ROTATE) {

      Multimesh.RENDER_HINT = Multimesh.CAMERA;
      if (!event.shiftKey)
        this._camera.rotate(mouseX, mouseY, this._cameraSpeedRotate);
      this.render();

    } else {

      Multimesh.RENDER_HINT = Multimesh.PICKING;
      this._sculptManager.preUpdate();

      if (action === Enums.Action.SCULPT_EDIT) {
        Multimesh.RENDER_HINT = Multimesh.SCULPT;
        this._sculptManager.update(this);
        var mesh = this.getMesh();
        if (mesh && mesh.isDynamic)
          this._gui.updateMeshInfo();
      } else if (action === Enums.Action.MASK_EDIT) {
        var maskingTool = this.getSculptManager().getTool(Enums.Tools.MASKING);
        maskingTool.addLassoPoint(mouseX, mouseY, event.altKey);
      }
    }

    this._lastMouseX = mouseX;
    this._lastMouseY = mouseY;
    this.renderSelectOverRtt();
  }
}

export default SculptSP;
