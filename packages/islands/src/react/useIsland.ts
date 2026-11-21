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

import { createIslandFromModule } from '../runtime/create.js' with { runtime: 'shared' };
import type { CreateIslandOptions, IslandInstance } from '../runtime/create.js';
import { loadIslandModuleForRender } from '../runtime/load.js' with { runtime: 'shared' };
import { prepareIslandBackground } from '../runtime/prepare-background.js';
import type { IslandReference, LoadedIslandModule } from '../runtime/types.js';

/** Lifecycle notifications delivered on the ReactLynx background thread.
 * @public
 */
export type IslandStatus =
  | 'ready'
  | 'updated'
  | 'background-ready'
  | 'render-error'
  | 'update-error'
  | 'background-error';

/** React host props and an optional lifecycle observer.
 * @public
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
 * Inline references render synchronously when the main-thread ref attaches,
 * including the first frame when the module and initial props are available.
 * Remote references load asynchronously after the background effect runs.
 * Background hydration reuses the existing inline instance.
 * @public
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
    cached: {
      key: string;
      load: LoadedIslandModule<Props> | Promise<LoadedIslandModule<Props>>;
    } | null;
    render: (() => void) | null;
    owner: string;
    attachment: number;
    initial:
      | { module: IslandReference | null; container: string; props: Props }
      | null;
  }>({
    attached: false,
    island: null,
    key: '',
    cached: null,
    render: null,
    owner: '',
    attachment: 0,
    initial: { module, container, props },
  });

  const commit = useCallback(
    (next: IslandReference | null, selector: string, data: Props) => {
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
      const sourceKey = JSON.stringify([
        next.entry ?? '__Card__',
        next.expose,
      ]);
      const key = JSON.stringify([sourceKey, selector]);
      state.render = () => {
        if (state.island && state.key === key) {
          const current = state.island;
          void current.update(data).then(() => {
            if (state.island === current) void report('updated');
          }, error => {
            if (state.island === current) {
              void report('update-error', String(error));
            }
          });
          return;
        }
        state.island?.dispose();
        if (state.cached?.key !== sourceKey) {
          const load = loadIslandModuleForRender<Props>(
            next,
            (source, replyEvent) =>
              runOnBackground(prepareIslandBackground)(source, replyEvent),
          );
          state.cached = { key: sourceKey, load };
          void Promise.resolve(load).catch(() => {
            if (state.cached?.load === load) state.cached = null;
          });
        }
        const current = createIslandFromModule(state.cached.load, {
          container: selector,
          props: data,
        });
        state.key = key;
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
      if (state.attached) state.render();
    },
    [binding, notify],
  );

  const ref = useCallback((element: MainThread.Element | null) => {
    'main thread';
    const state = binding.current;
    const attachment = ++state.attachment;
    state.attached = element !== null;
    if (element === null) {
      if (state.cached && !('create' in state.cached.load)) {
        // Remote instances have no first-screen ref to hand over. Cancel them
        // immediately so a queued download continuation cannot render detached UI.
        const current = state.island;
        state.island = null;
        current?.dispose();
        return;
      }
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
    // Callback refs are detached and attached during hydration. Match the
    // actual native container, since each attachment gets a new EOM wrapper.
    const ownerAttribute = 'data-lynx-island-owner';
    state.owner ||= `island:${Date.now()}:${Math.random()}`;
    if (element.getAttribute(ownerAttribute) !== state.owner) {
      state.island?.dispose();
      state.island = null;
      element.setAttribute(ownerAttribute, state.owner);
    }
    const initial = state.initial;
    if (initial?.module && initial.module.entry === undefined) {
      // The first-screen ref has initial props before background effects run.
      // Hydration preserves this MainThreadRef and the instance it owns.
      commit(initial.module, initial.container, initial.props);
    } else {
      state.render?.();
    }
  }, [binding, commit]);

  const expose = module?.expose;
  const entry = module?.entry;
  useEffect(() => {
    const next: IslandReference | null = expose === undefined
      ? null
      : (entry === undefined ? { expose } : { expose, entry });
    void runOnMainThread(commit)(next, container, props).catch(error => {
      lynx.reportError(String(error));
    });
  }, [commit, expose, entry, container, props]);
  return ref;
}
