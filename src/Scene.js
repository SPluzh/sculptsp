import { vec3, mat4 } from 'gl-matrix';
import getOptionsURL from './misc/getOptionsURL.js';
import Enums from './misc/Enums.js';
import Utils from './misc/Utils.js';
import SculptManager from './editing/SculptManager.js';
import Subdivision from './editing/Subdivision.js';
import Import from './files/Import.js';
import Gui from './gui/Gui.js';
import Camera from './math3d/Camera.js';
import Picking from './math3d/Picking.js';
import Background from './drawables/Background.js';
import RefImageOverlay from './drawables/RefImageOverlay.js';
import Mesh from './mesh/Mesh.js';
import Multimesh from './mesh/multiresolution/Multimesh.js';
import MeshStatic from './mesh/meshStatic/MeshStatic.js';
import Primitives from './drawables/Primitives.js';
import StateManager from './states/StateManager.js';
import RenderData from './mesh/RenderData.js';
import Rtt from './drawables/Rtt.js';
import ShaderLib from './render/ShaderLib.js';
import WebGLCaps from './render/WebGLCaps.js';
import ShaderVoxelChecker from './render/shaders/ShaderVoxelChecker.js';
import SnapCube from './gui/SnapCube.js';
import MeasureRenderer from './measure/MeasureRenderer.js';
import DividerRenderer from './measure/DividerRenderer.js';
import TR from './gui/GuiTR.js';

class Scene {

  constructor() {
    this._gl = null; // webgl context

    this._cameraSpeedTranslate = 0.4;
    this._cameraSpeedZoom = 2.0;
    this._cameraSpeedRotate = 0.5;
    this._cameraSpeedRoll = 1.0;
    this._cameraRmbOnly = true;

    // cache canvas stuffs
    this._pixelRatio = 1.0;
    this._viewport = document.getElementById('viewport');
    this._canvas = document.getElementById('canvas');
    this._canvasWidth = 0;
    this._canvasHeight = 0;
    this._canvasOffsetLeft = 0;
    this._canvasOffsetTop = 0;

    // core of the app
    this._stateManager = new StateManager(this); // for undo-redo
    this._sculptManager = null;
    this._measureTool = null;
    this._measureRenderer = null;
    this._dividerTool = null;
    this._dividerRenderer = null;
    this._camera = new Camera(this);
    this._picking = new Picking(this); // the ray picking
    this._pickingSym = new Picking(this, ['x']); // the symmetrical picking
    this._pickingSymmetries = [this._pickingSym];

    // split viewport
    this._splitMode = null;      // null | 'mirror' | 'independent'
    this._activeViewport = 0;    // 0 = left/only, 1 = right
    this._cameraRight = null;    // Camera, used only in 'independent' mode
    this._splitShowInactiveCursor = false;

    // TODO primitive builder
    this._meshPreview = null;
    this._torusLength = 0.5;
    this._torusWidth = 0.1;
    this._torusRadius = Math.PI * 2;
    this._torusRadial = 32;
    this._torusTubular = 128;

    // renderable stuffs
    var opts = getOptionsURL();
    this._showContour = opts.outline;
    this._showGrid = opts.grid;
    this._grid = null;
    this._voxelPreview = null; // {buf, program, count}
    this._background = null;
    this._meshes = []; // the meshes
    this._selectMeshes = []; // multi selection
    this._mesh = null; // the selected mesh

    this._rttContour = null; // rtt for contour
    this._rttMerge = null; // rtt decode opaque + merge transparent
    this._rttOpaque = null; // rtt half float
    this._rttTransparent = null; // rtt rgbm

    // ui stuffs
    this._focusGui = false; // if the gui is being focused
    this._gui = new Gui(this);

    this._preventRender = false; // prevent multiple render per frame
    this._drawFullScene = false; // render everything on the rtt
    this._autoMatrix = opts.scalecenter; // scale and center the imported meshes
    this._vertexSRGB = true; // srgb vs linear colorspace for vertex color
    this._snapCubeLeft = null;
    this._snapCubeRight = null;
    this._antialias = window.localStorage.getItem('sculptsp_antialias') === '1';
  }

