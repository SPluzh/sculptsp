# Plan: Отделяемый вьюпорт (Popup Window)

## Подход

`window.open()` + 2D canvas blit. Каждый кадр копируем нужный регион
основного WebGL-canvas в отдельный `<canvas>` в popup-окне через `drawImage()`.

**Почему не Document PiP API:**  
PiP запрещает `requestFullscreen()` — нельзя развернуть на весь монитор.  
`window.open()` — обычное окно браузера: перетаскивается на любой монитор,
разворачивается через кнопку внутри окна или F11.

---

## Архитектура

```
Основной window
  #canvas (WebGL)
     [left vp][right vp]
          │
          │ drawImage() — GPU blit, каждый кадр
          ▼
popup window
  <canvas id="vp-canvas"> ← 2D, зеркало правого (или единственного) вьюпорта
  [⛶ Fullscreen]           ← requestFullscreen() на весь второй монитор
```

**Режим blit:**
- Split активен → правая половина canvas (`srcX = halfW`)
- Split выключен → весь canvas (`srcX = 0`)

---

## Файлы

| Файл | Действие | ~строк |
|---|---|---|
| `src/misc/PopupViewport.js` | Новый модуль | ~110 |
| `src/Scene.js` | Поле, методы, blit в applyRender | ~45 |
| `src/gui/GuiCamera.js` | Кнопка-переключатель | ~25 |
| `src/gui/Gui.js` | Делегат `updatePopupButton()` | ~5 |
| `src/gui/tr/english.js` | 4 новые строки | ~4 |
| `src/gui/tr/russian.js` | 4 новые строки | ~4 |

**Итого: ~193 строки.**

---

## Шаг 1 — `src/misc/PopupViewport.js` (новый файл)

```js
class PopupViewport {
  constructor() {
    this._win    = null;   // Window  — открытое popup-окно
    this._canvas = null;   // <canvas> в popup (2D)
    this._ctx    = null;   // CanvasRenderingContext2D
    this._onClose = null;  // callback при закрытии пользователем
  }

  get isOpen() {
    return !!(this._win && !this._win.closed);
  }

  /** Открыть popup. Требует user gesture (клик кнопки). */
  open(cssW, cssH, onClose) {
    if (this.isOpen) { this._win.focus(); return; }

    var features = [
      'width='  + Math.round(cssW),
      'height=' + Math.round(cssH),
      'menubar=no', 'toolbar=no', 'location=no',
      'status=no', 'scrollbars=no', 'resizable=yes'
    ].join(',');

    var win = this._win = window.open('about:blank', 'sculptsp_vp2', features);
    if (!win) {
      alert('Popup заблокирован. Разрешите всплывающие окна для этого сайта.');
      return;
    }

    this._onClose = onClose;
    this._buildDOM(win, cssW, cssH);

    // Следим за закрытием крестиком
    win.addEventListener('unload', () => {
      setTimeout(() => {
        if (this._win && this._win.closed) {
          this._win = null;
          this._canvas = null;
          this._ctx = null;
          if (this._onClose) this._onClose();
        }
      }, 100);
    });
  }

  _buildDOM(win, cssW, cssH) {
    var doc = win.document;
    doc.title = 'SculptSP — Viewport 2';

    var style = doc.createElement('style');
    style.textContent = `
      * { margin:0; padding:0; box-sizing:border-box; }
      body { background:#111; overflow:hidden; display:flex;
             flex-direction:column; width:100vw; height:100vh; }
      #vp-bar { display:flex; align-items:center; justify-content:flex-end;
                background:#1a1a1a; height:32px; padding:0 8px;
                border-bottom:1px solid #333; flex-shrink:0; }
      #vp-label { flex:1; color:#888; font-size:11px;
                  font-family:sans-serif; letter-spacing:0.05em; }
      #vp-btn-fs { background:#2a2a2a; border:1px solid #444; color:#ccc;
                   font-size:13px; padding:2px 10px; border-radius:4px;
                   cursor:pointer; font-family:sans-serif; }
      #vp-btn-fs:hover { background:#3a3a3a; color:#fff; }
      #vp-canvas { display:block; flex:1; width:100%; }
    `;
    doc.head.appendChild(style);

    var bar = doc.createElement('div'); bar.id = 'vp-bar';
    var label = doc.createElement('span'); label.id = 'vp-label';
    label.textContent = 'SculptSP · Viewport 2 · Read-only';
    bar.appendChild(label);

    var btn = doc.createElement('button'); btn.id = 'vp-btn-fs';
    btn.textContent = '⛶ Fullscreen';
    btn.addEventListener('click', () => {
      if (!doc.fullscreenElement)
        this._canvas && this._canvas.requestFullscreen();
      else
        doc.exitFullscreen && doc.exitFullscreen();
    });
    bar.appendChild(btn);
    doc.body.appendChild(bar);

    var canvas = this._canvas = doc.createElement('canvas');
    canvas.id = 'vp-canvas';
    canvas.width  = cssW;
    canvas.height = cssH;
    doc.body.appendChild(canvas);
    this._ctx = canvas.getContext('2d');
  }

  /** Обновить разрешение canvas в popup (в физических пикселях источника). */
  updateResolution(srcW, srcH) {
    if (!this._canvas) return;
    this._canvas.width  = srcW;
    this._canvas.height = srcH;
  }

  /** Копировать регион srcCanvas → popup canvas. Вызывается каждый кадр. */
  blit(srcCanvas, srcX, srcY, srcW, srcH) {
    if (!this._ctx || !this.isOpen) return;
    this._ctx.drawImage(
      srcCanvas,
      srcX, srcY, srcW, srcH,
      0, 0, this._canvas.width, this._canvas.height
    );
  }

  close() {
    if (this._win && !this._win.closed) this._win.close();
    this._win = null;
    this._canvas = null;
    this._ctx = null;
  }
}

export default PopupViewport;
```

