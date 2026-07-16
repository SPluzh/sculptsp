import Utils from '../misc/Utils.js';
import MeshStatic from '../mesh/meshStatic/MeshStatic.js';
import ExportSGL from './ExportSGL.js';
import ShaderBase from '../render/shaders/ShaderBase.js';

var Import = {};

var handleNegativeIndexFace = function (i32) {
  var u32 = new Uint32Array(i32);
  var nbFaces = u32.length / 4;
  for (var i = 0; i < nbFaces; ++i) {
    var idd = i * 4 + 3;
    if (i32[idd] < 0)
      u32[idd] = Utils.TRI_INDEX;
  }

  return u32;
};

// see ExportSGL for file description
//
/** Import SGL file */
Import.importSGL = function (buffer, gl, main) {
  var f32a = new Float32Array(buffer);
  var u32a = new Uint32Array(buffer);
  var i32a = new Int32Array(buffer);

  var off = 0;
  var version = u32a[off++];
  if (version > ExportSGL.VERSION)
    return [];

  // camera stuffs
  if (version >= 2) {
    main._showGrid = u32a[off++];
    ShaderBase.showSymmetryLine = u32a[off++];
    main._showContour = u32a[off++];

    var cam = main.getCamera();
    cam.setProjectionType(u32a[off++]);
    cam.setMode(u32a[off++]);
    cam.setFov(f32a[off++]);
    cam.setUsePivot(u32a[off++]);
  }

  var nbMeshes = u32a[off++];
  var meshes = new Array(nbMeshes);
  for (var i = 0; i < nbMeshes; ++i) {
    var mesh = meshes[i] = new MeshStatic(gl);

    // shader + matcap + wire + alpha + flat 
    if (version >= 2) {
      var render = mesh.getRenderData();
      // we don't have the geometry buffer and data yet so
      // we don't want to call updateBuffers (so no call to )
      render._shaderType = u32a[off++];
      render._matcap = u32a[off++];
      render._showWireframe = u32a[off++];
      render._flatShading = u32a[off++];
      render._alpha = f32a[off++];
    }

    if (version >= 4) {
      var isVisibleV1 = u32a[off++] !== 0;
      var isVisibleV2 = u32a[off++] !== 0;
      mesh.setVisible(isVisibleV1, 0);
      mesh.setVisible(isVisibleV2, 1);
    }

    // center matrix and scale
    mesh.getCenter().set(f32a.subarray(off, off + 3));
    off += 3;
    mesh.getMatrix().set(f32a.subarray(off, off + 16));
    off += 16;
    off++; // scale

    // vertices
    var nbElts = u32a[off++];
    mesh.setVertices(f32a.subarray(off, off + nbElts * 3));
    off += nbElts * 3;

    var nbVertices = nbElts;
    if (version >= 5) {
      var u8a = new Uint8Array(buffer);
      var byteOff = off * 4;
      var vertVis = new Uint8Array(nbVertices);
      vertVis.set(u8a.subarray(byteOff, byteOff + nbVertices));
      mesh._meshData._vertVisible = vertVis;
      off += Math.ceil(nbVertices / 4);
    } else {
      var vertVis = new Uint8Array(nbVertices);
      for (var k = 0; k < nbVertices; ++k) {
        vertVis[k] = 1;
      }
      mesh._meshData._vertVisible = vertVis;
    }

    // colors
    nbElts = u32a[off++];
    if (nbElts > 0)
      mesh.setColors(f32a.subarray(off, off + nbElts * 3));
    off += nbElts * 3;

    // materials
    nbElts = u32a[off++];
    if (nbElts > 0)
      mesh.setMaterials(f32a.subarray(off, off + nbElts * 3));
    off += nbElts * 3;

    // faces
    nbElts = u32a[off++];
    if (version <= 2) {
      mesh.setFaces(handleNegativeIndexFace(i32a.subarray(off, off + nbElts * 4)));
    } else {
      mesh.setFaces(u32a.subarray(off, off + nbElts * 4));
    }
    off += nbElts * 4;

    // uvs
    nbElts = u32a[off++];
    var uv = null;
    if (nbElts)
      uv = f32a.subarray(off, off + nbElts * 2);
    off += nbElts * 2;

    // face uvs
    nbElts = u32a[off++];
    var fuv = null;
    if (nbElts) {
      if (version <= 2) {
        fuv = handleNegativeIndexFace(i32a.subarray(off, off + nbElts * 4));
      } else {
        fuv = u32a.subarray(off, off + nbElts * 4);
      }
    }
    off += nbElts * 4;

    if (uv && fuv)
      mesh.initTexCoordsDataFromOBJData(uv, fuv);
  }

  return meshes;
};

export default Import;
