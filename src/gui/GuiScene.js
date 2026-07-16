import TR from './GuiTR.js';
import Remesh from '../editing/Remesh.js';
import ShaderBase from '../render/shaders/ShaderBase.js';
import { createIcons, Trash2, Circle, Box, Cylinder, Donut, Edit3, Copy, Layers } from 'lucide';
import Enums from '../misc/Enums.js';


class GuiScene {

  constructor(guiParent, ctrlGui) {
    this._main = ctrlGui._main; // main application
    this._menu = null;
    this._isolateState = false;
    this._outlinerContainer = null;
    this._outlinerEl = null;
    this._btnMerge = null;
    this._btnRename = null;
    this.init(guiParent);
  }

  init(guiParent) {
    var menu = this._menu = guiParent.addMenu(TR('sceneTitle'));

    // Horizontal Scene Actions Row
    this._sceneActionsContainer = document.createElement('div');
    this._sceneActionsContainer.className = 'sp-scene-actions-row';
    this._sceneActionsContainer.innerHTML = `
      <button class="sp-scene-btn" data-action="clear" title="${TR('sceneReset')}">
        <i data-lucide="trash-2"></i>
      </button>
      <div class="sp-scene-sep"></div>
      <button class="sp-scene-btn" data-action="add-sphere" title="${TR('sceneAddSphere')}">
        <i data-lucide="circle"></i>
      </button>
      <button class="sp-scene-btn" data-action="add-cube" title="${TR('sceneAddCube')}">
        <i data-lucide="box"></i>
      </button>
      <button class="sp-scene-btn" data-action="add-cylinder" title="${TR('sceneAddCylinder')}">
        <i data-lucide="cylinder"></i>
      </button>
      <button class="sp-scene-btn" data-action="add-torus" title="${TR('sceneAddTorus')}">
        <i data-lucide="donut"></i>
      </button>
    `;
    menu.domUl.appendChild(this._sceneActionsContainer);
    createIcons({
      icons: { Trash2, Circle, Box, Cylinder, Donut },
      root: this._sceneActionsContainer
    });

    this._sceneActionsContainer.addEventListener('click', (e) => {
      var btn = e.target.closest('.sp-scene-btn');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'clear') {
        this.clearScene();
      } else if (action === 'add-sphere') {
        this._main.addSphere();
      } else if (action === 'add-cube') {
        this._main.addCube();
      } else if (action === 'add-cylinder') {
        this._main.addCylinder();
      } else if (action === 'add-torus') {
        this._main.addTorus();
      }
      btn.blur();
    });

    // Outliner Panel (Selection / Hierarchy list)
    menu.addTitle(TR('sceneSelection'));

    this._outlinerContainer = document.createElement('div');
    this._outlinerContainer.className = 'sp-outliner-container';
    this._outlinerContainer.innerHTML = `
      <div class="sp-outliner" id="sp-outliner-list"></div>
      <div class="sp-outliner-actions">
        <button class="sp-act-btn" data-action="rename" id="sp-btn-rename" title="Rename selected" disabled>
          <i data-lucide="edit-3"></i>
        </button>
        <button class="sp-act-btn" data-action="duplicate" title="Duplicate selected">
          <i data-lucide="copy"></i>
        </button>
        <button class="sp-act-btn" data-action="delete" title="Delete selected">
          <i data-lucide="trash-2"></i>
        </button>
        <button class="sp-act-btn" data-action="merge" id="sp-btn-merge" title="Merge selected" disabled>
          <i data-lucide="layers"></i>
        </button>
      </div>
    `;
    menu.domUl.appendChild(this._outlinerContainer);

    this._outlinerEl = this._outlinerContainer.querySelector('#sp-outliner-list');
    this._btnMerge = this._outlinerContainer.querySelector('#sp-btn-merge');
    this._btnRename = this._outlinerContainer.querySelector('#sp-btn-rename');

    createIcons({
      icons: { Edit3, Copy, Trash2, Layers },
      root: this._outlinerContainer
    });

