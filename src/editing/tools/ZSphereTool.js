import { vec3, mat4, quat } from 'gl-matrix';
import SculptBase from './SculptBase.js';
import ZSphereGraph from '../ZSphereGraph.js';
import ZSphereDrawable from '../../drawables/ZSphereDrawable.js';
import MeshStatic from '../../mesh/meshStatic/MeshStatic.js';
import Multimesh from '../../mesh/multiresolution/Multimesh.js';
import MarchingCubes from '../MarchingCubes.js';
import Enums from '../../misc/Enums.js';

class ZSphereTool extends SculptBase {

  constructor(main) {
    super(main);

    this._graph = new ZSphereGraph();
    this._drawable = new ZSphereDrawable(main.getGL(), this._graph);

    this._mode = 'draw'; // 'draw', 'move', 'scale', 'rotate'

    this._activeNode = null;
    this._isDragging = false;
    this._dragMode = '';
    this._screenZ = 0.0;
    this._startRadius = 1.0;
    this._startMouseX = 0.0;

    // Track keyboard states for Ctrl deletion and Alt key blocking
    this._isCtrlDown = false;
    this._isAltDown = false;

    this._onKeyDown = (e) => {
      if (e.key === 'Control') {
        this._isCtrlDown = true;
        this.clearHoverAndSelection();
      } else if (e.key === 'Alt') {
        this._isAltDown = true;
        this.clearHoverAndSelection();
      }
    };
    this._onKeyUp = (e) => {
      if (e.key === 'Control') {
        this._isCtrlDown = false;
        this.preUpdate();
        this._main.render();
      } else if (e.key === 'Alt') {
        this._isAltDown = false;
        this.preUpdate();
        this._main.render();
      }
    };

  }

  onActivate() {
    console.log('ZSphereTool activated');
    window.addEventListener('keydown', this._onKeyDown, false);
    window.addEventListener('keyup', this._onKeyUp, false);

    // Auto-create a root ZSphere at camera center if graph is empty
    if (this._graph.getNodes().length === 0) {
      console.log('Graph is empty. Creating root ZSphere at camera center');
      var camera = this._main.getCamera();
      var origin = vec3.create();
      if (camera && camera._center) {
        vec3.copy(origin, camera._center);
      }
      if (this._main.getSculptManager().getSymmetry()) {
        origin[0] = 0.0;
      }
      this._graph.addRoot(origin, 2.5);
      this._main.render();
    }
  }

  onDeactivate() {
    console.log('ZSphereTool deactivated');
    window.removeEventListener('keydown', this._onKeyDown, false);
    window.removeEventListener('keyup', this._onKeyUp, false);
    this._isCtrlDown = false;
    this._isAltDown = false;
    this._graph._selected = null;
    this._graph._hoveredLink = null;
    this._graph._previewNode = null;
  }

  clearHoverAndSelection() {
    var changed = false;
    if (this._graph._hoveredLink || this._graph._previewNode) {
      this._graph._hoveredLink = null;
      this._graph._previewNode = null;
      changed = true;
    }
    if (this._graph._selected) {
      this._graph._selected = null;
      changed = true;
    }
    if (changed) {
      this._main.render();
    }
  }

  // Intersect ray with a sphere
  intersectRaySphere(rayOrigin, rayDir, center, radius) {
    var w = vec3.create();
    vec3.sub(w, rayOrigin, center);
    var b = vec3.dot(w, rayDir);
    var c = vec3.dot(w, w) - radius * radius;
    var disc = b * b - c;
    if (disc < 0) return -1;
    var t = -b - Math.sqrt(disc);
    if (t < 0) {
      t = -b + Math.sqrt(disc);
    }
    return t >= 0 ? t : -1;
  }

