import { mat4 } from 'gl-matrix';
import Geometry from '../../math3d/Geometry.js';
import Utils from '../../misc/Utils.js';
import SculptBase from './SculptBase.js';

class MaskGradientBlur extends SculptBase {
  constructor(main) {
    super(main);

    this._pointA = null; // [x, y] in physical viewport pixels
    this._pointB = null; // [x, y] in physical viewport pixels
    this._activePoint = null; // 'A' or 'B'
    this._isDrawingLine = false;

    this._svg = null;
    this._svgLine = null;
    this._svgCircleA = null;
    this._svgCircleB = null;
  }

  pushState() {
    this._main.getStateManager().pushStateColorAndMaterial(this.getMesh());
  }

  updateMeshBuffers() {
    var mesh = this.getMesh();
    if (mesh.isDynamic) {
      mesh.updateBuffers();
    } else {
      mesh.updateMaterialBuffer();
    }
  }

  onActivate() {
    this.createOverlay();
    this.updateOverlay();

    this._onResizeBound = this.updateOverlay.bind(this);
    window.addEventListener('resize', this._onResizeBound);
  }

  onDeactivate() {
    this.destroyOverlay();
    this._activePoint = null;
    this._isDrawingLine = false;

    this._main.setCanvasCursor('default');

    if (this._onResizeBound) {
      window.removeEventListener('resize', this._onResizeBound);
      this._onResizeBound = null;
    }
  }

  createOverlay() {
    if (this._svg) return;
    var viewport = this._main.getViewport();
    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svg.setAttribute('id', 'gradient-blur-overlay');
    this._svg.style.position = 'absolute';
    this._svg.style.top = '0';
    this._svg.style.pointerEvents = 'none';
    this._svg.style.zIndex = '101';
    viewport.appendChild(this._svg);

    // Dotted guide line
    this._svgLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this._svgLine.setAttribute('stroke', '#00E5FF');
    this._svgLine.setAttribute('stroke-width', '2');
    this._svgLine.setAttribute('stroke-dasharray', '6,4');
    this._svgLine.setAttribute('opacity', '0.85');
    this._svg.appendChild(this._svgLine);

    // Handle A: Original Mask end (0.0 - fully masked)
    this._svgCircleA = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this._svgCircleA.setAttribute('r', '8');
    this._svgCircleA.setAttribute('fill', '#FFFFFF');
    this._svgCircleA.setAttribute('stroke', '#00E5FF');
    this._svgCircleA.setAttribute('stroke-width', '2.5');
    this._svgCircleA.setAttribute('opacity', '0.9');
    this._svgCircleA.setAttribute('style', 'pointer-events: none; transition: transform 0.1s;');
    this._svg.appendChild(this._svgCircleA);

    // Handle B: Fully Unmasked end (1.0 - unmasked)
    this._svgCircleB = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this._svgCircleB.setAttribute('r', '8');
    this._svgCircleB.setAttribute('fill', '#00E5FF');
    this._svgCircleB.setAttribute('stroke', '#FFFFFF');
    this._svgCircleB.setAttribute('stroke-width', '2.5');
    this._svgCircleB.setAttribute('opacity', '0.9');
    this._svgCircleB.setAttribute('style', 'pointer-events: none; transition: transform 0.1s;');
    this._svg.appendChild(this._svgCircleB);
  }

  destroyOverlay() {
    if (this._svg && this._svg.parentNode) {
      this._svg.parentNode.removeChild(this._svg);
    }
    this._svg = null;
    this._svgLine = null;
    this._svgCircleA = null;
    this._svgCircleB = null;
  }

