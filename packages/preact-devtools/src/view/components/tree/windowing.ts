import { ID } from '../../store/types';

export function flattenChildren<
  K,
  T extends { id: K; children: K[]; depth: number },
>(tree: Map<K, T>, id: K, isCollapsed: (id: K) => boolean): K[] {
  const out: K[] = [];
  const visited = new Set<K>();
  const stack: K[] = [id];

  while (stack.length > 0) {
    const item = stack.pop();
    if (item == null) continue;

    const node = tree.get(item);
    if (!node) continue;

    if (!visited.has(node.id)) {
      out.push(node.id);
      visited.add(node.id);

      if (!isCollapsed(node.id)) {
        for (let i = node.children.length; i--;) {
          stack.push(node.children[i]);
        }
      }
    }
  }

  return out;
}

export function clamp(n: number, max: number) {
  return Math.max(0, Math.min(n, max));
}

export interface Traversable {
  id: ID;
  parent: ID;
  children: ID[];
}

export function getLastChild(nodes: Map<ID, Traversable>, id: ID): ID {
  const stack = [id];
  let item;
  let last = id;
  while ((item = stack.pop()) != null) {
    last = item;
    const node = nodes.get(item);
    if (node && node.children.length > 0) {
      stack.push(node.children[node.children.length - 1]);
    }
  }

  return last;
}
