import Utils from './Utils.js';

// enum marked with /!\ shouldn't change (serialized in sgl file)

var Enums = {};

Enums.Action = {
  NOTHING: 0,
  MASK_EDIT: 1,
  SCULPT_EDIT: 2,
  CAMERA_ZOOM: 3,
  CAMERA_ROTATE: 4,
  CAMERA_PAN: 5,
  CAMERA_PAN_ZOOM_ALT: 6,
  MEASURE_EDIT: 7,
  CAMERA_ROLL: 8,
  HIDE_EDIT: 9
};

// sculpt tools
Enums.Tools = {
  BRUSH: 0,
  INFLATE: 1,
  TWIST: 2,
  SMOOTH: 3,
  FLATTEN: 4,
  PINCH: 5,
  CREASE: 6,
  DRAG: 7,
  PAINT: 8,
  MOVE: 9,
  MASKING: 10,
  LOCALSCALE: 11,
  TRANSFORM: 12,
  CLAYBUILDUP: 13,
  ZSPHERE: 14,
  TOPOLOGY: 15,
  MEASURE: 16,
  ELASTIC: 17,
  CURVE_DEFORM: 18,
  DIVIDER: 19,
  VISIBILITY: 20
};

// display shader type
Enums.Shader = {
  PBR: 0, // /!\ 
  FLAT: 1,
  NORMAL: 2, // /!\ 
  WIREFRAME: 3,
  UV: 4, // /!\ 
  MATCAP: 5, // /!\ 
  SELECTION: 6,
  BACKGROUND: 7,
  MERGE: 8,
  FXAA: 9,
  CONTOUR: 10,
  PAINTUV: 11,
  BLUR: 12,
  ZSPHERE: 13,
  WETCLAY: 14,
  REF_IMAGE: 15,
  VIEWPORT2D: 16
};

// camera projection
Enums.Projection = {
  PERSPECTIVE: 0, // /!\ 
  ORTHOGRAPHIC: 1 // /!\ 
};

// camera mode
Enums.CameraMode = {
  ORBIT: 0, // /!\ 
  SPHERICAL: 1, // /!\ 
  PLANE: 2 // /!\ 
};

// used by multiresolution to choose which multi res level to render
Enums.MultiState = {
  NONE: 0,
  SCULPT: 1,
  CAMERA: 2,
  PICKING: 3
};

// actions linked to shortcuts
// tools index must match
var acc = Object.keys(Enums.Tools).length;
Enums.KeyAction = Utils.extend({
  INTENSITY: acc++,
  RADIUS: acc++,
  FOCAL_SHIFT: acc++,
  NEGATIVE: acc++,
  PICKER: acc++,
  DELETE: acc++,
  CAMERA_FRONT: acc++,
  CAMERA_TOP: acc++,
  CAMERA_LEFT: acc++,
  CAMERA_RESET: acc++,
  CAMERA_FOV: acc++,
  CAMERA_PROJECTION: acc++,
  CAMERA_FRAME: acc++,
  STRIFE_LEFT: acc++,
  STRIFE_RIGHT: acc++,
  STRIFE_UP: acc++,
  STRIFE_DOWN: acc++,
  WIREFRAME: acc++,
  REMESH: acc++,
  REMESH_RESOLUTION: acc++,
  TOPOLOGY_DETAIL: acc++
}, Enums.Tools);

export default Enums;
