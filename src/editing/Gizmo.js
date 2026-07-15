import { vec2, vec3, mat4, quat } from 'gl-matrix';
import Primitives from '../drawables/Primitives.js';
import Enums from '../misc/Enums.js';
import GuiSculptingTools from '../gui/GuiSculptingTools.js';

// configs colors
var COLOR_X = vec3.fromValues(0.7, 0.2, 0.2);
var COLOR_Y = vec3.fromValues(0.2, 0.7, 0.2);
var COLOR_Z = vec3.fromValues(0.2, 0.2, 0.7);
var COLOR_GREY = vec3.fromValues(0.4, 0.4, 0.4);
var COLOR_SW = vec3.fromValues(0.8, 0.4, 0.2);
var COLOR_YELLOW = vec3.fromValues(0.8, 0.8, 0.2);

var COLOR_X_SELECT = vec3.fromValues(1.0, 0.4, 0.4);
var COLOR_Y_SELECT = vec3.fromValues(0.4, 1.0, 0.4);
var COLOR_Z_SELECT = vec3.fromValues(0.4, 0.4, 1.0);
var COLOR_YELLOW_SELECT = vec3.fromValues(1.0, 1.0, 0.4);

function getSelectColor(color) {
  if (color === COLOR_X) return COLOR_X_SELECT;
  if (color === COLOR_Y) return COLOR_Y_SELECT;
  if (color === COLOR_Z) return COLOR_Z_SELECT;
  if (color === COLOR_YELLOW) return COLOR_YELLOW_SELECT;
  return vec3.fromValues(1.0, 1.0, 0.0);
}

// overall scale of the gizmo
var GIZMO_SIZE = 80.0;
// arrow
var ARROW_LENGTH = 2.5;
var ARROW_CONE_THICK = 6.0;
var ARROW_CONE_LENGTH = 0.25;
// thickness of tori and arrows
var THICKNESS = 0.02;
var THICKNESS_PICK = THICKNESS * 5.0;
// radius of tori
var ROT_RADIUS = 1.5;
var SCALE_RADIUS = ROT_RADIUS * 1.3;
// size of cubes
var CUBE_SIDE = 0.35;
var CUBE_SIDE_PICK = CUBE_SIDE * 1.2;

var _TMP_QUAT = quat.create();

var createGizmo = function (type, nbAxis = -1) {
  return {
    _finalMatrix: mat4.create(),
    _baseMatrix: mat4.create(),
    _color: vec3.create(),
    _colorSelect: vec3.fromValues(1.0, 1.0, 0.0),
    _drawGeo: null,
    _pickGeo: null,
    _isSelected: false,
    _type: type,
    _nbAxis: nbAxis,
    _lastInter: [0.0, 0.0, 0.0],
    updateMatrix() {
      mat4.copy(this._drawGeo.getMatrix(), this._finalMatrix);
      mat4.copy(this._pickGeo.getMatrix(), this._finalMatrix);
    },
    updateFinalMatrix(mat) {
      mat4.mul(this._finalMatrix, mat, this._baseMatrix);
    }
  };
};

// edit masks
var TRANS_X = 1 << 0;
var TRANS_Y = 1 << 1;
var TRANS_Z = 1 << 2;
var ROT_X = 1 << 3;
var ROT_Y = 1 << 4;
var ROT_Z = 1 << 5;
var ROT_W = 1 << 6;
var PLANE_X = 1 << 7;
var PLANE_Y = 1 << 8;
var PLANE_Z = 1 << 9;
var SCALE_X = 1 << 10;
var SCALE_Y = 1 << 11;
var SCALE_Z = 1 << 12;
var SCALE_W = 1 << 13;
var PLANE_W = 1 << 14;

var TRANS_XYZ = TRANS_X | TRANS_Y | TRANS_Z;
var ROT_XYZ = ROT_X | ROT_Y | ROT_Z;
var PLANE_XYZ = PLANE_X | PLANE_Y | PLANE_Z;
var SCALE_XYZW = SCALE_X | SCALE_Y | SCALE_Z | SCALE_W;

class Gizmo {
  static get TRANS_X() {
    return TRANS_X;
  }
  static get TRANS_Y() {
    return TRANS_Y;
  }
  static get TRANS_Z() {
    return TRANS_Z;
  }
  static get ROT_X() {
    return ROT_X;
  }
  static get ROT_Y() {
    return ROT_Y;
  }
  static get ROT_Z() {
    return ROT_Z;
  }
  static get ROT_W() {
    return ROT_W;
  }
  static get PLANE_X() {
    return PLANE_X;
  }
  static get PLANE_Y() {
    return PLANE_Y;
  }
  static get PLANE_Z() {
    return PLANE_Z;
  }
  static get SCALE_X() {
    return SCALE_X;
  }
  static get SCALE_Y() {
    return SCALE_Y;
  }
  static get SCALE_Z() {
    return SCALE_Z;
  }
  static get SCALE_W() {
    return SCALE_W;
  }
  static get PLANE_W() {
    return PLANE_W;
  }

  static get TRANS_XYZ() {
    return TRANS_XYZ;
  }
  static get ROT_XYZ() {
    return ROT_XYZ;
  }
  static get PLANE_XYZ() {
    return PLANE_XYZ;
  }
  static get SCALE_XYZW() {
    return SCALE_XYZW;
  }

