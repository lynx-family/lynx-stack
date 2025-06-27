import { DevNodeType } from '../../view/store/types';
import { MsgTypes } from '../protocol/events-types';
import { PreactBindings, SharedVNode } from './bindings';
import { getDevtoolsType, RendererConfig } from './renderer';

export enum DiffType {
  UNKNOWN = 0,
  KEYED = 1,
  UNKEYED = 2,
  MIXED = 3,
}

export type StatsChildren = [number, number, number, number, number];

export interface OperationInfo {
  components: number;
  elements: number;
  text: number;
}

export interface Stats {
  roots: StatsChildren;
  classComponents: StatsChildren;
  functionComponents: StatsChildren;
  fragments: StatsChildren;
  forwardRef: StatsChildren;
  memo: StatsChildren;
  suspense: StatsChildren;
  elements: StatsChildren;
  text: number;
  keyed: StatsChildren;
  unkeyed: StatsChildren;
  mixed: StatsChildren;
  mounts: OperationInfo;
  updates: OperationInfo;
  unmounts: OperationInfo;
  singleChildType: {
    roots: number;
    classComponents: number;
    functionComponents: number;
    fragments: number;
    forwardRef: number;
    memo: number;
    suspense: number;
    elements: number;
    text: number;
  };
}

function getChildCountIdx(count: number) {
  return count > 4 ? 4 : count;
}

export function updateDiffStats(
  stats: Stats,
  diff: DiffType,
  childCount: number,
) {
  const idx = getChildCountIdx(childCount);
  if (diff === DiffType.KEYED) {
    stats.keyed[idx]++;
  } else if (diff === DiffType.UNKEYED) {
    stats.unkeyed[idx]++;
  } else if (diff === DiffType.MIXED) {
    stats.mixed[idx]++;
  }
}

export function updateOpStats<T extends SharedVNode>(
  stats: Stats,
  kind: 'updates' | 'mounts' | 'unmounts',
  vnode: T,
  bindings: PreactBindings<T>,
) {
  if (bindings.isComponent(vnode)) {
    stats[kind].components++;
  } else if (bindings.isElement(vnode)) {
    stats[kind].elements++;
  } else {
    stats[kind].text++;
  }
}

// TODO: store update depth
export function createStats(): Stats {
  return {
    roots: [0, 0, 0, 0, 0],
    classComponents: [0, 0, 0, 0, 0],
    functionComponents: [0, 0, 0, 0, 0],
    fragments: [0, 0, 0, 0, 0],
    forwardRef: [0, 0, 0, 0, 0],
    memo: [0, 0, 0, 0, 0],
    suspense: [0, 0, 0, 0, 0],
    elements: [0, 0, 0, 0, 0],
    text: 0,
    keyed: [0, 0, 0, 0, 0],
    unkeyed: [0, 0, 0, 0, 0],
    mixed: [0, 0, 0, 0, 0],
    mounts: { components: 0, elements: 0, text: 0 },
    unmounts: { components: 0, elements: 0, text: 0 },
    updates: { components: 0, elements: 0, text: 0 },
    singleChildType: {
      roots: 0,
      classComponents: 0,
      functionComponents: 0,
      fragments: 0,
      forwardRef: 0,
      memo: 0,
      suspense: 0,
      elements: 0,
      text: 0,
    },
  };
}

export function stats2ops(stats: Stats, out: number[]): void {
  out.push(MsgTypes.COMMIT_STATS);

  pushStatsChildren(out, stats.roots);
  pushStatsChildren(out, stats.classComponents);
  pushStatsChildren(out, stats.functionComponents);
  pushStatsChildren(out, stats.fragments);
  pushStatsChildren(out, stats.forwardRef);
  pushStatsChildren(out, stats.memo);
  pushStatsChildren(out, stats.suspense);
  pushStatsChildren(out, stats.elements);

  out.push(stats.text);

  pushStatsChildren(out, stats.keyed);
  pushStatsChildren(out, stats.unkeyed);
  pushStatsChildren(out, stats.mixed);

  out.push(stats.mounts.components);
  out.push(stats.mounts.elements);
  out.push(stats.mounts.text);
  out.push(stats.updates.components);
  out.push(stats.updates.elements);
  out.push(stats.updates.text);
  out.push(stats.unmounts.components);
  out.push(stats.unmounts.elements);
  out.push(stats.unmounts.text);

  // Single child types
  out.push(stats.singleChildType.roots);
  out.push(stats.singleChildType.classComponents);
  out.push(stats.singleChildType.functionComponents);
  out.push(stats.singleChildType.fragments);
  out.push(stats.singleChildType.forwardRef);
  out.push(stats.singleChildType.memo);
  out.push(stats.singleChildType.suspense);
  out.push(stats.singleChildType.elements);
  out.push(stats.singleChildType.text);
}

function pushStatsChildren(out: number[], stats: StatsChildren): void {
  out.push(stats[0]);
  out.push(stats[1]);
  out.push(stats[2]);
  out.push(stats[3]);
  out.push(stats[4]);
}

export interface ParsedStats {
  roots: StatsChildren;
  classComponents: StatsChildren;
  functionComponents: StatsChildren;
  fragments: StatsChildren;
  forwardRef: StatsChildren;
  memo: StatsChildren;
  suspense: StatsChildren;
  elements: StatsChildren;
  text: number;
  keyed: StatsChildren;
  unkeyed: StatsChildren;
  mixed: StatsChildren;
  mounts: OperationInfo;
  updates: OperationInfo;
  unmounts: OperationInfo;
  singleChildType: {
    roots: number;
    classComponents: number;
    functionComponents: number;
    fragments: number;
    forwardRef: number;
    memo: number;
    suspense: number;
    elements: number;
    text: number;
  };
}

