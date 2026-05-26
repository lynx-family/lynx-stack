// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Schema types for the Lynx `debug-metadata.json` format.
 *
 * The shape captured here is the canonical contract between producers
 * (today only `@lynx-js/debug-metadata-rsbuild-plugin`) and consumers
 * (reverse-symbolication services, DevTools inspectors, upload CLIs).
 * The format grows by **adding** fields — producers fill in what they
 * can; consumers should treat unknown fields as opaque rather than
 * rejecting the payload.
 */

/**
 * One debug data source attached to an {@link Artifact}.
 *
 * Tagged union so future debug data kinds (e.g. WASM debug info,
 * R-source-map) can be added without restructuring `artifacts[]`.
 *
 * @public
 */
export type DebugSource = SourceMapDebugSource | BytecodeDebugInfoSource;

/**
 * Source Map v3 debug data attached to a JS / CSS artifact.
 *
 * @public
 */
export interface SourceMapDebugSource {
  kind: 'source-map';
  /** Basename of the `.map` file, e.g. `main-thread.js.map`. */
  filename: string;
  /** Bundler-relative path of the `.map` file, e.g. `.rspeedy/main/main-thread.js.map`. */
  path: string;
  /**
   * Identifier that platform-side reverse symbolication uses to match
   * this map. Defaults to the producing chunk's hash. Matches the
   * `release` option Slardar's webpack plugin already understands.
   */
  key: string;
  /** Full Source Map v3 payload. */
  map: SourceMap;
}

/**
 * Source Map v3 payload, per the [Source Map Revision 3 proposal](https://sourcemaps.info/spec.html).
 *
 * Declared here (instead of imported from `source-map`) to keep this
 * package zero-dependency and prevent transitive consumers from pulling
 * the ~200 kB `source-map` runtime just for a TypeScript type.
 *
 * @public
 */
export interface SourceMap {
  version: 3;
  /** Generated output filename this map describes. */
  file?: string;
  /** Optional prefix prepended to every entry in `sources`. */
  sourceRoot?: string;
  /** Original source file URLs / identifiers. */
  sources: string[];
  /** Inline source contents, parallel to `sources`. */
  sourcesContent?: (string | null)[];
  /** Symbol names referenced from `mappings`. */
  names: string[];
  /** VLQ-encoded mapping data. */
  mappings: string;
  /**
   * Index-map sections, exclusive with the simple-map shape. Producers
   * either set `sections` (index map) or the other fields, not both.
   */
  sections?: SourceMapSection[];
}

/**
 * One section of an index source map.
 *
 * @public
 */
export interface SourceMapSection {
  offset: { line: number; column: number };
  map: SourceMap;
}

/**
 * Bytecode debug info for a main-thread artifact compiled to lepusNG
 * (and, in the future, other bytecode targets).
 *
 * @public
 */
export interface BytecodeDebugInfoSource {
  kind: 'bytecode-debug-info';
  /**
   * Bytecode debug payload. Today always lepusNG-shaped; if/when other
   * encoders (`quickjs`, …) need to coexist, a `target` discriminator
   * will be added.
   */
  debugInfo: LepusNGDebugInfo;
}

/**
 * lepusNG-encoded bytecode's debug payload, identical to the JSON the
 * encoder writes to `debug-info.json`. The top-level `lepusNG_debug_info`
 * key is preserved so consumers (Lynx runtime, reverse-symbolication
 * services) can treat a `?field=bytecode-debug-info` response and the
 * legacy `debug-info.json` file as the same shape.
 *
 * @public
 */
export interface LepusNGDebugInfo {
  lepusNG_debug_info: LepusNGDebugInfoBody;
}

/**
 * Inner body of {@link LepusNGDebugInfo}. Carries the function-level
 * debug data the lepusNG encoder produces for one compilation unit.
 *
 * @public
 */
export interface LepusNGDebugInfoBody {
  /** Full JS source that was fed to the bytecode compiler. */
  function_source: string;
  /** Number of compiled functions; equals `function_info.length`. */
  function_number: number;
  /** Last source line covered by the compilation unit. */
  end_line_num: number;
  /** Per-function debug data. */
  function_info: LepusNGFunctionInfo[];
}

/**
 * Debug data for one lepusNG function: maps bytecode PC offsets back to
 * `(line, column)` in the original source, plus optional caller info.
 *
 * @public
 */
export interface LepusNGFunctionInfo {
  function_id: number;
  function_name: string;
  file_name: string;
  /** Source line where the function definition starts (1-based). */
  line_number: number;
  /** Source column where the function definition starts (0-based). */
  column_number: number;
  /** Length of `pc2line_buf` in bytes. */
  pc2line_len: number;
  /**
   * Variable-length encoding of the PC-to-line table. Decode rules
   * are documented in the lepusNG bytecode debug-info spec.
   */
  pc2line_buf: number[];
  /**
   * Decoded line/column pairs, one per source position emitted by the
   * compiler. `line_col.length` matches the number of mappings encoded
   * in `pc2line_buf`.
   */
  line_col: Array<{ line: number; column: number }>;
  /**
   * Optional PC offset → caller source snippet. Keys are stringified
   * PC offsets; values are the original function bodies the bytecode
   * was inlined from. Useful for de-inlining stack traces.
   */
  pc2caller_info: Record<string, string>;
}

