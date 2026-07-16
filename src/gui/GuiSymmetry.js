import TR from './GuiTR.js';
import Mesh from '../mesh/Mesh.js';
import Enums from '../misc/Enums.js';
import ShaderBase from '../render/shaders/ShaderBase.js';
import MeshStatic from '../mesh/meshStatic/MeshStatic.js';
import MeshDynamic from '../mesh/dynamic/MeshDynamic.js';

class GuiSymmetry {
  constructor(guiParent, ctrlGui) {
    this._ctrlGui = ctrlGui;
    this._main = ctrlGui._main;
    this._sculptManager = this._main.getSculptManager();
    this._menu = null;

    this._ctrlSymmetry = null;
    this._ctrlSymmetryMode = null;
    this._ctrlSymmetryAxisLabel = null;
    this._ctrlSymmetryX = null;
    this._ctrlSymmetryY = null;
    this._ctrlSymmetryZ = null;
    this._ctrlSymmetryLine = null;
    this._ctrlOffSym = null;

    this._ctrlFlipTitle = null;
    this._ctrlFlipX = null;
    this._ctrlFlipY = null;
    this._ctrlFlipZ = null;

    this._ctrlMirrorTitle = null;
    this._ctrlMirrorX = null;
    this._ctrlMirrorY = null;
    this._ctrlMirrorZ = null;
    this._ctrlMirrorDir = null;
    this._ctrlMirrorAction = null;

    this._mirrorAxis = 'x';
    this._mirrorPositiveToNegative = true;

    this.init(guiParent);
  }

  addTripleButton(menu, name1, name2, name3, cb1, cb2, cb3) {
    var domLine = menu._addLine();
    
    var btn1 = document.createElement('button');
    btn1.className = 'gui-button gui-button-toggle';
    btn1.innerHTML = name1;
    btn1.style.width = '32%';
    btn1.style.marginRight = '2%';
    btn1.addEventListener('click', cb1);

    var btn2 = document.createElement('button');
    btn2.className = 'gui-button gui-button-toggle';
    btn2.innerHTML = name2;
    btn2.style.width = '32%';
    btn2.style.marginRight = '2%';
    btn2.addEventListener('click', cb2);

    var btn3 = document.createElement('button');
    btn3.className = 'gui-button gui-button-toggle';
    btn3.innerHTML = name3;
    btn3.style.width = '32%';
    btn3.addEventListener('click', cb3);

    domLine.appendChild(btn3);
    domLine.appendChild(btn2);
    domLine.appendChild(btn1);

    var widget1 = { domButton: btn1, setEnable: (b) => btn1.disabled = !b };
    var widget2 = { domButton: btn2, setEnable: (b) => btn2.disabled = !b };
    var widget3 = { domButton: btn3, setEnable: (b) => btn3.disabled = !b };

    widget1.setVisibility = widget2.setVisibility = widget3.setVisibility = (v) => {
      domLine.hidden = !v;
    };

    return [widget1, widget2, widget3];
  }

