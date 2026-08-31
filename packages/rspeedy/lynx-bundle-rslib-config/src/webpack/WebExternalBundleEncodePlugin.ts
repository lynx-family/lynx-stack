// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rslib/core'

import type { LynxStyleNode } from '@lynx-js/css-serializer'
import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'
import type { TasmJSONInfo } from '@lynx-js/web-core/encode'

const PLUGIN_NAME = 'WebExternalBundleEncodePlugin'

interface Options {
  LynxTemplatePlugin: {
    getLynxTemplatePluginHooks:
      typeof LynxTemplatePlugin.getLynxTemplatePluginHooks
  }
}

/**
 * Encodes an external bundle for the web platform.
 *
 * @remarks
 *
 * A native bundle carries every chunk as a custom section. The web runtime has
 * no such lookup: it reads the main thread from `lepusCode`, the background
 * from `manifest` and the styles from the StyleInfo section, the same way it
 * loads a card, so the sections are routed into those slots here. The
 * `JsBytecode` tag says which chunk is the main thread one — on web it only
 * selects the slot, the chunk stays raw source for `lynx.loadScript` to wrap.
 */
/**
 * Routes the custom sections of an external bundle into the slots a web bundle
 * carries. The `JsBytecode` tag says which chunk is the main thread one; on web
 * it only selects the slot, the chunk stays raw source.
 */
export function routeSectionsForWeb(
  customSections: Record<
    string,
    { encoding?: string, content: string | { ruleList: LynxStyleNode[] } }
  >,
): Pick<TasmJSONInfo, 'styleInfo' | 'lepusCode' | 'manifest'> {
  const styleInfo: TasmJSONInfo['styleInfo'] = {}
  const lepusCode: TasmJSONInfo['lepusCode'] = {}
  const manifest: TasmJSONInfo['manifest'] = {}
  let cssId = 0

  for (const [name, section] of Object.entries(customSections)) {
    if (section.encoding === 'CSS') {
      const { ruleList } = section.content as { ruleList?: LynxStyleNode[] }
      // `encodeCSS` requires numeric css-id keys.
      styleInfo[String(cssId++)] = ruleList ?? []
    } else if (section.encoding === 'JsBytecode') {
      lepusCode[name] = section.content as string
    } else {
      // Keyed `/<name>` so `readScript` finds it, matching the
      // `/app-service.js` convention of a card.
      manifest[`/${name}`] = section.content as string
    }
  }

  return { styleInfo, lepusCode, manifest }
}

export class WebExternalBundleEncodePlugin {
  constructor(private options: Options) {}

  apply(compiler: Rspack.Compiler): void {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      const hooks = this.options.LynxTemplatePlugin
        .getLynxTemplatePluginHooks(
          compilation as unknown as Parameters<
            typeof LynxTemplatePlugin.getLynxTemplatePluginHooks
          >[0],
        )

      hooks.encode.tapPromise(PLUGIN_NAME, async ({ encodeOptions }) => {
        const { compilerOptions, sourceContent, customSections } =
          encodeOptions as unknown as {
            compilerOptions: Record<string, unknown>
            sourceContent: { appType: string }
            customSections: Record<
              string,
              {
                encoding?: string
                content: string | { ruleList: LynxStyleNode[] }
              }
            >
          }

        const { styleInfo, lepusCode, manifest } = routeSectionsForWeb(
          customSections ?? {},
        )

        const { encode } = await import('@lynx-js/web-core/encode')

        return {
          buffer: Buffer.from(encode({
            styleInfo,
            manifest,
            lepusCode,
            cardType: 'react',
            appType: sourceContent.appType,
            pageConfig: compilerOptions,
            customSections: {},
            elementTemplates: {},
          })),
          debugInfo: '',
        }
      })
    })
  }
}
