import { vec3, mat4 } from 'gl-matrix';
import Gizmo from '../Gizmo.js';
import SculptBase from './SculptBase.js';

class Transform extends SculptBase {

  constructor(main) {
    super(main);

    this._gizmo = new Gizmo(main);
  }

  isIdentity(m) {
    if (m[0] !== 1.0 || m[5] !== 1.0 || m[10] !== 1.0 || m[15] !== 1.0) return false;
    if (m[1] !== 0.0 || m[2] !== 0.0 || m[3] !== 0.0 || m[4] !== 0.0) return false;
    if (m[6] !== 0.0 || m[7] !== 0.0 || m[8] !== 0.0 || m[9] !== 0.0) return false;
    if (m[11] !== 0.0 || m[12] !== 0.0 || m[13] !== 0.0 || m[14] !== 0.0) return false;
    return true;
  }

  preUpdate() {
    var picking = this._main.getPicking();

    var mesh = picking.getMesh();
    this._gizmo.onMouseOver();
    picking._mesh = mesh;

    this._main.setCanvasCursor('default');
  }

  start(ctrl) {
    var main = this._main;
    var mesh = this.getMesh();
    var picking = main.getPicking();

    if (mesh && this._gizmo.onMouseDown()) {
      picking._mesh = mesh;
      this._isMovingPivot = main._isAltDown;
      this._editType = this._gizmo._selected._type;
      if (this._isMovingPivot) {
        var meshes = main.getSelectedMeshes();
        this._startCenters = meshes.map(m => vec3.copy([0, 0, 0], m.getCenter()));
        this._startMatrices = meshes.map(m => mat4.copy(mat4.create(), m.getMatrix()));
      }
      return true;
    }

    if (!picking.intersectionMouseMeshes(main.getMeshes(), main._mouseX, main._mouseY))
      return false;

    var hitMesh = picking.getMesh();
    if (hitMesh !== main.getMesh()) {
      if (main._isAltDown) {
        if (!main.setOrUnsetMesh(hitMesh, ctrl))
          return false;
      } else {
        var currentMesh = main.getMesh();
        if (currentMesh) {
          var hitCurrent = picking.intersectionMouseMesh(currentMesh, main._mouseX, main._mouseY);
          if (!hitCurrent)
            return false;
        } else {
          return false;
        }
      }
    } else {
      if (!main.setOrUnsetMesh(hitMesh, ctrl))
        return false;
    }

    this._lastMouseX = main._mouseX;
    this._lastMouseY = main._mouseY;
    return false;
  }

  end() {
    this._gizmo.onMouseUp();

    var meshes = this._main.getSelectedMeshes();
    if (this._isMovingPivot) {
      for (var i = 0; i < meshes.length; ++i) {
        var mesh = meshes[i];
        var startCenter = this._startCenters[i];
        var startMatrix = this._startMatrices[i];
        var hasRot = mesh._pivotEditMatrix && !this.isIdentity(mesh._pivotEditMatrix);
        var hasTrans = startCenter && vec3.sqrDist(mesh.getCenter(), startCenter) > 1e-7;

        if (hasTrans || hasRot) {
          var newMatrix = mat4.create();
          if (hasRot) {
            mat4.mul(newMatrix, mesh.getMatrix(), mesh._pivotEditMatrix);
          } else {
            mat4.copy(newMatrix, mesh.getMatrix());
          }
          var newCenter = vec3.copy([0, 0, 0], mesh.getCenter());

          // Temporarily restore start center and matrix for state creation
          vec3.copy(mesh.getCenter(), startCenter);
          mat4.copy(mesh.getMatrix(), startMatrix);

          this._forceToolMesh = mesh;
          this.pushState();
          if (i > 0) this._main.getStateManager().getCurrentState().squash = true;

          if (hasRot) {
            var nbVertices = mesh.getNbVertices();
            var iVerts = new Uint32Array(nbVertices);
            for (var j = 0; j < nbVertices; ++j) {
              iVerts[j] = j;
            }
            this._main.getStateManager().pushVertices(iVerts);

            // Restore new center and matrix to apply inverse rotation
            vec3.copy(mesh.getCenter(), newCenter);
            mat4.copy(mesh.getMatrix(), newMatrix);

            var R_local_inv = mat4.create();
            mat4.invert(R_local_inv, mesh._pivotEditMatrix);
            mat4.copy(mesh.getEditMatrix(), R_local_inv);

            this.applyEditMatrix(iVerts);
            this.updateMeshBuffers();
            vec3.copy(mesh.getCenter(), newCenter);
          } else {
            // Restore new center
            vec3.copy(mesh.getCenter(), newCenter);
          }
        }
        mesh._pivotEditMatrix = null;
      }
      this._forceToolMesh = null;
      this._isMovingPivot = false;
      this._startCenters = null;
      this._startMatrices = null;
      this._editType = null;
      return;
    }

    if (!this.getMesh() || this.isIdentity(this.getMesh().getEditMatrix())) {
      this._editType = null;
      return;
    }

    var isRotation = this._editType === Gizmo.ROT_X || this._editType === Gizmo.ROT_Y || this._editType === Gizmo.ROT_Z || this._editType === Gizmo.ROT_W;

    for (var i = 0; i < meshes.length; ++i) {
      var mesh = meshes[i];
      this._forceToolMesh = mesh;

      this.pushState();
      if (i > 0) this._main.getStateManager().getCurrentState().squash = true;

      var iVerts = this.getUnmaskedVertices();
      var hasMasking = iVerts.length < mesh.getNbVertices();

      if (isRotation && !hasMasking) {
        mat4.mul(mesh.getMatrix(), mesh.getMatrix(), mesh.getEditMatrix());
        mat4.identity(mesh.getEditMatrix());
      } else {
        this._main.getStateManager().pushVertices(iVerts);
        this.applyEditMatrix(iVerts);

        if (iVerts.length === 0) continue;
        this.updateMeshBuffers();
      }
    }
    this._forceToolMesh = null;
    this._editType = null;
  }

  applyEditMatrix(iVerts) {
    var mesh = this.getMesh();
    var em = mesh.getEditMatrix();
    var mAr = mesh.getMaterials();
    var vAr = mesh.getVertices();
    var vTemp = [0.0, 0.0, 0.0];
    for (var i = 0, nb = iVerts.length; i < nb; ++i) {
      var j = iVerts[i] * 3;
      var mask = mAr[j + 2];
      var x = vTemp[0] = vAr[j];
      var y = vTemp[1] = vAr[j + 1];
      var z = vTemp[2] = vAr[j + 2];
      vec3.transformMat4(vTemp, vTemp, em);
      var iMask = 1.0 - mask;
      vAr[j] = x * iMask + vTemp[0] * mask;
      vAr[j + 1] = y * iMask + vTemp[1] * mask;
      vAr[j + 2] = z * iMask + vTemp[2] * mask;
    }
    vec3.transformMat4(mesh.getCenter(), mesh.getCenter(), em);
    mat4.identity(em);
    if (iVerts.length === mesh.getNbVertices()) mesh.updateGeometry();
    else mesh.updateGeometry(mesh.getFacesFromVertices(iVerts), iVerts);
  }

  update() {}

  postRender(selection, camera) {
    if (this.getMesh())
      this._gizmo.render(camera);
  }

  addSculptToScene(scene) {
    if (this.getMesh())
      this._gizmo.addGizmoToScene(scene);
  }
}

export default Transform;
