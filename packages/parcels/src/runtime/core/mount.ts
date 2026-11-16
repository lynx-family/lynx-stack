// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { dispatchParcelBackground } from './bridge.js';
import { loadParcel } from './main.js';
import type { LoadedParcel, ParcelSource } from './types.js';

/** Options for mounting a parcel into a host container. */
export interface MountParcelOptions<Props> {
  /** Selector for an existing empty container. */
  container: string;
  /** Initial data snapshot for the parcel. */
  props: Props;
}

/** Main-thread controls for one requested mount. */
export interface Parcel<Props> {
  /** Resolves after mounting or rejects on failure or cancellation. */
  mountPromise: Promise<void>;
  /** Resolves after mounting and successful background initialization. */
  backgroundReady: Promise<void>;
  /** Apply a full snapshot, retaining the latest props while loading. */
  update(props: Props): Promise<void>;
  /** Cancel a pending mount or synchronously release the mounted UI. */
  unmount(): void;
}

/** Load and mount a parcel, returning its lifecycle controls immediately. */
export function mountParcel<Props>(
  source: ParcelSource,
  { container, props }: MountParcelOptions<Props>,
): Parcel<Props> {
  return mountLoadedParcel(
    loadParcel<Props>(source, dispatchParcelBackground),
    { container, props },
  );
}

export function mountLoadedParcel<Props>(
  load: Promise<LoadedParcel<Props>>,
  { container, props }: MountParcelOptions<Props>,
): Parcel<Props> {
  let mounted: LoadedParcel<Props> | undefined;
  let disposed = false;
  let cancelMount: (() => void) | undefined;
  const mountPromise = new Promise<void>((resolve, reject) => {
    cancelMount = () => reject(new Error('Parcel mount cancelled'));
    void load.then(parcel => {
      if (disposed) return;
      parcel.mount(container, props);
      mounted = parcel;
      resolve();
    }).catch(reject);
  });
  const backgroundReady = mountPromise.then(() =>
    load.then(parcel => parcel.backgroundReady)
  );
  // Hosts can render and use local updates without observing background readiness.
  void backgroundReady.catch(() => {
    // Keep the original rejection available to callers.
  });

  return {
    mountPromise,
    backgroundReady,
    async update(nextProps) {
      if (disposed) throw new Error('Cannot update an unmounted parcel');
      if (mounted) {
        mounted.update(nextProps);
      } else {
        props = nextProps;
        await mountPromise;
      }
    },
    unmount() {
      if (disposed) return;
      mounted?.unmount();
      mounted = undefined;
      disposed = true;
      cancelMount?.();
      cancelMount = undefined;
    },
  };
}
