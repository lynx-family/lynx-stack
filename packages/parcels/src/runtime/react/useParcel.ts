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

import { prepareParcelBackground } from '../core/background.js';
import { loadParcel } from '../core/main.js' with { runtime: 'shared' };
import { mountLoadedParcel } from '../core/mount.js' with { runtime: 'shared' };
import type { MountParcelOptions, Parcel } from '../core/mount.js';
import type { LoadedParcel, ParcelSource } from '../core/types.js';

/** Lifecycle notifications delivered on the ReactLynx background thread. */
export type ParcelStatus =
  | 'mounted'
  | 'updated'
  | 'background-ready'
  | 'mount-error'
  | 'update-error'
  | 'background-error';

/** React host props and an optional lifecycle observer. */
export interface UseParcelOptions<Props> extends MountParcelOptions<Props> {
  /** Observe lifecycle changes and receive error messages on failure. */
  onStatusChange?:
    | ((status: ParcelStatus, message?: string) => void)
    | undefined;
}

/** Bind a parcel to an empty ReactLynx view and update it when its props change. */
export function useParcel<Props>(
  source: ParcelSource | null,
  { container, props, onStatusChange }: UseParcelOptions<Props>,
): (element: MainThread.Element | null) => void {
  const observer = useRef(onStatusChange);
  observer.current = onStatusChange;
  const notify = useCallback((status: ParcelStatus, message?: string) => {
    'background only';
    if (observer.current) observer.current(status, message);
    else if (message) lynx.reportError(message);
  }, []);
  const binding = useMainThreadRef<{
    attached: boolean;
    parcel: Parcel<Props> | null;
    key: string;
    cached: { key: string; load: Promise<LoadedParcel<Props>> } | null;
    render: (() => void) | null;
  }>({ attached: false, parcel: null, key: '', cached: null, render: null });

  const ref = useCallback((element: MainThread.Element | null) => {
    'main thread';
    const state = binding.current;
    state.attached = element !== null;
    if (state.attached) {
      state.render?.();
    } else {
      state.parcel?.unmount();
      state.parcel = null;
    }
  }, [binding]);

  const commit = useCallback(
    (next: ParcelSource | null, selector: string, data: Props) => {
      'main thread';
      const state = binding.current;
      if (!next) {
        state.render = null;
        state.parcel?.unmount();
        state.parcel = null;
        return;
      }
      const report = runOnBackground(notify);
      const sourceKey = JSON.stringify([
        next.kind,
        next.sectionPrefix,
        next.kind === 'external' ? next.url : '',
      ]);
      const key = JSON.stringify([sourceKey, selector]);
      state.render = () => {
        if (state.parcel && state.key === key) {
          const current = state.parcel;
          void current.update(data).then(() => {
            if (state.parcel === current) void report('updated');
          }, error => {
            if (state.parcel === current) {
              void report('update-error', String(error));
            }
          });
          return;
        }
        state.parcel?.unmount();
        if (state.cached?.key !== sourceKey) {
          const load = loadParcel<Props>(
            next,
            (source, replyEvent) =>
              runOnBackground(prepareParcelBackground)(source, replyEvent),
          );
          state.cached = { key: sourceKey, load };
          void load.catch(() => {
            if (state.cached?.load === load) state.cached = null;
          });
        }
        const current = mountLoadedParcel(state.cached.load, {
          container: selector,
          props: data,
        });
        state.key = key;
        state.parcel = current;
        void current.mountPromise.then(() => {
          if (state.parcel !== current) return;
          void report('mounted');
          void current.backgroundReady.then(() => {
            if (state.parcel === current) void report('background-ready');
          }, error => {
            if (state.parcel === current) {
              void report('background-error', String(error));
            }
          });
        }, error => {
          if (state.parcel === current) {
            state.parcel = null;
            void report('mount-error', String(error));
          }
        });
      };
      if (state.attached) state.render();
    },
    [binding, notify],
  );

  const kind = source?.kind;
  const sectionPrefix = source?.sectionPrefix;
  const url = source?.kind === 'external' ? source.url : undefined;
  useEffect(() => {
    const next: ParcelSource | null =
      kind === undefined || sectionPrefix === undefined
        ? null
        : (kind === 'external'
          ? { kind, sectionPrefix, url: url! }
          : { kind, sectionPrefix });
    void runOnMainThread(commit)(next, container, props).catch(error => {
      lynx.reportError(String(error));
    });
  }, [commit, kind, sectionPrefix, url, container, props]);
  return ref;
}
