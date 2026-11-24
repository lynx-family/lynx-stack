// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createHash } from 'node:crypto'

import type { Rspack } from '@rslib/core'

import type {
  CustomSectionNaming,
  LynxTemplatePlugin as LynxTemplatePluginClass,
} from '@lynx-js/template-webpack-plugin'

const SECTION_MAP_KEY = '__sectionMap'
const SECTION_HASH_LENGTH = 8

function getChunkAssetNames(
  compilation: Rspack.Compilation,
): Map<string, string> {
  const names = new Map<string, string>()

  for (const chunk of compilation.chunks) {
    if (chunk.name === undefined) {
      continue
    }
    for (const file of [...chunk.files, ...chunk.auxiliaryFiles]) {
      names.set(file, chunk.name)
    }
  }

  return names
}

function resolveChunkName(names: Map<string, string>, key: string): string {
  // A manifest key is a path (`/utils.js`), an asset name is not.
  const name = names.get(key) ?? names.get(key.replace(/^\//, ''))
  if (name === undefined) {
    throw new Error(
      `No chunk owns \`${key}\`, so the section it belongs to cannot be named.`,
    )
  }
  return name
}

// The consuming application loads a section by the name of the chunk it holds.
// `__LoadStyleSheet` derives the `:CSS` one from that name.
export function sectionNaming(
  compilation: Rspack.Compilation,
  options?: { reserveSectionMap?: boolean },
): CustomSectionNaming {
  const names = getChunkAssetNames(compilation)
  const nameOf = (key: string): string => resolveChunkName(names, key)
  const reserveSectionMap = options?.reserveSectionMap ?? false

  return {
    mainThread: assetName => {
      const name = nameOf(assetName)
      if (reserveSectionMap && name === SECTION_MAP_KEY) {
        throw new Error(
          `Entry name "${SECTION_MAP_KEY}" is reserved when \`hashSectionNames\` is enabled.`,
        )
      }
      return name
    },
    background: nameOf,
    css: assetName => `${nameOf(assetName)}:CSS`,
  }
}

export class ExternalBundleSectionMapPlugin {
  static readonly NAME = 'lynx:external-bundle-section-map'

  constructor(
    private LynxTemplatePlugin: typeof LynxTemplatePluginClass,
    private filenameTemplate?: string,
  ) {}

  apply(compiler: Rspack.Compiler): void {
    compiler.hooks.thisCompilation.tap(
      ExternalBundleSectionMapPlugin.NAME,
      (compilation) => {
        const templateHooks = this.LynxTemplatePlugin
          .getLynxTemplatePluginHooks(compilation)
        templateHooks.beforeEncode.tap(
          {
            name: ExternalBundleSectionMapPlugin.NAME,
            // Run after `LynxEncodePlugin.BEFORE_ENCODE_STAGE` (256) so
            // `encodeData.manifest` has its final keys and wrapped contents.
            stage: 1000,
          },
          (args) => {
            if (
              this.filenameTemplate !== undefined
              && args.filenameTemplate !== this.filenameTemplate
            ) {
              return args
            }

            const names = getChunkAssetNames(compilation)
            const sectionMap: Record<string, string> = {}

            for (
              const [manifestKey, content] of Object.entries(
                args.encodeData.manifest,
              )
            ) {
              if (manifestKey === '/app-service.js') {
                continue
              }
              const logicalName = resolveChunkName(names, manifestKey)
              if (logicalName === SECTION_MAP_KEY) {
                throw new Error(
                  `Entry name "${SECTION_MAP_KEY}" is reserved when \`hashSectionNames\` is enabled.`,
                )
              }
              const hash = createHash('sha256')
                .update(content)
                .digest('hex')
                .slice(0, SECTION_HASH_LENGTH)
              const hashedName = `${logicalName}.${hash}`
              sectionMap[logicalName] = hashedName

              // Move the background entry directly into this encode's
              // `customSections` so hashed names are scoped strictly to the
              // encode that produced them (no compilation-wide shared state).
              args.encodeData.customSections[hashedName] = { content }
              delete args.encodeData.manifest[manifestKey]

              const assetName = manifestKey.replace(/^\//, '')
              const asset = compilation.getAsset(assetName)
              if (asset) {
                compilation.updateAsset(asset.name, asset.source, {
                  ...asset.info,
                  'lynx:tasm-section': ['customSections', hashedName],
                })
              }
            }

            if (Object.keys(sectionMap).length > 0) {
              args.encodeData.customSections[SECTION_MAP_KEY] = {
                content: sectionMap,
              }
            }

            return args
          },
        )
      },
    )
  }
}
