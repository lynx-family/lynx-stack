// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';
import path from 'node:path';

import type { RspackOptions, Stats, StatsCompilation } from '@rspack/core';
import {
  BasicCaseCreator,
  describeByWalk,
  escapeSep,
  normalizePlaceholder,
} from '@rspack/test-tools';
import type { ITestContext, ITestEnv } from '@rspack/test-tools';
import fs from 'fs-extra';
import { rimrafSync } from 'rimraf';

import {
  createBaseHotProcessor,
  createHotRunner,
  loadCaseTestConfig,
} from './hot.js';
import type { ITestSuite } from './suite.js';

const TARGET = 'node' as const;
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Step-snapshot matching vendored from `@rspack/test-tools@2.0.6`
// `dist/case/hot-step.js` (`matchStepSnapshot` + the run/check overrides that
// register `hotUpdateStepChecker`). The hot lifecycle + runner are shared from
// `./hot.js`; this module only adds the snapshotting on top via the processor
// hooks (`onStep` / `onInitial`).
// ---------------------------------------------------------------------------

interface IStepState {
  entries: Record<string, string | string[]>;
  hashes: string[];
}

/**
 * Shape of `runtime.javascript` in the rspack HMR step stats (untyped `any` in
 * upstream's vendored `matchStepSnapshot`). Typed here so the snapshot glue can
 * sort/render its arrays without `no-unsafe-*`.
 */
interface IHmrJavascriptRuntime {
  outdatedModules: string[];
  updatedModules: string[];
  updatedRuntime: string[];
  acceptedModules: string[];
  disposedModules: string[];
  outdatedDependencies: Record<string, string[]>;
}

function collectRuntimeEntries(
  state: IStepState,
  stats: Stats,
  skipExisting: boolean,
): void {
  const chunks = Array.from(stats.compilation.chunks);
  for (const entry of chunks.filter((i) => i.hasRuntime())) {
    if (skipExisting && state.entries[entry.id!]) continue;
    if (entry.runtime) {
      state.entries[entry.id!] = typeof entry.runtime === 'string'
        ? [entry.runtime]
        : Array.from(entry.runtime);
    }
  }
}

