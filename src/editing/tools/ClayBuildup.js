import { vec3 } from 'gl-matrix';
import Tablet from '../../misc/Tablet.js';
import SculptBase from './SculptBase.js';
import TR from '../../gui/GuiTR.js';
import Utils from '../../misc/Utils.js';

class ClayBuildup extends SculptBase {

  constructor(main) {
    super(main);

    this._radius = 50;
    this._intensity = 0.1;
    this._negative = false;
    this._clay = true;
    this._culling = false;
    this._accumulate = true; // if we ignore the proxy
    this._idAlpha = TR('alphaMy8');
    this._spacing = 0.05;
    this._lockPosition = false;
  }

  stroke(picking, sym) {
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
    if (this._negative)
      intensity *= 0.5;

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

    var nbVerts = iVertsInRadius.length;
    var weights = new Float32Array(nbVerts);

    var smoothScale = 0.8 * intensity; // High smoothing for fluid wet clay feel

    // Loop 1: Buildup and deformation
    for (var i = 0; i < nbVerts; ++i) {
      var ind = iVertsInRadius[i] * 3;
      var vx = vAr[ind];
      var vy = vAr[ind + 1];
      var vz = vAr[ind + 2];

      var dx = vx - cx;
      var dy = vy - cy;
      var dz = vz - cz;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
      if (d >= 1.4)
        continue;

      var xn = (m[0] * vx + m[4] * vy + m[8] * vz + m[12]) / (picking._xSym ? -rs : rs);
      var yn = (m[1] * vx + m[5] * vy + m[9] * vz + m[13]) / rs;
      var dist = Math.max(Math.abs(xn), Math.abs(yn));

      var alpha = picking.getAlpha(vx, vy, vz, this._focalShiftFalloff ? this._focalShift : 0);
      var mask = mAr[ind + 2];

      // If it is inside the alpha, apply buildup
      if (dist < 1.0) {
        var fallOff = this.getFallOff(dist);
        var distToPlane = (vx - ax) * anx + (vy - ay) * any + (vz - az) * anz;
        
        var newVx = vx;
        var newVy = vy;
        var newVz = vz;

        // Clay flatten/buildup deformation
        if (distToPlane * comp <= 0.0) {
          var deformVal = fallOff * distToPlane * intensity * mask * alpha;
          newVx -= anx * deformVal;
          newVy -= any * deformVal;
          newVz -= anz * deformVal;
        }

        vAr[ind] = newVx;
        vAr[ind + 1] = newVy;
        vAr[ind + 2] = newVz;

        weights[i] = smoothScale * mask * fallOff * alpha;
        continue;
      }

      // Transition/boundary smoothing (keeps the stroke outline soft and removes ragged geometry)
      var transitionWeight = 0.0;
      if (dist < 1.0) {
        var fallOff = this.getFallOff(dist);
        transitionWeight = smoothScale * mask * fallOff * alpha;
      } else {
        // Fade out smoothing from d = 1.0 to d = 1.4
        var factor = Math.max(0.0, 1.0 - (d - 1.0) / 0.4);
        transitionWeight = smoothScale * mask * factor * alpha;
      }
      weights[i] = transitionWeight;
    }

    // Compute Laplacian smooth on the new positions
    var smoothVerts = new Float32Array(Utils.getMemory(nbVerts * 4 * 3), 0, nbVerts * 3);
    this.laplacianSmooth(iVertsInRadius, smoothVerts, vAr);

    // Loop 2: Apply Laplacian smooth blend
    for (var i = 0; i < nbVerts; ++i) {
      var w = weights[i];
      if (w <= 0.0)
        continue;

      var ind = iVertsInRadius[i] * 3;
      var i3 = i * 3;
      var intComp = 1.0 - w;
      vAr[ind] = vAr[ind] * intComp + smoothVerts[i3] * w;
      vAr[ind + 1] = vAr[ind + 1] * intComp + smoothVerts[i3 + 1] * w;
      vAr[ind + 2] = vAr[ind + 2] * intComp + smoothVerts[i3 + 2] * w;
    }
  }

  brush(iVertsInRadius, aNormal, center, radiusSquared, intensity, picking) {
    var mesh = this.getMesh();
    var vAr = mesh.getVertices();
    var mAr = mesh.getMaterials();
    var radius = Math.sqrt(radiusSquared);
    var deformIntensityBrush = intensity * radius * 0.1;
    if (this._negative)
      deformIntensityBrush = -deformIntensityBrush;
    var anx = aNormal[0];
    var any = aNormal[1];
    var anz = aNormal[2];

    var cx = center[0];
    var cy = center[1];
    var cz = center[2];

    var m = picking._alphaLookAt;
    var rs = picking._alphaSide;

    var nbVerts = iVertsInRadius.length;
    var weights = new Float32Array(nbVerts);

    var smoothScale = 0.8 * intensity; // High smoothing for fluid wet clay feel

    // Loop 1: Buildup deformation
    for (var i = 0, l = iVertsInRadius.length; i < l; ++i) {
      var ind = iVertsInRadius[i] * 3;
      var vx = vAr[ind];
      var vy = vAr[ind + 1];
      var vz = vAr[ind + 2];

      var dx = vx - cx;
      var dy = vy - cy;
      var dz = vz - cz;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
      if (d >= 1.4)
        continue;

      var xn = (m[0] * vx + m[4] * vy + m[8] * vz + m[12]) / (picking._xSym ? -rs : rs);
      var yn = (m[1] * vx + m[5] * vy + m[9] * vz + m[13]) / rs;
      var dist = Math.max(Math.abs(xn), Math.abs(yn));

      var alpha = picking.getAlpha(vx, vy, vz, this._focalShiftFalloff ? this._focalShift : 0);
      var mask = mAr[ind + 2];

      if (dist < 1.0) {
        var fallOff = this.getFallOff(dist);
        var deformVal = fallOff * mask * deformIntensityBrush * alpha;
        var newVx = vx + anx * deformVal;
        var newVy = vy + any * deformVal;
        var newVz = vz + anz * deformVal;

        vAr[ind] = newVx;
        vAr[ind + 1] = newVy;
        vAr[ind + 2] = newVz;

        weights[i] = smoothScale * mask * fallOff * alpha;
        continue;
      }

      // Transition/boundary smoothing
      var transitionWeight = 0.0;
      if (dist < 1.0) {
        var fallOff = this.getFallOff(dist);
        transitionWeight = smoothScale * mask * fallOff * alpha;
      } else {
        var factor = Math.max(0.0, 1.0 - (d - 1.0) / 0.4);
        transitionWeight = smoothScale * mask * factor * alpha;
      }
      weights[i] = transitionWeight;
    }

    // Compute Laplacian smooth on the new positions
    var smoothVerts = new Float32Array(Utils.getMemory(nbVerts * 4 * 3), 0, nbVerts * 3);
    this.laplacianSmooth(iVertsInRadius, smoothVerts, vAr);

    // Loop 2: Apply Laplacian smooth blend
    for (var i = 0; i < nbVerts; ++i) {
      var w = weights[i];
      if (w <= 0.0)
        continue;

      var ind = iVertsInRadius[i] * 3;
      var i3 = i * 3;
      var intComp = 1.0 - w;
      vAr[ind] = vAr[ind] * intComp + smoothVerts[i3] * w;
      vAr[ind + 1] = vAr[ind + 1] * intComp + smoothVerts[i3 + 1] * w;
      vAr[ind + 2] = vAr[ind + 2] * intComp + smoothVerts[i3 + 2] * w;
    }
  }
}

export default ClayBuildup;
