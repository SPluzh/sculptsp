import { vec3 } from 'gl-matrix';

class MeasureRenderer {
  constructor(parentElement) {
    this._parentElement = parentElement;
    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svg.setAttribute('id', 'measure-overlay');
    this._svg.style.position = 'absolute';
    this._svg.style.top = '0';
    this._svg.style.left = '0';
    this._svg.style.width = '100%';
    this._svg.style.height = '100%';
    this._svg.style.pointerEvents = 'none';
    this._svg.style.zIndex = '100'; // above WebGL canvas, below UI
    this._parentElement.appendChild(this._svg);
  }

  onResize(width, height, pixelRatio) {
    // Width and height passed here are physical pixels (from Scene/onCanvasResize)
    // SVG coordinates should match CSS dimensions, so divide by pixelRatio
    var cssWidth = width / pixelRatio;
    var cssHeight = height / pixelRatio;
    this._svg.setAttribute('width', cssWidth);
    this._svg.setAttribute('height', cssHeight);
  }

  _projectVertex(mesh, vertIdx, camera, pixelRatio) {
    var vAr = mesh.getVertices();
    var idx = vertIdx * 3;
    var localPos = vec3.fromValues(vAr[idx], vAr[idx + 1], vAr[idx + 2]);
    var worldPos = vec3.create();
    vec3.transformMat4(worldPos, localPos, mesh.getMatrix());

    var screenPos = camera.project(worldPos);
    // Convert from physical pixels to CSS pixels
    return {
      x: screenPos[0] / pixelRatio,
      y: screenPos[1] / pixelRatio
    };
  }

