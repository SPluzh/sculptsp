import SculptBase from './SculptBase.js';

class Visibility extends SculptBase {
  constructor(main) {
    super(main);
  }

  start(ctrl) {
    return false;
  }

  update() {}

  postRender(selection, camera, vpX) {}
}

export default Visibility;
