import ShaderBase from './ShaderBase.js';
import Attribute from '../Attribute.js';
import getOptionsURL from '../../misc/getOptionsURL.js';
import fxaaGLSL from './glsl/fxaa.glsl';

var ShaderViewport2D = ShaderBase.getCopy();
ShaderViewport2D.vertexName = ShaderViewport2D.fragmentName = 'Viewport2D';

ShaderViewport2D.uniforms = {};
ShaderViewport2D.attributes = {};

ShaderViewport2D.uniformNames = ['uTexture0', 'uInvSize', 'uView2DOffset', 'uView2DZoom'];

ShaderViewport2D.vertex = [
  'attribute vec2 aVertex;',
  'uniform vec2 uInvSize;',
  'uniform vec2 uView2DOffset;',
  'uniform float uView2DZoom;',
  'varying vec2 vUVNW;',
  'varying vec2 vUVNE;',
  'varying vec2 vUVSW;',
  'varying vec2 vUVSE;',
  'varying vec2 vUVM;',
  'void main() {',
  '  vec2 ndc = (aVertex - uView2DOffset) / uView2DZoom;',
  '  vUVM = ndc * 0.5 + 0.5;',
  '  vUVNW = vUVM + vec2(-1.0, -1.0) * uInvSize;',
  '  vUVNE = vUVM + vec2(1.0, -1.0) * uInvSize;',
  '  vUVSW = vUVM + vec2(-1.0, 1.0) * uInvSize;',
  '  vUVSE = vUVM + vec2(1.0, 1.0) * uInvSize;',
  '  gl_Position = vec4(aVertex, 0.5, 1.0);',
  '}'
].join('\n');

ShaderViewport2D.fragment = [
  'uniform sampler2D uTexture0;',
  'uniform vec2 uInvSize;',
  'varying vec2 vUVNW;',
  'varying vec2 vUVNE;',
  'varying vec2 vUVSW;',
  'varying vec2 vUVSE;',
  'varying vec2 vUVM;',
  fxaaGLSL,
  ShaderBase.strings.colorSpaceGLSL,
  'void main() {',
  '  gl_FragColor = vec4(fxaa(uTexture0, vUVNW, vUVNE, vUVSW, vUVSE, vUVM, uInvSize), 1.0);',
  '}'
].join('\n');

ShaderViewport2D.draw = function (rtt, main) {
  var gl = rtt.getGL();
  gl.useProgram(this.program);

  ShaderViewport2D.attributes.aVertex.bindToBuffer(rtt.getVertexBuffer());

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, rtt.getTexture());
  gl.uniform1i(this.uniforms.uTexture0, 0);

  gl.uniform2fv(this.uniforms.uInvSize, rtt.getInverseSize());

  var camera = main.getCamera();
  gl.uniform2fv(this.uniforms.uView2DOffset, camera.getView2DOffset());
  gl.uniform1f(this.uniforms.uView2DZoom, camera.getView2DZoom());

  gl.drawArrays(gl.TRIANGLES, 0, 3);
};

ShaderViewport2D.initAttributes = function (gl) {
  ShaderViewport2D.attributes.aVertex = new Attribute(gl, ShaderViewport2D.program, 'aVertex', 2, gl.FLOAT);
};

export default ShaderViewport2D;