  constructor(main) {
    this._main = main;
    this._gl = main._gl;

    // activated gizmos
    this._activatedType =
      Gizmo.TRANS_XYZ | Gizmo.ROT_XYZ | Gizmo.SCALE_XYZW | Gizmo.ROT_W | Gizmo.PLANE_W;

    // trans arrow 1 dim
    this._transX = createGizmo(Gizmo.TRANS_X, 0);
    this._transY = createGizmo(Gizmo.TRANS_Y, 1);
    this._transZ = createGizmo(Gizmo.TRANS_Z, 2);

    // trans plane 2 dim
    this._planeX = createGizmo(Gizmo.PLANE_X, 0);
    this._planeY = createGizmo(Gizmo.PLANE_Y, 1);
    this._planeZ = createGizmo(Gizmo.PLANE_Z, 2);

    // scale cube 1 dim
    this._scaleX = createGizmo(Gizmo.SCALE_X, 0);
    this._scaleY = createGizmo(Gizmo.SCALE_Y, 1);
    this._scaleZ = createGizmo(Gizmo.SCALE_Z, 2);
    // scale cube 3 dim
    this._scaleW = createGizmo(Gizmo.SCALE_W);

    // trans camera plane 2 dim
    this._planeW = createGizmo(Gizmo.PLANE_W);

    // rot arc 1 dim
    this._rotX = createGizmo(Gizmo.ROT_X, 0);
    this._rotY = createGizmo(Gizmo.ROT_Y, 1);
    this._rotZ = createGizmo(Gizmo.ROT_Z, 2);
    // full arc display
    this._rotW = createGizmo(Gizmo.ROT_W);

    // line helper
    this._lineHelper = Primitives.createLine2D(this._gl);
    this._lineHelper.setShaderType(Enums.Shader.FLAT);

    this._lastDistToEye = 0.0;
    this._isEditing = false;

    this._selected = null;
    this._pickables = [];

    // editing lines stuffs
    this._editLineOrigin = [0.0, 0.0, 0.0];
    this._editLineDirection = [0.0, 0.0, 0.0];
    this._editOffset = [0.0, 0.0, 0.0];

    // cached matrices when starting the editing operations
    this._editLocal = [];
    this._editTrans = mat4.create();
    this._editScaleRot = [];
    // same for inv
    this._editLocalInv = [];
    this._editTransInv = mat4.create();
    this._editScaleRotInv = [];
    this._editGizmoRot = mat4.create();
    this._editGizmoRotInv = mat4.create();

    this._initTranslate();
    this._initRotate();
    this._initScale();
    this._initPickables();
    this._initDomLock();
  }

  _checkMovingPivot() {
    if (this._isEditing) return this._isMovingPivot;
    var sculptMgr = this._main.getSculptManager();
    var transformTool = sculptMgr ? sculptMgr.getTool(Enums.Tools.TRANSFORM) : null;
    return !!(this._main._isAltDown || (transformTool && transformTool._editPivot));
  }

  setActivatedType(type) {
    this._activatedType = type;
    this._initPickables();
  }

  _initPickables() {
    var pickables = this._pickables;
    pickables.length = 0;
    var type = this._activatedType;

    if (type & TRANS_X) pickables.push(this._transX._pickGeo);
    if (type & TRANS_Y) pickables.push(this._transY._pickGeo);
    if (type & TRANS_Z) pickables.push(this._transZ._pickGeo);

    // if (type & PLANE_X) pickables.push(this._planeX._pickGeo);
    // if (type & PLANE_Y) pickables.push(this._planeY._pickGeo);
    // if (type & PLANE_Z) pickables.push(this._planeZ._pickGeo);

    if (type & ROT_X) pickables.push(this._rotX._pickGeo);
    if (type & ROT_Y) pickables.push(this._rotY._pickGeo);
    if (type & ROT_Z) pickables.push(this._rotZ._pickGeo);
    if (type & ROT_W) pickables.push(this._rotW._pickGeo);
    if (type & PLANE_W) pickables.push(this._planeW._pickGeo);

    if (type & SCALE_X) pickables.push(this._scaleX._pickGeo);
    if (type & SCALE_Y) pickables.push(this._scaleY._pickGeo);
    if (type & SCALE_Z) pickables.push(this._scaleZ._pickGeo);
    if (type & SCALE_W) pickables.push(this._scaleW._pickGeo);
  }

  _createArrow(tra, axis, color) {
    var mat = tra._baseMatrix;
    mat4.rotate(mat, mat, Math.PI * 0.5, axis);
    mat4.translate(mat, mat, [0.0, ARROW_LENGTH * 0.5, 0.0]);
    vec3.copy(tra._color, color);
    vec3.copy(tra._colorSelect, getSelectColor(color));

    tra._pickGeo = Primitives.createArrow(
      this._gl,
      THICKNESS_PICK,
      ARROW_LENGTH,
      ARROW_CONE_THICK * 0.4
    );
    tra._pickGeo._gizmo = tra;
    tra._drawGeo = Primitives.createArrow(
      this._gl,
      THICKNESS,
      ARROW_LENGTH,
      ARROW_CONE_THICK,
      ARROW_CONE_LENGTH
    );
    tra._drawGeo.setShaderType(Enums.Shader.FLAT);
  }

  _createPlane(pla, color, wx, wy, wz, hx, hy, hz) {
    vec3.copy(pla._color, color);
    vec3.copy(pla._colorSelect, getSelectColor(color));

    pla._pickGeo = Primitives.createPlane(this._gl, 0.0, 0.0, 0.0, wx, wy, wz, hx, hy, hz);
    pla._pickGeo._gizmo = pla;
    pla._drawGeo = Primitives.createPlane(this._gl, 0.0, 0.0, 0.0, wx, wy, wz, hx, hy, hz);
    pla._drawGeo.setShaderType(Enums.Shader.FLAT);
  }