  init(guiParent) {
    var menu = this._menu = guiParent.addMenu(TR('sculptSymmetry'));
    menu.open();

    var baseAddButton = Object.getPrototypeOf(Object.getPrototypeOf(menu)).addButton;

    // Symmetry Active Button
    this._ctrlSymmetry = baseAddButton.call(menu, TR('sculptSymmetry'), this.onSymmetryChange.bind(this));
    this._ctrlSymmetry.domButton.classList.add('gui-button-toggle');
    this._ctrlSymmetry.setValue = () => {
      this.updateSymmetryStates();
    };

    // Symmetry Space (Local/World)
    this._ctrlSymmetryMode = menu.addDualButton(
      TR('sculptSymmetryLocal'),
      TR('sculptSymmetryWorld'),
      () => this.onSymmetryModeChange(0),
      () => this.onSymmetryModeChange(1)
    );
    this._ctrlSymmetryMode[0].domButton.classList.add('gui-button-toggle');
    this._ctrlSymmetryMode[1].domButton.classList.add('gui-button-toggle');
    this._ctrlSymmetryMode.setValue = () => {
      this.updateSymmetryStates();
    };

    // Symmetry Axes (X, Y, Z)
    this._ctrlSymmetryAxisLabel = menu.addTitle(TR('sculptSymmetryAxis'));
    var axisCtrls = this.addTripleButton(
      menu,
      'X',
      'Y',
      'Z',
      () => this.onSymmetryAxisToggle('x'),
      () => this.onSymmetryAxisToggle('y'),
      () => this.onSymmetryAxisToggle('z')
    );
    this._ctrlSymmetryX = axisCtrls[0];
    this._ctrlSymmetryY = axisCtrls[1];
    this._ctrlSymmetryZ = axisCtrls[2];

    this._ctrlSymmetryX.setValue = () => {
      this.updateSymmetryStates();
    };
    this._ctrlSymmetryY.setValue = () => {
      this.updateSymmetryStates();
    };
    this._ctrlSymmetryZ.setValue = () => {
      this.updateSymmetryStates();
    };

    // Flip Object (X, Y, Z)
    this._ctrlFlipTitle = menu.addTitle(TR('sculptSymmetryFlip'));
    var flipCtrls = this.addTripleButton(
      menu,
      'X',
      'Y',
      'Z',
      () => this.onFlipObject('x'),
      () => this.onFlipObject('y'),
      () => this.onFlipObject('z')
    );
    this._ctrlFlipX = flipCtrls[0];
    this._ctrlFlipY = flipCtrls[1];
    this._ctrlFlipZ = flipCtrls[2];

    // Mirror Object (X, Y, Z)
    this._ctrlMirrorTitle = menu.addTitle(TR('sculptSymmetryMirror'));
    var mirrorCtrls = this.addTripleButton(
      menu,
      'X',
      'Y',
      'Z',
      () => this.onSelectMirrorAxis('x'),
      () => this.onSelectMirrorAxis('y'),
      () => this.onSelectMirrorAxis('z')
    );
    this._ctrlMirrorX = mirrorCtrls[0];
    this._ctrlMirrorY = mirrorCtrls[1];
    this._ctrlMirrorZ = mirrorCtrls[2];

    this._ctrlMirrorDir = menu.addDualButton(
      TR('mirrorDirLeftToRight'),
      TR('mirrorDirRightToLeft'),
      () => this.onSelectMirrorDirection(false),
      () => this.onSelectMirrorDirection(true)
    );
    this._ctrlMirrorDir[0].domButton.classList.add('gui-button-toggle');
    this._ctrlMirrorDir[1].domButton.classList.add('gui-button-toggle');

    this._ctrlMirrorAction = baseAddButton.call(menu, TR('sculptSymmetryMirror'), this.onMirrorObject.bind(this));

    menu.addTitle(TR('renderingExtra'));
    // Show mirror line button
    this._ctrlSymmetryLine = baseAddButton.call(
      menu,
      TR('renderingSymmetryLine'),
      this.onShowSymmetryLine.bind(this)
    );
    this._ctrlSymmetryLine.domButton.classList.add('gui-button-toggle');
    this._ctrlSymmetryLine.setValue = () => {
      this.updateSymmetryStates();
    };

    // Symmetry offset slider
    var mesh = this._main.getMesh();
    this._ctrlOffSym = menu.addSlider(
      'SymOffset',
      mesh ? mesh.getSymmetryOffset() : 0.0,
      this.onOffsetSymmetry.bind(this),
      -1.0,
      1.0,
      0.001
    );

    // Set initial visibility & state
    var toolIndex = this._sculptManager.getToolIndex();
    this.updateSymmetryVisibility(toolIndex);
    this.updateSymmetryStates();
  }

  onSymmetryChange() {
    var val = !this._sculptManager.getSymmetry();
    this._sculptManager._symmetry = val;
    if (val) {
      var zsphereTool = this._sculptManager.getTool(Enums.Tools.ZSPHERE);
      if (zsphereTool && zsphereTool._graph) {
        zsphereTool._graph.updateSymmetryPartners();
      }
    }
    this._main.render();
    if (this._ctrlGui._toolbar) {
      this._ctrlGui._toolbar.setSymmetryActive(val);
    }
    this.updateSymmetryVisibility(this._sculptManager.getToolIndex());
    this.updateSymmetryStates();
  }

  onSymmetryModeChange(value) {
    var mode = value === 1 ? 'world' : 'local';
    Mesh.symmetryMode = mode;
    this._main.render();
    if (this._ctrlGui._toolbar) {
      this._ctrlGui._toolbar.updateSymmetrySettings();
    }
    this.updateSymmetryStates();
  }

  onSymmetryAxisToggle(axis) {
    var val = !Mesh.symmetryAxes[axis];
    Mesh.symmetryAxes[axis] = val;
    this._main.updateSymmetryPickers();
    if (this._ctrlGui._toolbar) {
      this._ctrlGui._toolbar.updateSymmetrySettings();
    }
    this._main.render();
    this.updateSymmetryStates();
  }

