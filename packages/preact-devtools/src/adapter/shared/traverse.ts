import { ID } from '../../view/store/types';
import { FilterState } from '../adapter/filter';
import { Commit, MsgTypes } from '../protocol/events-types';
import { getStringId } from '../protocol/string-table';
import {
  getOrCreateVNodeId,
  getVNodeById,
  getVNodeId,
  hasVNodeId,
  IdMappingState,
  updateVNodeId,
} from './idMapper';
import { ProfilerState } from '../adapter/profiler';
import { getDevtoolsType, RendererConfig } from './renderer';
import { RenderReason, RenderReasonData } from './renderReasons';
import { createStats, DiffType, updateDiffStats, updateOpStats } from './stats';
// import { NodeType } from "../../constants";
import { getDiffType, recordComponentStats } from './stats';
// import { measureUpdate } from "../adapter/highlightUpdates";
import { PreactBindings, SharedVNode } from './bindings';
import { VNodeTimings } from './timings';
import { getSignalTextName } from './utils';

function getHocName(name: string) {
  const idx = name.indexOf('(');
  if (idx === -1) return null;

  const wrapper = name.slice(0, idx);
  return wrapper ? wrapper : null;
}

function addHocs(commit: Commit, id: ID, hocs: string[]) {
  if (hocs.length > 0) {
    commit.operations.push(MsgTypes.HOC_NODES, id, hocs.length);
    for (let i = 0; i < hocs.length; i++) {
      const stringId = getStringId(commit.strings, hocs[i]);
      commit.operations.push(stringId);
    }
  }
}

function detectHocs(commit: Commit, name: string, id: ID, hocs: string[]) {
  const hocName = getHocName(name);
  if (name.startsWith('ForwardRef')) {
    const idx = name.indexOf('(');
    name = name.slice(idx + 1, -1) || 'Anonymous';
    addHocs(commit, id, hocs);
    hocs = [];
  } else {
    if (hocName) {
      hocs = [...hocs, hocName];
    } else {
      addHocs(commit, id, hocs);
      hocs = [];
    }
  }
  return { name, hocs };
}

// function isTextNode(dom: HTMLElement | Text | null): dom is Text {
// 	return dom != null && dom.nodeType === NodeType.Text;
// }

// function updateHighlight<T extends SharedVNode>(
// 	profiler: ProfilerState,
// 	vnode: T,
// 	bindings: PreactBindings<T>,
// ) {
// 	if (profiler.highlightUpdates && bindings.isComponent(vnode)) {
// 		const stack: Array<T | null | undefined> = [vnode];
// 		let item;
// 		let dom;
// 		while ((item = stack.shift()) !== undefined) {
// 			// Account for placholders/holes
// 			if (item === null) continue;

// 			if (!bindings.isComponent(item)) {
// 				dom = bindings.getDom(item);
// 				break;
// 			}

// 			stack.push(...bindings.getActualChildren(item));
// 		}

// 		if (dom === null || dom === undefined) return;

// 		if (isTextNode(dom)) {
// 			dom = dom.parentNode as HTMLElement;
// 		}
// 		if (dom && !profiler.pendingHighlightUpdates.has(dom)) {
// 			profiler.pendingHighlightUpdates.add(dom);
// 			measureUpdate(profiler.updateRects, dom);
// 		}
// 	}
// }

export function getFilteredChildren<T extends SharedVNode>(
  vnode: T,
  filters: FilterState,
  config: RendererConfig,
  helpers: PreactBindings<T>,
): T[] {
  const children = helpers.getActualChildren(vnode);
  const stack = children.slice();

  const out: T[] = [];

  let child;
  while (stack.length) {
    child = stack.pop();
    if (child != null) {
      if (!shouldFilter(child, filters, config, helpers)) {
        out.push(child);
      } else {
        const nextChildren = helpers.getActualChildren(child);
        if (nextChildren.length > 0) {
          stack.push(...nextChildren.slice());
        }
      }
    }
  }

  return out.reverse();
}

