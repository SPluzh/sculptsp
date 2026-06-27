import { vec3 } from 'gl-matrix';
import Tablet from '../../misc/Tablet.js';
import SculptBase from './SculptBase.js';
import Flatten from './Flatten.js';
import TR from '../../gui/GuiTR.js';

class ClayBuildup extends SculptBase {

  constructor(main) {
    super(main);

    this._radius = 50;
    this._intensity = 0.5;
    this._negative = false;
    this._clay = true;
    this._culling = false;
    this._accumulate = true; // if we ignore the proxy
    this._idAlpha = TR('alphaSquare');
    this._spacing = 0.05;
    this._lockPosition = false;
  }

  stroke(picking) {
    var r2 = picking.getLocalRadius2();
    picking.updateAlpha(this._lockPosition);
    picking._alphaSide = Math.sqrt(r2);
    picking.setIdAlpha(this._idAlpha);

    var originalR2 = r2;
    var originalPickedVertices = picking.getPickedVertices();

    var largerR2 = r2 * 2.0;
    picking.setLocalRadius2(largerR2);
    var iVertsInRadius = picking.pickVerticesInSphere(largerR2);

    var intensity = this._intensity * Tablet.getPressureIntensity();

    if (!this._accumulate && !this._lockPosition)
      this.updateProxy(iVertsInRadius);
    // undo-redo
    this._main.getStateManager().pushVertices(iVertsInRadius);
    if (!this._lockPosition)
      iVertsInRadius = this.dynamicTopology(picking);

    var iVertsFront = this.getFrontVertices(iVertsInRadius, picking.getEyeDirection());
    if (this._culling)
      iVertsInRadius = iVertsFront;

    if (!this._clay) {
      this.brush(iVertsInRadius, picking.getPickedNormal(), picking.getIntersectionPoint(), originalR2, intensity, picking);
    } else {
      var aNormal = this.areaNormal(iVertsFront);
      if (!aNormal) {
        picking.setLocalRadius2(originalR2);
        picking._pickedVertices = originalPickedVertices;
        return;
      }
      var aCenter = this._lockPosition ? picking.getIntersectionPoint() : this.areaCenter(iVertsFront);
      var off = Math.sqrt(originalR2) * 0.1;
      vec3.scaleAndAdd(aCenter, aCenter, aNormal, this._negative ? -off : off);
      this.clayFlatten(iVertsInRadius, aNormal, aCenter, picking.getIntersectionPoint(), originalR2, intensity, picking);
    }

    picking.setLocalRadius2(originalR2);
    picking._pickedVertices = originalPickedVertices;

    var mesh = this.getMesh();
    mesh.updateGeometry(mesh.getFacesFromVertices(iVertsInRadius), iVertsInRadius);
  }

  clayFlatten(iVertsInRadius, aNormal, aCenter, center, radiusSquared, intensity, picking) {
    var mesh = this.getMesh();
    var vAr = mesh.getVertices();
    var mAr = mesh.getMaterials();
    var radius = Math.sqrt(radiusSquared);
    var vProxy = this._accumulate === false && this._lockPosition === false ? mesh.getVerticesProxy() : vAr;
    var cx = center[0];
    var cy = center[1];
    var cz = center[2];
    var ax = aCenter[0];
    var ay = aCenter[1];
    var az = aCenter[2];
    var anx = aNormal[0];
    var any = aNormal[1];
    var anz = aNormal[2];
    var comp = this._negative ? -1.0 : 1.0;

    var m = picking._alphaLookAt;
    var rs = picking._alphaSide;

    for (var i = 0, l = iVertsInRadius.length; i < l; ++i) {
      var ind = iVertsInRadius[i] * 3;
      var vx = vAr[ind];
      var vy = vAr[ind + 1];
      var vz = vAr[ind + 2];
      var distToPlane = (vx - ax) * anx + (vy - ay) * any + (vz - az) * anz;
      if (distToPlane * comp > 0.0)
        continue;

      var xn = (m[0] * vx + m[4] * vy + m[8] * vz + m[12]) / (picking._xSym ? -rs : rs);
      var yn = (m[1] * vx + m[5] * vy + m[9] * vz + m[13]) / rs;
      var dist = Math.max(Math.abs(xn), Math.abs(yn));
      if (dist >= 1.0)
        continue;

      var fallOff = this.getFallOff(dist);
      fallOff *= distToPlane * intensity * mAr[ind + 2] * picking.getAlpha(vx, vy, vz, this._focalShiftFalloff ? this._focalShift : 0);
      vAr[ind] -= anx * fallOff;
      vAr[ind + 1] -= any * fallOff;
      vAr[ind + 2] -= anz * fallOff;
    }
  }

  brush(iVertsInRadius, aNormal, center, radiusSquared, intensity, picking) {
    var mesh = this.getMesh();
    var vAr = mesh.getVertices();
    var mAr = mesh.getMaterials();
    var vProxy = this._accumulate || this._lockPosition ? vAr : mesh.getVerticesProxy();
    var radius = Math.sqrt(radiusSquared);
    var deformIntensityBrush = intensity * radius * 0.1;
    if (this._negative)
      deformIntensityBrush = -deformIntensityBrush;
    var anx = aNormal[0];
    var any = aNormal[1];
    var anz = aNormal[2];

    var m = picking._alphaLookAt;
    var rs = picking._alphaSide;

    for (var i = 0, l = iVertsInRadius.length; i < l; ++i) {
      var ind = iVertsInRadius[i] * 3;
      var vx = vAr[ind];
      var vy = vAr[ind + 1];
      var vz = vAr[ind + 2];

      var xn = (m[0] * vx + m[4] * vy + m[8] * vz + m[12]) / (picking._xSym ? -rs : rs);
      var yn = (m[1] * vx + m[5] * vy + m[9] * vz + m[13]) / rs;
      var dist = Math.max(Math.abs(xn), Math.abs(yn));
      if (dist >= 1.0)
        continue;

      var fallOff = this.getFallOff(dist);
      fallOff *= mAr[ind + 2] * deformIntensityBrush * picking.getAlpha(vx, vy, vz, this._focalShiftFalloff ? this._focalShift : 0);
      vAr[ind] = vx + anx * fallOff;
      vAr[ind + 1] = vy + any * fallOff;
      vAr[ind + 2] = vz + anz * fallOff;
    }
  }
}

export default ClayBuildup;
