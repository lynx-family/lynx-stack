// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Converts a buildless card's hand-written CSS into the `styleInfo` shape the
 * decode worker already assembles, tokenizing everything the binary style
 * format can represent.
 *
 * A card produced by a build step arrives with its CSS already tokenized into
 * `rules`, which is what makes the engine's style pipeline run: unit rewriting
 * (`transform-vw` / `-vh` / `-rem`), the Lynx `style_transformer` (`display:
 * linear` and friends) and selector rewriting (`:root` -> `[part="page"]`) all
 * operate on tokenized declarations. A buildless card has no build step, so this
 * module performs the equivalent conversion at load time.
 *
 * ## Why `css-tree` and not `@lynx-js/css-serializer`
 *
 * `ts/encode/encodeCSS.ts` does the same job for the encode path using
 * `@lynx-js/css-serializer`, and reusing it here would have been the obvious
 * move. It cannot be done: `css-serializer`'s `parse` imports `generateHref`,
 * which imports `node:path`, and the package exposes no subpath exports to
 * import around it. That is fine for `encodeCSS.ts`, which only ever runs in the
 * Node/server bundle, but this module is loaded by the decode Worker in a
 * browser, where bundling `node:path` fails outright.
 *
 * `css-tree` is what `css-serializer` itself parses with, is browser safe, and
 * is already used this way by `packages/repl`. Going straight to it also removes
 * a round trip: `css-serializer` rewrites every `var()` into a `{{--name}}`
 * placeholder plus a side table of fallbacks, purely as its own interchange
 * format, which the encode path then has to undo. Reading declarations from the
 * `css-tree` AST keeps `var()` intact throughout.
 *
 * ## Why the output uses both channels
 *
 * The binary format's `RuleType` has exactly three variants - `Declaration`,
 * `FontFace` and `KeyFrames` (`raw_style_info.rs`). There is no representation
 * for a conditional group rule, so `@media`, `@supports` and `@layer` *cannot*
 * be tokenized. `@import` is representable, but only as a link between numeric
 * css ids, which a hand-written `@import url("theme.css")` is not.
 *
 * Those constructs are therefore emitted on the raw `content` channel, which
 * hands them to the browser verbatim (see `cssLoader.parseAndPushContentRules`).
 * The browser honours `@media` / `@supports` / `@layer` natively, so keeping
 * them preserves behaviour that already worked, whereas tokenizing would have
 * had to drop them - silently, since they parse without any error.
 *
 * The trade-off, which is deliberate: CSS *inside* a preserved at-rule block is
 * not tokenized, so the rewrites listed above do not apply there.
 *
 * ## Why order is carried explicitly
 *
 * `cssLoader.loadStyleFromJSON` drains the whole `content` channel before it
 * looks at `rules`. Splitting a stylesheet across both would therefore hoist
 * every preserved at-rule ahead of every tokenized rule and reorder the cascade,
 * changing which of two equal-specificity declarations wins. To avoid that, the
 * conversion emits a single list in document order and the loader replays it
 * entry by entry.
 */

import * as csstree from 'css-tree';

/**
 * One tokenized rule, in the shape `cssLoader` pushes into the wasm encoder.
 *
 * `sel` mirrors the existing `rules` wire shape: a list of selectors, each a
 * flat list of `[plain, pseudoClass, pseudoElement, combinator]` groups that
 * `cssLoader` walks in chunks of four.
 */
export interface StyleInfoRule {
  /** Rule kind, matching the wasm `Rule` constructor's argument. */
  type: 'StyleRule' | 'FontFaceRule' | 'KeyframesRule';
  /** Selector sections, absent for `@font-face` and `@keyframes`. */
  sel?: string[][][];
  /** Declarations, as authored. */
  decl: [string, string][];
  /** `@keyframes` name, only for `KeyframesRule`. */
  name?: string;
  /** `@keyframes` steps, only for `KeyframesRule`. */
  children?: { keyText: string; decl: [string, string][] }[];
}

/**
 * One stylesheet entry, in document order.
 *
 * A single ordered list - rather than two independent channels - is what keeps
 * the cascade intact, see the note on ordering above.
 */
export type OrderedStyleEntry =
  /** CSS handed to the browser as written. */
  | { channel: 'verbatim'; text: string }
  /** A rule the binary format can represent, tokenized. */
  | { channel: 'tokenized'; rule: StyleInfoRule };

/**
 * A converted stylesheet.
 */
export interface ConvertedCSS {
  /** Every entry, in source order. */
  ordered: OrderedStyleEntry[];
  /**
   * The at-rule kinds that had to stay verbatim, for diagnostics. Empty when
   * the whole stylesheet was tokenized.
   */
  verbatimKinds: string[];
}

/**
 * The at-rules that have no counterpart in the binary style format and are
 * therefore preserved as text.
 */
const verbatimAtRules = new Set(['media', 'supports', 'layer']);

/**
 * Splits a selector list into the `[plain, pseudoClass, pseudoElement,
 * combinator]` groups the `rules` wire shape expects.
 *
 * The grouping matters: the style engine reads a combinator as the end of a
 * compound selector, so sections have to be flushed in the order they appear
 * rather than collected by kind.
 */
