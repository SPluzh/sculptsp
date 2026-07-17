import { mat3, mat4, vec3 } from 'gl-matrix';
import Buffer from '../render/Buffer.js';
import ShaderLib from '../render/ShaderLib.js';
import Enums from '../misc/Enums.js';

var _TMP_MATPV = mat4.create();
var _TMP_MAT = mat4.create();
var _TMP_VEC = [0.0, 0.0, 0.0];
var _TMP_AXIS = [0.0, 0.0, 0.0];
var _BASE = [0.0, 0.0, 1.0];

var DOT_RADIUS = 50.0;

class Selection {

  constructor(gl) {
    this._gl = gl;

    this._circleBuffer = new Buffer(gl, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
    this._dotBuffer = new Buffer(gl, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
    this._squareBuffer = new Buffer(gl, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
    this._squareDotBuffer = new Buffer(gl, gl.ARRAY_BUFFER, gl.STATIC_DRAW);

    this._cacheDotMVP = mat4.create();
    this._cacheDotSymMVP = mat4.create();
    this._cacheCircleMVP = mat4.create();
    this._cacheInnerCircleMVP = mat4.create();
    this._color = new Float32Array([0.8, 0.0, 0.0]);

    this._offsetX = 0.0; // horizontal offset (when editing the radius)
    this._isEditMode = false;
    this._activeCamera = null;
    this._pickedMesh = false;

    this.init();
  }

  getGL() {
    return this._gl;
  }

  getCircleBuffer() {
    return this._circleBuffer;
  }

  getSquareBuffer() {
    return this._squareBuffer;
  }

  getDotBuffer() {
    return this._dotBuffer;
  }

  getSquareDotBuffer() {
    return this._squareDotBuffer;
  }

  getCircleMVP() {
    return this._cacheCircleMVP;
  }

  getInnerCircleMVP() {
    return this._cacheInnerCircleMVP;
  }

  getDotMVP() {
    return this._cacheDotMVP;
  }

  getDotSymmetryMVP() {
    return this._cacheDotSymMVP;
  }

  getColor() {
    return this._color;
  }

  setIsEditMode(bool) {
    this._isEditMode = bool;
  }

  getIsEditMode() {
    return this._isEditMode;
  }

  setOffsetX(offset) {
    this._offsetX = offset;
  }

  getOffsetX() {
    return this._offsetX;
  }

  getActiveCamera() {
    return this._activeCamera;
  }

  getPickedMesh() {
    return this._pickedMesh;
  }

  init() {
    this.getCircleBuffer().update(this._getCircleVertices(1.0));
    this.getDotBuffer().update(this._getDotVertices(0.05, 10));

    var s = Math.SQRT1_2;
    this.getSquareBuffer().update(new Float32Array([
      -s, -s, 0.0,
       s, -s, 0.0,
       s,  s, 0.0,
      -s,  s, 0.0
    ]));
    this.getSquareDotBuffer().update(this._getSquareDotVertices(0.05));
  }

  release() {
    this.getCircleBuffer().release();
    this.getDotBuffer().release();
    this.getSquareBuffer().release();
    this.getSquareDotBuffer().release();
  }

  _getSquareDotVertices(r) {
    var s = r * Math.SQRT1_2;
    return new Float32Array([
       0.0,  0.0, 0.0,
        -s,   -s, 0.0,
         s,   -s, 0.0,
         s,    s, 0.0,
        -s,    s, 0.0,
        -s,   -s, 0.0
    ]);
  }

  _getCircleVertices(radius = 1.0, nbVertices = 50, full = false) {
    var arc = Math.PI * 2;

    var start = full ? 1 : 0;
    var end = full ? nbVertices + 2 : nbVertices;
    var vertices = new Float32Array(end * 3);
    for (var i = start; i < end; ++i) {
      var j = i * 3;
      var segment = (arc * i) / nbVertices;
      vertices[j] = Math.cos(segment) * radius;
      vertices[j + 1] = Math.sin(segment) * radius;
    }
    return vertices;
  }

  _getDotVertices(r, nb) {
    return this._getCircleVertices(r, nb, true);
  }

  _updateMatricesBackground(camera, main) {

    var tool = main.getSculptManager().getCurrentTool();
    var screenRadius = tool.getScreenRadius();
    if (main.getSculptManager().getDynamicBrushSize()) {
      var mesh = main.getMesh();
      if (mesh) {
        var worldRadius = tool._radius * (mesh.computeLocalRadius() * mesh.getScale()) * 0.002;
        var right = [camera._view[0], camera._view[4], camera._view[8]];
        vec3.normalize(right, right);
        var offsetPoint = [
          camera._center[0] + right[0] * worldRadius,
          camera._center[1] + right[1] * worldRadius,
          camera._center[2] + right[2] * worldRadius
        ];
        var pCenter = camera.project(camera._center);
        var pOffset = camera.project(offsetPoint);
        screenRadius = vec3.dist(pCenter, pOffset);
      }
    }

    var focalShift = tool._focalShift !== undefined ? tool._focalShift : 0.0;
    var innerRatio = (1.0 - focalShift) / 2.0;
    var innerScreenRadius = screenRadius * innerRatio;

    var w = camera._width * 0.5;
    var h = camera._height * 0.5;
    // no need to recompute the ortho proj each time though
    mat4.ortho(_TMP_MATPV, -w, w, -h, h, -10.0, 10.0);

    mat4.identity(_TMP_MAT);
    mat4.translate(_TMP_MAT, _TMP_MAT, vec3.set(_TMP_VEC, -w + main._mouseX + this._offsetX, h - main._mouseY, 0.0));
    // circle mvp
    mat4.scale(this._cacheCircleMVP, _TMP_MAT, vec3.set(_TMP_VEC, screenRadius, screenRadius, screenRadius));
    mat4.mul(this._cacheCircleMVP, _TMP_MATPV, this._cacheCircleMVP);
    // inner circle mvp
    mat4.scale(this._cacheInnerCircleMVP, _TMP_MAT, vec3.set(_TMP_VEC, innerScreenRadius, innerScreenRadius, innerScreenRadius));
    mat4.mul(this._cacheInnerCircleMVP, _TMP_MATPV, this._cacheInnerCircleMVP);
    // dot mvp
    mat4.scale(this._cacheDotMVP, _TMP_MAT, vec3.set(_TMP_VEC, DOT_RADIUS, DOT_RADIUS, DOT_RADIUS));
    mat4.mul(this._cacheDotMVP, _TMP_MATPV, this._cacheDotMVP);
    // symmetry mvp
    mat4.scale(this._cacheDotSymMVP, this._cacheDotSymMVP, [0.0, 0.0, 0.0]);
    this._cacheDotSymMVPs = [];
  }

  _updateMatricesMesh(camera, main) {
    var picking = main.getPicking();
    var pickingSyms = main.getPickingSymmetries();
    var worldRadius = Math.sqrt(picking.computeWorldRadius2(true));
    var screenRadius = main.getSculptManager().getCurrentTool().getScreenRadius();
    var mesh = picking.getMesh();

    if (main.getSculptManager().getDynamicBrushSize()) {
      var worldInter = vec3.transformMat4(_TMP_VEC, picking.getIntersectionPoint(), mesh.getMatrix());
      var screenInter = camera.project(worldInter);
      var right = [camera._view[0], camera._view[4], camera._view[8]];
      vec3.normalize(right, right);
      var offsetWorld = vec3.scaleAndAdd(vec3.create(), worldInter, right, worldRadius);
      var screenOffset = camera.project(offsetWorld);
      screenRadius = vec3.dist(screenInter, screenOffset);
    }

    var tool = main.getSculptManager().getCurrentTool();
    var focalShift = tool._focalShift !== undefined ? tool._focalShift : 0.0;
    var innerRatio = (1.0 - focalShift) / 2.0;
    var innerWorldRadius = worldRadius * innerRatio;

    var constRadius = DOT_RADIUS * (worldRadius / screenRadius);

    picking.polyLerp(mesh.getNormals(), _TMP_AXIS);
    vec3.transformMat3(_TMP_AXIS, _TMP_AXIS, mat3.normalFromMat4(_TMP_MAT, mesh.getMatrix()));
    vec3.normalize(_TMP_AXIS, _TMP_AXIS);
    var rad = Math.acos(vec3.dot(_BASE, _TMP_AXIS));
    vec3.cross(_TMP_AXIS, _BASE, _TMP_AXIS);

    mat4.identity(_TMP_MAT);
    mat4.translate(_TMP_MAT, _TMP_MAT, vec3.transformMat4(_TMP_VEC, picking.getIntersectionPoint(), mesh.getMatrix()));
    mat4.rotate(_TMP_MAT, _TMP_MAT, rad, _TMP_AXIS);

    mat4.mul(_TMP_MATPV, camera.getProjection(), camera.getView());

    // circle mvp
    mat4.scale(this._cacheCircleMVP, _TMP_MAT, vec3.set(_TMP_VEC, worldRadius, worldRadius, worldRadius));
    mat4.mul(this._cacheCircleMVP, _TMP_MATPV, this._cacheCircleMVP);
    // inner circle mvp
    mat4.scale(this._cacheInnerCircleMVP, _TMP_MAT, vec3.set(_TMP_VEC, innerWorldRadius, innerWorldRadius, innerWorldRadius));
    mat4.mul(this._cacheInnerCircleMVP, _TMP_MATPV, this._cacheInnerCircleMVP);
    // dot mvp
    mat4.scale(this._cacheDotMVP, _TMP_MAT, vec3.set(_TMP_VEC, constRadius, constRadius, constRadius));
    mat4.mul(this._cacheDotMVP, _TMP_MATPV, this._cacheDotMVP);

    // symmetry mvp
    this._cacheDotSymMVPs = [];
    for (var i = 0; i < pickingSyms.length; ++i) {
      var sym = pickingSyms[i];
      vec3.transformMat4(_TMP_VEC, sym.getIntersectionPoint(), mesh.getMatrix());
      var m = mat4.create();
      mat4.identity(m);
      mat4.translate(m, m, _TMP_VEC);
      mat4.rotate(m, m, rad, _TMP_AXIS);
      mat4.scale(m, m, vec3.set(_TMP_VEC, constRadius, constRadius, constRadius));
      mat4.mul(m, _TMP_MATPV, m);
      this._cacheDotSymMVPs.push(m);
    }
    if (this._cacheDotSymMVPs.length > 0) {
      mat4.copy(this._cacheDotSymMVP, this._cacheDotSymMVPs[0]);
    }
  }

  render(main, camera, vpX) {
    if (main.getSplitMode()) {
      var isRightPanel = (vpX > 0);
      var panelIndex = isRightPanel ? 1 : 0;
      if (panelIndex !== main._activeViewport && !main._splitShowInactiveCursor) {
        this._isEditMode = false;
        return;
      }
    }

    camera = camera || main.getCamera();
    this._activeCamera = camera;
    // if there's an offset then it means we are editing the tool radius
    var pickedMesh = main.getPicking().getMesh() && !this._isEditMode;
    this._pickedMesh = pickedMesh;
    if (pickedMesh) this._updateMatricesMesh(camera, main);
    else this._updateMatricesBackground(camera, main);

    var toolIndex = main.getSculptManager().getToolIndex();
    var isTopology = toolIndex === Enums.Tools.TOPOLOGY;
    // For Topology tool always show rings, for others only when not actively sculpting
    var drawCircle = isTopology || main._action === Enums.Action.NOTHING;
    if (toolIndex === Enums.Tools.SMOOTH) {
      vec3.set(this._color, 0.0, drawCircle && pickedMesh ? 0.4 : 0.6, 0.8);
    } else if (toolIndex === Enums.Tools.MASKING) {
      vec3.set(this._color, 0.8, drawCircle && pickedMesh ? 0.8 : 0.9, 0.0);
    } else if (isTopology) {
      // Purple cursor for Topology tool
      vec3.set(this._color, 0.6, drawCircle && pickedMesh ? 0.0 : 0.2, 0.9);
    } else {
      vec3.set(this._color, 0.8, drawCircle && pickedMesh ? 0.0 : 0.4, 0.0);
    }
    this._isSquare = toolIndex === Enums.Tools.SQUARE_BRUSH;
    ShaderLib[Enums.Shader.SELECTION].getOrCreate(this._gl).draw(this, drawCircle, main.getSculptManager().getSymmetry(), !isTopology);

    this._isEditMode = false;
  }
}

export default Selection;