  _initTranslate() {
    var axis = [0.0, 0.0, 0.0];
    this._createArrow(this._transX, vec3.set(axis, 0.0, 0.0, -1.0), COLOR_X);
    this._createArrow(this._transY, vec3.set(axis, 0.0, 1.0, 0.0), COLOR_Y);
    this._createArrow(this._transZ, vec3.set(axis, 1.0, 0.0, 0.0), COLOR_Z);

    var s = ARROW_LENGTH * 0.2;
    this._createPlane(this._planeX, COLOR_X, 0.0, s, 0.0, 0.0, 0.0, s);
    this._createPlane(this._planeY, COLOR_Y, s, 0.0, 0.0, 0.0, 0.0, s);
    this._createPlane(this._planeZ, COLOR_Z, s, 0.0, 0.0, 0.0, s, 0.0);

    // camera plane translation
    vec3.copy(this._planeW._color, COLOR_GREY);
    this._planeW._drawGeo = Primitives.createSquareCorners(this._gl, ROT_RADIUS, 0.4);
    this._planeW._drawGeo.setShaderType(Enums.Shader.FLAT);
    this._planeW._pickGeo = Primitives.createTorusXY(this._gl, Math.SQRT2 * ROT_RADIUS, THICKNESS_PICK * 2.0, Math.PI * 2, 6, 4, Math.PI * 0.25);
    this._planeW._pickGeo._gizmo = this._planeW;
    vec3.set(this._planeW._colorSelect, 1.0, 1.0, 1.0);
  }

  _createCircle(rot, rad, color, radius = ROT_RADIUS, mthick = 1.0, nbRadial = 6, nbTubular = 64) {
    vec3.copy(rot._color, color);
    vec3.copy(rot._colorSelect, getSelectColor(color));
    rot._pickGeo = Primitives.createTorus(
      this._gl,
      radius,
      THICKNESS_PICK * mthick,
      rad,
      nbRadial,
      nbTubular
    );
    rot._pickGeo._gizmo = rot;
    rot._drawGeo = Primitives.createTorus(this._gl, radius, THICKNESS * mthick, rad, nbRadial, nbTubular);
    rot._drawGeo.setShaderType(Enums.Shader.FLAT);
  }

  _createCenterCube(sca, color, side) {
    vec3.copy(sca._color, color);
    vec3.copy(sca._colorSelect, getSelectColor(color));
    sca._pickGeo = Primitives.createCube(this._gl, side * 1.2);
    sca._pickGeo._gizmo = sca;
    sca._drawGeo = Primitives.createCube(this._gl, side);
    sca._drawGeo.setShaderType(Enums.Shader.FLAT);
  }

  _initRotate() {
    this._createCircle(this._rotX, Math.PI * 2, COLOR_X);
    this._createCircle(this._rotY, Math.PI * 2, COLOR_Y);
    this._createCircle(this._rotZ, Math.PI * 2, COLOR_Z);
    this._createCircle(this._rotW, Math.PI * 2, COLOR_GREY);
    vec3.set(this._rotW._colorSelect, 1.0, 1.0, 1.0);
  }

  _createCube(sca, axis, color) {
    var mat = sca._baseMatrix;
    mat4.rotate(mat, mat, Math.PI * 0.5, axis);
    mat4.translate(mat, mat, [0.0, ROT_RADIUS, 0.0]);
    vec3.copy(sca._color, color);
    vec3.copy(sca._colorSelect, getSelectColor(color));
    sca._pickGeo = Primitives.createCube(this._gl, CUBE_SIDE_PICK);
    sca._pickGeo._gizmo = sca;
    sca._drawGeo = Primitives.createCube(this._gl, CUBE_SIDE);
    sca._drawGeo.setShaderType(Enums.Shader.FLAT);
  }

  _initScale() {
    var axis = [0.0, 0.0, 0.0];
    this._createCube(this._scaleX, vec3.set(axis, 0.0, 0.0, -1.0), COLOR_X);
    this._createCube(this._scaleY, vec3.set(axis, 0.0, 1.0, 0.0), COLOR_Y);
    this._createCube(this._scaleZ, vec3.set(axis, 1.0, 0.0, 0.0), COLOR_Z);
    this._createCenterCube(this._scaleW, COLOR_YELLOW, 0.5);
  }

  _updateArcRotation(eye, camera) {
    // xyz arc
    _TMP_QUAT[0] = eye[2];
    _TMP_QUAT[1] = 0.0;
    _TMP_QUAT[2] = -eye[0];
    _TMP_QUAT[3] = 1.0 + eye[1];
    quat.normalize(_TMP_QUAT, _TMP_QUAT);
    mat4.fromQuat(this._rotW._baseMatrix, _TMP_QUAT);

    var V = camera.getView();
    var mat = this._planeW._baseMatrix;
    mat4.identity(mat);
    mat[0] = V[0]; mat[1] = V[4]; mat[2] = V[8];
    mat[4] = V[1]; mat[5] = V[5]; mat[6] = V[9];
    mat[8] = V[2]; mat[9] = V[6]; mat[10] = V[10];

    // x arc
    quat.rotateZ(_TMP_QUAT, quat.identity(_TMP_QUAT), Math.PI * 0.5);
    quat.rotateY(_TMP_QUAT, _TMP_QUAT, Math.atan2(-eye[1], -eye[2]));
    mat4.fromQuat(this._rotX._baseMatrix, _TMP_QUAT);

    // y arc
    quat.rotateY(_TMP_QUAT, quat.identity(_TMP_QUAT), Math.atan2(-eye[0], -eye[2]));
    mat4.fromQuat(this._rotY._baseMatrix, _TMP_QUAT);

    // z arc
    quat.rotateX(_TMP_QUAT, quat.identity(_TMP_QUAT), Math.PI * 0.5);
    quat.rotateY(_TMP_QUAT, _TMP_QUAT, Math.atan2(-eye[0], eye[1]));
    mat4.fromQuat(this._rotZ._baseMatrix, _TMP_QUAT);
  }

