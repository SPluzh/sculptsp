import TR from './GuiTR.js';
import Remesh from '../editing/Remesh.js';
import Mesh from '../mesh/Mesh.js';
import MeshStatic from '../mesh/meshStatic/MeshStatic.js';
import Multimesh from '../mesh/multiresolution/Multimesh.js';
import MeshDynamic from '../mesh/dynamic/MeshDynamic.js';
import StateMultiresolution from '../states/StateMultiresolution.js';
import getOptionsURL from '../misc/getOptionsURL.js';
import Enums from '../misc/Enums.js';
import Indicator from './Indicator.js';

class GuiMultiresolution {

  constructor(guiParent, ctrlGui) {
    this._ctrlGui = ctrlGui;
    this._main = ctrlGui._main; // main application
    this._menu = null; // ui menu
    this._ctrlResolution = null; // multiresolution controller
    this._ctrlDynamic = null; // dynamic topology controller

    this._modalRemeshResolution = false;
    this._remeshRefX = 0;
    this._remeshRefY = 0;
    this._lastPageX = 0;
    this._lastPageY = 0;

    this._initRemeshInd();
    this._initRemeshProgressIndicator();
    this.init(guiParent);
  }

  init(guiParent) {
    var menu = this._menu = guiParent.addMenu(TR('topologyTitle'));

    // multires
    menu.addTitle(TR('multiresTitle'));
    this._ctrlResolution = menu.addSlider(TR('multiresResolution'), 1, this.onResolutionChanged.bind(this), 1, 1, 1);
    var dual = menu.addDualButton(TR('multiresReverse'), TR('multiresSubdivide'), this, this, 'reverse', 'subdivide');
    this._ctrlReverse = dual[0];
    this._ctrlSubdivide = dual[1];
    dual = this._dualButtonDel = menu.addDualButton(TR('multiresDelLower'), TR('multiresDelHigher'), this, this, 'deleteLower', 'deleteHigher');
    this._ctrlDelLower = dual[0];
    this._ctrlDelHigher = dual[1];
    this._ctrlDelLower.domButton.style.background = this._ctrlDelHigher.domButton.style.background = 'rgba(230,53,59,0.35)';

    var cbResolution = this.remeshResolution.bind(this);

    // surface nets remeshing
    menu.addTitle(TR('remeshTitle'));
    this._ctrlRes1 = menu.addSlider(TR('remeshResolution'), Remesh.RESOLUTION, cbResolution, 8, 2000, 1);
    this._voxelSizeLabel1 = document.createElement('li');
    this._voxelSizeLabel1.style.cssText = 'font-size: 11px; color: #aaa; text-align: right; padding: 2px 10px 4px 0; font-style: italic; list-style: none;';
    this._ctrlRes1.domContainer.parentNode.insertBefore(this._voxelSizeLabel1, this._ctrlRes1.domContainer.nextSibling);
    menu.addCheckbox(TR('remeshBlock'), Remesh, 'BLOCK');
    menu.addButton(TR('remeshRemesh'), this, 'remesh');

    // marching cube remeshing
    menu.addTitle(TR('remeshTitleMC'));
    this._ctrlRes2 = menu.addSlider(TR('remeshResolution'), Remesh.RESOLUTION, cbResolution, 8, 2000, 1);
    this._voxelSizeLabel2 = document.createElement('li');
    this._voxelSizeLabel2.style.cssText = 'font-size: 11px; color: #aaa; text-align: right; padding: 2px 10px 4px 0; font-style: italic; list-style: none;';
    this._ctrlRes2.domContainer.parentNode.insertBefore(this._voxelSizeLabel2, this._ctrlRes2.domContainer.nextSibling);
    menu.addCheckbox(TR('remeshSmoothingMC'), Remesh, 'SMOOTHING');
    menu.addButton(TR('remeshRemeshMC'), this, 'remeshMC');

    // dynamic
    menu.addTitle(TR('dynamicTitle'));
    this._ctrlDynamic = menu.addCheckbox(TR('dynamicActivated'), false, this.dynamicToggleActivate.bind(this));
    this._ctrlDynSubd = menu.addSlider(TR('dynamicSubdivision'), MeshDynamic, 'SUBDIVISION_FACTOR', 0, 100, 1);
    this._ctrlDynDec = menu.addSlider(TR('dynamicDecimation'), MeshDynamic, 'DECIMATION_FACTOR', 0, 100, 1);
    this._ctrlDynLin = menu.addCheckbox(TR('dynamicLinear'), MeshDynamic, 'LINEAR');
    this.updateDynamicVisibility(false);

    this._showVoxelPreview = false;
    var self = this;
    var onShow = function () {
      self._showVoxelPreview = true;
      self._updateVoxelSizeLabel();
    };
    var onHide = function () {
      setTimeout(function () {
        if (!self._ctrlRes1.isDown && !self._ctrlRes2.isDown &&
            document.activeElement !== self._ctrlRes1.domInputText &&
            document.activeElement !== self._ctrlRes2.domInputText &&
            !self._modalRemeshResolution) {
          self._showVoxelPreview = false;
          self._updateVoxelSizeLabel();
        }
      }, 100);
    };

    var domRes1 = this._ctrlRes1.domContainer;
    domRes1.addEventListener('mouseenter', onShow);
    domRes1.addEventListener('mouseleave', onHide);
    this._ctrlRes1.domInputText.addEventListener('focus', onShow);
    this._ctrlRes1.domInputText.addEventListener('blur', onHide);
    this._ctrlRes1.domSlider.addEventListener('pointerdown', onShow);
    this._ctrlRes1.domSlider.addEventListener('pointerup', onHide);

    var domRes2 = this._ctrlRes2.domContainer;
    domRes2.addEventListener('mouseenter', onShow);
    domRes2.addEventListener('mouseleave', onHide);
    this._ctrlRes2.domInputText.addEventListener('focus', onShow);
    this._ctrlRes2.domInputText.addEventListener('blur', onHide);
    this._ctrlRes2.domSlider.addEventListener('pointerdown', onShow);
    this._ctrlRes2.domSlider.addEventListener('pointerup', onHide);
  }

