import { vec3 } from 'gl-matrix';
import SculptBase from '../editing/tools/SculptBase.js';
import Utils from '../misc/Utils.js';

class MeasureTool extends SculptBase {
  constructor(main) {
    super(main);
    this._segments = [];        // Array of { mesh, vertA, vertB, isReference }
    this._pendingA = null;      // { mesh, vertIdx }
    this._pendingB = null;      // { mesh, vertIdx } for preview
    this._draggedSegment = null; // Segment currently being edited
    this._draggedVertexKey = ''; // 'vertA' or 'vertB'
    this._hoveredSegment = null; // Segment currently hovered
    this._hoveredVertexKey = ''; // 'vertA' or 'vertB'
    this._useDistanceThickness = true; // Thickness scales with camera distance
  }

  isActive() {
    return this._main.getSculptManager().getToolIndex() === 16; // Enums.Tools.MEASURE is 16
  }

  onActivate() {
    this._pendingA = null;
    this._pendingB = null;
    this._draggedSegment = null;
    this._draggedVertexKey = '';
    this._hoveredSegment = null;
    this._hoveredVertexKey = '';
  }

  onDeactivate() {
    this._pendingA = null;
    this._pendingB = null;
    this._draggedSegment = null;
    this._draggedVertexKey = '';
    this._hoveredSegment = null;
    this._hoveredVertexKey = '';
  }

  clear() {
    this._segments = [];
    this._pendingA = null;
    this._pendingB = null;
    this._draggedSegment = null;
    this._draggedVertexKey = '';
    this._hoveredSegment = null;
    this._hoveredVertexKey = '';
    this._main.render();
  }

  getSegments() {
    // Filter out segments whose meshes are no longer in the scene
    var meshes = this._main.getMeshes();
    this._segments = this._segments.filter(seg => meshes.indexOf(seg.mesh) !== -1);
    return this._segments;
  }

  getReferenceLength() {
    var refSeg = this._segments.find(seg => seg.isReference);
    if (!refSeg) return null;
    return this.getSegmentWorldLength(refSeg);
  }

  getSegmentWorldLength(seg) {
    var posA = this.getVertexWorldPos(seg.mesh, seg.vertA);
    var posB = this.getVertexWorldPos(seg.mesh, seg.vertB);
    return vec3.dist(posA, posB);
  }

  getVertexWorldPos(mesh, vertIdx) {
    var vAr = mesh.getVertices();
    var idx = vertIdx * 3;
    var localPos = vec3.fromValues(vAr[idx], vAr[idx + 1], vAr[idx + 2]);
    var worldPos = vec3.create();
    vec3.transformMat4(worldPos, localPos, mesh.getMatrix());
    return worldPos;
  }

  _projectVertex(mesh, vertIdx, camera, pixelRatio) {
    var vAr = mesh.getVertices();
    var idx = vertIdx * 3;
    var localPos = vec3.fromValues(vAr[idx], vAr[idx + 1], vAr[idx + 2]);
    var worldPos = vec3.create();
    vec3.transformMat4(worldPos, localPos, mesh.getMatrix());

    var screenPos = camera.project(worldPos);
    return {
      x: screenPos[0] / pixelRatio,
      y: screenPos[1] / pixelRatio
    };
  }

  _pickNearestVertex(mouseX, mouseY) {
    var picking = this._main.getPicking();
    var hit = picking.intersectionMouseMeshes(this._main.getMeshes(), mouseX, mouseY);
    if (!hit) return null;

    var mesh = picking.getMesh();
    var face = picking.getPickedFace();
    var inter = picking.getIntersectionPoint();
    var fAr = mesh.getFaces();
    var vAr = mesh.getVertices();

    var bestVert = -1;
    var bestDist = Infinity;
    var id = face * 4;
    for (var k = 0; k < 4; ++k) {
      var vi = fAr[id + k];
      if (vi === undefined || vi === Utils.TRI_INDEX) continue;
      var idx = vi * 3;
      var dx = vAr[idx] - inter[0];
      var dy = vAr[idx + 1] - inter[1];
      var dz = vAr[idx + 2] - inter[2];
      var dist2 = dx * dx + dy * dy + dz * dz;
      if (dist2 < bestDist) {
        bestDist = dist2;
        bestVert = vi;
      }
    }
    if (bestVert !== -1) {
      return { mesh: mesh, vertIdx: bestVert };
    }
    return null;
  }

  getHoveredSegment() {
    return this._hoveredSegment;
  }

  getHoveredVertexKey() {
    return this._hoveredVertexKey;
  }