  // Intersect ray with a link cylinder
  intersectLink(rayOrigin, rayDir, parent, child) {
    var A = parent.position;
    var B = child.position;
    var rA = parent.radius;
    var rB = child.radius;

    var V = vec3.create();
    vec3.sub(V, B, A);
    var U = vec3.create();
    vec3.sub(U, rayOrigin, A);

    var b = vec3.dot(rayDir, V);
    var c = vec3.dot(V, V);
    if (c < 1e-6) return null;

    var d = vec3.dot(rayDir, U);
    var e = vec3.dot(V, U);
    var det = c - b * b;

    var t, u;
    if (Math.abs(det) < 1e-6) {
      u = 0.5;
      t = u * b - d;
    } else {
      t = (b * e - c * d) / det;
      u = (e - b * d) / det;
    }

    if (u < 0.0) {
      u = 0.0;
      t = -d;
    } else if (u > 1.0) {
      u = 1.0;
      t = b - d;
    }

    if (t < 0.0) t = 0.0;

    var P_ray = vec3.create();
    vec3.scaleAndAdd(P_ray, rayOrigin, rayDir, t);
    var P_seg = vec3.create();
    vec3.scaleAndAdd(P_seg, A, V, u);

    var dist = vec3.dist(P_ray, P_seg);
    var r_u = rA + u * (rB - rA);

    // If ray is close enough to the cylinder axis
    if (dist < r_u * 1.5) {
      return { t: t, u: u, position: P_seg, radius: r_u };
    }
    return null;
  }

  // Perform hit testing against ZSphere nodes and links
  hitTest(rayOrigin, rayDir) {
    var nodes = this._graph.getNodes();
    var closestNode = null;
    var closestLink = null;
    var minDist = Infinity;

    // 1. Check nodes
    for (var i = 0; i < nodes.length; ++i) {
      var node = nodes[i];
      var t = this.intersectRaySphere(rayOrigin, rayDir, node.position, node.radius);
      if (t >= 0 && t < minDist) {
        minDist = t;
        closestNode = node;
      }
    }

    // 2. Check links (only in draw mode, to avoid blocking node interaction in move/scale)
    if (this._mode === 'draw') {
      for (var i = 0; i < nodes.length; ++i) {
        var child = nodes[i];
        var parent = child.parent;
        if (!parent) continue;

        var res = this.intersectLink(rayOrigin, rayDir, parent, child);
        if (res && res.t >= 0 && res.t < minDist) {
          minDist = res.t;
          closestLink = { parent: parent, child: child, u: res.u, position: res.position, radius: res.radius };
          closestNode = null; // Link is closer
        }
      }
    }

    if (closestNode) {
      return { node: closestNode, t: minDist, type: 'node' };
    }

    if (closestLink) {
      return { link: closestLink, t: minDist, type: 'link' };
    }

    return null;
  }

  preUpdate() {
    var main = this._main;
    var isAlt = this._isAltDown || main._isAltDown;
    var isCtrl = this._isCtrlDown || main._isCtrlDown;
    // Do not hover/select or show preview if a camera/mask action is active OR if deletion/Alt keys are active
    if ((main._action !== Enums.Action.NOTHING && main._action !== Enums.Action.SCULPT_EDIT) || isCtrl || isAlt) {
      this._graph._selected = null;
      this._graph._hoveredLink = null;
      this._graph._previewNode = null;
      return;
    }

    if (this._isDragging && this._activeNode) {
      this._graph._selected = this._activeNode;
      this._graph._hoveredLink = null;
      this._graph._previewNode = null;
      main.setCanvasCursor('default');
      return;
    }

    var camera = main.getCamera();
    var mouseX = main._mouseX;
    var mouseY = main._mouseY;

    var vNear = camera.unproject(mouseX, mouseY, 0.0);
    var vFar = camera.unproject(mouseX, mouseY, 0.1);
    var rayDir = vec3.create();
    vec3.sub(rayDir, vFar, vNear);
    vec3.normalize(rayDir, rayDir);
    var rayOrigin = vNear;

    var hit = this.hitTest(rayOrigin, rayDir);
    if (hit) {
      if (hit.type === 'node') {
        this._graph._selected = hit.node;
        this._graph._hoveredLink = null;
        this._graph._previewNode = null;
      } else if (hit.type === 'link') {
        if (isCtrl) {
          this._graph._selected = null;
          this._graph._hoveredLink = null;
          this._graph._previewNode = null;
        } else {
          this._graph._selected = null;
          this._graph._hoveredLink = { parent: hit.link.parent, child: hit.link.child };
          this._graph._previewNode = { position: hit.link.position, radius: hit.link.radius };
        }
      }
    } else {
      this._graph._selected = null;
      this._graph._hoveredLink = null;
      this._graph._previewNode = null;
    }
    main.setCanvasCursor('default');
  }

