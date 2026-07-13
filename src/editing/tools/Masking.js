import { vec3, mat3, mat4 } from 'gl-matrix';
import Geometry from '../../math3d/Geometry.js';
import Utils from '../../misc/Utils.js';
import SculptBase from './SculptBase.js';
import Paint from './Paint.js';
import Smooth from './Smooth.js';
import MeshStatic from '../../mesh/meshStatic/MeshStatic.js';

class Masking extends SculptBase {

  constructor(main) {
    super(main);

    this._radius = 50;
    this._hardness = 0.25;
    this._intensity = 1.0;
    this._negative = true;
    this._culling = false;
    this._idAlpha = 0;
    this._lockPosition = false;

    this._thickness = 1.0;
    this._lassoPoints = [];
    this._svg = null;
    this._svgPath = null;
    this._useLasso = false;
  }

  pushState() {
    // too lazy to add a pushStateMaterial
    this._main.getStateManager().pushStateColorAndMaterial(this.getMesh());
  }

  updateMeshBuffers() {
    var mesh = this.getMesh();
    if (mesh.isDynamic)
      mesh.updateBuffers();
    else
      mesh.updateMaterialBuffer();
  }

  stroke(picking) {
    Paint.prototype.stroke.call(this, picking);
  }

  dynamicTopology(picking) {
    // no dynamic topo with masking
    return picking.getPickedVertices();
  }

  /** Paint color vertices */
  paint(iVerts, center, radiusSquared, intensity, hardness, picking) {
    var mesh = this.getMesh();
    var vAr = mesh.getVertices();
    var mAr = mesh.getMaterials();
    var radius = Math.sqrt(radiusSquared);
    var cx = center[0];
    var cy = center[1];
    var cz = center[2];
    var softness = 2 * (1 - hardness);
    var maskIntensity = this._negative ? -intensity : intensity;
    for (var i = 0, l = iVerts.length; i < l; ++i) {
      var ind = iVerts[i] * 3;
      var vx = vAr[ind];
      var vy = vAr[ind + 1];
      var vz = vAr[ind + 2];
      var dx = vx - cx;
      var dy = vy - cy;
      var dz = vz - cz;
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
      if (dist > 1) dist = 1.0;

      var fallOff = Math.pow(1.0 - dist, softness);
      fallOff *= maskIntensity * picking.getAlpha(vx, vy, vz, this._focalShiftFalloff ? this._focalShift : 0);
      mAr[ind + 2] = Math.min(Math.max(mAr[ind + 2] + fallOff, 0.0), 1.0);
    }
  }

  updateAndRenderMask() {
    var mesh = this.getMesh();
    mesh.updateDuplicateColorsAndMaterials();
    mesh.updateDrawArrays();
    this.updateRender();
  }

  blur() {
    var mesh = this.getMesh();
    var iVerts = this.getMaskedVertices();
    if (iVerts.length === 0)
      return;
    iVerts = mesh.expandsVertices(iVerts, 1);

    this.pushState();
    this._main.getStateManager().pushVertices(iVerts);

    var mAr = mesh.getMaterials();
    var nbVerts = iVerts.length;
    var smoothVerts = new Float32Array(nbVerts * 3);
    this.laplacianSmooth(iVerts, smoothVerts, mAr);
    for (var i = 0; i < nbVerts; ++i)
      mAr[iVerts[i] * 3 + 2] = smoothVerts[i * 3 + 2];
    this.updateAndRenderMask();
  }

  sharpen() {
    var mesh = this.getMesh();
    var iVerts = this.getMaskedVertices();
    if (iVerts.length === 0)
      return;

    this.pushState();
    this._main.getStateManager().pushVertices(iVerts);

    var mAr = mesh.getMaterials();
    var nbVerts = iVerts.length;
    for (var i = 0; i < nbVerts; ++i) {
      var idm = iVerts[i] * 3 + 2;
      var val = mAr[idm];
      mAr[idm] = val > 0.5 ? Math.min(val + 0.1, 1.0) : Math.max(val - 1.0, 0.0);
    }
    this.updateAndRenderMask();
  }

