import ShaderBase from './ShaderBase.js';

var ShaderSelection = ShaderBase.getCopy();
ShaderSelection.vertexName = ShaderSelection.fragmentName = 'ShowSelection';

ShaderSelection.uniforms = {};
ShaderSelection.attributes = {};
ShaderSelection.activeAttributes = {
  vertex: true
};

ShaderSelection.uniformNames = ['uMVP', 'uColor', 'uView2DOffset', 'uView2DZoom'];

ShaderSelection.vertex = [
  'attribute vec3 aVertex;',
  'uniform mat4 uMVP;',
  'uniform vec2 uView2DOffset;',
  'uniform float uView2DZoom;',
  'void main() {',
  '  vec4 pos = uMVP * vec4(aVertex, 1.0);',
  '  pos.xy = pos.xy * uView2DZoom + uView2DOffset * pos.w;',
  '  gl_Position = pos;',
  '}'
].join('\n');

ShaderSelection.fragment = [
  'uniform vec3 uColor;',
  'void main() {',
  '  gl_FragColor = vec4(uColor, 1.0);',
  '}'
].join('\n');

ShaderSelection.draw = function (geom, drawCircle, drawSym, drawInner = true) {
  var gl = geom.getGL();
  gl.useProgram(this.program);

  gl.uniform3fv(this.uniforms.uColor, geom.getColor());

  var camera = geom.getActiveCamera();
  if (camera && camera.getRef2DMode() && geom.getPickedMesh()) {
    gl.uniform2fv(this.uniforms.uView2DOffset, camera.getView2DOffset());
    gl.uniform1f(this.uniforms.uView2DZoom, camera.getView2DZoom());
  } else {
    gl.uniform2f(this.uniforms.uView2DOffset, 0.0, 0.0);
    gl.uniform1f(this.uniforms.uView2DZoom, 1.0);
  }

  if (drawCircle) {
    var circleBuf = geom._isSquare ? geom.getSquareBuffer() : geom.getCircleBuffer();
    gl.uniformMatrix4fv(this.uniforms.uMVP, false, geom.getCircleMVP());
    ShaderSelection.attributes.aVertex.bindToBuffer(circleBuf);
    gl.drawArrays(gl.LINE_LOOP, 0, circleBuf._size / 3);

    if (drawInner) {
      gl.uniformMatrix4fv(this.uniforms.uMVP, false, geom.getInnerCircleMVP());
      gl.drawArrays(gl.LINE_LOOP, 0, circleBuf._size / 3);
    }
  }

  var dotBuf = geom._isSquare ? geom.getSquareDotBuffer() : geom.getDotBuffer();
  gl.uniformMatrix4fv(this.uniforms.uMVP, false, geom.getDotMVP());
  ShaderSelection.attributes.aVertex.bindToBuffer(dotBuf);
  gl.drawArrays(gl.TRIANGLE_FAN, 0, dotBuf._size / 3);

  if (drawSym && geom._cacheDotSymMVPs) {
    for (var i = 0; i < geom._cacheDotSymMVPs.length; ++i) {
      gl.uniformMatrix4fv(this.uniforms.uMVP, false, geom._cacheDotSymMVPs[i]);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, dotBuf._size / 3);
    }
  }
};

export default ShaderSelection;
