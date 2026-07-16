import TR from './GuiTR.js';

class GuiMesh {

  constructor(guiParent, ctrlGui) {
    this._main = ctrlGui._main; // main application

    this.domVerts = null; // ctrl nb vertices
    this.domFaces = null; // ctrl nb faces
    this.domFPS = null; // ctrl FPS
    this.domUl = null;
    this.init(guiParent);
  }

  init(guiParent) {
    this.domVerts = document.createElement('div');
    this.domVerts.innerHTML = TR('meshNbVertices');

    this.domFaces = document.createElement('div');
    this.domFaces.innerHTML = TR('meshNbFaces');

    this.domFPS = document.createElement('div');
    this.domFPS.innerHTML = TR('meshFPS') + '--';

    this.domUl = document.createElement('div');
    this.domUl.className = 'viewport-hud-mesh';
    this.domUl.appendChild(this.domVerts);
    this.domUl.appendChild(this.domFaces);
    this.domUl.appendChild(this.domFPS);
    guiParent.appendChild(this.domUl);
  }

  _formatCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  updateMeshInfo() {
    var mesh = this._main.getMesh();
    var activePoints = mesh ? mesh.getNbVertices() : 0;

    var meshes = this._main.getMeshes();
    var totalPoints = 0;
    for (var i = 0; i < meshes.length; ++i) {
      totalPoints += meshes[i].getNbVertices();
    }

    this.domVerts.innerHTML = TR('meshNbVertices') + this._formatCount(activePoints);
    this.domFaces.innerHTML = TR('meshNbFaces') + this._formatCount(totalPoints);
  }

  updateFPS(fps) {
    this.domFPS.innerHTML = TR('meshFPS') + fps;
  }
}

export default GuiMesh;