export function shouldFilter<T extends SharedVNode>(
  vnode: T,
  filters: FilterState,
  config: RendererConfig,
  bindings: PreactBindings<T>,
): boolean {
  // Filter text nodes by default. They are too tricky to match
  // with the previous one...
  if (bindings.isTextVNode(vnode)) {
    return true;
  }

  // TODO: Add a virtual root node to be able to filter the actual
  // ones. Currently we have a workaround on the extension side
  // that filters it there, but we should really do it here to be
  // consistent with all other filters.

  if (vnode.type === config.Fragment && filters.type.has('fragment')) {
    const parent = bindings.getVNodeParent(vnode);
    // Only filter non-root nodes
    if (parent != null) return true;

    return false;
  } else if (bindings.isElement(vnode) && filters.type.has('dom')) {
    return true;
  }

  if (filters.type.has('hoc')) {
    const name = bindings.getDisplayName(vnode, config);

    if (name.indexOf('(') > -1 && !name.startsWith('ForwardRef')) {
      return true;
    }
  }

  if (filters.type.has('textSignal')) {
    const name = getSignalTextName(bindings.getDisplayName(vnode, config));
    if (name === '__TextSignal') return true;
  }

  if (filters.regex.length > 0) {
    const name = getSignalTextName(bindings.getDisplayName(vnode, config));
    return filters.regex.some(r => {
      // Regexes with a global flag are stateful in JS :((
      r.lastIndex = 0;
      return r.test(name);
    });
  }

  // In Preact V11 we use a Portal component to render Suspense
  // children. Because that is only an implementation detail
  // we'll hide this component to avoid confusing users.
  const parent = bindings.getVNodeParent(vnode);
  if (
    parent !== null
    && bindings.isSuspenseVNode(parent)
    && bindings.isPortal(vnode)
  ) {
    return true;
  }

  return false;
}

function mount<T extends SharedVNode>(
  ids: IdMappingState<T>,
  commit: Commit,
  owners: Map<T, T>,
  vnode: T,
  ownerId: ID,
  ancestorId: ID,
  filters: FilterState,
  domCache: WeakMap<HTMLElement | Text, T>,
  config: RendererConfig,
  profiler: ProfilerState,
  hocs: string[],
  bindings: PreactBindings<T>,
  timingsByVNode: VNodeTimings<T>,
  renderReasonPre: Map<T, RenderReasonData> | null,
) {
  if (commit.stats !== null) {
    updateOpStats(commit.stats, 'mounts', vnode, bindings);
  }

  const root = bindings.isRoot(vnode, config);

  const skip = shouldFilter(vnode, filters, config, bindings);
  let name = getSignalTextName(bindings.getDisplayName(vnode, config));

  if (filters.type.has('hoc')) {
    const hocName = getHocName(name);
    if (hocName) {
      hocs = [...hocs, hocName];
      if (name.startsWith('ForwardRef')) {
        const idx = name.indexOf('(');
        name = name.slice(idx + 1, -1) || 'Anonymous';
      }
    }
  }

  if (root || !skip) {
    const id = getOrCreateVNodeId(ids, vnode);
    if (!id) return;
    if (root) {
      commit.operations.push(MsgTypes.ADD_ROOT, id);
    }

    if (!root) {
      const maybeOwner = owners.get(vnode);
      if (maybeOwner !== undefined && !bindings.isRoot(maybeOwner, config)) {
        const maybeOwnerId = getVNodeId(ids, maybeOwner);
        ownerId = maybeOwnerId !== -1 ? maybeOwnerId : ownerId;
      }
    }

    commit.operations.push(
      MsgTypes.ADD_VNODE,
      id,
      getDevtoolsType(vnode, bindings), // Type
      ancestorId,
      ownerId,
      getStringId(commit.strings, name),
      vnode.key ? getStringId(commit.strings, vnode.key) : 0,
      // Multiply, because operations array only supports integers
      // and would otherwise cut off floats
      (timingsByVNode.start.get(vnode) || 0) * 1000,
      (timingsByVNode.end.get(vnode) || 0) * 1000,
    );

    if (ownerId === -1 && !root) {
      ownerId = id;
    }

    if (hocs.length > 0) {
      addHocs(commit, id, hocs);
      hocs = [];
      ownerId = id;
    }

    // Capture render reason (mount here)
    if (profiler.isProfiling && profiler.captureRenderReasons) {
      commit.operations.push(MsgTypes.RENDER_REASON, id, RenderReason.MOUNT, 0);
    }

    // updateHighlight(profiler, vnode, bindings);

    ancestorId = id;
  }

  if (skip && !bindings.isComponent(vnode)) {
    const dom = bindings.getDom(vnode);
    if (dom) domCache.set(dom, vnode);
  }

  let diff = DiffType.UNKNOWN;
  let childCount = 0;

  const children = bindings.getActualChildren(vnode);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child != null) {
      if (commit.stats !== null) {
        diff = getDiffType(child, diff);
        childCount++;
      }

      mount(
        ids,
        commit,
        owners,
        child,
        ownerId,
        ancestorId,
        filters,
        domCache,
        config,
        profiler,
        hocs,
        bindings,
        timingsByVNode,
        renderReasonPre,
      );
    }
  }

  if (commit.stats !== null) {
    updateDiffStats(commit.stats, diff, childCount);
    recordComponentStats(config, bindings, commit.stats, vnode, children);
  }
}

