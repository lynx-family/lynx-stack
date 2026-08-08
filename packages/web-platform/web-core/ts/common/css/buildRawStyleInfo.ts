// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The `@lynx-js/css-serializer` -> `RawStyleInfo` conversion, shared by the
 * encode path and the buildless (markup card) load path.
 *
 * This used to live inline in `ts/encode/encodeCSS.ts`, which could only ever
 * run under Node: it imported the wasm classes from `binary/encode/encode.js`,
 * whose glue is `node:fs` based. The same four classes exist in the browser
 * `binary/client` build, so the conversion is expressed here against the
 * structural types below and the constructors are supplied by the caller. No
 * behaviour is attached to which build is in play.
 *
 * The two callers differ in exactly two places, both passed in as callbacks:
 *
 * - a conditional group at-rule (`@media` / `@supports` / `@layer`), which the
 *   binary format cannot represent at all - see {@link RuleType} in
 *   `raw_style_info.rs`, whose only variants are `Declaration`, `FontFace` and
 *   `KeyFrames`;
 * - an `@import` whose href is not a numeric css id, which the format also
 *   cannot represent.
 *
 * The encode path keeps its long-standing answers (ignore the former, throw on
 * the latter). A markup card cannot afford either, so it hands both to the raw
 * `content` channel instead.
 */

import * as CSS from '@lynx-js/css-serializer';

/**
 * The `binary/*` wasm surface this module needs, as structural types.
 *
 * Declared here rather than imported so that the module pulls in neither wasm
 * build: `binary/encode` is Node only and `binary/client` is fetched
 * asynchronously, and either import would tie the conversion to one of them.
 */
export interface SelectorLike {
  push_one_selector_section(selectorType: string, value: string): void;
}

export interface RulePreludeLike {
  push_selector(selector: SelectorLike): void;
}

export interface RuleLike {
  push_declaration(propertyName: string, value: string): void;
  push_rule_children(rule: RuleLike): void;
  set_prelude(prelude: RulePreludeLike): void;
}

export interface RawStyleInfoLike {
  append_import(cssId: number, importCssId: number): void;
  push_rule(cssId: number, rule: RuleLike): void;
}

/**
 * The constructors, supplied by whichever wasm build the caller loaded.
 */
export interface StyleWasm {
  Rule: new(ruleType: string) => RuleLike;
  RulePrelude: new() => RulePreludeLike;
  Selector: new() => SelectorLike;
}

/**
 * What to do with a node the binary format cannot express.
 *
 * Both are required, so that adding a caller forces a decision rather than
 * inheriting one silently.
 */
export interface UnrepresentableHandlers {
  /**
   * A `@media` / `@supports` / `@layer` group.
   */
  onGroupAtRule(
    node: CSS.MediaRule | CSS.SupportsRule | CSS.LayerRule,
  ): void;
  /**
   * An `@import` whose href does not name a numeric css id.
   */
  onNonNumericImport(node: CSS.ImportRule): void;
}

function restoreCSSVarPlaceholders(
  value: string,
  defaultValueMap?: Record<string, string>,
): string {
  return value.replaceAll(/\{\{(--[^}]+)\}\}/g, (_, varName: string) => {
    const fallback = defaultValueMap?.[varName];
    return fallback
      ? `var(${varName}, ${
        restoreCSSVarPlaceholders(fallback, defaultValueMap)
      })`
      : `var(${varName})`;
  });
}

/**
 * Undoes the `{{--name}}` placeholders `css-serializer` substitutes for `var()`.
 *
 * The placeholder form is that package's own interchange shape, not CSS: left in
 * place a declaration would reach the engine as the literal text
 * `background-color:{{--accent}}`.
 */
export function restoreCSSVarValue(decl: CSS.Declaration): string {
  const isCSSVarDecl = 'type' in decl && decl.type === 'css_var';

  return restoreCSSVarPlaceholders(
    decl.value,
    isCSSVarDecl ? decl.defaultValueMap : undefined,
  );
}

/**
 * Pushes the sections of a selector list onto a prelude.
 *
 * `css-serializer` reports a rule's selector as `StyleRule.selectorText`, one
 * flat string, so it has to be parsed again to recover the addressable sections.
 * The `{ --mocked-declaration:1; }` block is there only to make the selector a
 * syntactically complete rule for the parser.
 */
