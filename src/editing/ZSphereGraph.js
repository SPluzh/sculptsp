import { vec3 } from 'gl-matrix';

class ZSphereNode {
  constructor(position, radius, parent = null) {
    this.id = ZSphereNode._nextId++;
    this.position = vec3.clone(position);
    this.radius = radius;
    this.parent = parent;
    this.children = [];
  }
}
ZSphereNode._nextId = 0;

class ZSphereGraph {
  constructor() {
    this._root = null;
    this._nodes = []; // Flat list of nodes
  }

  getRoot() {
    return this._root;
  }

  getNodes() {
    return this._nodes;
  }

  addRoot(position, radius) {
    this.clear();
    this._root = new ZSphereNode(position, radius, null);
    this._nodes.push(this._root);
    return this._root;
  }

  addChild(parent, position, radius) {
    if (!parent) return null;
    const node = new ZSphereNode(position, radius, parent);
    parent.children.push(node);
    this._nodes.push(node);
    return node;
  }

  removeNode(node) {
    if (!node) return;
    // Recursive remove helper
    const removeSubtree = (n) => {
      // Remove all children first
      const childrenCopy = n.children.slice();
      for (let i = 0; i < childrenCopy.length; ++i) {
        removeSubtree(childrenCopy[i]);
      }
      // Remove from flat nodes array
      const idx = this._nodes.indexOf(n);
      if (idx !== -1) {
        this._nodes.splice(idx, 1);
      }
    };

    if (node === this._root) {
      this.clear();
    } else {
      // Remove from parent's children
      if (node.parent) {
        const idx = node.parent.children.indexOf(node);
        if (idx !== -1) {
          node.parent.children.splice(idx, 1);
        }
      }
      removeSubtree(node);
    }
  }

  mergeNodes(nodeA, nodeB) {
    if (!nodeA || !nodeB || nodeA === nodeB) return;

    let isChild = (nodeB.parent === nodeA);

    const children = nodeA.children.slice();
    for (let i = 0; i < children.length; ++i) {
      const child = children[i];
      if (child !== nodeB) {
        child.parent = nodeB;
        if (nodeB.children.indexOf(child) === -1) {
          nodeB.children.push(child);
        }
      }
    }
    nodeA.children = [];

    if (nodeA.parent) {
      const idx = nodeA.parent.children.indexOf(nodeA);
      if (idx !== -1) {
        nodeA.parent.children.splice(idx, 1);
      }
    }

    if (isChild) {
      nodeB.parent = nodeA.parent;
      if (nodeB.parent) {
        nodeB.parent.children.push(nodeB);
      }
    }

    const idx = this._nodes.indexOf(nodeA);
    if (idx !== -1) {
      this._nodes.splice(idx, 1);
    }

    if (nodeA === this._root) {
      this._root = nodeB;
      if (nodeB.parent) {
        const pIdx = nodeB.parent.children.indexOf(nodeB);
        if (pIdx !== -1) {
          nodeB.parent.children.splice(pIdx, 1);
        }
        nodeB.parent = null;
      }
    }
  }

  clear() {
    this._root = null;
    this._nodes = [];
  }

  serialize() {
    // Return a JSON-serializable representation of the graph
    return this._nodes.map(node => {
      return {
        id: node.id,
        position: Array.from(node.position),
        radius: node.radius,
        parentId: node.parent ? node.parent.id : null
      };
    });
  }

  deserialize(data) {
    this.clear();
    if (!data || data.length === 0) return;

    // Reset ID counter to make sure it's valid
    let maxId = -1;

    // First pass: create node instances (without children/parent references resolved yet)
    const idMap = new Map();
    data.forEach(item => {
      const node = new ZSphereNode(vec3.fromValues(item.position[0], item.position[1], item.position[2]), item.radius, null);
      node.id = item.id;
      idMap.set(node.id, node);
      if (node.id > maxId) maxId = node.id;
    });

    ZSphereNode._nextId = maxId + 1;

    // Second pass: hook up parent/child relations
    data.forEach(item => {
      const node = idMap.get(item.id);
      if (item.parentId === null) {
        this._root = node;
      } else {
        const parent = idMap.get(item.parentId);
        if (parent) {
          node.parent = parent;
          parent.children.push(node);
        }
      }
      this._nodes.push(node);
    });
  }
}

export default ZSphereGraph;
export { ZSphereNode };