  _computeCenterGizmo(center = [0.0, 0.0, 0.0]) {
    var meshes = this._main.getSelectedMeshes();

    var acc = [0.0, 0.0, 0.0];
    var icenter = [0.0, 0.0, 0.0];
    for (var i = 0; i < meshes.length; ++i) {
      var mesh = meshes[i];
      vec3.transformMat4(icenter, mesh.getCenter(), mesh.getEditMatrix());
      vec3.transformMat4(icenter, icenter, mesh.getMatrix());
      vec3.add(acc, acc, icenter);
    }
    vec3.scale(center, acc, 1.0 / meshes.length);
    return center;
  }

  _updateMatrices(camera) {
    camera = camera || this._main.getCamera();
    var trMesh = this._computeCenterGizmo();
    var eye = camera.computePosition();

    this._lastDistToEye = this._isEditing ? this._lastDistToEye : vec3.dist(eye, trMesh);
    var scaleFactor = (this._lastDistToEye * GIZMO_SIZE) / camera.getConstantScreen();

    var traScale = mat4.create();
    mat4.translate(traScale, traScale, trMesh);

    var traScaleCamera = mat4.create();
    mat4.translate(traScaleCamera, traScaleCamera, trMesh);

    // Apply rotation from the mesh
    var mesh = this._main.getMesh();
    if (mesh) {
      var meshMat = mat4.create();
      var isMovingPivot = this._checkMovingPivot();
      if (isMovingPivot && mesh._pivotEditMatrix) {
        mat4.mul(meshMat, mesh.getMatrix(), mesh._pivotEditMatrix);
      } else {
        mat4.copy(meshMat, mesh.getMatrix());
      }
      var rotMesh = mat4.create();
      mat4.copy(rotMesh, meshMat);
      rotMesh[12] = rotMesh[13] = rotMesh[14] = 0.0;

      // Orthonormalize rotation matrix to strip scale
      var col1 = [rotMesh[0], rotMesh[1], rotMesh[2]];
      var col2 = [rotMesh[4], rotMesh[5], rotMesh[6]];
      var col3 = [rotMesh[8], rotMesh[9], rotMesh[10]];
      vec3.normalize(col1, col1);
      vec3.normalize(col2, col2);
      vec3.normalize(col3, col3);
      rotMesh[0] = col1[0]; rotMesh[1] = col1[1]; rotMesh[2] = col1[2];
      rotMesh[4] = col2[0]; rotMesh[5] = col2[1]; rotMesh[6] = col2[2];
      rotMesh[8] = col3[0]; rotMesh[9] = col3[1]; rotMesh[10] = col3[2];

      mat4.mul(traScale, traScale, rotMesh);
    }

    mat4.scale(traScale, traScale, [scaleFactor, scaleFactor, scaleFactor]);
    mat4.scale(traScaleCamera, traScaleCamera, [scaleFactor, scaleFactor, scaleFactor]);

    // manage arc stuffs
    this._updateArcRotation(vec3.normalize(eye, vec3.sub(eye, trMesh, eye)), camera);

    this._transX.updateFinalMatrix(traScale);
    this._transY.updateFinalMatrix(traScale);
    this._transZ.updateFinalMatrix(traScale);

    this._planeW.updateFinalMatrix(traScaleCamera);

    // this._planeX.updateFinalMatrix(traScale);
    // this._planeY.updateFinalMatrix(traScale);
    // this._planeZ.updateFinalMatrix(traScale);

    this._rotX.updateFinalMatrix(traScale);
    this._rotY.updateFinalMatrix(traScale);
    this._rotZ.updateFinalMatrix(traScale);
    this._rotW.updateFinalMatrix(traScaleCamera);

    this._scaleX.updateFinalMatrix(traScale);
    this._scaleY.updateFinalMatrix(traScale);
    this._scaleZ.updateFinalMatrix(traScale);
    this._scaleW.updateFinalMatrix(traScale);
  }

  _drawGizmo(elt, camera) {
    camera = camera || this._main.getCamera();
    elt.updateMatrix();
    var drawGeo = elt._drawGeo;
    drawGeo.setFlatColor(elt._isSelected ? elt._colorSelect : elt._color);
    drawGeo.updateMatrices(camera);
    drawGeo.render(this._main);
  }

  _updateLineHelper(x1, y1, x2, y2) {
    var vAr = this._lineHelper.getVertices();
    var main = this._main;
    var width = main.getCanvasWidth();
    var height = main.getCanvasHeight();
    vAr[0] = (x1 / width) * 2.0 - 1.0;
    vAr[1] = ((height - y1) / height) * 2.0 - 1.0;
    vAr[3] = (x2 / width) * 2.0 - 1.0;
    vAr[4] = ((height - y2) / height) * 2.0 - 1.0;
    this._lineHelper.updateVertexBuffer();
  }

