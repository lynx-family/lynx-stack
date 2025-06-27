import { PreactBindings, SharedVNode } from './bindings';

export function getSignalTextName(name: string) {
  return name === '_st' ? '__TextSignal' : name;
}

export function traverse<T extends SharedVNode>(
  vnode: T,
  fn: (vnode: T) => void,
  bindings: PreactBindings<T>,
) {
  fn(vnode);
  const children = bindings.getActualChildren(vnode);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child != null) {
      traverse(child, fn, bindings);
      fn(child);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function deepClone<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export interface RootData {
  id: number;
  node: Node;
}

export function newRootData(id: number, node: Node) {
  return { id, node };
}

export function sortRoots(searchRoot: Node, roots: RootData[]): number[] {
  const map = new Map<Node, number[]>();

  const walking = new Set<Node>();
  walking.add(searchRoot);

  for (let i = 0; i < roots.length; i++) {
    let node: Node | null = roots[i].node;

    // Update root map. Note that multiple roots can point
    // to the same container node
    if (!map.has(node)) {
      map.set(node, []);
    }
    map.get(node)!.push(roots[i].id);

    while (node !== null && node !== searchRoot) {
      if (walking.has(node)) break;
      walking.add(node);
      node = node.parentNode;
    }
  }

  const stack = [searchRoot] as Node[];
  let out: number[] = [];

  let item: Node | undefined;
  while ((item = stack.pop()) !== undefined) {
    if (!walking.has(item)) continue;

    if (item.nodeName !== 'IFRAME') {
      const len = item.childNodes.length;
      for (let i = 0; i < len; i++) {
        stack.push(item.childNodes[len - i - 1]);
      }
    }

    const found = map.get(item);
    if (found !== undefined) {
      out = out.concat(found);
    }
  }

  return out;
}
