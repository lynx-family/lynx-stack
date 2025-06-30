import { Renderer } from './renderer';
import { ID } from '../view/store/types';
import { createAdapter, InspectData, UpdateType } from './adapter/adapter';
import { DEFAULT_FIlTERS, FilterState, RawFilterState } from './adapter/filter';
import { RawTimelineFilterState } from './adapter/profiler';
import { Options } from 'preact';
import { createRenderer, RendererConfig } from './shared/renderer';
import { setupOptionsV10 } from './10/options';
import parseSemverish from './parse-semverish';
import { PortPageHook } from './adapter/port';
import { PROFILE_RELOAD, STATS_RELOAD } from '../constants';
import { setupOptionsV11 } from './11/options';
import { newProfiler } from './adapter/profiler';
import { createIdMappingState } from './shared/idMapper';
import { bindingsV10 } from './10/bindings';
import { bindingsV11 } from './11/bindings';

export type EmitterFn = (event: string, data: any) => void;

export interface ProfilerOptions {
  captureRenderReasons?: boolean;
}

export interface DevtoolEvents {
  'update-prop': { id: ID; path: string; value: any };
  'update-state': { id: ID; path: string; value: any };
  'update-context': { id: ID; path: string; value: any };
  'update-signal': { id: ID; path: string; value: any };
  'update-hook': { id: ID; value: any; meta: any };
  /**
   * @deprecated
   */
  'force-update': ID;
  'start-picker': null;
  'stop-picker': null;
  'start-profiling': ProfilerOptions;
  'stop-profiling': null;
  'clear-profiling': null;
  'reload-and-profile': ProfilerOptions;
  'start-stats-recording': null;
  'stop-stats-recording': null;
  'clear-stats': null;
  'reload-and-record-stats': null;
  'start-highlight-updates': null;
  'stop-highlight-updates': null;
  'update-filter': RawFilterState;
  'update-timeline-filter': RawTimelineFilterState;
  'load-host-selection': null;
  'inspect-host-node': null;
  'view-source': ID;
  copy: string;
  highlight: ID | null;
  log: { id: ID; children: ID[] };
  inspect: ID;
  'select-node': ID;
  update: { id: ID; type: UpdateType; path: string; value: any };
  'inspect-result': InspectData;
  attach: { id: ID; supportsProfiling: boolean };
  initialized: null;
  init: null;
  refresh: null;
  disconnect: null;
  suspend: { id: ID; active: boolean };
  'root-order-page': null;
  'root-order': number[];
  operation: number[];
  operation_v2: number[];
  'preact-devtools-highlight': { snapshotId: number; uniqueId: number };
  'element-picked': { uniqueId: number };
  'element-picked-vnode-id': { id: number };
}
export type EmitFn = <K extends keyof DevtoolEvents>(
  name: K,
  data: DevtoolEvents[K],
) => void;

export interface DevtoolsHook {
  /** Currently selected node in the native browser's Elements panel */
  $0: HTMLElement | null;
  /** Function to inspect for view source feature */
  // eslint-disable-next-line @typescript-eslint/ban-types
  $type: Function | null;
  connected: boolean;
  emit: EmitFn;
  listen: (fn: (name: string, cb: any) => any) => void;
  renderers: Map<number, Renderer>;
  attachPreact?(
    version: string,
    options: Options,
    config: RendererConfig,
  ): number;
  attach(renderer: Renderer): number;
  detach(id: number): void;
}

/**
 * Create hook to which Preact will subscribe and listen to. The hook
 * is the entrypoint where everything begins.
 */
