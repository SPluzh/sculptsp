import { vec3, mat3, mat4, quat } from 'gl-matrix';
import MeshStatic from '../mesh/meshStatic/MeshStatic.js';
import Primitives from './Primitives.js';
import ShaderZSphere from '../render/shaders/ShaderZSphere.js';
import ShaderLib from '../render/ShaderLib.js';
import Enums from '../misc/Enums.js';

var createSphereArray = function (radius = 1.0, widthSegments = 16, heightSegments = 12) {
  var vAr = [];
  var nAr = [];
  var fAr = [];
  for (var y = 0; y <= heightSegments; y++) {
    var v = y / heightSegments;
    var theta = v * Math.PI;
    for (var x = 0; x <= widthSegments; x++) {
      var u = x / widthSegments;
      var phi = u * Math.PI * 2;
      var xPos = radius * Math.sin(theta) * Math.cos(phi);
      var yPos = radius * Math.cos(theta);
      var zPos = radius * Math.sin(theta) * Math.sin(phi);
      vAr.push(xPos, yPos, zPos);
      var length = Math.sqrt(xPos*xPos + yPos*yPos + zPos*zPos);
      if (length === 0) length = 1.0;
      nAr.push(xPos/length, yPos/length, zPos/length);
    }
  }
  for (var y = 0; y < heightSegments; y++) {
    for (var x = 0; x < widthSegments; x++) {
      var first = (y * (widthSegments + 1)) + x;
      var second = first + widthSegments + 1;
      fAr.push(first, second, second + 1, first + 1);
    }
  }
  return {
    vertices: new Float32Array(vAr),
    normals: new Float32Array(nAr),
    faces: new Uint32Array(fAr)
  };
};

class ZSphereDrawable {
  constructor(gl, graph) {
    this._gl = gl;
    this._graph = graph;

    // Create a sphere mesh
    var sphereData = createSphereArray(1.0);
    this._sphereGeom = new MeshStatic(gl);
    this._sphereGeom.setVertices(sphereData.vertices);
    this._sphereGeom.setFaces(sphereData.faces);
    this._sphereGeom.init();
    this._sphereGeom.initRender();

    // Create a cylinder mesh (height = 2.0, radius = 1.0)
    this._cylinderGeom = Primitives.createCylinder(gl, 1.0, 1.0, 2.0, 16, 1, true, true);

    this._mvp = mat4.create();
    this._n = mat3.create();
    this._modelMatrix = mat4.create();
  }

  isVisible() {
    return true;
  }

  isTransparent() {
    return false;
  }

  getShowWireframe() {
    return false;
  }

  renderWireframe() {}
  renderFlatColor() {}

  computeWorldBound() {
    // Return a bounding box containing all spheres
    var nodes = this._graph.getNodes();
    if (nodes.length === 0) {
      return [0, 0, 0, 0, 0, 0];
    }
    var minX = Infinity, minY = Infinity, minZ = Infinity;
    var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (var i = 0; i < nodes.length; ++i) {
      var pos = nodes[i].position;
      var r = nodes[i].radius;
      if (pos[0] - r < minX) minX = pos[0] - r;
      if (pos[1] - r < minY) minY = pos[1] - r;
      if (pos[2] - r < minZ) minZ = pos[2] - r;
      if (pos[0] + r > maxX) maxX = pos[0] + r;
      if (pos[1] + r > maxY) maxY = pos[1] + r;
      if (pos[2] + r > maxZ) maxZ = pos[2] + r;
    }
    return [minX, minY, minZ, maxX, maxY, maxZ];
  }