function resetChildren<T extends SharedVNode>(
  commit: Commit,
  ids: IdMappingState<T>,
  id: ID,
  vnode: T,
  filters: FilterState,
  config: RendererConfig,
  helpers: PreactBindings<T>,
) {
  const children = helpers.getActualChildren(vnode);
  if (!children.length) return;

  const next = getFilteredChildren(vnode, filters, config, helpers);

  // Suspense internals mutate child outside of the standard render cycle.
  // This leads to stale children on the devtools ends. To work around that
  // We'll always reset the children of a Suspense vnode.
  let forceReorder = false;
  if (helpers.isSuspenseVNode(vnode)) {
    forceReorder = true;
  }

  if (!forceReorder && next.length < 2) return;

  commit.operations.push(
    MsgTypes.REORDER_CHILDREN,
    id,
    next.length,
    ...next.map(x => getVNodeId(ids, x)),
  );
}

function update<T extends SharedVNode>(
  ids: IdMappingState<T>,
  commit: Commit,
  owners: Map<T, T>,
  vnode: T,
  ownerId: ID,
  ancestorId: number,
  filters: FilterState,
  domCache: WeakMap<HTMLElement | Text, T>,
  config: RendererConfig,
  profiler: ProfilerState,
  hocs: string[],
  bindings: PreactBindings<T>,
  timingsByVNode: VNodeTimings<T>,
  renderReasonPre: Map<T, RenderReasonData> | null,
) {
  if (commit.stats !== null) {
    updateOpStats(commit.stats, 'updates', vnode, bindings);
  }

  let diff = DiffType.UNKNOWN;

  const skip = shouldFilter(vnode, filters, config, bindings);
  if (skip) {
    const id = getVNodeId(ids, vnode);
    if (filters.type.has('hoc')) {
      const name = bindings.getDisplayName(vnode, config);
      const res = detectHocs(commit, name, id, hocs);
      hocs = res.hocs;
    }

    let childCount = 0;
    const children = bindings.getActualChildren(vnode);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child != null) {
        if (commit.stats !== null) {
          diff = getDiffType(child, diff);
          childCount++;
        }

        update(
          ids,
          commit,
          owners,
          child,
          ownerId,
          ancestorId,
          filters,
          domCache,
          config,
          profiler,
          hocs,
          bindings,
          timingsByVNode,
          renderReasonPre,
        );
      }
    }

    if (commit.stats !== null) {
      updateDiffStats(commit.stats, diff, childCount);
      recordComponentStats(config, bindings, commit.stats, vnode, children);
    }
    return;
  }

  if (!hasVNodeId(ids, vnode)) {
    mount(
      ids,
      commit,
      owners,
      vnode,
      ownerId,
      ancestorId,
      filters,
      domCache,
      config,
      profiler,
      hocs,
      bindings,
      timingsByVNode,
      renderReasonPre,
    );
    return;
  }

  const id = getVNodeId(ids, vnode);
  const oldVNode = getVNodeById(ids, id);
  updateVNodeId(ids, id, vnode);

  const didRender = timingsByVNode.end.has(vnode);
  if (!didRender) {
    return;
  }

  const name = getSignalTextName(bindings.getDisplayName(vnode, config));
  if (filters.type.has('hoc')) {
    const res = detectHocs(commit, name, id, hocs);
    hocs = res.hocs;
  }

  commit.operations.push(
    MsgTypes.UPDATE_VNODE_TIMINGS,
    id,
    (timingsByVNode.start.get(vnode) || 0) * 1000,
    (timingsByVNode.end.get(vnode) || 0) * 1000,
  );

  if (profiler.isProfiling && profiler.captureRenderReasons) {
    const reason = renderReasonPre !== null
      ? renderReasonPre.get(vnode) || null
      : bindings.getRenderReasonPost(
        ids,
        bindings,
        timingsByVNode,
        oldVNode,
        vnode,
      );
    if (reason !== null) {
      const count = reason.items ? reason.items.length : 0;
      commit.operations.push(MsgTypes.RENDER_REASON, id, reason.type, count);
      if (reason.items && count > 0) {
        commit.operations.push(
          ...reason.items.map(str => getStringId(commit.strings, str)),
        );
      }
    }
  }

  // updateHighlight(profiler, vnode, bindings);

  const oldChildren = oldVNode
    ? bindings
      .getActualChildren(oldVNode)
      .map((v: any) => v && getVNodeId(ids, v))
    : [];

  let shouldReorder = false;
  let childCount = 0;

  const children = bindings.getActualChildren(vnode);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child == null) {
      const oldChildId = oldChildren[i];
      if (oldChildId != null) {
        commit.unmountIds.push(oldChildId);
      }
    } else if (
      hasVNodeId(ids, child)
      || shouldFilter(child, filters, config, bindings)
    ) {
      if (commit.stats !== null) {
        diff = getDiffType(child, diff);
        childCount++;
      }
      update(
        ids,
        commit,
        owners,
        child,
        ownerId,
        id,
        filters,
        domCache,
        config,
        profiler,
        hocs,
        bindings,
        timingsByVNode,
        renderReasonPre,
      );
      // TODO: This is only sometimes necessary
      shouldReorder = true;
    } else {
      if (commit.stats !== null) {
        diff = getDiffType(child, diff);
        childCount++;
      }
      mount(
        ids,
        commit,
        owners,
        child,
        ownerId,
        id,
        filters,
        domCache,
        config,
        profiler,
        hocs,
        bindings,
        timingsByVNode,
        renderReasonPre,
      );
      shouldReorder = true;
    }
  }

  if (commit.stats !== null) {
    updateDiffStats(commit.stats, diff, childCount);
    recordComponentStats(config, bindings, commit.stats, vnode, children);
  }

  if (shouldReorder) {
    resetChildren(commit, ids, id, vnode, filters, config, bindings);
  }
}

