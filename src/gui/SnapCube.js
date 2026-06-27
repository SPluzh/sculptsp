import { quat } from 'gl-matrix';

class SnapCube {

  constructor(main) {
    this._main = main;
    this._domContainer = null;
    this._domCube = null;

    this.initDOM();
  }

  initDOM() {
    var viewport = this._main.getViewport();
    if (!viewport) return;

    // Create container
    var container = this._domContainer = document.createElement('div');
    container.className = 'snap-cube-container';

    // Create rotating cube wrapper
    var cube = this._domCube = document.createElement('div');
    cube.className = 'snap-cube';
    container.appendChild(cube);

    // Setup all 26 components (faces, edges, corners)
    var parts = [
      // Faces
      { name: 'front', cssClass: 'cube-face', label: 'Front', transform: 'rotateY(0deg) translateZ(40px)', rotX: 0, rotY: 0 },
      { name: 'back', cssClass: 'cube-face', label: 'Back', transform: 'rotateY(180deg) translateZ(40px)', rotX: 0, rotY: -Math.PI },
      { name: 'left', cssClass: 'cube-face', label: 'Left', transform: 'rotateY(-90deg) translateZ(40px)', rotX: 0, rotY: Math.PI / 2 },
      { name: 'right', cssClass: 'cube-face', label: 'Right', transform: 'rotateY(90deg) translateZ(40px)', rotX: 0, rotY: -Math.PI / 2 },
      { name: 'top', cssClass: 'cube-face', label: 'Top', transform: 'rotateX(90deg) translateZ(40px)', rotX: Math.PI / 2, rotY: 0 },
      { name: 'bottom', cssClass: 'cube-face', label: 'Bottom', transform: 'rotateX(-90deg) translateZ(40px)', rotX: -Math.PI / 2, rotY: 0 },

      // Edges
      { name: 'front-top', cssClass: 'cube-edge cube-edge-h', transform: 'rotateX(45deg) translateZ(46.1px)', rotX: Math.PI / 4, rotY: 0 },
      { name: 'front-bottom', cssClass: 'cube-edge cube-edge-h', transform: 'rotateX(-45deg) translateZ(46.1px)', rotX: -Math.PI / 4, rotY: 0 },
      { name: 'back-top', cssClass: 'cube-edge cube-edge-h', transform: 'rotateX(135deg) translateZ(46.1px)', rotX: Math.PI / 4, rotY: -Math.PI },
      { name: 'back-bottom', cssClass: 'cube-edge cube-edge-h', transform: 'rotateX(-135deg) translateZ(46.1px)', rotX: -Math.PI / 4, rotY: -Math.PI },

      { name: 'front-left', cssClass: 'cube-edge cube-edge-v', transform: 'rotateY(-45deg) translateZ(46.1px)', rotX: 0, rotY: Math.PI / 4 },
      { name: 'front-right', cssClass: 'cube-edge cube-edge-v', transform: 'rotateY(45deg) translateZ(46.1px)', rotX: 0, rotY: -Math.PI / 4 },
      { name: 'back-left', cssClass: 'cube-edge cube-edge-v', transform: 'rotateY(-135deg) translateZ(46.1px)', rotX: 0, rotY: 3 * Math.PI / 4 },
      { name: 'back-right', cssClass: 'cube-edge cube-edge-v', transform: 'rotateY(135deg) translateZ(46.1px)', rotX: 0, rotY: -3 * Math.PI / 4 },

      { name: 'top-left', cssClass: 'cube-edge cube-edge-h', transform: 'rotateY(-90deg) rotateX(45deg) translateZ(46.1px)', rotX: Math.PI / 4, rotY: Math.PI / 2 },
      { name: 'top-right', cssClass: 'cube-edge cube-edge-h', transform: 'rotateY(90deg) rotateX(45deg) translateZ(46.1px)', rotX: Math.PI / 4, rotY: -Math.PI / 2 },
      { name: 'bottom-left', cssClass: 'cube-edge cube-edge-h', transform: 'rotateY(-90deg) rotateX(-45deg) translateZ(46.1px)', rotX: -Math.PI / 4, rotY: Math.PI / 2 },
      { name: 'bottom-right', cssClass: 'cube-edge cube-edge-h', transform: 'rotateY(90deg) rotateX(-45deg) translateZ(46.1px)', rotX: -Math.PI / 4, rotY: -Math.PI / 2 },

      // Corners
      { name: 'top-front-right', cssClass: 'cube-corner cube-corner-top', transform: 'rotateY(45deg) rotateX(35.26deg) translateZ(52.2px)', rotX: Math.PI / 4, rotY: -Math.PI / 4 },
      { name: 'top-front-left', cssClass: 'cube-corner cube-corner-top', transform: 'rotateY(-45deg) rotateX(35.26deg) translateZ(52.2px)', rotX: Math.PI / 4, rotY: Math.PI / 4 },
      { name: 'top-back-right', cssClass: 'cube-corner cube-corner-top', transform: 'rotateY(135deg) rotateX(35.26deg) translateZ(52.2px)', rotX: Math.PI / 4, rotY: -3 * Math.PI / 4 },
      { name: 'top-back-left', cssClass: 'cube-corner cube-corner-top', transform: 'rotateY(-135deg) rotateX(35.26deg) translateZ(52.2px)', rotX: Math.PI / 4, rotY: 3 * Math.PI / 4 },
      { name: 'bottom-front-right', cssClass: 'cube-corner cube-corner-bottom', transform: 'rotateY(45deg) rotateX(-35.26deg) translateZ(52.2px)', rotX: -Math.PI / 4, rotY: -Math.PI / 4 },
      { name: 'bottom-front-left', cssClass: 'cube-corner cube-corner-bottom', transform: 'rotateY(-45deg) rotateX(-35.26deg) translateZ(52.2px)', rotX: -Math.PI / 4, rotY: Math.PI / 4 },
      { name: 'bottom-back-right', cssClass: 'cube-corner cube-corner-bottom', transform: 'rotateY(135deg) rotateX(-35.26deg) translateZ(52.2px)', rotX: -Math.PI / 4, rotY: -3 * Math.PI / 4 },
      { name: 'bottom-back-left', cssClass: 'cube-corner cube-corner-bottom', transform: 'rotateY(-135deg) rotateX(-35.26deg) translateZ(52.2px)', rotX: -Math.PI / 4, rotY: 3 * Math.PI / 4 }
    ];

    var self = this;
    parts.forEach(function (part) {
      var el = document.createElement('div');
      el.className = part.cssClass + ' face-' + part.name;
      el.style.transform = part.transform;
      if (part.label) {
        el.textContent = part.label;
      }

      el.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        var camera = self._main.getCamera();
        if (camera) {
          var q_target = quat.create();
          quat.rotateX(q_target, q_target, part.rotX);
          quat.rotateY(q_target, q_target, part.rotY);
          
          // Ensure shortest path interpolation (hemisphere check)
          if (quat.dot(camera._quatRot, q_target) < 0) {
            quat.scale(q_target, q_target, -1);
          }
          camera.quatDelay(q_target, 200);
        }
      });

      el.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        e.preventDefault();
      });

      // Avoid triggering camera rotation when dragging on the cube
      el.addEventListener('mousedown', function (e) {
        e.stopPropagation();
      });

      el.addEventListener('mouseup', function (e) {
        e.stopPropagation();
      });

      cube.appendChild(el);
    });

    viewport.appendChild(container);
  }

  update(camera) {
    if (!this._domCube || !camera) return;

    var V = camera.getView();
    if (!V) return;

    // Convert WebGL coordinate space (Y-up) to CSS space (Y-down) by scaling Y axis.
    // Equivalent to matrix multiplication: R_css = S * V * S where S = diag(1, -1, 1, 1).
    var m00 = V[0];
    var m10 = -V[1];
    var m20 = V[2];

    var m01 = -V[4];
    var m11 = V[5];
    var m21 = -V[6];

    var m02 = V[8];
    var m12 = -V[9];
    var m22 = V[10];

    var transformStr = 'matrix3d(' +
      m00.toFixed(6) + ',' + m10.toFixed(6) + ',' + m20.toFixed(6) + ',0,' +
      m01.toFixed(6) + ',' + m11.toFixed(6) + ',' + m21.toFixed(6) + ',0,' +
      m02.toFixed(6) + ',' + m12.toFixed(6) + ',' + m22.toFixed(6) + ',0,' +
      '0,0,0,1' +
    ')';

    this._domCube.style.transform = transformStr;
  }
}

export default SnapCube;
