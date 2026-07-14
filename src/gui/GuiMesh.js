import TR from './GuiTR.js';

class GuiMesh {

  constructor(guiParent, ctrlGui) {
    this._main = ctrlGui._main; // main application

    this.domVerts = null; // ctrl nb vertices
    this.domFaces = null; // ctrl nb faces
    this.domUl = null;
    this.init(guiParent);
  }

  init(guiParent) {
    this.domVerts = document.createElement('div');
    this.domVerts.innerHTML = TR('meshNbVertices');

    this.domFaces = document.createElement('div');
    this.domFaces.innerHTML = TR('meshNbFaces');

    this.domUl = document.createElement('div');
    this.domUl.className = 'viewport-hud-mesh';
    this.domUl.appendChild(this.domVerts);
    this.domUl.appendChild(this.domFaces);
    guiParent.appendChild(this.domUl);
  }

  updateMeshInfo() {
    var mesh = this._main.getMesh();
    var activePoints = mesh ? mesh.getNbVertices() : 0;

    var meshes = this._main.getMeshes();
    var totalPoints = 0;
    for (var i = 0; i < meshes.length; ++i) {
      totalPoints += meshes[i].getNbVertices();
    }

    this.domVerts.innerHTML = TR('meshNbVertices') + activePoints;
    this.domFaces.innerHTML = TR('meshNbFaces') + totalPoints;
  }
}

export default GuiMesh;
