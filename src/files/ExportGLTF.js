import Utils from '../misc/Utils.js';

var Export = {};

function padBytes(bytes) {
  var rem = bytes.length % 4;
  if (rem === 0) return bytes;
  var pad = 4 - rem;
  var res = new Uint8Array(bytes.length + pad);
  res.set(bytes);
  return res;
}

function getMinMax(arr, itemSize) {
  var min = new Array(itemSize).fill(Infinity);
  var max = new Array(itemSize).fill(-Infinity);
  for (var j = 0; j < arr.length; j += itemSize) {
    for (var k = 0; k < itemSize; ++k) {
      var v = arr[j + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min: min, max: max };
}

Export.exportGLB = function (meshes) {
  var binData = [];
  var byteOffset = 0;

  var json = {
    asset: { version: "2.0", generator: "SculptSP GLB Exporter" },
    scenes: [{ nodes: [] }],
    scene: 0,
    nodes: [],
    meshes: [],
    accessors: [],
    bufferViews: [],
    buffers: []
  };

  function addBufferView(data, target) {
    var clone = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    var padded = padBytes(clone);
    var bv = {
      buffer: 0,
      byteOffset: byteOffset,
      byteLength: clone.length
    };
    if (target) bv.target = target;
    json.bufferViews.push(bv);
    binData.push(padded);
    byteOffset += padded.length;
    return json.bufferViews.length - 1;
  }

  for (var i = 0; i < meshes.length; ++i) {
    var mesh = meshes[i];
    var id = mesh.getID();
    var vAr = mesh.getVertices();
    var nAr = mesh.getNormals();
    var cAr = mesh.getColors();
    var iAr = mesh.getTriangles();
    var nbVerts = mesh.getNbVertices();
    var nbTris = mesh.getNbTriangles();

    if (!vAr || !iAr || nbVerts === 0 || nbTris === 0) continue;

    json.scenes[0].nodes.push(json.nodes.length);
    var nodeObj = { mesh: json.meshes.length };
    if (mesh.getMatrix) {
      nodeObj.matrix = Array.from(mesh.getMatrix());
    }
    json.nodes.push(nodeObj);

    var posMinMax = getMinMax(vAr, 3);
    var posBv = addBufferView(vAr, 34962);
    var posAccessor = json.accessors.length;
    json.accessors.push({
      bufferView: posBv,
      componentType: 5126,
      count: nbVerts,
      type: "VEC3",
      min: posMinMax.min,
      max: posMinMax.max
    });

    var normMinMax = getMinMax(nAr, 3);
    var normBv = addBufferView(nAr, 34962);
    var normAccessor = json.accessors.length;
    json.accessors.push({
      bufferView: normBv,
      componentType: 5126,
      count: nbVerts,
      type: "VEC3",
      min: normMinMax.min,
      max: normMinMax.max
    });

    var colMinMax = getMinMax(cAr, 3);
    var colBv = addBufferView(cAr, 34962);
    var colAccessor = json.accessors.length;
    json.accessors.push({
      bufferView: colBv,
      componentType: 5126,
      count: nbVerts,
      type: "VEC3",
      min: colMinMax.min,
      max: colMinMax.max
    });

    var uvAccessor = -1;
    if (mesh.hasUV()) {
      var uvAr = mesh.getTexCoords();
      if (uvAr) {
        var uvMinMax = getMinMax(uvAr, 2);
        var uvBv = addBufferView(uvAr, 34962);
        uvAccessor = json.accessors.length;
        json.accessors.push({
          bufferView: uvBv,
          componentType: 5126,
          count: uvAr.length / 2,
          type: "VEC2",
          min: uvMinMax.min,
          max: uvMinMax.max
        });
      }
    }

    var idxType = nbVerts >= 65536 ? 5125 : 5123;
    var idxArr = nbVerts >= 65536 ? iAr : new Uint16Array(iAr);
    var idxBv = addBufferView(idxArr, 34963);
    var idxAccessor = json.accessors.length;
    json.accessors.push({
      bufferView: idxBv,
      componentType: idxType,
      count: nbTris * 3,
      type: "SCALAR"
    });

    var attributes = {
      POSITION: posAccessor,
      NORMAL: normAccessor,
      COLOR_0: colAccessor
    };
    if (uvAccessor !== -1) {
      attributes.TEXCOORD_0 = uvAccessor;
    }

    var prim = {
      attributes: attributes,
      indices: idxAccessor
    };

    var meshObj = {
      name: "Mesh_" + id,
      primitives: [prim]
    };

    json.meshes.push(meshObj);
  }

  json.buffers.push({
    byteLength: byteOffset
  });

  var jsonStr = JSON.stringify(json);
  var jsonPad = (4 - (jsonStr.length % 4)) % 4;
  for (var p = 0; p < jsonPad; ++p) jsonStr += ' ';

  var totalBinLength = 0;
  for (var b = 0; b < binData.length; ++b) {
    totalBinLength += binData[b].length;
  }

  var glbLength = 12 + 8 + jsonStr.length + 8 + totalBinLength;

  var glb = new Uint8Array(glbLength);
  var dv = new DataView(glb.buffer);

  dv.setUint32(0, 0x46546C67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, glbLength, true);

  dv.setUint32(12, jsonStr.length, true);
  dv.setUint32(16, 0x4E4F534A, true);

  var offset = 20;
  for (var c = 0; c < jsonStr.length; ++c) {
    glb[offset++] = jsonStr.charCodeAt(c);
  }

  dv.setUint32(offset, totalBinLength, true);
  dv.setUint32(offset + 4, 0x004E4942, true);
  offset += 8;

  for (var b = 0; b < binData.length; ++b) {
    glb.set(binData[b], offset);
    offset += binData[b].length;
  }

  return new Blob([glb], { type: 'model/gltf-binary' });
};

export default Export;