  _getVertexWorldPos(mesh, vertIdx) {
    var vAr = mesh.getVertices();
    var idx = vertIdx * 3;
    var localPos = vec3.fromValues(vAr[idx], vAr[idx + 1], vAr[idx + 2]);
    var worldPos = vec3.create();
    vec3.transformMat4(worldPos, localPos, mesh.getMatrix());
    return worldPos;
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

  render(segments, referenceLength, pendingA, pendingB, camera, pixelRatio, mouseX, mouseY, hoveredSegment, hoveredVertexKey, useDistanceThickness) {
    // Clear previous elements
    while (this._svg.firstChild) {
      this._svg.removeChild(this._svg.firstChild);
    }

    if (!pixelRatio) pixelRatio = 1.0;

    // Draw existing segments
    for (var i = 0; i < segments.length; ++i) {
      var seg = segments[i];
      var posA = this._projectVertex(seg.mesh, seg.vertA, camera, pixelRatio);
      var posB = this._projectVertex(seg.mesh, seg.vertB, camera, pixelRatio);

      var worldA = this._getVertexWorldPos(seg.mesh, seg.vertA);
      var worldB = this._getVertexWorldPos(seg.mesh, seg.vertB);
      var dist = vec3.dist(worldA, worldB);

      var isHoveredA = (seg === hoveredSegment && hoveredVertexKey === 'vertA');
      var isHoveredB = (seg === hoveredSegment && hoveredVertexKey === 'vertB');

      this._drawSegmentLine(posA, posB, seg.isReference, dist, referenceLength, false, worldA, worldB, camera, pixelRatio, isHoveredA, isHoveredB, useDistanceThickness);
    }

    // Draw pending/preview segment
    if (pendingA) {
      var pA = this._projectVertex(pendingA.mesh, pendingA.vertIdx, camera, pixelRatio);
      var pB = null;
      var previewDist = 0.0;

      var worldA = this._getVertexWorldPos(pendingA.mesh, pendingA.vertIdx);
      var worldB = vec3.create();

      if (pendingB) {
        pB = this._projectVertex(pendingB.mesh, pendingB.vertIdx, camera, pixelRatio);
        var wB = this._getVertexWorldPos(pendingB.mesh, pendingB.vertIdx);
        vec3.copy(worldB, wB);
        previewDist = vec3.dist(worldA, worldB);
      } else {
        // Line to cursor
        pB = { x: mouseX / pixelRatio, y: mouseY / pixelRatio };
        // Approximate 3D position at current cursor using picking ray if possible
        var picking = this._parentElement.ownerDocument.defaultView.mainPickingPreview || camera._main.getPicking();
        var vNear = picking.unproject(mouseX, mouseY, 0.0);
        var vFar = picking.unproject(mouseX, mouseY, 0.1);
        // Find projection of worldA onto ray to estimate 3D cursor position
        var rayDir = vec3.create();
        vec3.sub(rayDir, vFar, vNear);
        vec3.normalize(rayDir, rayDir);

        var aToNear = vec3.create();
        vec3.sub(aToNear, worldA, vNear);
        var projDist = vec3.dot(aToNear, rayDir);
        vec3.scaleAndAdd(worldB, vNear, rayDir, projDist);

        previewDist = vec3.dist(worldA, worldB);
      }

      var isRef = !segments.some(s => s.isReference);
      this._drawSegmentLine(pA, pB, isRef, previewDist, referenceLength, true, worldA, worldB, camera, pixelRatio, false, false, useDistanceThickness);
    }
  }

  _drawSegmentLine(posA, posB, isReference, worldDist, referenceLength, isPreview, worldA, worldB, camera, pixelRatio, isHoveredA, isHoveredB, useDistanceThickness) {
    var svgNS = 'http://www.w3.org/2000/svg';

    var color = isReference ? '#FFFFFF' : '#B0BEC5'; // White for Ref, Gray for Measure
    if (isPreview) {
      color = isReference ? 'rgba(255, 255, 255, 0.6)' : 'rgba(176, 190, 197, 0.6)';
    }

    var strokeWidth = isReference ? 1.5 : 1.0;
    var rA = isReference ? 5 : 4;
    var rB = isReference ? 5 : 4;

    if (useDistanceThickness && worldA && worldB && camera) {
      var worldMid = vec3.create();
      vec3.add(worldMid, worldA, worldB);
      vec3.scale(worldMid, worldMid, 0.5);

      var pixelsPerUnitMid = this._getPixelsPerUnit(worldMid, camera, pixelRatio);
      strokeWidth = (isReference ? 0.11 : 0.075) * pixelsPerUnitMid;
      strokeWidth = Math.max(0.25, Math.min(5.0, strokeWidth));

      var pixelsPerUnitA = this._getPixelsPerUnit(worldA, camera, pixelRatio);
      rA = (isReference ? 0.35 : 0.28) * pixelsPerUnitA;
      rA = Math.max(1.0, Math.min(15.0, rA));

      var pixelsPerUnitB = this._getPixelsPerUnit(worldB, camera, pixelRatio);
      rB = (isReference ? 0.35 : 0.28) * pixelsPerUnitB;
      rB = Math.max(1.0, Math.min(15.0, rB));
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

    // 2. Endpoint circles
    var circleA = document.createElementNS(svgNS, 'circle');
    circleA.setAttribute('cx', posA.x);
    circleA.setAttribute('cy', posA.y);
    circleA.setAttribute('r', rA);
    circleA.setAttribute('fill', color);
    circleA.setAttribute('stroke', isHoveredA ? '#00E5FF' : '#1A1A1A');
    circleA.setAttribute('stroke-width', isHoveredA ? '2.5' : '1.2');
    this._svg.appendChild(circleA);

    var circleB = document.createElementNS(svgNS, 'circle');
    circleB.setAttribute('cx', posB.x);
    circleB.setAttribute('cy', posB.y);
    circleB.setAttribute('r', rB);
    circleB.setAttribute('fill', color);
    circleB.setAttribute('stroke', isHoveredB ? '#00E5FF' : '#1A1A1A');
    circleB.setAttribute('stroke-width', isHoveredB ? '2.5' : '1.2');
    this._svg.appendChild(circleB);

    // 3. Ticks along the segment line (for integer multiples of reference length)
    if (!isReference && referenceLength && referenceLength > 0 && worldA && worldB && camera && pixelRatio) {
      var L = worldDist;
      var nTicks = Math.floor((L - 1e-5) / referenceLength);
      for (var k = 1; k <= nTicks; ++k) {
        var t = (k * referenceLength) / L;
        var tickWorldPos = vec3.create();
        vec3.lerp(tickWorldPos, worldA, worldB, t);

        var tickScreen = camera.project(tickWorldPos);
        var tickX = tickScreen[0] / pixelRatio;
        var tickY = tickScreen[1] / pixelRatio;

        var tickCircle = document.createElementNS(svgNS, 'circle');
        tickCircle.setAttribute('cx', tickX);
        tickCircle.setAttribute('cy', tickY);
        tickCircle.setAttribute('r', '2.5');
        tickCircle.setAttribute('fill', '#FFFFFF');
        tickCircle.setAttribute('stroke', color);
        tickCircle.setAttribute('stroke-width', '1');
        this._svg.appendChild(tickCircle);
      }
    }

    // 4. Text label in the middle of the segment
    var midX = (posA.x + posB.x) / 2;
    var midY = (posA.y + posB.y) / 2;

    var label = '';
    if (isReference) {
      label = '1.0x';
    } else {
      if (referenceLength && referenceLength > 0) {
        var ratio = worldDist / referenceLength;
        label = ratio.toFixed(1) + 'x';
      } else {
        label = worldDist.toFixed(1);
      }
    }

    var group = document.createElementNS(svgNS, 'g');

    // Create text element first to estimate width
    var text = document.createElementNS(svgNS, 'text');
    text.setAttribute('fill', '#FFFFFF');
    text.setAttribute('font-family', "'Open Sans', 'Inter', sans-serif");
    text.setAttribute('font-size', '11px');
    text.setAttribute('font-weight', '600');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = label;

    // Approximate size to avoid getBBox layout reflow
    var textWidth = label.length * 6.5 + 12;
    var textHeight = 18;

    var rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', midX - textWidth / 2);
    rect.setAttribute('y', midY - textHeight / 2 - 10); // Offset up slightly
    rect.setAttribute('width', textWidth);
    rect.setAttribute('height', textHeight);
    rect.setAttribute('rx', '4');
    rect.setAttribute('ry', '4');
    rect.setAttribute('fill', 'rgba(20, 20, 20, 0.85)');
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', '1');

    text.setAttribute('x', midX);
    text.setAttribute('y', midY - 10);

    group.appendChild(rect);
    group.appendChild(text);
    this._svg.appendChild(group);
  }

  destroy() {
    if (this._svg && this._svg.parentNode) {
      this._svg.parentNode.removeChild(this._svg);
    }
  }
}

export default MeasureRenderer;