  updateOverlay() {
    if (!this._svg) return;

    var halfW = Math.floor(this._main._canvasWidth / 2);
    var pixelRatio = this._main.getPixelRatio() || 1.0;

    if (this._main._splitMode && this._main._activeViewport === 1) {
      this._svg.style.left = (halfW / pixelRatio) + 'px';
      this._svg.style.width = (halfW / pixelRatio) + 'px';
    } else if (this._main._splitMode) {
      this._svg.style.left = '0';
      this._svg.style.width = (halfW / pixelRatio) + 'px';
    } else {
      this._svg.style.left = '0';
      this._svg.style.width = '100%';
    }
    this._svg.style.height = '100%';

    if (this._pointA && this._pointB) {
      this._svgLine.style.display = 'block';
      this._svgCircleA.style.display = 'block';
      this._svgCircleB.style.display = 'block';

      var ax = this._pointA[0] / pixelRatio;
      var ay = this._pointA[1] / pixelRatio;
      var bx = this._pointB[0] / pixelRatio;
      var by = this._pointB[1] / pixelRatio;

      this._svgLine.setAttribute('x1', ax);
      this._svgLine.setAttribute('y1', ay);
      this._svgLine.setAttribute('x2', bx);
      this._svgLine.setAttribute('y2', by);

      // Handle circle transformations properly if scaled
      this._svgCircleA.setAttribute('cx', ax);
      this._svgCircleA.setAttribute('cy', ay);
      this._svgCircleA.style.transformOrigin = `${ax}px ${ay}px`;

      this._svgCircleB.setAttribute('cx', bx);
      this._svgCircleB.setAttribute('cy', by);
      this._svgCircleB.style.transformOrigin = `${bx}px ${by}px`;
    } else {
      this._svgLine.style.display = 'none';
      this._svgCircleA.style.display = 'none';
      this._svgCircleB.style.display = 'none';
    }
  }

  preUpdate() {
    var mesh = this.getMesh();
    if (!mesh || !this._pointA || !this._pointB) {
      this._main.setCanvasCursor('default');
      return;
    }

    var mouseX = this._main._mouseX;
    var mouseY = this._main._mouseY;
    var pixelRatio = this._main.getPixelRatio() || 1.0;
    var threshold = 20 * pixelRatio;

    var distA = Math.hypot(mouseX - this._pointA[0], mouseY - this._pointA[1]);
    var distB = Math.hypot(mouseX - this._pointB[0], mouseY - this._pointB[1]);

    var hoveredA = distA < threshold && distA <= distB;
    var hoveredB = distB < threshold && !hoveredA;

    if (hoveredA) {
      this._main.setCanvasCursor('pointer');
      if (this._svgCircleA) this._svgCircleA.style.transform = 'scale(1.3)';
    } else {
      if (this._svgCircleA) this._svgCircleA.style.transform = '';
    }

    if (hoveredB) {
      this._main.setCanvasCursor('pointer');
      if (this._svgCircleB) this._svgCircleB.style.transform = 'scale(1.3)';
    } else {
      if (this._svgCircleB) this._svgCircleB.style.transform = '';
    }

    if (!hoveredA && !hoveredB) {
      this._main.setCanvasCursor('default');
    }
  }

  start(ctrl) {
    var mesh = this.getMesh();
    if (!mesh) return false;

    var mouseX = this._main._mouseX;
    var mouseY = this._main._mouseY;
    var pixelRatio = this._main.getPixelRatio() || 1.0;

    // Detect click on handles in physical pixels
    var threshold = 20 * pixelRatio;

    if (this._pointA && this._pointB) {
      var distA = Math.hypot(mouseX - this._pointA[0], mouseY - this._pointA[1]);
      var distB = Math.hypot(mouseX - this._pointB[0], mouseY - this._pointB[1]);

      if (distA < threshold && distA <= distB) {
        this._activePoint = 'A';
        this.pushState();
        return true;
      }
      if (distB < threshold) {
        this._activePoint = 'B';
        this.pushState();
        return true;
      }
    }

    // Start drawing a new line
    this._pointA = [mouseX, mouseY];
    this._pointB = [mouseX, mouseY];
    this._activePoint = 'B';
    this._isDrawingLine = true;
    this.pushState();

    this.updateOverlay();
    return true;
  }

