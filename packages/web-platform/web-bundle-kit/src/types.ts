// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The public contract of `@lynx-js/web-bundle-kit`.
 *
 * The kit runs Rsbuild with `pluginLynx` and `pluginReactLynx` on top of
 * `@rspack/browser` and produces Lynx web bundles (`*.web.bundle`) from a
 * project that lives in an in-memory file system.
 *
 * It must be called inside a dedicated Worker of a cross-origin isolated
 * page, because `@rspack/browser` blocks its thread and uses
 * `SharedArrayBuffer`.
 *
 * @packageDocumentation
 */

/**
 * The content of one file: text, or bytes for binary files.
 *
 * @public
 */
export type FileContent = string | Uint8Array;

/**
 * Files keyed by path.
 *
 * Paths are relative to the project root, use `/` as the separator, and have
 * no leading `/`, no `.` or `..` segments and no empty segments.
 * `node_modules/...` is allowed: it is how a host supplies extra dependencies.
 *
 * @public
 */
export type FileMap = Record<string, FileContent>;

/**
 * One change to the project's files. Paths follow the rules of {@link FileMap}.
 *
 * - `write` creates or replaces a file, creating parent directories.
 * - `delete` removes a file, or a directory with everything in it. Deleting a
 *   path that does not exist is not an error.
 * - `rename` moves a file or directory. Renaming a path that does not exist
 *   is an error.
 *
 * @public
 */
export type FileChange =
  | { type: 'write'; path: string; content: FileContent }
  | { type: 'delete'; path: string }
  | { type: 'rename'; from: string; to: string };

/**
 * One error or warning of a build.
 *
 * @public
 */
export interface Diagnostic {
  /** The full message, as Rspack formats it. Always present. */
  message: string;
  /** The project-relative path of the file the message is about, when known. */
  file?: string;
  /** 1-based line, when known. */
  line?: number;
  /** 1-based column, when known. */
  column?: number;
}

/**
 * A card: one entry of the project and the web bundle built from it.
 *
 * @public
 */
export interface CardInfo {
  /** The entry name, a key of {@link WebBundlerOptions.entries}. */
  name: string;
  /** The entry module, as given in {@link WebBundlerOptions.entries}. */
  entry: string;
  /** The asset name of the card's web bundle, for example `main.web.bundle`. */
  bundle: string;
}

/**
 * The name and size of an output asset.
 *
 * @public
 */
export interface AssetInfo {
  /** The asset name: its path relative to the output directory. */
  name: string;
  /** The size in bytes. */
  size: number;
}

/**
 * An output asset with its content.
 *
 * @public
 */
export interface OutputAsset {
  /** The asset name: its path relative to the output directory. */
  name: string;
  /** The bytes of the asset. */
  content: Uint8Array;
}

/**
 * The outcome of one compilation.
 *
 * @public
 */
export interface BuildResult {
  /** The compilation hash. */
  hash: string;
  /** How long the compilation took. */
  durationMs: number;
  /** Errors. The build succeeded when this is empty. */
  errors: Diagnostic[];
  /** Warnings. */
  warnings: Diagnostic[];
  /** One item per entry that produced a web bundle. Empty when the build failed. */
  cards: CardInfo[];
  /** Every asset of this compilation. */
  assets: AssetInfo[];
  /**
   * The assets this compilation wrote: all of them for the first build, and
   * for a rebuild only the new or changed ones, hot-update files included.
   */
  emitted: OutputAsset[];
}

/**
 * What a watching bundler reports.
 *
 * @public
 */
export type BuildEvent =
  | { type: 'start' }
  | { type: 'done'; result: BuildResult };

/**
 * Options of {@link createWebBundler}.
 *
 * @public
 */
export interface WebBundlerOptions {
  /**
   * The cards to build: entry name to entry module, the module being a
   * project-relative path such as `src/index.tsx`. At least one.
   *
   * Each entry produces `<name>.web.bundle`.
   */
  entries: Record<string, string>;

  /**
   * The URL prefix the output assets will be served from. It must end with
   * `/`.
   *
   * The built code requests hot updates, async chunks and static assets from
   * `publicPath + assetName` at run time, so this has to be a URL the embedder
   * really serves the assets at.
   */
  publicPath: string;

  /**
   * The build mode.
   *
   * @defaultValue `'development'`
   */
  mode?: 'development' | 'production';

  /**
   * Whether development builds include the hot update runtime and emit hot
   * updates on rebuilds. Ignored in production mode.
   *
   * Hot-updating bundles expect two things from the embedder, the same two a
   * Lynx DevTool provides:
   *
   * - **Update signals.** Dev-server messages (`hash`, then `ok`, `warnings`
   *   or `errors`) arrive as `message` events of `lynx.getDevtool()`, in the
   *   format `LynxTransportClient` of `@lynx-js/webpack-dev-transport` reads.
   *   On web, send one with `lynxView.sendDevtoolEvent('message', ...)`.
   * - **Full reload.** When an update cannot be applied, the bundle calls
   *   `NativeModules.LynxDevToolSetModule.invokeCdp` with a `Page.reload`
   *   command. On web, provide that module through `nativeModulesMap`.
   *
   * @defaultValue `true`
   */
  hmr?: boolean;

  /**
   * The project's files at start. More can be written later with
   * {@link WebBundler.applyChanges}.
   */
  files?: FileMap;
}

/**
 * A bundler bound to one project and one configuration.
 *
 * To change the entries or the mode, close it and create another one.
 *
 * @public
 */
export interface WebBundler {
  /**
   * Applies changes to the project's files, in order.
   *
   * It resolves when the files are written, without waiting for a build.
   * While watching, the changes of one call cause one rebuild. Calls made
   * while a compilation is running are combined into the rebuild after it.
   */
  applyChanges(changes: FileChange[]): Promise<void>;

  /** Reads a project file. Resolves to `undefined` when it does not exist. */
  readFile(path: string): Promise<Uint8Array | undefined>;

  /** Lists the project's files, as sorted project-relative paths. */
  listFiles(): Promise<string[]>;

  /** Builds once. Not allowed while watching. */
  build(): Promise<BuildResult>;

  /**
   * Builds, then rebuilds whenever {@link WebBundler.applyChanges} is called.
   *
   * The listener gets a `start` and a `done` event for every compilation,
   * the first one included. The promise resolves when the first compilation
   * is done. A bundler can only be watched once.
   */
  watch(listener: (event: BuildEvent) => void): Promise<void>;

  /** Stops watching and frees the compiler. The bundler cannot be used again. */
  close(): Promise<void>;
}

/**
 * Versions of the packages the kit provides to every project under
 * `node_modules`, by package name. A project does not have to supply these.
 *
 * @public
 */
export type BuiltinPackages = Record<string, string>;
