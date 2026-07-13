/**
 * UIPopup — плавающее контекстное окно.
 *
 * Открывается у позиции курсора (pageX/pageY), автоматически
 * позиционируется внутри экрана, закрывается по клику вне попапа.
 *
 * Использует CSS-класс `.ui-popup` из yagui.css.
 *
 * Использование:
 *   const popup = new UIPopup();
 *   canvas.addEventListener('contextmenu', e => {
 *     e.preventDefault();
 *     popup.open(e.pageX, e.pageY, container => {
 *       // добавляем контент в container (HTMLElement)
 *     });
 *   });
 */
class UIPopup {
  constructor() {
    this._dom = document.createElement('div');
    this._dom.className = 'ui-popup';
    this._dom.style.display = 'none';
    this._dom.style.position = 'fixed';
    document.body.appendChild(this._dom);

    this._closeHandler = null;
  }

  /**
   * Открыть попап у позиции (x, y).
   * @param {number}   x       — pageX
   * @param {number}   y       — pageY
   * @param {Function} buildFn — callback(container: HTMLElement)
   */
  open(x, y, buildFn) {
    // Закрыть предыдущий экземпляр, если был
    this._unbindClose();

    this._dom.innerHTML = '';
    if (buildFn) buildFn(this._dom);
    this._dom.style.display = 'block';

    // Позиционируем после отображения (нужен реальный размер)
    requestAnimationFrame(() => {
      this._positionPopup(x, y);
    });

    this._bindClose();
  }

  /** Закрыть попап */
  close() {
    this._dom.style.display = 'none';
    this._unbindClose();
  }

  /** Удалить DOM-элемент */
  destroy() {
    this._unbindClose();
    if (this._dom && this._dom.parentNode) {
      this._dom.parentNode.removeChild(this._dom);
    }
    this._dom = null;
  }

  // ---- private ----

  _positionPopup(x, y) {
    if (!this._dom) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const rect = this._dom.getBoundingClientRect();
    const px = (x + rect.width  > W) ? x - rect.width  : x;
    const py = (y + rect.height > H) ? y - rect.height : y;
    this._dom.style.left = Math.max(0, px) + 'px';
    this._dom.style.top  = Math.max(0, py) + 'px';
  }

  _bindClose() {
    this._closeHandler = (e) => {
      if (this._dom && !this._dom.contains(e.target)) {
        this.close();
      }
    };
    // Откладываем подписку — иначе тот же клик, который открыл попап, сразу его закроет
    setTimeout(() => {
      document.addEventListener('pointerdown', this._closeHandler);
    }, 0);
  }

  _unbindClose() {
    if (this._closeHandler) {
      document.removeEventListener('pointerdown', this._closeHandler);
      this._closeHandler = null;
    }
  }
}

export default UIPopup;
