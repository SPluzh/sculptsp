import ShaderBase from 'render/shaders/ShaderBase';
import Attribute from 'render/Attribute';

var ShaderVoxelChecker = ShaderBase.getCopy();
ShaderVoxelChecker.vertexName = ShaderVoxelChecker.fragmentName = 'VoxelChecker';

ShaderVoxelChecker.uniforms = {};
ShaderVoxelChecker.attributes = {};
ShaderVoxelChecker.activeAttributes = {
  vertex: true
};

ShaderVoxelChecker.uniformNames = ['uMVP', 'uMV', 'uStep'];

ShaderVoxelChecker.vertex = [
  'attribute vec3 aVertex;',
  'uniform mat4 uMVP;',
  'uniform mat4 uMV;',
  'varying vec3 vViewPos;',
  'void main() {',
  '  vViewPos = vec3(uMV * vec4(aVertex, 1.0));',
  '  gl_Position = uMVP * vec4(aVertex, 1.0);',
  '}'
].join('\n');

ShaderVoxelChecker.fragment = [
  'precision mediump float;',
  'varying vec3 vViewPos;',
  'uniform float uStep;',
  'void main() {',
  '  vec2 cell = floor(vViewPos.xy / uStep + 0.0001);',
  '  float cx = mod(abs(cell.x), 2.0);',
  '  float cy = mod(abs(cell.y), 2.0);',
  '  float checker = mod(cx + cy, 2.0);',
  '  vec3 col = (checker > 0.5) ? vec3(0.5) : vec3(0.0);',
  '  float alpha = (checker > 0.5) ? 0.15 : 0.6;',
  '  gl_FragColor = vec4(col, alpha);',
  '}'
].join('\n');

ShaderVoxelChecker.initAttributes = function (gl) {
  var program = this.program;
  var attrs = this.attributes;
  attrs.aVertex = new Attribute(gl, program, 'aVertex', 3, gl.FLOAT);
};

ShaderVoxelChecker.updateUniforms = function (mesh, step) {
  var gl = mesh.getGL();
  gl.uniformMatrix4fv(this.uniforms.uMVP, false, mesh.getMVP());
  gl.uniformMatrix4fv(this.uniforms.uMV, false, mesh.getMV());
  gl.uniform1f(this.uniforms.uStep, step);
};

ShaderVoxelChecker.draw = function (mesh, step) {
  var gl = mesh.getGL();
  gl.useProgram(this.program);
  this.attributes.aVertex.bindToBuffer(mesh.getVertexBuffer());
  this.updateUniforms(mesh, step);

  if (mesh.isUsingDrawArrays()) {
    gl.drawArrays(mesh.getMode(), 0, mesh.getCount());
  } else {
    mesh.getIndexBuffer().bind();
    gl.drawElements(mesh.getMode(), mesh.getCount(), gl.UNSIGNED_INT, 0);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  this.attributes.aVertex.unbind();
};

export default ShaderVoxelChecker;
