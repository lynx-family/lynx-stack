// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Identify an exposed module for rendering in a host container.
 *
 * The optional entry selects resource delivery, not a hosted or standalone
 * rendering mode.
 * @public
 */
export interface IslandReference {
  /** Key in the build plugin's `exposes` map. */
  expose: string;
  /**
   * Absolute remote bundle URL reachable from the device.
   * @defaultValue Load from the current host bundle.
   */
  entry?: string;
}

/** Container-specific rendering state created by an island module.
 * @public
 */
export interface IslandRenderer<Props> {
  /** Render into an existing host container matching the selector. */
  render(this: void, containerSelector: string, props: Props): void;
  /** Apply a complete props snapshot to the rendered UI. */
  update(this: void, props: Props): void;
  /** Release owned nodes and instance resources. Safe to call repeatedly. */
  dispose(this: void): void;
  /** Activate background work after rendering and successful background initialization. */
  setBackgroundReady?(this: void): void;
}

/** Main-thread module exports consumed by the loader.
 * @public
 */
export interface IslandModule<Props> {
  /** Create fresh rendering state for one host container. */
  create(this: void): IslandRenderer<Props>;
}

/** Main-thread handle with independent background readiness.
 * @public
 */
export interface LoadedIslandModule<Props> extends IslandModule<Props> {
  /** Resolves after background initialization, independently of instance rendering. */
  backgroundReady: Promise<void>;
}

/**
 * Schedule `prepareIslandBackground(reference, replyEvent)` on the host's
 * background thread. The return value signals dispatch errors only.
 * @public
 */
export type DispatchIslandBackground = (
  reference: IslandReference,
  replyEvent: string,
) => unknown;