  _saveEditMatrices() {
    var meshes = this._main.getSelectedMeshes();

    if (this._isMovingPivot) {
      this._editMeshCentersStart = [];
    }

    // translation part
    var center = this._computeCenterGizmo();
    mat4.translate(this._editTrans, mat4.identity(this._editTrans), center);
    mat4.invert(this._editTransInv, this._editTrans);

    for (var i = 0; i < meshes.length; ++i) {
      this._editLocal[i] = mat4.create();
      this._editScaleRot[i] = mat4.create();
      this._editLocalInv[i] = mat4.create();
      this._editScaleRotInv[i] = mat4.create();

      // mesh local matrix
      mat4.copy(this._editLocal[i], meshes[i].getMatrix());

      // rotation + scale part
      mat4.copy(this._editScaleRot[i], this._editLocal[i]);
      this._editScaleRot[i][12] = this._editScaleRot[i][13] = this._editScaleRot[i][14] = 0.0;

      // precomputes the invert
      mat4.invert(this._editLocalInv[i], this._editLocal[i]);
      mat4.invert(this._editScaleRotInv[i], this._editScaleRot[i]);

      if (this._isMovingPivot) {
        this._editMeshCentersStart[i] = vec3.copy([0.0, 0.0, 0.0], meshes[i].getCenter());
      }
    }

    mat4.identity(this._editGizmoRot);
    mat4.identity(this._editGizmoRotInv);
    var mesh = this._main.getMesh();
    if (mesh) {
      var meshMat = mat4.create();
      if (this._isMovingPivot && mesh._pivotEditMatrix) {
        mat4.mul(meshMat, mesh.getMatrix(), mesh._pivotEditMatrix);
      } else {
        mat4.copy(meshMat, mesh.getMatrix());
      }
      var rotMesh = this._editGizmoRot;
      mat4.copy(rotMesh, meshMat);
      rotMesh[12] = rotMesh[13] = rotMesh[14] = 0.0;

      // Orthonormalize rotation matrix to strip scale
      var col1 = [rotMesh[0], rotMesh[1], rotMesh[2]];
      var col2 = [rotMesh[4], rotMesh[5], rotMesh[6]];
      var col3 = [rotMesh[8], rotMesh[9], rotMesh[10]];
      vec3.normalize(col1, col1);
      vec3.normalize(col2, col2);
      vec3.normalize(col3, col3);
      rotMesh[0] = col1[0]; rotMesh[1] = col1[1]; rotMesh[2] = col1[2];
      rotMesh[4] = col2[0]; rotMesh[5] = col2[1]; rotMesh[6] = col2[2];
      rotMesh[8] = col3[0]; rotMesh[9] = col3[1]; rotMesh[10] = col3[2];

      mat4.invert(this._editGizmoRotInv, rotMesh);
    }
  }

  _startRotateEdit() {
    var main = this._main;
    var camera = main.getCamera();

    // 3d origin (center of gizmo)
    var projCenter = [0.0, 0.0, 0.0];
    this._computeCenterGizmo(projCenter);
    vec3.copy(projCenter, camera.project(projCenter));

    this._editProjCenter = vec2.clone(projCenter);
    this._editAngleStart = Math.atan2(main._mouseY - projCenter[1], main._mouseX - projCenter[0]);

    if (this._selected._type === Gizmo.ROT_W) {
      var trMesh = [0.0, 0.0, 0.0];
      this._computeCenterGizmo(trMesh);
      var eye = camera.computePosition();
      this._editRotateAxis = vec3.normalize(vec3.create(), vec3.sub(eye, trMesh, eye));
      return;
    }

    // Compute the sign of the rotation relative to the camera viewpoint
    var nbAxis = this._selected._nbAxis;
    var trMesh = [0.0, 0.0, 0.0];
    this._computeCenterGizmo(trMesh);
    var eye = camera.computePosition();
    var eyeDir = vec3.sub(vec3.create(), eye, trMesh);
    vec3.normalize(eyeDir, eyeDir);

    var axisDir = vec3.fromValues(
      this._editGizmoRot[nbAxis * 4],
      this._editGizmoRot[nbAxis * 4 + 1],
      this._editGizmoRot[nbAxis * 4 + 2]
    );

    this._editRotateSign = vec3.dot(axisDir, eyeDir) < 0.0 ? -1.0 : 1.0;
  }

  _startTranslateEdit() {
    var main = this._main;
    var camera = main.getCamera();

    var origin = this._editLineOrigin;
    var dir = this._editLineDirection;

    // 3d origin (center of gizmo)
    this._computeCenterGizmo(origin);

    // 3d direction
    var nbAxis = this._selected._nbAxis;
    if (nbAxis !== -1) {
      var mesh = main.getMesh();
      if (mesh) {
        var meshMat = mat4.create();
        if (this._isMovingPivot && mesh._pivotEditMatrix) {
          mat4.mul(meshMat, mesh.getMatrix(), mesh._pivotEditMatrix);
        } else {
          mat4.copy(meshMat, mesh.getMatrix());
        }
        var offsetIndex = nbAxis * 4;
        vec3.set(dir, meshMat[offsetIndex], meshMat[offsetIndex + 1], meshMat[offsetIndex + 2]);
        vec3.normalize(dir, dir);
      } else {
        vec3.set(dir, 0.0, 0.0, 0.0)[nbAxis] = 1.0;
      }
    }
    vec3.add(dir, origin, dir);

    // project on screen and get a 2D line
    vec3.copy(origin, camera.project(origin));
    vec3.copy(dir, camera.project(dir));

    vec2.normalize(dir, vec2.sub(dir, dir, origin));

    var offset = this._editOffset;
    offset[0] = main._mouseX - origin[0];
    offset[1] = main._mouseY - origin[1];
  }

  _startPlaneEdit() {
    var main = this._main;
    var camera = main.getCamera();

    var origin = this._editLineOrigin;

    // 3d origin (center of gizmo)
    this._computeCenterGizmo(origin);

    if (this._selected._type === Gizmo.PLANE_W) {
      var eye = camera.computePosition();
      this._editPlaneNormal = vec3.normalize(vec3.create(), vec3.sub(eye, origin, eye));
    }

    vec3.copy(origin, camera.project(origin));

    var offset = this._editOffset;
    offset[0] = main._mouseX - origin[0];
    offset[1] = main._mouseY - origin[1];
    vec2.set(this._editLineOrigin, main._mouseX, main._mouseY);
  }

  _startScaleEdit() {
    this._startTranslateEdit();
    this._editScaleMouseStart = [this._main._mouseX, this._main._mouseY];
  }