  clear() {
    var mesh = this.getMesh();
    var iVerts = this.getMaskedVertices();
    if (iVerts.length === 0)
      return;

    this.pushState();
    this._main.getStateManager().pushVertices(iVerts);

    var mAr = mesh.getMaterials();
    for (var i = 0, nb = iVerts.length; i < nb; ++i)
      mAr[iVerts[i] * 3 + 2] = 1.0;

    this.updateAndRenderMask();
  }

  invert(isState, meshState) {
    var mesh = meshState;
    if (!mesh) mesh = this.getMesh();
    if (!isState)
      this._main.getStateManager().pushStateCustom(this.invert.bind(this, true, mesh));

    var mAr = mesh.getMaterials();
    for (var i = 0, nb = mesh.getNbVertices(); i < nb; ++i)
      mAr[i * 3 + 2] = 1.0 - mAr[i * 3 + 2];

    this.updateAndRenderMask();
  }

  remapAndMirrorIndices(fAr, nbFaces, iVerts) {
    var nbVertices = this.getMesh().getNbVertices();
    var iTag = new Uint32Array(Utils.getMemory(nbVertices * 4), 0, nbVertices);
    var i = 0;
    var j = 0;
    var nbVerts = iVerts.length;
    for (i = 0; i < nbVerts; ++i)
      iTag[iVerts[i]] = i;

    var endFaces = nbFaces * 2;
    for (i = 0; i < endFaces; ++i) {
      j = i * 4;
      var offset = i < nbFaces ? 0 : nbVerts;
      fAr[j] = iTag[fAr[j]] + offset;
      fAr[j + 1] = iTag[fAr[j + 1]] + offset;
      fAr[j + 2] = iTag[fAr[j + 2]] + offset;
      var id4 = fAr[j + 3];
      if (id4 !== Utils.TRI_INDEX) fAr[j + 3] = iTag[id4] + offset;
    }

    var end = fAr.length / 4;
    for (i = endFaces; i < end; ++i) {
      j = i * 4;
      fAr[j] = iTag[fAr[j]];
      fAr[j + 1] = iTag[fAr[j + 1]];
      fAr[j + 2] = iTag[fAr[j + 2]] + nbVerts;
      fAr[j + 3] = iTag[fAr[j + 3]] + nbVerts;
    }
  }

  invertFaces(fAr) {
    for (var i = 0, nb = fAr.length / 4; i < nb; ++i) {
      var id = i * 4;
      var temp = fAr[id];
      fAr[id] = fAr[id + 2];
      fAr[id + 2] = temp;
    }
  }