    this._bindOutlinerEvents();
    this._injectStyles();

    // Mock old controller references to prevent crashes in other parts of the codebase
    this._ctrlIsolate = {
      setValue: (val, ignore) => {
        this._isolateState = val;
        if (!ignore) this.showHide(val);
        var gui = this._main.getGui();
        if (gui && gui._toolbar) {
          gui._toolbar.setSoloActive(this._isolateState);
        }
      },
      getValue: () => this._isolateState,
      setVisibility: () => {}
    };
    this._ctrlMerge = {
      setVisibility: () => {}
    };


    // extra
    menu.addTitle(TR('renderingExtra'));
    menu.addCheckbox(TR('darkenUnselected'), ShaderBase.darkenUnselected, this.onDarkenUnselected.bind(this));
    menu.addCheckbox(TR('contourShow'), this._main._showContour, this.onShowContour.bind(this));
    menu.addCheckbox(TR('renderingGrid'), this._main._showGrid, this.onShowGrid.bind(this));
  }

  clearScene() {
    if (window.confirm(TR('sceneResetConfirm'))) {
      this._main.clearScene();
    }
  }

  duplicateSelection() {
    this._main.duplicateSelection();
  }

  deleteSelection() {
    this._main.deleteCurrentSelection();
  }

  validatePreview() {
    if (!this._main._meshPreview)
      this._main.addTorus(true);

    this._main._meshPreview.setShowWireframe(false);
    this._main.addNewMesh(this._main._meshPreview);
    this._main._meshPreview = null;

    this.ctrlDiscard.setVisibility(false);
    this.ctrlValidate.setVisibility(false);
    this._main.render();
  }

  discardPreview() {
    this._main._meshPreview = null;
    this.ctrlDiscard.setVisibility(false);
    this.ctrlValidate.setVisibility(false);
    this._main.render();
  }

  updateTorusRadius(val) {
    this._main._torusRadius = val;
    this.updateTorus();
  }

  updateTorusRadial(val) {
    this._main._torusRadial = val;
    this.updateTorus();
  }

  updateTorusTubular(val) {
    this._main._torusTubular = val;
    this.updateTorus();
  }

  updateTorusWidth(val) {
    this._main._torusWidth = val;
    if (this._main._torusLength < this._main._torusWidth) {
      this.ctrlLE.setValue(val);
      return;
    }
    this.updateTorus();
  }

  updateTorusLength(val) {
    this._main._torusLength = val;
    if (this._main._torusLength < this._main._torusWidth) {
      this.ctrlWI.setValue(val);
      return;
    }
    this.updateTorus();
  }

  updateTorus() {
    this._main.addTorus(true);
    this.ctrlDiscard.setVisibility(true);
    this.ctrlValidate.setVisibility(true);
    this._main.render();
  }

  hasHiddenMeshes() {
    var meshes = this._main.getMeshes();
    for (var i = 0; i < meshes.length; ++i) {
      if (!meshes[i].isVisible()) return true;
    }
    return false;
  }

  updateMesh() {
    var nbMeshes = this._main.getMeshes().length;
    var nbSelected = this._main.getSelectedMeshes().length;
    this._ctrlIsolate.setVisibility(this.hasHiddenMeshes() || (nbMeshes !== nbSelected && nbSelected >= 1));
    this._ctrlMerge.setVisibility(nbSelected > 1);

    this.refreshOutliner();
  }

  merge() {
    var main = this._main;
    var selMeshes = main.getSelectedMeshes();
    if (selMeshes.length < 2) return;

    var newMesh = Remesh.mergeMeshes(selMeshes, main.getMesh() || selMeshes[0]);
    main.removeMeshes(selMeshes);
    main.getStateManager().pushStateAddRemove(newMesh, selMeshes.slice());
    main.getMeshes().push(newMesh);
    main.setMesh(newMesh);
  }

  toggleShowHide(ignoreCB) {
    this._ctrlIsolate.setValue(!this._ctrlIsolate.getValue(), !!ignoreCB);
  }

  showHide(bool) {
    if (bool) this.isolate();
    else this.showAll();
    this.updateMesh();
  }

  setMeshesVisible(meshes, bool) {
    for (var i = 0; i < meshes.length; ++i) {
      meshes[i].setVisible(bool);
    }
    this._ctrlIsolate.setValue(!bool, true);
  }

  pushSetMeshesVisible(hideMeshes, bool) {
    this.setMeshesVisible(hideMeshes, bool);
    var cbUndo = this.setMeshesVisible.bind(this, hideMeshes, !bool);
    var cbRedo = this.setMeshesVisible.bind(this, hideMeshes, bool);
    this._main.getStateManager().pushStateCustom(cbUndo, cbRedo);
  }

  isolate() {
    var main = this._main;
    var selMeshes = main.getSelectedMeshes();
    var meshes = main.getMeshes();

    var hideMeshes = [];
    for (var i = 0; i < meshes.length; ++i) {
      var id = main.getIndexSelectMesh(meshes[i]);
      if (id < 0) hideMeshes.push(meshes[i]);
    }

    if (hideMeshes.length > 0) {
      this.pushSetMeshesVisible(hideMeshes, false);
    }

    main.render();
  }

  showAll() {
    var main = this._main;
    var meshes = main.getMeshes();

    var hideMeshes = [];
    for (var i = 0; i < meshes.length; ++i) {
      if (!meshes[i].isVisible()) hideMeshes.push(meshes[i]);
    }

    if (hideMeshes.length > 0) {
      this.pushSetMeshesVisible(hideMeshes, true);
    }

    main.render();
  }

  onDarkenUnselected(val) {
    ShaderBase.darkenUnselected = val;
    this._main.render();
  }

  onShowGrid(bool) {
    var main = this._main;
    main._showGrid = bool;
    main.render();
  }

  onShowContour(bool) {
    var main = this._main;
    main._showContour = bool;
    main.render();
  }

  ////////////////
  // KEY EVENTS
  ////////////////
  onKeyDown(event) {
    if (event.handled === true)
      return;

    event.stopPropagation();
    if (!this._main._focusGui)
      event.preventDefault();

    if (event.which === 67) { // C
      this.toggleShowHide();
      event.handled = true;
    } else if (event.which === 68 && event.ctrlKey) { // D
      this._main.duplicateSelection();
      event.handled = true;
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  _bindOutlinerEvents() {
    this._outlinerContainer.addEventListener('click', (e) => {
      var btn = e.target.closest('[data-action]');
      if (!btn) {
        // Selection check on row click
        var row = e.target.closest('.sp-outliner-row');
        if (row) {
          var meshIdAttr = row.getAttribute('data-mesh-id');
          var meshId = (meshIdAttr === 'zsphere' || meshIdAttr === 'measure' || meshIdAttr === 'divider') ? meshIdAttr : parseInt(meshIdAttr);
          this._selectMesh(meshId, e.ctrlKey || e.metaKey);
        }
        return;
      }

      var action = btn.getAttribute('data-action');
      var idAttr = btn.getAttribute('data-mesh-id');
      var id = (idAttr === 'zsphere' || idAttr === 'measure' || idAttr === 'divider') ? idAttr : (idAttr ? parseInt(idAttr) : null);

      switch (action) {
        case 'toggle-vis-v1':
          this._toggleVisibility(id, 0);
          break;
        case 'toggle-vis-v2':
          this._toggleVisibility(id, 1);
          break;
        case 'rename':
          var selectedMeshes = this._main.getSelectedMeshes();
          if (selectedMeshes.length === 1) {
            var meshId = selectedMeshes[0].getID();
            var row = this._outlinerEl.querySelector(`.sp-outliner-row[data-mesh-id="${meshId}"]`);
            var nameSpan = row ? row.querySelector('.sp-mesh-name') : null;
            if (nameSpan) {
              this._startRename(nameSpan, meshId);
            }
          }
          break;
        case 'select':
          this._selectMesh(id, e.ctrlKey || e.metaKey);
          break;
        case 'duplicate':
          this.duplicateSelection();
          break;
        case 'delete':
          this.deleteSelection();
          break;
        case 'merge':
          this.merge();
          break;
      }
    });

    this._outlinerContainer.addEventListener('dblclick', (e) => {
      var row = e.target.closest('.sp-outliner-row');
      if (row) {
        var meshIdAttr = row.getAttribute('data-mesh-id');
        if (meshIdAttr === 'zsphere' || meshIdAttr === 'measure' || meshIdAttr === 'divider') return;
        var meshId = parseInt(meshIdAttr);
        var nameSpan = row.querySelector('.sp-mesh-name');
        if (nameSpan) {
          this._startRename(nameSpan, meshId);
        }
      }
    });
  }

  _selectMesh(id, multiSelect) {
    if (id === 'zsphere') {
      var gui = this._main.getGui();
      if (gui && gui._ctrlSculpting && gui._ctrlSculpting._ctrlSculpt) {
        gui._ctrlSculpting._ctrlSculpt.setValue(Enums.Tools.ZSPHERE);
      } else {
        this._main.getSculptManager().setToolIndex(Enums.Tools.ZSPHERE);
      }
      this._main.render();
      this.refreshOutliner();
      return;
    }

    if (id === 'measure') {
      var gui = this._main.getGui();
      if (gui && gui._ctrlSculpting && gui._ctrlSculpting._ctrlSculpt) {
        gui._ctrlSculpting._ctrlSculpt.setValue(Enums.Tools.MEASURE);
      } else {
        this._main.getSculptManager().setToolIndex(Enums.Tools.MEASURE);
      }
      this._main.render();
      this.refreshOutliner();
      return;
    }

    if (id === 'divider') {
      var gui = this._main.getGui();
      if (gui && gui._ctrlSculpting && gui._ctrlSculpting._ctrlSculpt) {
        gui._ctrlSculpting._ctrlSculpt.setValue(Enums.Tools.DIVIDER);
      } else {
        this._main.getSculptManager().setToolIndex(Enums.Tools.DIVIDER);
      }
      this._main.render();
      this.refreshOutliner();
      return;
    }

    var sculptMgr = this._main.getSculptManager();
    var currentTool = sculptMgr.getToolIndex();
    if (currentTool === Enums.Tools.ZSPHERE || currentTool === Enums.Tools.MEASURE || currentTool === Enums.Tools.DIVIDER) {
      var gui = this._main.getGui();
      if (gui && gui._ctrlSculpting && gui._ctrlSculpting._ctrlSculpt) {
        gui._ctrlSculpting._ctrlSculpt.setValue(Enums.Tools.BRUSH);
      } else {
        sculptMgr.setToolIndex(Enums.Tools.BRUSH);
      }
    }

    var meshes = this._main.getMeshes();
    var target = meshes.find(m => m.getID() === id);
    if (target) {
      this._main.setOrUnsetMesh(target, multiSelect);
    }
  }

  _toggleVisibility(id, vpIdx) {
    if (id === 'zsphere') {
      var zsphereTool = this._main.getSculptManager().getTool(Enums.Tools.ZSPHERE);
      if (zsphereTool && zsphereTool._drawable) {
        zsphereTool._drawable.setVisible(!zsphereTool._drawable.isVisible(vpIdx), vpIdx);
        this._main.render();
        this.refreshOutliner();
      }
      return;
    }

    if (id === 'measure') {
      var measureTool = this._main.getSculptManager().getTool(Enums.Tools.MEASURE);
      if (measureTool) {
        measureTool.setVisible(!measureTool.isVisible(vpIdx), vpIdx);
        this._main.render();
        this.refreshOutliner();
      }
      return;
    }

    if (id === 'divider') {
      var dividerTool = this._main.getSculptManager().getTool(Enums.Tools.DIVIDER);
      if (dividerTool) {
        dividerTool.setVisible(!dividerTool.isVisible(vpIdx), vpIdx);
        this._main.render();
        this.refreshOutliner();
      }
      return;
    }

    var meshes = this._main.getMeshes();
    var target = meshes.find(m => m.getID() === id);
    if (target) {
      target.setVisible(!target.isVisible(vpIdx), vpIdx);
      this._main.render();
      this.refreshOutliner();
    }
  }

  _startRename(nameSpan, id) {
    var meshes = this._main.getMeshes();
    var target = meshes.find(m => m.getID() === id);
    if (!target) return;

    var currentName = target._outlinerName || ('Mesh ' + id);

    var input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'sp-rename-input';

    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    var commitRename = () => {
      var newName = input.value.trim();
      if (newName) {
        target._outlinerName = newName;
      }
      this.refreshOutliner();
    };

    input.addEventListener('blur', commitRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitRename();
      } else if (e.key === 'Escape') {
        input.value = currentName;
        input.blur();
      }
    });
  }

  refreshOutliner() {
    if (!this._outlinerEl) return;

    var meshes = this._main.getMeshes();
    var selected = this._main.getSelectedMeshes();
    
    var currentTool = this._main.getSculptManager().getToolIndex();
    var isZSphereActive = (currentTool === Enums.Tools.ZSPHERE);
    var isMeasureActive = (currentTool === Enums.Tools.MEASURE);
    var isDividerActive = (currentTool === Enums.Tools.DIVIDER);
    var selSet = (isZSphereActive || isMeasureActive || isDividerActive) ? new Set() : new Set(selected.map(m => m.getID()));

    var html = '';
    for (var i = 0; i < meshes.length; i++) {
      var m = meshes[i];
      var id = m.getID();
      var isSelected = selSet.has(id);
      var isVisibleV1 = m.isVisible(0);
      var isVisibleV2 = m.isVisible(1);
      var name = m._outlinerName || ('Mesh ' + id);

      var selCls = isSelected ? ' sp-row--selected' : '';
      var hideCls = (isVisibleV1 || isVisibleV2) ? '' : ' sp-row--hidden';

      var vertCount = m.getNbVertices ? m.getNbVertices() : 0;
      var metaStr = vertCount.toLocaleString() + ' pts';

      var eyeSvgV1 = isVisibleV1 
        ? `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

      var eyeSvgV2 = isVisibleV2 
        ? `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

      var v1HiddenCls = isVisibleV1 ? '' : ' sp-vis--hidden';
      var v2HiddenCls = isVisibleV2 ? '' : ' sp-vis--hidden';

      html += `
        <div class="sp-outliner-row${selCls}${hideCls}" data-mesh-id="${id}">
          <div class="sp-vis-group">
            <button class="sp-vis-btn sp-vis-v1${v1HiddenCls}" data-action="toggle-vis-v1" data-mesh-id="${id}" title="${isVisibleV1 ? 'Hide in Viewport 1' : 'Show in Viewport 1'}">
              ${eyeSvgV1}
              <span class="sp-vis-badge">1</span>
            </button>
            <button class="sp-vis-btn sp-vis-v2${v2HiddenCls}" data-action="toggle-vis-v2" data-mesh-id="${id}" title="${isVisibleV2 ? 'Hide in Viewport 2' : 'Show in Viewport 2'}">
              ${eyeSvgV2}
              <span class="sp-vis-badge">2</span>
            </button>
          </div>
          <div class="sp-mesh-info-wrapper" data-action="select" data-mesh-id="${id}">
            <span class="sp-mesh-name" title="Double click to rename">${this.escapeHtml(name)}</span>
            <span class="sp-mesh-meta">${metaStr}</span>
          </div>
        </div>
      `;
    }

    var zsphereTool = this._main.getSculptManager().getTool(Enums.Tools.ZSPHERE);
    var zsphereNodes = zsphereTool ? zsphereTool._graph.getNodes() : [];
    if (isZSphereActive || zsphereNodes.length > 0) {
      var isZSphereVisibleV1 = zsphereTool._drawable ? zsphereTool._drawable.isVisible(0) : true;
      var isZSphereVisibleV2 = zsphereTool._drawable ? zsphereTool._drawable.isVisible(1) : true;
      var zSelCls = isZSphereActive ? ' sp-row--selected' : '';
      var zHideCls = (isZSphereVisibleV1 || isZSphereVisibleV2) ? '' : ' sp-row--hidden';
      var zMetaStr = zsphereNodes.length + ' spheres';

      var zEyeSvgV1 = isZSphereVisibleV1 
        ? `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

      var zEyeSvgV2 = isZSphereVisibleV2 
        ? `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

      var zv1HiddenCls = isZSphereVisibleV1 ? '' : ' sp-vis--hidden';
      var zv2HiddenCls = isZSphereVisibleV2 ? '' : ' sp-vis--hidden';

      html += `
        <div class="sp-outliner-row${zSelCls}${zHideCls}" data-mesh-id="zsphere">
          <div class="sp-vis-group">
            <button class="sp-vis-btn sp-vis-v1${zv1HiddenCls}" data-action="toggle-vis-v1" data-mesh-id="zsphere" title="${isZSphereVisibleV1 ? 'Hide in Viewport 1' : 'Show in Viewport 1'}">
              ${zEyeSvgV1}
              <span class="sp-vis-badge">1</span>
            </button>
            <button class="sp-vis-btn sp-vis-v2${zv2HiddenCls}" data-action="toggle-vis-v2" data-mesh-id="zsphere" title="${isZSphereVisibleV2 ? 'Hide in Viewport 2' : 'Show in Viewport 2'}">
              ${zEyeSvgV2}
              <span class="sp-vis-badge">2</span>
            </button>
          </div>
          <div class="sp-mesh-info-wrapper" data-action="select" data-mesh-id="zsphere">
            <span class="sp-mesh-name">ZSphere Armature</span>
            <span class="sp-mesh-meta">${zMetaStr}</span>
          </div>
        </div>
      `;
    }

    var measureTool = this._main.getSculptManager().getTool(Enums.Tools.MEASURE);
    var measureSegments = measureTool ? measureTool.getSegments() : [];
    if (isMeasureActive || measureSegments.length > 0) {
      var isMeasureVisibleV1 = measureTool ? measureTool.isVisible(0) : true;
      var isMeasureVisibleV2 = measureTool ? measureTool.isVisible(1) : true;
      var mSelCls = isMeasureActive ? ' sp-row--selected' : '';
      var mHideCls = (isMeasureVisibleV1 || isMeasureVisibleV2) ? '' : ' sp-row--hidden';
      var mMetaStr = measureSegments.length + ' ' + (measureSegments.length === 1 ? 'segment' : 'segments');

      var mEyeSvgV1 = isMeasureVisibleV1 
        ? `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

      var mEyeSvgV2 = isMeasureVisibleV2 
        ? `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

      var mv1HiddenCls = isMeasureVisibleV1 ? '' : ' sp-vis--hidden';
      var mv2HiddenCls = isMeasureVisibleV2 ? '' : ' sp-vis--hidden';

      html += `
        <div class="sp-outliner-row${mSelCls}${mHideCls}" data-mesh-id="measure">
          <div class="sp-vis-group">
            <button class="sp-vis-btn sp-vis-v1${mv1HiddenCls}" data-action="toggle-vis-v1" data-mesh-id="measure" title="${isMeasureVisibleV1 ? 'Hide in Viewport 1' : 'Show in Viewport 1'}">
              ${mEyeSvgV1}
              <span class="sp-vis-badge">1</span>
            </button>
            <button class="sp-vis-btn sp-vis-v2${mv2HiddenCls}" data-action="toggle-vis-v2" data-mesh-id="measure" title="${isMeasureVisibleV2 ? 'Hide in Viewport 2' : 'Show in Viewport 2'}">
              ${mEyeSvgV2}
              <span class="sp-vis-badge">2</span>
            </button>
          </div>
          <div class="sp-mesh-info-wrapper" data-action="select" data-mesh-id="measure">
            <span class="sp-mesh-name">${this.escapeHtml(TR('measureTitle'))}</span>
            <span class="sp-mesh-meta">${mMetaStr}</span>
          </div>
        </div>
      `;
    }

    var dividerTool = this._main.getSculptManager().getTool(Enums.Tools.DIVIDER);
    var dividerSegments = dividerTool ? dividerTool.getSegments() : [];
    if (isDividerActive || dividerSegments.length > 0) {
      var isDividerVisibleV1 = dividerTool ? dividerTool.isVisible(0) : true;
      var isDividerVisibleV2 = dividerTool ? dividerTool.isVisible(1) : true;
      var dSelCls = isDividerActive ? ' sp-row--selected' : '';
      var dHideCls = (isDividerVisibleV1 || isDividerVisibleV2) ? '' : ' sp-row--hidden';
      var dMetaStr = dividerSegments.length + ' ' + (dividerSegments.length === 1 ? 'segment' : 'segments');

      var dEyeSvgV1 = isDividerVisibleV1 
        ? `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

      var dEyeSvgV2 = isDividerVisibleV2 
        ? `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

      var dv1HiddenCls = isDividerVisibleV1 ? '' : ' sp-vis--hidden';
      var dv2HiddenCls = isDividerVisibleV2 ? '' : ' sp-vis--hidden';

      html += `
        <div class="sp-outliner-row${dSelCls}${dHideCls}" data-mesh-id="divider">
          <div class="sp-vis-group">
            <button class="sp-vis-btn sp-vis-v1${dv1HiddenCls}" data-action="toggle-vis-v1" data-mesh-id="divider" title="${isDividerVisibleV1 ? 'Hide in Viewport 1' : 'Show in Viewport 1'}">
              ${dEyeSvgV1}
              <span class="sp-vis-badge">1</span>
            </button>
            <button class="sp-vis-btn sp-vis-v2${dv2HiddenCls}" data-action="toggle-vis-v2" data-mesh-id="divider" title="${isDividerVisibleV2 ? 'Hide in Viewport 2' : 'Show in Viewport 2'}">
              ${dEyeSvgV2}
              <span class="sp-vis-badge">2</span>
            </button>
          </div>
          <div class="sp-mesh-info-wrapper" data-action="select" data-mesh-id="divider">
            <span class="sp-mesh-name">${this.escapeHtml(TR('dividerTitle'))}</span>
            <span class="sp-mesh-meta">${dMetaStr}</span>
          </div>
        </div>
      `;
    }

    this._outlinerEl.innerHTML = html || '<div class="sp-outliner-empty">No objects in scene</div>';

    var btnDuplicate = this._outlinerContainer.querySelector('[data-action="duplicate"]');
    var btnDelete = this._outlinerContainer.querySelector('[data-action="delete"]');
    if (btnDuplicate) {
      btnDuplicate.disabled = (selected.length === 0) || isZSphereActive || isMeasureActive || isDividerActive;
    }
    if (btnDelete) {
      btnDelete.disabled = (selected.length === 0) || isZSphereActive || isMeasureActive || isDividerActive;
    }

    if (this._btnMerge) {
      this._btnMerge.disabled = (selected.length < 2) || isZSphereActive || isMeasureActive || isDividerActive;
    }
    if (this._btnRename) {
      this._btnRename.disabled = (selected.length !== 1) || isZSphereActive || isMeasureActive || isDividerActive;
    }
  }

  _injectStyles() {
    var styleId = 'sp-outliner-styles';
    if (document.getElementById(styleId)) return;

    var styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      .sp-outliner-container {
        margin: 10px 0;
        padding: 0 4px;
      }
      .sp-outliner {
        height: 320px;
        overflow-y: auto;
        margin: 6px 0;
        background: rgba(18, 18, 18, 0.45);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 6px;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.4);
        display: flex;
        flex-direction: column;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.15) rgba(0, 0, 0, 0.1);
      }
      .sp-outliner::-webkit-scrollbar {
        width: 6px;
        background: rgba(0, 0, 0, 0.1);
      }
      .sp-outliner::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 3px;
        transition: background 0.2s ease;
      }
      .sp-outliner::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      .sp-outliner-empty {
        color: #777;
        font-size: 11px;
        text-align: center;
        font-style: italic;
        margin: auto;
      }
      .sp-outliner-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        margin-bottom: 4px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid transparent;
      }
      .sp-outliner-row:last-child {
        margin-bottom: 0;
      }
      .sp-outliner-row:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.04);
      }
      .sp-outliner-row.sp-row--selected {
        background: linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 22%, transparent), color-mix(in srgb, var(--color-accent) 10%, transparent));
        border-color: color-mix(in srgb, var(--color-accent) 45%, transparent);
        box-shadow: 0 0 8px color-mix(in srgb, var(--color-accent) 15%, transparent);
      }
      .sp-outliner-row.sp-row--hidden {
        opacity: 0.4;
      }
      .sp-vis-group {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-shrink: 0;
      }
      .sp-vis-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        color: #888;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s ease, transform 0.15s ease;
        width: 20px;
        height: 20px;
        position: relative;
      }
      .sp-vis-badge {
        position: absolute;
        bottom: -3px;
        right: -3px;
        font-size: 7px;
        background: rgba(0, 0, 0, 0.7);
        color: #aaa;
        border-radius: 50%;
        width: 10px;
        height: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        pointer-events: none;
      }
      .sp-vis-btn:hover .sp-vis-badge {
        color: #fff;
      }
      .sp-vis--hidden {
        opacity: 0.35;
      }
      .sp-vis-btn:hover {
        color: #fff;
        transform: scale(1.1);
      }
      .sp-vis-btn svg {
        width: 13px;
        height: 13px;
        stroke: currentColor;
      }
      .sp-mesh-info-wrapper {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
      }
      .sp-mesh-name {
        font-size: 12px;
        font-weight: 500;
        color: #e5e5e5;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color 0.15s ease;
      }
      .sp-outliner-row.sp-row--selected .sp-mesh-name {
        color: #fff;
      }
      .sp-mesh-meta {
        font-size: 9px;
        color: #777;
        margin-top: 1px;
      }
      .sp-rename-input {
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid var(--color-accent);
        border-radius: 4px;
        color: #fff;
        font-size: 12px;
        padding: 2px 4px;
        outline: none;
        width: 100%;
        box-sizing: border-box;
      }
      .sp-outliner-actions {
        display: flex;
        gap: 6px;
        margin-top: 8px;
        margin-bottom: 12px;
      }
      .sp-act-btn {
        flex: 1;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        color: #ccc;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .sp-act-btn svg {
        width: 14px;
        height: 14px;
        stroke-width: 2px;
      }
      .sp-act-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.16);
        color: #fff;
      }
      .sp-act-btn:active:not(:disabled) {
        background: rgba(255, 255, 255, 0.12);
        transform: scale(0.97);
      }
      .sp-act-btn:disabled {
        opacity: 0.25;
        cursor: not-allowed;
      }
      .sp-scene-actions-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        margin-top: 6px;
        margin-bottom: 8px;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.04);
      }
      .sp-scene-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px 0;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        color: #ccc;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .sp-scene-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.16);
        color: #fff;
      }
      .sp-scene-btn:active {
        background: rgba(255, 255, 255, 0.12);
        transform: scale(0.95);
      }
      .sp-scene-btn svg {
        width: 15px;
        height: 15px;
        stroke-width: 2px;
      }
      .sp-scene-btn[data-action="clear"]:hover {
        background: rgba(230, 53, 59, 0.15);
        border-color: rgba(230, 53, 59, 0.4);
        color: #ff5c62;
      }
      .sp-scene-sep {
        width: 1px;
        height: 18px;
        background: rgba(255, 255, 255, 0.12);
        margin: 0 4px;
      }
    `;
    document.head.appendChild(styleEl);
  }
}

export default GuiScene;

