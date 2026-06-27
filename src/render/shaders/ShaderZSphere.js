import ShaderBase from './ShaderBase.js';

var ShaderZSphere = ShaderBase.getCopy();
ShaderZSphere.vertexName = ShaderZSphere.fragmentName = 'ZSphere';

ShaderZSphere.uniforms = {};
ShaderZSphere.attributes = {};
ShaderZSphere.activeAttributes = {
  vertex: true,
  normal: true
};

ShaderZSphere.uniformNames = ['uMVP', 'uN', 'uColor', 'uSelected', 'uRadiusTop', 'uRadiusBottom'];

ShaderZSphere.vertex = [
  'attribute vec3 aVertex;',
  'attribute vec3 aNormal;',
  'uniform mat4 uMVP;',
  'uniform mat3 uN;',
  'uniform float uRadiusTop;',
  'uniform float uRadiusBottom;',
  'varying vec3 vNormal;',
  'void main() {',
  '  vec3 pos = aVertex;',
  '  float u = (pos.y + 1.0) * 0.5;',
  '  float radius = mix(uRadiusBottom, uRadiusTop, u);',
  '  pos.x *= radius;',
  '  pos.z *= radius;',
  '  vec3 norm = aNormal;',
  '  if (uRadiusTop != uRadiusBottom && abs(norm.y) < 0.9) {',
  '    float slope = (uRadiusTop - uRadiusBottom) * 0.5;',
  '    norm = vec3(aNormal.x, -slope * length(aNormal.xz), aNormal.z);',
  '    norm = normalize(norm);',
  '  }',
  '  vNormal = normalize(uN * norm);',
  '  gl_Position = uMVP * vec4(pos, 1.0);',
  '}'
].join('\n');

ShaderZSphere.fragment = [
  'varying vec3 vNormal;',
  'uniform vec3 uColor;',
  'uniform float uSelected;',
  'void main() {',
  '  vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));',
  '  float diff = max(0.2, dot(vNormal, lightDir));',
  '  vec3 baseColor = uColor * diff;',
  '  if (uSelected > 0.5) {',
  '    baseColor = mix(baseColor, vec3(1.0, 1.0, 0.0), 0.3) + vec3(0.2, 0.2, 0.0);',
  '  }',
  '  gl_FragColor = vec4(baseColor, 1.0);',
  '}'
].join('\n');

export default ShaderZSphere;
