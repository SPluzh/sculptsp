import { vec3 } from 'gl-matrix';
import Tablet from '../../misc/Tablet.js';
import SculptBase from './SculptBase.js';

class SquareBrush extends SculptBase {

  constructor(main) {
    super(main);

    this._radius = 50;
    this._intensity = 0.5;
    this._negative = false;
    this._clay = true;
    this._culling = false;
    this._accumulate = true; // if we ignore the proxy
    this._lockPosition = false;
  }

  getFallOff(dist) {
    var focalShift = this._focalShiftFalloff ? this._focalShift : 0.0;
    var p = (1.0 - focalShift) / 2.0;
    if (dist < p) return 1.0;
    if (p >= 1.0) return 0.0;
    var d = (dist - p) / (1.0 - p);
    var fallOff = d * d;
    return 3.0 * fallOff * fallOff - 4.0 * fallOff * d + 1.0;
  }

  stroke(picking) {
    var iVertsInRadius = picking.getPickedVertices();
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

    var r2 = picking.getLocalRadius2();
    picking.updateAlpha(this._lockPosition);

    if (!this._clay) {
      this.brush(iVertsInRadius, picking.getPickedNormal(), picking.getIntersectionPoint(), r2, intensity, picking);
    } else {
      var aNormal = this.areaNormal(iVertsFront);
      if (!aNormal)
        return;
      var aCenter = this._lockPosition ? picking.getIntersectionPoint() : this.areaCenter(iVertsFront);
      var off = Math.sqrt(r2) * 0.1;
      vec3.scaleAndAdd(aCenter, aCenter, aNormal, this._negative ? -off : off);
      this.flatten(iVertsInRadius, aNormal, aCenter, picking.getIntersectionPoint(), r2, intensity, picking);
    }

    var mesh = this.getMesh();
    mesh.updateGeometry(mesh.getFacesFromVertices(iVertsInRadius), iVertsInRadius);
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
      var px = vProxy[ind];
      var py = vProxy[ind + 1];
      var pz = vProxy[ind + 2];

      var xn = (m[0] * px + m[4] * py + m[8] * pz + m[12]) / (picking._xSym ? -rs : rs);
      var yn = (m[1] * px + m[5] * py + m[9] * pz + m[13]) / rs;

      var dist = Math.max(Math.abs(xn), Math.abs(yn));
      if (dist >= 1.0)
        continue;

      var vx = vAr[ind];
      var vy = vAr[ind + 1];
      var vz = vAr[ind + 2];

      var fallOff = this.getFallOff(dist);
      fallOff *= mAr[ind + 2] * deformIntensityBrush;

      vAr[ind] = vx + anx * fallOff;
      vAr[ind + 1] = vy + any * fallOff;
      vAr[ind + 2] = vz + anz * fallOff;
    }
  }

  flatten(iVertsInRadius, aNormal, aCenter, center, radiusSquared, intensity, picking) {
    var mesh = this.getMesh();
    var vAr = mesh.getVertices();
    var mAr = mesh.getMaterials();
    var radius = Math.sqrt(radiusSquared);
    var vProxy = this._accumulate === false && this._lockPosition === false ? mesh.getVerticesProxy() : vAr;
    var anx = aNormal[0];
    var any = aNormal[1];
    var anz = aNormal[2];
    var ax = aCenter[0];
    var ay = aCenter[1];
    var az = aCenter[2];
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

      var px = vProxy[ind];
      var py = vProxy[ind + 1];
      var pz = vProxy[ind + 2];

      var xn = (m[0] * px + m[4] * py + m[8] * pz + m[12]) / (picking._xSym ? -rs : rs);
      var yn = (m[1] * px + m[5] * py + m[9] * pz + m[13]) / rs;

      var dist = Math.max(Math.abs(xn), Math.abs(yn));
      if (dist >= 1.0)
        continue;

      var fallOff = this.getFallOff(dist);
      fallOff *= distToPlane * intensity * mAr[ind + 2];

      vAr[ind] -= anx * fallOff;
      vAr[ind + 1] -= any * fallOff;
      vAr[ind + 2] -= anz * fallOff;
    }
  }
}

export default SquareBrush;