  onKeyUp(event) {
    if (event.handled === true)
      return;

    var shk = getOptionsURL.getShortKey(event.which);
    event.stopPropagation();

    if (shk === Enums.KeyAction.REMESH) {
      this.remesh();
    } else if (shk === Enums.KeyAction.REMESH_RESOLUTION) {
      event.handled = true;
      
      if (this._modalRemeshResolution) {
        var main = this._main;
        this._modalRemeshResolution = main._focusGui = false;
        this._updateRemeshIndicator();
        
        if (!this._ctrlRes1.isDown && !this._ctrlRes2.isDown &&
            document.activeElement !== this._ctrlRes1.domInputText &&
            document.activeElement !== this._ctrlRes2.domInputText) {
          this._showVoxelPreview = false;
        }
        this._updateVoxelSizeLabel();
      }
    }
  }

  updateDynamicVisibility(bool) {
    this._ctrlDynSubd.setVisibility(bool);
    this._ctrlDynDec.setVisibility(bool);
    this._ctrlDynLin.setVisibility(bool);
  }

  dynamicToggleActivate() {
    var main = this._main;
    var mesh = main.getMesh();
    if (!mesh)
      return;

    var newMesh = !mesh.isDynamic ? new MeshDynamic(mesh) : this.convertToStaticMesh(mesh);
    this.updateDynamicVisibility(!mesh.isDynamic);

    main.getStateManager().pushStateAddRemove(newMesh, mesh);
    main.replaceMesh(mesh, newMesh);
  }

  remeshResolution(val) {
    val = Math.round(val);
    Remesh.RESOLUTION = val;
    this._ctrlRes1.setValue(val, true);
    this._ctrlRes2.setValue(val, true);
    this._updateVoxelSizeLabel();
  }