function pushSelectors(
  prelude: RulePreludeLike,
  wasm: StyleWasm,
  selectorText: string,
): void {
  const ast = CSS.csstree.parse(
    `${selectorText}{ --mocked-declaration:1;}`,
  ) as CSS.csstree.StyleSheet;

  const selectorList = (ast.children.first as CSS.csstree.Rule)
    .prelude as CSS.csstree.SelectorList;

  for (
    const selectorNode of selectorList.children
      .toArray() as CSS.csstree.Selector[]
  ) {
    const selector = new wasm.Selector();
    for (const child of selectorNode.children.toArray()) {
      if (child.type === 'AttributeSelector') {
        selector.push_one_selector_section(
          child.type,
          CSS.csstree.generate(child),
        );
        continue;
      }
      if (child.type === 'PseudoClassSelector') {
        selector.push_one_selector_section(
          child.type,
          CSS.csstree.generate(child).slice(1),
        );
        continue;
      }
      // @ts-expect-error not every selector child carries a name
      if (!child.name) {
        throw new Error(
          `Selector section of type ${child.type} is missing a name/value.`,
        );
      }
      selector.push_one_selector_section(
        child.type,
        // @ts-expect-error guarded above
        child.name as string,
      );
    }
    prelude.push_selector(selector);
  }
}

/**
 * Converts one stylesheet's nodes into rules on `rawStyleInfo`, under `cssId`.
 *
 * Nodes are visited in the order given, and every node either becomes a rule or
 * is handed to a {@link UnrepresentableHandlers} callback, so nothing is dropped
 * without the caller having said so.
 */
export function pushStyleNodes(
  rawStyleInfo: RawStyleInfoLike,
  wasm: StyleWasm,
  cssId: number,
  nodes: CSS.LynxStyleNode[],
  handlers: UnrepresentableHandlers,
): void {
  for (const node of nodes) {
    if (node.type === 'ImportRule') {
      const href = node.href.startsWith('/') ? node.href.slice(1) : node.href;
      const importCssId = Number(href);
      if (isNaN(importCssId)) {
        handlers.onNonNumericImport(node);
      } else {
        rawStyleInfo.append_import(cssId, importCssId);
      }
    } else if (node.type === 'KeyframesRule') {
      const rule = new wasm.Rule('KeyframesRule');

      const keyframeNamePrelude = new wasm.RulePrelude();
      const keyFrameNameSelector = new wasm.Selector();
      keyFrameNameSelector.push_one_selector_section(
        'UnknownText',
        node.name.value,
      );
      keyframeNamePrelude.push_selector(keyFrameNameSelector);
      rule.set_prelude(keyframeNamePrelude);

      for (const keyframesStyle of node.styles) {
        const keyFrameChildrenRule = new wasm.Rule('StyleRule');
        const prelude = new wasm.RulePrelude();

        const selector = new wasm.Selector();
        selector.push_one_selector_section(
          'UnknownText',
          keyframesStyle.keyText.value,
        );
        prelude.push_selector(selector);

        keyFrameChildrenRule.set_prelude(prelude);

        for (
          const [key, value] of Object.entries(keyframesStyle.variables ?? {})
        ) {
          keyFrameChildrenRule.push_declaration(key, value);
        }

        for (const decl of keyframesStyle.style) {
          keyFrameChildrenRule.push_declaration(
            decl.name,
            restoreCSSVarValue(decl),
          );
        }
        rule.push_rule_children(keyFrameChildrenRule);
      }
      rawStyleInfo.push_rule(cssId, rule);
    } else if (node.type === 'FontFaceRule') {
      const rule = new wasm.Rule('FontFaceRule');
      for (const decl of node.style) {
        rule.push_declaration(decl.name, restoreCSSVarValue(decl));
      }
      rawStyleInfo.push_rule(cssId, rule);
    } else if (node.type === 'StyleRule') {
      const rule = new wasm.Rule('StyleRule');

      const prelude = new wasm.RulePrelude();
      pushSelectors(prelude, wasm, node.selectorText.value);
      rule.set_prelude(prelude);

      // Declarations
      for (const decl of node.style) {
        rule.push_declaration(decl.name, restoreCSSVarValue(decl));
      }

      // Variables
      for (const [name, value] of Object.entries(node.variables)) {
        rule.push_declaration(name, value);
      }

      rawStyleInfo.push_rule(cssId, rule);
    } else {
      handlers.onGroupAtRule(node);
    }
  }
}