/**
 * One artifact produced by the build that carries at least one debug
 * data source.
 *
 * Identity is `(filename, tasmSection)`:
 *   - `filename` is the asset basename (e.g. `main-thread.js`,
 *     `background.fd311de1.js`, `main.css`).
 *   - `tasmSection` is the artifact's location inside `tasm.json` and
 *     disambiguates artifacts that share a filename pattern but live in
 *     different sections.
 *
 * `tasmSection` is a path array of nested-object segments because raw
 * keys (especially under `customSections`) may themselves contain dots
 * and cannot be safely collapsed into a dotted string. Examples:
 *
 *   - `['lepusCode', 'root']`        main-thread.js
 *   - `['lepusCode', 'chunks', '0']` async main-thread chunk
 *   - `['manifest', '/<asset-name>']` background JS bundle
 *   - `['customSections', 'data.v2']` custom section whose key has a dot
 *   - `['css']`                      a CSS artifact
 *
 * @public
 */
export interface Artifact {
  /**
   * Which encoder bucket this asset belongs to in `tasm.json`:
   *
   * - `main-thread` — JS that runs on the lepusNG main thread (compiled
   *   into the `lepusCode` section).
   * - `background` — JS that runs on the background JS engine (lives in
   *   the `manifest` section).
   * - `css` — extracted CSS chunk (lives in the `css` section).
   */
  kind: 'main-thread' | 'background' | 'css';
  filename: string;
  /**
   * Bundler-relative path of the emitted asset itself (e.g.
   * `.rspeedy/main/main-thread.js`). Distinct from
   * {@link SourceMapDebugSource.path}, which points at the
   * sibling `.map` file.
   */
  path: string;
  tasmSection?: string[];
  /**
   * Debug sources for this artifact, ordered to match the
   * reverse-symbolication decode chain. A consumer that starts with a
   * runtime location and wants to recover the original source iterates
   * this list left-to-right:
   *
   * 1. `bytecode-debug-info` (if present) maps the bytecode PC offset
   *    back to the encoded JS source's `(line, column)`.
   * 2. `source-map` then maps that `(line, column)` back to the
   *    original authored file.
   */
  debugSources: DebugSource[];
}

/**
 * Compact UI source map payload — the `uiSourceMap` field of
 * {@link DebugMetadataAsset}.
 *
 * @public
 */
export interface UiSourceMapData {
  version: 1;
  sources: string[];
  mappings: [number, number, number][];
  uiMaps: number[];
}

/**
 * Git metadata captured at build time.
 *
 * @public
 */
export interface GitMetadata {
  commit: string;
  /**
   * Absolute path of the git worktree root
   * (`git rev-parse --show-toplevel`). Consumers use this to resolve
   * source-relative paths inside source maps back to filesystem
   * locations during reverse symbolication.
   */
  rootDir: string | null;
  remoteUrl: string | null;
  commitUrl: string | null;
}

/**
 * Rspeedy-emitted build context for a single template / entry.
 *
 * @public
 */
export interface RspeedyMeta {
  /**
   * Source files of the webpack entry/entries this debug-metadata
   * corresponds to, expressed as paths relative to the git rootDir
   * (falls back to the compiler context when not in a git repo).
   *
   * Typically a single file, but webpack allows array-form entries and
   * Lynx splits each user entry into multiple webpack entries
   * internally — both cases produce multiple paths here.
   */
  entryFiles: string[];
  /**
   * The template filename pattern this metadata corresponds to (e.g.
   * `main/template.js`). Lets multi-entry projects identify which page
   * each metadata file belongs to without relying on storage-key
   * conventions.
   */
  bundlePath: string;
}

/**
 * Full `debug-metadata.json` payload emitted per Lynx template entry.
 *
 * Asymmetry note: `artifacts[]` is **per-artifact** (one entry per JS /
 * CSS / bytecode bundle) while `uiSourceMap` is **per-entry** (there is
 * exactly one UI sourcemap for the entry's runtime UI tree). Forcing
 * `uiSourceMap` into `artifacts[]` would require inventing a synthetic
 * artifact, conflating runtime concepts with build products.
 *
 * Different consumers read different fields:
 *   - JS error reverse-symbolication walks `artifacts[]` for
 *     `kind: 'source-map'` debug sources.
 *   - Main-thread bytecode reverse-symbolication walks `artifacts[]`
 *     for `kind: 'bytecode-debug-info'` + the matching `source-map`.
 *   - UI element inspectors read `uiSourceMap` directly.
 *
 * @public
 */
export interface DebugMetadataAsset {
  /**
   * One entry per build artifact that ships debug data. Empty when the
   * emitter has not yet been wired to populate it; consumers should
   * treat an empty array as "no source-level debug data available"
   * rather than an error.
   */
  artifacts: Artifact[];
  /** Compact UI source map for the entry's runtime UI tree. */
  uiSourceMap: UiSourceMapData;
  /**
   * Build-time / context info. Closed-shape today — extend by adding
   * named fields to this interface (and bumping the schema) rather than
   * by stuffing arbitrary keys at runtime.
   */
  meta: {
    git?: GitMetadata;
    rspeedy?: RspeedyMeta;
  };
}
