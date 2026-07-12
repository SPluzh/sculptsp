import { vec3, mat4 } from 'gl-matrix';
import Geometry from '../math3d/Geometry.js';
import Utils from '../misc/Utils.js';

class CurveData {
  constructor() {
    this._rawPoints = [];      // Array of {x, y} in screen-space
    this._controlPoints = [];  // Array of { worldPos: vec3, screenPos: {x, y}, localPos: vec3 }
  }

  clear() {
    this._rawPoints = [];
    this._controlPoints = [];
  }

  addRawPoint(x, y) {
    this._rawPoints.push({ x: x, y: y });
  }

  getRawPoints() {
    return this._rawPoints;
  }

  getControlPoints() {
    return this._controlPoints;
  }

  simplify(tolerance) {
    var points = this._rawPoints;
    if (points.length === 0) {
      this._controlPoints = [];
      return;
    }
    if (points.length <= 2) {
      this._controlPoints = points.map(p => ({
        worldPos: vec3.create(),
        localPos: vec3.create(),
        screenPos: { x: p.x, y: p.y }
      }));
      return;
    }

    var sqTolerance = tolerance !== undefined ? tolerance * tolerance : 100; // 10px tolerance squared by default

    // 1. Radial distance simplification
    var prevPoint = points[0];
    var simplified = [prevPoint];
    var point;
    for (var i = 1, len = points.length; i < len; i++) {
      point = points[i];
      var dx = point.x - prevPoint.x;
      var dy = point.y - prevPoint.y;
      if (dx * dx + dy * dy > sqTolerance) {
        simplified.push(point);
        prevPoint = point;
      }
    }
    if (prevPoint !== point && point) {
      simplified.push(point);
    }

    // 2. Douglas-Peucker simplification
    var finalPoints = [];
    if (simplified.length > 2) {
      var last = simplified.length - 1;
      finalPoints.push(simplified[0]);
      this._simplifyDPStep(simplified, 0, last, sqTolerance, finalPoints);
      finalPoints.push(simplified[last]);
    } else {
      finalPoints = simplified;
    }

    this._controlPoints = finalPoints.map(p => ({
      worldPos: vec3.create(),
      localPos: vec3.create(),
      screenPos: { x: p.x, y: p.y }
    }));
  }

  _simplifyDPStep(points, first, last, sqTolerance, simplified) {
    var maxSqDist = sqTolerance;
    var index = -1;

    for (var i = first + 1; i < last; i++) {
      var sqDist = this._getSqSegDist(points[i], points[first], points[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTolerance && index !== -1) {
      if (index - first > 1) {
        this._simplifyDPStep(points, first, index, sqTolerance, simplified);
      }
      simplified.push(points[index]);
      if (last - index > 1) {
        this._simplifyDPStep(points, index, last, sqTolerance, simplified);
      }
    }
  }

  _getSqSegDist(p, p1, p2) {
    var x = p1.x;
    var y = p1.y;
    var dx = p2.x - x;
    var dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {
      var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2.x;
        y = p2.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }

    dx = p.x - x;
    dy = p.y - y;
    return dx * dx + dy * dy;
  }

  projectToMesh(camera, mesh) {
    if (!mesh) return;

    var aabb = mesh.getLocalBound();
    var matrix = mesh.getMatrix();
    var invMatrix = mat4.create();
    mat4.invert(invMatrix, matrix);

    var aabbCenter = vec3.fromValues(
      (aabb[0] + aabb[3]) * 0.5,
      (aabb[1] + aabb[4]) * 0.5,
      (aabb[2] + aabb[5]) * 0.5
    );

    for (var i = 0; i < this._controlPoints.length; i++) {
      var cp = this._controlPoints[i];
      var sx = cp.screenPos.x;
      var sy = cp.screenPos.y;

      // Project screen point to local space near and far points
      var vNear = camera.unproject(sx, sy, 0.0);
      var vFar = camera.unproject(sx, sy, 0.1);

      var localNear = vec3.create();
      var localFar = vec3.create();
      vec3.transformMat4(localNear, vNear, invMatrix);
      vec3.transformMat4(localFar, vFar, invMatrix);

      var localDir = vec3.create();
      vec3.sub(localDir, localFar, localNear);
      vec3.normalize(localDir, localDir);

      var res = this._findMeshVolumeCenter(localNear, localFar, mesh, aabbCenter);

      var localPos = vec3.create();
      vec3.scaleAndAdd(localPos, localNear, localDir, res.t);

      var worldPos = vec3.create();
      vec3.transformMat4(worldPos, localPos, matrix);

      vec3.copy(cp.localPos, localPos);
      vec3.copy(cp.worldPos, worldPos);
      cp.volumeRadius = res.radius;
    }
  }

  _findMeshVolumeCenter(localNear, localFar, mesh, aabbCenter) {
    var vAr = mesh.getVertices();
    var fAr = mesh.getFaces();

    var localDir = vec3.create();
    vec3.sub(localDir, localFar, localNear);
    vec3.normalize(localDir, localDir);

    var iFacesCandidates = mesh.intersectRay(localNear, localDir);
    var nbFacesCandidates = iFacesCandidates.length;

    var minDist = Infinity;
    var maxDist = -Infinity;

    var v1 = vec3.create();
    var v2 = vec3.create();
    var v3 = vec3.create();
    var inter = vec3.create();

    for (var i = 0; i < nbFacesCandidates; ++i) {
      var indFace = iFacesCandidates[i] * 4;
      var ind1 = fAr[indFace] * 3;
      var ind2 = fAr[indFace + 1] * 3;
      var ind3 = fAr[indFace + 2] * 3;

      v1[0] = vAr[ind1];
      v1[1] = vAr[ind1 + 1];
      v1[2] = vAr[ind1 + 2];

      v2[0] = vAr[ind2];
      v2[1] = vAr[ind2 + 1];
      v2[2] = vAr[ind2 + 2];

      v3[0] = vAr[ind3];
      v3[1] = vAr[ind3 + 1];
      v3[2] = vAr[ind3 + 2];

      var hitDist = Geometry.intersectionRayTriangle(localNear, localDir, v1, v2, v3, inter);
      if (hitDist < 0.0) {
        ind2 = fAr[indFace + 3];
        if (ind2 !== Utils.TRI_INDEX) {
          ind2 *= 3;
          v2[0] = vAr[ind2];
          v2[1] = vAr[ind2 + 1];
          v2[2] = vAr[ind2 + 2];
          hitDist = Geometry.intersectionRayTriangle(localNear, localDir, v1, v3, v2, inter);
        }
      }

      if (hitDist >= 0.0) {
        if (hitDist < minDist) minDist = hitDist;
        if (hitDist > maxDist) maxDist = hitDist;
      }
    }

    if (minDist !== Infinity) {
      return {
        t: (minDist + maxDist) * 0.5,
        radius: (maxDist - minDist) * 0.5
      };
    }

    // Fallback: project AABB center to the ray
    var toCenter = vec3.create();
    vec3.sub(toCenter, aabbCenter, localNear);
    return {
      t: vec3.dot(toCenter, localDir),
      radius: 0.0
    };
  }
}

export default CurveData;
