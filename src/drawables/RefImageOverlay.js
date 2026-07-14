import Buffer from '../render/Buffer.js';
import Shader from '../render/ShaderLib.js';
import Enums from '../misc/Enums.js';

class RefImageOverlay {

  constructor(gl, main) {
    this._gl = gl;
    this._main = main;
    this._texture = null;
    this._imgWidth = 1;
    this._imgHeight = 1;
    this._name = 'Reference Image';

    this._offsetX = 0.0;
    this._offsetY = 0.0;
    this._scale = 1.0;
    this._opacity = 0.5;
    this._visible = true;

    this._canvasW = 1;
    this._canvasH = 1;

    this._vertexBuffer = new Buffer(gl, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
    this._texCoordBuffer = new Buffer(gl, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
    
    this._initBuffers();
  }

  _initBuffers() {
    this._vertexBuffer.update(new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]));
    this._texCoordBuffer.update(new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0]));
  }

  loadFromDataURL(dataURL, name) {
    this._name = name || 'Reference Image';
    var self = this;
    var img = new Image();
    img.src = dataURL;
    img.onload = function () {
      var gl = self._gl;
      self._imgWidth = img.width;
      self._imgHeight = img.height;
      
      if (self._texture) {
        gl.deleteTexture(self._texture);
      }
      self._texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, self._texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      
      self._main.render();
    };
  }

  getGL() {
    return this._gl;
  }

  getVertexBuffer() {
    return this._vertexBuffer;
  }

  getTexCoordBuffer() {
    return this._texCoordBuffer;
  }

  getTexture() {
    return this._texture;
  }

  getName() {
    return this._name;
  }

  getOffsetX() {
    return this._offsetX;
  }

  setOffsetX(val) {
    this._offsetX = val;
  }

  getOffsetY() {
    return this._offsetY;
  }

  setOffsetY(val) {
    this._offsetY = val;
  }

  getScale() {
    return this._scale;
  }

  setScale(val) {
    this._scale = Math.max(0.01, val);
  }

  getScaleX() {
    var ratioV = this._canvasW / this._canvasH;
    var ratioI = this._imgWidth / this._imgHeight;
    if (ratioI > ratioV) {
      return this._scale;
    } else {
      return this._scale * (ratioI / ratioV);
    }
  }

  getScaleY() {
    var ratioV = this._canvasW / this._canvasH;
    var ratioI = this._imgWidth / this._imgHeight;
    if (ratioI > ratioV) {
      return this._scale * (ratioV / ratioI);
    } else {
      return this._scale;
    }
  }

  getOpacity() {
    return this._opacity;
  }

  setOpacity(val) {
    this._opacity = Math.max(0.0, Math.min(1.0, val));
  }

  getVisible() {
    return this._visible;
  }

  setVisible(val) {
    this._visible = val;
  }

  hitTest(ndcX, ndcY) {
    var dx = Math.abs(ndcX - this._offsetX);
    var dy = Math.abs(ndcY - this._offsetY);
    return dx <= this.getScaleX() && dy <= this.getScaleY();
  }

  render(vpW, vpH) {
    this._canvasW = vpW;
    this._canvasH = vpH;

    if (!this._texture) return;

    Shader[Enums.Shader.REF_IMAGE].getOrCreate(this._gl).draw(this);
  }

  release() {
    if (this._texture) {
      this._gl.deleteTexture(this._texture);
    }
    this._vertexBuffer.release();
    this._texCoordBuffer.release();
  }
}

export default RefImageOverlay;
