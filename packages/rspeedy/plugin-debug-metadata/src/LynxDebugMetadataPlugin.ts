// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'

import type { RsbuildEntry, Rspack } from '@rsbuild/core'

import type {
  DebugMetadataAsset,
  GitMetadata,
  RspeedyMeta,
} from '@lynx-js/debug-metadata'
import type {
  LynxTemplatePlugin as LynxTemplatePluginClass,
  TemplateHooks,
} from '@lynx-js/template-webpack-plugin'

import { collectArtifacts } from './collectors/artifacts.js'
import { parseLepusNGDebugInfo } from './collectors/bytecode-debug-info.js'
import {
  collectEntryPathMap,
  collectLazyBundleEntryResources,
  dedupe,
} from './collectors/entries.js'
import { collectGitMetadata } from './collectors/git.js'
import {
  collectUiSourceMapRecords,
  createUiSourceMap,
} from './collectors/ui-source-map.js'
import { DEBUG_METADATA_ASSET_NAME } from './constants.js'
import {
  computeChunkReleaseKey,
  getReleaseDefine,
  getReleaseRuntime,
} from './release-banner.js'
import {
  rewriteSourceMappingURL,
  rewriteSourceMappingURLToAbsolute,
} from './source-mapping-url-rewriter.js'

/**
 * The options of the {@link LynxDebugMetadataPlugin}.
 *
 * @public
 */
export interface LynxDebugMetadataPluginOptions {
  /**
   * The LynxTemplatePlugin class.
   */
  LynxTemplatePlugin: typeof LynxTemplatePluginClass
  /**
   * The rsbuild environment's `entry`. Used to populate
   * `meta.rspeedy.entryFiles`. When omitted (e.g. when the webpack
   * plugin is applied outside of an rsbuild pipeline),
   * `meta.rspeedy.entryFiles` is empty.
   */
  rsbuildEntry?: RsbuildEntry
  getDevServerOrigin?: () => string | undefined
}

/**
 * The LynxDebugMetadataPlugin is a webpack plugin that adds debug metadata to the output.
 *
 * The emitted asset is always named `debug-metadata.json` —
 * the name is hard-coded throughout the pipeline (the JS
 * `sourceMappingURL` rewriter, the tasm `templateDebugUrl`, and the
 * dev-server middleware all literal-match this name), so allowing a
 * custom name here would silently break the downstream URLs.
 *
 * @public
 */
export class LynxDebugMetadataPlugin {
  constructor(protected options?: LynxDebugMetadataPluginOptions | undefined) {}
  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Rspack.Compiler): void {
    if (!this.options) {
      throw new Error('LynxDebugMetadataPlugin requires options')
    }
    new LynxDebugMetadataPluginImpl(compiler, this.options)
  }
}

