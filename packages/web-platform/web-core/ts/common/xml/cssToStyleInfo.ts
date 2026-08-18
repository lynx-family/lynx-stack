// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Converts a buildless card's hand-written CSS into the tokenized `rules`
 * channel of the `styleInfo` shape the decode worker already assembles.
 *
 * A card produced by a build step arrives with its CSS already tokenized into
 * `rules`, which is what makes the engine's style pipeline run: unit rewriting
 * (`transform-vw` / `-vh` / `-rem`), the Lynx `style_transformer` (`display:
 * linear` and friends) and selector rewriting (`:root` -> `[part="page"]`) all
 * operate on tokenized declarations. A buildless card has no build step, so this
 * module performs the equivalent conversion at load time.
 *
 * ## Unsupported at-rules are discarded, deliberately
 *
 * Lynx's binary style format has three rule kinds - `Declaration`, `FontFace`
 * and `KeyFrames` (`raw_style_info.rs`). There is no representation for a
 * conditional group, so `@media`, `@supports` and `@layer` are not Lynx
 * features: a ReactLynx card cannot use them either, on any platform. Handing
 * them to the browser verbatim would give a web-only markup card a capability
 * native does not have, so they are dropped instead - the same decision, for the
 * same reason, as the build-time path in `ts/encode/xmlToTasmJSON.ts`.
 *
 * Because none of it is a CSS error, the only failure mode would be silence, so
 * every drop is reported once per at-rule kind through
 * {@link reportDiscardedAtRules}. Unlike the build-time path, this module runs
 * in a browser at card load time, so the report is gated on a development build.
 *
 * Anything that is neither a rule nor an at-rule - a comment, a `Raw` node left
 * by a stylesheet the parser could not classify at all - is skipped. `css-tree`
 * already discards malformed fragments mid-stylesheet without reporting them
 * (`.a{}  !!!!  .b{}` parses to exactly two rules), so at-rules are the only
 * boundary at which a complete report is possible.
 *
 * ## Why `css-tree` and not `@lynx-js/css-serializer`
 *
 * `ts/encode/encodeCSS.ts` does the same job for the encode path using
 * `@lynx-js/css-serializer`, and reusing it here would have been the obvious
 * move. Two things rule it out, neither of which a change to that package would
 * fix on its own:
 *
 * 1. It would not remove the `css-tree` dependency anyway. `css-serializer`
 *    reports a rule's selector as `StyleRule.selectorText`, a flat string rather
 *    than a selector AST - which is exactly why `encodeCSS.ts` has to re-parse
 *    it with `CSS.csstree.parse(...)` to recover the sections. This converter
 *    needs the same per-section data (the `[plain, pseudoClass, pseudoElement,
 *    combinator]` groups below), so it would parse with `css-serializer` and
 *    then parse again with `css-tree`. `css-serializer` also declares `css-tree`
 *    as a runtime dependency and re-exports it, so it stays in the graph either
 *    way.
 * 2. `css-serializer` rewrites every `var()` into a `{{--name}}` placeholder
 *    plus a side table of fallbacks, purely as its own interchange format, which
 *    the encode path then has to undo. Reading declarations from the `css-tree`
 *    AST keeps `var()` intact throughout, with no lossy round trip.
 *
 * `css-tree` is also browser safe and already used this way by `packages/repl`.
 *
 * ## Why the parser is loaded on demand
 *
 * A CSS parser is a large dependency - `css-tree` is the single biggest module
 * in the decode Worker's chunk - and only a buildless markup card needs one, a
 * card produced by a build step arrives already tokenized. The `import()` in
 * {@link convertCSSToStyleInfo} therefore keeps it out of the eagerly fetched
 * (`webpackPreload`ed) worker chunk and behind a request that is made the first
 * time a markup card with a `<style>` section is actually loaded. That is also
 * why this module holds no top-level value import of it: one would defeat the
 * split by pulling the parser back into whatever chunk imports this file.
 *
 * The bundler caches both the chunk and the module, so the cost is paid once.
 */

import type * as csstree from 'css-tree';

// Type only, so nothing of the Node-only encode entry reaches the decode
// Worker's bundle: the build-time path owns the taxonomy and this one mirrors
// it, rather than inventing a second vocabulary for the same drops.
import type { DiscardedAtRule } from '../../encode/xmlToTasmJSON.js';

