// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RsbuildPluginAPI } from '@rsbuild/core';

import { RuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin';
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
  WebEncodePlugin,
} from '@lynx-js/template-webpack-plugin';

import { LAYERS } from './layers.js';

const PLUGIN_TEMPLATE = 'lynx:vue-template';
const PLUGIN_RUNTIME_WRAPPER = 'lynx:vue-runtime-wrapper';
const PLUGIN_ENCODE = 'lynx:vue-encode';
const PLUGIN_MARK_MAIN_THREAD = 'lynx:vue-mark-main-thread';
const PLUGIN_WORKLET_RUNTIME = 'lynx:vue-worklet-runtime';
const PLUGIN_WEB_ENCODE = 'lynx:vue-web-encode';

/** Minimal typing for a webpack Chunk (avoids importing @rspack/core). */
interface WebpackChunk {
  getEntryOptions(): { layer?: string } | undefined;
}

/** Minimal typing for the webpack Compilation object (avoids importing @rspack/core). */
interface WebpackCompilation {
  hooks: {
    processAssets: {
      tap(
        options: { name: string; stage: number },
        callback: () => void,
      ): void;
    };
    additionalTreeRuntimeRequirements: {
      tap(
        name: string,
        callback: (chunk: WebpackChunk, set: Set<string>) => void,
      ): void;
    };
  };
  getAsset(
    filename: string,
  ): { source: unknown; info: Record<string, unknown> } | undefined;
  updateAsset(
    filename: string,
    source: unknown,
    info: Record<string, unknown>,
  ): void;
}

/** Minimal typing for the webpack Compiler object (avoids importing @rspack/core). */
interface WebpackCompiler {
  webpack: {
    Compilation: {
      PROCESS_ASSETS_STAGE_ADDITIONAL: number;
      PROCESS_ASSETS_STAGE_PRE_PROCESS: number;
    };
    RuntimeGlobals: { startup: string };
    sources: { RawSource: new(source: string) => unknown };
  };
  hooks: {
    thisCompilation: {
      tap(
        name: string,
        callback: (compilation: WebpackCompilation) => void,
      ): void;
    };
  };
}

/**
 * VueMarkMainThreadPlugin does two things:
 *
 * 1. Forces webpack to generate startup code for MT entry chunks.
 *    WHY: rspeedy sets `chunkLoading: 'lynx'` globally. The Lynx
 *    `StartupChunkDependenciesPlugin` only adds `RuntimeGlobals.startup` when
 *    `hasChunkEntryDependentChunks(chunk)` is true. For MT entries without
 *    async chunk dependencies this is false, so webpack never generates the
 *    `__webpack_require__(entryModuleId)` startup call. Module factories
 *    (including entry-main.ts which sets globalThis.renderPage etc.) never
 *    execute. We fix this by explicitly requesting `RuntimeGlobals.startup`
 *    for any chunk whose entry layer is MAIN_THREAD.
 *
 * 2. Marks webpack-generated main-thread assets with `lynx:main-thread: true`
 *    so that LynxTemplatePlugin routes them to lepusCode.root (Lepus bytecode).
 */
class VueMarkMainThreadPlugin {
  constructor(private readonly mainThreadFilenames: string[]) {}

  apply(compiler: WebpackCompiler): void {
    const { RuntimeGlobals } = compiler.webpack;

    compiler.hooks.thisCompilation.tap(
      PLUGIN_MARK_MAIN_THREAD,
      (compilation) => {
        // Force startup code generation for MT entry chunks so that
        // entry module factories actually execute.
        compilation.hooks.additionalTreeRuntimeRequirements.tap(
          PLUGIN_MARK_MAIN_THREAD,
          (chunk, set) => {
            const entryOptions = chunk.getEntryOptions();
            if (entryOptions?.layer === LAYERS.MAIN_THREAD) {
              set.add(RuntimeGlobals.startup);
            }
          },
        );

        // Mark MT assets with lynx:main-thread: true for LynxTemplatePlugin.
        compilation.hooks.processAssets.tap(
          {
            name: PLUGIN_MARK_MAIN_THREAD,
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
          },
          () => {
            for (const filename of this.mainThreadFilenames) {
              const asset = compilation.getAsset(filename);
              if (asset) {
                compilation.updateAsset(
                  filename,
                  asset.source,
                  {
                    ...asset.info,
                    'lynx:main-thread': true,
                  },
                );
              }
            }
          },
        );
      },
    );
  }
}

