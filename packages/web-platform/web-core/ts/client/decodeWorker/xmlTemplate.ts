// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Adapts the single file Lynx XML markup format to the JSON artifact shape the
 * decode worker already knows how to assemble.
 *
 * A buildless XML card carries only three payloads - a `<style>` section, a
 * main-thread script and an optional background script - whereas the decode
 * worker's section protocol is expressed in terms of a JSON artifact
 * (`pageConfig` / `styleInfo` / `lepusCode` / `manifest`). Rather than emitting
 * the section messages here, this module only performs the translation, so the
 * XML bypass and the JSON bypass share one assembly path.
 */

import { parseLynxXML } from '../../common/xml/parseLynxXML.js';

/**
 * The `manifest` key a card's background chunk is expected to live under. The
 * bts realm resolves the chunk through `templateCache['/app-service.js']`, see
 * `createChunkLoading`.
 */
const backgroundChunkPath = '/app-service.js';

/**
 * The `styleInfo` css id a card's own (non component scoped) rules live under.
 */
const cardCSSId = '0';

/**
 * Known limitation: an XML card's CSS is carried as **raw text**, not as
 * pre-parsed rules.
 *
 * `styleInfo` accepts two channels. The `rules` channel takes rules that a build
 * step already tokenized, and the style engine then rewrites them. The `content`
 * channel (used here, see `cssLoader.parseAndPushContentRules`) hands the text
 * to the engine as an `UnknownText` selector section, which is emitted verbatim.
 * A buildless card has no build step, so `content` is the only channel available
 * without adding a CSS parser to this Worker.
 *
 * Two consequences, both verified by experiment:
 *
 * 1. `<lynx-view transform-vw / transform-vh / transform-rem>` has no effect on
 *    an XML card. Those attributes make the engine rewrite `vw` / `vh` / `rem`
 *    into `calc(... * var(--vw-unit))` etc. so the units resolve against the
 *    lynx-view box instead of the browser viewport; the rewrite happens during
 *    tokenization, which the `content` channel skips. On web this only means the
 *    units keep their **native** browser meaning, so a card that does not set
 *    those attributes - the default - renders correctly.
 * 2. The Lynx `style_transformer` does not run, so Lynx-specific CSS semantics
 *    (for instance `display: linear` and the `linear-*` properties) are not
 *    translated. Plain web CSS is unaffected.
 *
 * Upgrade path: switch this to the `rules` channel, which requires a CSS parser
 * (`packages/repl/src/bundler/css-processor.ts` does exactly this with
 * `css-tree`). That adds a runtime dependency to a Worker-loaded path, so it is
 * deliberately left out of scope here.
 */

/**
 * The JSON artifact shape produced from an XML document. Only the fields the
 * XML format can express are present; `customSections` / `elementTemplates` are
 * deliberately absent because the markup format has no way to carry them.
 */
export interface XMLDerivedTemplate {
  pageConfig: Record<string, string>;
  styleInfo: Record<string, { content: string[]; rules: never[] }> | undefined;
  lepusCode: { root: string };
  manifest: Record<string, string> | undefined;
}

/**
 * The page config an XML card is rendered with.
 *
 * The values mirror `LynxTemplateBundle::Build()` in the authoritative C++
 * implementation, which hard-codes the config for XML bundles instead of
 * reading it from the document (the markup format has no config section):
 * `app_type = CARD`, `front_end_dsl = REACT`, `enable_css_selector = true`,
 * `enable_css_parser = false`, `enable_css_variable = true`,
 * `enable_fiber_arch = true`.
 *
 * The web-only keys have no C++ counterpart and follow `buildLynxTemplate()` in
 * `packages/repl`, the established precedent for rendering a hand-written card
 * on web:
 * - `enableRemoveCSSScope: true` - an XML card has a single global stylesheet
 *   and no per-component css scoping, so scoping must not be applied.
 * - `defaultDisplayLinear: false` - **differs from `packages/repl`, which passes
 *   `true`.** The C++ authority is followed instead: `Build()` never sets this
 *   field, and the generated `PageConfig` declares
 *   `bool default_display_linear_{false}`, so a native XML bundle renders with
 *   `false`. This is also what hand-written CSS expects, since the document's
 *   `flex-direction` / `display: flex` rules assume web box semantics rather
 *   than an implicit linear container.
 * - `defaultOverflowVisible: false` - likewise, `overflow: hidden` is the Lynx
 *   default and hand-written CSS opts in explicitly.
 * - `enableJSDataProcessor: false` - the markup format has no data processor.
 */
const xmlPageConfig: Record<string, string> = {
  appType: 'card',
  cardType: 'react',
  isLazy: 'false',
  enableCSSSelector: 'true',
  enableRemoveCSSScope: 'true',
  defaultDisplayLinear: 'false',
  defaultOverflowVisible: 'false',
  enableJSDataProcessor: 'false',
};

/**
 * Returns whether `source` looks like a Lynx XML document, by sniffing the
 * first non-ASCII-whitespace character for `<`.
 *
 * Content sniffing (rather than the response's `Content-Type`) is the primary
 * discriminator because a static file server commonly serves `.xml` as
 * `text/xml`, `application/xml` or even `application/octet-stream`, and ignores
 * the request's `Accept` header entirely.
 *
 * A UTF-8 byte order mark is skipped, matching the XML parser, which tolerates a
 * leading BOM.
 */
export function looksLikeLynxXML(source: string): boolean {
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!;
    if (
      char === ' ' || char === '\t' || char === '\n' || char === '\r'
      || char === '\f' || char === '\uFEFF'
    ) {
      continue;
    }
    return char === '<';
  }
  return false;
}

/**
 * Translates a Lynx XML document into the JSON artifact shape.
 *
 * Returns the parser's structured error instead of throwing, so the caller can
 * forward `formattedMessage` through the worker's `error` channel.
 */
export function xmlToTemplate(
  source: string,
): { success: true; template: XMLDerivedTemplate } | {
  success: false;
  message: string;
} {
  const parsed = parseLynxXML(source);
  if (!parsed.success) {
    return { success: false, message: parsed.error.formattedMessage };
  }

  // A `<style></style>` section that is present but empty yields `''`, which is
  // meaningfully different from an absent section, so test against `undefined`
  // rather than for truthiness.
  const styleInfo = parsed.style !== undefined
    ? { [cardCSSId]: { content: [parsed.style], rules: [] as never[] } }
    : undefined;

  const manifest = parsed.backgroundThreadScript !== undefined
    ? { [backgroundChunkPath]: parsed.backgroundThreadScript }
    : undefined;

  return {
    success: true,
    template: {
      pageConfig: { ...xmlPageConfig },
      styleInfo,
      // The main-thread script rides the card's `root` lepus chunk, which the
      // runtime auto-executes once the section arrives.
      lepusCode: { root: parsed.mainThreadScript },
      // The background source is kept verbatim: `createChunkLoading` runs each
      // bts chunk through `new Function(...paramNames, jsContent)`, which is
      // the web equivalent of the C++ `AddModuleWrapForJsContent()` wrapper, so
      // wrapping here would nest two module functions and hide the source's
      // top-level bindings.
      manifest,
    },
  };
}