export class LynxDebugMetadataPluginImpl {
  name = 'LynxDebugMetadataPlugin'
  constructor(
    protected compiler: Rspack.Compiler,
    protected options: LynxDebugMetadataPluginOptions,
  ) {
    this.options = options

    const { ConcatSource, RawSource } = compiler.webpack.sources

    let gitCache: GitMetadata | null | undefined
    const getGit = (): GitMetadata | null => {
      if (gitCache === undefined) {
        gitCache = collectGitMetadata(compiler.context)
      }
      return gitCache
    }

    let entryPathMapCache: Record<string, string[]> | undefined
    const getEntryPathMap = (): Record<string, string[]> => {
      entryPathMapCache ??= this.options.rsbuildEntry
        ? collectEntryPathMap(
          this.options.rsbuildEntry,
          compiler.context,
          getGit()?.rootDir ?? null,
        )
        : {}
      return entryPathMapCache
    }

    compiler.hooks.thisCompilation.tap(this.name, compilation => {
      // Prepend the per-chunk release banner (reads `chunkGraph` for the key,
      // so not `BannerPlugin`). `raw` banners prepend, so the earliest stage is
      // innermost and runs last, and the engine keeps the last
      // `_SetSourceMapRelease`. Stage `ADDITIONS + 1` is just after the legacy
      // source-map release banner, so the legacy release runs last and wins
      // during the debug-metadata transition. The wrapper runs later (`NONE`)
      // so this stays inside it.
      compilation.hooks.processAssets.tap(
        {
          name: this.name,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS
            + 1,
        },
        () => {
          for (const chunk of compilation.chunks) {
            const release = computeChunkReleaseKey(
              compilation.chunkGraph,
              chunk,
            )
            for (const file of chunk.files) {
              if (!file.endsWith('.js')) continue
              const name = path.posix.basename(file, '.js')
              const banner = getReleaseDefine(release)
                + getReleaseRuntime(name)
              compilation.updateAsset(
                file,
                old => new ConcatSource(banner, old),
              )
            }
          }
        },
      )

      const templateHooks = this.options.LynxTemplatePlugin
        .getLynxTemplatePluginHooks(
          compilation as unknown as Parameters<
            typeof this.options.LynxTemplatePlugin.getLynxTemplatePluginHooks
          >[0],
        )

      // Carry per-template `intermediate` from `beforeEncode` to
      // `beforeEmit`, whose args don't include it. Keyed by the
      // `sourceContent` object: `beforeEmit`'s `finalEncodeOptions` is a
      // shallow spread of `beforeEncode`'s `encodeData`, so the nested
      // object identity is shared and unique per template — unlike
      // `entryNames`, which is empty for every async lazy bundle template.
      const intermediateBySourceContent = new WeakMap<object, string>()

      templateHooks.beforeEncode.tap(
        this.constructor.name,
        (args) => {
          const chunkGroups = args.chunkGroups
          const uiSourceMapRecords = collectUiSourceMapRecords(
            compilation,
            chunkGroups,
          )
          const git = getGit()
          const entryPathMap = getEntryPathMap()
          const baseDir = git?.rootDir ?? compiler.context
          // Named entries appear in the map. Lazy bundles do not, so walk the
          // importer's blocks via `chunkGroup.origins` +
          // `moduleGraph.getResolvedModule` to recover the dynamic-import
          // target's resource path.
          const fromMap = chunkGroups.flatMap(cg =>
            cg.name === null || cg.name === undefined
              ? []
              : entryPathMap[cg.name] ?? []
          )
          const entryFiles = fromMap.length > 0
            ? dedupe(fromMap)
            : dedupe(
              chunkGroups.flatMap(cg =>
                collectLazyBundleEntryResources(compilation, cg).map(abs =>
                  path.relative(baseDir, abs).split(path.sep).join('/')
                )
              ),
            )
          const rspeedy: RspeedyMeta = {
            entryFiles,
            bundlePath: args.filenameTemplate,
          }
          const asset: DebugMetadataAsset = {
            artifacts: collectArtifacts(compilation, chunkGroups),
            uiSourceMap: createUiSourceMap(uiSourceMapRecords),
            buildInfo: {
              ...(git ? { git } : {}),
              rspeedy,
            },
          }
          const intermediate = args.intermediate.replace(/\\/g, '/')
          const debugMetadataAssetName = path.posix.format({
            dir: intermediate,
            base: DEBUG_METADATA_ASSET_NAME,
          })
          intermediateBySourceContent.set(
            args.encodeData.sourceContent,
            intermediate,
          )
          compilation.emitAsset(
            debugMetadataAssetName,
            new RawSource(JSON.stringify(asset, null, 2)),
          )
          // Pushing to `args.intermediateAssets` opts the file into
          // `LynxEncodePlugin`'s production-only cleanup
          // (`PROCESS_ASSETS_STAGE_REPORT + 1`) — intentional: prod
          // bundles should not ship debug metadata to end users.
          // The file can be uploaded by a separate plugin to
          // error monitoring services by users.
          args.intermediateAssets.push(debugMetadataAssetName)

          const devServerOrigin = this.options.getDevServerOrigin?.()
          if (devServerOrigin) {
            const debugMetadataUrl =
              `${devServerOrigin}/${debugMetadataAssetName}`
            const rootName = args.encodeData.lepusCode.root?.name
            const mainThreadBasename = rootName
              ? path.posix.basename(rootName.replace(/\\/g, '/'))
              : 'main-thread.js'
            args.encodeData.sourceContent.config['debugMetadataUrl'] =
              debugMetadataUrl
            args.encodeData.compilerOptions['templateDebugUrl'] =
              `${debugMetadataUrl}?field=bytecode-debug-info&filename=${
                encodeURIComponent(mainThreadBasename)
              }`
          }

          rewriteSourceMappingURLs(compilation, args)

          return args
        },
      )

      templateHooks.beforeEmit.tap(
        this.constructor.name,
        (args) => {
          const intermediate = intermediateBySourceContent.get(
            args.finalEncodeOptions['sourceContent'] as object,
          )
          if (intermediate === undefined) return args
          const debugMetadataAssetName = path.posix.format({
            dir: intermediate,
            base: DEBUG_METADATA_ASSET_NAME,
          })

          const existing = compilation.getAsset(debugMetadataAssetName)
          if (!existing) return args

          let metadata: DebugMetadataAsset
          try {
            metadata = JSON.parse(
              existing.source.source().toString(),
            ) as DebugMetadataAsset
          } catch {
            return args
          }

          for (const artifact of metadata.artifacts) {
            const section = readTasmSection(compilation, artifact.path)
            if (section) artifact.tasmSection = section
          }

          const lepusNG = parseLepusNGDebugInfo(args.debugInfo)
          if (lepusNG) {
            const target = metadata.artifacts.find(a =>
              a.kind === 'main-thread'
              && a.tasmSection?.[0] === 'lepusCode'
              && a.tasmSection?.[1] === 'root'
            ) ?? metadata.artifacts.find(a => a.kind === 'main-thread')
            if (target) {
              target.debugSources.unshift({
                kind: 'bytecode-debug-info',
                debugInfo: lepusNG,
              })
            }
          }

          compilation.updateAsset(
            debugMetadataAssetName,
            new RawSource(JSON.stringify(metadata, null, 2)),
          )

          return args
        },
      )
    })
  }
}

