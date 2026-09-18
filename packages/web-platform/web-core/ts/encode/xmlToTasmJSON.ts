// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Turns a single file Lynx XML markup document into the input
 * {@link encode} takes, so that a hand-written card can be built into an
 * ordinary `.web.bundle` instead of needing a load-time bypass.
 *
 * The whole point of going through {@link encode} is that the bundle a markup
 * card produces is indistinguishable from the bundle a ReactLynx build produces:
 * same magic header, same sections, same rkyv-encoded `StyleInfo`, and therefore
 * the same decoder on the other side. Nothing downstream has to know the card
 * was hand-written.
 *
 * ## Unsupported at-rules are discarded, deliberately
 *
 * Lynx's binary style format has three rule kinds - `Declaration`, `FontFace`
 * and `KeyFrames` (`raw_style_info.rs`). There is no representation for a
 * conditional group, so `@media`, `@supports` and `@layer` are not Lynx
 * features: a ReactLynx card cannot use them either, on any platform. Discarding
 * them here is what keeps a markup card's capabilities equal to a built card's,
 * rather than giving web-only cards a feature native does not have.
 *
 * `@lynx-js/css-serializer` already discards most of the rest before this module
 * sees anything - `@container`, `@scope`, `@starting-style`, `@property`,
 * `@page`, `@charset`, `@namespace` and anything newer than its dispatch, all
 * with an empty `errors` array. That is the same intent, so this module does not
 * try to recover them; it only makes the outcome visible.
 *
 * Because none of it is an error, the only failure mode would be silence: an
 * author writes `@property --x` and gets a card that renders wrong with nothing
 * to go on. So every discarded at-rule is reported through
 * {@link diagnoseDiscardedAtRules}, once per kind. This module runs inside the
 * build (`@lynx-js/web-core/encode` is Node-only - it loads the `binary/encode`
 * wasm through `node:fs` glue), so the report is a build-time diagnostic and
 * never reaches a production browser runtime; that is why it is unconditional
 * rather than gated on a dev flag, of which this package has none.
 */

import * as CSS from '@lynx-js/css-serializer';

import { parseLynxXML } from '../common/xml/parseLynxXML.js';
import { encode, type TasmJSONInfo } from './webEncoder.js';

/**
 * The `manifest` key a card's background chunk is expected to live under. The
 * bts realm resolves the chunk through `templateCache['/app-service.js']`, see
 * `createChunkLoading`.
 */
const backgroundChunkPath = '/app-service.js';

/**
 * The `styleInfo` css id a card's own (non component scoped) rules live under.
 *
 * A markup card owns exactly one stylesheet, so this is the only id it ever
 * uses - which is also why `@import` cannot mean anything here, see
 * {@link stripUnrepresentable}.
 */
const cardCSSId = '0';

/**
 * The page config a markup card is built with.
 *
 * The values mirror `LynxTemplateBundle::Build()` in the engine, which
 * hard-codes the config for XML bundles rather than reading it from the document
 * - the markup format has no config section: `app_type = CARD`,
 * `front_end_dsl = REACT`, `enable_css_selector = true`,
 * `enable_css_parser = false`, `enable_css_variable = true`,
 * `enable_fiber_arch = true`.
 *
 * The web-only keys have no engine counterpart and follow `buildLynxTemplate()`
 * in `packages/repl`, the established precedent for rendering a hand-written
 * card on web:
 *
 * - `enableRemoveCSSScope: true` - a markup card has a single global stylesheet
 *   and no per-component css scoping, so scoping must not be applied.
 * - `defaultDisplayLinear: false` - **differs from `packages/repl`, which passes
 *   `true`.** The engine is followed instead: `Build()` never sets this field and
 *   the generated `PageConfig` declares `bool default_display_linear_{false}`,
 *   so a native XML bundle renders with `false`. It is also what hand-written
 *   CSS expects, since a document's `flex-direction` / `display: flex` rules
 *   assume web box semantics rather than an implicit linear container.
 * - `defaultOverflowVisible: false` - likewise, `overflow: hidden` is the Lynx
 *   default and hand-written CSS opts in explicitly.
 * - `enableJSDataProcessor: false` - the markup format has no data processor.
 */