  preUpdate() {
    var mouseX = this._main._mouseX;
    var mouseY = this._main._mouseY;
    var pixelRatio = this._main.getPixelRatio() || 1.0;
    var cssMouseX = mouseX / pixelRatio;
    var cssMouseY = mouseY / pixelRatio;

    var segments = this.getSegments();
    var camera = this._main.getCamera();
    var threshold = 15; // Click/hover radius in CSS pixels

    var prevHoveredSegment = this._hoveredSegment;
    var prevHoveredVertexKey = this._hoveredVertexKey;

    this._hoveredSegment = null;
    this._hoveredVertexKey = '';

    for (var i = 0; i < segments.length; ++i) {
      var seg = segments[i];
      var posA = this._projectVertex(seg.mesh, seg.vertA, camera, pixelRatio);
      var posB = this._projectVertex(seg.mesh, seg.vertB, camera, pixelRatio);

      var distA = Math.hypot(cssMouseX - posA.x, cssMouseY - posA.y);
      var distB = Math.hypot(cssMouseX - posB.x, cssMouseY - posB.y);

      if (distA < threshold && distA <= distB) {
        this._hoveredSegment = seg;
        this._hoveredVertexKey = 'vertA';
        break;
      }
      if (distB < threshold) {
        this._hoveredSegment = seg;
        this._hoveredVertexKey = 'vertB';
        break;
      }
    }

    if (this._hoveredSegment) {
      this._main.setCanvasCursor('pointer');
    } else {
      this._main.setCanvasCursor('default');
    }

    if (this._hoveredSegment !== prevHoveredSegment || this._hoveredVertexKey !== prevHoveredVertexKey) {
      this._main.render();
    }
  }

  start(ctrl) {
    var mouseX = this._main._mouseX;
    var mouseY = this._main._mouseY;
    var pixelRatio = this._main.getPixelRatio() || 1.0;
    var cssMouseX = mouseX / pixelRatio;
    var cssMouseY = mouseY / pixelRatio;

    // Check if we clicked near any endpoint of an existing segment
    var segments = this.getSegments();
    var camera = this._main.getCamera();
    var threshold = 15; // Click radius in CSS pixels

    for (var i = 0; i < segments.length; ++i) {
      var seg = segments[i];
      var posA = this._projectVertex(seg.mesh, seg.vertA, camera, pixelRatio);
      var posB = this._projectVertex(seg.mesh, seg.vertB, camera, pixelRatio);

      var distA = Math.hypot(cssMouseX - posA.x, cssMouseY - posA.y);
      var distB = Math.hypot(cssMouseX - posB.x, cssMouseY - posB.y);

      if (distA < threshold && distA <= distB) {
        this._draggedSegment = seg;
        this._draggedVertexKey = 'vertA';
        return true;
      }
      if (distB < threshold) {
        this._draggedSegment = seg;
        this._draggedVertexKey = 'vertB';
        return true;
      }
    }

    // Otherwise, draw a new segment
    var pick = this._pickNearestVertex(mouseX, mouseY);
    if (pick) {
      this._pendingA = pick;
      this._pendingB = pick;
      this._main.render();
      return true;
    }
    return false;
  }

  update() {
    var mouseX = this._main._mouseX;
    var mouseY = this._main._mouseY;

    if (this._draggedSegment) {
      var pick = this._pickNearestVertex(mouseX, mouseY);
      if (pick) {
        this._draggedSegment.mesh = pick.mesh;
        this._draggedSegment[this._draggedVertexKey] = pick.vertIdx;
      }
      this._main.render();
      return;
    }

    var pick = this._pickNearestVertex(mouseX, mouseY);
    if (pick && pick.mesh === this._pendingA.mesh) {
      this._pendingB = pick;
    } else {
      this._pendingB = null;
    }
    this._main.render();
  }

  end() {
    if (this._draggedSegment) {
      // Clean up segments where both endpoints were dragged to the same vertex (allows deletion by overlapping endpoints)
      this._segments = this._segments.filter(seg => seg.vertA !== seg.vertB);
      // If reference segment was deleted, make the first remaining one the new reference
      var hasReference = this._segments.some(seg => seg.isReference);
      if (!hasReference && this._segments.length > 0) {
        this._segments[0].isReference = true;
      }
      this._draggedSegment = null;
      this._draggedVertexKey = '';
      this._main.render();
      return;
    }

    if (this._pendingA) {
      if (this._pendingB && this._pendingB.vertIdx !== this._pendingA.vertIdx) {
        var hasReference = this._segments.some(seg => seg.isReference);
        this._segments.push({
          mesh: this._pendingA.mesh,
          vertA: this._pendingA.vertIdx,
          vertB: this._pendingB.vertIdx,
          isReference: !hasReference
        });
      }
    }
    this._pendingA = null;
    this._pendingB = null;
    this._main.render();
  }

  getPendingA() {
    return this._pendingA;
  }

  getPendingB() {
    return this._pendingB;
  }

  postRender(selection) {
    // Override to hide selection/brush outline circles when measuring
  }
}

export default MeasureTool;