/**
 * Read the `'lynx:tasm-section'` info `LynxEncodePlugin` stamps on every
 * routed asset. Returns `undefined` when the encoder did not (yet) mark
 * this asset — leaving `Artifact.tasmSection` unset is preferable to
 * guessing the wrong path.
 */
function readTasmSection(
  compilation: Rspack.Compilation,
  assetName: string,
): string[] | undefined {
  const value: unknown = compilation.getAsset(assetName)?.info
    ?.['lynx:tasm-section']
  return Array.isArray(value)
    ? value.filter((s): s is string => typeof s === 'string')
    : undefined
}

/**
 * Options for {@link rewriteSourceMappingURLs}.
 *
 * @public
 */
export interface RewriteSourceMappingURLsOptions {
  /**
   * Override the URL written into each rewritten sourceMappingURL. Defaults
   * to `${debugMetadataUrl}?field=source-map&path=<encoded mapPath>`.
   */
  getSourceMappingURL?: (
    info: { mapPath: string, debugMetadataUrl: string },
  ) => string
}

/**
 * Rewrite the `//# sourceMappingURL=...` directive of every JS asset in the
 * current template to an absolute URL. No-op when `debugMetadataUrl`
 * (`args.encodeData.sourceContent.config['debugMetadataUrl']`) is unset.
 *
 * @public
 */
export function rewriteSourceMappingURLs(
  compilation: Rspack.Compilation,
  args: Parameters<Parameters<TemplateHooks['beforeEncode']['tap']>[1]>[0],
  options?: RewriteSourceMappingURLsOptions,
): void {
  const debugMetadataUrl = args.encodeData.sourceContent.config[
    'debugMetadataUrl'
  ]
  if (typeof debugMetadataUrl !== 'string' || debugMetadataUrl === '') return
  const { RawSource } = compilation.compiler.webpack.sources
  const assetNames: string[] = []
  if (args.encodeData.lepusCode.root) {
    assetNames.push(args.encodeData.lepusCode.root.name)
  }
  for (const chunk of args.encodeData.lepusCode.chunks) {
    assetNames.push(chunk.name)
  }
  for (const name of Object.keys(args.encodeData.manifest)) {
    if (name.endsWith('.js')) assetNames.push(name)
  }
  for (const chunk of args.encodeData.css.chunks) {
    assetNames.push(chunk.name)
  }
  const seen = new Set<string>()
  for (const assetName of assetNames) {
    if (seen.has(assetName)) continue
    seen.add(assetName)
    const asset = compilation.getAsset(assetName)
    if (!asset) continue
    const before = asset.source.source().toString()
    const mapPath = `${assetName}.map`
    const customUrl = options?.getSourceMappingURL?.({
      mapPath,
      debugMetadataUrl,
    })
    const after = customUrl === undefined
      ? rewriteSourceMappingURLToAbsolute(before, debugMetadataUrl, mapPath)
      : rewriteSourceMappingURL(before, customUrl)
    if (after === undefined) continue
    const newSource = new RawSource(after)
    compilation.updateAsset(assetName, newSource, asset.info)
    if (!assetName.endsWith('.js')) continue
    if (assetName in args.encodeData.manifest) {
      args.encodeData.manifest[assetName] = after
    }
    if (args.encodeData.lepusCode.root?.name === assetName) {
      args.encodeData.lepusCode.root = {
        ...args.encodeData.lepusCode.root,
        source: newSource,
      }
    }
    for (let i = 0; i < args.encodeData.lepusCode.chunks.length; i++) {
      const chunk = args.encodeData.lepusCode.chunks[i]
      if (chunk?.name === assetName) {
        args.encodeData.lepusCode.chunks[i] = { ...chunk, source: newSource }
      }
    }
  }
}
