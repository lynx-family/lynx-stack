// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { loadIslandModuleForRender } from './load.js';
import type {
  IslandReference,
  IslandRenderer,
  LoadedIslandModule,
} from './types.js';

/** Options for creating an island instance in a host container.
 * @public
 */
export interface CreateIslandOptions<Props> {
  /** Selector for an existing empty container. */
  container: string;
  /** Initial data snapshot for the island. */
  props: Props;
}

/** Main-thread controls for one island instance.
 * @public
 */
export interface IslandInstance<Props> {
  /** Resolves after rendering or rejects on failure or cancellation. */
  ready: Promise<void>;
  /** Resolves after rendering and successful background initialization. */
  backgroundReady: Promise<void>;
  /** Apply a full snapshot, retaining the latest props while loading. */
  update(props: Props): Promise<void>;
  /** Cancel pending rendering or synchronously release the instance. */
  dispose(): void;
}

/**
 * Create a container-specific island instance from a reference or an already loaded module.
 *
 * Inline references and already loaded modules render synchronously before
 * this function returns. Remote references render after their bundle loads.
 * Readiness promises still report render failures and background initialization.
 *
 * @example
 * ```ts
 * const module = await loadIslandModule<{ title: string }>({ expose: 'card' });
 * const first = createIsland(module, { container: '#first', props: { title: 'First' } });
 * const second = createIsland(module, { container: '#second', props: { title: 'Second' } });
 * await Promise.all([first.ready, second.ready]);
 * first.dispose();
 * second.dispose();
 * ```
 * @public
 */
export function createIsland<Props>(
  source: IslandReference | LoadedIslandModule<Props>,
  { container, props }: CreateIslandOptions<Props>,
): IslandInstance<Props> {
  return createIslandFromModule(
    'create' in source
      ? source
      : loadIslandModuleForRender<Props>(source),
    { container, props },
  );
}

export function createIslandFromModule<Props>(
  load: LoadedIslandModule<Props> | Promise<LoadedIslandModule<Props>>,
  { container, props }: CreateIslandOptions<Props>,
): IslandInstance<Props> {
  let renderer: IslandRenderer<Props> | undefined;
  let disposed = false;
  let cancelRender: (() => void) | undefined;
  const ready = new Promise<void>((resolve, reject) => {
    cancelRender = () => reject(new Error('Island rendering cancelled'));
    const render = (module: LoadedIslandModule<Props>) => {
      if (disposed) return;
      const nextRenderer = module.create();
      if (
        typeof nextRenderer?.render !== 'function'
        || typeof nextRenderer.update !== 'function'
        || typeof nextRenderer.dispose !== 'function'
      ) {
        throw new Error('Invalid island renderer');
      }
      try {
        nextRenderer.render(container, props);
      } catch (error) {
        nextRenderer.dispose();
        throw error;
      }
      renderer = nextRenderer;
      resolve();
    };
    if ('create' in load) {
      // Promise executors run synchronously. Do not insert a microtask between
      // the first-screen container ref and native node creation.
      render(load);
    } else {
      void load.then(render).catch(reject);
    }
  });
  const backgroundReady = ready.then(() =>
    Promise.resolve(load).then(module => module.backgroundReady)
  ).then(() => {
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
      if (renderer) {
        renderer.update(nextProps);
      } else {
        props = nextProps;
        await ready;
      }
    },
    dispose() {
      if (disposed) return;
      renderer?.dispose();
      renderer = undefined;
      disposed = true;
      cancelRender?.();
      cancelRender = undefined;
    },
  };
}
