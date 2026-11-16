// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Location and namespace of an artifact's compiled sections. */
export type ParcelSource =
  | {
    /** Load sections from the current host bundle. */
    kind: 'embedded';
    /** Prefix configured when packaging the artifact. */
    sectionPrefix: string;
  }
  | {
    /** Fetch a bundle before loading its sections. */
    kind: 'external';
    /** Prefix configured when packaging the artifact. */
    sectionPrefix: string;
    /** Absolute bundle URL reachable from the device. */
    url: string;
  };

/** Main-thread contract exported by an artifact. */
export interface ParcelLifecycle<Data> {
  /** Render into an existing host container matching the selector. */
  mount(this: void, containerSelector: string, initialData: Data): void;
  /** Apply a complete data snapshot to the mounted UI. */
  update(this: void, nextData: Data): void;
  /** Release owned nodes and instance resources. Safe to call repeatedly. */
  unmount(this: void): void;
}

/** Main-thread module exports consumed by the loader. */
export interface ParcelExports<Data> extends ParcelLifecycle<Data> {
  /** Called when the background script is ready, even if the artifact has yet to mount. */
  setBackgroundReady?(this: void): void;
}

/** Main-thread handle with independent background readiness. */
export interface LoadedParcel<Data> extends ParcelLifecycle<Data> {
  /** Resolves after background initialization and the artifact's readiness callback. */
  backgroundReady: Promise<void>;
}

/**
 * Schedule `prepareParcelBackground(source, replyEvent)` on the host's
 * background thread. The return value signals dispatch errors only.
 */
export type DispatchParcelBackground = (
  source: ParcelSource,
  replyEvent: string,
) => unknown;
