/**
 * UIAdapter — тонкая обёртка над yagui.
 *
 * Фаза 3 плана: единственная точка замены в Gui.js:
 *   import yagui from './ui/UIAdapter.js';
 *
 * На первом шаге UIAdapter просто реэкспортирует yagui — 
 * поведение идентично, риск нулевой.
 *
 * В дальнейшем нативные компоненты добавляются сюда по одному,
 * без изменения Gui*.js.
 */
import yagui from 'yagui';

export default yagui;