  onShowSymmetryLine() {
    var val = !ShaderBase.showSymmetryLine;
    ShaderBase.showSymmetryLine = val;
    this._main.render();
    this.updateSymmetryStates();
  }

  onOffsetSymmetry(val) {
    var mesh = this._main.getMesh();
    if (mesh) {
      mesh.setSymmetryOffset(val);
      this._main.render();
    }
  }

  onFlipObject(axis) {
    var meshes = this._main.getSelectedMeshes().slice();
    if (meshes.length === 0) return;

    var flipFn = () => {
      for (var i = 0; i < meshes.length; ++i) {
        meshes[i].flip(axis);
      }
      this._main.render();
      if (this._ctrlGui) {
        this._ctrlGui.updateMesh();
      }
    };

    flipFn();
    this._main.getStateManager().pushStateCustom(flipFn, flipFn);
  }

  onSelectMirrorAxis(axis) {
    this._mirrorAxis = axis;
    this.updateSymmetryStates();
  }

  onSelectMirrorDirection(positiveToNegative) {
    this._mirrorPositiveToNegative = positiveToNegative;
    this.updateSymmetryStates();
  }

  onMirrorObject() {
    var main = this._main;
    var mesh = main.getMesh();
    if (!mesh) return;

    var selMeshes = main.getSelectedMeshes().slice();
    if (selMeshes.length === 0) {
      selMeshes = [mesh];
    }

    var axis = this._mirrorAxis;
    var posToNeg = this._mirrorPositiveToNegative;

    var newMeshes = [];
    var oldMeshes = [];

    for (var i = 0; i < selMeshes.length; ++i) {
      var oldM = selMeshes[i];
      var wasDynamic = oldM.isDynamic;

      var staticM = this.convertToStaticMesh(oldM);
      staticM.mirror(axis, posToNeg);

      var finalM = wasDynamic ? new MeshDynamic(staticM) : staticM;
      newMeshes.push(finalM);
      oldMeshes.push(oldM);
    }

    for (var i = 0; i < oldMeshes.length; ++i) {
      main.replaceMesh(oldMeshes[i], newMeshes[i]);
    }

    main.getStateManager().pushStateAddRemove(newMeshes, oldMeshes);

    main.render();
    if (this._ctrlGui) {
      this._ctrlGui.updateMesh();
    }
  }

  convertToStaticMesh(mesh) {
    var isMulti = !!(mesh && mesh._meshes);
    if (!mesh.isDynamic && !isMulti) {
      var newMesh = new MeshStatic(mesh.getGL());
      newMesh.copyData(mesh);
      return newMesh;
    }

    var newMesh = new MeshStatic(mesh.getGL());
    newMesh.setID(mesh.getID());
    newMesh.setTransformData(mesh.getTransformData());
    newMesh.setVertices(mesh.getVertices().subarray(0, mesh.getNbVertices() * 3));
    if (mesh.getColors()) newMesh.setColors(mesh.getColors().subarray(0, mesh.getNbVertices() * 3));
    if (mesh.getMaterials()) newMesh.setMaterials(mesh.getMaterials().subarray(0, mesh.getNbVertices() * 3));
    newMesh.setFaces(mesh.getFaces().subarray(0, mesh.getNbFaces() * 4));

    Mesh.OPTIMIZE = false;
    newMesh.init();
    Mesh.OPTIMIZE = true;

    newMesh.setRenderData(mesh.getRenderData());
    newMesh.initRender();
    newMesh.setVisible(mesh.isVisible(0), 0);
    newMesh.setVisible(mesh.isVisible(1), 1);
    return newMesh;
  }