/**
 * VueWorkletRuntimePlugin injects the React worklet-runtime as a Lepus chunk
 * named 'worklet-runtime' so that __LoadLepusChunk('worklet-runtime', ...)
 * can load it at runtime. Native Lynx requires this chunk to be present for
 * worklet event dispatch (main-thread:bindtap etc.) to work.
 */
class VueWorkletRuntimePlugin {
  constructor(private readonly workletRuntimePath: string) {}

  apply(compiler: WebpackCompiler): void {
    compiler.hooks.thisCompilation.tap(
      PLUGIN_WORKLET_RUNTIME,
      (compilation) => {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          // @ts-expect-error Rspack x Webpack compilation type mismatch
          compilation,
        ) as {
          beforeEncode: {
            tap(
              name: string,
              fn: (args: Record<string, unknown>) => Record<string, unknown>,
            ): void;
          };
        };
        const { RawSource } = compiler.webpack.sources;
        hooks.beforeEncode.tap(PLUGIN_WORKLET_RUNTIME, (args) => {
          const encodeData = args['encodeData'] as {
            lepusCode: {
              root?: { source: { source(): string } };
              chunks: Array<{
                name: string;
                source: unknown;
                info: Record<string, unknown>;
              }>;
            };
          };
          const lepusCode = encodeData.lepusCode;
          // Always include worklet-runtime when we have main-thread code.
          // (Phase 2 could gate this on registerWorkletInternal presence.)
          if (lepusCode.root) {
            lepusCode.chunks.push({
              name: 'worklet-runtime',
              source: new RawSource(
                fs.readFileSync(this.workletRuntimePath, 'utf8'),
              ),
              info: { 'lynx:main-thread': true },
            });
          }
          return args;
        });
      },
    );
  }
}

const DEFAULT_INTERMEDIATE = '.rspeedy';

const _dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export interface ApplyEntryOptions {
  enableCSSSelector?: boolean;
  debugInfoOutside?: boolean;
}