  start(ctrl) {
    var main = this._main;
    var camera = main.getCamera();
    var mouseX = main._mouseX;
    var mouseY = main._mouseY;

    // Get ray in world space
    var vNear = camera.unproject(mouseX, mouseY, 0.0);
    var vFar = camera.unproject(mouseX, mouseY, 0.1);
    var rayDir = vec3.create();
    vec3.sub(rayDir, vFar, vNear);
    vec3.normalize(rayDir, rayDir);
    var rayOrigin = vNear;

    var hit = this.hitTest(rayOrigin, rayDir);

    // Do not perform actions if Alt is down (prevents creation/manipulation during navigation)
    var isAlt = this._isAltDown || main._isAltDown;
    var isCtrl = this._isCtrlDown || main._isCtrlDown;
    if (isAlt) {
      return false;
    }

    // Delete node on Ctrl-click
    if (isCtrl) {
      if (hit && hit.type === 'node') {
        if (hit.node.symmetryPartner) {
          var partner = hit.node.symmetryPartner;
          hit.node.symmetryPartner = null;
          partner.symmetryPartner = null;
          this._graph.removeNode(partner);
        }
        this._graph.removeNode(hit.node);
        this._graph._selected = null;
        main.render();
      }
      return false;
    }

    var isSym = main.getSculptManager().getSymmetry();

    if (this._mode === 'draw') {
      if (this._graph.getNodes().length === 0) {
        // Create root node
        var hitPoint = vec3.create();
        var hitMesh = main.getPicking().intersectionMouseMeshes();
        if (hitMesh) {
          vec3.copy(hitPoint, main.getPicking().getIntersectionPoint());
        } else {
          // Fallback to camera view plane intersection at origin
          var camPos = camera.computePosition();
          var camDir = vec3.create();
          vec3.sub(camDir, camera._center, camPos);
          vec3.normalize(camDir, camDir);
          var dot = vec3.dot(rayDir, camDir);
          if (Math.abs(dot) > 1e-4) {
            var t = -vec3.dot(rayOrigin, camDir) / dot;
            vec3.scaleAndAdd(hitPoint, rayOrigin, rayDir, t);
          } else {
            vec3.scaleAndAdd(hitPoint, rayOrigin, rayDir, 10.0);
          }
        }
        if (isSym) {
          hitPoint[0] = 0.0;
        }
        this._graph.addRoot(hitPoint, 2.5);
        main.render();
        return true;
      }

      if (hit) {
        if (hit.type === 'node') {
          // Create child ZSphere
          var parent = hit.node;
          var child = this._graph.addChild(parent, parent.position, parent.radius);

          if (isSym && parent.symmetryPartner && parent.symmetryPartner !== parent) {
            var partnerChild = this._graph.addChild(parent.symmetryPartner, parent.symmetryPartner.position, parent.symmetryPartner.radius);
            child.symmetryPartner = partnerChild;
            partnerChild.symmetryPartner = child;
          }

          this._activeNode = child;
          this._isDragging = true;
          this._dragMode = 'draw';
          main.render();
          return true;
        } else if (hit.type === 'link') {
          // Insert ZSphere on link (split link)
          var parent = hit.link.parent;
          var child = hit.link.child;
          var newNode = this._graph.addChild(parent, hit.link.position, hit.link.radius);

          // Rewire parent-child link
          var idx = parent.children.indexOf(child);
          if (idx !== -1) {
            parent.children.splice(idx, 1);
          }
          child.parent = newNode;
          newNode.children.push(child);

          if (isSym && parent.symmetryPartner && child.symmetryPartner) {
            var partnerParent = parent.symmetryPartner;
            var partnerChild = child.symmetryPartner;

            var symPos = vec3.fromValues(-hit.link.position[0], hit.link.position[1], hit.link.position[2]);
            var partnerNewNode = this._graph.addChild(partnerParent, symPos, hit.link.radius);

            var pIdx = partnerParent.children.indexOf(partnerChild);
            if (pIdx !== -1) {
              partnerParent.children.splice(pIdx, 1);
            }
            partnerChild.parent = partnerNewNode;
            partnerNewNode.children.push(partnerChild);

            newNode.symmetryPartner = partnerNewNode;
            partnerNewNode.symmetryPartner = newNode;
          }

          this._activeNode = newNode;
          this._isDragging = true;
          this._dragMode = 'scale'; // Immediately drag to scale the new node
          this._startRadius = newNode.radius;
          this._startMouseX = mouseX;
          main.render();
          return true;
        }
      }
    } else if (this._mode === 'move') {
      if (hit && hit.type === 'node') {
        this._activeNode = hit.node;
        this._isDragging = true;
        this._dragMode = 'move';
        this._screenZ = camera.project(hit.node.position)[2];
        return true;
      }
    } else if (this._mode === 'scale') {
      if (hit && hit.type === 'node') {
        this._activeNode = hit.node;
        this._isDragging = true;
        this._dragMode = 'scale';
        this._startRadius = hit.node.radius;
        this._startMouseX = mouseX;
        return true;
      }
    } else if (this._mode === 'rotate') {
      if (hit && hit.type === 'node') {
        this._activeNode = hit.node;
        this._isDragging = true;
        this._dragMode = 'rotate';
        this._startMouseX = mouseX;
        this._startMouseY = mouseY;

        // Collect descendants and store their initial positions
        this._initialPositions = new Map();
        var descendants = this._getDescendants(this._activeNode);
        for (var i = 0; i < descendants.length; ++i) {
          var d = descendants[i];
          this._initialPositions.set(d.id, vec3.clone(d.position));
        }

        if (this._activeNode.symmetryPartner) {
          var partnerDescendants = this._getDescendants(this._activeNode.symmetryPartner);
          for (var i = 0; i < partnerDescendants.length; ++i) {
            var d = partnerDescendants[i];
            this._initialPositions.set(d.id, vec3.clone(d.position));
          }
        }
        return true;
      }
    }

    return false;
  }

