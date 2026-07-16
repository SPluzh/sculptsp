import SculptBase from './SculptBase.js';
import CurveData from '../CurveData.js';
import { vec3, mat4 } from 'gl-matrix';
import Geometry from '../../math3d/Geometry.js';

function getClosestPointOnSegment(p, a, b, out) {
  var ab = vec3.create();
  vec3.sub(ab, b, a);
  var ap = vec3.create();
  vec3.sub(ap, p, a);

  var abLen2 = vec3.sqrLen(ab);
  if (abLen2 === 0.0) {
    vec3.copy(out, a);
    return 0.0;
  }

  var t = vec3.dot(ap, ab) / abLen2;
  if (t < 0.0) t = 0.0;
  else if (t > 1.0) t = 1.0;

  vec3.scaleAndAdd(out, a, ab, t);
  return t;
}

function getLocalRadiusForPoint(pLocal, mesh, camera, screenRadius) {
  var meshMatrix = mesh.getMatrix();
  var pWorld = vec3.create();
  vec3.transformMat4(pWorld, pLocal, meshMatrix);

  var pScreen = camera.project(pWorld);
  var pScreenOffset = vec3.fromValues(pScreen[0] + screenRadius, pScreen[1], pScreen[2]);
  var pWorldOffset = camera.unproject(pScreenOffset[0], pScreenOffset[1], pScreenOffset[2]);

  var rWorld = vec3.dist(pWorld, pWorldOffset);
  return rWorld / mesh.getScale();
}

function interpolateCatmullRom(p0, p1, p2, p3, t, out) {
  var t2 = t * t;
  var t3 = t2 * t;

  out[0] = 0.5 * (
    (2.0 * p1[0]) +
    (-p0[0] + p2[0]) * t +
    (2.0 * p0[0] - 5.0 * p1[0] + 4.0 * p2[0] - p3[0]) * t2 +
    (-p0[0] + 3.0 * p1[0] - 3.0 * p2[0] + p3[0]) * t3
  );
  out[1] = 0.5 * (
    (2.0 * p1[1]) +
    (-p0[1] + p2[1]) * t +
    (2.0 * p0[1] - 5.0 * p1[1] + 4.0 * p2[1] - p3[1]) * t2 +
    (-p0[1] + 3.0 * p1[1] - 3.0 * p2[1] + p3[1]) * t3
  );
  out[2] = 0.5 * (
    (2.0 * p1[2]) +
    (-p0[2] + p2[2]) * t +
    (2.0 * p0[2] - 5.0 * p1[2] + 4.0 * p2[2] - p3[2]) * t2 +
    (-p0[2] + 3.0 * p1[2] - 3.0 * p2[2] + p3[2]) * t3
  );
}

function generateSpline(cps, samplesPerSegment) {
  var n = cps.length;
  if (n < 2) return [];

  var spline = [];
  for (var i = 0; i < n - 1; i++) {
    var p0 = cps[Math.max(i - 1, 0)];
    var p1 = cps[i];
    var p2 = cps[i + 1];
    var p3 = cps[Math.min(i + 2, n - 1)];

    var pt0 = vec3.clone(p0);
    if (i === 0) {
      var diff1 = vec3.create();
      vec3.sub(diff1, p1, p2);
      vec3.add(pt0, p1, diff1); // 2*p1 - p2
    }
    var pt3 = vec3.clone(p3);
    if (i === n - 2) {
      var diff2 = vec3.create();
      vec3.sub(diff2, p2, p1);
      vec3.add(pt3, p2, diff2); // 2*p2 - p1
    }

    for (var j = 0; j < samplesPerSegment; j++) {
      var t = j / samplesPerSegment;
      var pt = vec3.create();
      interpolateCatmullRom(pt0, p1, p2, pt3, t, pt);
      spline.push(pt);
    }
  }
  spline.push(vec3.clone(cps[n - 1]));
  return spline;
}