export function createHook(port: PortPageHook): DevtoolsHook {
  const window = preactDevtoolsCtx;

  const { listen, send } = port;
  const renderers = new Map<number, Renderer>();
  let uid = 0;
  let status: 'connected' | 'pending' | 'disconnected' = 'disconnected';

  const profiler = newProfiler();
  const filters: FilterState = DEFAULT_FIlTERS;

  // Lazily init the adapter when a renderer is attached
  const init = () => {
    createAdapter(port, profiler, renderers);

    status = 'pending';
    listen('init', () => {
      status = 'connected';
    });
    send('init', null);
  };

  const attachRenderer = (
    renderer: Renderer,
    supports: { renderReasons?: boolean; hooks?: boolean; profiling?: boolean },
  ) => {
    if (status === 'disconnected') {
      init();
    }

    renderers.set(++uid, renderer);

    // Content Script is likely not ready at this point, so don't
    // flush any events here and politely request it to initialize
    send('attach', {
      id: uid,
      supportsProfiling: !!supports.profiling,
      supportsRenderReasons: !!supports.renderReasons,
      supportsHooks: !!supports.hooks,
    });

    // Feature: Profile and reload
    // Check if we should immediately start profiling on create
    const profilerOptions = window.localStorage.getItem(PROFILE_RELOAD);
    if (profilerOptions !== null) {
      window.localStorage.removeItem(PROFILE_RELOAD);

      const options = JSON.parse(profilerOptions);
      profiler.isProfiling = true;
      profiler.captureRenderReasons = !!options?.captureRenderReasons;
    }

    const statsOptions = window.localStorage.getItem(STATS_RELOAD);
    if (statsOptions !== null) {
      window.localStorage.removeItem(STATS_RELOAD);
      profiler.recordStats = true;
    }

    return uid;
  };

  // Delete all roots when the current frame is closed
  // @ts-ignore
  const tt = lynxCoreInject.tt;
  if (tt.callDestroyLifetimeFun) {
    const oldCallDestroyLifetimeFun = tt.callDestroyLifetimeFun;
    tt.callDestroyLifetimeFun = () => {
      oldCallDestroyLifetimeFun();
      renderers.forEach((r) => {
        if (r.clear) r.clear();
      });
    };
  }

  // TODO: This should be added to codesandbox itself. I'm not too
  // happy with having site specific code in the extension, but
  // codesandbox is very popular among the Preact/React community
  // so this will get us started
  window.addEventListener('message', (e) => {
    if (
      renderers.size > 0
      && e.data
      && e.data.codesandbox
      && e.data.type === 'compile'
    ) {
      renderers.forEach((r) => {
        if (r.clear) r.clear();
      });
    }
  });

  return {
    $0: null,
    $type: null,
    renderers,
    get connected() {
      return status === 'connected';
    },
    set connected(_) {
      // eslint-disable-next-line no-console
      console.warn('Mutating __PREACT_DEVTOOLS__.connected is deprecated.');
    },
    emit: port.send,
    listen: () => {
      // eslint-disable-next-line no-console
      console.error('__PREACT_DEVTOOLS__.listen() is deprecated.');
    },
    attachPreact: (version, options, config) => {
      if (status === 'disconnected') {
        init();
      }

      // attach the correct renderer/options hooks based on the preact version
      const preactVersionMatch = parseSemverish(version);

      if (!preactVersionMatch) {
        // eslint-disable-next-line no-console
        console.error(
          `[PREACT DEVTOOLS] Could not parse preact version ${version}`,
        );
        return -1;
      }

      // Create an integer-based namespace to avoid clashing ids caused by
      // multiple connected renderers
      const namespace = Math.floor(Math.random() * 2 ** 32);

      const roots = new Map<any, Node>();

      // currently we only support preact >= 10, later we can add another branch for major === 8
      if (preactVersionMatch.major == 10) {
        const supports = {
          renderReasons: !!config.Component,
          hooks:
            (preactVersionMatch.minor === 4 && preactVersionMatch.patch >= 1)
            || preactVersionMatch.minor > 4,
          profiling: true,
        };

        const idMapper = createIdMappingState(
          namespace,
          bindingsV10.getInstance,
        );
        lynx
          .getJSModule('GlobalEventEmitter')
          .removeAllListeners('onBackgroundSnapshotInstanceUpdateId');
        lynx.getJSModule('GlobalEventEmitter').addListener(
          'onBackgroundSnapshotInstanceUpdateId',
          // @ts-expect-error
          ({
            backgroundSnapshotInstance,
            oldId,
            newId,
          }: {
            backgroundSnapshotInstance: any;
            oldId: number;
            newId: number;
          }) => {
            idMapper.updateSnapshotId(oldId, newId);
          },
        );

        const renderer = createRenderer(
          port,
          config as any,
          options,
          supports,
          profiler,
          filters,
          idMapper,
          bindingsV10,
          roots,
          version,
        );
        setupOptionsV10(options, renderer, roots, config as any);
        return attachRenderer(renderer, supports);
      } else if (preactVersionMatch.major === 11) {
        const idMapper = createIdMappingState(
          namespace,
          bindingsV11.getInstance,
        );

        const renderer = createRenderer(
          port,
          config,
          options as any,
          { hooks: true, renderReasons: true },
          profiler,
          filters,
          idMapper,
          bindingsV11,
          roots,
          version,
        );
        setupOptionsV11(options as any, renderer, roots, config, profiler);
        return attachRenderer(renderer, {
          hooks: true,
          renderReasons: true,
          profiling: true,
        });
      }

      // eslint-disable-next-line no-console
      console.error(
        `[PREACT DEVTOOLS] No devtools adapter exists for preact version "${version}". This is likely a bug in devtools.`,
      );
      return -1;
    },
    attach: (renderer) => attachRenderer(renderer, { renderReasons: false }),
    detach: (id) => renderers.delete(id),
  };
}
