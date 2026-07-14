import ShaderBase from './ShaderBase.js';
import Attribute from '../Attribute.js';

var ShaderRefImage = ShaderBase.getCopy();
ShaderRefImage.vertexName = ShaderRefImage.fragmentName = 'RefImage';

ShaderRefImage.uniforms = {};
ShaderRefImage.attributes = {};

ShaderRefImage.uniformNames = ['uTexture', 'uOffset', 'uScale', 'uOpacity'];

ShaderRefImage.vertex = [
  'attribute vec2 aVertex;',
  'attribute vec2 aTexCoord;',
  'uniform vec2 uOffset;',
  'uniform vec2 uScale;',
  'varying vec2 vTexCoord;',
  'void main() {',
  '  vTexCoord = aTexCoord;',
  '  gl_Position = vec4(aVertex * uScale + uOffset, 0.0, 1.0);',
  '}'
].join('\n');

ShaderRefImage.fragment = [
  'varying vec2 vTexCoord;',
  'uniform sampler2D uTexture;',
  'uniform float uOpacity;',
  'void main() {',
  '  vec4 col = texture2D(uTexture, vTexCoord);',
  '  gl_FragColor = vec4(col.rgb, col.a * uOpacity);',
  '}'
].join('\n');

ShaderRefImage.draw = function (overlay) {
  var gl = overlay.getGL();
  gl.useProgram(this.program);
  
  var attrs = ShaderRefImage.attributes;
  attrs.aVertex.bindToBuffer(overlay.getVertexBuffer());
  attrs.aTexCoord.bindToBuffer(overlay.getTexCoordBuffer());

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, overlay.getTexture());
  gl.uniform1i(this.uniforms.uTexture, 0);

  gl.uniform2f(this.uniforms.uOffset, overlay.getOffsetX(), overlay.getOffsetY());
  gl.uniform2f(this.uniforms.uScale, overlay.getScaleX(), overlay.getScaleY());
  gl.uniform1f(this.uniforms.uOpacity, overlay.getOpacity());

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

ShaderRefImage.initAttributes = function (gl) {
  var program = ShaderRefImage.program;
  var attrs = ShaderRefImage.attributes;
  attrs.aVertex = new Attribute(gl, program, 'aVertex', 2, gl.FLOAT);
  attrs.aTexCoord = new Attribute(gl, program, 'aTexCoord', 2, gl.FLOAT);
};

export default ShaderRefImage;
