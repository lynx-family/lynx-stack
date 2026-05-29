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
import { rewriteTrailerToAbsoluteUrl } from './source-mapping-url-rewriter.js'

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
      // Bake the per-chunk release banner into each JS asset here (rather than
      // via `BannerPlugin`) so it can read `compilation.chunkGraph` to derive
      // the release key. Runs at PROCESS_ASSETS_STAGE_ADDITIONS — before source
      // maps are generated — so the maps account for the prepended banner.
      compilation.hooks.processAssets.tap(
        {
          name: this.name,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
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
      // `beforeEmit`. `beforeEmit` args don't include `intermediate`,
      // and lazy bundles emit their main-thread JS to `static/js/async/`
      // while the bundle's `debug-metadata.json` lives at
      // `<intermediateRoot>/async/<name>/` — deriving the metadata path
      // from the JS asset's dir would 404 for lazy bundles. Keyed by
      // sorted `entryNames` since each template covers a unique set.
      const intermediateByEntryKey = new Map<string, string>()

      templateHooks.beforeEncode.tap(
        this.constructor.name,
        (args) => {
          const uiSourceMapRecords = collectUiSourceMapRecords(
            compilation,
            args.entryNames,
          )
          const git = getGit()
          const entryPathMap = getEntryPathMap()
          const baseDir = git?.rootDir ?? compiler.context
          // Lazy-bundle entry names (e.g. `LazyComponent.js-react__main-thread`)
          // are internal chunk-group names that never appear in rsbuild
          // `source.entry`. When the map has nothing for any of this
          // template's entry names, walk the importer's blocks via
          // `chunkGroup.origins` + `moduleGraph.getResolvedModule` to
          // recover the dynamic-import target's resource path.
          const fromMap = args.entryNames.flatMap(name =>
            entryPathMap[name] ?? []
          )
          const entryFiles = fromMap.length > 0
            ? dedupe(fromMap)
            : dedupe(
              args.entryNames.flatMap(name =>
                collectLazyBundleEntryResources(compilation, name).map(abs =>
                  path.relative(baseDir, abs).split(path.sep).join('/')
                )
              ),
            )
          const rspeedy: RspeedyMeta = {
            entryFiles,
            bundlePath: args.filenameTemplate,
          }
          const asset: DebugMetadataAsset = {
            artifacts: collectArtifacts(compilation, args.entryNames),
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
          intermediateByEntryKey.set(
            entryKey(args.entryNames),
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

          rewriteSourceMappingURLTrailers(compilation, args)

          return args
        },
      )

      templateHooks.beforeEmit.tap(
        this.constructor.name,
        (args) => {
          const intermediate = intermediateByEntryKey.get(
            entryKey(args.entryNames),
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
 * Stable join of an `entryNames` list for use as a Map key. Sorted so a
 * caller passing `['a','b']` and `['b','a']` lands on the same bucket;
 * the separator is `\0` to avoid collision with any entry-name char.
 */
function entryKey(entryNames: string[]): string {
  return [...entryNames].sort().join('\0')
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

type BeforeEncodeArgs = Parameters<
  Parameters<TemplateHooks['beforeEncode']['tap']>[1]
>[0]

function rewriteSourceMappingURLTrailers(
  compilation: Rspack.Compilation,
  args: BeforeEncodeArgs,
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
    const after = rewriteTrailerToAbsoluteUrl(
      before,
      debugMetadataUrl,
      `${assetName}.map`,
    )
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
