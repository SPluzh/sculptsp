import MeshResolution from './MeshResolution.js';
import Mesh from '../Mesh.js';
import Buffer from '../../render/Buffer.js';
import Subdivision from '../../editing/Subdivision.js';
import Reversion from '../../editing/Reversion.js';

class Multimesh extends Mesh {

  static get NONE() {
    return 0;
  }
  static get SCULPT() {
    return 1;
  }
  static get CAMERA() {
    return 2;
  }
  static get PICKING() {
    return 3;
  }

  constructor(mesh) {
    super();

    this.setID(mesh.getID());
    this.setRenderData(mesh.getRenderData());
    this.setTransformData(mesh.getTransformData());

    this._meshes = [new MeshResolution(mesh, true)];
    this.setSelection(0);

    var gl = mesh.getGL();
    this._indexBuffer = new Buffer(gl, gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW);
    this._wireframeBuffer = new Buffer(gl, gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW);
  }

  getCurrentMesh() {
    return this._meshes[this._sel];
  }

  setSelection(sel) {
    this._sel = sel;
    this.setMeshData(this.getCurrentMesh().getMeshData());
  }

  addLevel() {
    if ((this._meshes.length - 1) !== this._sel)
      return this.getCurrentMesh();

    var nbFaces = this.getCurrentMesh().getNbFaces();
    var strTimer = 'addLevel : ' + nbFaces + ' -> ' + nbFaces * 4;
    console.time(strTimer);

    var baseMesh = this.getCurrentMesh();
    var newMesh = new MeshResolution(baseMesh);
    baseMesh.setVerticesMapping(undefined);

    Subdivision.fullSubdivision(baseMesh, newMesh);
    newMesh.initTopology();

    this.pushMesh(newMesh);
    this.initRender();

    console.timeEnd(strTimer);

    return newMesh;
  }

  computeReverse() {
    if (this._sel !== 0)
      return this.getCurrentMesh();

    var baseMesh = this.getCurrentMesh();
    var newMesh = new MeshResolution(baseMesh);

    var status = Reversion.computeReverse(baseMesh, newMesh);
    if (!status)
      return;

    newMesh.initTopology();

    this.unshiftMesh(newMesh);
    this.initRender();
    return newMesh;
  }

  syncVisibility(fromSel, toSel) {
    if (fromSel === toSel) return;

    var meshes = this._meshes;
    var step = fromSel < toSel ? 1 : -1;
    for (var k = fromSel; k !== toSel; k += step) {
      var src = meshes[k];
      var dst = meshes[k + step];

      var srcVis = src._meshData._vertVisible;
      if (!srcVis) continue;

      var dstVis = dst._meshData._vertVisible;
      var nbVertsUp = dst.getNbVertices();
      if (!dstVis || dstVis.length !== nbVertsUp) {
        dstVis = dst._meshData._vertVisible = new Uint8Array(nbVertsUp);
      }
      for (var idx = 0; idx < nbVertsUp; ++idx) dstVis[idx] = 1;

      if (step === -1) {
        // Going down (from higher res to lower res)
        var nbVertsDown = dst.getNbVertices();
        if (dst.getEvenMapping() === false) {
          for (var i = 0; i < nbVertsDown; ++i) {
            dstVis[i] = srcVis[i];
          }
        } else {
          var vertMap = dst.getVerticesMapping();
          for (var i = 0; i < nbVertsDown; ++i) {
            dstVis[i] = srcVis[vertMap[i]];
          }
        }
      } else {
        // Going up (from lower res to higher res)
        var nbVertsDown = src.getNbVertices();
        var evenMapping = src.getEvenMapping();
        var vertMap = src.getVerticesMapping();

        var isParentHidden = new Uint8Array(nbVertsUp);
        var isParent = new Uint8Array(nbVertsUp);

        for (var i = 0; i < nbVertsDown; ++i) {
          var childIdx = evenMapping ? vertMap[i] : i;
          dstVis[childIdx] = srcVis[i];
          isParent[childIdx] = 1;
          if (srcVis[i] === 0) {
            isParentHidden[childIdx] = 1;
          }
        }

        var dstRing = dst.getVerticesRingVert();
        for (var j = 0; j < nbVertsUp; ++j) {
          if (isParent[j] === 0) {
            var neighbors = dstRing[j];
            for (var n = 0; n < neighbors.length; ++n) {
              var neighborIdx = neighbors[n];
              if (isParentHidden[neighborIdx] === 1) {
                dstVis[j] = 0;
                break;
              }
            }
          }
        }
      }
    }
  }