  update() {
    var mesh = this.getMesh();
    if (!mesh || !this._pointA) return;

    var mouseX = this._main._mouseX;
    var mouseY = this._main._mouseY;

    if (this._activePoint === 'A') {
      this._pointA = [mouseX, mouseY];
    } else if (this._activePoint === 'B') {
      this._pointB = [mouseX, mouseY];
    }

    this.updateOverlay();
    this.applyGradientMask();
  }

  applyGradientMask() {
    var mesh = this.getMesh();
    if (!mesh || !this._pointA || !this._pointB) return;

    var vAr = mesh.getVertices();
    var mAr = mesh.getMaterials();
    var camera = this._main.getCamera();
    var mat = mesh.getMatrix();

    var localToScreen = mat4.create();
    mat4.mul(localToScreen, camera.computeWorldToScreenMatrix(), mat);

    var m = localToScreen;
    var m0 = m[0], m4 = m[4], m8 = m[8], m12 = m[12];
    var m1 = m[1], m5 = m[5], m9 = m[9], m13 = m[13];
    var m3 = m[3], m7 = m[7], m11 = m[11], m15 = m[15];
    var height = camera._height;

    var ax = this._pointA[0];
    var ay = this._pointA[1];
    var bx = this._pointB[0];
    var by = this._pointB[1];

    var vx_line = bx - ax;
    var vy_line = by - ay;
    var len2 = vx_line * vx_line + vy_line * vy_line;
    if (len2 < 1e-4) len2 = 1.0;

    var symmetry = this._main.getSculptManager().getSymmetry();
    var ptPlane, nPlane;
    if (symmetry) {
      ptPlane = mesh.getSymmetryOrigin();
      nPlane = mesh.getSymmetryNormal();
    }

    var nbVerts = mesh.getNbVertices();

    for (var i = 0; i < nbVerts; ++i) {
      var ind = i * 3;
      var vx = vAr[ind];
      var vy = vAr[ind + 1];
      var vz = vAr[ind + 2];

      // Project vertex to screen (local coordinates to active viewport space)
      var w = m3 * vx + m7 * vy + m11 * vz + m15;
      w = w || 1.0;
      var sx = (m0 * vx + m4 * vy + m8 * vz + m12) / w;
      var sy = height - (m1 * vx + m5 * vy + m9 * vz + m13) / w;

      // Project onto segment AB
      var t = ((sx - ax) * vx_line + (sy - ay) * vy_line) / len2;

      if (symmetry) {
        var symV = [vx, vy, vz];
        Geometry.mirrorPoint(symV, ptPlane, nPlane);
        var svx = symV[0], svy = symV[1], svz = symV[2];
        var sw = m3 * svx + m7 * svy + m11 * svz + m15;
        sw = sw || 1.0;
        var ssx = (m0 * svx + m4 * svy + m8 * svz + m12) / sw;
        var ssy = height - (m1 * svx + m5 * svy + m9 * svz + m13) / sw;
        var t_sym = ((ssx - ax) * vx_line + (ssy - ay) * vy_line) / len2;
        t = Math.min(t, t_sym);
      }

      t = Math.min(Math.max(t, 0.0), 1.0);
      mAr[ind + 2] = t;
    }

    // Upload to GPU
    mesh.updateDuplicateColorsAndMaterials();
    mesh.updateDrawArrays();
    this.updateRender();
  }

  end() {
    if (this._isDrawingLine && this._pointA && this._pointB) {
      var dist = Math.hypot(this._pointB[0] - this._pointA[0], this._pointB[1] - this._pointA[1]);
      if (dist < 5) {
        var cx = this._pointA[0];
        var cy = this._pointA[1];
        this._pointA = [cx - 75, cy];
        this._pointB = [cx + 75, cy];
        this.updateOverlay();
        this.applyGradientMask();
      }
    }
    this._activePoint = null;
    this._isDrawingLine = false;
  }
}

export default MaskGradientBlur;