export function getDiffType(child: SharedVNode, prev: DiffType) {
  if (prev !== DiffType.MIXED) {
    if (child.key != null) {
      return prev === DiffType.UNKNOWN || prev === DiffType.KEYED
        ? DiffType.KEYED
        : DiffType.MIXED;
    } else {
      return prev === DiffType.UNKNOWN || prev === DiffType.UNKEYED
        ? DiffType.UNKEYED
        : DiffType.MIXED;
    }
  }
  return prev;
}

export function recordComponentStats<T extends SharedVNode>(
  config: RendererConfig,
  bindings: PreactBindings<T>,
  stats: Stats,
  vnode: T,
  children: Array<T | null | undefined>,
) {
  const childrenLen = children.length;
  const idx = getChildCountIdx(childrenLen);

  if (bindings.isComponent(vnode)) {
    if (vnode.type === config.Fragment) {
      stats.fragments[idx]++;
    } else if (vnode.type.prototype && vnode.type.prototype.render) {
      stats.classComponents[idx]++;
    } else {
      stats.functionComponents[idx]++;
    }
  } else if (bindings.isElement(vnode)) {
    stats.elements[idx]++;
  } else {
    stats.text++;
  }

  const devType = getDevtoolsType(vnode, bindings);
  switch (devType) {
    case DevNodeType.ForwardRef:
      stats.forwardRef[idx]++;
      break;
    case DevNodeType.Memo:
      stats.memo[idx]++;
      break;
    case DevNodeType.Suspense:
      stats.suspense[idx]++;
      break;
  }

  if (childrenLen === 1) {
    const child = children[0];
    if (child != null) {
      if (typeof child.type === 'function') {
        if (child.type.prototype && child.type.prototype.render) {
          stats.singleChildType.classComponents++;
        } else {
          if (child.type === config.Fragment) {
            stats.singleChildType.fragments++;
          } else {
            const childType = getDevtoolsType(child, bindings);
            switch (childType) {
              case DevNodeType.ForwardRef:
                stats.singleChildType.forwardRef++;
                break;
              case DevNodeType.Memo:
                stats.singleChildType.memo++;
                break;
              case DevNodeType.Suspense:
                stats.singleChildType.suspense++;
                break;
            }
          }
          stats.singleChildType.functionComponents++;
        }
      } else if (child.type !== null) {
        stats.singleChildType.elements++;
      } else {
        stats.singleChildType.text++;
      }
    }
  }
}

export function parseChildrenStats(
  i: number,
  ops: number[],
): { i: number; data: StatsChildren } {
  const data: StatsChildren = [
    ops[i++],
    ops[i++],
    ops[i++],
    ops[i++],
    ops[i++],
  ];

  return {
    i,
    data,
  };
}

export function parseTypeStats(i: number, ops: number[]) {
  const data = { components: ops[i++], elements: ops[i++], text: ops[i++] };
  return {
    i,
    data,
  };
}

export function parseStats(
  i: number,
  ops: number[],
): { i: number; stats: ParsedStats } {
  const roots = parseChildrenStats(i, ops);
  const klass = parseChildrenStats(roots.i, ops);
  const fnComps = parseChildrenStats(klass.i, ops);
  const fragments = parseChildrenStats(fnComps.i, ops);
  const forwardRef = parseChildrenStats(fragments.i, ops);
  const memo = parseChildrenStats(forwardRef.i, ops);
  const suspense = parseChildrenStats(memo.i, ops);
  const elements = parseChildrenStats(suspense.i, ops);
  i = elements.i;

  const text = ops[i++];

  const keyed = parseChildrenStats(i, ops);
  const unkeyed = parseChildrenStats(keyed.i, ops);
  const mixed = parseChildrenStats(unkeyed.i, ops);
  i = mixed.i;

  const mounts = parseTypeStats(i, ops);
  const updates = parseTypeStats(mounts.i, ops);
  const unmounts = parseTypeStats(updates.i, ops);
  i = unmounts.i;

  const singleRoots = ops[i++];
  const singleClassComponents = ops[i++];
  const singleFunctionComponents = ops[i++];
  const singleFragments = ops[i++];
  const singleForwardRef = ops[i++];
  const singleMemo = ops[i++];
  const singleSuspense = ops[i++];
  const singleElements = ops[i++];
  const singleText = ops[i++];

  const stats = {
    roots: roots.data,
    classComponents: klass.data,
    functionComponents: fnComps.data,
    fragments: fragments.data,
    forwardRef: forwardRef.data,
    memo: memo.data,
    suspense: suspense.data,
    elements: elements.data,
    text,

    keyed: keyed.data,
    unkeyed: unkeyed.data,
    mixed: mixed.data,

    mounts: mounts.data,
    updates: updates.data,
    unmounts: unmounts.data,
    singleChildType: {
      roots: singleRoots,
      classComponents: singleClassComponents,
      functionComponents: singleFunctionComponents,
      fragments: singleFragments,
      forwardRef: singleForwardRef,
      memo: singleMemo,
      suspense: singleSuspense,
      elements: singleElements,
      text: singleText,
    },
  };

  return { i, stats };
}