  start() {
    this.initWebGL();
    if (!this._gl)
      return;

    this._sculptManager = new SculptManager(this);
    this._measureTool = this._sculptManager.getTool(Enums.Tools.MEASURE);
    this._measureRenderer = new MeasureRenderer(this._viewport);
    this._dividerTool = this._sculptManager.getTool(Enums.Tools.DIVIDER);
    this._dividerRenderer = new DividerRenderer(this._viewport);
    this._background = new Background(this._gl, this);

    this._rttContour = new Rtt(this._gl, Enums.Shader.CONTOUR, null);
    this._rttMerge = new Rtt(this._gl, Enums.Shader.MERGE, null);
    this._rttOpaque = new Rtt(this._gl, Enums.Shader.FXAA);
    this._rttTransparent = new Rtt(this._gl, null, this._rttOpaque.getDepth(), true);
    this._rttComposite = new Rtt(this._gl, Enums.Shader.VIEWPORT2D, null);

    this._grid = Primitives.createGrid(this._gl);
    this.initGrid();

    this.loadTextures();
    this._gui.initGui();
    this._snapCubeLeft = new SnapCube(this, 'left');
    this._snapCubeRight = new SnapCube(this, 'right');
    this.onCanvasResize();

    var modelURL = getOptionsURL().modelurl;
    if (modelURL) this.addModelURL(modelURL);
    else this.addSphere();
  }

  addModelURL(url) {
    var fileType = this.getFileType(url);
    if (!fileType)
      return;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);

    xhr.responseType = fileType === 'obj' ? 'text' : 'arraybuffer';

    xhr.onload = function () {
      if (xhr.status === 200)
        this.loadScene(xhr.response, fileType);
    }.bind(this);