/**
 * Crawl upwards through potentially filtered vnodes until
 * we find a non-filtered node or reach the top of the tree
 */
function findClosestNonFilteredParent<T extends SharedVNode>(
  ids: IdMappingState<T>,
  helpers: PreactBindings<T>,
  vnode: T,
) {
  let parentId = -1;
  let parent: T | null = helpers.getVNodeParent(vnode);
  while (parent !== null) {
    parentId = getVNodeId(ids, parent);
    if (parentId !== -1) {
      break;
    }

    parent = helpers.getVNodeParent(parent);
  }

  return parentId;
}

export function createCommit<T extends SharedVNode>(
  ids: IdMappingState<T>,
  roots: Map<T, Node>,
  owners: Map<T, T>,
  vnode: T,
  filters: FilterState,
  domCache: WeakMap<HTMLElement | Text, T>,
  config: RendererConfig,
  profiler: ProfilerState,
  helpers: PreactBindings<T>,
  timingsByVNode: VNodeTimings<T>,
  renderReasonPre: Map<T, RenderReasonData> | null,
): Commit {
  const commit = {
    operations: [],
    rootId: -1,
    strings: new Map(),
    unmountIds: [],
    renderReasons: new Map(),
    stats: profiler.recordStats ? createStats() : null,
  };

  let parentId = -1;
  // Roots have no known ownerId
  let ownerId = -1;

  const isNew = !hasVNodeId(ids, vnode);

  if (helpers.isRoot(vnode, config)) {
    const children = helpers.getActualChildren(vnode);
    if (commit.stats !== null) {
      const childrenLen = children.length;
      commit.stats.roots[childrenLen > 4 ? 4 : childrenLen]++;
    }

    parentId = -1;

    if (children.length > 0 && helpers.isVNode(children[0])) {
      const child = children[0];
      if (roots.has(child)) {
        const dom = roots.get(child)!;
        roots.delete(child);
        roots.set(vnode, dom);
      }
    }
  } else {
    parentId = findClosestNonFilteredParent(ids, helpers, vnode);
    if (!isNew) {
      ownerId = shouldFilter(vnode, filters, config, helpers)
        ? parentId
        : getVNodeId(ids, vnode);
    }
  }

  if (isNew) {
    mount(
      ids,
      commit,
      owners,
      vnode,
      ownerId,
      parentId,
      filters,
      domCache,
      config,
      profiler,
      [],
      helpers,
      timingsByVNode,
      renderReasonPre,
    );
  } else {
    update(
      ids,
      commit,
      owners,
      vnode,
      ownerId,
      parentId,
      filters,
      domCache,
      config,
      profiler,
      [],
      helpers,
      timingsByVNode,
      renderReasonPre,
    );
  }

  let rootId = getVNodeId(ids, vnode);
  if (rootId === -1) {
    rootId = findClosestNonFilteredParent(ids, helpers, vnode);
  }
  commit.rootId = rootId;

  return commit;
}
