/**
 * Indicator — всплывающий HUD-индикатор для модальных изменений параметров.
 *
 * Заменяет ~35 строк дублированного DOM-кода, которые ранее
 * повторялись в GuiSculpting (×3), GuiCamera (×1) и GuiTopology (×1).
 */
class Indicator {
  /**
   * @param {object} opts
   * @param {string} opts.label     - текст метки (напр. 'Intensity')
   * @param {string} [opts.color]   - цвет fill и value (default '#3b97e3')
   * @param {string} [opts.unit]    - суффикс значения (напр. '%', ' mm', '')
   * @param {number} [opts.min]     - для нормализации fill (default 0)
   * @param {number} [opts.max]     - для нормализации fill (default 100)
   */
  constructor(opts = {}) {
    this._label = opts.label || '';
    this._color = opts.color || '#3b97e3';
    this._unit  = opts.unit  !== undefined ? opts.unit : '';
    this._min   = opts.min   !== undefined ? opts.min  : 0;
    this._max   = opts.max   !== undefined ? opts.max  : 100;

    this._build();
  }

  _build() {
    var indicator = this._dom = document.createElement('div');
    indicator.style.position        = 'absolute';
    indicator.style.background      = 'rgba(20, 20, 20, 0.85)';
    indicator.style.backdropFilter  = 'blur(6px)';
    indicator.style.webkitBackdropFilter = 'blur(6px)';
    indicator.style.color           = '#ffffff';
    indicator.style.padding         = '8px 12px';
    indicator.style.borderRadius    = '6px';
    indicator.style.fontFamily      = "'Open Sans', sans-serif";
    indicator.style.fontSize        = '12px';
    indicator.style.fontWeight      = '600';
    indicator.style.pointerEvents   = 'none';
    indicator.style.display         = 'none';
    indicator.style.zIndex          = '99999';
    indicator.style.border          = '1px solid rgba(255, 255, 255, 0.15)';
    indicator.style.boxShadow       = '0 6px 20px rgba(0, 0, 0, 0.4)';
    indicator.style.minWidth        = '110px';
    indicator.style.flexDirection   = 'column';
    indicator.style.gap             = '6px';
    indicator.style.transform       = 'translate(-50%, -100%)';
    indicator.style.webkitTransform = 'translate(-50%, -100%)';

    var row = document.createElement('div');
    row.style.display        = 'flex';
    row.style.justifyContent = 'space-between';
    indicator.appendChild(row);

    this._labelText  = document.createElement('span');
    this._labelValue = document.createElement('span');
    this._labelValue.style.color = this._color;
    row.appendChild(this._labelText);
    row.appendChild(this._labelValue);

    var track = document.createElement('div');
    track.style.width        = '100%';
    track.style.height       = '5px';
    track.style.background   = 'rgba(255, 255, 255, 0.2)';
    track.style.borderRadius = '3px';
    track.style.overflow     = 'hidden';

    this._fill = document.createElement('div');
    this._fill.style.width        = '0%';
    this._fill.style.height       = '100%';
    this._fill.style.background   = this._color;
    this._fill.style.borderRadius = '3px';
    this._fill.style.transition   = 'width 0.05s ease-out';

    track.appendChild(this._fill);
    indicator.appendChild(track);

    document.body.appendChild(indicator);
  }

  /**
   * Показать индикатор у позиции (x, y) со значением val.
   * fillPercent необязателен — по умолчанию нормализуется через [min, max].
   *
   * @param {number} x
   * @param {number} y
   * @param {number} val           - отображаемое значение
   * @param {number} [fillPercent] - явный процент заполнения (0–100), если нужна нестандартная нормализация
   */
  show(x, y, val, fillPercent) {
    if (fillPercent === undefined) {
      var range = this._max - this._min;
      fillPercent = range !== 0 ? Math.max(0, Math.min(100, (val - this._min) / range * 100)) : 0;
    }

    this._labelText.textContent  = this._label;
    this._labelValue.textContent = val + this._unit;
    this._fill.style.width       = fillPercent + '%';
    this._dom.style.left         = x + 'px';
    this._dom.style.top          = (y - 25) + 'px';
    this._dom.style.display      = 'flex';
  }

  /** Скрыть индикатор */
  hide() {
    if (this._dom) this._dom.style.display = 'none';
  }

  /** Убрать DOM-элемент */
  destroy() {
    if (this._dom && this._dom.parentNode) {
      this._dom.parentNode.removeChild(this._dom);
    }
    this._dom = null;
  }
}

export default Indicator;
