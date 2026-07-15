import { mat4 } from 'gl-matrix';
import Utils from '../misc/Utils.js';
import MeshStatic from '../mesh/meshStatic/MeshStatic.js';

var Import = {};

function decodeDataURI(uri) {
  var idx = uri.indexOf(';base64,');
  if (idx === -1) return null;
  var base64 = uri.substring(idx + 8);
  var raw = window.atob(base64);
  var rawLength = raw.length;
  var array = new Uint8Array(new ArrayBuffer(rawLength));
  for (var i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

function getAccessorArray(json, accessorIndex, binaryBuffers) {
  var accessor = json.accessors[accessorIndex];
  if (!accessor) return null;

  var bv = json.bufferViews[accessor.bufferView];
  if (!bv) return null;

  var bufferIndex = bv.buffer;
  var bufferData = binaryBuffers[bufferIndex];
  if (!bufferData) return null;

  var byteOffset = (bv.byteOffset || 0) + (accessor.byteOffset || 0);
  var componentType = accessor.componentType;
  var count = accessor.count;
  var byteStride = bv.byteStride;

  var elementSize = 1;
  if (accessor.type === "VEC2") elementSize = 2;
  else if (accessor.type === "VEC3") elementSize = 3;
  else if (accessor.type === "VEC4") elementSize = 4;

  var typedArrayConstructor;
  var componentByteSize;
  switch (componentType) {
    case 5120: typedArrayConstructor = Int8Array; componentByteSize = 1; break;
    case 5121: typedArrayConstructor = Uint8Array; componentByteSize = 1; break;
    case 5122: typedArrayConstructor = Int16Array; componentByteSize = 2; break;
    case 5123: typedArrayConstructor = Uint16Array; componentByteSize = 2; break;
    case 5125: typedArrayConstructor = Uint32Array; componentByteSize = 4; break;
    case 5126: typedArrayConstructor = Float32Array; componentByteSize = 4; break;
    default: return null;
  }

  var arrayBuffer = bufferData.buffer;
  var byteStart = bufferData.byteOffset + byteOffset;
  var out = new typedArrayConstructor(count * elementSize);

  if (!byteStride || byteStride === elementSize * componentByteSize) {
    // Continuous array (Fast path)
    var view = new typedArrayConstructor(arrayBuffer, byteStart, count * elementSize);
    out.set(view);
  } else {
    // Interleaved / Strided data
    var view = new DataView(arrayBuffer, byteStart);
    var getter;
    switch (componentType) {
      case 5120: getter = (off) => view.getInt8(off); break;
      case 5121: getter = (off) => view.getUint8(off); break;
      case 5122: getter = (off) => view.getInt16(off, true); break;
      case 5123: getter = (off) => view.getUint16(off, true); break;
      case 5125: getter = (off) => view.getUint32(off, true); break;
      case 5126: getter = (off) => view.getFloat32(off, true); break;
    }

    var idx = 0;
    for (var i = 0; i < count; ++i) {
      var elemByteOffset = i * byteStride;
      for (var j = 0; j < elementSize; ++j) {
        out[idx++] = getter(elemByteOffset + j * componentByteSize);
      }
    }
  }
  return out;
}

Import.importGLTF = function (data, gl) {
  var json = JSON.parse(data);
  var buffers = [];

  if (json.buffers) {
    for (var i = 0; i < json.buffers.length; ++i) {
      var buf = json.buffers[i];
      if (buf.uri && buf.uri.startsWith('data:')) {
        buffers.push(decodeDataURI(buf.uri));
      } else {
        buffers.push(null);
      }
    }
  }

  return Import.parseGLTF(json, buffers, gl);
};

Import.importGLB = function (buffer, gl) {
  var dv = new DataView(buffer);
  var magic = dv.getUint32(0, true);
  if (magic !== 0x46546C67) { // 'glTF'
    console.error('Invalid GLB magic');
    return [];
  }
  var version = dv.getUint32(4, true);
  if (version !== 2) {
    console.error('Only GLTF 2.0 is supported');
    return [];
  }
  var totalLength = dv.getUint32(8, true);

  var json = null;
  var binBuffer = null;

  var offset = 12;
  while (offset < totalLength) {
    var chunkLength = dv.getUint32(offset, true);
    var chunkType = dv.getUint32(offset + 4, true);
    offset += 8;

    if (chunkType === 0x4E4F534A) { // 'JSON'
      var jsonBytes = new Uint8Array(buffer, offset, chunkLength);
      var jsonStr = "";
      if (window.TextDecoder) {
        jsonStr = new TextDecoder("utf-8").decode(jsonBytes);
      } else {
        for (var i = 0; i < chunkLength; i++) {
          jsonStr += String.fromCharCode(jsonBytes[i]);
        }
      }
      json = JSON.parse(jsonStr);
    } else if (chunkType === 0x004E4942) { // 'BIN'
      binBuffer = new Uint8Array(buffer, offset, chunkLength);
    }
    offset += chunkLength;
  }

  if (!json) return [];
  var buffers = [];
  if (binBuffer) buffers.push(binBuffer);

  return Import.parseGLTF(json, buffers, gl);
};

Import.parseGLTF = function (json, buffers, gl) {
  var meshes = [];
  if (!json.scenes || json.scenes.length === 0) return [];

  var sceneIdx = json.scene !== undefined ? json.scene : 0;
  var scene = json.scenes[sceneIdx];
  if (!scene) return [];

  var nodeIndices = scene.nodes || [];

  function traverseNode(nodeIdx, parentMatrix) {
    var node = json.nodes[nodeIdx];
    if (!node) return;

    var localMatrix = mat4.create();
    if (node.matrix) {
      mat4.copy(localMatrix, node.matrix);
    } else {
      var t = node.translation || [0, 0, 0];
      var r = node.rotation || [0, 0, 0, 1];
      var s = node.scale || [1, 1, 1];
      mat4.fromRotationTranslationScale(localMatrix, r, t, s);
    }

    var worldMatrix = mat4.create();
    mat4.multiply(worldMatrix, parentMatrix, localMatrix);

    if (node.mesh !== undefined) {
      var gltfMesh = json.meshes[node.mesh];
      if (gltfMesh) {
        for (var p = 0; p < gltfMesh.primitives.length; ++p) {
          var meshObj = Import.parsePrimitive(json, gltfMesh.primitives[p], buffers, gl);
          if (meshObj) {
            mat4.copy(meshObj.getMatrix(), worldMatrix);
            meshes.push(meshObj);
          }
        }
      }
    }

    if (node.children) {
      for (var i = 0; i < node.children.length; ++i) {
        traverseNode(node.children[i], worldMatrix);
      }
    }
  }

  var identity = mat4.create();
  for (var i = 0; i < nodeIndices.length; ++i) {
    traverseNode(nodeIndices[i], identity);
  }

  return meshes;
};

Import.parsePrimitive = function (json, primitive, buffers, gl) {
  var attrs = primitive.attributes;
  if (!attrs || attrs.POSITION === undefined) return null;

  var mesh = new MeshStatic(gl);

  // 1. POSITION
  var vAr = getAccessorArray(json, attrs.POSITION, buffers);
  if (!vAr) return null;
  mesh.setVertices(vAr);

  // 2. NORMAL
  if (attrs.NORMAL !== undefined) {
    var nAr = getAccessorArray(json, attrs.NORMAL, buffers);
    if (nAr) mesh.setNormals(nAr);
  }

  // 3. COLOR_0
  if (attrs.COLOR_0 !== undefined) {
    var cAr = getAccessorArray(json, attrs.COLOR_0, buffers);
    if (cAr) {
      var accessor = json.accessors[attrs.COLOR_0];
      if (accessor.type === "VEC4") {
        var rgbAr = new Float32Array((cAr.length / 4) * 3);
        for (var i = 0, j = 0; i < cAr.length; i += 4, j += 3) {
          rgbAr[j] = cAr[i];
          rgbAr[j + 1] = cAr[i + 1];
          rgbAr[j + 2] = cAr[i + 2];
        }
        mesh.setColors(rgbAr);
      } else {
        mesh.setColors(cAr);
      }
    }
  }

  // 4. TEXCOORD_0 (UV)
  var uvAr = null;
  if (attrs.TEXCOORD_0 !== undefined) {
    uvAr = getAccessorArray(json, attrs.TEXCOORD_0, buffers);
  }

  // 5. INDICES
  var iAr = null;
  if (primitive.indices !== undefined) {
    iAr = getAccessorArray(json, primitive.indices, buffers);
  } else {
    var numVertices = vAr.length / 3;
    iAr = new Uint32Array(numVertices);
    for (var i = 0; i < numVertices; ++i) {
      iAr[i] = i;
    }
  }

  // Convert GLTF triangles to SculptSP faces (quads)
  var numTris = Math.floor(iAr.length / 3);
  var fAr = new Uint32Array(numTris * 4);
  for (var t = 0; t < numTris; ++t) {
    var idt = t * 4;
    var idi = t * 3;
    fAr[idt] = iAr[idi];
    fAr[idt + 1] = iAr[idi + 1];
    fAr[idt + 2] = iAr[idi + 2];
    fAr[idt + 3] = Utils.TRI_INDEX;
  }
  mesh.setFaces(fAr);

  if (uvAr) {
    mesh.initTexCoordsDataFromOBJData(uvAr, fAr);
  }

  return mesh;
};

export default Import;