function generateSplineRadii(cpsRadii, samplesPerSegment) {
  var n = cpsRadii.length;
  if (n < 2) return [];

  var radii = [];
  for (var i = 0; i < n - 1; i++) {
    var r1 = cpsRadii[i];
    var r2 = cpsRadii[i + 1];
    for (var j = 0; j < samplesPerSegment; j++) {
      var t = j / samplesPerSegment;
      radii.push(r1 + t * (r2 - r1));
    }
  }
  radii.push(cpsRadii[n - 1]);
  return radii;
}


class CurveDeformTool extends SculptBase {
  constructor(main) {
    super(main);
    this._radius = 100; // Influence radius in pixels
    this._intensity = 1.0;
    this._mode = 'draw'; // 'draw' or 'edit'
    this._curveData = new CurveData();
    this._hoveredCP = null;
    this._activeCP = null;
    this._isDragging = false;
    this._svg = null;
    this._onKeyDown = null;

    // Deformation helper caches
    this._activeIVerts = null;
    this._activeVProxy = null;
    this._activeLocalRadius = 0.0;
    this._startLocalPos = vec3.create();

    // Symmetry caches
    this._activeSymIVerts = null;
    this._activeSymVProxy = null;
    this._activeSymLocalRadius = 0.0;
    this._symStartLocalPos = vec3.create();

    // Curve deformation caches
    this._vertexWeights = null;
    this._vertexWeightsSym = null;
    this._startCPs = null;
    this._startCPsSym = null;

    // Spline-based curve deformation caches
    this._startSpline = null;
    this._startSplineSym = null;
    this._startSplineRadii = null;
    this._startSplineRadiiSym = null;
  }

  onActivate() {
    this.clear();

    var viewport = this._main.getViewport();
    this._svgLeft = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svgLeft.setAttribute('id', 'curve-deform-overlay-left');
    this._svgLeft.style.position = 'absolute';
    this._svgLeft.style.top = '0';
    this._svgLeft.style.pointerEvents = 'none';
    this._svgLeft.style.zIndex = '100';
    viewport.appendChild(this._svgLeft);

    this._svgRight = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svgRight.setAttribute('id', 'curve-deform-overlay-right');
    this._svgRight.style.position = 'absolute';
    this._svgRight.style.top = '0';
    this._svgRight.style.pointerEvents = 'none';
    this._svgRight.style.zIndex = '100';
    this._svgRight.style.display = 'none';
    viewport.appendChild(this._svgRight);

    this._svg = this._svgLeft;

    this._onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
  }

