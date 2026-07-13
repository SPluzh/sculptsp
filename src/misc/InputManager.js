import Tablet from './Tablet.js';

class InputManager {
  constructor(canvas, pixelRatioFn, offsetLeftFn, offsetTopFn) {
    this.CLICK_THRESHOLD_PX = 8;

    this._pixelRatioFn = pixelRatioFn;
    this._offsetLeftFn = offsetLeftFn;
    this._offsetTopFn = offsetTopFn;

    this._isDown = false;
    this._isDragged = false;
    this._downX = 0;
    this._downY = 0;
    this._x = 0;
    this._y = 0;
    this._pressure = 0.0;
    this._pointerType = 'mouse';
    this._altKey = false;
    this._ctrlKey = false;
    this._shiftKey = false;
    this._button = 0;

    this._pageX = 0;
    this._pageY = 0;

    this._callbacks = {
      down: [],
      move: [],
      up:   []
    };

    this._canvas = canvas;
    this._bindEvents();
  }

  on(event, cb) {
    if (this._callbacks[event]) {
      this._callbacks[event].push(cb);
    }
  }

  _emit(event, data) {
    this._callbacks[event].forEach(cb => cb(data));
  }

  _toCanvasCoords(event) {
    var pr = this._pixelRatioFn();
    return {
      x: pr * (event.pageX - this._offsetLeftFn()),
      y: pr * (event.pageY - this._offsetTopFn())
    };
  }

  _bindEvents() {
    // Listen to Pointer Events for canvas interaction
    this._canvas.addEventListener('pointerdown', this._onDown.bind(this), false);
    window.addEventListener('pointermove', this._onMove.bind(this), false);
    window.addEventListener('pointerup', this._onUp.bind(this), false);
    window.addEventListener('pointercancel', this._onCancel.bind(this), false);
  }

  _onDown(e) {
    // Only handle primary (left/middle/right click) pointer downs
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;

    e.preventDefault();

    // Capture the pointer to receive events outside canvas during drag
    try {
      this._canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // ignore if pointer capture fails
    }

    var pos = this._toCanvasCoords(e);
    this._isDown = true;
    this._isDragged = false;
    this._downX = pos.x;
    this._downY = pos.y;
    this._x = pos.x;
    this._y = pos.y;
    this._pageX = e.pageX;
    this._pageY = e.pageY;
    this._pointerType = e.pointerType;
    this._altKey = e.altKey;
    this._ctrlKey = e.ctrlKey;
    this._shiftKey = e.shiftKey;
    this._button = e.which; // mapping to event.which (1 = left, 2 = middle, 3 = right)

    var pressure = this._normalizePressure(e, true);
    this._pressure = pressure;
    if (!(Tablet.isWintabActive && Tablet.useWintab)) {
      Tablet.pressure = pressure;
    }

    this._emit('down', this._snapshot());
  }

  _onMove(e) {
    var pos = this._toCanvasCoords(e);
    this._x = pos.x;
    this._y = pos.y;
    this._pageX = e.pageX;
    this._pageY = e.pageY;
    this._altKey = e.altKey;
    this._ctrlKey = e.ctrlKey;
    this._shiftKey = e.shiftKey;

    var pressure = this._normalizePressure(e, this._isDown);
    this._pressure = pressure;
    if (!(Tablet.isWintabActive && Tablet.useWintab)) {
      Tablet.pressure = pressure;
    }

    if (this._isDown) {
      e.preventDefault();
      if (!this._isDragged) {
        var dx = pos.x - this._downX;
        var dy = pos.y - this._downY;
        var threshold = this.CLICK_THRESHOLD_PX * this._pixelRatioFn();
        if (dx * dx + dy * dy > threshold * threshold) {
          this._isDragged = true;
        }
      }
      this._emit('move', this._snapshot());
    }
  }

  _onUp(e) {
    if (!this._isDown) return;

    e.preventDefault();

    try {
      this._canvas.releasePointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }

    this._isDown = false;
    this._pageX = e.pageX;
    this._pageY = e.pageY;
    this._altKey = e.altKey;
    this._ctrlKey = e.ctrlKey;
    this._shiftKey = e.shiftKey;
    
    var pressure = 0.0;
    this._pressure = pressure;
    if (!(Tablet.isWintabActive && Tablet.useWintab)) {
      Tablet.pressure = pressure;
    }

    this._emit('up', { ...this._snapshot(), wasClick: !this._isDragged });
    this._isDragged = false;
  }

  _onCancel(e) {
    if (!this._isDown) return;

    try {
      this._canvas.releasePointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }

    this._isDown = false;
    this._isDragged = false;
    this._pageX = e.pageX;
    this._pageY = e.pageY;
    
    var pressure = 0.0;
    this._pressure = pressure;
    if (!(Tablet.isWintabActive && Tablet.useWintab)) {
      Tablet.pressure = pressure;
    }

    this._emit('up', { ...this._snapshot(), wasClick: false });
  }

  _normalizePressure(e, isPressed) {
    if (Tablet.isWintabActive && Tablet.useWintab) {
      return Tablet.pressure;
    }
    if (e.pointerType === 'mouse') {
      return isPressed ? 0.5 : 0.0;
    }
    return e.pressure !== undefined ? e.pressure : 0.0;
  }

  _snapshot() {
    return {
      x: this._x,
      y: this._y,
      pageX: this._pageX,
      pageY: this._pageY,
      pressure: this._pressure,
      pointerType: this._pointerType,
      altKey: this._altKey,
      ctrlKey: this._ctrlKey,
      shiftKey: this._shiftKey,
      which: this._button,
      isDragged: this._isDragged
    };
  }
}

export default InputManager;
