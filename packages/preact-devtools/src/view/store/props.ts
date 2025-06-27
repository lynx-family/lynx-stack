import { parseProps, PropData } from '../components/sidebar/inspect/parseProps';
import { flattenChildren } from '../components/tree/windowing';

const PROPS_LIMIT = 7;

export function isCollapsed(ids: string[], id: string) {
  return id !== 'root' && ids.indexOf(id) === -1;
}

/**
 * Props, Context and State are passed as serialized objects.
 * We just need to convert that into a tree-like structure
 * for rendering.
 */
export function parseObjectState(
  data: Record<string, any> | null,
  uncollapsed: string[],
) {
  if (data != null) {
    const tree = new Map<string, PropData>();
    tree.set('root', {
      children: [],
      depth: 0,
      name: 'root',
      editable: false,
      id: 'root',
      type: 'object',
      value: null,
      meta: null,
    });

    parseProps(data, 'root', PROPS_LIMIT, 0, 'root', tree);
    const items = flattenChildren(tree, 'root', id => {
      return tree.get(id)!.children.length > 0 && isCollapsed(uncollapsed, id);
    });
    return items.slice(1).map(id => tree.get(id)!);
  }

  return [];
}

export function filterCollapsed<T extends { id: string; children: string[] }>(
  items: T[],
  uncollapsed: string[],
): T[] {
  const skip: string[] = [];
  const visible = new Set<string>();
  const uncoll = new Set(uncollapsed);

  return items.filter(node => {
    if (skip.some(x => node.id.startsWith(x))) {
      return false;
    }
    if (node.id === 'root' || uncoll.has(node.id)) {
      node.children.forEach(childId => visible.add(childId));
    } else if (node.children.length) {
      skip.push(node.id);
    }

    return true;
  });
}
