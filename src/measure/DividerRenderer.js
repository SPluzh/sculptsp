import { vec3 } from 'gl-matrix';

class DividerRenderer {
  constructor(parentElement) {
    this._parentElement = parentElement;
    this._svgLeft = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svgLeft.setAttribute('id', 'divider-overlay-left');
    this._svgLeft.style.position = 'absolute';
    this._svgLeft.style.top = '0';
    this._svgLeft.style.pointerEvents = 'none';
    this._svgLeft.style.zIndex = '100';
    this._parentElement.appendChild(this._svgLeft);

    this._svgRight = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svgRight.setAttribute('id', 'divider-overlay-right');
    this._svgRight.style.position = 'absolute';
    this._svgRight.style.top = '0';
    this._svgRight.style.pointerEvents = 'none';
    this._svgRight.style.zIndex = '100';
    this._svgRight.style.display = 'none';
    this._parentElement.appendChild(this._svgRight);

    this._svg = this._svgLeft;
  }

  onResize(width, height, pixelRatio) {
    // Handled dynamically in render()
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

  _getPixelsPerUnit(worldPos, camera, pixelRatio) {
    var view = camera.getView();
    var right = vec3.fromValues(view[0], view[4], view[8]);

    var offsetPos = vec3.create();
    vec3.scaleAndAdd(offsetPos, worldPos, right, 1.0);

    var screenPos = camera.project(worldPos);
    var screenOffsetPos = camera.project(offsetPos);

    var dx = (screenPos[0] - screenOffsetPos[0]) / pixelRatio;
    var dy = (screenPos[1] - screenOffsetPos[1]) / pixelRatio;
    return Math.hypot(dx, dy);
  }

  render(segments, pendingA, pendingB, camera, pixelRatio, mouseX, mouseY, hoveredSegment, hoveredVertexKey, divisions, useDistanceThickness, vpX = 0) {
    if (!pixelRatio) pixelRatio = 1.0;

    var main = camera._main || camera.main;
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

    var width = main._splitMode ? (halfW / pixelRatio) : (main._canvasWidth / pixelRatio);
    var height = main._canvasHeight / pixelRatio;
    this._svg.setAttribute('width', width);
    this._svg.setAttribute('height', height);

    // Clear previous elements
    while (this._svg.firstChild) {
      this._svg.removeChild(this._svg.firstChild);
    }

    // Draw existing segments
    for (var i = 0; i < segments.length; ++i) {
      var seg = segments[i];
      var posA = this._projectAnchor(seg.vertA, camera, pixelRatio);
      var posB = this._projectAnchor(seg.vertB, camera, pixelRatio);

      var worldA = this._getAnchorWorldPos(seg.vertA);
      var worldB = this._getAnchorWorldPos(seg.vertB);

      var isHoveredA = (seg === hoveredSegment && hoveredVertexKey === 'vertA');
      var isHoveredB = (seg === hoveredSegment && hoveredVertexKey === 'vertB');

      this._drawDividerSegment(posA, posB, worldA, worldB, false, seg.vertA.type, seg.vertB.type, divisions, camera, pixelRatio, isHoveredA, isHoveredB, useDistanceThickness);
    }

    // Draw pending/preview segment
    if (pendingA) {
      var pA = this._projectAnchor(pendingA, camera, pixelRatio);
      var pB = null;

      var worldA = this._getAnchorWorldPos(pendingA);
      var worldB = vec3.create();

      if (pendingB) {
        pB = this._projectAnchor(pendingB, camera, pixelRatio);
        var wB = this._getAnchorWorldPos(pendingB);
        vec3.copy(worldB, wB);
      } else {
        pB = { x: mouseX / pixelRatio, y: mouseY / pixelRatio };
        var picking = this._parentElement.ownerDocument.defaultView.mainPickingPreview || camera._main.getPicking();
        var vNear = picking.unproject(mouseX, mouseY, 0.0);
        var vFar = picking.unproject(mouseX, mouseY, 0.1);
        var rayDir = vec3.create();
        vec3.sub(rayDir, vFar, vNear);
        vec3.normalize(rayDir, rayDir);

        var aToNear = vec3.create();
        vec3.sub(aToNear, worldA, vNear);
        var projDist = vec3.dot(aToNear, rayDir);
        vec3.scaleAndAdd(worldB, vNear, rayDir, projDist);
      }

      var typeB = pendingB ? pendingB.type : 'free';
      this._drawDividerSegment(pA, pB, worldA, worldB, true, pendingA.type, typeB, divisions, camera, pixelRatio, false, false, useDistanceThickness);
    }
  }

  _drawDividerSegment(posA, posB, worldA, worldB, isPreview, typeA, typeB, divisions, camera, pixelRatio, isHoveredA, isHoveredB, useDistanceThickness) {
    var svgNS = 'http://www.w3.org/2000/svg';

    var color = '#FFFFFF';
    if (isPreview) {
      color = 'rgba(255, 255, 255, 0.6)';
    }

    var strokeWidth = 1.5;
    var rA = 5;
    var rB = 5;
    var rDiv = 3.5;

    if (useDistanceThickness && worldA && worldB && camera) {
      var worldMid = vec3.create();
      vec3.add(worldMid, worldA, worldB);
      vec3.scale(worldMid, worldMid, 0.5);

      var pixelsPerUnitMid = this._getPixelsPerUnit(worldMid, camera, pixelRatio);
      strokeWidth = 0.08 * pixelsPerUnitMid;
      strokeWidth = Math.max(0.25, Math.min(5.0, strokeWidth));

      var pixelsPerUnitA = this._getPixelsPerUnit(worldA, camera, pixelRatio);
      rA = 0.3 * pixelsPerUnitA;
      rA = Math.max(1.0, Math.min(15.0, rA));

      var pixelsPerUnitB = this._getPixelsPerUnit(worldB, camera, pixelRatio);
      rB = 0.3 * pixelsPerUnitB;
      rB = Math.max(1.0, Math.min(15.0, rB));

      rDiv = 0.2 * pixelsPerUnitMid;
      rDiv = Math.max(0.8, Math.min(10.0, rDiv));
    }

    if (isHoveredA) rA = Math.max(8.0, rA * 1.6);
    if (isHoveredB) rB = Math.max(8.0, rB * 1.6);

    // 1. Line
    var line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', posA.x);
    line.setAttribute('y1', posA.y);
    line.setAttribute('x2', posB.x);
    line.setAttribute('y2', posB.y);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', strokeWidth);
    if (isPreview) {
      line.setAttribute('stroke-dasharray', '5,5');
    }
    this._svg.appendChild(line);

    // 2. Division marks (N-1 markers)
    if (worldA && worldB && camera && pixelRatio) {
      for (var k = 1; k < divisions; ++k) {
        var t = k / divisions;
        var divWorld = vec3.create();
        vec3.lerp(divWorld, worldA, worldB, t);

        var divScreen = camera.project(divWorld);
        var divX = divScreen[0] / pixelRatio;
        var divY = divScreen[1] / pixelRatio;

        var divCircle = document.createElementNS(svgNS, 'circle');
        divCircle.setAttribute('cx', divX);
        divCircle.setAttribute('cy', divY);
        divCircle.setAttribute('r', rDiv);
        divCircle.setAttribute('fill', isPreview ? 'rgba(255, 255, 255, 0.4)' : '#FFFFFF');
        divCircle.setAttribute('stroke', isPreview ? 'rgba(26, 26, 26, 0.4)' : '#1A1A1A');
        divCircle.setAttribute('stroke-width', '1');
        this._svg.appendChild(divCircle);
      }
    }

    // 3. Endpoint A
    this._drawEndpointShape(posA.x, posA.y, rA, typeA, color, isHoveredA, isPreview);

    // 4. Endpoint B
    this._drawEndpointShape(posB.x, posB.y, rB, typeB, color, isHoveredB, isPreview);
  }

  _drawEndpointShape(cx, cy, r, type, color, isHovered, isPreview) {
    var svgNS = 'http://www.w3.org/2000/svg';
    var strokeColor = isHovered ? '#00E5FF' : '#1A1A1A';
    var strokeWidth = isHovered ? '2.5' : '1.2';

    if (type === 'vertex') {
      // Circle
      var circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', r);
      circle.setAttribute('fill', color);
      circle.setAttribute('stroke', strokeColor);
      circle.setAttribute('stroke-width', strokeWidth);
      this._svg.appendChild(circle);
    } else {
      // Free: Diamond
      var diamond = document.createElementNS(svgNS, 'polygon');
      var pts = [
        cx, cy - r,
        cx + r, cy,
        cx, cy + r,
        cx - r, cy
      ].join(',');
      diamond.setAttribute('points', pts);
      diamond.setAttribute('fill', color);
      diamond.setAttribute('stroke', strokeColor);
      diamond.setAttribute('stroke-width', strokeWidth);
      this._svg.appendChild(diamond);
    }
  }

  destroy() {
    if (this._svgLeft && this._svgLeft.parentNode) {
      this._svgLeft.parentNode.removeChild(this._svgLeft);
    }
    this._svgLeft = null;
    if (this._svgRight && this._svgRight.parentNode) {
      this._svgRight.parentNode.removeChild(this._svgRight);
    }
    this._svgRight = null;
    this._svg = null;
  }
}

export default DividerRenderer;