  _updateRotateEdit() {
    var main = this._main;
    var meshes = this._main.getSelectedMeshes();

    this._updateLineHelper(
      this._editProjCenter[0],
      this._editProjCenter[1],
      main._mouseX,
      main._mouseY
    );

    var currentAngle = Math.atan2(main._mouseY - this._editProjCenter[1], main._mouseX - this._editProjCenter[0]);
    var angle = currentAngle - this._editAngleStart;

    if (this._selected._type === Gizmo.ROT_W) {
      for (var i = 0; i < meshes.length; ++i) {
        var mrot = this._isMovingPivot ? (meshes[i]._pivotEditMatrix || (meshes[i]._pivotEditMatrix = mat4.create())) : meshes[i].getEditMatrix();
        mat4.identity(mrot);
        mat4.rotate(mrot, mrot, angle, this._editRotateAxis);
        this._scaleRotateEditMatrix(mrot, i);
        if (this._isMovingPivot) {
          mat4.identity(meshes[i].getEditMatrix());
        }
      }
    } else {
      var nbAxis = this._selected._nbAxis;
      var rotAngle = -angle * this._editRotateSign;

      for (var i = 0; i < meshes.length; ++i) {
        var mrot = this._isMovingPivot ? (meshes[i]._pivotEditMatrix || (meshes[i]._pivotEditMatrix = mat4.create())) : meshes[i].getEditMatrix();
        mat4.identity(mrot);
        if (nbAxis === 0) mat4.rotateX(mrot, mrot, rotAngle);
        else if (nbAxis === 1) mat4.rotateY(mrot, mrot, rotAngle);
        else if (nbAxis === 2) mat4.rotateZ(mrot, mrot, rotAngle);

        var tmp = mat4.create();
        mat4.mul(tmp, this._editGizmoRot, mrot);
        mat4.mul(mrot, tmp, this._editGizmoRotInv);

        this._scaleRotateEditMatrix(mrot, i);
        if (this._isMovingPivot) {
          mat4.identity(meshes[i].getEditMatrix());
        }
      }
    }

    main.render();
  }

  _updateTranslateEdit() {
    var main = this._main;
    var camera = main.getCamera();

    var origin = this._editLineOrigin;
    var dir = this._editLineDirection;

    var vec = [main._mouseX, main._mouseY, 0.0];
    vec2.sub(vec, vec, origin);
    vec2.sub(vec, vec, this._editOffset);
    vec2.scaleAndAdd(vec, origin, dir, vec2.dot(vec, dir));

    // helper line
    this._updateLineHelper(origin[0], origin[1], vec[0], vec[1]);

    var near = camera.unproject(vec[0], vec[1], 0.0);
    var far = camera.unproject(vec[0], vec[1], 0.1);

    vec3.transformMat4(near, near, this._editTransInv);
    vec3.transformMat4(far, far, this._editTransInv);

    // intersection line line
    vec3.normalize(vec, vec3.sub(vec, far, near));

    var nbAxis = this._selected._nbAxis;
    var axisDir = [0.0, 0.0, 0.0];
    var mesh = main.getMesh();
    if (mesh) {
      var meshMat = mat4.create();
      if (this._isMovingPivot && mesh._pivotEditMatrix) {
        mat4.mul(meshMat, mesh.getMatrix(), mesh._pivotEditMatrix);
      } else {
        mat4.copy(meshMat, mesh.getMatrix());
      }
      var offsetIndex = nbAxis * 4;
      vec3.set(axisDir, meshMat[offsetIndex], meshMat[offsetIndex + 1], meshMat[offsetIndex + 2]);
      vec3.normalize(axisDir, axisDir);
    } else {
      axisDir[nbAxis] = 1.0;
    }

    var a01 = -vec3.dot(vec, axisDir);
    var b0 = vec3.dot(near, vec);
    var det = Math.abs(1.0 - a01 * a01);

    var b1 = -vec3.dot(near, axisDir);
    var t = (a01 * b0 - b1) / det;

    var inter = [0.0, 0.0, 0.0];
    vec3.scale(inter, axisDir, t);

    this._updateMatrixTranslate(inter);

    main.render();
  }

  _updatePlaneEdit() {
    var main = this._main;
    var camera = main.getCamera();

    var vec = [main._mouseX, main._mouseY, 0.0];
    vec2.sub(vec, vec, this._editOffset);

    // helper line
    this._updateLineHelper(
      this._editLineOrigin[0],
      this._editLineOrigin[1],
      main._mouseX,
      main._mouseY
    );

    var near = camera.unproject(vec[0], vec[1], 0.0);
    var far = camera.unproject(vec[0], vec[1], 0.1);

    vec3.transformMat4(near, near, this._editTransInv);
    vec3.transformMat4(far, far, this._editTransInv);

    // intersection line plane
    var normal = [0.0, 0.0, 0.0];
    if (this._selected._type === Gizmo.PLANE_W) {
      vec3.copy(normal, this._editPlaneNormal);
    } else {
      var nbAxis = this._selected._nbAxis;
      var mesh = main.getMesh();
      if (mesh) {
        var meshMat = mat4.create();
        if (this._isMovingPivot && mesh._pivotEditMatrix) {
          mat4.mul(meshMat, mesh.getMatrix(), mesh._pivotEditMatrix);
        } else {
          mat4.copy(meshMat, mesh.getMatrix());
        }
        var offsetIndex = nbAxis * 4;
        vec3.set(normal, meshMat[offsetIndex], meshMat[offsetIndex + 1], meshMat[offsetIndex + 2]);
        vec3.normalize(normal, normal);
      } else {
        normal[nbAxis] = 1.0;
      }
    }

    var dist1 = vec3.dot(near, normal);
    var dist2 = vec3.dot(far, normal);
    // ray coplanar to plane
    if (dist1 === dist2) return false;

    // intersection between ray and plane
    var val = -dist1 / (dist2 - dist1);
    var inter = [
      near[0] + (far[0] - near[0]) * val,
      near[1] + (far[1] - near[1]) * val,
      near[2] + (far[2] - near[2]) * val
    ];

    this._updateMatrixTranslate(inter);

    main.render();
  }