    xhr.send(null);
  }

  getGL() {
    return this._gl;
  }

  getBackground() {
    return this._background;
  }

  getViewport() {
    return this._viewport;
  }

  getCanvas() {
    return this._canvas;
  }

  getPixelRatio() {
    return this._pixelRatio;
  }

  getCanvasWidth() {
    return this._canvasWidth;
  }

  getCanvasHeight() {
    return this._canvasHeight;
  }

  getCamera() {
    if (this._splitMode === 'independent' && this._activeViewport === 1 && this._cameraRight) {
      return this._cameraRight;
    }
    return this._camera;
  }

  // Returns camera by viewport index, regardless of activeViewport (used for rendering)
  getCameraByIndex(idx) {
    return (idx === 1 && this._cameraRight) ? this._cameraRight : this._camera;
  }

  getSplitMode() {
    return this._splitMode;
  }

  setSplitMode(mode) {
    this._splitMode = mode;
    if (mode === 'independent' && !this._cameraRight) {
      this._cameraRight = this._camera.clone();
      this._cameraRight.resetViewRight();
    }
    var divider = document.getElementById('split-divider');
    if (divider) divider.style.display = mode ? 'block' : 'none';
    var indicator = document.getElementById('split-active-indicator');
    if (indicator) indicator.style.display = mode ? 'block' : 'none';
    this._activeViewport = 0;
    this.onCanvasResize();
    this.render();
  }

  getGui() {
    return this._gui;
  }

  /** Alias used by CommandRegistry / CommandShelf */
  getCtrlGui() {
    return this._gui;
  }

  getMeshes() {
    return this._meshes;
  }

  getMesh() {
    return this._mesh;
  }

  getSelectedMeshes() {
    return this._selectMeshes;
  }

  getPicking() {
    return this._picking;
  }

  getPickingSymmetry() {
    return this._pickingSym;
  }

  getPickingSymmetries() {
    if (!this._pickingSymmetries || this._pickingSymmetries.length === 0) {
      this.updateSymmetryPickers();
    }
    return this._pickingSymmetries;
  }

  getSymmetryCombinations() {
    var axes = Mesh.symmetryAxes || { x: true };
    var active = [];
    if (axes.x) active.push('x');
    if (axes.y) active.push('y');
    if (axes.z) active.push('z');

    if (active.length === 0) return [];

    var results = [];
    var fn = function(index, current) {
      if (index === active.length) {
        if (current.length > 0) {
          results.push(current);
        }
        return;
      }
      fn(index + 1, current.concat([active[index]]));
      fn(index + 1, current);
    };
    fn(0, []);
    return results;
  }

  updateSymmetryPickers() {
    this._pickingSymmetries = [];
    var combs = this.getSymmetryCombinations();
    for (var i = 0; i < combs.length; ++i) {
      var p = new Picking(this, combs[i]);
      this._pickingSymmetries.push(p);
    }
    this._pickingSym = this._pickingSymmetries[0] || new Picking(this);
  }

  getSculptManager() {
    return this._sculptManager;
  }

  getStateManager() {
    return this._stateManager;
  }

  setMesh(mesh) {
    return this.setOrUnsetMesh(mesh);
  }

  setCanvasCursor(style) {
    this._canvas.style.cursor = style;
  }

  initGrid() {
    var grid = this._grid;
    grid.normalizeSize();
    var gridm = grid.getMatrix();
    mat4.translate(gridm, gridm, [0.0, -0.45, 0.0]);
    var scale = 2.5;
    mat4.scale(gridm, gridm, [scale, scale, scale]);
    this._grid.setShaderType(Enums.Shader.FLAT);
    grid.setFlatColor([0.04, 0.04, 0.04]);
  }

  setOrUnsetMesh(mesh, multiSelect) {
    if (!mesh) {
      this._selectMeshes.length = 0;
    } else if (!multiSelect) {
      this._selectMeshes.length = 0;
      this._selectMeshes.push(mesh);
    } else {
      var id = this.getIndexSelectMesh(mesh);
      if (id >= 0) {
        if (this._selectMeshes.length > 1) {
          this._selectMeshes.splice(id, 1);
          mesh = this._selectMeshes[0];
        }
      } else {
        this._selectMeshes.push(mesh);
      }
    }

    this._mesh = mesh;
    this.getGui().updateMesh();
    this.render();
    return mesh;
  }

  renderSelectOverRtt() {
    if (this._requestRender())
      this._drawFullScene = false;
  }

  _requestRender() {
    if (this._preventRender === true)
      return false; // render already requested for the next frame

    window.requestAnimationFrame(this.applyRender.bind(this));
    this._preventRender = true;
    return true;
  }

  render() {
    this._drawFullScene = true;
    this._requestRender();
  }

  applyRender() {
    this._preventRender = false;
    var gl = this._gl;
    if (!gl) return;

    if (this._splitMode) {
      this._applyRenderSplit();
    } else {
      this._applyRenderSingle(this._camera, 0, this._canvasWidth, this._canvasHeight);
    }
  }

  _applyRenderSingle(camera, vpX, vpW, vpH) {
    this.updateMatricesAndSort(camera);

    var isSplit = this._splitMode && vpW < this._canvasWidth;
    if (vpX === 0) {
      if (this._snapCubeLeft) {
        this._snapCubeLeft.update(camera, isSplit);
      }
      if (!isSplit && this._snapCubeRight) {
        this._snapCubeRight.update(camera, isSplit);
      }
    } else {
      if (this._snapCubeRight) {
        this._snapCubeRight.update(camera, isSplit);
      }
    }

    var gl = this._gl;

    if (this._drawFullScene) this._drawScene(camera, vpX, vpW, vpH);

    // After _drawScene, viewport is restored to full canvas size.
    // Use scissor for RTT post-processing so each split viewport's output
    // doesn't overwrite the other half.
    var isSplit = this._splitMode && vpW < this._canvasWidth;
    if (isSplit) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(vpX, 0, vpW, vpH);
    }

    gl.disable(gl.DEPTH_TEST);

    // [1] Merge opaque + transparent
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._rttMerge.getFramebuffer());
    this._rttMerge.render(this);

    // [2] Run FXAA on merged scene, outputting to our new _rttComposite
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._rttComposite.getFramebuffer());
    this._rttOpaque.render(this);

    // [3] Draw reference images on top of _rttComposite
    gl.viewport(vpX, 0, vpW, vpH);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    var refImages = camera.getRefImages();
    for (var i = 0; i < refImages.length; i++) {
      if (refImages[i].getVisible()) {
        refImages[i].render(vpW, vpH);
      }
    }
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, this._canvasWidth, this._canvasHeight);

    // [4] Final blit to screen/scissor portion with 2D viewport transform
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this._rttComposite.render(this);

    gl.enable(gl.DEPTH_TEST);

    if (isSplit) {
      gl.disable(gl.SCISSOR_TEST);
    }

    // Set viewport to this panel's dimensions before drawing UI/Gizmo/Selection overlays
    if (isSplit) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(vpX, 0, vpW, vpH);
    }
    gl.viewport(vpX, 0, vpW, vpH);

    this._sculptManager.postRender(camera, vpX); // draw sculpting gizmo stuffs

    if (this._measureTool && this._measureRenderer) {
      this._measureRenderer.render(
        this._measureTool.getSegments(),
        this._measureTool.getReferenceLength(),
        this._measureTool.getPendingA(),
        this._measureTool.getPendingB(),
        camera,
        this._pixelRatio,
        this._mouseX,
        this._mouseY,
        this._measureTool.getHoveredSegment(),
        this._measureTool.getHoveredVertexKey(),
        this._measureTool._useDistanceThickness,
        vpX
      );
    }

    if (this._dividerTool && this._dividerRenderer) {
      this._dividerRenderer.render(
        this._dividerTool.getSegments(),
        this._dividerTool.getPendingA(),
        this._dividerTool.getPendingB(),
        camera,
        this._pixelRatio,
        this._mouseX,
        this._mouseY,
        this._dividerTool.getHoveredSegment(),
        this._dividerTool.getHoveredVertexKey(),
        this._dividerTool.getDivisions(),
        this._dividerTool._useDistanceThickness,
        vpX
      );
    }

    if (isSplit) {
      gl.disable(gl.SCISSOR_TEST);
    }
    gl.viewport(0, 0, this._canvasWidth, this._canvasHeight);
  }

  _applyRenderSplit() {
    var halfW = Math.floor(this._canvasWidth / 2);
    var H = this._canvasHeight;

    // Left viewport — always main camera
    this._applyRenderSingle(this._camera, 0, halfW, H);

    // Right viewport — mirror = same camera, independent = _cameraRight
    var camRight = (this._splitMode === 'independent' && this._cameraRight)
      ? this._cameraRight
      : this._camera;
    this._applyRenderSingle(camRight, halfW, halfW, H);
  }

  _drawScene(camera, vpX, vpW, vpH) {
    var gl = this._gl;
    var i = 0;
    var meshes = this._meshes.slice();
    this._sculptManager.addSculptToScene(meshes);
    var nbMeshes = meshes.length;

    // Scissor restricts rendering to this viewport's half
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(vpX, 0, vpW, vpH);
    gl.viewport(vpX, 0, vpW, vpH);

    ///////////////
    // CONTOUR 1/2
    ///////////////
    gl.disable(gl.DEPTH_TEST);
    var showContour = this._selectMeshes.length > 0 && this._showContour && ShaderLib[Enums.Shader.CONTOUR].color[3] > 0.0;
    if (showContour) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._rttContour.getFramebuffer());
      gl.clear(gl.COLOR_BUFFER_BIT);
      for (var s = 0, sel = this._selectMeshes, nbSel = sel.length; s < nbSel; ++s)
        sel[s].renderFlatColor(this);
    }
    gl.enable(gl.DEPTH_TEST);

    ///////////////
    // OPAQUE PASS
    ///////////////
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._rttOpaque.getFramebuffer());
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // grid
    if (this._showGrid) this._grid.render(this);

    // (post opaque pass)
    for (i = 0; i < nbMeshes; ++i) {
      if (meshes[i].isTransparent()) break;
      meshes[i].render(this);
    }
    var startTransparent = i;
    if (this._meshPreview) this._meshPreview.render(this);

    // background
    this._background.render();

    // voxel preview
    if (this._voxelPreview) {
      this._renderVoxelPreview();
    }

    ///////////////
    // TRANSPARENT PASS
    ///////////////
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._rttTransparent.getFramebuffer());
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);

    // wireframe for dynamic mesh has duplicate edges
    gl.depthFunc(gl.LESS);
    for (i = 0; i < nbMeshes; ++i) {
      if (meshes[i].getShowWireframe())
        meshes[i].renderWireframe(this);
    }
    gl.depthFunc(gl.LEQUAL);

    gl.depthMask(false);
    gl.enable(gl.CULL_FACE);

    for (i = startTransparent; i < nbMeshes; ++i) {
      gl.cullFace(gl.FRONT); // draw back first
      meshes[i].render(this);
      gl.cullFace(gl.BACK); // ... and then front
      meshes[i].render(this);
    }

    gl.disable(gl.CULL_FACE);

    ///////////////
    // CONTOUR 2/2
    ///////////////
    if (showContour) {
      this._rttContour.render(this);
    }

    gl.depthMask(true);
    gl.disable(gl.BLEND);

    gl.disable(gl.SCISSOR_TEST);
    // Restore full viewport for RTT post-processing
    gl.viewport(0, 0, this._canvasWidth, this._canvasHeight);
  }

  /** Pre compute matrices and sort meshes */
  updateMatricesAndSort(camera) {
    var meshes = this._meshes;
    var cam = camera || this._camera;
    var bbox = this.computeBoundingBoxScene();
    if (bbox[0] !== Infinity) {
      cam.optimizeNearFar(bbox);
    }

    for (var i = 0, nb = meshes.length; i < nb; ++i) {
      meshes[i].updateMatrices(cam);
    }

    meshes.sort(Mesh.sortFunction);

    if (this._meshPreview) this._meshPreview.updateMatrices(cam);
    if (this._grid) this._grid.updateMatrices(cam);
  }

  initWebGL() {
    var attributes = {
      antialias: this._antialias,
      stencil: true
    };

    var canvas = document.getElementById('canvas');
    var gl = this._gl = canvas.getContext('webgl', attributes) || canvas.getContext('experimental-webgl', attributes);
    if (!gl) {
      window.alert('Could not initialise WebGL. No WebGL, no SculptSP. Sorry.');
      return;
    }

    WebGLCaps.initWebGLExtensions(gl);
    if (!WebGLCaps.getWebGLExtension('OES_element_index_uint'))
      RenderData.ONLY_DRAW_ARRAYS = true;

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

    gl.disable(gl.CULL_FACE);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);

    gl.disable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.disable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /** Load textures (preload) */
  loadTextures() {
    var self = this;
    var gl = this._gl;
    var ShaderMatcap = ShaderLib[Enums.Shader.MATCAP];

    var loadTex = function (path, idMaterial) {
      var mat = new Image();
      mat.src = path;

      mat.onload = function () {
        ShaderMatcap.createTexture(gl, mat, idMaterial);
        self.render();
      };
    };

    for (var i = 0, mats = ShaderMatcap.matcaps, l = mats.length; i < l; ++i)
      loadTex(mats[i].path, i);

    this.initAlphaTextures();
  }

  initAlphaTextures() {
    var alphas = Picking.INIT_ALPHAS_PATHS;
    var names = Picking.INIT_ALPHAS_NAMES;
    for (var i = 0, nbA = alphas.length; i < nbA; ++i) {
      var am = new Image();
      am.src = 'resources/alpha/' + alphas[i];
      am.onload = this.onLoadAlphaImage.bind(this, am, names[i]);
    }
  }

  /** Called when the window is resized */
  onCanvasResize() {
    var viewport = this._viewport;
    var newWidth = viewport.clientWidth * this._pixelRatio;
    var newHeight = viewport.clientHeight * this._pixelRatio;

    this._canvasOffsetLeft = viewport.offsetLeft;
    this._canvasOffsetTop = viewport.offsetTop;
    this._canvasWidth = newWidth;
    this._canvasHeight = newHeight;

    this._canvas.width = newWidth;
    this._canvas.height = newHeight;

    // RTT textures always use full canvas size
    this._gl.viewport(0, 0, newWidth, newHeight);

    if (this._splitMode) {
      var halfW = Math.floor(newWidth / 2);
      this._camera.onResize(halfW, newHeight);
      if (this._cameraRight) this._cameraRight.onResize(halfW, newHeight);
    } else {
      this._camera.onResize(newWidth, newHeight);
    }

    if (this._background) this._background.onResize(newWidth, newHeight);

    if (this._rttContour) this._rttContour.onResize(newWidth, newHeight);
    if (this._rttMerge) this._rttMerge.onResize(newWidth, newHeight);
    if (this._rttOpaque) this._rttOpaque.onResize(newWidth, newHeight);
    if (this._rttTransparent) this._rttTransparent.onResize(newWidth, newHeight);
    if (this._rttComposite) this._rttComposite.onResize(newWidth, newHeight);

    if (this._measureRenderer) {
      this._measureRenderer.onResize(newWidth, newHeight, this._pixelRatio);
    }

    if (this._dividerRenderer) {
      this._dividerRenderer.onResize(newWidth, newHeight, this._pixelRatio);
    }

    this.render();
  }

  computeRadiusFromBoundingBox(box) {
    var dx = box[3] - box[0];
    var dy = box[4] - box[1];
    var dz = box[5] - box[2];
    return 0.5 * Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  computeBoundingBoxMeshes(meshes) {
    var bound = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (var i = 0, l = meshes.length; i < l; ++i) {
      if (!meshes[i].isVisible()) continue;
      var bi = meshes[i].computeWorldBound();
      if (bi[0] < bound[0]) bound[0] = bi[0];
      if (bi[1] < bound[1]) bound[1] = bi[1];
      if (bi[2] < bound[2]) bound[2] = bi[2];
      if (bi[3] > bound[3]) bound[3] = bi[3];
      if (bi[4] > bound[4]) bound[4] = bi[4];
      if (bi[5] > bound[5]) bound[5] = bi[5];
    }
    return bound;
  }

  computeBoundingBoxScene() {
    var scene = this._meshes.slice();
    scene.push(this._grid);
    this._sculptManager.addSculptToScene(scene);
    return this.computeBoundingBoxMeshes(scene);
  }

  normalizeAndCenterMeshes(meshes) {
    var box = this.computeBoundingBoxMeshes(meshes);
    var scale = Utils.SCALE / vec3.dist([box[0], box[1], box[2]], [box[3], box[4], box[5]]);

    var mCen = mat4.create();
    mat4.scale(mCen, mCen, [scale, scale, scale]);
    mat4.translate(mCen, mCen, [-(box[0] + box[3]) * 0.5, -(box[1] + box[4]) * 0.5, -(box[2] + box[5]) * 0.5]);

    for (var i = 0, l = meshes.length; i < l; ++i) {
      var mat = meshes[i].getMatrix();
      mat4.mul(mat, mCen, mat);
    }
  }

  addSphere() {
    // make a cube and subdivide it
    var mesh = new Multimesh(Primitives.createCube(this._gl));
    mesh.normalizeSize();
    this.subdivideClamp(mesh);
    return this.addNewMesh(mesh);
  }

  addCube() {
    var mesh = new Multimesh(Primitives.createCube(this._gl));
    mesh.normalizeSize();
    mat4.scale(mesh.getMatrix(), mesh.getMatrix(), [0.7, 0.7, 0.7]);
    this.subdivideClamp(mesh, true);
    return this.addNewMesh(mesh);
  }

  addCylinder() {
    var mesh = new Multimesh(Primitives.createCylinder(this._gl));
    mesh.normalizeSize();
    mat4.scale(mesh.getMatrix(), mesh.getMatrix(), [0.7, 0.7, 0.7]);
    this.subdivideClamp(mesh);
    return this.addNewMesh(mesh);
  }

  addTorus(preview) {
    var mesh = new Multimesh(Primitives.createTorus(this._gl, this._torusLength, this._torusWidth, this._torusRadius, this._torusRadial, this._torusTubular));
    if (preview) {
      mesh.setShowWireframe(true);
      var scale = 0.3 * Utils.SCALE;
      mat4.scale(mesh.getMatrix(), mesh.getMatrix(), [scale, scale, scale]);
      this._meshPreview = mesh;
      return;
    }
    mesh.normalizeSize();
    this.subdivideClamp(mesh);
    this.addNewMesh(mesh);
  }

  subdivideClamp(mesh, linear) {
    Subdivision.LINEAR = !!linear;
    while (mesh.getNbFaces() < 50000)
      mesh.addLevel();
    // keep at max 4 multires
    mesh._meshes.splice(0, Math.min(mesh._meshes.length - 4, 4));
    mesh._sel = mesh._meshes.length - 1;
    Subdivision.LINEAR = false;
  }

  addNewMesh(mesh) {
    this._meshes.push(mesh);
    this._stateManager.pushStateAdd(mesh);
    this.setMesh(mesh);
    return mesh;
  }

  loadScene(fileData, fileType) {
    var newMeshes;
    if (fileType === 'obj') newMeshes = Import.importOBJ(fileData, this._gl);
    else if (fileType === 'sgl') newMeshes = Import.importSGL(fileData, this._gl, this);
    else if (fileType === 'stl') newMeshes = Import.importSTL(fileData, this._gl);
    else if (fileType === 'ply') newMeshes = Import.importPLY(fileData, this._gl);
    else if (fileType === 'gltf') newMeshes = Import.importGLTF(fileData, this._gl);
    else if (fileType === 'glb') newMeshes = Import.importGLB(fileData, this._gl);

    var nbNewMeshes = newMeshes ? newMeshes.length : 0;
    if (nbNewMeshes === 0) {
      return;
    }

    var meshes = this._meshes;
    for (var i = 0; i < nbNewMeshes; ++i) {
      var mesh = newMeshes[i] = new Multimesh(newMeshes[i]);

      if (!this._vertexSRGB && mesh.getColors()) {
        Utils.convertArrayVec3toSRGB(mesh.getColors());
      }

      mesh.init();
      mesh.initRender();
      meshes.push(mesh);
    }

    if (this._autoMatrix) {
      this.normalizeAndCenterMeshes(newMeshes);
    }

    this._stateManager.pushStateAdd(newMeshes);
    this.setMesh(meshes[meshes.length - 1]);
    this.resetCameraMeshes(newMeshes);
    return newMeshes;
  }

  clearScene() {
    this.getStateManager().reset();
    this.getMeshes().length = 0;
    this.getCamera().resetView();
    this.setMesh(null);
    this._action = Enums.Action.NOTHING;
    this._voxelPreview = null;
    if (this._measureTool) {
      this._measureTool.clear();
    }
    if (this._dividerTool) {
      this._dividerTool.clear();
    }
  }

  updateVoxelPreview(step, meshes) {
    if (!step || !meshes || meshes.length === 0) {
      this._voxelPreview = null;
      return;
    }

    this._voxelPreview = {
      step: step,
      meshes: meshes
    };
  }

  _renderVoxelPreview() {
    var vp = this._voxelPreview;
    if (!vp) return;
    var gl = this._gl;

    var shader = ShaderVoxelChecker.getOrCreate(gl);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-1.0, -1.0);

    for (var i = 0, l = vp.meshes.length; i < l; ++i) {
      shader.draw(vp.meshes[i], vp.step);
    }

    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.disable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  deleteCurrentSelection() {
    if (!this._mesh)
      return;

    this.removeMeshes(this._selectMeshes);
    this._stateManager.pushStateRemove(this._selectMeshes.slice());
    this._selectMeshes.length = 0;
    this.setMesh(null);
  }

  removeMeshes(rm) {
    var meshes = this._meshes;
    for (var i = 0; i < rm.length; ++i)
      meshes.splice(this.getIndexMesh(rm[i]), 1);
  }

  getIndexMesh(mesh, select) {
    var meshes = select ? this._selectMeshes : this._meshes;
    var id = mesh.getID();
    for (var i = 0, nbMeshes = meshes.length; i < nbMeshes; ++i) {
      var testMesh = meshes[i];
      if (testMesh === mesh || testMesh.getID() === id)
        return i;
    }
    return -1;
  }

  getIndexSelectMesh(mesh) {
    return this.getIndexMesh(mesh, true);
  }

  /** Replace a mesh in the scene */
  replaceMesh(mesh, newMesh) {
    var index = this.getIndexMesh(mesh);
    if (index >= 0) this._meshes[index] = newMesh;
    if (this._mesh === mesh) this.setMesh(newMesh);
  }

  duplicateSelection() {
    var meshes = this._selectMeshes.slice();
    if (meshes.length === 0) return;

    var newCopies = [];
    for (var i = 0; i < meshes.length; ++i) {
      var mesh = meshes[i];
      var copy = new MeshStatic(mesh.getGL());
      copy.copyData(mesh);
      this.addNewMesh(copy);
      newCopies.push(copy);
    }

    // Keep the new copies selected instead of the original meshes
    this._selectMeshes.length = 0;
    for (var j = 0; j < newCopies.length; ++j) {
      this._selectMeshes.push(newCopies[j]);
    }
    this._mesh = newCopies[newCopies.length - 1];
    this.getGui().updateMesh();
    this.render();
  }

  onLoadAlphaImage(img, name, tool) {
    var can = document.createElement('canvas');
    can.width = img.width;
    can.height = img.height;

    var ctx = can.getContext('2d');
    ctx.drawImage(img, 0, 0);
    var u8rgba = ctx.getImageData(0, 0, img.width, img.height).data;
    var u8lum = u8rgba.subarray(0, u8rgba.length / 4);
    for (var i = 0, j = 0, n = u8lum.length; i < n; ++i, j += 4)
      u8lum[i] = Math.round((u8rgba[j] + u8rgba[j + 1] + u8rgba[j + 2]) / 3);

    name = Picking.addAlpha(u8lum, img.width, img.height, name)._name;

    var entry = {};
    entry[name] = name;
    this.getGui().addAlphaOptions(entry);
    if (tool && tool._ctrlAlpha)
      tool._ctrlAlpha.setValue(name);
  }

  addRefImageToCamera(dataURL, name) {
    var camera = this.getCamera();
    var overlay = new RefImageOverlay(this._gl, this);
    overlay.loadFromDataURL(dataURL, name);
    camera.addRefImage(overlay);
    camera.setActiveRefIdx(camera.getRefImages().length - 1);
    this.render();
  }

  setAntialias(val) {
    this._antialias = val;
    window.localStorage.setItem('sculptsp_antialias', val ? '1' : '0');
    if (window.confirm(TR('renderingAntialiasRestart'))) {
      window.location.reload();
    }
  }
}

export default Scene;
