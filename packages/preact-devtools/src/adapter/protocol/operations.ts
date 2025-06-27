import { ID, Tree } from '../../view/store/types';
import { parseTable } from './string-table';
import { MsgTypes } from './events-types';
import { deepClone } from '../shared/utils';
import { RenderReasonMap } from '../shared/renderReasons';
import { ParsedStats, parseStats } from '../shared/stats';

/**
 * This is the heart of the devtools. Here we translate incoming events
 * and construct the tree data structure which all operations in the
 * Devtools UI are based upon.
 *
 * We currently expect all operations to be in order.
 */
export function ops2Tree(oldTree: Tree, existingRoots: ID[], ops: number[]) {
  const pending: Tree = new Map(oldTree);
  const rootId = ops[0];
  const roots: ID[] = [...existingRoots];
  const removals: ID[] = [];
  const rendered = new Set<ID>();
  const reasons: RenderReasonMap = new Map();
  let stats: ParsedStats | null = null;

  let i = ops[1] + 1;
  const strings = parseTable(ops.slice(1, i + 1));

  for (i += 1; i < ops.length; i++) {
    switch (ops[i]) {
      case MsgTypes.ADD_ROOT:
        roots.push(ops[i + 1]);
        i += 1;
        break;
      case MsgTypes.ADD_VNODE: {
        const id = ops[i + 1];
        const parentId = ops[i + 3];
        const parent = pending.get(parentId);
        if (parent) {
          const clone = deepClone(parent);
          pending.set(parent.id, clone);
          clone.children.push(id);
        }

        pending.set(id, {
          children: [],
          depth: parent ? parent.depth + 1 : 0,
          id,
          hocs: null,
          name: strings[ops[i + 5] - 1],
          owner: ops[i + 4],
          parent: parentId,
          type: ops[i + 2],
          key: ops[i + 6] > 0 ? strings[ops[i + 6] - 1] : '',
          startTime: ops[i + 7] / 1000,
          endTime: ops[i + 8] / 1000,
        });

        rendered.add(id);

        i += 8;
        break;
      }
      case MsgTypes.UPDATE_VNODE_TIMINGS: {
        const id = ops[i + 1];
        pending.set(id, deepClone(pending.get(id)!));
        const x = pending.get(id)!;
        x.startTime = ops[i + 2] / 1000;
        x.endTime = ops[i + 3] / 1000;

        rendered.add(id);

        i += 3;
        break;
      }
      case MsgTypes.REMOVE_VNODE: {
        const unmounts = ops[i + 1];
        i += 2;
        const len = i + unmounts;
        for (; i < len; i++) {
          const nodeId = ops[i];
          removals.push(nodeId);
          const node = pending.get(nodeId);
          if (node) {
            // Remove node from parent children array
            const parent = pending.get(node.parent);
            if (parent) {
              const idx = parent.children.indexOf(nodeId);
              if (idx > -1) {
                const clone = deepClone(parent);
                pending.set(parent.id, clone);
                clone.children.splice(idx, 1);
              }
            }

            // Check if node was a root
            const rootIdx = roots.indexOf(node.id);
            if (rootIdx > -1) {
              roots.splice(rootIdx, 1);
            }

            // Delete children recursively
            const stack = [node.id];
            let item;
            while ((item = stack.pop())) {
              const child = pending.get(item);
              if (!child) continue;

              pending.delete(child.id);
              stack.push(...child.children);
            }

            pending.delete(nodeId);
          }
        }

        // Subtract one because of outer loop
        if (len > 0) i--;
        break;
      }
      case MsgTypes.REORDER_CHILDREN: {
        const parentId = ops[i + 1];
        const count = ops[i + 2];
        const parent = deepClone(pending.get(parentId)!);
        parent.children = ops.slice(i + 3, i + 3 + count);
        pending.set(parentId, parent);
        i = i + 2 + count;
        break;
      }
      case MsgTypes.RENDER_REASON: {
        const id = ops[i + 1];
        const type = ops[i + 2];
        const count = ops[i + 3];
        let items: string[] | null = null;
        if (count > 0) {
          items = ops.slice(i + 4, i + 4 + count).map((x) => strings[x - 1]);
        }
        reasons.set(id, {
          type,
          items,
        });
        i = i + 3 + count;
        break;
      }
      case MsgTypes.COMMIT_STATS: {
        const statsData = parseStats(i + 1, ops);
        i = statsData.i;
        stats = statsData.stats;
        break;
      }
      case MsgTypes.HOC_NODES: {
        const vnodeId = ops[i + 1];
        const vnode = pending.get(vnodeId);
        const count = ops[i + 2];
        if (vnode) {
          const hocs = [];
          for (let j = 0; j < count; j++) {
            hocs.push(strings[ops[i + 3 + j] - 1]);
          }
          vnode.hocs = hocs;
        }
        i = i + 2 + count;
        break;
      }
      default:
        throw new Error('Unknown event: ' + ops[i]);
    }
  }

  return { rootId, roots, tree: pending, removals, rendered, reasons, stats };
}