---

## Шаг 2 — `src/Scene.js`

### 2а. Импорт + поле

```js
import PopupViewport from './misc/PopupViewport.js';

// В constructor():
this._popup = new PopupViewport();
```

### 2б. Геттер

```js
getPopup() { return this._popup; }
```

### 2в. Методы toggle/open/close

```js
openPopupViewport() {
  var pr  = this._pixelRatio;
  var srcW = this._splitMode
    ? Math.floor(this._canvasWidth / 2)
    : this._canvasWidth;
  var srcH = this._canvasHeight;

  this._popup.open(
    Math.round(srcW / pr),
    Math.round(srcH / pr),
    () => { this._gui.updatePopupButton(); }
  );
  this._popup.updateResolution(srcW, srcH);
  this.render();
}

closePopupViewport() {
  this._popup.close();
  this._gui.updatePopupButton();
}

togglePopupViewport() {
  if (this._popup.isOpen) this.closePopupViewport();
  else this.openPopupViewport();
}
```

### 2г. Внутренний blit

```js
_blitToPopup() {
  var W = this._canvasWidth, H = this._canvasHeight;
  if (this._splitMode) {
    var halfW = Math.floor(W / 2);
    this._popup.blit(this._canvas, halfW, 0, halfW, H);
  } else {
    this._popup.blit(this._canvas, 0, 0, W, H);
  }
}
```

### 2д. Вызов в `applyRender()` — добавить в конец:

```js
if (this._popup.isOpen) this._blitToPopup();
```

### 2е. В `onCanvasResize()` — добавить перед `this.render()`:

```js
if (this._popup && this._popup.isOpen) {
  var pw = this._splitMode
    ? Math.floor(newWidth / 2) : newWidth;
  this._popup.updateResolution(pw, newHeight);
}
```

### 2ж. В `setSplitMode()` — добавить перед `this.render()`:

```js
if (this._popup && this._popup.isOpen) {
  var pw = mode
    ? Math.floor(this._canvasWidth / 2) : this._canvasWidth;
  this._popup.updateResolution(pw, this._canvasHeight);
}
```

---

## Шаг 3 — `src/gui/GuiCamera.js`

### 3а. В `init()` — после блока split viewport (после строки 150):

```js
// popup viewport
menu.addTitle(TR('popupViewportTitle'));
this._ctrlPopupBtn = menu.addButton(
  TR('popupViewportOpen'), this, 'onTogglePopup'
);
```

### 3б. Новые методы:

```js
onTogglePopup() {
  this._main.togglePopupViewport();
  this.updatePopupButton();
}

updatePopupButton() {
  if (!this._ctrlPopupBtn) return;
  var isOpen = this._main.getPopup().isOpen;
  // Найти DOM-кнопку виджета (зависит от yagui API — уточнить при реализации)
  var domEl = this._ctrlPopupBtn.domButton || this._ctrlPopupBtn._dom;
  if (domEl) {
    domEl.textContent = isOpen
      ? TR('popupViewportClose')
      : TR('popupViewportOpen');
  }
}
```

---

## Шаг 4 — `src/gui/Gui.js`

Добавить делегат (чтобы Scene мог вызвать через `this._gui`):

```js
updatePopupButton() {
  if (this._camera) this._camera.updatePopupButton();
}
```

---

## Шаг 5 — Переводы

### `src/gui/tr/english.js` — после блока `splitViewport`:

```js
// popup viewport
popupViewportTitle: 'Detach Viewport',
popupViewportOpen:  '⧉ Open in new window',
popupViewportClose: '✕ Close detached window',
```

### `src/gui/tr/russian.js` — после блока `splitViewport`:

```js
// popup viewport
popupViewportTitle: 'Отделить вьюпорт',
popupViewportOpen:  '⧉ Открыть в новом окне',
popupViewportClose: '✕ Закрыть отдельное окно',
```

---

## Edge cases

| Ситуация | Решение |
|---|---|
| Popup заблокирован браузером | `alert()` с объяснением |
| Пользователь закрыл окно крестиком | `unload` → callback → обновить кнопку GUI |
| Split-режим меняется при открытом popup | `setSplitMode()` → `popup.updateResolution()` |
| Resize главного окна | `onCanvasResize()` → `popup.updateResolution()` |
| Y-flip изображения (если возникнет) | CSS `transform: scaleY(-1)` на `#vp-canvas` |

---

## Что НЕ поддерживается (read-only зеркало)

- Вращение/скульпт мышью прямо в popup — нет
- Собственная независимая камера — нет (только зеркало)

Полная интерактивность потребует второго WebGL-контекста +
`BroadcastChannel` для синхронизации — отдельный большой scope.
