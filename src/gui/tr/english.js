var TR = {
  // background
  backgroundTitle: 'Background',
  backgroundReset: 'Reset',
  backgroundImport: 'Import (jpg, png...)',
  backgroundFill: 'Fill',

  // camera
  cameraTitle: 'Camera',
  cameraReset: 'View',
  cameraCenter: 'Reset (bar)',
  cameraFront: 'Front (F)',
  cameraLeft: 'Left (L)',
  cameraTop: 'Top (T)',
  cameraMode: 'Mode',
  cameraOrbit: 'Orbit (Turntable)',
  cameraSpherical: 'Spherical (Trackball)',
  cameraPlane: 'Plane (Trackball)',
  cameraProjection: 'Projection',
  cameraPerspective: 'Perspective',
  cameraOrthographic: 'Orthographic',
  cameraFov: 'Fov (mm)',
  cameraPivot: 'Picking pivot',
  cameraRmbOnly: 'RMB only navigation',
  cameraSpeedTitle: 'Speed settings',
  cameraSpeedTranslate: 'Translation speed',
  cameraSpeedZoom: 'Zoom speed',
  cameraSpeedRotate: 'Rotation speed',

  // file
  fileTitle: 'Files (import/export)',
  fileImportTitle: 'Import',
  fileAdd: 'Add (obj, sgl, ply, stl)',
  fileAutoMatrix: 'Scale and center',
  fileVertexSRGB: 'sRGB vertex color',
  fileExportSceneTitle: 'Export Scene',
  fileExportAll: 'Export all',
  fileExportSGL: 'Save .sgl (SculptSP)',
  fileExportOBJ: 'Save .obj',
  fileExportPLY: 'Save .ply',
  fileExportSTL: 'Save .stl',

  fileExportTextureTitle: 'Export textures',
  fileExportTextureSize: 'Size',
  fileExportColor: 'Save diffuse',
  fileExportRoughness: 'Save roughness',
  fileExportMetalness: 'Save metalness',

  // scene
  sceneTitle: 'Scene',
  sceneReset: 'Clear scene',
  sceneResetConfirm: 'Confirm clear scene',
  sceneAddSphere: 'Add sphere',
  sceneAddCube: 'Add cube',
  sceneAddCylinder: 'Add cylinder',
  sceneAddTorus: 'Add torus',
  sceneSelection: 'Selection',
  sceneMerge: 'Merge selection',
  sceneDuplicate: 'Copy selection',
  sceneDelete: 'Delete selection',

  // mesh
  meshTitle: 'Mesh',
  meshNbVertices: 'Vertex : ',
  meshNbFaces: 'Faces : ',

  // topology
  topologyTitle: 'Topology',

  //multires
  multiresTitle: 'Multiresolution',
  multiresSubdivide: 'Subdivide',
  multiresReverse: 'Reverse',
  multiresResolution: 'Resolution',
  multiresNoLower: 'There is no lower resolution level.',
  multiresNoHigher: 'There is no higher resolution level.',
  multiresDelHigher: 'Delete higher',
  multiresDelLower: 'Delete lower',
  multiresSelectLowest: 'Select the lowest resolution before reversing.',
  multiresSelectHighest: 'Select the highest resolution before subdividing.',
  multiresWarnBigMesh: function (nbFacesNext) {
    return 'The next subdivision level will reach ' + nbFacesNext + ' faces.\n' +
      'If you know what you are doing, click again on "subdivide".';
  },
  multiresNotReversible: 'Sorry it is not possile to reverse this mesh.\n' +
    'The mesh is not a product of a (loop-catmull) subdivision surface on a manifold mesh.',

  // remesh
  remeshTitle: 'Voxel remeshing (quads)',
  remeshRemesh: 'Remesh (Ctrl+X)',
  remeshResolution: 'Resolution (-X)',
  remeshBlock: 'Block',
  remeshProgress0: 'Initializing...',
  remeshProgress1: 'Preparing meshes...',
  remeshProgress2: 'Voxelization...',
  remeshProgress2Sub: 'Voxelization...',
  remeshProgress3: 'Flood fill...',
  remeshProgress4SN: 'Surface Nets reconstruction...',
  remeshProgress4MC: 'Marching Cubes reconstruction...',
  remeshProgress5: 'Creating mesh...',
  remeshProgress6: 'Tangential smoothing...',

  // dynamic
  dynamicTitle: 'Dynamic Topology',
  dynamicActivated: 'Activated (no quads)',
  dynamicSubdivision: 'Subdivision',
  dynamicDecimation: 'Decimation',
  dynamicLinear: 'Linear subdivision',

  // sculpt
  sculptTitle: 'Sculpting & Painting',
  sculptBrush: 'Brush',
  sculptInflate: 'Inflate',
  sculptTwist: 'Twist',
  sculptSmooth: 'Smooth (-Shift)',
  sculptFlatten: 'Flatten',
  sculptPinch: 'Pinch',
  sculptCrease: 'Crease',
  sculptDrag: 'Drag',
  sculptPaint: 'Paint',
  sculptMasking: 'Masking (-Ctrl)',
  sculptMove: 'Move',
  sculptLocalScale: 'Local scale',
  sculptTransform: 'Transform',
  sculptClayBuildup: 'Clay Buildup',
  sculptZSphere: 'ZSphere',
  sculptZSphereMode: 'Mode',
  sculptZSphereAddRoot: 'Create Root ZSphere',
  sculptZSphereCreateMesh: 'Create Mesh',
  sculptZSphereClear: 'Clear ZSpheres',

  sculptCommon: 'Common',
  sculptTool: 'Tool',
  sculptSymmetry: 'Symmetry',
  sculptContinuous: 'Continuous',
  sculptRadius: 'Radius (-S)',
  sculptIntensity: 'Intensity (-A)',
  sculptFocalShift: 'Focal Shift',
  sculptFocalShiftFalloff: 'Focal Shift Falloff',
  sculptHardness: 'Hardness',
  sculptCulling: 'Thin surface (front vertex only)',
  sculptAlphaTitle: 'Alpha',
  sculptLockPositon: 'Lock position',
  sculptAlphaTex: 'Texture',
  sculptImportAlpha: 'Import alpha tex (jpg, png...)',
  sculptNegative: 'Negative (N or -Alt)',
  sculptColor: 'Albedo',
  sculptRoughness: 'Roughness',
  sculptMetallic: 'Metallic',
  sculptClay: 'Clay',
  sculptAccumulate: 'Accumulate (no limit per stroke)',
  sculptSpacing: 'Spacing',
  sculptColorGlobal: 'Global',
  sculptPickColor: 'Material / Color picker (-C)',
  sculptTangentialSmoothing: 'Relax only',
  sculptTopologicalCheck: 'Topological check',
  sculptMoveAlongNormal: 'Move along normal (N or -Alt)',
  sculptMaskingClear: 'Clear (-Ctrl + Drag)',
  sculptMaskingInvert: 'Invert (-Ctrl + Click)',
  sculptMaskingBlur: 'Blur',
  sculptMaskingSharpen: 'Sharpen',
  sculptPBRTitle: 'PBR materials',
  sculptPaintAll: 'Paint all',
  sculptExtractTitle: 'Extract',
  sculptExtractThickness: 'Thickness',
  sculptExtractAction: 'Extract !',
  sculptTopology: 'Topology',
  sculptTopologyDetail: 'Detail level',
  sculptTopologyDecimate: 'Decimate (simplify)',

  // states
  stateTitle: 'History',
  stateUndo: 'Undo',
  stateRedo: 'Redo',
  stateMaxStack: 'Max Stack',

  // pressure
  pressureTitle: 'Tablet pressure',
  pressureRadius: 'Pressure radius',
  pressureIntensity: 'Pressure intensity',
  pressureInput: 'Tablet API',
  pressureInputWindowsInk: 'Windows Ink (PointerEvents)',
  pressureInputWintab: 'Wintab (Wacom)',
  pressureStatusWinTabActive: 'Status: WinTab Active',
  pressureStatusWinTabInactive: 'Status: WinTab Inactive (no device?)',
  pressureStatusWindowsInk: 'Status: Windows Ink (PointerEvents)',
  pressureLivePressure: 'Pressure: ',

  // rendering
  renderingTitle: 'Rendering',
  renderingGrid: 'Show grid',
  renderingSymmetryLine: 'Show mirror line',
  renderingMatcap: 'Matcap',
  renderingCurvature: 'Curvature',
  renderingPBR: 'PBR',
  renderingTransparency: 'Transparency',
  renderingNormal: 'Normal shader',
  renderingUV: 'UV shader',
  renderingShader: 'Shader',
  renderingMaterial: 'Material',
  renderingImportUV: 'Import (jpg, png...)',
  renderingImportMatcap: 'Import (jpg, png...)',
  renderingExtra: 'Extra',
  renderingFlat: 'Flat shading',
  renderingWireframe: 'Wireframe',
  renderingExposure: 'Exposure',
  renderingEnvironment: 'Environment',
  renderingIsolate: 'Isolate/Show (I)',
  renderingFilmic: 'Filmic tonemapping',

  // contour
  contour: 'Contour',
  contourShow: 'Show contour',
  contourColor: 'Color',
  darkenUnselected: 'Darken unselected',

  // pixel ratio
  resolution: 'Resolution',

  // matcaps
  matcapPearl: 'Pearl',
  matcapClay: 'Clay',
  matcapSkin: 'Skin',
  matcapGreen: 'Green',
  matcapWhite: 'White',

  // sketchfab
  sketchfabTitle: 'Go to Sketchfab !',
  sketchfabUpload: 'Upload',
  sketchfabUploadMessage: 'Please enter your sketchfab API Key.\n' +
    'You can also leave "guest" to upload anonymously.\n' +
    '(a new window will pop up when the uploading and processing is finished)',
  sketchfabUploadError: function (error) {
    return 'Sketchfab upload error :\n' + error;
  },
  sketchfabUploadSuccess: 'Upload success !\nHere is your link :',
  sketchfabAbort: 'Abort the last upload ?',
  sketchfabUploadProcessing: 'Processing...\nYour model will be available at :',

  about: 'About & Help',
  measureTitle: 'Segment Measure',
  measureEnable: 'Active',
  measureClear: 'Clear All',
  measureDistanceThickness: 'Distance thickness',

  alphaNone: 'None',
  alphaSquare: 'Square',
  alphaSkin: 'Skin',
  alphaMy8: 'Alpha My8',

  remeshTitleMC: 'Voxel remeshing (manifold tris)',
  remeshRemeshMC: 'Remesh',
  remeshSmoothingMC: 'Relax topology',
  remeshVoxelSize: function (val) {
    return 'Voxel size ≈ ' + val;
  },
  remeshResolutionTooHigh: function (maxRes) {
    return 'Resolution is too high (memory limit exceeded).\nMaximum recommended resolution for this model is ~' + maxRes + '.';
  }
};

export default TR;
