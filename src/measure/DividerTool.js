import { vec3 } from 'gl-matrix';
import SculptBase from '../editing/tools/SculptBase.js';
import Utils from '../misc/Utils.js';

class DividerTool extends SculptBase {
  constructor(main) {
    super(main);
    this._segments = [];        // Array of { vertA, vertB } where vertA/B are { type: 'vertex'|'free', mesh?, vertIdx?, worldPos? }
    this._pendingA = null;      // Anchor A for preview
    this._pendingB = null;      // Anchor B for preview
    this._draggedSegment = null; // Segment currently being edited
    this._draggedVertexKey = ''; // 'vertA' or 'vertB'
    this._hoveredSegment = null; // Segment currently hovered
    this._hoveredVertexKey = ''; // 'vertA' or 'vertB'
    this._useDistanceThickness = true; // Thickness scales with camera distance
    this._divisions = 3;        // Number of parts to divide segment (2 to 6)
    this._isVisible = true;
    this._isVisibleViewport2 = true;
  }

  isActive() {
    return this._main.getSculptManager().getToolIndex() === 19; // Enums.Tools.DIVIDER is 19
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
    if (this._main.getGui() && this._main.getGui().updateMesh) {
      this._main.getGui().updateMesh();
    }
  }

  getSegments() {
    var meshes = this._main.getMeshes();
    this._segments = this._segments.filter(seg => {
      if (seg.vertA.type === 'vertex' && meshes.indexOf(seg.vertA.mesh) === -1) return false;
      if (seg.vertB.type === 'vertex' && meshes.indexOf(seg.vertB.mesh) === -1) return false;
      return true;
    });
    return this._segments;
  }

  getDivisions() {
    return this._divisions;
  }

  setDivisions(n) {
    this._divisions = Math.max(2, Math.min(6, n));
    this._main.render();
  }

  _getAnchorWorldPos(anchor) {
    if (!anchor) return null;
    if (anchor.type === 'vertex') {
      var mesh = anchor.mesh;
      var vertIdx = anchor.vertIdx;
      var vAr = mesh.getVertices();
      var idx = vertIdx * 3;
      var localPos = vec3.fromValues(vAr[idx], vAr[idx + 1], vAr[idx + 2]);
      var worldPos = vec3.create();
      vec3.transformMat4(worldPos, localPos, mesh.getMatrix());
      return worldPos;
    } else {
      return vec3.clone(anchor.worldPos);
    }
  }

  _projectAnchor(anchor, camera, pixelRatio) {
    var worldPos = this._getAnchorWorldPos(anchor);
    if (!worldPos) return null;
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

  _pickAnchor(mouseX, mouseY, referenceWorldPos) {
    var pick = this._pickNearestVertex(mouseX, mouseY);
    if (pick) {
      return {
        type: 'vertex',
        mesh: pick.mesh,
        vertIdx: pick.vertIdx
      };
    }

    var camera = this._main.getCamera();
    var depth = 0.5;
    if (referenceWorldPos) {
      var screenPivot = camera.project(referenceWorldPos);
      depth = screenPivot[2];
    } else {
      var screenPivot = camera.project(camera._center);
      depth = screenPivot[2];
    }
    var worldPos = camera.unproject(mouseX, mouseY, depth);
    return {
      type: 'free',
      worldPos: worldPos
    };
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
      var posA = this._projectAnchor(seg.vertA, camera, pixelRatio);
      var posB = this._projectAnchor(seg.vertB, camera, pixelRatio);

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

    var segments = this.getSegments();
    var camera = this._main.getCamera();
    var threshold = 15;

    for (var i = 0; i < segments.length; ++i) {
      var seg = segments[i];
      var posA = this._projectAnchor(seg.vertA, camera, pixelRatio);
      var posB = this._projectAnchor(seg.vertB, camera, pixelRatio);

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

    var pick = this._pickAnchor(mouseX, mouseY, null);
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
      var otherKey = this._draggedVertexKey === 'vertA' ? 'vertB' : 'vertA';
      var refWorldPos = this._getAnchorWorldPos(this._draggedSegment[otherKey]);
      var pick = this._pickAnchor(mouseX, mouseY, refWorldPos);
      if (pick) {
        this._draggedSegment[this._draggedVertexKey] = pick;
      }
      this._main.render();
      return;
    }

    if (this._pendingA) {
      var refWorldPos = this._getAnchorWorldPos(this._pendingA);
      var pick = this._pickAnchor(mouseX, mouseY, refWorldPos);
      this._pendingB = pick;
      this._main.render();
    }
  }

  end() {
    var changed = false;
    if (this._draggedSegment) {
      var oldLen = this._segments.length;
      this._segments = this._segments.filter(seg => {
        var posA = this._getAnchorWorldPos(seg.vertA);
        var posB = this._getAnchorWorldPos(seg.vertB);
        return vec3.dist(posA, posB) > 1e-4;
      });
      if (this._segments.length !== oldLen) changed = true;
      this._draggedSegment = null;
      this._draggedVertexKey = '';
      this._main.render();
      if (changed && this._main.getGui() && this._main.getGui().updateMesh) {
        this._main.getGui().updateMesh();
      }
      return;
    }

    if (this._pendingA && this._pendingB) {
      var posA = this._getAnchorWorldPos(this._pendingA);
      var posB = this._getAnchorWorldPos(this._pendingB);
      if (vec3.dist(posA, posB) > 1e-4) {
        this._segments.push({
          vertA: this._pendingA,
          vertB: this._pendingB
        });
        changed = true;
      }
    }
    this._pendingA = null;
    this._pendingB = null;
    this._main.render();
    if (changed && this._main.getGui() && this._main.getGui().updateMesh) {
      this._main.getGui().updateMesh();
    }
  }

  getPendingA() {
    return this._pendingA;
  }

  getPendingB() {
    return this._pendingB;
  }

  isVisible(viewportIndex) {
    if (viewportIndex === 0) return this._isVisible;
    if (viewportIndex === 1) return this._isVisibleViewport2;
    return this._isVisible || this._isVisibleViewport2;
  }

  setVisible(bool, viewportIndex) {
    if (viewportIndex === 0) {
      this._isVisible = bool;
    } else if (viewportIndex === 1) {
      this._isVisibleViewport2 = bool;
    } else {
      this._isVisible = bool;
      this._isVisibleViewport2 = bool;
    }
  }

  postRender(selection) {
    // Override to hide selection outline circles
  }
}

export default DividerTool;