export function applyEntry(
  api: RsbuildPluginAPI,
  opts: ApplyEntryOptions = {},
): void {
  // Default to all-in-one chunk splitting to avoid async chunks that break
  // Lynx's single-file bundle requirement (same as React plugin behaviour).
  api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
    const userConfig = api.getRsbuildConfig('original');
    if (!userConfig.performance?.chunkSplit?.strategy) {
      return mergeRsbuildConfig(config, {
        performance: { chunkSplit: { strategy: 'all-in-one' } },
      });
    }
    return config;
  });

  // Worklet loader (BG layer): runs SWC JS-target transform on BG-layer
  // .js/.ts/.vue files to replace 'main thread' functions with context objects.
  api.modifyBundlerChain((chain, { environment }) => {
    const isLynx = environment.name === 'lynx'
      || environment.name.startsWith('lynx-');
    const isWeb = environment.name === 'web'
      || environment.name.startsWith('web-');
    if (!isLynx && !isWeb) return;

    chain.module
      .rule('vue:worklet')
      .issuerLayer(LAYERS.BACKGROUND)
      .test(/\.(?:[cm]?[jt]sx?|vue)$/)
      .exclude.add(/node_modules/).end()
      .use('worklet-loader')
      .loader(path.resolve(_dirname, './loaders/worklet-loader'))
      .end();
  });

  // MT-layer loaders: process user code to extract LEPUS worklet registrations.
  // Vue SFC files → extract <script> content → LEPUS transform.
  // JS/TS files → LEPUS transform directly.
  //
  // IMPORTANT: The bootstrap packages (@lynx-js/vue-main-thread and its deps)
  // must be excluded — they set up globalThis.renderPage/processData/etc. and
  // must execute as-is. In pnpm workspaces, these resolve to real paths under
  // packages/vue/ (not node_modules), so we exclude them explicitly.
  api.modifyBundlerChain((chain, { environment }) => {
    const isLynx = environment.name === 'lynx'
      || environment.name.startsWith('lynx-');
    const isWeb = environment.name === 'web'
      || environment.name.startsWith('web-');
    if (!isLynx && !isWeb) return;

    // Resolve bootstrap package directories to exclude from MT loaders.
    // entry-main.ts imports from @lynx-js/vue-main-thread (same package)
    // and @lynx-js/vue-internal (ops enum). Both must pass through as-is.
    const mainThreadPkgDir = path.dirname(
      require.resolve('@lynx-js/vue-main-thread/package.json'),
    );
    // @lynx-js/vue-internal is a transitive dep (ops-apply.ts imports OP enum)
    let vueInternalPkgDir: string | undefined;
    try {
      vueInternalPkgDir = path.dirname(
        require.resolve('@lynx-js/vue-internal/package.json'),
      );
    } catch {
      // Optional — may not exist in all setups
    }

    // Vue SFC on MT: vue-loader processes .vue on all layers (no issuerLayer
    // constraint). This enforce:'post' rule runs worklet-loader-mt AFTER
    // vue-loader, so it sees vue-loader's connector output (imports to
    // template/script/style sub-modules). extractLocalImports filters out
    // template/style imports, keeping only the script sub-module.
    // The script sub-module then matches the vue:worklet-mt rule below
    // (via .ts match resource extension), ensuring both BG and MT worklet
    // transforms see the same @vue/compiler-sfc compiled script content,
    // producing matching _wkltId hashes.
    chain.module
      .rule('vue:mt-sfc')
      .enforce('post')
      .issuerLayer(LAYERS.MAIN_THREAD)
      .test(/\.vue$/)
      .use('worklet-loader-mt')
      .loader(path.resolve(_dirname, './loaders/worklet-loader-mt'))
      .end();

    // JS/TS on MT: LEPUS worklet transform (extract registerWorkletInternal calls)
    const workletMtExclude = chain.module
      .rule('vue:worklet-mt')
      .issuerLayer(LAYERS.MAIN_THREAD)
      .test(/\.[cm]?[jt]sx?$/)
      .exclude
      .add(/node_modules/)
      .add(mainThreadPkgDir);
    if (vueInternalPkgDir) {
      workletMtExclude.add(vueInternalPkgDir);
    }
    workletMtExclude.end()
      .use('worklet-loader-mt')
      .loader(path.resolve(_dirname, './loaders/worklet-loader-mt'))
      .end();
  });

  api.modifyBundlerChain((chain, { environment, isProd }) => {
    const isRspeedy = api.context.callerName === 'rspeedy';
    if (!isRspeedy) return;

    const isLynx = environment.name === 'lynx'
      || environment.name.startsWith('lynx-');
    const isWeb = environment.name === 'web'
      || environment.name.startsWith('web-');

    const entries = chain.entryPoints.entries() ?? {};

    chain.entryPoints.clear();

    // Collect all main-thread filenames to mark with lynx:main-thread
    const mainThreadFilenames: string[] = [];

    for (const [entryName, entryPoint] of Object.entries(entries)) {
      // Collect user imports from the original entry
      const imports: string[] = [];
      for (const val of entryPoint.values()) {
        if (typeof val === 'string') {
          imports.push(val);
        } else if (typeof val === 'object' && val !== null && 'import' in val) {
          const imp = (val as { import?: string | string[] }).import;
          if (Array.isArray(imp)) imports.push(...imp);
          else if (imp) imports.push(imp);
        }
      }

      // ----------------------------------------------------------------
      // Filenames
      // ----------------------------------------------------------------
      const intermediate = isLynx ? DEFAULT_INTERMEDIATE : '';
      const mainThreadEntry = `${entryName}__main-thread`;
      const mainThreadName = path.posix.join(
        intermediate,
        `${entryName}/main-thread.js`,
      );
      const backgroundName = path.posix.join(
        intermediate,
        `${entryName}/background${isProd ? '.[contenthash:8]' : ''}.js`,
      );

      if (isLynx || isWeb) {
        mainThreadFilenames.push(mainThreadName);
      }

      // ----------------------------------------------------------------
      // Main Thread bundle – PAPI bootstrap + user code (worklet registrations)
      // ----------------------------------------------------------------
      // Both BG and MT layers import the same user code. On the MT layer,
      // vue-sfc-script-extractor + worklet-loader-mt strip everything except
      // registerWorkletInternal() calls. webpack's dependency graph provides
      // natural per-entry isolation (each entry sees only its own worklets).
      chain
        .entry(mainThreadEntry)
        .add({
          layer: LAYERS.MAIN_THREAD,
          import: [require.resolve('@lynx-js/vue-main-thread'), ...imports],
          filename: mainThreadName,
        })
        .end();

      // ----------------------------------------------------------------
      // Background bundle – Vue runtime + user app
      // ----------------------------------------------------------------
      chain
        .entry(entryName)
        .add({
          layer: LAYERS.BACKGROUND,
          import: imports,
          filename: backgroundName,
        })
        .prepend({
          layer: LAYERS.BACKGROUND,
          import: require.resolve('@lynx-js/vue-runtime/entry-background'),
        })
        .end();

      // ----------------------------------------------------------------
      // LynxTemplatePlugin – packages both bundles into .lynx.bundle
      // ----------------------------------------------------------------
      if (isLynx || isWeb) {
        const templateFilename = (
          typeof environment.config.output.filename === 'object'
            ? (environment.config.output.filename as { bundle?: string })
              .bundle
            : environment.config.output.filename
        ) ?? '[name].[platform].bundle';

        chain
          .plugin(`${PLUGIN_TEMPLATE}-${entryName}`)
          .use(LynxTemplatePlugin, [
            {
              // Spread defaults first to satisfy all required fields
              ...LynxTemplatePlugin.defaultOptions,
              dsl: 'react_nodiff',
              chunks: [mainThreadEntry, entryName],
              filename: templateFilename
                .replaceAll('[name]', entryName)
                .replaceAll('[platform]', environment.name),
              intermediate: path.posix.join(intermediate, entryName),
              debugInfoOutside: opts.debugInfoOutside ?? true,
              enableCSSSelector: opts.enableCSSSelector ?? true,
              enableCSSInvalidation: opts.enableCSSSelector ?? true,
              enableRemoveCSSScope: true,
              enableNewGesture: false,
              removeDescendantSelectorScope: true,
              cssPlugins: [],
            },
          ])
          .end();
      }
    }

    // ------------------------------------------------------------------
    // VueMarkMainThreadPlugin – mark MT assets with lynx:main-thread: true
    // so LynxTemplatePlugin routes them to lepusCode.root (Lepus bytecode).
    // ------------------------------------------------------------------
    if ((isLynx || isWeb) && mainThreadFilenames.length > 0) {
      chain
        .plugin(PLUGIN_MARK_MAIN_THREAD)
        .use(VueMarkMainThreadPlugin, [mainThreadFilenames])
        .end();

      // Resolve worklet-runtime from @lynx-js/react (reuse existing impl)
      const workletRuntimePath = require.resolve(
        '@lynx-js/react/worklet-runtime',
      );
      chain
        .plugin(PLUGIN_WORKLET_RUNTIME)
        .use(VueWorkletRuntimePlugin, [workletRuntimePath])
        .end();
    }

    // ------------------------------------------------------------------
    // RuntimeWrapperWebpackPlugin – wrap background.js, not main-thread.js
    // ------------------------------------------------------------------
    if (isLynx) {
      chain
        .plugin(PLUGIN_RUNTIME_WRAPPER)
        .use(RuntimeWrapperWebpackPlugin, [
          {
            // Exclude main-thread.js (and main-thread.[hash].js) from wrapping
            test: /^(?!.*main-thread(?:\.[A-Fa-f0-9]*)?\.js$).*\.js$/,
          },
        ])
        .end()
        .plugin(PLUGIN_ENCODE)
        .use(LynxEncodePlugin, [{}])
        .end();
    }

    if (isWeb) {
      chain
        .plugin(PLUGIN_WEB_ENCODE)
        .use(WebEncodePlugin, [])
        .end();
    }

    // Disable IIFE wrapping – Lynx handles module scoping itself
    chain.output.set('iife', false);
  });
}
