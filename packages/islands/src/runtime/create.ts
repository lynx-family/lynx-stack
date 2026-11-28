// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { loadIslandModule } from './load.js';
import type {
  IslandReference,
  IslandRenderOptions,
  IslandRenderer,
  LoadedIslandModule,
} from './types.js';

/** Options for creating an island instance in a host container.
 * @internal
 */
export interface CreateIslandOptions<Props> {
  /** Selector for an existing empty container. */
  container: string;
  /** Initial data snapshot for the island. */
  props: Props;
}

/** Main-thread controls for one island instance.
 * @internal
 */
export interface IslandInstance<Props> {
  /** Resolves after synchronous rendering or rejects on renderer failure. */
  ready: Promise<void>;
  /** Resolves after rendering and successful background initialization. */
  backgroundReady: Promise<void>;
  /** Apply a complete props snapshot to the rendered instance. */
  update(props: Props): Promise<void>;
  /** Synchronously release the instance and prevent background activation. */
  dispose(): void;
}

/**
 * Create a container-specific island instance from a reference or an already loaded module.
 *
 * Host modules render synchronously; remote modules render after loading.
 * Resource loading errors throw synchronously; readiness promises report
 * renderer failures and background initialization.
 *
 * @example
 * ```ts
 * const module = loadIslandModule<{ title: string }>({ expose: 'card' });
 * const first = createIsland(module, { container: '#first', props: { title: 'First' } });
 * const second = createIsland(module, { container: '#second', props: { title: 'Second' } });
 * await Promise.all([first.ready, second.ready]);
 * first.dispose();
 * second.dispose();
 * ```
 * @internal
 */
export function createIsland<Props>(
  source:
    | IslandReference
    | LoadedIslandModule<Props>
    | Promise<LoadedIslandModule<Props>>,
  { container, props }: CreateIslandOptions<Props>,
): IslandInstance<Props> {
  return createIslandFromModule(
    'create' in source || 'then' in source
      ? source
      : loadIslandModule<Props>(source),
    { container, props },
  );
}

export function createIslandFromModule<Props>(
  module: LoadedIslandModule<Props> | Promise<LoadedIslandModule<Props>>,
  { container, props }: CreateIslandOptions<Props>,
  renderOptions?: IslandRenderOptions,
): IslandInstance<Props> {
  let renderer: IslandRenderer<Props> | undefined;
  let disposed = false;
  let latestProps = props;
  let loaded: LoadedIslandModule<Props> | undefined;
  let rejectReady!: (error: Error) => void;
  // Promise executors run synchronously, preserving first-frame node creation.
  const ready = new Promise<void>((resolve, reject) => {
    rejectReady = reject;
    const render = (
      value: LoadedIslandModule<Props>,
      options?: IslandRenderOptions,
    ) => {
      if (disposed) return;
      loaded = value;
      const nextRenderer = value.create();
      if (
        typeof nextRenderer?.render !== 'function'
        || typeof nextRenderer.update !== 'function'
        || typeof nextRenderer.dispose !== 'function'
      ) {
        throw new Error('Invalid island renderer');
      }
      try {
        nextRenderer.render(container, latestProps, options);
      } catch (error) {
        nextRenderer.dispose();
        throw error;
      }
      renderer = nextRenderer;
      resolve();
    };
    if ('then' in module) {
      // Async rendering happens after the host commit and must flush itself.
      void module.then(value => render(value)).catch(reject);
    } else {
      render(module, renderOptions);
    }
  });
  const backgroundReady = ready.then(() => loaded!.backgroundReady).then(() => {
    if (disposed) throw new Error('Island background activation cancelled');
    renderer?.setBackgroundReady?.();
  });
  // Hosts can render and use local updates without observing background readiness.
  void backgroundReady.catch(() => {
    // Keep the original rejection available to callers.
  });

  return {
    ready,
    backgroundReady,
    async update(nextProps) {
      if (disposed) throw new Error('Cannot update a disposed island');
      latestProps = nextProps;
      if (renderer) {
        renderer.update(nextProps);
      } else {
        await ready;
      }
    },
    dispose() {
      if (disposed) return;
      renderer?.dispose();
      renderer = undefined;
      disposed = true;
      rejectReady(new Error('Island rendering cancelled'));
    },
  };
}
