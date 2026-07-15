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
    var iVertsInRadius = picking.getPickedVertices();
    var intensity = this._intensity * Tablet.getPressureIntensity() * 0.1;

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
    picking.setIdAlpha(this._idAlpha);

    if (!this._clay) {
      this.brush(iVertsInRadius, picking.getPickedNormal(), picking.getIntersectionPoint(), r2, intensity, picking);
    } else {
      var aNormal = this.areaNormal(iVertsFront);
      if (!aNormal)
        return;
      var aCenter = this._lockPosition ? picking.getIntersectionPoint() : this.areaCenter(iVertsFront);
      var off = Math.sqrt(r2) * 0.1;
      vec3.scaleAndAdd(aCenter, aCenter, aNormal, this._negative ? -off : off);
      Flatten.prototype.flatten.call(this, iVertsInRadius, aNormal, aCenter, picking.getIntersectionPoint(), r2, intensity, picking);
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
    var cx = center[0];
    var cy = center[1];
    var cz = center[2];
    var anx = aNormal[0];
    var any = aNormal[1];
    var anz = aNormal[2];
    for (var i = 0, l = iVertsInRadius.length; i < l; ++i) {
      var ind = iVertsInRadius[i] * 3;
      var dx = vProxy[ind] - cx;
      var dy = vProxy[ind + 1] - cy;
      var dz = vProxy[ind + 2] - cz;
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
      if (dist >= 1.0)
        continue;
      var vx = vAr[ind];
      var vy = vAr[ind + 1];
      var vz = vAr[ind + 2];
      var fallOff = this.getFallOff(dist);
      fallOff *= mAr[ind + 2] * deformIntensityBrush * picking.getAlpha(vx, vy, vz, this._focalShiftFalloff ? this._focalShift : 0);
      vAr[ind] = vx + anx * fallOff;
      vAr[ind + 1] = vy + any * fallOff;
      vAr[ind + 2] = vz + anz * fallOff;
    }
  }
}

export default ClayBuildup;
