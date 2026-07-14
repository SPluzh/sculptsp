import Enums from '../misc/Enums.js';

import ShaderPBR from './shaders/ShaderPBR.js';
import ShaderMatcap from './shaders/ShaderMatcap.js';
import ShaderNormal from './shaders/ShaderNormal.js';
import ShaderUV from './shaders/ShaderUV.js';
import ShaderWireframe from './shaders/ShaderWireframe.js';
import ShaderFlat from './shaders/ShaderFlat.js';
import ShaderSelection from './shaders/ShaderSelection.js';
import ShaderWetClay from './shaders/ShaderWetClay.js';

import ShaderBackground from './shaders/ShaderBackground.js';
import ShaderMerge from './shaders/ShaderMerge.js';
import ShaderFxaa from './shaders/ShaderFxaa.js';
import ShaderContour from './shaders/ShaderContour.js';

import ShaderPaintUV from './shaders/ShaderPaintUV.js';
import ShaderBlur from './shaders/ShaderBlur.js';
import ShaderZSphere from './shaders/ShaderZSphere.js';
import ShaderRefImage from './shaders/ShaderRefImage.js';
import ShaderViewport2D from './shaders/ShaderViewport2D.js';

var ShaderLib = [];

// 3D shaders
ShaderLib[Enums.Shader.PBR] = ShaderPBR;
ShaderLib[Enums.Shader.MATCAP] = ShaderMatcap;
ShaderLib[Enums.Shader.NORMAL] = ShaderNormal;
ShaderLib[Enums.Shader.UV] = ShaderUV;
ShaderLib[Enums.Shader.WIREFRAME] = ShaderWireframe;
ShaderLib[Enums.Shader.FLAT] = ShaderFlat;
ShaderLib[Enums.Shader.SELECTION] = ShaderSelection;
ShaderLib[Enums.Shader.WETCLAY] = ShaderWetClay;

// 2D screen shaders
ShaderLib[Enums.Shader.BACKGROUND] = ShaderBackground;
ShaderLib[Enums.Shader.MERGE] = ShaderMerge;
ShaderLib[Enums.Shader.FXAA] = ShaderFxaa;
ShaderLib[Enums.Shader.CONTOUR] = ShaderContour;

ShaderLib[Enums.Shader.PAINTUV] = ShaderPaintUV;
ShaderLib[Enums.Shader.BLUR] = ShaderBlur;
ShaderLib[Enums.Shader.ZSPHERE] = ShaderZSphere;
ShaderLib[Enums.Shader.REF_IMAGE] = ShaderRefImage;
ShaderLib[Enums.Shader.VIEWPORT2D] = ShaderViewport2D;

export default ShaderLib;
