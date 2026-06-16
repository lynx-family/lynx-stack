// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LynxStyleNode } from '@lynx-js/css-serializer'
import type { TasmJSONInfo } from '@lynx-js/web-core/encode'

/**
 * The encode options object built by {@link ExternalBundleWebpackPlugin} and
 * passed to its pluggable `encode`.
 */
interface ExternalBundleEncodeOptions {
  compilerOptions: Record<string, unknown>
  sourceContent: { appType: string }
  customSections: Record<string, {
    encoding?: string
    content: string | { ruleList: LynxStyleNode[] }
  }>
}

/**
 * An `encode` implementation for {@link ExternalBundleWebpackPlugin} that emits
 * a **web binary bundle** (the `.web.bundle` format decoded by
 * `@lynx-js/web-core`) via `@lynx-js/web-core/encode`, instead of the native
 * TASM format produced by `@lynx-js/tasm`.
 *
 * Differences from the native encoder, both required by the web platform:
 * - JS sections are kept as **raw source** (the `JsBytecode` marker is ignored).
 *   The web runtime wraps each section when `lynx.loadScript` evaluates it, so
 *   the build must not wrap or bytecode-compile it here.
 * - `*:CSS` sections are folded into the StyleInfo section (keyed by a numeric
 *   css id) so the web style engine applies them, rather than being kept as
 *   custom sections.
 *
 * @public
 */
export function getWebEncodeMode(): (
  opts: unknown,
) => Promise<{ buffer: Buffer }> {
  return async (opts: unknown) => {
    const { compilerOptions, sourceContent, customSections } =
      opts as ExternalBundleEncodeOptions

    const webCustomSections: TasmJSONInfo['customSections'] = {}
    const styleInfo: TasmJSONInfo['styleInfo'] = {}
    let cssId = 0

    for (const [name, section] of Object.entries(customSections)) {
      if (section.encoding === 'CSS' && name.endsWith(':CSS')) {
        const { ruleList } = section.content as { ruleList: LynxStyleNode[] }
        // `encodeCSS` requires numeric css-id keys.
        styleInfo[String(cssId++)] = ruleList ?? []
      } else {
        webCustomSections[name] = { content: section.content as string }
      }
    }

    const { encode } = await import('@lynx-js/web-core/encode')
    return {
      buffer: Buffer.from(encode({
        styleInfo,
        manifest: {},
        lepusCode: {},
        cardType: 'react',
        appType: sourceContent.appType,
        pageConfig: compilerOptions,
        customSections: webCustomSections,
        elementTemplates: {},
      })),
    }
  }
}