  _updateMatrixTranslate(inter) {
    var tmp = [0, 0, 0];

    var meshes = this._main.getSelectedMeshes();
    for (var i = 0; i < meshes.length; ++i) {
      vec3.transformMat4(tmp, inter, this._editScaleRotInv[i]);

      var edim = meshes[i].getEditMatrix();
      mat4.identity(edim);

      if (this._isMovingPivot) {
        if (this._editMeshCentersStart && this._editMeshCentersStart[i]) {
          vec3.add(meshes[i].getCenter(), this._editMeshCentersStart[i], tmp);
        }
      } else {
        mat4.translate(edim, edim, tmp);
      }
    }
  }

  _updateScaleEdit() {
    var main = this._main;
    var mesh = main.getMesh();
    var meshes = this._main.getSelectedMeshes();

    if (this._isMovingPivot) {
      for (var i = 0; i < meshes.length; ++i) {
        mat4.identity(meshes[i].getEditMatrix());
      }
      main.render();
      return;
    }

    var origin = this._editLineOrigin;
    var dir = this._editLineDirection;
    var nbAxis = this._selected._nbAxis;

    var vec = [main._mouseX, main._mouseY, 0.0];
    if (nbAxis !== -1) {
      vec2.sub(vec, vec, origin);
      vec2.scaleAndAdd(vec, origin, dir, vec2.dot(vec, dir));
    }

    // helper line
    this._updateLineHelper(origin[0], origin[1], vec[0], vec[1]);

    var distOffset = vec3.len(this._editOffset);
    var inter = [1.0, 1.0, 1.0];
    var scaleMult = 0.0;
    if (nbAxis === -1) {
      var dx = main._mouseX - this._editScaleMouseStart[0];
      var dy = main._mouseY - this._editScaleMouseStart[1];
      scaleMult = (dx - dy) * 0.005;
    } else {
      scaleMult = (vec2.dist(origin, vec) - distOffset) / distOffset;
    }
    scaleMult = Math.max(-0.99, scaleMult);

    if (nbAxis === -1) {
      inter[0] += scaleMult;
      inter[1] += scaleMult;
      inter[2] += scaleMult;
    } else {
      inter[nbAxis] += scaleMult;
    }

    var meshes = this._main.getSelectedMeshes();
    for (var i = 0; i < meshes.length; ++i) {
      var edim = meshes[i].getEditMatrix();
      mat4.identity(edim);
      mat4.scale(edim, edim, inter);

      var tmp = mat4.create();
      mat4.mul(tmp, this._editGizmoRot, edim);
      mat4.mul(edim, tmp, this._editGizmoRotInv);

      this._scaleRotateEditMatrix(edim, i);
    }

    main.render();
  }

  _scaleRotateEditMatrix(edit, i) {
    mat4.mul(edit, this._editTrans, edit);
    mat4.mul(edit, edit, this._editTransInv);

    mat4.mul(edit, this._editLocalInv[i], edit);
    mat4.mul(edit, edit, this._editLocal[i]);
  }

  addGizmoToScene(scene) {
    scene.push(this._transX._drawGeo);
    scene.push(this._transY._drawGeo);
    scene.push(this._transZ._drawGeo);

    // scene.push(this._planeX._drawGeo);
    // scene.push(this._planeY._drawGeo);
    // scene.push(this._planeZ._drawGeo);

    scene.push(this._rotX._drawGeo);
    scene.push(this._rotY._drawGeo);
    scene.push(this._rotZ._drawGeo);
    scene.push(this._rotW._drawGeo);

    scene.push(this._planeW._drawGeo);

    scene.push(this._scaleX._drawGeo);
    scene.push(this._scaleY._drawGeo);
    scene.push(this._scaleZ._drawGeo);
    scene.push(this._scaleW._drawGeo);

    return scene;
  }

  render(camera) {
    this._updateMatrices(camera);
    this._updateDomLockPosition(camera);

    var isMovingPivot = this._checkMovingPivot();
    var type = (this._isEditing && this._selected && !isMovingPivot) ? this._selected._type : this._activatedType;

    if (isMovingPivot) {
      type &= ~Gizmo.SCALE_XYZW;
    }

    if (type & ROT_W) this._drawGizmo(this._rotW, camera);
    if (type & PLANE_W) this._drawGizmo(this._planeW, camera);

    if (type & TRANS_X) this._drawGizmo(this._transX, camera);
    if (type & TRANS_Y) this._drawGizmo(this._transY, camera);
    if (type & TRANS_Z) this._drawGizmo(this._transZ, camera);

    // if (type & PLANE_X) this._drawGizmo(this._planeX, camera);
    // if (type & PLANE_Y) this._drawGizmo(this._planeY, camera);
    // if (type & PLANE_Z) this._drawGizmo(this._planeZ, camera);

    if (type & ROT_X) this._drawGizmo(this._rotX, camera);
    if (type & ROT_Y) this._drawGizmo(this._rotY, camera);
    if (type & ROT_Z) this._drawGizmo(this._rotZ, camera);

    if (type & SCALE_X) this._drawGizmo(this._scaleX, camera);
    if (type & SCALE_Y) this._drawGizmo(this._scaleY, camera);
    if (type & SCALE_Z) this._drawGizmo(this._scaleZ, camera);
    if (type & SCALE_W) this._drawGizmo(this._scaleW, camera);

    if (this._isEditing) this._lineHelper.render(this._main);
  }

