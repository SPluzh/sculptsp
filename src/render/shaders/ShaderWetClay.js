import ShaderBase from './ShaderBase.js';
import wetClayGLSL from './glsl/wetClay.glsl';

var ShaderWetClay = ShaderBase.getCopy();
ShaderWetClay.vertexName = ShaderWetClay.fragmentName = 'WetClay';

ShaderWetClay.clayColor = [0.6, 0.45, 0.35];
ShaderWetClay.wetness = 0.6;
ShaderWetClay.bumpStrength = 0.4;
ShaderWetClay.noiseScale = 8.0;
ShaderWetClay.sssIntensity = 0.25;
ShaderWetClay.sssColor = [0.8, 0.3, 0.15];

ShaderWetClay.uniforms = {};
ShaderWetClay.attributes = {};

ShaderWetClay.uniformNames = ['uClayColor', 'uWetness', 'uBumpStrength', 'uNoiseScale', 'uSSSIntensity', 'uSSSColor'];
Array.prototype.push.apply(ShaderWetClay.uniformNames, ShaderBase.uniformNames.commonUniforms);

ShaderWetClay.vertex = [
  'attribute vec3 aVertex;',
  'attribute vec3 aNormal;',
  'attribute vec3 aColor;',
  'attribute vec3 aMaterial;',
  ShaderBase.strings.vertUniforms,
  'varying vec3 vVertex;',
  'varying vec3 vNormal;',
  'varying vec3 vColor;',
  'varying float vMasking;',
  'varying vec3 vObjectPos;',
  'void main() {',
  '  vColor = aColor;',
  '  vMasking = aMaterial.z;',
  '  vNormal = mix(aNormal, uEN * aNormal, vMasking);',
  '  vNormal = normalize(uN * vNormal);',
  '  vec4 vertex4 = vec4(aVertex, 1.0);',
  '  vertex4 = mix(vertex4, uEM * vertex4, vMasking);',
  '  vVertex = vec3(uMV * vertex4);',
  '  vObjectPos = aVertex;',
  '  gl_Position = uMVP * vertex4;',
  '}'
].join('\n');

ShaderWetClay.fragment = [
  'varying vec3 vVertex;',
  'varying vec3 vNormal;',
  'varying vec3 vColor;',
  'varying vec3 vObjectPos;',
  'uniform float uAlpha;',
  ShaderBase.strings.fragColorUniforms,
  ShaderBase.strings.fragColorFunction,
  wetClayGLSL,
  '',
  'void main(void) {',
  '  vec3 color = computeWetClay(vVertex, vNormal, vColor, vMasking, vObjectPos);',
  '  gl_FragColor = encodeFragColor(color, uAlpha);',
  '}'
].join('\n');

ShaderWetClay.updateUniforms = function (mesh, main) {
  var gl = mesh.getGL();
  var uniforms = this.uniforms;

  var albedo = mesh.getAlbedo();
  var col = albedo[0] >= 0.0 ? albedo : ShaderWetClay.clayColor;
  gl.uniform3fv(uniforms.uClayColor, col);
  gl.uniform1f(uniforms.uWetness, ShaderWetClay.wetness);
  gl.uniform1f(uniforms.uBumpStrength, ShaderWetClay.bumpStrength);
  gl.uniform1f(uniforms.uNoiseScale, ShaderWetClay.noiseScale);
  gl.uniform1f(uniforms.uSSSIntensity, ShaderWetClay.sssIntensity);
  gl.uniform3fv(uniforms.uSSSColor, ShaderWetClay.sssColor);

  ShaderBase.updateUniforms.call(this, mesh, main);
};

export default ShaderWetClay;
