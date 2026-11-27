// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** The messages between the kit page and its bundler worker. */

import type { BuildResult, FileChange, FileMap } from '@lynx-js/web-bundle-kit';

/** The configuration of one bundler. */
export interface BundlerConfig {
  entries: Record<string, string>;
  /** Where the assets are served, the `publicPath` of the bundler. */
  publicPath: string;
  /** The CacheStorage cache to write the assets to. */
  cacheName: string;
}

/** What the worker reports about a build: `BuildResult` without the bytes. */
export type BuildReport = Omit<BuildResult, 'emitted'>;

/** Page to worker. The worker answers each command with one `reply`. */
export type WorkerCommand =
  /**
   * Closes the current bundler and starts watching with a new one.
   * `files: null` keeps the files of the current bundler. `generation` tags
   * the build events of the new bundler; `revision` is the file system
   * revision its first build sees.
   */
  | {
    type: 'start';
    generation: number;
    revision: number;
    config: BundlerConfig;
    files: FileMap | null;
  }
  /** Applies one batch of changes, which becomes `revision`. */
  | { type: 'apply'; revision: number; changes: FileChange[] }
  /** Reads a project file; replies with `Uint8Array` or `undefined`. */
  | { type: 'read'; path: string }
  /** Lists the project files; replies with `string[]`. */
  | { type: 'list' }
  | { type: 'close' };

/** Worker to page. */
export type WorkerEvent =
  /** The answer to the command with `id`: `error` is set when it failed. */
  | { type: 'reply'; id: number; result?: unknown; error?: string }
  | { type: 'build-start'; generation: number; revision: number }
  /** A build finished and its assets are in the cache. */
  | {
    type: 'build-done';
    generation: number;
    revision: number;
    report: BuildReport;
  };
