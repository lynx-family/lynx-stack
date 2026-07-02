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
  elementTemplates?: TasmJSONInfo['elementTemplates']
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
 * Differences from the native encoder, all required by the web platform:
 * - Sections are routed to the bundle slot whose chunk format they match,
 *   instead of all going into custom sections, keyed by the `encoding` tag
 *   `ExternalBundleWebpackPlugin` sets from each chunk's layer: the main-thread
 *   chunk (`JsBytecode`) goes into `lepusCode`, every other JS chunk into
 *   `manifest`, and `CSS` chunks into the StyleInfo section. The web runtime
 *   then loads each through the same path the card uses for its own
 *   lepus/manifest chunks.
 * - JS is kept as **raw source** — the `JsBytecode` tag only selects the slot;
 *   the chunk is not bytecode-compiled. The web runtime wraps each section when
 *   `lynx.loadScript` evaluates it, so the build must not wrap it here.
 *
 * @public
 */
export function getWebEncodeMode(): (
  opts: unknown,
) => Promise<{ buffer: Buffer }> {
  return async (opts: unknown) => {
    const { compilerOptions, sourceContent, customSections, elementTemplates } =
      opts as ExternalBundleEncodeOptions

    const styleInfo: TasmJSONInfo['styleInfo'] = {}
    const lepusCode: TasmJSONInfo['lepusCode'] = {}
    const manifest: TasmJSONInfo['manifest'] = {}
    let cssId = 0

    for (const [name, section] of Object.entries(customSections)) {
      // Route each section by the `encoding` tag `ExternalBundleWebpackPlugin`
      // sets from the chunk's layer, not by guessing from the section name (a
      // user-declared `layer: 'main-thread'` entry has no `__main-thread`
      // suffix).
      if (section.encoding === 'CSS') {
        const { ruleList } = section.content as { ruleList: LynxStyleNode[] }
        // `encodeCSS` requires numeric css-id keys.
        styleInfo[String(cssId++)] = ruleList ?? []
      } else if (section.encoding === 'JsBytecode') {
        // The main-thread (mts) chunk — its layer is MAIN_THREAD, tagged
        // `JsBytecode` from `mainThreadChunks` — has a card lepus chunk's shape,
        // so it rides `lepusCode`; the web runtime loads it in the mts realm via
        // `lepusCodeUrls`, keyed by the `lynx.loadScript` section path.
        lepusCode[name] = section.content as string
      } else {
        // Every other JS section is a background (bts) chunk; it rides
        // `manifest`, keyed `/<sectionPath>` so `readScript` finds it, matching
        // the card's `/app-service.js` convention.
        manifest[`/${name}`] = section.content as string
      }
    }

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
        ...(elementTemplates === undefined ? {} : { elementTemplates }),
      })),
    }
  }
}