  updateSymmetryVisibility(toolIndex) {
    var showSym = toolIndex !== Enums.Tools.TRANSFORM && toolIndex !== Enums.Tools.MEASURE && toolIndex !== Enums.Tools.DIVIDER;

    this._ctrlSymmetry.setVisibility(showSym);
    
    if (this._ctrlSymmetryMode) {
      this._ctrlSymmetryMode[0].setVisibility(showSym);
    }
    
    this._ctrlSymmetryAxisLabel.setVisibility(showSym);
    
    if (this._ctrlSymmetryX) {
      this._ctrlSymmetryX.setVisibility(showSym);
    }
    
    if (this._ctrlSymmetryLine) {
      this._ctrlSymmetryLine.setVisibility(showSym);
    }
    if (this._ctrlOffSym) {
      this._ctrlOffSym.setVisibility(showSym);
    }
    if (this._ctrlFlipTitle) {
      this._ctrlFlipTitle.setVisibility(showSym);
    }
    if (this._ctrlFlipX) {
      this._ctrlFlipX.setVisibility(showSym);
    }

    if (this._ctrlMirrorTitle) {
      this._ctrlMirrorTitle.setVisibility(showSym);
    }
    if (this._ctrlMirrorX) {
      this._ctrlMirrorX.setVisibility(showSym);
    }
    if (this._ctrlMirrorDir) {
      this._ctrlMirrorDir[0].setVisibility(showSym);
    }
    if (this._ctrlMirrorAction) {
      this._ctrlMirrorAction.setVisibility(showSym);
    }
  }

  updateSymmetryStates() {
    // 1. Symmetry active
    var symActive = this._sculptManager.getSymmetry();
    if (this._ctrlSymmetry && this._ctrlSymmetry.domButton) {
      if (symActive) {
        this._ctrlSymmetry.domButton.classList.add('active');
      } else {
        this._ctrlSymmetry.domButton.classList.remove('active');
      }
    }

    // 2. Symmetry Mode (Local/World)
    var isWorld = Mesh.symmetryMode === 'world';
    if (this._ctrlSymmetryMode) {
      if (isWorld) {
        this._ctrlSymmetryMode[0].domButton.classList.remove('active');
        this._ctrlSymmetryMode[1].domButton.classList.add('active');
      } else {
        this._ctrlSymmetryMode[0].domButton.classList.add('active');
        this._ctrlSymmetryMode[1].domButton.classList.remove('active');
      }
    }

    // 3. Symmetry Axes (X, Y, Z)
    if (this._ctrlSymmetryX && this._ctrlSymmetryX.domButton) {
      if (Mesh.symmetryAxes.x) this._ctrlSymmetryX.domButton.classList.add('active');
      else this._ctrlSymmetryX.domButton.classList.remove('active');
    }
    if (this._ctrlSymmetryY && this._ctrlSymmetryY.domButton) {
      if (Mesh.symmetryAxes.y) this._ctrlSymmetryY.domButton.classList.add('active');
      else this._ctrlSymmetryY.domButton.classList.remove('active');
    }
    if (this._ctrlSymmetryZ && this._ctrlSymmetryZ.domButton) {
      if (Mesh.symmetryAxes.z) this._ctrlSymmetryZ.domButton.classList.add('active');
      else this._ctrlSymmetryZ.domButton.classList.remove('active');
    }

    // 4. Show mirror line
    if (this._ctrlSymmetryLine && this._ctrlSymmetryLine.domButton) {
      if (ShaderBase.showSymmetryLine) this._ctrlSymmetryLine.domButton.classList.add('active');
      else this._ctrlSymmetryLine.domButton.classList.remove('active');
    }

    // 5. Highlight Mirror Axis
    if (this._ctrlMirrorX && this._ctrlMirrorX.domButton) {
      if (this._mirrorAxis === 'x') this._ctrlMirrorX.domButton.classList.add('active');
      else this._ctrlMirrorX.domButton.classList.remove('active');
    }
    if (this._ctrlMirrorY && this._ctrlMirrorY.domButton) {
      if (this._mirrorAxis === 'y') this._ctrlMirrorY.domButton.classList.add('active');
      else this._ctrlMirrorY.domButton.classList.remove('active');
    }
    if (this._ctrlMirrorZ && this._ctrlMirrorZ.domButton) {
      if (this._mirrorAxis === 'z') this._ctrlMirrorZ.domButton.classList.add('active');
      else this._ctrlMirrorZ.domButton.classList.remove('active');
    }

    // 6. Highlight Mirror Direction
    if (this._ctrlMirrorDir) {
      if (this._mirrorPositiveToNegative) {
        this._ctrlMirrorDir[0].domButton.classList.remove('active');
        this._ctrlMirrorDir[1].domButton.classList.add('active');
      } else {
        this._ctrlMirrorDir[0].domButton.classList.add('active');
        this._ctrlMirrorDir[1].domButton.classList.remove('active');
      }
    }
  }

  updateMesh() {
    var mesh = this._main.getMesh();
    if (this._ctrlOffSym) {
      this._ctrlOffSym.setValue(mesh ? mesh.getSymmetryOffset() : 0.0);
    }
  }
}

export default GuiSymmetry;
