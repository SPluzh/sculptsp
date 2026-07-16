import ShaderBase from '../render/shaders/ShaderBase.js';

var Export = {};

// versions
// 1 initial
// 2 + camera,shader, matcap, wire, alpha, flat 
// 3 faces u32 instead of i32
// 4 + visibility (v1, v2)
// 5 + vertex visibility (vertVisible u8 array)
// 6 + measure & segment divider tools states and segments
Export.VERSION = 6;

// current version 5
//
// Version (u32)

// ShowGrid (u32) .v2
// ShowMirror (u32) .v2
// ShowContour (u32) .v2

// CameraProj (u32) .v2
// CameraMode (u32) .v2
// CameraFov (f32) .v2
// CameraPivot (u32) .v2

// nbMeshes (u32)

// Shader (u32) .v2
// Matcap (u32) .v2
// ShowWireframe (u32) .v2;
// FlatShading (u32) .v2;
// Alpha (f32) .v2
// VisibilityV1 (u32) .v4
// VisibilityV2 (u32) .v4

// Center (f32 * 3)
// Matrix (f32 * 16)
// Scale (f32)
//
// NbVertices (u32)
// vertices (f32 * 3 * nbVertices)

// nbColors (u32) => 0 or nbVertices
// colors (f32 * 3 * nbVertices)

// nbMaterials (u32) => 0 or nbVertices
// materials (f32 * 3 * nbVertices)

// NbFaces (u32)
// faces (u32 * 4 * nbFaces)

// NbTexCoords (u32) => 0 means no UV
// texcoords (f32 * 2 * nbTexCoords)

// NbFacesTexCoords (u32) => 0 or nbFaces
// faces (u32 * 4 * nbFaces)
//
/** Export SGL (sculptsp) file */

