import TR from './GuiTR.js';
import ShaderContour from '../render/shaders/ShaderContour.js';

class GuiConfig {

  constructor(guiParent, ctrlGui) {
    this._ctrlGui = ctrlGui;
    this._main = ctrlGui._main;
    this._menu = null; // ui menu
    this.init(guiParent);
  }

  init(guiParent) {
    // config/settings folder
    var menu = this._menu = guiParent.addMenu('Settings');

    // Language setting
    this._langs = Object.keys(TR.languages);
    menu.addTitle('Language');
    menu.addCombobox('', this._langs.indexOf(TR.select), this.onLangChange.bind(this), this._langs);

    // Interface / Contour
    menu.addTitle(TR('contour'));
    menu.addColor(TR('contourColor'), ShaderContour.color, this.onContourColor.bind(this));

    // Resolution
    menu.addTitle(TR('resolution'));
    menu.addSlider('', this._main._pixelRatio, this.onPixelRatio.bind(this), 0.5, 2.0, 0.02);
  }

  onLangChange(value) {
    TR.select = this._langs[parseInt(value, 10)];
    this._ctrlGui.initGui();
  }

  onPixelRatio(val) {
    this._main._pixelRatio = val;
    this._main.onCanvasResize();
  }

  onContourColor(col) {
    ShaderContour.color[0] = col[0];
    ShaderContour.color[1] = col[1];
    ShaderContour.color[2] = col[2];
    ShaderContour.color[3] = col[3];
    this._main.render();
  }
}

export default GuiConfig;