/** Vendored verbatim from `hot-step.js` `matchStepSnapshot`. */
function matchStepSnapshot(
  state: IStepState,
  name: string,
  temp: string,
  updatePlugin: { getModifiedFiles: () => string[] },
  snapshotContent: ((content: string) => string) | undefined,
  prettyPrint: boolean,
  env: ITestEnv,
  context: ITestContext,
  step: number,
  // No longer used since the snapshot path/title are fixed to `rspack`, but kept
  // positionally to match the vendored `matchStepSnapshot` call sites.
  _options: RspackOptions,
  stats: StatsCompilation,
  runtime?: Record<string, unknown>,
): void {
  const { entries, hashes } = state;
  const lastHash = hashes[hashes.length - 1];
  // Write to the existing `__snapshot__/rspack/` location (and title) the legacy
  // 1.5.6 harness used, so the migration is a small modify-diff over the
  // committed snapshots instead of a new `__snapshots__/<target>/` tree that
  // orphans the old files.
  const snapshotPath = context.getSource(
    `__snapshot__/rspack/${step}.snap.txt`,
  );
  const title = `Case ${path.basename(name)} - rspack: Step ${step}`;
  const hotUpdateFile: Array<
    { name: string; content: string; modules: string[]; runtime: string[] }
  > = [];
  const hotUpdateManifest: Array<{ name: string; content: string }> = [];
  const changedFiles = step === 0 ? [] : updatePlugin.getModifiedFiles().map((
    i,
  ) => escapeSep(path.relative(temp, i)));
  changedFiles.sort();

  const resultHashes: Record<string, string> = {
    // Keep `||` (vendored verbatim from `hot-step.js`): a missing/empty last
    // hash must map to the `LAST_HASH` placeholder key.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    [lastHash || 'LAST_HASH']: 'LAST_HASH',
    [stats.hash!]: 'CURRENT_HASH',
  };
  const runtimes: Record<string, string> = {};
  for (const [id, runtimeValue] of Object.entries(entries)) {
    if (typeof runtimeValue === 'string') {
      if (runtimeValue !== id) runtimes[runtimeValue] = `[runtime of ${id}]`;
    } else if (Array.isArray(runtimeValue)) {
      for (const r of runtimeValue) {
        if (r !== id) runtimes[r] = `[runtime of ${id}]`;
      }
    }
  }

  const replaceContent = (rawStr: string) => {
    let str = rawStr;
    if (snapshotContent) str = snapshotContent(str);
    return normalizePlaceholder(
      Object.entries(resultHashes).reduce(
        (s, [raw, replacement]) => s.split(raw).join(replacement),
        str,
      )
        .replace(/\/\/ \d+\s+(?=var cssReload)/, '')
        .replaceAll(
          /var data = ".*"/g,
          (match) => decodeURIComponent(match).replaceAll(/\\/g, '/'),
        ),
    );
  };
  const replaceFileName = (str: string) =>
    Object.entries({ ...resultHashes, ...runtimes }).reduce(
      (s, [raw, replacement]) => s.split(raw).join(replacement),
      str,
    );

  const assets = (stats.assets ?? []).slice().sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const fileList = assets.map((i) => {
    const fileName = i.name;
    const renderName = replaceFileName(fileName);
    const content = replaceContent(
      fs.readFileSync(context.getDist(fileName), 'utf-8'),
    );
    if (fileName.endsWith('hot-update.js')) {
      // The emitted `*.hot-update.js` is a CJS module exposing a `modules` map;
      // load it via `require` (it must be the runtime-evaluated file, not an
      // ESM import) and read its keys.
      const hotUpdate = require(context.getDist(fileName)) as {
        modules: Record<string, unknown>;
      };
      const modules = Object.keys(hotUpdate.modules);
      const runtimeMods: string[] = [];
      for (
        const m of content.matchAll(/\/\/ (webpack\/runtime\/[\w-]+)\s*\n/g)
      ) {
        runtimeMods.push(m[1]!);
      }
      modules.sort();
      runtimeMods.sort();
      hotUpdateFile.push({
        name: renderName,
        content,
        modules,
        runtime: runtimeMods,
      });
      return `- Update: ${renderName}, size: ${content.length}`;
    }
    if (fileName.endsWith('hot-update.json')) {
      const manifest = JSON.parse(content) as {
        c?: string[];
        r?: string[];
        m?: string[];
      };
      manifest.c?.sort();
      manifest.r?.sort();
      manifest.m?.sort();
      hotUpdateManifest.push({
        name: renderName,
        content: JSON.stringify(manifest),
      });
      return `- Manifest: ${renderName}, size: ${i.size}`;
    }
    if (fileName.endsWith('.js')) return `- Bundle: ${renderName}`;
    return undefined;
  }).filter(Boolean) as string[];
  fileList.sort();
  hotUpdateManifest.sort((a, b) => (a.name > b.name ? 1 : -1));
  hotUpdateFile.sort((a, b) => (a.name > b.name ? 1 : -1));

  if (runtime?.['javascript']) {
    const js = runtime['javascript'] as IHmrJavascriptRuntime;
    js.outdatedModules.sort();
    js.updatedModules.sort();
    js.updatedRuntime.sort();
    js.acceptedModules.sort();
    js.disposedModules.sort();
    for (const value of Object.values(js.outdatedDependencies)) {
      value.sort();
    }
  }

  const js = runtime?.['javascript'] as IHmrJavascriptRuntime | undefined;
  const content = `
# ${title}

## Changed Files
${changedFiles.map((i) => `- ${i}`).join('\n')}

## Asset Files
${fileList.join('\n')}

## Manifest
${
    hotUpdateManifest.map((i) => `
### ${i.name}

\`\`\`json
${i.content}
\`\`\`
`).join('\n\n')
  }