/**
 * The `css-tree` entry points this module uses, loaded on demand.
 *
 * `import type` above erases at compile time, so the only reference to the
 * package that survives into the bundle is the `import()` below - which is what
 * puts the parser in its own chunk. See the note on on-demand loading above.
 */
type CSSTree = Pick<typeof csstree, 'parse' | 'generate' | 'walk'>;

/**
 * The in-flight or settled parser load.
 *
 * Cached as the promise rather than the module so that two cards arriving
 * together share one load instead of racing, and so a resolved load costs an
 * already-settled `await` rather than a second `import()`.
 */
let csstreePromise: Promise<CSSTree> | undefined;

/**
 * Loads the CSS parser, reusing the previous load.
 */
function loadCSSTree(): Promise<CSSTree> {
  return csstreePromise ??= import('css-tree');
}

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
  /** Selector sections, empty for `@font-face` and `@keyframes`. */
  sel: string[][][];
  /** Declarations, as authored. Empty for `@keyframes`, which nests them. */
  decl: [string, string][];
  /** `@keyframes` name, only for `KeyframesRule`. */
  name?: string;
  /** `@keyframes` steps, only for `KeyframesRule`. */
  children?: { keyText: string; decl: [string, string][] }[];
}

/**
 * A converted stylesheet.
 */
export interface ConvertedCSS {
  /** Every rule the binary format can represent, in source order. */
  rules: StyleInfoRule[];
  /**
   * The at-rules that were dropped, one entry per kind. Empty when the whole
   * stylesheet was tokenized.
   */
  discarded: DiscardedAtRule[];
}

/**
 * The at-rules the Lynx CSS parser recognises. Anything else could never reach a
 * built card either, so it is reported as `unsupported`.
 *
 * Mirrors `parsedAtRules` in `ts/encode/xmlToTasmJSON.ts`, which derives the set
 * from `@lynx-js/css-serializer`'s dispatch.
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
 * Finds every at-rule that will not survive the conversion.
 *
 * Walks the whole tree rather than only the top level, since a group's contents
 * are dropped with it: `@media { @property --x {} }` loses both.
 *
 * An `@import` is always `unresolvable` here. The tokenized channel can only
 * link one numeric css id to another, which is a build step's notion, and a
 * markup card owns a single stylesheet (css id 0) with nothing to link to.
 */