  async remesh(manifold) {
    var main = this._main;
    var mesh = main.getMesh();
    if (!mesh)
      return;

    var selMeshes = main.getSelectedMeshes().slice();
    if (selMeshes.length === 0)
      selMeshes = [mesh];
    var estimatedBytes = Remesh.estimateVoxelMemory(selMeshes);
    var divisor = Remesh.getBytesPerVoxel(selMeshes);
    // Absolute safety ceiling (24 GB) to prevent system freezing on excessive paging/thrashing
    var ABSOLUTE_MAX_BYTES = 24.0 * 1024 * 1024 * 1024;
    if (estimatedBytes > ABSOLUTE_MAX_BYTES) {
      var maxRes = Math.floor(Math.cbrt(ABSOLUTE_MAX_BYTES / divisor)) - 4;
      window.alert(TR('remeshResolutionTooHigh', maxRes));
      return;
    }

    try {
      var dummy = new ArrayBuffer(estimatedBytes);
      dummy = null;
    } catch (e) {
      // Memory allocation failed (RangeError or Out of Memory)
      var maxRes = Math.floor(Math.cbrt(12.0 * 1024 * 1024 * 1024 / divisor)) - 4;
      window.alert(TR('remeshResolutionTooHigh', maxRes));
      return;
    }

    var wasDynamic = mesh.isDynamic;

    var meshes = main.getMeshes();
    for (var i = 0, l = selMeshes.length; i < l; ++i) {
      var sel = selMeshes[i];
      meshes.splice(main.getIndexMesh(sel), 1);
      selMeshes[i] = this.convertToStaticMesh(sel);
      if (sel === mesh)
        mesh = selMeshes[i];
    }

    // Show progress indicator
    var self = this;
    this._showRemeshProgress(TR('remeshProgress0'), 0);

    try {
      var newMesh = await Remesh.remeshAsync(selMeshes, mesh, manifold, function (messageKey, step, totalSteps, subStep, subTotal) {
        var message = TR(messageKey);
        if (subStep !== undefined && subTotal !== undefined) {
          message += ' (' + subStep + '/' + subTotal + ')';
        }
        var percent = (step / totalSteps) * 100;
        self._showRemeshProgress(message, percent);
      });

      var isVisibleV1 = false;
      var isVisibleV2 = false;
      for (var j = 0; j < selMeshes.length; ++j) {
        if (selMeshes[j].isVisible(0)) isVisibleV1 = true;
        if (selMeshes[j].isVisible(1)) isVisibleV2 = true;
      }
      newMesh.setVisible(isVisibleV1, 0);
      newMesh.setVisible(isVisibleV2, 1);

      if (wasDynamic) newMesh = new MeshDynamic(newMesh);
      main.getStateManager().pushStateAddRemove(newMesh, main.getSelectedMeshes().slice());
      main.getMeshes().push(newMesh);
      main.setMesh(newMesh);
    } catch (e) {
      console.error('Remesh failed:', e);
      window.alert('Remesh failed: ' + e.message);
    } finally {
      this._hideRemeshProgress();
    }
  }

  remeshMC() {
    this.remesh(true);
  }

  /** Check if the mesh is a multiresolution one */
  isMultimesh(mesh) {
    return !!(mesh && mesh._meshes);
  }