  lowerLevel() {
    if (this._sel === 0)
      return this._meshes[0];

    this.syncVisibility(this._sel, this._sel - 1);
    this._meshes[this._sel - 1].lowerAnalysis(this.getCurrentMesh());
    this.setSelection(this._sel - 1);
    this.updateResolution();

    return this.getCurrentMesh();
  }

  higherLevel() {
    if (this._sel === this._meshes.length - 1)
      return this.getCurrentMesh();

    this.syncVisibility(this._sel, this._sel + 1);
    this._meshes[this._sel + 1].higherSynthesis(this.getCurrentMesh());
    this.setSelection(this._sel + 1);
    this.updateResolution();

    return this.getCurrentMesh();
  }

  updateResolution() {
    this.updateGeometry();
    this.updateDuplicateColorsAndMaterials();
    this.updateBuffers();

    var mesh = this._meshes[this.getLowIndexRender()];
    this._indexBuffer.update(mesh.getTriangles());
    this._wireframeBuffer.update(mesh.getWireframe());
  }

  selectResolution(sel) {
    while (this._sel > sel) {
      this.lowerLevel();
    }
    while (this._sel < sel) {
      this.higherLevel();
    }
  }

  findIndexFromMesh(mesh) {
    var meshes = this._meshes;
    for (var i = 0, l = meshes.length; i < l; ++i) {
      if (mesh === meshes[i])
        return i;
    }
  }

  selectMesh(mesh) {
    var val = this.findIndexFromMesh(mesh);
    this.selectResolution(val);
  }

  pushMesh(mesh) {
    this._meshes.push(mesh);
    this.setSelection(this._meshes.length - 1);
    this.updateResolution();
  }

  unshiftMesh(mesh) {
    this._meshes.unshift(mesh);
    this.setSelection(1);
    this.lowerLevel();
  }

  popMesh() {
    this._meshes.pop();
    this.setSelection(this._meshes.length - 1);
    this.updateResolution();
  }

  shiftMesh() {
    this._meshes.shift();
    this.setSelection(0);
    this.updateResolution();
  }

  deleteLower() {
    this._meshes.splice(0, this._sel);
    this.setSelection(0);
  }

  deleteHigher() {
    this._meshes.splice(this._sel + 1);
  }

  getLowIndexRender() {
    var limit = 500000;
    var sel = this._sel;
    while (sel >= 0) {
      var mesh = this._meshes[sel];
      // we disable low rendering for lower resolution mesh with
      // an index indirection for even vertices
      if (mesh.getEvenMapping() === true)
        return sel === this._sel ? sel : sel + 1;
      if (mesh.getNbTriangles() < limit)
        return sel;
      --sel;
    }
    return 0;
  }

  _renderLow(main) {
    var render = this.getRenderData();
    var tmpSel = this._sel;
    var tmpIndex = this.getIndexBuffer();
    this.setSelection(this.getLowIndexRender());
    render._indexBuffer = this._indexBuffer;

    super.render(main);

    render._indexBuffer = tmpIndex;
    this.setSelection(tmpSel);
  }

  _renderWireframeLow(main) {
    var render = this.getRenderData();
    var tmpSel = this._sel;
    var tmpWire = this.getWireframeBuffer();
    this.setSelection(this.getLowIndexRender());
    render._wireframeBuffer = this._wireframeBuffer;

    super.renderWireframe(main);

    render._wireframeBuffer = tmpWire;
    this.setSelection(tmpSel);
  }

  _canUseLowRender(main) {
    if (this.isUsingTexCoords() || this.isUsingDrawArrays()) return false;
    if (Multimesh.RENDER_HINT === Multimesh.PICKING || Multimesh.RENDER_HINT === Multimesh.NONE) return false;
    if (main.getMesh() === this && Multimesh.RENDER_HINT !== Multimesh.CAMERA) return false;
    if (this.getLowIndexRender() === this._sel) return false;
    return true;
  }

  render(main) {
    return this._canUseLowRender(main) ? this._renderLow(main) : super.render(main);
  }

  renderWireframe(main) {
    return this._canUseLowRender(main) ? this._renderWireframeLow(main) : super.renderWireframe(main);
  }
}

Multimesh.RENDER_HINT = 0;

export default Multimesh;
