import { DevtoolEvents, DevtoolsHook } from '../hook';
import { getRendererByVNodeId, Renderer } from '../renderer';
import { copyToClipboard } from '../../shells/shared/utils';
import { createPicker } from './picker';
import { ID } from '../../view/store/types';
import { createHightlighter } from './highlight';
import { parseFilters } from './filter';
import { PortPageHook } from './port';
import { PropData } from '../../view/components/sidebar/inspect/parseProps';
import { PROFILE_RELOAD, STATS_RELOAD } from '../../constants';
import { ProfilerState } from './profiler';
import { RootData, sortRoots } from '../shared/utils';

export type Path = Array<string | number>;

export type UpdateType = 'props' | 'state' | 'hooks' | 'context';

export interface Adapter {
  highlight(id: ID | null): void;
  inspect(id: ID): void;
  startPickElement(): void;
  stopPickElement(): void;
  log(data: { id: ID; children: ID[] }): void;
  copy(value: string): void;
  update(id: ID, type: UpdateType, path: Path, value: any): void;
  select(id: ID): void;
}

export interface InspectData {
  id: ID;
  name: string;
  type: any;
  key: string | null;
  context: Record<string, any> | null;
  hooks: PropData[] | null;
  props: Record<string, any> | null;
  state: Record<string, any> | null;
  signals: Record<string, any> | null;
  canSuspend: boolean;
  /** Only Suspense components have this */
  suspended: boolean;
  /** Preact version that rendered this VNode */
  version: string;
  __source: Source;
}

export interface Source {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}

export function createAdapter(
  port: PortPageHook,
  profiler: ProfilerState,
  renderers: Map<number, Renderer>,
) {
  const window = preactDevtoolsCtx;

  const { listen, send, listenToPage } = port;

  const forAll = (fn: (renderer: Renderer) => void) => {
    for (const r of renderers.values()) {
      fn(r);
    }
  };

  const highlight = createHightlighter(
    renderers,
    port,
    id => getRendererByVNodeId(renderers, id),
  );

  const inspect = (id: ID) => {
    const data = getRendererByVNodeId(renderers, id)?.inspect(id);
    if (data) {
      send('inspect-result', data);
    }
  };

  const picker = createPicker(
    // window,
    renderers,
    id => {
      highlight.highlight(id);
      if (id > -1) {
        inspect(id);
        send('select-node', id);
      }
    },
    () => {
      send('stop-picker', null);
      highlight.destroy();
    },
  );

  listen('start-picker', () => picker.start());
  listen('stop-picker', () => picker.stop());

  listen('copy', value => {
    try {
      const data = JSON.stringify(value, null, 2);
      copyToClipboard(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }
  });

  listen('inspect', id => {
    if (id === null) return;
    const res = getRendererByVNodeId(renderers, id)?.findDomForVNode(id);

    if (res && res.length > 0) {
      (globalThis as any).__PREACT_DEVTOOLS__.$0 = res[0];
    }
    inspect(id);
  });

  listen('log', e => {
    getRendererByVNodeId(renderers, e.id)?.log(e.id, e.children);
  });

  listen('highlight', id => {
    if (id == null) highlight.destroy();
    else highlight.highlight(id);
  });

  listen('element-picked', ({ uniqueId }) => {
    if (uniqueId == null) return;
    const rendererList = [...renderers.values()];
    // Unlike Chrome extension, we only have one renderer here
    const id = rendererList[0].getIdByUniqueId(uniqueId);
    if (id != null) {
      port.send('element-picked-vnode-id', {
        id,
      });
    }
  });

  listen('disconnect', () => {
    // The devtools disconnected, clear any stateful
    // ui elements we may be displaying.
    highlight.destroy();
  });

  const update = (data: DevtoolEvents['update']) => {
    const { id, type, path, value } = data;

    getRendererByVNodeId(renderers, id)?.update(
      id,
      type,
      path.split('.').slice(1),
      value,
    );

    // Notify all frontends that something changed
    inspect(id);
  };

  listenToPage('root-order-page', () => {
    let roots: RootData[] = [];
    renderers.forEach(r => {
      const m = r.getRootMappings();
      roots = roots.concat(m);
    });

    const sorted = sortRoots(document.body, roots);
    send('root-order', sorted);
  });

  listen('update-prop', data => update({ ...data, type: 'props' }));
  listen('update-state', data => update({ ...data, type: 'state' }));
  listen('update-context', data => update({ ...data, type: 'context' }));
  listen('update-signal', data => {
    getRendererByVNodeId(renderers, data.id)?.updateSignal?.(
      data.id,
      +data.path.replace('root.', '').replace('.value', ''),
      data.value,
    );
  });
  listen('update-hook', data => {
    if (!data.meta) return;

    getRendererByVNodeId(renderers, data.id)?.updateHook?.(
      data.id,
      data.meta.index,
      data.value,
    );
  });

  listen('update-filter', data => {
    const filters = parseFilters(data);
    forAll(r => r.applyFilters(filters));
  });

  listen('refresh', () => forAll(r => r.refresh?.()));

  // Profiler
  listen('start-profiling', options => {
    profiler.isProfiling = true;
    profiler.captureRenderReasons = !!options && !!options.captureRenderReasons;
  });
  listen('stop-profiling', () => {
    profiler.isProfiling = false;
  });
  listen('reload-and-profile', options => {
    window.localStorage.setItem(PROFILE_RELOAD, JSON.stringify(options));

    try {
      lynx.reload({}, () => {});
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Preact Devtools was not able to reload the current page.');
      // eslint-disable-next-line no-console
      console.log(err);
    }
  });

  // Stats
  listen('start-stats-recording', () => {
    profiler.recordStats = true;
  });
  listen('stop-stats-recording', () => {
    profiler.recordStats = false;
  });
  listen('reload-and-record-stats', () => {
    window.localStorage.setItem(STATS_RELOAD, 'true');

    try {
      lynx.reload({}, () => {});
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Preact Devtools was not able to reload the current page.');
      // eslint-disable-next-line no-console
      console.log(err);
    }
  });

  listen('start-highlight-updates', () => {
    profiler.highlightUpdates = true;
  });
  listen('stop-highlight-updates', () => {
    profiler.highlightUpdates = false;
    profiler.updateRects.clear();
    profiler.pendingHighlightUpdates.clear();
  });

  listen('load-host-selection', () => {
    const hook: DevtoolsHook = (window as any).__PREACT_DEVTOOLS__;
    const selected = hook.$0;
    if (selected) {
      forAll(r => {
        const id = r.findVNodeIdForDom(selected);
        if (id > -1) {
          send('select-node', id);
        }
      });
    }
  });

  listen('view-source', id => {
    const vnode = getRendererByVNodeId(renderers, id)?.getVNodeById(id);
    const hook: DevtoolsHook = (window as any).__PREACT_DEVTOOLS__;

    if (vnode && typeof vnode.type === 'function') {
      const { type } = vnode;
      hook.$type = type && type.prototype && type.prototype.render
        ? type.prototype.render
        : type;
    } else {
      hook.$type = null;
    }
  });

  listen('suspend', data => {
    getRendererByVNodeId(renderers, data.id)?.suspend?.(data.id, data.active);
  });
}
