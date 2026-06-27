import ShaderBase from './ShaderBase.js';

var ShaderZSphere = ShaderBase.getCopy();
ShaderZSphere.vertexName = ShaderZSphere.fragmentName = 'ZSphere';

ShaderZSphere.uniforms = {};
ShaderZSphere.attributes = {};
ShaderZSphere.activeAttributes = {
  vertex: true,
  normal: true
};

ShaderZSphere.uniformNames = ['uMVP', 'uMV', 'uN', 'uColor', 'uSelected', 'uRadiusTop', 'uRadiusBottom', 'uTexture0'];

ShaderZSphere.vertex = [
  'attribute vec3 aVertex;',
  'attribute vec3 aNormal;',
  'uniform mat4 uMVP;',
  'uniform mat4 uMV;',
  'uniform mat3 uN;',
  'uniform float uRadiusTop;',
  'uniform float uRadiusBottom;',
  'varying vec3 vVertex;',
  'varying vec3 vVertexPres;',
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
  '  vVertex = vec3(uMV * vec4(pos, 1.0));',
  '  vVertexPres = vVertex / max(1.0, abs(uMV[3][2]));',
  '  gl_Position = uMVP * vec4(pos, 1.0);',
  '}'
].join('\n');

ShaderZSphere.fragment = [
  'uniform sampler2D uTexture0;',
  'varying vec3 vVertex;',
  'varying vec3 vVertexPres;',
  'varying vec3 vNormal;',
  'uniform vec3 uColor;',
  'uniform float uSelected;',
  ShaderBase.strings.colorSpaceGLSL,
  'void main() {',
  '  vec3 normal = normalize(gl_FrontFacing ? vNormal : -vNormal);',
  '  vec3 nm_z = normalize(vVertexPres);',
  '  vec3 nm_x = vec3(-nm_z.z, 0.0, nm_z.x);',
  '  vec3 nm_y = cross(nm_x, nm_z);',
  '  vec2 texCoord = 0.5 + 0.5 * vec2(dot(normal, nm_x), dot(normal, nm_y));',
  '  vec3 matcapColor = sRGBToLinear(texture2D(uTexture0, texCoord).rgb);',
  '  vec3 baseColor = matcapColor * sRGBToLinear(uColor);',
  '  if (uSelected > 0.5) {',
  '    // For selected connection links, add a subtle yellow highlight; spheres handle their selection color (red) via uColor directly',
  '    baseColor = mix(baseColor, vec3(1.0, 1.0, 0.0), 0.3) + vec3(0.2, 0.2, 0.0);',
  '  }',
  '  gl_FragColor = encodeRGBM(baseColor);',
  '}'
].join('\n');

export default ShaderZSphere;
