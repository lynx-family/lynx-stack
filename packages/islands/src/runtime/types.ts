// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Identify an exposed module in the host bundle or a remote resource.
 * @internal
 */
export interface IslandReference {
  /** Key in the build plugin's `exposes` map. */
  expose: string;
  /** Absolute resource URL. @defaultValue Omitted, selecting the current host bundle. */
  entry?: string | undefined;
}

/** Options for one synchronous island render call.
 * @internal
 */
export interface IslandRenderOptions {
  /**
   * Commit native node changes made during this render call.
   *
   * Pass false only when the host commits the synchronous first-screen render.
   * Later updates, disposal and asynchronous results must commit independently.
   *
   * @defaultValue true
   * @example
   * ```ts
   * renderer.render('#card', props, { flush: false });
   * ```
   */
  flush?: boolean;
}

/** Container-specific rendering state created by an island module.
 * @internal
 */
export interface IslandRenderer<Props> {
  /** Render into an existing host container matching the selector. */
  render(
    this: void,
    containerSelector: string,
    props: Props,
    options?: IslandRenderOptions,
  ): void;
  /** Apply a complete props snapshot to the rendered UI. */
  update(this: void, props: Props): void;
  /** Release owned nodes and instance resources. Safe to call repeatedly. */
  dispose(this: void): void;
  /** Activate background work after rendering and successful background initialization. */
  setBackgroundReady?(this: void): void;
}

/** Main-thread module exports consumed by the loader.
 * @internal
 */
export interface IslandModule<Props> {
  /** Create fresh rendering state for one host container. */
  create(this: void): IslandRenderer<Props>;
}

/** Main-thread handle with independent background readiness.
 * @internal
 */
export interface LoadedIslandModule<Props> extends IslandModule<Props> {
  /** Resolves after background initialization, independently of instance rendering. */
  backgroundReady: Promise<void>;
}

/**
 * Schedule `prepareIslandBackground(reference, replyEvent)` on the host's
 * background thread. The return value signals dispatch errors only.
 * @internal
 */
export type DispatchIslandBackground = (
  reference: IslandReference,
  replyEvent: string,
) => unknown;