function selectorSections(prelude: csstree.Raw | csstree.SelectorList) {
  if (prelude.type !== 'SelectorList') {
    return [];
  }

  const selectors: string[][][] = [];
  for (
    const selectorNode of prelude.children.toArray() as csstree.Selector[]
  ) {
    const groups: string[][] = [];
    let plain: string[] = [];
    let pseudoClass: string[] = [];
    let pseudoElement: string[] = [];

    const flush = (combinator: string[]) => {
      groups.push(plain, pseudoClass, pseudoElement, combinator);
      plain = [];
      pseudoClass = [];
      pseudoElement = [];
    };

    for (const child of selectorNode.children.toArray()) {
      switch (child.type) {
        case 'ClassSelector':
          plain.push(`.${child.name}`);
          break;
        case 'IdSelector':
          plain.push(`#${child.name}`);
          break;
        case 'TypeSelector':
          plain.push(child.name);
          break;
        case 'AttributeSelector':
          plain.push(csstree.generate(child));
          break;
        case 'PseudoClassSelector':
          pseudoClass.push(csstree.generate(child));
          break;
        case 'PseudoElementSelector':
          pseudoElement.push(csstree.generate(child));
          break;
        case 'Combinator':
          flush([child.name]);
          break;
        case 'Percentage':
          // A `@keyframes` step selector, handled by the keyframes branch.
          plain.push(`${child.value}%`);
          break;
        default:
          // Anything else (`NestingSelector`, comments) carries no addressable
          // section, so it is skipped rather than guessed at.
          break;
      }
    }
    flush([]);
    selectors.push(groups);
  }
  return selectors;
}

/**
 * The declarations of a block, as `[property, value]` pairs.
 *
 * Custom properties are included: they are ordinary declarations to `css-tree`,
 * and a card relies on them, so they must not be filtered out. `!important` is
 * re-appended because `css-tree` reports it separately from the value.
 */
function declarationsOf(block: csstree.Block): [string, string][] {
  const declarations: [string, string][] = [];
  for (const node of block.children.toArray()) {
    if (node.type !== 'Declaration') {
      continue;
    }
    const value = csstree.generate(node.value)
      + (node.important ? ' !important' : '');
    declarations.push([node.property, value]);
  }
  return declarations;
}

/**
 * Converts a stylesheet into tokenized rules plus verbatim leftovers.
 *
 * Never throws on CSS it cannot represent: anything unsupported is preserved on
 * the raw channel instead, because losing a rule at load time would surface as
 * an unexplained rendering difference, and throwing would fail the whole card.
 * A stylesheet that does not parse at all is passed through verbatim, which is
 * the previous behaviour for every card and strictly better than rendering
 * nothing.
 */
export function convertCSSToStyleInfo(source: string): ConvertedCSS {
  const ordered: OrderedStyleEntry[] = [];
  const verbatimKinds = new Set<string>();

  let ast: csstree.StyleSheet;
  try {
    ast = csstree.parse(source, {
      parseValue: false,
      parseAtrulePrelude: false,
      parseCustomProperty: false,
      parseRulePrelude: true,
      positions: false,
    }) as csstree.StyleSheet;
  } catch {
    return {
      ordered: source.trim().length > 0
        ? [{ channel: 'verbatim', text: source }]
        : [],
      verbatimKinds: source.trim().length > 0 ? ['unparsed'] : [],
    };
  }

  for (const node of ast.children.toArray()) {
    if (node.type === 'Rule') {
      ordered.push({
        channel: 'tokenized',
        rule: {
          type: 'StyleRule',
          sel: selectorSections(node.prelude),
          decl: declarationsOf(node.block),
        },
      });
      continue;
    }

    if (node.type !== 'Atrule') {
      // A stray `Raw` node carries CSS the parser could not classify; keeping it
      // is safer than discarding it.
      if (node.type === 'Raw' && node.value.trim().length > 0) {
        verbatimKinds.add('unparsed');
        ordered.push({ channel: 'verbatim', text: node.value });
      }
      continue;
    }

    if (node.name === 'font-face') {
      if (node.block) {
        ordered.push({
          channel: 'tokenized',
          rule: {
            type: 'FontFaceRule',
            decl: declarationsOf(node.block),
          },
        });
      }
      continue;
    }

    if (node.name === 'keyframes') {
      if (node.block) {
        const steps: { keyText: string; decl: [string, string][] }[] = [];
        for (const step of node.block.children.toArray()) {
          if (step.type !== 'Rule') {
            continue;
          }
          steps.push({
            keyText: csstree.generate(step.prelude),
            decl: declarationsOf(step.block),
          });
        }
        ordered.push({
          channel: 'tokenized',
          rule: {
            type: 'KeyframesRule',
            name: node.prelude ? csstree.generate(node.prelude) : '',
            children: steps,
            decl: [],
          },
        });
      }
      continue;
    }

    if (verbatimAtRules.has(node.name)) {
      // No binary representation, so the block is preserved at its source
      // position and left for the browser to apply.
      verbatimKinds.add(`@${node.name}`);
      ordered.push({ channel: 'verbatim', text: csstree.generate(node) });
      continue;
    }

    if (node.name === 'import') {
      // The tokenized channel can only link one css id to another, which a
      // buildless card has no use for: it owns a single stylesheet (css id 0)
      // and has nothing to link to. The rule is left for the browser to resolve.
      verbatimKinds.add('@import');
      ordered.push({ channel: 'verbatim', text: csstree.generate(node) });
      continue;
    }

    // Any other at-rule (`@charset`, `@namespace`, future additions) is not
    // something this converter understands, so it is passed through rather than
    // dropped.
    verbatimKinds.add(`@${node.name}`);
    ordered.push({ channel: 'verbatim', text: csstree.generate(node) });
  }

  return { ordered, verbatimKinds: [...verbatimKinds] };
}