Export.exportSGL = function (meshes, main) {
  var nbMeshes = meshes.length;

  var bytePerMesh = 3 + 16 + 1 + 6 + 5 + 2;
  var nbBytes = 4 * (1 + 3 + 4 + 1 + nbMeshes * bytePerMesh);
  var i = 0;
  var mesh;
  for (i = 0; i < nbMeshes; ++i) {
    mesh = meshes[i];
    nbBytes += mesh.getNbVertices() * 4 * 3;
    nbBytes += Math.ceil(mesh.getNbVertices() / 4) * 4;
    if (mesh.getColors())
      nbBytes += mesh.getNbVertices() * 4 * 3;
    if (mesh.getMaterials())
      nbBytes += mesh.getNbVertices() * 4 * 3;
    nbBytes += mesh.getNbFaces() * 4 * 4;
    if (mesh.hasUV()) {
      nbBytes += mesh.getNbTexCoords() * 4 * 2;
      nbBytes += mesh.getNbFaces() * 4 * 4;
    }
  }

  // Version 6 extra data
  var extraWords = 0;
  var measureTool = main._measureTool;
  var measureSegments = measureTool ? measureTool.getSegments() : [];
  var isMeasureVisibleV1 = measureTool ? (measureTool._isVisible ? 1 : 0) : 1;
  var isMeasureVisibleV2 = measureTool ? (measureTool._isVisibleViewport2 ? 1 : 0) : 1;

  extraWords += 3;
  extraWords += measureSegments.length * 9;

  var dividerTool = main._dividerTool;
  var dividerSegments = dividerTool ? dividerTool.getSegments() : [];
  var isDividerVisibleV1 = dividerTool ? (dividerTool._isVisible ? 1 : 0) : 1;
  var isDividerVisibleV2 = dividerTool ? (dividerTool._isVisibleViewport2 ? 1 : 0) : 1;
  var dividerDivisions = dividerTool ? dividerTool.getDivisions() : 3;

  extraWords += 4;
  extraWords += dividerSegments.length * 8;

  nbBytes += extraWords * 4;

  var buffer = new ArrayBuffer(nbBytes);
  var f32a = new Float32Array(buffer);
  var u32a = new Uint32Array(buffer);
  var off = 0;
  u32a[off++] = Export.VERSION;

  // misc stuffs
  u32a[off++] = main._showGrid;
  u32a[off++] = ShaderBase.showSymmetryLine;
  u32a[off++] = main._showContour;

  // camera stuffs
  var cam = main.getCamera();
  u32a[off++] = cam.getProjectionType();
  u32a[off++] = cam.getMode();
  f32a[off++] = cam.getFov();
  u32a[off++] = cam.getUsePivot();

  // save meshes
  u32a[off++] = nbMeshes;
  for (i = 0; i < nbMeshes; ++i) {
    mesh = meshes[i];

    // shader + matcap + wire + alpha + flat 
    u32a[off++] = mesh.getShaderType();
    u32a[off++] = mesh.getMatcap();
    u32a[off++] = mesh.getShowWireframe();
    u32a[off++] = mesh.getFlatShading();
    f32a[off++] = mesh.getOpacity();

    // visibility
    u32a[off++] = mesh.isVisible(0) ? 1 : 0;
    u32a[off++] = mesh.isVisible(1) ? 1 : 0;

    // center + matrix + scale
    f32a.set(mesh.getCenter(), off);
    off += 3;
    f32a.set(mesh.getMatrix(), off);
    off += 16;
    f32a[off++] = mesh.getScale();

    // vertices
    var nbVertices = mesh.getNbVertices();
    u32a[off++] = nbVertices;
    f32a.set(mesh.getVertices().subarray(0, nbVertices * 3), off);
    off += nbVertices * 3;

    // vertex visibility (v5)
    var u8a = new Uint8Array(buffer);
    var byteOff = off * 4;
    var vertVis = mesh._meshData._vertVisible;
    if (vertVis) {
      u8a.set(vertVis, byteOff);
    } else {
      for (var k = 0; k < nbVertices; ++k) {
        u8a[byteOff + k] = 1;
      }
    }
    off += Math.ceil(nbVertices / 4);

    // colors
    var nbColors = mesh.getColors() ? nbVertices : 0;
    u32a[off++] = nbColors;
    if (nbColors > 0)
      f32a.set(mesh.getColors().subarray(0, nbVertices * 3), off);
    off += nbColors * 3;

    // materials
    var nbMaterials = mesh.getMaterials() ? nbVertices : 0;
    u32a[off++] = nbMaterials;
    if (nbMaterials > 0)
      f32a.set(mesh.getMaterials().subarray(0, nbVertices * 3), off);
    off += nbMaterials * 3;

    // faces
    var nbFaces = mesh.getNbFaces();
    u32a[off++] = nbFaces;
    u32a.set(mesh.getFaces().subarray(0, nbFaces * 4), off);
    off += nbFaces * 4;

    var hasUV = mesh.hasUV();
    // uvs
    var nbTexCoords = mesh.getNbTexCoords();
    u32a[off++] = hasUV ? nbTexCoords : 0;
    if (hasUV) {
      f32a.set(mesh.getTexCoords().subarray(0, nbTexCoords * 2), off);
      off += nbTexCoords * 2;
    }

    // face uvs
    u32a[off++] = hasUV ? nbFaces : 0;
    if (hasUV) {
      u32a.set(mesh.getFacesTexCoord().subarray(0, nbFaces * 4), off);
      off += nbFaces * 4;
    }
  }

  var writeAnchor = function(anchor) {
    if (!anchor) {
      u32a[off++] = 1; // free type
      f32a[off++] = 0;
      f32a[off++] = 0;
      f32a[off++] = 0;
      return;
    }
    if (anchor.type === 'vertex') {
      u32a[off++] = 0; // vertex type
      var meshIdx = meshes.indexOf(anchor.mesh);
      u32a[off++] = meshIdx !== -1 ? meshIdx : 0;
      u32a[off++] = anchor.vertIdx;
      u32a[off++] = 0; // unused
    } else {
      u32a[off++] = 1; // free type
      f32a[off++] = anchor.worldPos[0];
      f32a[off++] = anchor.worldPos[1];
      f32a[off++] = anchor.worldPos[2];
    }
  };

  // Write Measure Tool header and segments
  u32a[off++] = isMeasureVisibleV1;
  u32a[off++] = isMeasureVisibleV2;
  u32a[off++] = measureSegments.length;
  for (var s = 0; s < measureSegments.length; ++s) {
    var seg = measureSegments[s];
    writeAnchor(seg.vertA);
    writeAnchor(seg.vertB);
    u32a[off++] = seg.isReference ? 1 : 0;
  }

  // Write Divider Tool header and segments
  u32a[off++] = isDividerVisibleV1;
  u32a[off++] = isDividerVisibleV2;
  u32a[off++] = dividerDivisions;
  u32a[off++] = dividerSegments.length;
  for (var s = 0; s < dividerSegments.length; ++s) {
    var seg = dividerSegments[s];
    writeAnchor(seg.vertA);
    writeAnchor(seg.vertB);
  }

  var data = new DataView(buffer, 0, off * 4);
  return new Blob([data]);
};

export default Export;