  onMouseOver() {
    if (this._isEditing) {
      var type = this._selected._type;
      if (type & (ROT_XYZ | ROT_W)) this._updateRotateEdit();
      else if (type & TRANS_XYZ) this._updateTranslateEdit();
      else if (type & (PLANE_XYZ | PLANE_W)) this._updatePlaneEdit();
      else if (type & SCALE_XYZW) this._updateScaleEdit();

      return true;
    }

    var main = this._main;
    var picking = main.getPicking();
    var mx = main._mouseX;
    var my = main._mouseY;
    var pickables = this._pickables;

    if (this._checkMovingPivot()) {
      pickables = pickables.filter(p => !(p._gizmo._type & Gizmo.SCALE_XYZW));
    }

    picking.intersectionMouseMeshes(pickables, mx, my);

    if (this._selected) this._selected._isSelected = false;
    var geo = picking.getMesh();
    if (!geo) {
      this._selected = null;
      return false;
    }

    this._selected = geo._gizmo;
    this._selected._isSelected = true;
    vec3.copy(this._selected._lastInter, picking.getIntersectionPoint());
    return true;
  }

  onMouseDown() {
    var sel = this._selected;
    if (!sel) return false;

    this._isMovingPivot = this._checkMovingPivot();
    this._isEditing = true;
    var type = sel._type;
    this._saveEditMatrices();

    if (type & (ROT_XYZ | ROT_W)) this._startRotateEdit();
    else if (type & TRANS_XYZ) this._startTranslateEdit();
    else if (type & (PLANE_XYZ | PLANE_W)) this._startPlaneEdit();
    else if (type & SCALE_XYZW) this._startScaleEdit();

    return true;
  }

  onMouseUp() {
    this._isEditing = false;
  }

  _initDomLock() {
    this._domLock = document.createElement('div');
    this._domLock.style.position = 'absolute';
    this._domLock.style.zIndex = '101'; // above SVG overlays
    this._domLock.style.cursor = 'pointer';
    this._domLock.style.width = '20px';
    this._domLock.style.height = '20px';
    this._domLock.style.borderRadius = '50%';
    this._domLock.style.display = 'none'; // hidden by default
    this._domLock.style.alignItems = 'center';
    this._domLock.style.justifyContent = 'center';
    this._domLock.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
    this._domLock.style.transition = 'background-color 0.15s, transform 0.15s';

    this._domLock.addEventListener('mouseenter', () => {
      this._domLock.style.transform = 'scale(1.15)';
    });
    this._domLock.addEventListener('mouseleave', () => {
      this._domLock.style.transform = 'scale(1.0)';
    });

    this._domLock.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    this._domLock.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      var sculptMgr = this._main.getSculptManager();
      var transformTool = sculptMgr ? sculptMgr.getTool(Enums.Tools.TRANSFORM) : null;
      if (transformTool) {
        transformTool._editPivot = !transformTool._editPivot;
        var transformGui = GuiSculptingTools.tools[Enums.Tools.TRANSFORM];
        if (transformGui && transformGui.updateButton) {
          transformGui.updateButton();
        }
        this.updateLockIcon();
        this._main.render();
      }
    });

    this._main.getViewport().appendChild(this._domLock);
    this.updateLockIcon();
  }

  updateLockIcon() {
    if (!this._domLock) return;
    var editPivot = this._checkMovingPivot();
    if (editPivot) {
      this._domLock.style.backgroundColor = '#d32f2f';
      this._domLock.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
        </svg>
      `;
    } else {
      this._domLock.style.backgroundColor = 'rgba(30, 30, 30, 0.8)';
      this._domLock.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      `;
    }
  }

  hideDomLock() {
    if (this._domLock) {
      this._domLock.style.display = 'none';
    }
  }

  onDeactivate() {
    this.hideDomLock();
  }

  destroy() {
    if (this._domLock && this._domLock.parentNode) {
      this._domLock.parentNode.removeChild(this._domLock);
    }
    this._domLock = null;
  }

  _updateDomLockPosition(camera) {
    if (!this._domLock) return;

    var mesh = this._main.getMesh();
    if (!mesh || this._isEditing) {
      this._domLock.style.display = 'none';
      return;
    }

    var center = [0.0, 0.0, 0.0];
    this._computeCenterGizmo(center);

    camera = camera || this._main.getCamera();
    var proj = camera.project2DAware(center);
    var pixelRatio = this._main.getPixelRatio();

    var x = proj[0] / pixelRatio;
    var y = proj[1] / pixelRatio;

    var width = this._main.getCanvasWidth() / pixelRatio;
    var height = this._main.getCanvasHeight() / pixelRatio;

    var isSplit = this._main.getSplitMode();
    if (isSplit) {
      var halfW = Math.floor(width / 2);
      var activeVp = this._main._activeViewport;
      if (activeVp === 0 && (x < 0 || x > halfW)) {
        this._domLock.style.display = 'none';
        return;
      }
      if (activeVp === 1 && (x < halfW || x > width)) {
        this._domLock.style.display = 'none';
        return;
      }
    } else {
      if (x < 0 || x > width || y < 0 || y > height) {
        this._domLock.style.display = 'none';
        return;
      }
    }

    if (proj[2] < 0.0 || proj[2] > 1.0) {
      this._domLock.style.display = 'none';
      return;
    }

    this._domLock.style.display = 'flex';
    this._domLock.style.left = (x - 10 + 48) + 'px';
    this._domLock.style.top = (y - 10 - 86) + 'px';
  }
}

export default Gizmo;
