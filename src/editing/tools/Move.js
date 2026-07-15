import { vec3, mat4 } from 'gl-matrix';
import Geometry from '../../math3d/Geometry.js';
import SculptBase from './SculptBase.js';

class Move extends SculptBase {

  constructor(main) {
    super(main);

    this._radius = 150;
    this._intensity = 0.5;
    this._topoCheck = true;
    this._negative = false; // along normal
    this._focalShift = 0.6;
    this._moveData = {
      center: [0.0, 0.0, 0.0],
      dir: [0.0, 0.0],
      vProxy: null
    };
    this._moveDataSym = {
      center: [0.0, 0.0, 0.0],
      dir: [0.0, 0.0],
      vProxy: null
    };
    this._idAlpha = 0;
  }


  getFallOff(dist) {
    if (dist >= 1.0) return 0.0;
    var focalShift = this._focalShift;
    var base = 1.0 - dist * dist;
    var exponent = Math.pow(2.0, (focalShift - 0.6) * 2.0) * 3.0;
    return Math.pow(base, exponent);
  }

  startSculpt() {
    var main = this._main;
    var picking = main.getPicking();
    this.initMoveData(picking, this._moveData);

    if (main.getSculptManager().getSymmetry()) {
      var pickingSym = main.getPickingSymmetry();
      pickingSym.intersectionMouseMesh();
      pickingSym.setLocalRadius2(picking.getLocalRadius2());

      if (pickingSym.getMesh())
        this.initMoveData(pickingSym, this._moveDataSym);
    }
  }

  initMoveData(picking, moveData) {
    if (this._topoCheck)
      picking.pickVerticesInSphereTopological(picking.getLocalRadius2());
    else
      picking.pickVerticesInSphere(picking.getLocalRadius2());
    vec3.copy(moveData.center, picking.getIntersectionPoint());
    var iVerts = picking.getPickedVertices();
    // undo-redo
    this._main.getStateManager().pushVertices(iVerts);

    var vAr = picking.getMesh().getVertices();
    var nbVerts = iVerts.length;
    var vProxy = moveData.vProxy = new Float32Array(nbVerts * 3);
    for (var i = 0; i < nbVerts; ++i) {
      var ind = iVerts[i] * 3;
      var j = i * 3;
      vProxy[j] = vAr[ind];
      vProxy[j + 1] = vAr[ind + 1];
      vProxy[j + 2] = vAr[ind + 2];
    }
  }

  copyVerticesProxy(picking, moveData) {
    var iVerts = picking.getPickedVertices();
    var vAr = this.getMesh().getVertices();
    var vProxy = moveData.vProxy;
    for (var i = 0, nbVerts = iVerts.length; i < nbVerts; ++i) {
      var ind = iVerts[i] * 3;
      var j = i * 3;
      vAr[ind] = vProxy[j];
      vAr[ind + 1] = vProxy[j + 1];
      vAr[ind + 2] = vProxy[j + 2];
    }
  }

  sculptStroke() {
    var main = this._main;
    var picking = main.getPicking();
    var pickingSym = main.getPickingSymmetry();
    var useSym = main.getSculptManager().getSymmetry() && pickingSym.getMesh();

    picking.updateAlpha(this._lockPosition);
    picking.setIdAlpha(this._idAlpha);
    if (useSym) {
      pickingSym.updateAlpha(false);
      pickingSym.setIdAlpha(this._idAlpha);
    }

    this.copyVerticesProxy(picking, this._moveData);
    if (useSym)
      this.copyVerticesProxy(pickingSym, this._moveDataSym);

    var mouseX = main._mouseX;
    var mouseY = main._mouseY;
    this.updateMoveDir(picking, mouseX, mouseY);
    this.move(picking.getPickedVertices(), this._moveData.center, picking.getLocalRadius2(), this._moveData, picking);

    if (useSym) {
      this.updateMoveDir(pickingSym, mouseX, mouseY, true);
      this.move(pickingSym.getPickedVertices(), this._moveDataSym.center, pickingSym.getLocalRadius2(), this._moveDataSym, pickingSym);
    }

    var mesh = this.getMesh();
    mesh.updateGeometry(mesh.getFacesFromVertices(picking.getPickedVertices()), picking.getPickedVertices());
    if (useSym)
      mesh.updateGeometry(mesh.getFacesFromVertices(pickingSym.getPickedVertices()), pickingSym.getPickedVertices());
    this.updateRender();
    main.setCanvasCursor('default');
  }

  move(iVerts, center, radiusSquared, moveData, picking) {
    var mesh = this.getMesh();
    var vAr = mesh.getVertices();
    var mAr = mesh.getMaterials();
    var radius = Math.sqrt(radiusSquared);
    var vProxy = moveData.vProxy;
    var cx = center[0];
    var cy = center[1];
    var cz = center[2];
    var dir = moveData.dir;
    var dirx = dir[0];
    var diry = dir[1];
    var dirz = dir[2];
    for (var i = 0, l = iVerts.length; i < l; ++i) {
      var ind = iVerts[i] * 3;
      var j = i * 3;
      var vx = vProxy[j];
      var vy = vProxy[j + 1];
      var vz = vProxy[j + 2];
      var dx = vx - cx;
      var dy = vy - cy;
      var dz = vz - cz;
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
      var fallOff = this.getFallOff(dist);
      fallOff *= mAr[ind + 2] * picking.getAlpha(vx, vy, vz, this._focalShiftFalloff ? this._focalShift : 0);
      vAr[ind] += dirx * fallOff;
      vAr[ind + 1] += diry * fallOff;
      vAr[ind + 2] += dirz * fallOff;
    }
  }

  updateMoveDir(picking, mouseX, mouseY, useSymmetry) {
    var mesh = this.getMesh();
    var vNear = picking.unproject(mouseX, mouseY, 0.0);
    var vFar = picking.unproject(mouseX, mouseY, 0.1);
    var matInverse = mat4.create();
    mat4.invert(matInverse, mesh.getMatrix());
    vec3.transformMat4(vNear, vNear, matInverse);
    vec3.transformMat4(vFar, vFar, matInverse);

    var moveData = useSymmetry ? this._moveDataSym : this._moveData;
    if (useSymmetry) {
      var ptPlane = mesh.getSymmetryOrigin();
      var nPlane = mesh.getSymmetryNormal();
      Geometry.mirrorPoint(vNear, ptPlane, nPlane);
      Geometry.mirrorPoint(vFar, ptPlane, nPlane);
    }

    if (this._negative) {
      var len = vec3.dist(Geometry.vertexOnLine(moveData.center, vNear, vFar), moveData.center);
      vec3.normalize(moveData.dir, picking.computePickedNormal());
      vec3.scale(moveData.dir, moveData.dir, mouseX < this._lastMouseX ? -len : len);
    } else {
      vec3.sub(moveData.dir, Geometry.vertexOnLine(moveData.center, vNear, vFar), moveData.center);
    }
    vec3.scale(moveData.dir, moveData.dir, this._intensity);

    var eyeDir = picking.getEyeDirection();
    vec3.sub(eyeDir, vFar, vNear);
    vec3.normalize(eyeDir, eyeDir);
  }
}

export default Move;