function diagnoseDiscardedAtRules(
  ast: csstree.StyleSheet,
  walk: CSSTree['walk'],
): DiscardedAtRule[] {
  const seen = new Map<string, DiscardedAtRule>();
  walk(ast, (node) => {
    if (node.type !== 'Atrule') {
      return;
    }
    const reason = !parsedAtRules.has(node.name)
      ? 'unsupported'
      : unrepresentableAtRules.has(node.name)
      ? 'unrepresentable'
      : node.name === 'import'
      ? 'unresolvable'
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
 * Reports the at-rules a stylesheet lost, once per kind.
 *
 * The wording mirrors `encodeLynxXML` in `ts/encode/xmlToTasmJSON.ts`, which
 * reports the same taxonomy for the build-time path. It cannot be shared as
 * code: that module loads the encode wasm through `node:fs` glue and so cannot
 * be imported into a browser Worker, which is why only its type comes over.
 *
 * Gated on a development build, unlike the build-time path, because this runs in
 * a browser every time a markup card is loaded. `process.env.NODE_ENV` is
 * substituted at bundle time by rspack's `optimization.nodeEnv`, so a production
 * bundle drops the call site entirely.
 */
export function reportDiscardedAtRules(discarded: DiscardedAtRule[]): void {
  // Written as a property access on purpose: that exact expression is what the
  // bundler substitutes. The cast only silences
  // `noPropertyAccessFromIndexSignature` and does not change what is emitted -
  // reading `process.env['NODE_ENV']` instead would not be substituted, and
  // would then throw in a Worker, where `process` does not exist.
  if ((process.env as { NODE_ENV?: string }).NODE_ENV === 'production') {
    return;
  }
  for (const { name, reason } of discarded) {
    console.warn(
      reason === 'unrepresentable'
        ? `[lynx-web] ${name} has no representation in the Lynx style format and was dropped, along with the rules inside it. It is not supported on any Lynx platform.`
        : reason === 'unsupported'
        ? `[lynx-web] ${name} is not recognised by the Lynx CSS parser and was dropped, along with the rules inside it.`
        : `[lynx-web] ${name} with a URL cannot be resolved for a markup card, which owns a single stylesheet, and was dropped.`,
    );
  }
}

/**
 * Splits a selector list into the `[plain, pseudoClass, pseudoElement,
 * combinator]` groups the `rules` wire shape expects.
 *
 * The grouping matters: the style engine reads a combinator as the end of a
 * compound selector, so sections have to be flushed in the order they appear
 * rather than collected by kind.
 *
 * `generate` is passed in rather than imported, because the parser is loaded on
 * demand and this helper must stay synchronous.
 */
function selectorSections(
  prelude: csstree.Raw | csstree.SelectorList,
  generate: CSSTree['generate'],
) {
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
          plain.push(generate(child));
          break;
        case 'PseudoClassSelector':
          pseudoClass.push(generate(child));
          break;
        case 'PseudoElementSelector':
          pseudoElement.push(generate(child));
          break;
        case 'Combinator':
          flush([child.name]);
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
 *
 * `generate` is passed in for the same reason as in {@link selectorSections}.
 */
function declarationsOf(
  block: csstree.Block,
  generate: CSSTree['generate'],
): [string, string][] {
  const declarations: [string, string][] = [];
  for (const node of block.children.toArray()) {
    if (node.type !== 'Declaration') {
      continue;
    }
    const value = generate(node.value)
      + (node.important ? ' !important' : '');
    declarations.push([node.property, value]);
  }
  return declarations;
}

/**
 * Converts a stylesheet into the rules the binary style format can carry, plus a
 * report of what had to be dropped.
 *
 * Asynchronous only because the parser is fetched on demand, see the note on
 * that above. A stylesheet that turns out to be empty is answered without
 * loading it at all, so a markup card with no CSS pays nothing.
 *
 * `css-tree`'s parser recovers from malformed input rather than throwing - a
 * stray `}`, an unterminated block and outright garbage all parse - so there is
 * no whole-stylesheet failure to catch here. Were it ever to throw, the
 * rejection travels out through `xmlToTemplate` and is reported on the
 * `lynx-view` error event like any other load failure.
 */
export async function convertCSSToStyleInfo(
  source: string,
): Promise<ConvertedCSS> {
  const rules: StyleInfoRule[] = [];

  // Nothing to tokenize, and therefore no reason to fetch a parser. This is not
  // just an optimisation for the empty case: `<style></style>` is a section that
  // is present but carries nothing, and it must not trigger a network request.
  if (source.trim().length === 0) {
    return { rules, discarded: [] };
  }

  const { parse, generate, walk } = await loadCSSTree();

  const ast = parse(source, {
    parseValue: false,
    parseAtrulePrelude: false,
    parseCustomProperty: false,
    parseRulePrelude: true,
    positions: false,
  }) as csstree.StyleSheet;

  for (const node of ast.children.toArray()) {
    if (node.type === 'Rule') {
      rules.push({
        type: 'StyleRule',
        sel: selectorSections(node.prelude, generate),
        decl: declarationsOf(node.block, generate),
      });
      continue;
    }

    if (node.type !== 'Atrule' || !node.block) {
      continue;
    }

    if (node.name === 'font-face') {
      rules.push({
        type: 'FontFaceRule',
        sel: [],
        decl: declarationsOf(node.block, generate),
      });
      continue;
    }

    if (node.name === 'keyframes') {
      const children: { keyText: string; decl: [string, string][] }[] = [];
      for (const step of node.block.children.toArray()) {
        if (step.type !== 'Rule') {
          continue;
        }
        children.push({
          keyText: generate(step.prelude),
          decl: declarationsOf(step.block, generate),
        });
      }
      rules.push({
        type: 'KeyframesRule',
        sel: [],
        decl: [],
        name: node.prelude ? generate(node.prelude) : '',
        children,
      });
      continue;
    }

    // Every other at-rule is dropped; see the note on that above. The report is
    // built from the source tree rather than from here so that an at-rule nested
    // inside a dropped group is accounted for too.
  }

  return { rules, discarded: diagnoseDiscardedAtRules(ast, walk) };
}