  convertToStaticMesh(mesh) {
    if (!mesh.isDynamic) // already static
      return mesh;

    // dynamic to static mesh
    var newMesh = new MeshStatic(mesh.getGL());
    newMesh.setID(mesh.getID());
    newMesh.setTransformData(mesh.getTransformData());
    newMesh.setVertices(mesh.getVertices().subarray(0, mesh.getNbVertices() * 3));
    newMesh.setColors(mesh.getColors().subarray(0, mesh.getNbVertices() * 3));
    newMesh.setMaterials(mesh.getMaterials().subarray(0, mesh.getNbVertices() * 3));
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

  /** Convert a mesh into a multiresolution one */
  convertToMultimesh(mesh) {
    if (this.isMultimesh(mesh))
      return mesh;
    var multimesh = new Multimesh(this.convertToStaticMesh(mesh));
    return multimesh;
  }

  /** Subdivide the mesh */
  subdivide() {
    var main = this._main;
    var mesh = main.getMesh();
    if (!mesh)
      return;

    var mul = this.convertToMultimesh(mesh);
    if (mul._sel !== mul._meshes.length - 1) {
      window.alert(TR('multiresSelectHighest'));
      return;
    }

    if (mul.getNbTriangles() > 400000) {
      if (!window.confirm(TR('multiresWarnBigMesh', mul.getNbFaces() * 4))) {
        return;
      }
    }

    if (mesh !== mul) {
      main.replaceMesh(mesh, mul);
      main.getStateManager().pushStateAddRemove(mul, mesh, true);
    }

    main.getStateManager().pushState(new StateMultiresolution(main, mul, StateMultiresolution.SUBDIVISION));
    mul.addLevel();
    main.setMesh(mul);
    main.render();
  }

  /** Inverse subdivision */
  reverse() {
    var main = this._main;
    var mesh = main.getMesh();
    if (!mesh)
      return;

    var mul = this.convertToMultimesh(mesh);
    if (mul._sel !== 0) {
      window.alert(TR('multiresSelectLowest'));
      return;
    }

    var stateRes = new StateMultiresolution(main, mul, StateMultiresolution.REVERSION);
    var newMesh = mul.computeReverse();
    if (!newMesh) {
      window.alert(TR('multiresNotReversible'));
      return;
    }

    if (mesh !== mul) {
      main.replaceMesh(mesh, mul);
      main.getStateManager().pushStateAddRemove(mul, mesh, true);
    }

    main.getStateManager().pushState(stateRes);
    main.setMesh(mul);
    main.render();
  }

  /** Delete the lower meshes */
  deleteLower() {
    var main = this._main;
    var mul = main._mesh;
    if (!this.isMultimesh(mul) || mul._sel === 0) {
      window.alert(TR('multiresNoLower'));
      return;
    }

    main.getStateManager().pushState(new StateMultiresolution(main, mul, StateMultiresolution.DELETE_LOWER));
    mul.deleteLower();
    this.updateMeshResolution();
  }

  /** Delete the higher meshes */
  deleteHigher() {
    var main = this._main;
    var mul = main.getMesh();
    if (!this.isMultimesh(mul) || mul._sel === mul._meshes.length - 1) {
      window.alert(TR('multiresNoHigher'));
      return;
    }

    main.getStateManager().pushState(new StateMultiresolution(main, mul, StateMultiresolution.DELETE_HIGHER));
    mul.deleteHigher();
    this.updateMeshResolution();
  }

  /** Change resoltuion */
  onResolutionChanged(value) {
    var uiRes = value - 1;
    var main = this._main;
    var multimesh = main.getMesh();
    if (!multimesh) return;
    var isMulti = this.isMultimesh(multimesh);
    var isLast = isMulti && multimesh._meshes.length - 1 === uiRes;

    this._ctrlReverse.setEnable(!isMulti || uiRes === 0);
    this._ctrlSubdivide.setEnable(!isMulti || isLast);
    this._ctrlDelLower.setEnable(isMulti && uiRes !== 0);
    this._ctrlDelHigher.setEnable(isMulti && !isLast);

    if (!isMulti || multimesh._sel === uiRes)
      return;

    main.getStateManager().pushState(new StateMultiresolution(main, multimesh, StateMultiresolution.SELECTION));
    multimesh.selectResolution(uiRes);
    this._ctrlGui.updateMeshInfo();
    main.render();
  }

  /** Update the mesh resolution slider */
  updateMeshResolution() {
    var multimesh = this._main.getMesh();
    if (!multimesh || !this.isMultimesh(multimesh)) {
      this._ctrlResolution.setMax(1);
      this._ctrlResolution.setValue(0);
      return;
    }
    this._ctrlResolution.setMax(multimesh._meshes.length);
    this._ctrlResolution.setValue(multimesh._sel + 1);
  }

  /** Update topology information */
  updateMesh() {
    this._menu.setVisibility(true);
    if (!this._main.getMesh()) {
      return;
    }
    this.updateMeshResolution();
    var bool = this._main.getMesh().isDynamic;
    this.updateDynamicVisibility(bool);
    this._ctrlDynamic.setValue(bool, true);
    this._updateVoxelSizeLabel();
  }

  _updateVoxelSizeLabel() {
    var main = this._main;
    var selMeshes = main.getSelectedMeshes();
    if (selMeshes.length === 0 && main.getMesh()) {
      selMeshes = [main.getMesh()];
    }
    if (selMeshes.length === 0 || !this._voxelSizeLabel1 || !this._voxelSizeLabel2) {
      main.updateVoxelPreview(null);
      main.render();
      return;
    }

    var step = Remesh.computeVoxelStep(selMeshes);
    var valStr = step.toPrecision(3);
    
    var text = TR('remeshVoxelSize', valStr);
    this._voxelSizeLabel1.textContent = text;
    this._voxelSizeLabel2.textContent = text;

    if (this._showVoxelPreview) {
      main.updateVoxelPreview(step, selMeshes);
    } else {
      main.updateVoxelPreview(null);
    }
    main.render();
  }

  onKeyDown(event) {
    if (event.handled === true)
      return;

    var key = event.which;
    if ((event.ctrlKey || event.metaKey) && (event.key === 't' || event.key === 'T' || key === 84)) {
      event.preventDefault();
      event.stopPropagation();
      event.handled = true;
      this.dynamicToggleActivate();
      return;
    }

    var shk = getOptionsURL.getShortKey(event.which);
    if (shk === Enums.KeyAction.REMESH_RESOLUTION) {
      event.preventDefault();
      event.stopPropagation();
      event.handled = true;
      
      if (event.ctrlKey) {
        this.remesh();
        return;
      }

      var main = this._main;
      if (main._action !== Enums.Action.NOTHING)
        return;

      if (!this._modalRemeshResolution) {
        this._remeshRefX = this._lastPageX;
        this._remeshRefY = this._lastPageY;
        this._modalRemeshResolution = main._focusGui = true;
      }
      this._showVoxelPreview = true;
      this._updateVoxelSizeLabel();
      this._updateRemeshIndicator(this._remeshRefX, this._remeshRefY);
    }
  }

  onMouseMove(event) {
    if (this._modalRemeshResolution) {
      var delta = event.pageX - this._lastPageX;
      var newVal = Math.max(8, Math.min(2000, Remesh.RESOLUTION + delta * 2));
      this.remeshResolution(newVal);
      this._updateRemeshIndicator(this._remeshRefX, this._remeshRefY);
    }
    this._lastPageX = event.pageX;
    this._lastPageY = event.pageY;
  }

  onMouseDown(event) {
    this._lastPageX = event.pageX;
    this._lastPageY = event.pageY;
  }

  removeEvents() {
    this._remeshInd.destroy();
    if (this._remeshProgressModal && this._remeshProgressModal.parentNode) {
      this._remeshProgressModal.parentNode.removeChild(this._remeshProgressModal);
    }
  }

  _initRemeshInd() {
    this._remeshInd = new Indicator({
      label: TR('remeshResolution'),
      unit: '',
      min: 8,
      max: 2000
    });
  }

  _updateRemeshIndicator(x, y) {
    if (this._modalRemeshResolution) {
      var val = Math.round(Remesh.RESOLUTION);
      var pct = Math.max(0, Math.min(100, ((val - 8) / (2000 - 8)) * 100));
      this._remeshInd.show(x, y, val, pct);
    } else {
      this._remeshInd.hide();
    }
  }

  _initRemeshProgressIndicator() {
    var modal = this._remeshProgressModal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0, 0, 0, 0.6)';
    modal.style.backdropFilter = 'blur(4px)';
    modal.style.webkitBackdropFilter = 'blur(4px)';
    modal.style.display = 'none';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '100000';
    modal.style.pointerEvents = 'all';

    var container = document.createElement('div');
    container.style.background = 'rgba(68, 68, 68, 0.95)';
    container.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    container.style.borderRadius = '12px';
    container.style.padding = '24px 32px';
    container.style.minWidth = '320px';
    container.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.5)';
    container.style.fontFamily = "'Open Sans', sans-serif";
    container.style.color = '#EAEAEA';