  render(main) {
    var gl = this._gl;
    var nodes = this._graph.getNodes();
    if (nodes.length === 0) return;

    var shader = ShaderZSphere.getOrCreate(gl);
    gl.useProgram(shader.program);

    var camera = main.getCamera();

    // Bind active Matcap texture
    var ShaderMatcap = ShaderLib[Enums.Shader.MATCAP];
    var activeMatcap = 0;
    var activeMesh = main.getMesh();
    if (activeMesh && typeof activeMesh.getMatcap === 'function') {
      activeMatcap = activeMesh.getMatcap();
    }
    var matcapTex = ShaderMatcap.textures[activeMatcap] || ShaderMatcap.getDummyTexture(gl);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, matcapTex);
    gl.uniform1i(shader.uniforms.uTexture0, 0);

    // 1. Draw connection cylinders
    shader.attributes.aVertex.bindToBuffer(this._cylinderGeom.getVertexBuffer());
    shader.attributes.aNormal.bindToBuffer(this._cylinderGeom.getNormalBuffer());

    var up = vec3.fromValues(0, 1, 0);
    var dir = vec3.create();
    var midpoint = vec3.create();
    var q = quat.create();

    for (var i = 0; i < nodes.length; ++i) {
      var child = nodes[i];
      var parent = child.parent;
      if (!parent) continue;

      // Calculate direction from parent to child
      vec3.sub(dir, child.position, parent.position);
      var len = vec3.length(dir);
      if (len < 1e-4) continue;

      // Midpoint
      vec3.scaleAndAdd(midpoint, parent.position, dir, 0.5);

      // Normalize dir to find rotation
      vec3.scale(dir, dir, 1.0 / len);

      // Quat rotation from [0, 1, 0] to dir
      quat.rotationTo(q, up, dir);

      // Model matrix
      mat4.identity(this._modelMatrix);
      mat4.translate(this._modelMatrix, this._modelMatrix, midpoint);
      var mRot = mat4.create();
      mat4.fromQuat(mRot, q);
      mat4.mul(this._modelMatrix, this._modelMatrix, mRot);

      // Scale: Y is half length (since height is 2.0), X and Z are 1.0 (shader handles tapering/radius scaling)
      mat4.scale(this._modelMatrix, this._modelMatrix, [1.0, len * 0.5, 1.0]);

      // MVP
      mat4.mul(this._mvp, camera.getProjection(), camera.getView());
      mat4.mul(this._mvp, this._mvp, this._modelMatrix);
      gl.uniformMatrix4fv(shader.uniforms.uMVP, false, this._mvp);

      // Normal Matrix
      var mv = mat4.create();
      mat4.mul(mv, camera.getView(), this._modelMatrix);
      mat3.fromMat4(this._n, mv);
      mat3.invert(this._n, this._n);
      mat3.transpose(this._n, this._n);
      gl.uniformMatrix3fv(shader.uniforms.uN, false, this._n);

      gl.uniformMatrix4fv(shader.uniforms.uMV, false, mv);

      gl.uniform1f(shader.uniforms.uRadiusBottom, parent.radius);
      gl.uniform1f(shader.uniforms.uRadiusTop, child.radius);

      // Color: only highlight connection links when they are hovered; base color is medium gray
      var selected = false;
      if (this._graph._hoveredLink) {
        var hParent = this._graph._hoveredLink.parent;
        var hChild = this._graph._hoveredLink.child;
        if (hParent === parent && hChild === child) {
          selected = true;
        } else if (main.getSculptManager().getSymmetry()) {
          var pPartner = parent.symmetryPartner;
          var cPartner = child.symmetryPartner;
          if (pPartner && cPartner && hParent === pPartner && hChild === cPartner) {
            selected = true;
          }
        }
      }
      gl.uniform3fv(shader.uniforms.uColor, [0.4, 0.4, 0.4]);
      gl.uniform1f(shader.uniforms.uSelected, selected ? 1.0 : 0.0);

      this._cylinderGeom.getIndexBuffer().bind();
      gl.drawElements(gl.TRIANGLES, this._cylinderGeom.getCount(), gl.UNSIGNED_INT, 0);
    }

    // 2. Draw sphere nodes
    shader.attributes.aVertex.bindToBuffer(this._sphereGeom.getVertexBuffer());
    shader.attributes.aNormal.bindToBuffer(this._sphereGeom.getNormalBuffer());