const markupPageConfig: Record<string, string> = {
  enableCSSSelector: 'true',
  enableRemoveCSSScope: 'true',
  defaultDisplayLinear: 'false',
  defaultOverflowVisible: 'false',
  enableJSDataProcessor: 'false',
};

/**
 * A construct the bundle format cannot carry, reported rather than hidden.
 */
export interface DiscardedAtRule {
  /** The at-rule's name, with its `@`, e.g. `@media`. */
  name: string;
  /**
   * Why it cannot be carried.
   *
   * `unrepresentable` - Lynx's style format has no rule kind for it.
   * `unsupported` - the CSS parser has no case for it, so it never even reached
   * this module. Its contents are gone with it.
   * `unresolvable` - the construct exists in the format but this document cannot
   * express it, which currently means only `@import` with a URL.
   */
  reason: 'unrepresentable' | 'unsupported' | 'unresolvable';
}

/**
 * The at-rules `css-serializer` turns into nodes. Anything else it drops, so
 * anything else found in the source is reported as `unsupported`.
 */
const parsedAtRules = new Set([
  'media',
  'supports',
  'layer',
  'import',
  'keyframes',
  'font-face',
]);

/**
 * The at-rules that parse but have no rule kind in the binary style format.
 */
const unrepresentableAtRules = new Set(['media', 'supports', 'layer']);

/**
 * Finds every at-rule in `source` that will not survive into the bundle.
 *
 * Needed because the two kinds of loss are invisible from different places: an
 * `@media` node reaches {@link stripUnrepresentable} and can be counted there,
 * but a `@property` never becomes a node at all, so the only way to know it was
 * written is to look at the source. `css-serializer` re-exports the `css-tree`
 * it already depends on, so this costs a parse but no new dependency.
 *
 * Reported at any nesting depth, since a group's contents are dropped with it.
 */
export function diagnoseDiscardedAtRules(source: string): DiscardedAtRule[] {
  let ast: CSS.csstree.CssNode;
  try {
    ast = CSS.csstree.parse(source, {
      parseValue: false,
      parseAtrulePrelude: false,
      parseCustomProperty: false,
      parseRulePrelude: false,
      positions: false,
    });
  } catch {
    // A stylesheet that will not parse at all is a separate problem, reported by
    // the caller when the conversion itself fails.
    return [];
  }

  const seen = new Map<string, DiscardedAtRule>();
  CSS.csstree.walk(ast, (node) => {
    if (node.type !== 'Atrule') {
      return;
    }
    const reason = !parsedAtRules.has(node.name)
      ? 'unsupported'
      : unrepresentableAtRules.has(node.name)
      ? 'unrepresentable'
      : undefined;
    if (reason === undefined) {
      return;
    }
    const name = `@${node.name}`;
    if (!seen.has(name)) {
      seen.set(name, { name, reason });
    }
  });
  return [...seen.values()];
}

/**
 * Removes the nodes {@link encode} cannot accept.
 *
 * Two of them, and both would otherwise be worse than a drop:
 *
 * - a group at-rule (`@media` / `@supports` / `@layer`) falls through
 *   `encodeCSS`'s dispatch and is dropped there anyway, silently;
 * - an `@import` whose href is not a numeric css id makes `encodeCSS` **throw**,
 *   which would fail the whole build. A hand-written `@import url("theme.css")`
 *   is exactly that: the tokenized channel can only link one numeric css id to
 *   another, which is a build step's notion, and a markup card owns a single
 *   stylesheet with nothing to link to. So `@import` with a URL is not a Lynx
 *   feature for this format, and is dropped like the rest instead of aborting.
 *
 * Filtering here rather than teaching `encodeCSS` about it keeps the encode path
 * that every ReactLynx build depends on byte for byte unchanged.
 */
function stripUnrepresentable(
  nodes: CSS.LynxStyleNode[],
): { nodes: CSS.LynxStyleNode[]; droppedURLImport: boolean } {
  let droppedURLImport = false;
  const kept = nodes.filter((node) => {
    if (
      node.type === 'MediaRule' || node.type === 'SupportsRule'
      || node.type === 'LayerRule'
    ) {
      return false;
    }
    if (node.type === 'ImportRule') {
      const href = node.href.startsWith('/') ? node.href.slice(1) : node.href;
      if (isNaN(Number(href))) {
        droppedURLImport = true;
        return false;
      }
    }
    return true;
  });
  return { nodes: kept, droppedURLImport };
}

