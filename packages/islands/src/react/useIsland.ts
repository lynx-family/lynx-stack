// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  runOnBackground,
  runOnMainThread,
  useCallback,
  useEffect,
  useMainThreadRef,
  useRef,
} from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import { getIslandContainerId } from '../runtime/container.js' with { runtime: 'shared' };
import { createIslandFromModule } from '../runtime/create.js' with { runtime: 'shared' };
import type { CreateIslandOptions, IslandInstance } from '../runtime/create.js';
import { loadIslandModule } from '../runtime/load.js' with { runtime: 'shared' };
import { prepareIslandBackground } from '../runtime/prepare-background.js';
import type {
  IslandReference,
  IslandRenderOptions,
  LoadedIslandModule,
} from '../runtime/types.js';

/** Lifecycle notifications delivered on the ReactLynx background thread.
 * @internal
 */
export type IslandStatus =
  | 'ready'
  | 'updated'
  | 'background-ready'
  | 'render-error'
  | 'update-error'
  | 'background-error';

/** React host props and an optional lifecycle observer.
 * @internal
 */
export interface UseIslandOptions<Props> extends CreateIslandOptions<Props> {
  /** Observe lifecycle changes and receive error messages on failure. */
  onStatusChange?:
    | ((status: IslandStatus, message?: string) => void)
    | undefined;
}

/**
 * Bind an island instance to an empty ReactLynx view and update it when its props change.
 *
 * Modules render synchronously when the main-thread ref attaches,
 * including the first frame when the module and initial props are available.
 * Background hydration reuses the existing instance.
 * @internal
 */
export function useIsland<Props>(
  module: IslandReference | null,
  { container, props, onStatusChange }: UseIslandOptions<Props>,
): (element: MainThread.Element | null) => void {
  const observer = useRef(onStatusChange);
  observer.current = onStatusChange;
  const notify = useCallback((status: IslandStatus, message?: string) => {
    'background only';
    if (observer.current) observer.current(status, message);
    else if (message) lynx.reportError(message);
  }, []);
  const binding = useMainThreadRef<{
    attached: boolean;
    island: IslandInstance<Props> | null;
    key: string;
    snapshot: string | undefined | null;
    cached: {
      key: string;
      module: LoadedIslandModule<Props>;
    } | null;
    render: ((options?: IslandRenderOptions) => void) | null;
    containerId: number | undefined;
    attachment: number;
    initial:
      | { module: IslandReference | null; container: string; props: Props }
      | null;
  }>({
    attached: false,
    island: null,
    key: '',
    snapshot: null,
    cached: null,
    render: null,
    containerId: undefined,
    attachment: 0,
    initial: __MAIN_THREAD__ ? { module, container, props } : null,
  });

  const commit = useCallback(
    (
      next: IslandReference | null,
      selector: string,
      data: Props,
      renderOptions?: IslandRenderOptions,
    ) => {
      'main thread';
      const state = binding.current;
      state.initial = null;
      if (!next) {
        state.render = null;
        state.island?.dispose();
        state.island = null;
        return;
      }
      const report = runOnBackground(notify);
      const sourceKey = next.expose;
      const key = JSON.stringify([sourceKey, selector]);
      state.render = options => {
        // Thread transport creates new objects. Compare the serialized snapshot,
        // not object identity, when hydration hands the initial props back.
        const snapshot = JSON.stringify(data);
        if (state.island && state.key === key) {
          if (state.snapshot === snapshot) return;
          const current = state.island;
          state.snapshot = snapshot;
          void current.update(data).then(() => {
            if (state.island === current) void report('updated');
          }, error => {
            if (state.island === current) {
              if (state.snapshot === snapshot) state.snapshot = null;
              void report('update-error', String(error));
            }
          });
          return;
        }
        state.island?.dispose();
        state.island = null;
        if (state.cached?.key !== sourceKey) {
          state.cached = null;
          try {
            const module = loadIslandModule<Props>(
              next,
              (source, replyEvent) =>
                runOnBackground(prepareIslandBackground)(source, replyEvent),
            );
            state.cached = { key: sourceKey, module };
          } catch (error) {
            void report('render-error', String(error));
            return;
          }
        }
        const current = createIslandFromModule(
          state.cached.module,
          { container: selector, props: data },
          options,
        );
        state.key = key;
        state.snapshot = snapshot;
        state.island = current;
        void current.ready.then(() => {
          if (state.island !== current) return;
          void report('ready');
          void current.backgroundReady.then(() => {
            if (state.island === current) void report('background-ready');
          }, error => {
            if (state.island === current) {
              void report('background-error', String(error));
            }
          });
        }, error => {
          if (state.island === current) {
            state.island = null;
            void report('render-error', String(error));
          }
        });
      };
      if (state.attached) state.render(renderOptions);
    },
    [binding, notify],
  );

  const ref = useCallback((element: MainThread.Element | null) => {
    'main thread';
    const state = binding.current;
    const attachment = ++state.attachment;
    state.attached = element !== null;
    if (element === null) {
      // Allow a synchronous ref handoff on the same container to finish. A
      // removed container remains detached and releases its instance afterward.
      void Promise.resolve().then(() => {
        if (state.attachment !== attachment || state.attached) return;
        const current = state.island;
        state.island = null;
        current?.dispose();
      }).catch(error => {
        lynx.reportError(String(error));
      });
      return;
    }
    const containerId = getIslandContainerId(container);
    if (containerId !== state.containerId) {
      state.island?.dispose();
      state.island = null;
      state.containerId = containerId;
    }
    const initial = state.initial;
    if (initial?.module) {
      // The first-screen ref has initial props before background effects run.
      // Hydration preserves this MainThreadRef and the instance it owns.
      commit(initial.module, initial.container, initial.props, {
        flush: false,
      });
    } else {
      state.render?.();
    }
  }, [binding, commit, container]);

  const expose = module?.expose;
  useEffect(() => {
    const next: IslandReference | null = expose === undefined
      ? null
      : { expose };
    void runOnMainThread(commit)(next, container, props).catch(error => {
      lynx.reportError(String(error));
    });
  }, [commit, expose, container, props]);
  return ref;
}
