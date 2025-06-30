import { ID, DevNodeType, Tree, DevNode } from '../../../store/types';
import { CommitData } from '../data/commits';
import { NodeTransform } from './shared';
import { FlameNodeTransform } from './modes/flamegraph-utils';

/**
 * Parse a visual flamegraph DSL into a `DevNode` tree. Each
 * character represents a timing of 10ms, including the component
 * names.
 *
 * Usage example:
 *
 * ```js
 * flames`
 *   App **************
 *    Foo ****  Bar **
 *     Bob **
 * `
 * ```
 */
export function flames(
  literals: TemplateStringsArray,
  ...placeholders: string[]
) {
  let res = placeholders.reduce((acc, x, i) => acc + x + literals[i], '')
    + literals[literals.length - 1];

  // Delete first newline if any
  res = res.replace(/^(\r\n|\r|\n)/, '');

  // Treat spaces of the first line as indentation
  const match = res.match(/^(\s+)/);
  const indent = match ? match[0].length : 0;

  const lines = res
    .split(/(\r\n|\r|\n)/)
    .map((line) => {
      const match = line.match(/^(\s+)/);
      const localIndent = match ? match[0].length : 0;
      return line.slice(localIndent < indent ? localIndent : indent);
    })
    .filter(Boolean);

  const nodes: DevNode[] = [];
  const nameMap = new Map<string, DevNode>();
  const transformMap = new Map<ID, FlameNodeTransform>();

  let id = 1;

  let lastSiblingsNodes: DevNode[] = [];

  // Iterate backwards, so that all children are known
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const siblings = line.match(/\s+\w+\s\*+/g) || [line];

    const lineNodes: DevNode[] = [];

    // Iterate backwards to ensure correct ordering
    for (let j = siblings.length - 1; j >= 0; j--) {
      const sib = siblings[j];
      const match = sib.match(/^(\s+)/);

      const indent = match ? match[0].length : 0;
      let startTime = indent;

      // Add previous sibling lengths
      for (let k = 0; k < j; k++) {
        startTime += siblings[k].length;
      }

      const nameMatch = sib.match(/(\w+)/);
      const name = nameMatch ? nameMatch[0] : 'Unknown';

      const duration = sib.length - indent;

      const node: DevNode = {
        depth: i,
        key: '',
        parent: -1,
        owner: -1,
        type: name[0].toUpperCase() === name[0]
          ? DevNodeType.FunctionComponent
          : DevNodeType.Element,
        startTime,
        endTime: startTime + duration,
        children: [],
        id: id++,
        hocs: null,
        name,
      };

      lastSiblingsNodes.forEach((child) => {
        if (
          node.startTime <= child.startTime
          && node.endTime > child.startTime
        ) {
          node.children.push(child.id);
        }
      });

      nodes.push(node);
      lineNodes.push(node);

      // Throw if name is not unique and was already used
      if (nameMap.has(node.name)) {
        throw new Error(
          `Node names must be unique. Found duplicate "${node.name}."`,
        );
      }

      nameMap.set(node.name, node);
    }

    lastSiblingsNodes = lineNodes.reverse();
  }

  nodes.sort((a, b) => {
    const time = a.startTime - b.startTime;
    // Use depth as fallback if startTime is equal
    return time === 0 ? a.depth - b.depth : time;
  });

  // Rebuild ids based on sort order
  const ids = new Map<number, number>();
  nodes.forEach((node, i) => ids.set(node.id, i + 1));

  const idMap = new Map<ID, DevNode>();
  nodes.forEach((node) => {
    node.id = ids.get(node.id)!;
    node.children = node.children.map((childId) => ids.get(childId)!);
    idMap.set(node.id, node);
  });

  const selfDurations = new Map<ID, number>();

  // Add self durations (basically: duration - child durations)
  nodes.forEach((node) => {
    let selfDuration = node.endTime - node.startTime;

    node.children.forEach((childId) => {
      const child = idMap.get(childId)!;

      selfDuration -= child.endTime - child.startTime;

      // Update parent pointer
      child.parent = node.id;
    });

    selfDurations.set(node.id, Math.max(0, selfDuration));
  });

  // Correct dangling children
  nodes.forEach((node) => {
    if (node.depth > 0 && node.parent === -1) {
      const parents = Array.from(nodes.values()).filter(
        (x) => x.depth === node.depth - 1,
      );

      let found = false;
      for (let i = parents.length - 1; i >= 0; i--) {
        const parent = parents[i];
        if (
          parent.endTime > node.endTime
          && parent.startTime > node.startTime
        ) {
          found = true;
          parent.children.unshift(node.id);
          node.parent = parent.id;
          break;
        } else if (parent.endTime < node.endTime) {
          found = true;
          parent.children.push(node.id);
          node.parent = parent.id;
        }
      }

      if (!found) {
        throw new Error(`Could not find parent for ${node.name}`);
      }
    }
  });

  // Convert units to 10ms
  nodes.forEach((node) => {
    node.startTime = node.startTime * 10;
    node.endTime = node.endTime * 10;

    selfDurations.set(node.id, (selfDurations.get(node.id) || 0) * 10);

    transformMap.set(node.id, {
      commitParent: false,
      end: node.endTime,
      id: node.id,
      maximized: false,
      row: node.depth,
      start: node.startTime,
      visible: true,
      weight: 0,
      width: selfDurations.get(node.id) || 0,
      x: node.startTime,
    });
  });

  // Create commit out of tree
  const commit: CommitData = {
    rootId: 1,
    commitRootId: 1,
    rendered: new Set(nodes.map((node) => node.id)),
    duration: nodes.length > 0 ? nodes[0]!.endTime - nodes[0]!.startTime : 0,
    maxSelfDuration: Math.max(
      0,
      ...nodes.map((x) => selfDurations.get(x.id) || 0),
    ),
    nodes: idMap,
    selfDurations,
  };

  return {
    commit,
    idMap,
    transformMap,
    nodes,
    root: nodes[0],
    byName: (name: string) => nameMap.get(name),
    byId: (id: ID) => idMap.get(id),
  };
}

export function byName(tree: Tree, name: string) {
  return Array.from(tree.values()).find((x) => x.name === name);
}

export function visualize(nodes: NodeTransform[]) {
  const rows = new Array(Math.max(...nodes.map((x) => x.row + 1))).fill(
    ' '.repeat(100),
  );

  nodes.forEach((node) => {
    const w = Math.round(node.width);
    const x = Math.round(node.x);
    const s = rows[node.row];
    rows[node.row] = s.substring(0, x)
      + (node.id + '*'.repeat(w).slice(0, w))
      + s.substring(x + w);
  });

  return rows.join('\n');
}
