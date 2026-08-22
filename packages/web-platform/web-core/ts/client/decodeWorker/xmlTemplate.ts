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
import {
  convertCSSToStyleInfo,
  reportDiscardedAtRules,
  type StyleInfoRule,
} from '../../common/xml/cssToStyleInfo.js';

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
 * An XML card's CSS is tokenized at load time, so it goes through the same
 * style pipeline as a card produced by a build step.
 *
 * `styleInfo` accepts raw text on the `content` channel, which the engine emits
 * verbatim, or pre-parsed rules on the `rules` channel, which it rewrites.
 * Since a buildless card has no build step to tokenize its CSS, that work
 * happens here instead - see `common/xml/cssToStyleInfo.ts`, which parses with
 * `css-tree`, loaded on demand so the parser does not weigh down the decode
 * Worker's chunk for the built-card path that never needs it.
 *
 * Tokenizing is what makes the engine's style handling run, all verified by
 * experiment:
 *
 * 1. `<lynx-view transform-vw / transform-vh / transform-rem>` takes effect, so
 *    `vw` / `vh` / `rem` resolve against the lynx-view box instead of the
 *    browser viewport (`padding: 1rem` becomes
 *    `padding: calc(1 * var(--rem-unit))`).
 * 2. The Lynx `style_transformer` runs, so Lynx-specific semantics are
 *    translated - `display: linear` becomes `display: flex` plus the
 *    `--lynx-display-*` custom properties, and `linear-direction` maps to
 *    `--lynx-linear-orientation`.
 * 3. `:root` is rewritten to `[part="page"]`, so it addresses the card's own
 *    root element. A card renders inside a shadow root, where a literal `:root`
 *    would match nothing.
 *
 * Everything the format can carry is therefore on the `rules` channel and the
 * `content` channel stays empty. An at-rule Lynx has no rule kind for - `@media`
 * and friends - is dropped rather than handed to the browser verbatim, so a
 * markup card's capabilities stay equal to a built card's; see the note in
 * `common/xml/cssToStyleInfo.ts`.
 */

/**
 * The JSON artifact shape produced from an XML document. Only the fields the
 * XML format can express are present; `customSections` / `elementTemplates` are
 * deliberately absent because the markup format has no way to carry them.
 */
export interface XMLDerivedTemplate {
  pageConfig: Record<string, string>;
  styleInfo:
    | Record<string, { content: never[]; rules: StyleInfoRule[] }>
    | undefined;
  lepusCode: { root: string };
  manifest: Record<string, string> | undefined;
}

/**
 * The page config an XML card is rendered with.
 *
 * The values mirror `LynxTemplateBundle::Build()` in the engine, which
 * hard-codes the config for XML bundles instead of
 * reading it from the document (the markup format has no config section):
 * `app_type = CARD`, `front_end_dsl = REACT`, `enable_css_selector = true`,
 * `enable_css_parser = false`, `enable_css_variable = true`,
 * `enable_fiber_arch = true`.
 *
 * The web-only keys have no engine counterpart and follow `buildLynxTemplate()` in
 * `packages/repl`, the established precedent for rendering a hand-written card
 * on web:
 * - `enableRemoveCSSScope: true` - an XML card has a single global stylesheet
 *   and no per-component css scoping, so scoping must not be applied.
 * - `defaultDisplayLinear: false` - **differs from `packages/repl`, which passes
 *   `true`.** The engine is followed instead: `Build()` never sets this
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
    if (isXMLLeadingWhitespace(char)) {
      continue;
    }
    return char === '<';
  }
  return false;
}

/**
 * Whether every character of `source` is skippable prelude, i.e. it carries no
 * evidence either way about the payload's format.
 *
 * A caller sniffing a fixed size window uses this to decide whether it has to
 * read further before {@link looksLikeLynxXML} can classify the payload.
 */
export function isAllXMLLeadingWhitespace(source: string): boolean {
  for (let index = 0; index < source.length; index++) {
    if (!isXMLLeadingWhitespace(source[index]!)) {
      return false;
    }
  }
  return true;
}

/**
 * The whitespace the XML parser skips before the first markup character, plus a
 * byte order mark, which it also tolerates.
 */
function isXMLLeadingWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r'
    || char === '\f' || char === '\uFEFF';
}

/**
 * Translates a Lynx XML document into the JSON artifact shape.
 *
 * Returns the parser's structured error instead of throwing, so the caller can
 * forward `formattedMessage` through the worker's `error` channel.
 *
 * Asynchronous because the CSS parser is fetched on demand - it is a large
 * dependency that only a buildless card needs, so it is kept out of the decode
 * Worker's eagerly loaded chunk (see `common/xml/cssToStyleInfo.ts`). A document
 * with no `<style>` section resolves without any such fetch.
 */
export async function xmlToTemplate(
  source: string,
): Promise<
  { success: true; template: XMLDerivedTemplate } | {
    success: false;
    message: string;
  }
> {
  const parsed = parseLynxXML(source);
  if (!parsed.success) {
    return { success: false, message: parsed.error.formattedMessage };
  }

  // A `<style></style>` section that is present but empty yields `''`, which is
  // meaningfully different from an absent section, so test against `undefined`
  // rather than for truthiness.
  //
  // `content` stays empty: everything the format can carry is tokenized onto the
  // `rules` channel, and everything else is dropped rather than passed through.
  let styleInfo: XMLDerivedTemplate['styleInfo'];
  if (parsed.style !== undefined) {
    const { rules, discarded } = await convertCSSToStyleInfo(parsed.style);
    // Reported here rather than by the converter so that the conversion stays a
    // pure function, mirroring `xmlToTasmJSON` / `encodeLynxXML`.
    reportDiscardedAtRules(discarded);
    styleInfo = { [cardCSSId]: { content: [] as never[], rules } };
  }

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
      // the web equivalent of the engine's module wrapper, so
      // wrapping here would nest two module functions and hide the source's
      // top-level bindings.
      manifest,
    },
  };
}