  update() {
    if (!this._isDragging || !this._activeNode) return;

    var main = this._main;
    var camera = main.getCamera();
    var mouseX = main._mouseX;
    var mouseY = main._mouseY;
    var isSym = main.getSculptManager().getSymmetry();

    if (this._dragMode === 'draw') {
      var parent = this._activeNode.parent;
      if (parent) {
        var screenParent = camera.project(parent.position);
        var worldPos = camera.unproject(mouseX, mouseY, screenParent[2]);
        vec3.copy(this._activeNode.position, worldPos);
        this._activeNode.radius = parent.radius;

        if (isSym) {
          // If active node has no partner and we dragged off-center, spawn partner
          if (!this._activeNode.symmetryPartner) {
            if (Math.abs(this._activeNode.position[0]) > 0.08) {
              var partnerParent = parent.symmetryPartner || parent;
              var symPos = vec3.fromValues(-this._activeNode.position[0], this._activeNode.position[1], this._activeNode.position[2]);
              var partnerChild = this._graph.addChild(partnerParent, symPos, this._activeNode.radius);
              this._activeNode.symmetryPartner = partnerChild;
              partnerChild.symmetryPartner = this._activeNode;
            } else {
              this._activeNode.position[0] = 0.0;
            }
          } else {
            // Active node already has a partner
            if (Math.abs(this._activeNode.position[0]) <= 0.08) {
              // Dragged back to center, delete partner and snap to center
              var partner = this._activeNode.symmetryPartner;
              this._activeNode.symmetryPartner = null;
              partner.symmetryPartner = null;
              this._graph.removeNode(partner);
              this._activeNode.position[0] = 0.0;
            } else {
              // Update partner position/radius symmetrically
              var partner = this._activeNode.symmetryPartner;
              partner.position[0] = -this._activeNode.position[0];
              partner.position[1] = this._activeNode.position[1];
              partner.position[2] = this._activeNode.position[2];
              partner.radius = this._activeNode.radius;
            }
          }
        }
      }
    } else if (this._dragMode === 'move') {
      var worldPos = camera.unproject(mouseX, mouseY, this._screenZ);
      vec3.copy(this._activeNode.position, worldPos);

      if (isSym) {
        if (this._activeNode.symmetryPartner) {
          var partner = this._activeNode.symmetryPartner;
          partner.position[0] = -this._activeNode.position[0];
          partner.position[1] = this._activeNode.position[1];
          partner.position[2] = this._activeNode.position[2];
        } else {
          this._activeNode.position[0] = 0.0;
        }
      }
    } else if (this._dragMode === 'scale') {
      var dx = mouseX - this._startMouseX;
      this._activeNode.radius = Math.max(0.05, this._startRadius + dx * 0.01);

      if (isSym && this._activeNode.symmetryPartner) {
        this._activeNode.symmetryPartner.radius = this._activeNode.radius;
      }
    } else if (this._dragMode === 'rotate') {
      var dx = mouseX - this._startMouseX;
      var dy = mouseY - this._startMouseY;

      var invView = mat4.create();
      mat4.invert(invView, camera.getView());
      var camRight = vec3.fromValues(invView[0], invView[1], invView[2]);
      var camUp = vec3.fromValues(invView[4], invView[5], invView[6]);

      // Create rotation quaternion
      var angleX = dx * 0.005;
      var angleY = dy * 0.005;
      var qX = quat.create();
      quat.setAxisAngle(qX, camUp, angleX);
      var qY = quat.create();
      quat.setAxisAngle(qY, camRight, angleY);
      var q = quat.create();
      quat.mul(q, qX, qY);

      // Rotate descendants around the active node's position
      var descendants = this._getDescendants(this._activeNode);
      var relPos = vec3.create();
      for (var i = 0; i < descendants.length; ++i) {
        var d = descendants[i];
        var initPos = this._initialPositions.get(d.id);
        if (initPos) {
          vec3.sub(relPos, initPos, this._activeNode.position);
          vec3.transformQuat(relPos, relPos, q);
          vec3.add(d.position, this._activeNode.position, relPos);
        }
      }

      if (isSym && this._activeNode.symmetryPartner) {
        var partnerNode = this._activeNode.symmetryPartner;
        var qSym = quat.fromValues(q[0], -q[1], -q[2], q[3]);
        var partnerDescendants = this._getDescendants(partnerNode);
        for (var i = 0; i < partnerDescendants.length; ++i) {
          var d = partnerDescendants[i];
          var initPos = this._initialPositions.get(d.id);
          if (initPos) {
            vec3.sub(relPos, initPos, partnerNode.position);
            vec3.transformQuat(relPos, relPos, qSym);
            vec3.add(d.position, partnerNode.position, relPos);
          }
        }
      }
    }

    main.render();
  }