/**
 * What {@link xmlToTasmJSON} produces.
 */
export type XMLToTasmJSONResult =
  | {
    success: true;
    tasmJSON: TasmJSONInfo;
    /** At-rules that will not appear in the bundle, empty when there are none. */
    discarded: DiscardedAtRule[];
  }
  | {
    success: false;
    /** The parser's message, formatted like the reference implementation. */
    message: string;
  };

/**
 * Translates a Lynx XML document into {@link encode}'s input.
 *
 * Returns the parser's structured error instead of throwing, so a caller can
 * report it however it likes.
 */
export function xmlToTasmJSON(source: string): XMLToTasmJSONResult {
  const parsed = parseLynxXML(source);
  if (!parsed.success) {
    return { success: false, message: parsed.error.formattedMessage };
  }

  // A `<style></style>` section that is present but empty yields `''`, which is
  // meaningfully different from an absent section, so test against `undefined`
  // rather than for truthiness.
  const hasStyle = parsed.style !== undefined;
  const discarded = hasStyle
    ? diagnoseDiscardedAtRules(parsed.style!)
    : [];

  let styleInfo: Record<string, CSS.LynxStyleNode[]> = {};
  if (hasStyle) {
    const stripped = stripUnrepresentable(CSS.parse(parsed.style!).root);
    styleInfo = { [cardCSSId]: stripped.nodes };
    if (stripped.droppedURLImport) {
      // Only detectable from the parsed node: whether an `@import` is
      // representable depends on its resolved href, which the source scan in
      // `diagnoseDiscardedAtRules` deliberately does not try to reproduce.
      discarded.push({ name: '@import', reason: 'unresolvable' });
    }
  }

  return {
    success: true,
    tasmJSON: {
      styleInfo,
      // The background source is kept verbatim: `createChunkLoading` runs each
      // bts chunk through `new Function(...paramNames, jsContent)`, which is the
      // web equivalent of the engine's module wrapper, so wrapping here would
      // nest two module functions and hide the source's top-level bindings.
      // Lynx Core still loads the card's fixed app-service entry when the XML
      // omits its optional background script. Keep that syntax optional by
      // registering an empty chunk instead of falling back to an HTTP request.
      manifest: {
        [backgroundChunkPath]: parsed.backgroundThreadScript ?? '',
      },
      cardType: 'react',
      appType: 'card',
      pageConfig: { ...markupPageConfig },
      // The main-thread script rides the card's `root` lepus chunk, which the
      // runtime auto-executes once the section arrives.
      lepusCode: { root: parsed.mainThreadScript },
      // The markup format has no way to carry either.
      customSections: {},
      elementTemplates: {},
    },
    discarded,
  };
}

/**
 * Builds a `.web.bundle` from a Lynx XML markup document.
 *
 * The bytes are an ordinary modern bundle - see the note at the top of the file
 * - so the existing decoder consumes them with no markup-specific handling.
 *
 * Discarded at-rules are reported on the console as well as returned, because
 * the common caller is a build script that would otherwise drop the information
 * on the floor.
 */
export function encodeLynxXML(
  source: string,
): { success: true; buffer: Uint8Array; discarded: DiscardedAtRule[] } | {
  success: false;
  message: string;
} {
  const result = xmlToTasmJSON(source);
  if (!result.success) {
    return result;
  }

  for (const { name, reason } of result.discarded) {
    console.warn(
      reason === 'unrepresentable'
        ? `[lynx-web] ${name} has no representation in the Lynx style format and was dropped from the bundle, along with the rules inside it. It is not supported on any Lynx platform.`
        : reason === 'unsupported'
        ? `[lynx-web] ${name} is not recognised by the Lynx CSS parser and was dropped from the bundle, along with the rules inside it.`
        : `[lynx-web] ${name} with a URL cannot be resolved for a markup card, which owns a single stylesheet, and was dropped from the bundle.`,
    );
  }

  return {
    success: true,
    buffer: encode(result.tasmJSON),
    discarded: result.discarded,
  };
}
