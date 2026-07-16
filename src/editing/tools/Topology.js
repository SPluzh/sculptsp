import Enums from '../../misc/Enums.js';
import Utils from '../../misc/Utils.js';
import SculptBase from './SculptBase.js';
import Remesh from '../Remesh.js';

class Topology extends SculptBase {

  constructor(main) {
    super(main);

    this._radius = 50;
    this._spacing = 0.15;
    this._dynTopoInfluence = true;
  }

  stroke(picking, sym) {
    var mesh = this.getMesh();

    if (!mesh.isDynamic)
      return;

    var iVertsInRadius = picking.getPickedVertices();
    if (!iVertsInRadius.length)
      return;

    this._main.getStateManager().pushVertices(iVertsInRadius);

    iVertsInRadius = this.dynamicTopologyLocal(picking);

    if (!iVertsInRadius.length)
      return;

    var iFaces = mesh.getFacesFromVertices(iVertsInRadius);
    mesh.updateGeometry(iFaces, iVertsInRadius);
  }

  dynamicTopologyLocal(picking) {
    var mesh = this.getMesh();
    var iVerts = picking.getPickedVertices();

    if (iVerts.length === 0) {
      iVerts = mesh.getVerticesFromFaces([picking.getPickedFace()]);
      this._main.getStateManager().pushVertices(iVerts);
    }

    var iFaces = mesh.getFacesFromVertices(iVerts);
    var radius2 = picking.getLocalRadius2();
    var center = picking.getIntersectionPoint();

    this._main.getStateManager().pushFaces(iFaces);

    // Calculate target edge length based on Remesh.RESOLUTION
    var bound = mesh.getLocalBound();
    var maxDim = Math.max(
      (bound[3] - bound[0]),
      (bound[4] - bound[1]),
      (bound[5] - bound[2])
    );
    
    var step = maxDim / Remesh.RESOLUTION;
    
    // Multiplier to match voxel size from remesh
    // Target edge length squared: step^2 * 32.0 gives edge length ≈ 5.66 * step
    var d2Max = (step * step) * 32.0;

    // Get subdivision and decimation factors from mesh
    var subFactor = mesh.getSubdivisionFactor();
    var decFactor = mesh.getDecimationFactor();

    // Early exit if both factors are zero
    if (subFactor === 0.0 && decFactor === 0.0) {
      iVerts = mesh.getVerticesFromFaces(iFaces);
      var nbVerts = iVerts.length;
      var sculptFlag = Utils.SCULPT_FLAG;
      var vscf = mesh.getVerticesSculptFlags();
      var iVertsInRadius = new Uint32Array(Utils.getMemory(nbVerts * 4), 0, nbVerts);
      var acc = 0;

      for (var i = 0; i < nbVerts; ++i) {
        var iVert = iVerts[i];
        if (vscf[iVert] === sculptFlag)
          iVertsInRadius[acc++] = iVert;
      }

      iVertsInRadius = new Uint32Array(iVertsInRadius.subarray(0, acc));
      mesh.updateTopology(iFaces, iVerts);

      return iVertsInRadius;
    }

    // Apply factors to thresholds (matching SculptBase approach)
    var d2MaxAdjusted = d2Max;
    if (subFactor > 0)
      d2MaxAdjusted = d2Max * (1.1 - subFactor);

    var d2Min = (d2MaxAdjusted / 4.2025) * decFactor;

    // Perform subdivision if factor > 0
    if (subFactor)
      iFaces = mesh.subdivide(iFaces, center, radius2, d2MaxAdjusted, this._main.getStateManager());

    // Perform decimation if factor > 0
    if (decFactor)
      iFaces = mesh.decimate(iFaces, center, radius2, d2Min, this._main.getStateManager());

    iVerts = mesh.getVerticesFromFaces(iFaces);

    var nbVerts = iVerts.length;
    var sculptFlag = Utils.SCULPT_FLAG;
    var vscf = mesh.getVerticesSculptFlags();
    var iVertsInRadius = new Uint32Array(Utils.getMemory(nbVerts * 4), 0, nbVerts);
    var acc = 0;

    for (var i = 0; i < nbVerts; ++i) {
      var iVert = iVerts[i];
      if (vscf[iVert] === sculptFlag)
        iVertsInRadius[acc++] = iVert;
    }

    iVertsInRadius = new Uint32Array(iVertsInRadius.subarray(0, acc));
    mesh.updateTopology(iFaces, iVerts);

    return iVertsInRadius;
  }

  preUpdate(canBeContinuous) {
    var main = this._main;
    var picking = main.getPicking();
    var isSculpting = main._action === Enums.Action.SCULPT_EDIT;

    if (isSculpting && !canBeContinuous)
      return;

    if (isSculpting)
      picking.intersectionMouseMesh();
    else
      picking.intersectionMouseMeshes();

    var mesh = picking.getMesh();
    if (mesh && mesh.isDynamic && main.getSculptManager().getSymmetry())
      main.getPickingSymmetry().intersectionMouseMesh(mesh);
  }
}

export default Topology;