    for (var i = 0; i < nodes.length; ++i) {
      var node = nodes[i];

      // Model matrix
      mat4.identity(this._modelMatrix);
      mat4.translate(this._modelMatrix, this._modelMatrix, node.position);
      mat4.scale(this._modelMatrix, this._modelMatrix, [node.radius, node.radius, node.radius]);

      // MVP
      mat4.mul(this._mvp, camera.getProjection(), camera.getView());
      mat4.mul(this._mvp, this._mvp, this._modelMatrix);
      gl.uniformMatrix4fv(shader.uniforms.uMVP, false, this._mvp);

      // Normal Matrix
      var mv = mat4.create();
      mat4.mul(mv, camera.getView(), this._modelMatrix);
      mat3.fromMat4(this._n, mv);
      mat3.invert(this._n, this._n);
      mat3.transpose(this._n, this._n);
      gl.uniformMatrix3fv(shader.uniforms.uN, false, this._n);

      gl.uniformMatrix4fv(shader.uniforms.uMV, false, mv);

      gl.uniform1f(shader.uniforms.uRadiusBottom, 1.0);
      gl.uniform1f(shader.uniforms.uRadiusTop, 1.0);

      // Color: active (selected) is red, inactive spheres are dark gray
      var selected = (node === this._graph._selected || 
                      (main.getSculptManager().getSymmetry() && 
                       this._graph._selected && 
                       node === this._graph._selected.symmetryPartner));
      var color = selected ? [0.8, 0.1, 0.1] : [0.25, 0.25, 0.25];
      gl.uniform3fv(shader.uniforms.uColor, color);
      gl.uniform1f(shader.uniforms.uSelected, 0.0);

      this._sphereGeom.getIndexBuffer().bind();
      gl.drawElements(gl.TRIANGLES, this._sphereGeom.getCount(), gl.UNSIGNED_INT, 0);
    }

    // 3. Draw preview node if present
    if (this._graph._previewNode) {
      var pNode = this._graph._previewNode;
      var drawPreview = (pos) => {
        mat4.identity(this._modelMatrix);
        mat4.translate(this._modelMatrix, this._modelMatrix, pos);
        mat4.scale(this._modelMatrix, this._modelMatrix, [pNode.radius, pNode.radius, pNode.radius]);

        mat4.mul(this._mvp, camera.getProjection(), camera.getView());
        mat4.mul(this._mvp, this._mvp, this._modelMatrix);
        gl.uniformMatrix4fv(shader.uniforms.uMVP, false, this._mvp);

        var mv = mat4.create();
        mat4.mul(mv, camera.getView(), this._modelMatrix);
        mat3.fromMat4(this._n, mv);
        mat3.invert(this._n, this._n);
        mat3.transpose(this._n, this._n);
        gl.uniformMatrix3fv(shader.uniforms.uN, false, this._n);

        gl.uniformMatrix4fv(shader.uniforms.uMV, false, mv);

        gl.uniform1f(shader.uniforms.uRadiusBottom, 1.0);
        gl.uniform1f(shader.uniforms.uRadiusTop, 1.0);

        // Color: green preview
        gl.uniform3fv(shader.uniforms.uColor, [0.3, 0.8, 0.3]);
        gl.uniform1f(shader.uniforms.uSelected, 0.0);

        this._sphereGeom.getIndexBuffer().bind();
        gl.drawElements(gl.TRIANGLES, this._sphereGeom.getCount(), gl.UNSIGNED_INT, 0);
      };

      drawPreview(pNode.position);

      if (main.getSculptManager().getSymmetry() && Math.abs(pNode.position[0]) > 0.05) {
        var symPos = vec3.fromValues(-pNode.position[0], pNode.position[1], pNode.position[2]);
        drawPreview(symPos);
      }
    }

    // Cleanup bindings
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    shader.unbindAttributes();
  }
}

export default ZSphereDrawable;
export { createSphereArray };
