import Mesh from '../Mesh.js';
import TransformData from '../TransformData.js';
import MeshData from '../MeshData.js';
import RenderData from '../RenderData.js';

class MeshStatic extends Mesh {

  constructor(gl) {
    super();

    this._id = Mesh.ID++; // useful id to retrieve a mesh (dynamic mesh, multires mesh, voxel mesh)

    if (gl) this._renderData = new RenderData(gl, this);
    this._meshData = new MeshData();
    this._transformData = new TransformData();
  }
}

export default MeshStatic;