    var title = document.createElement('div');
    title.style.fontSize = '18px';
    title.style.fontWeight = '600';
    title.style.marginBottom = '8px';
    title.style.textAlign = 'center';
    title.textContent = 'Remeshing...';
    container.appendChild(title);

    var message = this._remeshProgressMessage = document.createElement('div');
    message.style.fontSize = '13px';
    message.style.color = '#a6a6a6';
    message.style.marginBottom = '16px';
    message.style.textAlign = 'center';
    message.style.minHeight = '18px';
    message.textContent = 'Initializing...';
    container.appendChild(message);

    var progressTrack = document.createElement('div');
    progressTrack.style.width = '100%';
    progressTrack.style.height = '8px';
    progressTrack.style.background = 'rgba(255, 255, 255, 0.1)';
    progressTrack.style.borderRadius = '4px';
    progressTrack.style.overflow = 'hidden';
    progressTrack.style.marginBottom = '12px';

    var progressBar = this._remeshProgressBar = document.createElement('div');
    progressBar.style.width = '0%';
    progressBar.style.height = '100%';
    progressBar.style.background = 'linear-gradient(90deg, #018574, #02b09a)';
    progressBar.style.borderRadius = '4px';
    progressBar.style.transition = 'width 0.3s ease-out';
    progressTrack.appendChild(progressBar);
    container.appendChild(progressTrack);

    var percentText = this._remeshProgressPercent = document.createElement('div');
    percentText.style.fontSize = '12px';
    percentText.style.color = '#a6a6a6';
    percentText.style.textAlign = 'center';
    percentText.textContent = '0%';
    container.appendChild(percentText);

    modal.appendChild(container);
    document.body.appendChild(modal);
  }

  _showRemeshProgress(message, percent) {
    if (this._remeshProgressModal) {
      this._remeshProgressModal.style.display = 'flex';
      this._remeshProgressMessage.textContent = message;
      this._remeshProgressBar.style.width = percent + '%';
      this._remeshProgressPercent.textContent = Math.round(percent) + '%';
    }
  }

  _hideRemeshProgress() {
    if (this._remeshProgressModal) {
      this._remeshProgressModal.style.display = 'none';
    }
  }
}

export default GuiMultiresolution;
