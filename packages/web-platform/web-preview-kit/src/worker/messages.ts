// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The messages between the kit page and its bundler worker.
 *
 * The page creates the worker from `bundler-worker.js` next to the page. The
 * worker owns a `WebBundler`, writes the assets of every build to CacheStorage
 * and only then reports the build. Anything that speaks these messages can
 * stand in for it, which is how the tests run the kit without the bundle kit.
 */

import type {
  AssetInfo,
  BuiltinPackages,
  CardInfo,
  Diagnostic,
  FileChange,
  FileMap,
} from '@lynx-js/web-bundle-kit';

/** The configuration of one bundler, the worker's half of `ProjectConfig`. */
export interface BundlerConfig {
  entries: Record<string, string>;
  mode: 'development' | 'production';
  hmr: boolean;
  /** Where the assets are served, the `publicPath` of the bundler. */
  publicPath: string;
  /** The CacheStorage cache to write the assets to. */
  cacheName: string;
}

/** What the worker reports about a build: `BuildResult` without the bytes. */
export interface BuildReport {
  hash: string;
  durationMs: number;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  cards: CardInfo[];
  assets: AssetInfo[];
}

/** Page to worker. Every command with an `id` gets exactly one `reply`. */
export type WorkerCommand =
  /**
   * Closes the current bundler, if any, and starts watching with a new one.
   * `files: null` keeps the files of the current bundler. `generation` tags
   * the build events of the new bundler; `revision` is the file system
   * revision its first build sees.
   */
  | {
    type: 'start';
    id: number;
    generation: number;
    revision: number;
    config: BundlerConfig;
    files: FileMap | null;
  }
  /** Applies one batch of changes, which becomes `revision`. */
  | { type: 'apply'; id: number; revision: number; changes: FileChange[] }
  /** Reads a project file; replies with `Uint8Array` or `null`. */
  | { type: 'read'; id: number; path: string }
  /** Lists the project files; replies with `string[]`. */
  | { type: 'list'; id: number }
  /** Closes the bundler. */
  | { type: 'close'; id: number };

/** Worker to page. */
export type WorkerEvent =
  /**
   * The worker has loaded and can take commands. Sent once. `error` says why
   * it cannot build, when it cannot.
   */
  | { type: 'ready'; builtinPackages: BuiltinPackages; error?: string }
  /** The answer to a command: `error` is set when it failed. */
  | { type: 'reply'; id: number; result?: unknown; error?: string }
  /** A build of `generation` started; it sees `revision`. */
  | { type: 'build-start'; generation: number; revision: number }
  /**
   * A build of `generation` finished and its emitted assets are in the
   * cache.
   */
  | {
    type: 'build-done';
    generation: number;
    revision: number;
    report: BuildReport;
  };