## Update

${
    hotUpdateFile.map((i) => `
### ${i.name}

#### Changed Modules
${i.modules.map((m) => `- ${m}`).join('\n')}

#### Changed Runtime Modules
${i.runtime.map((m) => `- ${m}`).join('\n')}

#### Changed Content
\`\`\`js
${i.content}
\`\`\`
`).join('\n\n')
  }


${
    runtime
      ? `
## Runtime
### Status

\`\`\`txt
${(runtime['statusPath'] as string[]).join(' => ')}
\`\`\`

${
        js
          ? `

### JavaScript

#### Outdated

Outdated Modules:
${js.outdatedModules.map((i) => `- ${i}`).join('\n')}


Outdated Dependencies:
\`\`\`json
${JSON.stringify(js.outdatedDependencies, null, 2)}
\`\`\`

#### Updated

Updated Modules:
${js.updatedModules.map((i) => `- ${i}`).join('\n')}

Updated Runtime:
${js.updatedRuntime.map((i) => `- \`${i}\``).join('\n')}


#### Callback

Accepted Callback:
${js.acceptedModules.map((i) => `- ${i}`).join('\n')}

Disposed Callback:
${js.disposedModules.map((i) => `- ${i}`).join('\n')}
`
          : ''
      }

`
      : ''
  }

				`.replaceAll(
    /%3A(\d+)%2F/g,
    (match, capture: string) => match.replace(capture, 'PORT'),
  ).trim();
  // The decoded manifest (via `snapshotContent`) is re-serialized compactly with
  // `JSON.stringify`; pretty-print the rendered `json` blocks so it diffs
  // line-by-line.
  const finalContent = prettyPrint ? prettyPrintJsonBlocks(content) : content;
  // `toMatchFileSnapshotSync` is registered by `@rspack/test-tools/setup-expect`.
  (env.expect as (value: unknown) => {
    toMatchFileSnapshotSync: (path: string) => void;
  })(finalContent).toMatchFileSnapshotSync(snapshotPath);
}

// ---------------------------------------------------------------------------
// Decode helpers: decode the base64 `content` of a `*.hot-update.json`
// manifest into pretty-printed JSON so the snapshot is human-readable.
// ---------------------------------------------------------------------------

/**
 * Decode the base64 `content` of a `*.hot-update.json` manifest into plain JSON.
 * Runs through the `snapshotContent` hook (before hash normalization), so it
 * sees the pristine base64. Non-manifest assets are passed through untouched.
 */
function decodeManifestContent(content: string): string {
  let manifest: { content?: unknown };
  try {
    manifest = JSON.parse(content) as { content?: unknown };
  } catch {
    return content;
  }
  if (manifest && typeof manifest.content === 'string') {
    try {
      manifest.content = JSON.parse(
        Buffer.from(manifest.content, 'base64').toString('utf-8'),
      ) as unknown;
    } catch {
      return content;
    }
    return JSON.stringify(manifest);
  }
  return content;
}

/** Re-indent every ```` ```json ```` block so the decoded manifest diffs line-by-line. */
function prettyPrintJsonBlocks(snapshot: string): string {
  return snapshot.replaceAll(
    /```json\n([\s\S]*?)\n```/g,
    (match, body: string) => {
      try {
        return `\`\`\`json\n${
          JSON.stringify(JSON.parse(body), null, 2)
        }\n\`\`\``;
      } catch {
        return match;
      }
    },
  );
}

export interface IHotSnapshotCasesOptions {
  /**
   * Decode the base64 `content` of `*.hot-update.json` manifests into plain,
   * pretty-printed JSON in the snapshot. Opt-in, so existing suites keep their
   * current (raw base64) snapshots.
   *
   * @defaultValue `false`
   */
  decodeHotUpdateManifest?: boolean;
}