  extractFaces(iFaces, iVerts, maskClamp) {
    var mesh = this.getMesh();
    var fAr = mesh.getFaces();
    var mAr = mesh.getMaterials();
    var eAr = mesh.getVerticesOnEdge();

    var noThick = this._thickness === 0;

    var nbFaces = iFaces.length;
    var nbNewFaces = new Uint32Array(Utils.getMemory(nbFaces * 4 * 4 * 3), 0, nbFaces * 4 * 3);
    var offsetFLink = noThick ? nbFaces : nbFaces * 2;
    for (var i = 0; i < nbFaces; ++i) {
      var idf = i * 4;
      var idOld = iFaces[i] * 4;
      var iv1 = nbNewFaces[idf] = fAr[idOld];
      var iv2 = nbNewFaces[idf + 1] = fAr[idOld + 1];
      var iv3 = nbNewFaces[idf + 2] = fAr[idOld + 2];
      var iv4 = nbNewFaces[idf + 3] = fAr[idOld + 3];
      if (noThick)
        continue;
      var isQuad = iv4 !== Utils.TRI_INDEX;

      var b1 = mAr[iv1 * 3 + 2] >= maskClamp || eAr[iv1] >= 1;
      var b2 = mAr[iv2 * 3 + 2] >= maskClamp || eAr[iv2] >= 1;
      var b3 = mAr[iv3 * 3 + 2] >= maskClamp || eAr[iv3] >= 1;
      var b4 = isQuad ? mAr[iv4 * 3 + 2] >= maskClamp || eAr[iv4] >= 1 : false;

      // create opposite face (layer), invert clockwise
      // quad =>
      // 1 2    3 2
      // 4 3    4 1
      // tri => 
      // 1 2    3 2
      //  3      1

      idf += nbFaces * 4;
      nbNewFaces[idf] = iv3;
      nbNewFaces[idf + 1] = iv2;
      nbNewFaces[idf + 2] = iv1;
      nbNewFaces[idf + 3] = iv4;

      // create bridges faces
      if (b2) {
        if (b1) {
          idf = 4 * (offsetFLink++);
          nbNewFaces[idf] = nbNewFaces[idf + 3] = iv2;
          nbNewFaces[idf + 1] = nbNewFaces[idf + 2] = iv1;
        }
        if (b3) {
          idf = 4 * (offsetFLink++);
          nbNewFaces[idf] = nbNewFaces[idf + 3] = iv3;
          nbNewFaces[idf + 1] = nbNewFaces[idf + 2] = iv2;
        }
      }
      if (isQuad) {
        if (b4) {
          if (b1) {
            idf = 4 * (offsetFLink++);
            nbNewFaces[idf] = nbNewFaces[idf + 3] = iv1;
            nbNewFaces[idf + 1] = nbNewFaces[idf + 2] = iv4;
          }
          if (b3) {
            idf = 4 * (offsetFLink++);
            nbNewFaces[idf] = nbNewFaces[idf + 3] = iv4;
            nbNewFaces[idf + 1] = nbNewFaces[idf + 2] = iv3;
          }
        }
      } else {
        if (b1 && b3) {
          idf = 4 * (offsetFLink++);
          nbNewFaces[idf] = nbNewFaces[idf + 3] = iv1;
          nbNewFaces[idf + 1] = nbNewFaces[idf + 2] = iv3;
        }
      }
    }

    var fArNew = new Uint32Array(nbNewFaces.subarray(0, offsetFLink * 4));
    this.remapAndMirrorIndices(fArNew, nbFaces, iVerts);
    if (this._thickness > 0)
      this.invertFaces(fArNew);
    return fArNew;
  }

  extractVertices(iVerts) {
    var mesh = this.getMesh();

    var vAr = mesh.getVertices();
    var nAr = mesh.getNormals();
    var mat = mesh.getMatrix();
    var nMat = mat3.normalFromMat4(mat3.create(), mat);
    var nbVerts = iVerts.length;
    var vArNew = new Float32Array(nbVerts * 2 * 3);
    var vTemp = [0.0, 0.0, 0.0];
    var nTemp = [0.0, 0.0, 0.0];
    var vOffset = nbVerts * 3;
    var thick = this._thickness;
    var eps = 0.01;
    if (thick < 0) eps = -eps;
    for (var i = 0; i < nbVerts; ++i) {
      var idv = i * 3;
      var idvOld = iVerts[i] * 3;
      vTemp[0] = vAr[idvOld];
      vTemp[1] = vAr[idvOld + 1];
      vTemp[2] = vAr[idvOld + 2];
      nTemp[0] = nAr[idvOld];
      nTemp[1] = nAr[idvOld + 1];
      nTemp[2] = nAr[idvOld + 2];
      vec3.transformMat3(nTemp, nTemp, nMat);
      vec3.normalize(nTemp, nTemp);

      vec3.transformMat4(vTemp, vTemp, mat);
      vec3.scaleAndAdd(vTemp, vTemp, nTemp, eps);
      vArNew[idv] = vTemp[0];
      vArNew[idv + 1] = vTemp[1];
      vArNew[idv + 2] = vTemp[2];

      vec3.scaleAndAdd(vTemp, vTemp, nTemp, thick);
      idv += vOffset;
      vArNew[idv] = vTemp[0];
      vArNew[idv + 1] = vTemp[1];
      vArNew[idv + 2] = vTemp[2];
    }
    return vArNew;
  }

  smoothBorder(mesh, iFaces) {
    var startBridge = iFaces.length * 2;
    var fBridge = new Uint32Array(mesh.getNbFaces() - startBridge);
    for (var i = 0, nbBridge = fBridge.length; i < nbBridge; ++i)
      fBridge[i] = startBridge + i;
    var vBridge = mesh.expandsVertices(mesh.getVerticesFromFaces(fBridge), 1);
    var smo = new Smooth();
    smo.setToolMesh(mesh);
    smo.smooth(vBridge, 1.0);
    smo.smooth(vBridge, 1.0);
    smo.smooth(vBridge, 1.0);
  }