  onDeactivate() {
    this.clear();
    if (this._svgLeft && this._svgLeft.parentNode) {
      this._svgLeft.parentNode.removeChild(this._svgLeft);
    }
    this._svgLeft = null;
    if (this._svgRight && this._svgRight.parentNode) {
      this._svgRight.parentNode.removeChild(this._svgRight);
    }
    this._svgRight = null;
    this._svg = null;

    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
    }
  }

  onKeyDown(e) {
    var key = e.key.toLowerCase();
    if (key === 'd') {
      this.setMode('draw');
    } else if (key === 'e') {
      if (this._mode === 'setup') {
        this.setMode('deform');
      } else {
        this.setMode('setup');
      }
    }
  }

  setMode(mode) {
    if (this._mode === 'setup' && mode === 'deform') {
      this.bindVertices();
    } else if (mode === 'setup') {
      // Disconnect from mesh, clear weights and active vertices
      this._vertexWeights = null;
      this._vertexWeightsSym = null;
      this._activeIVerts = null;
      this._activeSymIVerts = null;
      this._startCPs = null;
      this._startCPsSym = null;
      this._startSpline = null;
      this._startSplineSym = null;
      this._startSplineRadii = null;
      this._startSplineRadiiSym = null;
    }

    this._mode = mode;
    this._hoveredCP = null;
    this._activeCP = null;
    this._isDragging = false;

    if (this._guiEditMode) {
      this._guiEditMode.setValue(mode === 'setup', true);
    }

    if (this._main) {
      this._main.setCanvasCursor('default');
      this._main.render();
    }
  }

  setModeDraw() {
    this.setMode('draw');
  }

  setModeEdit() {
    this.setMode('setup');
  }

  setEditMode(val) {
    if (val) {
      this.setMode('setup');
    } else {
      this.setMode('deform');
    }
  }

  getFallOff(dist) {
    if (dist >= 1.0) return 0.0;
    if (dist < 0.85) return 1.0;
    var t = (dist - 0.85) / 0.15;
    return 1.0 - t * t * (3.0 - 2.0 * t);
  }

  clear() {
    this._curveData.clear();
    this._hoveredCP = null;
    this._activeCP = null;
    this._isDragging = false;
    this._vertexWeights = null;
    this._vertexWeightsSym = null;
    this._startCPs = null;
    this._startCPsSym = null;
    this._startSpline = null;
    this._startSplineSym = null;
    this._startSplineRadii = null;
    this._startSplineRadiiSym = null;
    this._mode = 'draw';
    if (this._guiEditMode) {
      this._guiEditMode.setValue(false, true);
    }
    if (this._main) {
      this._main.setCanvasCursor('default');
      this._main.render();
    }
  }

  start(ctrl) {
    var main = this._main;
    var mesh = this.getMesh();
    if (!mesh) return false;

    if (this._mode === 'draw') {
      this.clear();
      this._isDragging = true;
      this._curveData.addRawPoint(main._mouseX, main._mouseY);
      main.render();
      return true;
    } else if (this._mode === 'setup') {
      if (this._hoveredCP !== null) {
        this._activeCP = this._hoveredCP;
        this._isDragging = true;
        return true;
      }
    } else if (this._mode === 'deform') {
      if (this._hoveredCP !== null) {
        this._activeCP = this._hoveredCP;
        this._isDragging = true;

        this.pushState();
        if (this._activeIVerts && this._activeIVerts.length > 0) {
          main.getStateManager().pushVertices(this._activeIVerts);
        }
        if (this._activeSymIVerts && this._activeSymIVerts.length > 0) {
          main.getStateManager().pushVertices(this._activeSymIVerts);
        }
        return true;
      }
    }

    return false;
  }

  update(continuous) {
    var main = this._main;
    var mesh = this.getMesh();
    if (!mesh || !this._isDragging) return;

    if (this._mode === 'draw') {
      this._curveData.addRawPoint(main._mouseX, main._mouseY);
      main.render();
    } else if (this._mode === 'setup' && this._activeCP !== null) {
      var camera = main.getCamera();
      var cps = this._curveData.getControlPoints();
      var cp = cps[this._activeCP];

      var tempWorld = vec3.create();
      vec3.transformMat4(tempWorld, cp.localPos, mesh.getMatrix());
      var screenCP = camera.project(tempWorld);
      var newWorldPos = camera.unproject(main._mouseX, main._mouseY, screenCP[2]);

      var invMatrix = mat4.create();
      mat4.invert(invMatrix, mesh.getMatrix());
      var newLocalPos = vec3.create();
      vec3.transformMat4(newLocalPos, newWorldPos, invMatrix);

      vec3.copy(cp.localPos, newLocalPos);
      vec3.transformMat4(cp.worldPos, cp.localPos, mesh.getMatrix());

      main.render();
    } else if (this._mode === 'deform' && this._activeCP !== null) {
      var camera = main.getCamera();
      var cps = this._curveData.getControlPoints();
      var cp = cps[this._activeCP];

      var tempWorld = vec3.create();
      vec3.transformMat4(tempWorld, cp.localPos, mesh.getMatrix());
      var screenCP = camera.project(tempWorld);
      var newWorldPos = camera.unproject(main._mouseX, main._mouseY, screenCP[2]);

      var invMatrix = mat4.create();
      mat4.invert(invMatrix, mesh.getMatrix());
      var newLocalPos = vec3.create();
      vec3.transformMat4(newLocalPos, newWorldPos, invMatrix);

      vec3.copy(cp.localPos, newLocalPos);
      vec3.transformMat4(cp.worldPos, cp.localPos, mesh.getMatrix());

      var currentCPs = cps.map(c => c.localPos);
      var deformedSpline = generateSpline(currentCPs, 10);
      var vAr = mesh.getVertices();
      var intensity = this._intensity;

      var pOrig = vec3.create();
      var pDef = vec3.create();
      var delta = vec3.create();

      // Deform normal vertices
      if (this._vertexWeights && this._vertexWeights.length > 0) {
        for (var i = 0, l = this._vertexWeights.length; i < l; ++i) {
          var w = this._vertexWeights[i];
          var s = w.segmentIdx;
          var t = w.t;

          vec3.lerp(pOrig, this._startSpline[s], this._startSpline[s + 1], t);
          vec3.lerp(pDef, deformedSpline[s], deformedSpline[s + 1], t);
          vec3.sub(delta, pDef, pOrig);

          var distRatio = w.dist / w.localRadius;
          var fallOff = this.getFallOff(distRatio) * intensity;

          var ind = w.vertexIdx * 3;
          vAr[ind]     = w.vx + delta[0] * fallOff;
          vAr[ind + 1] = w.vy + delta[1] * fallOff;
          vAr[ind + 2] = w.vz + delta[2] * fallOff;
        }
        mesh.updateGeometry(mesh.getFacesFromVertices(this._activeIVerts), this._activeIVerts);
      }

      // Deform symmetric vertices
      var useSym = main.getSculptManager().getSymmetry();
      if (useSym && this._vertexWeightsSym && this._vertexWeightsSym.length > 0) {
        var ptPlane = mesh.getSymmetryOrigin();
        var nPlane = mesh.getSymmetryNormal();

        var currentCPsSym = currentCPs.map(p => {
          var symP = vec3.clone(p);
          Geometry.mirrorPoint(symP, ptPlane, nPlane);
          return symP;
        });
        var deformedSplineSym = generateSpline(currentCPsSym, 10);

        for (var i = 0, l = this._vertexWeightsSym.length; i < l; ++i) {
          var w = this._vertexWeightsSym[i];
          var s = w.segmentIdx;
          var t = w.t;

          vec3.lerp(pOrig, this._startSplineSym[s], this._startSplineSym[s + 1], t);
          vec3.lerp(pDef, deformedSplineSym[s], deformedSplineSym[s + 1], t);
          vec3.sub(delta, pDef, pOrig);

          var distRatio = w.dist / w.localRadius;
          var fallOff = this.getFallOff(distRatio) * intensity;

          var ind = w.vertexIdx * 3;
          vAr[ind]     = w.vx + delta[0] * fallOff;
          vAr[ind + 1] = w.vy + delta[1] * fallOff;
          vAr[ind + 2] = w.vz + delta[2] * fallOff;
        }
        mesh.updateGeometry(mesh.getFacesFromVertices(this._activeSymIVerts), this._activeSymIVerts);
      }

      this.updateMeshBuffers();
      main.render();
    }
  }

  end() {
    var main = this._main;
    var mesh = this.getMesh();
    if (!mesh || !this._isDragging) return;

    this._isDragging = false;

    if (this._mode === 'draw') {
      this._curveData.simplify(15);
      
      var camera = main.getCamera();
      this._curveData.projectToMesh(camera, mesh);

      if (this._curveData.getControlPoints().length < 2) {
        this.clear();
      } else {
        this.setMode('setup');
      }
      main.render();
    } else if (this._mode === 'setup') {
      this._activeCP = null;
      main.render();
    } else if (this._mode === 'deform') {
      this._activeCP = null;
      mesh.balanceOctree();
      main.render();
    }
  }

  bindVertices() {
    var mesh = this.getMesh();
    if (!mesh) return;

    var cps = this._curveData.getControlPoints();
    if (cps.length < 2) return;

    this._startCPs = cps.map(c => vec3.clone(c.localPos));

    var main = this._main;
    var camera = main.getCamera();
    var pixelRatio = main.getPixelRatio() || 1.0;
    var screenRadius = this._radius * pixelRatio;

    // Calculate 3D local radius of influence for each control point
    var cpsRadii = this._startCPs.map((p, idx) => {
      var brushRadius = getLocalRadiusForPoint(p, mesh, camera, screenRadius);
      var volRadius = cps[idx].volumeRadius || 0.0;
      return Math.max(brushRadius, volRadius * 1.2);
    });

    var samplesPerSegment = 10;
    var startSpline = generateSpline(this._startCPs, samplesPerSegment);
    var startSplineRadii = generateSplineRadii(cpsRadii, samplesPerSegment);

    this._startSpline = startSpline;
    this._startSplineRadii = startSplineRadii;

    // Find max radius to pad AABB
    var maxRadius = 0;
    for (var i = 0; i < startSplineRadii.length; i++) {
      if (startSplineRadii[i] > maxRadius) maxRadius = startSplineRadii[i];
    }

    // Find AABB of the entire original curve in local space using spline points
    var minX = Infinity, minY = Infinity, minZ = Infinity;
    var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (var i = 0; i < startSpline.length; i++) {
      var p = startSpline[i];
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[2] < minZ) minZ = p[2];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
      if (p[2] > maxZ) maxZ = p[2];
    }

    // Pad AABB with maxRadius
    var pad = maxRadius;
    minX -= pad; minY -= pad; minZ -= pad;
    maxX += pad; maxY += pad; maxZ += pad;

    var vAr = mesh.getVertices();
    var nbVertices = mesh.getNbVertices();

    var iVerts = [];
    var vertexWeights = [];

    var vertexPosLocal = vec3.create();
    var tempCP = vec3.create();

    for (var i = 0; i < nbVertices; ++i) {
      var idx = i * 3;
      var vx = vAr[idx];
      var vy = vAr[idx + 1];
      var vz = vAr[idx + 2];

      // Quick AABB test in local space
      if (vx < minX || vx > maxX || vy < minY || vy > maxY || vz < minZ || vz > maxZ) {
        continue;
      }

      vertexPosLocal[0] = vx;
      vertexPosLocal[1] = vy;
      vertexPosLocal[2] = vz;

      var minCPDist2 = Infinity;
      var bestT = 0.0;
      var bestIdx = 0;

      // Find closest point on 3D local curve (spline)
      for (var s = 0; s < startSpline.length - 1; ++s) {
        var t = getClosestPointOnSegment(vertexPosLocal, startSpline[s], startSpline[s + 1], tempCP);
        var dist2 = vec3.sqrDist(vertexPosLocal, tempCP);
        if (dist2 < minCPDist2) {
          minCPDist2 = dist2;
          bestT = t;
          bestIdx = s;
        }
      }

      var dist = Math.sqrt(minCPDist2);
      // Interpolate the local radius for this point on the spline segment
      var rLocal = startSplineRadii[bestIdx] + bestT * (startSplineRadii[bestIdx + 1] - startSplineRadii[bestIdx]);

      if (dist <= rLocal) {
        iVerts.push(i);
        vertexWeights.push({
          vertexIdx: i,
          segmentIdx: bestIdx,
          t: bestT,
          dist: dist,
          localRadius: rLocal,
          vx: vx,
          vy: vy,
          vz: vz
        });
      }
    }

    // Symmetry
    var useSym = main.getSculptManager().getSymmetry();
    var iVertsSym = [];
    var vertexWeightsSym = [];
    var startCPsSym = null;

    if (useSym) {
      var ptPlane = mesh.getSymmetryOrigin();
      var nPlane = mesh.getSymmetryNormal();

      startCPsSym = this._startCPs.map(p => {
        var symP = vec3.clone(p);
        Geometry.mirrorPoint(symP, ptPlane, nPlane);
        return symP;
      });

      var cpsRadiiSym = startCPsSym.map((p, idx) => {
        var brushRadius = getLocalRadiusForPoint(p, mesh, camera, screenRadius);
        var volRadius = cps[idx].volumeRadius || 0.0;
        return Math.max(brushRadius, volRadius * 1.2);
      });

      var startSplineSym = generateSpline(startCPsSym, samplesPerSegment);
      var startSplineRadiiSym = generateSplineRadii(cpsRadiiSym, samplesPerSegment);

      this._startSplineSym = startSplineSym;
      this._startSplineRadiiSym = startSplineRadiiSym;

      var maxRadiusSym = 0;
      for (var i = 0; i < startSplineRadiiSym.length; i++) {
        if (startSplineRadiiSym[i] > maxRadiusSym) maxRadiusSym = startSplineRadiiSym[i];
      }

      var sMinX = Infinity, sMinY = Infinity, sMinZ = Infinity;
      var sMaxX = -Infinity, sMaxY = -Infinity, sMaxZ = -Infinity;
      for (var i = 0; i < startSplineSym.length; i++) {
        var p = startSplineSym[i];
        if (p[0] < sMinX) sMinX = p[0];
        if (p[1] < sMinY) sMinY = p[1];
        if (p[2] < sMinZ) sMinZ = p[2];
        if (p[0] > sMaxX) sMaxX = p[0];
        if (p[1] > sMaxY) sMaxY = p[1];
        if (p[2] > sMaxZ) sMaxZ = p[2];
      }

      var padSym = maxRadiusSym;
      sMinX -= padSym; sMinY -= padSym; sMinZ -= padSym;
      sMaxX += padSym; sMaxY += padSym; sMaxZ += padSym;

      for (var i = 0; i < nbVertices; ++i) {
        var idx = i * 3;
        var vx = vAr[idx];
        var vy = vAr[idx + 1];
        var vz = vAr[idx + 2];

        if (vx < sMinX || vx > sMaxX || vy < sMinY || vy > sMaxY || vz < sMinZ || vz > sMaxZ) {
          continue;
        }

        vertexPosLocal[0] = vx;
        vertexPosLocal[1] = vy;
        vertexPosLocal[2] = vz;

        var minCPDist2 = Infinity;
        var bestT = 0.0;
        var bestIdx = 0;

        for (var s = 0; s < startSplineSym.length - 1; ++s) {
          var t = getClosestPointOnSegment(vertexPosLocal, startSplineSym[s], startSplineSym[s + 1], tempCP);
          var dist2 = vec3.sqrDist(vertexPosLocal, tempCP);
          if (dist2 < minCPDist2) {
            minCPDist2 = dist2;
            bestT = t;
            bestIdx = s;
          }
        }

        var dist = Math.sqrt(minCPDist2);
        var rLocal = startSplineRadiiSym[bestIdx] + bestT * (startSplineRadiiSym[bestIdx + 1] - startSplineRadiiSym[bestIdx]);

        if (dist <= rLocal) {
          iVertsSym.push(i);
          vertexWeightsSym.push({
            vertexIdx: i,
            segmentIdx: bestIdx,
            t: bestT,
            dist: dist,
            localRadius: rLocal,
            vx: vx,
            vy: vy,
            vz: vz
          });
        }
      }
    }

    this._activeIVerts = iVerts;
    this._vertexWeights = vertexWeights;
    this._activeSymIVerts = iVertsSym;
    this._vertexWeightsSym = vertexWeightsSym;
    this._startCPsSym = startCPsSym;
  }

  preUpdate(canBeContinuous) {
    if ((this._mode !== 'setup' && this._mode !== 'deform') || this._isDragging) return;

    var main = this._main;
    var mouseX = main._mouseX;
    var mouseY = main._mouseY;
    var pixelRatio = main.getPixelRatio() || 1.0;
    var cssMouseX = mouseX / pixelRatio;
    var cssMouseY = mouseY / pixelRatio;

    var cps = this._curveData.getControlPoints();
    var camera = main.getCamera();
    var threshold = 15;

    var prevHovered = this._hoveredCP;
    this._hoveredCP = null;

    var mesh = this.getMesh();
    var meshMatrix = mesh ? mesh.getMatrix() : mat4.create();
    var tempWorld = vec3.create();

    for (var i = 0; i < cps.length; ++i) {
      var cp = cps[i];
      vec3.transformMat4(tempWorld, cp.localPos, meshMatrix);
      var screenPos = camera.project(tempWorld);
      var sx = screenPos[0] / pixelRatio;
      var sy = screenPos[1] / pixelRatio;

      var dist = Math.hypot(cssMouseX - sx, cssMouseY - sy);
      if (dist < threshold) {
        this._hoveredCP = i;
        break;
      }
    }

    if (this._hoveredCP !== null) {
      main.setCanvasCursor('pointer');
    } else {
      main.setCanvasCursor('default');
    }

    if (this._hoveredCP !== prevHovered) {
      main.render();
    }
  }

  postRender(selection, camera, vpX) {
    this.drawOverlay(camera, vpX);
  }

  drawOverlay(camera, vpX = 0) {
    if (!this._svgLeft) return;

    var main = this._main;
    camera = camera || main.getCamera();
    var pixelRatio = main.getPixelRatio() || 1.0;
    var halfW = Math.floor(main._canvasWidth / 2);

    if (main._splitMode) {
      var wStr = (halfW / pixelRatio) + 'px';
      this._svgLeft.style.left = '0';
      this._svgLeft.style.width = wStr;
      this._svgRight.style.left = wStr;
      this._svgRight.style.width = wStr;
      this._svgRight.style.display = 'block';
    } else {
      this._svgLeft.style.left = '0';
      this._svgLeft.style.width = '100%';
      this._svgRight.style.display = 'none';
    }

    this._svg = (main._splitMode && vpX > 0) ? this._svgRight : this._svgLeft;

    var svgNS = 'http://www.w3.org/2000/svg';
    var viewport = main.getViewport();
    var width = main._splitMode ? (halfW / pixelRatio) : (viewport.clientWidth);
    var height = viewport.clientHeight;
    this._svg.setAttribute('width', width);
    this._svg.setAttribute('height', height);

    var debugCPS = this._curveData.getControlPoints();

    while (this._svg.firstChild) {
      this._svg.removeChild(this._svg.firstChild);
    }

    if (this._mode === 'draw' && this._isDragging) {
      var rawPoints = this._curveData.getRawPoints();
      if (rawPoints.length > 1) {
        var pathData = 'M ' + (rawPoints[0].x / pixelRatio) + ' ' + (rawPoints[0].y / pixelRatio);
        for (var i = 1; i < rawPoints.length; i++) {
          pathData += ' L ' + (rawPoints[i].x / pixelRatio) + ' ' + (rawPoints[i].y / pixelRatio);
        }
        var path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#00E5FF');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-dasharray', '4,4');
        this._svg.appendChild(path);
      }
    }

    if (this._mode === 'setup' || this._mode === 'deform') {
      var cps = this._curveData.getControlPoints();
      if (cps.length > 1) {
        var mesh = this.getMesh();
        var meshMatrix = mesh ? mesh.getMatrix() : mat4.create();
        var tempWorld = vec3.create();

        var screenPoints = cps.map(cp => {
          vec3.transformMat4(tempWorld, cp.localPos, meshMatrix);
          var screenPos = camera.project(tempWorld);
          return {
            x: screenPos[0] / pixelRatio,
            y: screenPos[1] / pixelRatio
          };
        });

        var pathData = 'M ' + screenPoints[0].x + ' ' + screenPoints[0].y;
        for (var i = 1; i < screenPoints.length; i++) {
          pathData += ' L ' + screenPoints[i].x + ' ' + screenPoints[i].y;
        }
        var path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#00E5FF');
        path.setAttribute('stroke-width', '3');
        this._svg.appendChild(path);

        for (var i = 0; i < screenPoints.length; i++) {
          var sp = screenPoints[i];
          var isHovered = (i === this._hoveredCP);
          var isActive = (i === this._activeCP);

          var r = 6;
          var fill = '#FFFFFF';
          var stroke = '#1A1A1A';
          var strokeWidth = '1.5';

          if (i === 0 || i === screenPoints.length - 1) {
            fill = '#FF5252';
          }

          if (isHovered) {
            r = 9;
            stroke = '#00E5FF';
            strokeWidth = '2.5';
          }
          if (isActive) {
            r = 10;
            fill = '#FFD740';
            stroke = '#00E5FF';
            strokeWidth = '3';
          }

          var circle = document.createElementNS(svgNS, 'circle');
          circle.setAttribute('cx', sp.x);
          circle.setAttribute('cy', sp.y);
          circle.setAttribute('r', r);
          circle.setAttribute('fill', fill);
          circle.setAttribute('stroke', stroke);
          circle.setAttribute('stroke-width', strokeWidth);
          this._svg.appendChild(circle);
        }
      }
    }
  }
}

export default CurveDeformTool;