  end() {
    if ((this._dragMode === 'draw' || this._dragMode === 'move') && this._activeNode) {
      var nodes = this._graph.getNodes();
      var minNode = null;
      var minDist = Infinity;
      for (var i = 0; i < nodes.length; ++i) {
        var n = nodes[i];
        if (n === this._activeNode) continue;
        var d = vec3.dist(this._activeNode.position, n.position);
        if (d < minDist) {
          minDist = d;
          minNode = n;
        }
      }

      if (minNode) {
        var threshold = 0.3 * (this._activeNode.radius + minNode.radius);
        if (minDist < threshold) {
          if (this._activeNode.symmetryPartner && minNode.symmetryPartner) {
            this._graph.mergeNodes(this._activeNode.symmetryPartner, minNode.symmetryPartner);
          }
          this._graph.mergeNodes(this._activeNode, minNode);
          this._main.render();
        }
      }
    }
    this._isDragging = false;
    this._activeNode = null;
    this._dragMode = '';
  }

  createMesh() {
    var nodes = this._graph.getNodes();
    if (nodes.length === 0) return;

    // 1. Calculate bounding box of all nodes
    var bbox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    var maxRadius = 0.0;
    for (var i = 0; i < nodes.length; ++i) {
      var pos = nodes[i].position;
      var r = nodes[i].radius;
      if (r > maxRadius) maxRadius = r;
      if (pos[0] - r < bbox[0]) bbox[0] = pos[0] - r;
      if (pos[1] - r < bbox[1]) bbox[1] = pos[1] - r;
      if (pos[2] - r < bbox[2]) bbox[2] = pos[2] - r;
      if (pos[0] + r > bbox[3]) bbox[3] = pos[0] + r;
      if (pos[1] + r > bbox[4]) bbox[4] = pos[1] + r;
      if (pos[2] + r > bbox[5]) bbox[5] = pos[2] + r;
    }

    var padding = maxRadius * 2.0;
    var minCoords = [bbox[0] - padding, bbox[1] - padding, bbox[2] - padding];
    var maxCoords = [bbox[3] + padding, bbox[4] + padding, bbox[5] + padding];

    // 2. Evaluate Signed Distance Field
    var resolution = 64;
    var total = resolution * resolution * resolution;
    var distanceField = new Float32Array(total);

    var stepX = (maxCoords[0] - minCoords[0]) / (resolution - 1);
    var stepY = (maxCoords[1] - minCoords[1]) / (resolution - 1);
    var stepZ = (maxCoords[2] - minCoords[2]) / (resolution - 1);

    var P = vec3.create();
    var index = 0;

    // Smooth minimum helper
    var smin = function(a, b, k) {
      var h = Math.max(k - Math.abs(a - b), 0.0) / k;
      return Math.min(a, b) - h * h * h * k * (1.0 / 6.0);
    };

    var evalSDF = function(graph, pt) {
      var nds = graph.getNodes();
      if (nds.length === 0) return 1.0;
      var minDist = Infinity;
      var k = 0.5; // Blend factor

      // Sphere nodes
      for (var i = 0; i < nds.length; ++i) {
        var n = nds[i];
        var d = vec3.dist(pt, n.position) - n.radius;
        if (minDist === Infinity) minDist = d;
        else minDist = smin(minDist, d, k);
      }

      // Link segments
      var A = vec3.create();
      var B = vec3.create();
      var V = vec3.create();
      var W = vec3.create();
      var proj = vec3.create();
      for (var i = 0; i < nds.length; ++i) {
        var child = nds[i];
        var parent = child.parent;
        if (!parent) continue;

        vec3.copy(A, parent.position);
        vec3.copy(B, child.position);
        var rA = parent.radius;
        var rB = child.radius;

        vec3.sub(V, B, A);
        var lenV = vec3.length(V);
        if (lenV < 1e-4) continue;
        vec3.sub(W, pt, A);

        var t = vec3.dot(W, V) / (lenV * lenV);
        t = Math.max(0.0, Math.min(1.0, t));

        vec3.scaleAndAdd(proj, A, V, t);
        var r_t = rA + t * (rB - rA);
        var d = vec3.dist(pt, proj) - r_t;
        minDist = smin(minDist, d, k);
      }
      return minDist;
    };

    for (var gz = 0; gz < resolution; ++gz) {
      var z = minCoords[2] + gz * stepZ;
      for (var gy = 0; gy < resolution; ++gy) {
        var y = minCoords[1] + gy * stepY;
        for (var gx = 0; gx < resolution; ++gx) {
          var x = minCoords[0] + gx * stepX;
          P[0] = x; P[1] = y; P[2] = z;
          distanceField[index++] = evalSDF(this._graph, P);
        }
      }
    }

    // 3. Reconstruct surface using Marching Cubes
    var voxels = {
      dims: [resolution, resolution, resolution],
      distanceField: distanceField,
      uniformColor: [0.8, 0.5, 0.2],
      uniformMaterial: [0.5, 0.0, 0.0]
    };

    var meshData = MarchingCubes.computeSurface(voxels);

    // Transform vertices back to world coords
    var vertices = meshData.vertices;
    for (var i = 0; i < vertices.length; i += 3) {
      vertices[i] = minCoords[0] + vertices[i] * stepX;
      vertices[i + 1] = minCoords[1] + vertices[i + 1] * stepY;
      vertices[i + 2] = minCoords[2] + vertices[i + 2] * stepZ;
    }

    // Create a MeshStatic object
    var gl = this._main.getGL();
    var newMesh = new MeshStatic(gl);
    newMesh.setVertices(vertices);
    newMesh.setFaces(meshData.faces);
    if (meshData.colors.length > 0) newMesh.setColors(meshData.colors);
    if (meshData.materials.length > 0) newMesh.setMaterials(meshData.materials);

    newMesh.initColorsAndMaterials();
    newMesh.allocateArrays();
    newMesh.initTopology();
    newMesh.updateGeometry();
    newMesh.updateDuplicateColorsAndMaterials();

    // Wrap in Multimesh and add to scene
    var multimesh = new Multimesh(newMesh);
    multimesh.initRender();

    var activeMesh = this._main.getMesh() || (this._main.getMeshes().length > 0 ? this._main.getMeshes()[0] : null);
    if (activeMesh) {
      multimesh.copyRenderConfig(activeMesh);
    }

    this._main.addNewMesh(multimesh);
    this._main.render();
  }

  clearGraph() {
    this._graph.clear();
    this._main.render();
  }

  addRootSphere() {
    var camera = this._main.getCamera();
    var origin = vec3.create();
    if (camera && camera._center) {
      vec3.copy(origin, camera._center);
    }
    if (this._main.getSculptManager().getSymmetry()) {
      origin[0] = 0.0;
    }
    this._graph.addRoot(origin, 2.5);
    this._main.render();
  }

  addSculptToScene(scene) {
    if (this._drawable) {
      scene.push(this._drawable);
    }
    return scene;
  }
  _getDescendants(node, list) {
    list = list || [];
    for (var i = 0; i < node.children.length; ++i) {
      var child = node.children[i];
      list.push(child);
      this._getDescendants(child, list);
    }
    return list;
  }
}

export default ZSphereTool;
