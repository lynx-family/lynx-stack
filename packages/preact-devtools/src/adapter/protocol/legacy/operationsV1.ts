import { MsgTypes } from '../events-types';
import { parseTable } from '../string-table';
import { Store } from '../../../view/store/types';
import { deepClone } from '../../shared/utils';

export function applyOperationsV1(store: Store, data: number[]) {
  const nodes = new Map(store.nodes.value);

  let i = data[1] + 1;
  const strings = parseTable(data.slice(1, i + 1));

  const inspected = store.inspectData.value != null
    ? store.inspectData.value.id
    : -2;

  for (; i < data.length; i++) {
    switch (data[i]) {
      case MsgTypes.ADD_ROOT: {
        const id = data[i + 1];
        store.roots.value.push(id);
        i += 1;
        break;
      }
      case MsgTypes.ADD_VNODE: {
        const id = data[i + 1];
        const type = data[i + 2];
        const name = strings[data[i + 5] - 1];
        const key = data[i + 6] > 0 ? strings[data[i + 6] - 1] : '';
        let parentId = data[i + 3];

        if (!nodes.has(id)) {
          // Roots have their own id as parentId
          if (id !== parentId) {
            const parent = nodes.get(parentId);
            if (!parent) {
              // throw new Error(`Parent node ${parentId} not found in store.`);
              // eslint-disable-next-line no-console
              console.warn(`Parent node ${parentId} not found in store.`);
              parentId = -1;
            } else {
              const clone = deepClone(parent);
              nodes.set(clone.id, clone);
              clone.children.push(id);
            }
          }

          const parent = nodes.get(parentId)!;
          const depth = parent ? parent.depth + 1 : 1;

          nodes.set(id, {
            children: [],
            depth,
            id,
            hocs: null,
            name,
            owner: -1,
            parent: parentId,
            type,
            key,
            startTime: -1,
            endTime: -1,
          });
        }
        i += 6;
        break;
      }
      case MsgTypes.UPDATE_VNODE_TIMINGS: {
        // Unused event
        const id = data[i + 1];

        if (id === inspected) {
          store.notify('inspect', id);
        }

        i += 2;
        break;
      }
      case MsgTypes.REMOVE_VNODE: {
        const unmounts = data[i + 1];
        i += 2;
        const len = i + unmounts;
        for (; i < len; i++) {
          const nodeId = data[i];
          const node = nodes.get(nodeId);
          if (node) {
            // Remove node from parent children array
            const parentId = node.parent;
            const parent = nodes.get(parentId);
            if (parent) {
              const idx = parent.children.indexOf(nodeId);
              if (idx > -1) {
                const clone = deepClone(parent);
                nodes.set(clone.id, clone);
                clone.children.splice(idx, 1);
              }
            }

            const stack = node.children;
            while (stack.length > 0) {
              const childId = stack.pop();
              if (childId != null) {
                const childNode = nodes.get(childId);
                if (childNode) {
                  stack.push(...childNode.children);
                  nodes.delete(childId);
                }
              }
            }

            // Remove node from store
            nodes.delete(nodeId);
          }
        }

        // Subtract one because of outer loop
        if (len > 0) i--;
        break;
      }
      case MsgTypes.REORDER_CHILDREN: {
        const parentId = data[i + 1];
        const count = data[i + 2];
        const parent = nodes.get(parentId);
        if (parent) {
          const clone = deepClone(parent);
          nodes.set(clone.id, clone);
          clone.children = data.slice(i + 3, i + 3 + count);
        }
        i = i + 3 + count;
        break;
      }
    }
  }

  store.roots.value = [...store.roots.value];
  store.nodes.value = nodes;
}
