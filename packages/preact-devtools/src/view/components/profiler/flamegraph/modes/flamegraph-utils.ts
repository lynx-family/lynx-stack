import { NodeTransform } from '../shared';
import { ID, DevNode } from '../../../../store/types';

export interface FlameNodeTransform extends NodeTransform {
  /** Relative start position to root node (without zoom) */
  start: number;
  /** Relative end position to root node (without zoom) */
  end: number;
}

/**
 * The default layout that's typical for a flamegraph chart.
 */
export function placeFlamegraph(
  tree: Map<ID, DevNode>,
  idToTransform: Map<ID, NodeTransform>,
  rootId: ID,
  selectedId: ID,
  canvasWidth: number,
): NodeTransform[][] {
  const maximizedIds = new Set<ID>([selectedId]);
  const commitParentIds = new Set<ID>();

  let parentId = tree.get(rootId)!.parent;
  while (parentId !== -1) {
    const node = tree.get(parentId);
    if (node === undefined) break;
    commitParentIds.add(parentId);
    parentId = node.parent;
  }

  // Account for commits not having the currently selected node
  // TODO: Move this logic elsewhere
  const selected = !tree.has(selectedId)
    ? tree.get(rootId)!
    : tree.get(selectedId)!;

  parentId = selected.parent;
  while (parentId !== -1) {
    const node = tree.get(parentId);
    if (node === undefined) break;
    maximizedIds.add(parentId);
    parentId = node.parent;
  }

  let offset = 0;
  let scale = 1;

  const selectedPos = idToTransform.get(selectedId);
  if (selectedPos !== undefined) {
    offset = selectedPos.x;
    scale = canvasWidth / selectedPos.width;
  }

  const byRow: NodeTransform[][] = [];

  idToTransform.forEach(pos => {
    let start;
    let width;
    let hidden = false;
    if (maximizedIds.has(pos.id)) {
      start = 0;
      width = canvasWidth;
    } else {
      start = (pos.x - offset) * scale;
      width = pos.width * scale;

      // Hide other sibling nodes of maximized nodes
      const node = tree.get(pos.id)!;
      if (node && node.parent !== -1 && maximizedIds.has(node.parent)) {
        const parent = tree.get(node.parent)!;
        if (parent.children.length > 1) {
          hidden = parent.children.some(childId => maximizedIds.has(childId));
        }
      }
    }

    const visible = hidden ? false : start >= 0 && start <= canvasWidth;

    if (pos.row >= byRow.length) {
      byRow.push([]);
    }

    byRow[pos.row].push({
      ...pos,
      x: start,
      width,
      maximized: maximizedIds.has(pos.id),
      visible,
    });
  });

  return byRow;
}