  extract() {
    var mesh = this.getMesh();
    var maskClamp = 0.5;

    var iVerts = this.filterMaskedVertices(-Infinity, maskClamp);
    if (iVerts.length === 0)
      return;
    var iFaces = mesh.getFacesFromVertices(iVerts);
    iVerts = mesh.getVerticesFromFaces(iFaces);

    var fArNew = this.extractFaces(iFaces, iVerts, maskClamp);
    var vArNew = this.extractVertices(iVerts);

    var newMesh = new MeshStatic(mesh.getGL());
    newMesh.setVertices(vArNew);
    newMesh.setFaces(fArNew);

    // we don't use newMesh.init because we want to smooth
    // the border (we want to avoid an update octree/normal/etc...)
    newMesh.initColorsAndMaterials();
    newMesh.allocateArrays();
    newMesh.initTopology();
    if (this._thickness !== 0.0)
      this.smoothBorder(newMesh, iFaces);
    newMesh.updateGeometry();
    newMesh.updateDuplicateColorsAndMaterials();

    newMesh.copyRenderConfig(mesh);
    newMesh.initRender();

    var main = this._main;
    main.addNewMesh(newMesh);
    main.setMesh(mesh);
  }

  startLasso(mouseX, mouseY, isAlt) {
    this._lassoPoints = [[mouseX, mouseY]];
    this.createLassoOverlay(isAlt);
    this.updateLassoOverlay();
  }

  addLassoPoint(mouseX, mouseY, isAlt) {
    if (!this._lassoPoints) {
      this._lassoPoints = [];
    }
    var len = this._lassoPoints.length;
    if (len > 0) {
      var last = this._lassoPoints[len - 1];
      if (last[0] === mouseX && last[1] === mouseY) return;
    }
    this._lassoPoints.push([mouseX, mouseY]);
    this.updateLassoColor(isAlt);
    this.updateLassoOverlay();
  }

  endLasso(altKey) {
    if (!this._lassoPoints || this._lassoPoints.length < 3) {
      this._lassoPoints = [];
      return false;
    }
    var result = this.applyLasso(this._lassoPoints, altKey);
    this._lassoPoints = [];
    return result;
  }

  createLassoOverlay(isAlt) {
    if (this._svg) return;
    var viewport = this._main.getViewport();
    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svg.setAttribute('id', 'lasso-overlay');
    this._svg.style.position = 'absolute';
    this._svg.style.top = '0';

    var halfW = Math.floor(this._main._canvasWidth / 2);
    var pixelRatio = this._main.getPixelRatio() || 1.0;

    if (this._main._splitMode && this._main._activeViewport === 1) {
      this._svg.style.left = (halfW / pixelRatio) + 'px';
      this._svg.style.width = (halfW / pixelRatio) + 'px';
    } else if (this._main._splitMode) {
      this._svg.style.left = '0';
      this._svg.style.width = (halfW / pixelRatio) + 'px';
    } else {
      this._svg.style.left = '0';
      this._svg.style.width = '100%';
    }

    this._svg.style.height = '100%';
    this._svg.style.pointerEvents = 'none';
    this._svg.style.zIndex = '101';
    viewport.appendChild(this._svg);

    this._svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    this._svgPath.setAttribute('stroke-width', '1.5');
    this._svgPath.setAttribute('stroke-dasharray', '4,3');
    this._svg.appendChild(this._svgPath);

    this.updateLassoColor(isAlt);

    this._onLassoKeyDown = (e) => {
      if (e.key === 'Alt') {
        this.updateLassoColor(true);
      }
    };
    this._onLassoKeyUp = (e) => {
      if (e.key === 'Alt') {
        this.updateLassoColor(false);
      }
    };
    window.addEventListener('keydown', this._onLassoKeyDown);
    window.addEventListener('keyup', this._onLassoKeyUp);
  }