/**
 * Build a hot-step processor: the shared hot lifecycle (`./hot.js`) plus the
 * `matchStepSnapshot` hooks. `snapshotContent`, when decoding manifests, decodes
 * the base64 `content` inline (before hash normalization) and pretty-prints the
 * rendered `json` blocks.
 */
function createHotSnapshotProcessor(
  name: string,
  src: string,
  temp: string,
  decodeHotUpdateManifest: boolean,
) {
  const state: IStepState = { entries: {}, hashes: [] };
  const snapshotContent = decodeHotUpdateManifest
    ? (content: string) => decodeManifestContent(content)
    : undefined;

  const processor = createBaseHotProcessor(name, src, temp, {
    onStep: (env, context, updateIndex, stats, runtime) => {
      collectRuntimeEntries(state, stats, true);
      matchStepSnapshot(
        state,
        name,
        temp,
        processor.updatePlugin,
        snapshotContent,
        decodeHotUpdateManifest,
        env,
        context,
        updateIndex,
        context.getCompiler().getOptions(),
        stats.toJson({ assets: true, chunks: true }),
        runtime,
      );
      state.hashes.push(stats.hash!);
    },
    onInitial: (env, context, stats) => {
      if (!stats || !stats.hash) return;
      collectRuntimeEntries(state, stats, false);
      let matchFailed: unknown = null;
      try {
        matchStepSnapshot(
          state,
          name,
          temp,
          processor.updatePlugin,
          snapshotContent,
          decodeHotUpdateManifest,
          env,
          context,
          0,
          context.getCompiler().getOptions(),
          stats.toJson({ assets: true, chunks: true }),
        );
      } catch (e) {
        matchFailed = e;
      }
      state.hashes.push(stats.hash);
      if (matchFailed) throw matchFailed;
    },
  });

  return processor;
}

const creators = new Map<string, BasicCaseCreator>();

function getCreator(decodeHotUpdateManifest: boolean): BasicCaseCreator {
  const key = String(decodeHotUpdateManifest);
  if (!creators.has(key)) {
    creators.set(
      key,
      new BasicCaseCreator({
        clean: true,
        describe: false,
        target: TARGET,
        steps: ({ name, src, dist, temp }) => [
          createHotSnapshotProcessor(
            name,
            src,
            temp ?? path.resolve(dist, 'temp'),
            decodeHotUpdateManifest,
          ),
        ],
        runner: {
          key: (_context, name) => name,
          runner: createHotRunner,
        },
        // The lynx fixtures drive HMR through debounced/`setTimeout`-deferred
        // callbacks. Running cases concurrently interleaves their leaked timers
        // (a case's CSS-reload timer firing in another case's `require` context),
        // so serialize to one case at a time.
        concurrent: 1,
      }),
    );
  }
  return creators.get(key)!;
}

export function hotSnapshotCases(
  suite: ITestSuite,
  options: IHotSnapshotCasesOptions = {},
): void {
  const decode = options.decodeHotUpdateManifest ?? false;
  const distPath = path.resolve(suite.casePath, '../js/hot-snapshot');
  rimrafSync(distPath);
  const creator = getCreator(decode);
  // The HotUpdatePlugin copies `src` into `temp`, rewrites `options.context` to
  // `temp`, and compiles there. The fixtures import a shared helper *outside*
  // the case dir (`import '../../../helper/stubLynx.js'`), so the temp must sit
  // at the same directory depth as the source (`<testDir>/hotCases/<case>`),
  // i.e. `<testDir>/.hot-snapshot-temp/<case>`, so `../../../helper` resolves to
  // `<testDir>/helper` exactly as it did from the source.
  const testDir = path.dirname(suite.casePath);
  describeByWalk(suite.name, (name, src, dist) => {
    const relativeCase = path.relative(suite.casePath, src);
    const temp = path.join(testDir, '.hot-snapshot-temp', relativeCase);
    creator.create(name, src, dist, temp, {
      testConfig: loadCaseTestConfig(src),
    });
  }, {
    source: suite.casePath,
    dist: distPath,
  });
}
