import { Store } from '../../view/store/types';
// import { batch } from "@preact/signals-core";
import { recordProfilerCommit } from '../../view/components/profiler/data/commits';
import { ops2Tree } from './operations';
import { applyOperationsV1 } from './legacy/operationsV1';
import { OperationInfo } from '../shared/stats';
import { DevtoolEvents } from '../hook';

const { postPluginMessage } = window as any;

function sumArrays(a: number[], b: number[]) {
  for (let i = 0; i < b.length; i++) {
    a[i] += b[i];
  }
}

function sumOps(a: OperationInfo, b: OperationInfo) {
  a.components += b.components;
  a.elements += b.elements;
  a.text += b.text;
}

/**
 * This is the heart of the devtools. Here we translate incoming events
 * and construct the tree data structure which all operations in the
 * Devtools UI are based upon.
 *
 * We currently expect all operations to be in order.
 */
export function applyOperationsV2(store: Store, data: number[]) {
  const {
    rootId: commitRootId,
    rendered,
    roots,
    tree,
    reasons,
    stats,
  } = ops2Tree(store.nodes.value, store.roots.value, data);

  // Update store data
  store.roots.value = roots;
  store.nodes.value = tree;

  if (store.inspectData.value) {
    const id = store.inspectData.value.id;
    if (tree.has(id)) {
      store.notify('inspect', id);
    }
  }

  // If we are profiling, we'll make a frozen copy of the mutable
  // elements tree because the profiler can step through time
  if (store.profiler.isRecording.value) {
    recordProfilerCommit(
      store.nodes.value,
      store.profiler,
      rendered,
      commitRootId,
    );
    const commitIdx = store.profiler.commits.peek().length - 1;
    const map = store.profiler.renderReasons.value.set(commitIdx, reasons);
    store.profiler.renderReasons.value = new Map(map);
  }

  if (stats !== null) {
    if (store.stats.data.value === null) {
      store.stats.data.value = stats;
    } else {
      const v = store.stats.data.value;
      sumArrays(v.roots, stats.roots);
      sumArrays(v.classComponents, stats.classComponents);
      sumArrays(v.functionComponents, stats.functionComponents);
      sumArrays(v.fragments, stats.fragments);
      sumArrays(v.forwardRef, stats.forwardRef);
      sumArrays(v.memo, stats.memo);
      sumArrays(v.suspense, stats.suspense);
      sumArrays(v.elements, stats.elements);
      v.text += stats.text;
      sumArrays(v.keyed, stats.keyed);
      sumArrays(v.unkeyed, stats.unkeyed);
      sumArrays(v.mixed, stats.mixed);

      sumOps(v.mounts, stats.mounts);
      sumOps(v.updates, stats.updates);
      sumOps(v.unmounts, stats.unmounts);

      const single = v.singleChildType;
      const singleNew = stats.singleChildType;

      single.roots += singleNew.roots;
      single.classComponents += singleNew.classComponents;
      single.functionComponents += singleNew.functionComponents;
      single.fragments += singleNew.fragments;
      single.forwardRef += singleNew.forwardRef;
      single.memo += singleNew.memo;
      single.suspense += singleNew.suspense;
      single.elements += singleNew.elements;

      store.stats.data.value = { ...v };
    }
  }
}

export function applyEvent(store: Store, type: keyof DevtoolEvents, data: any) {
  if (__DEBUG__) console.log('NOTICE: devtools applyEvent', type, data);
  switch (type) {
    case 'attach':
      if (!store.profiler.isSupported.value) {
        store.profiler.isSupported.value = !!data.supportsProfiling;
      }
      if (!store.profiler.supportsRenderReasons.value) {
        store.profiler.supportsRenderReasons.value = !!data
          .supportsRenderReasons;
      }

      if (!store.supports.hooks.value) {
        store.supports.hooks.value = !!data.supportsHooks;
      }

      if (store.profiler.highlightUpdates.value) {
        store.emit('start-highlight-updates', null);
      }
      break;
    case 'operation':
      applyOperationsV1(store, data);
      break;
    case 'operation_v2':
      // batch(() => {
      // What for signals works with react-lynx
      applyOperationsV2(store, data);
      // });
      break;
    case 'inspect-result': {
      const { props, state, context } = store.sidebar;
      store.inspectData.value = data;

      if (store.selection.selected.value !== data.id) {
        store.selection.selectById(data.id);

        // Reset collapsible state
        props.uncollapsed.value = [];
        state.uncollapsed.value = [];
        context.uncollapsed.value = [];
      }
      break;
    }
    case 'select-node':
      store.selection.selectById(data);
      break;
    case 'stop-picker':
      store.isPicking.value = false;
      break;
    case 'root-order': {
      const oldRoots = store.roots.value;
      const newOrder = new Set(data);

      for (let i = 0; i < oldRoots.length; i++) {
        const id = oldRoots[i];
        if (!newOrder.has(id)) {
          data.push(id);
        }
      }

      store.roots.value = data;
      break;
    }
    case 'init': {
      // We have to clear the state manually since browser will reload the extension on reload, but HDT does not reload plugin on react-lynx app reload
      store.roots.value = [];
      break;
    }
    case 'preact-devtools-highlight': {
      const { uniqueId } = data || {};
      if (uniqueId != null) {
        globalThis.preactDevtoolsLDTCtx.highlightUniqueId = uniqueId;
        try {
          if (
            globalThis.preactDevtoolsLDTCtx.devtoolsProps
              ?.onPreactDevtoolsPanelUINodeIdSelected
          ) {
            globalThis.preactDevtoolsLDTCtx.devtoolsProps
              ?.onPreactDevtoolsPanelUINodeIdSelected?.(
                uniqueId,
              );
          } else {
            postPluginMessage?.('uitree-drawer')('Extensions.uitree-drawer', {
              UINodeId: uniqueId,
            });
            postPluginMessage?.('uitree-panel')('Extensions.uitree-panel', {
              UINodeId: uniqueId,
            });
          }
        } catch (err) {
          console.error('preact-devtools-highlight error', err);
        }
      }
      break;
    }
    case 'element-picked-vnode-id': {
      const { id } = data || {};
      if (id != null) {
        store.selection.selectById(id);
      }
      break;
    }
  }
}