  updateLassoColor(isAlt) {
    if (!this._svgPath) return;
    if (isAlt) {
      this._svgPath.setAttribute('stroke', '#FFFFFF');
      this._svgPath.setAttribute('fill', 'rgba(255, 255, 255, 0.15)');
    } else {
      this._svgPath.setAttribute('stroke', '#00E5FF');
      this._svgPath.setAttribute('fill', 'rgba(0, 229, 255, 0.15)');
    }
  }

  updateLassoOverlay() {
    if (!this._svgPath) return;
    var pixelRatio = this._main.getPixelRatio();
    var pointsStr = this._lassoPoints.map(p => {
      return (p[0] / pixelRatio) + ',' + (p[1] / pixelRatio);
    }).join(' ');
    this._svgPath.setAttribute('points', pointsStr);
  }

  destroyLassoOverlay() {
    if (this._svg) {
      if (this._svg.parentNode) {
        this._svg.parentNode.removeChild(this._svg);
      }
      this._svg = null;
      this._svgPath = null;
    }
    if (this._onLassoKeyDown) {
      window.removeEventListener('keydown', this._onLassoKeyDown);
      this._onLassoKeyDown = null;
    }
    if (this._onLassoKeyUp) {
      window.removeEventListener('keyup', this._onLassoKeyUp);
      this._onLassoKeyUp = null;
    }
  }

  isPointInPolygon(p, polygon) {
    var x = p[0], y = p[1];
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      var xi = polygon[i][0], yi = polygon[i][1];
      var xj = polygon[j][0], yj = polygon[j][1];

      var intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  applyLasso(points, altKey) {
    var mesh = this.getMesh();
    if (!mesh) return false;

    var vAr = mesh.getVertices();
    var nbVertices = mesh.getNbVertices();
    var camera = this._main.getCamera();
    var mat = mesh.getMatrix();

    var localToScreen = mat4.create();
    mat4.mul(localToScreen, camera.computeWorldToScreenMatrix(), mat);

    var m = localToScreen;
    var m0 = m[0], m4 = m[4], m8 = m[8], m12 = m[12];
    var m1 = m[1], m5 = m[5], m9 = m[9], m13 = m[13];
    var m3 = m[3], m7 = m[7], m11 = m[11], m15 = m[15];
    var height = camera._height;

    var symmetry = this._main.getSculptManager().getSymmetry();
    var ptPlane, nPlane;
    if (symmetry) {
      ptPlane = mesh.getSymmetryOrigin();
      nPlane = mesh.getSymmetryNormal();
    }

    var selectedVertices = [];

    for (var i = 0; i < nbVertices; ++i) {
      var ind = i * 3;
      var vx = vAr[ind];
      var vy = vAr[ind + 1];
      var vz = vAr[ind + 2];

      var w = m3 * vx + m7 * vy + m11 * vz + m15;
      w = w || 1.0;
      var x_screen = (m0 * vx + m4 * vy + m8 * vz + m12) / w;
      var y_screen = height - (m1 * vx + m5 * vy + m9 * vz + m13) / w;

      var inside = this.isPointInPolygon([x_screen, y_screen], points);

      if (!inside && symmetry) {
        var symV = [vx, vy, vz];
        Geometry.mirrorPoint(symV, ptPlane, nPlane);
        var svx = symV[0], svy = symV[1], svz = symV[2];
        var sw = m3 * svx + m7 * svy + m11 * svz + m15;
        sw = sw || 1.0;
        x_screen = (m0 * svx + m4 * svy + m8 * svz + m12) / sw;
        y_screen = height - (m1 * svx + m5 * svy + m9 * svz + m13) / sw;
        inside = this.isPointInPolygon([x_screen, y_screen], points);
      }

      if (inside) {
        selectedVertices.push(i);
      }
    }

    if (selectedVertices.length === 0) {
      return false;
    }

    this.pushState();
    var iVerts = new Uint32Array(selectedVertices);
    this._main.getStateManager().pushVertices(iVerts);

    var mAr = mesh.getMaterials();
    var maskVal = altKey ? 1.0 : 0.0;
    for (var j = 0; j < iVerts.length; ++j) {
      mAr[iVerts[j] * 3 + 2] = maskVal;
    }

    this.updateAndRenderMask();
    return true;
  }
}

export default Masking;
