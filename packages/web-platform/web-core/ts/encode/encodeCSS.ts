import * as CSS from '@lynx-js/css-serializer';
import {
  RawStyleInfo,
  Rule,
  Selector,
  RulePrelude,
  // @ts-ignore
} from '../../binary/encode/encode.js';
// @ts-ignore
export * from '../../binary/encode/encode.js';

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

function restoreCSSVarValue(decl: CSS.Declaration): string {
  const isCSSVarDecl = 'type' in decl && decl.type === 'css_var';

  return restoreCSSVarPlaceholders(
    decl.value,
    isCSSVarDecl ? decl.defaultValueMap : undefined,
  );
}

function encodeKeyframesRule(node: CSS.KeyframesRule): Rule {
  const rule = new Rule('KeyframesRule');

  const keyframeNamePrelude = new RulePrelude();
  const keyFrameNameSelector = new Selector();
  const keyFrameName = node.name.value;
  keyFrameNameSelector.push_one_selector_section(
    'UnknownText',
    keyFrameName,
  );
  keyframeNamePrelude.push_selector(keyFrameNameSelector);
  rule.set_prelude(keyframeNamePrelude);

  for (const keyframesStyle of node.styles) {
    const keyFrameChildrenRule = new Rule('StyleRule');
    const prelude = new RulePrelude();

    const selector = new Selector();
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
  return rule;
}

function encodeFontFaceRule(node: CSS.FontFaceRule): Rule {
  const rule = new Rule('FontFaceRule');
  for (const decl of node.style) {
    rule.push_declaration(decl.name, restoreCSSVarValue(decl));
  }
  return rule;
}

function encodeStyleRule(node: CSS.StyleRule): Rule {
  const rule = new Rule('StyleRule');

  const prelude = new RulePrelude();

  // Parse selectors
  const ast = CSS.csstree.parse(
    `${node.selectorText.value}{ --mocked-declaration:1;}`,
  ) as CSS.csstree.StyleSheet;

  const selectorList = (ast.children.first as CSS.csstree.Rule)
    .prelude as CSS.csstree.SelectorList;

  for (
    const selectorNode of selectorList.children
      .toArray() as CSS.csstree.Selector[]
  ) {
    const selector = new Selector();
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
      // @ts-expect-error
      if (!child.name) {
        throw new Error(
          `Selector section of type ${child.type} is missing a name/value.`,
        );
      }
      selector.push_one_selector_section(
        child.type,
        // @ts-expect-error
        child.name as string,
      );
    }
    prelude.push_selector(selector);
  }

  rule.set_prelude(prelude);

  // Declarations
  for (const decl of node.style) {
    rule.push_declaration(decl.name, restoreCSSVarValue(decl));
  }

  // Variables
  for (const [name, value] of Object.entries(node.variables)) {
    rule.push_declaration(name, value);
  }

  return rule;
}

/**
 * `@media` is carried as a `MediaRule` whose prelude is the query list, kept
 * verbatim as one `UnknownText` section, and whose nested rules are encoded
 * like top-level ones. The web runtime emits it as a native `@media` block, so
 * the browser evaluates it against the viewport.
 */
function encodeMediaRule(node: CSS.MediaRule): Rule {
  const rule = new Rule('MediaRule');
  const prelude = new RulePrelude();
  const selector = new Selector();
  selector.push_one_selector_section('UnknownText', node.prelude.value);
  prelude.push_selector(selector);
  rule.set_prelude(prelude);
  for (const child of node.rules) {
    const childRule = encodeRule(child);
    if (childRule) {
      rule.push_rule_children(childRule);
    }
  }
  return rule;
}

/**
 * Encodes one rule, or returns `undefined` for a rule kind the style format
 * cannot carry (`@supports`, `@layer`, and `@import`, which only exists at the
 * top level of a stylesheet).
 */
function encodeRule(node: CSS.LynxStyleNode): Rule | undefined {
  switch (node.type) {
    case 'KeyframesRule':
      return encodeKeyframesRule(node);
    case 'FontFaceRule':
      return encodeFontFaceRule(node);
    case 'StyleRule':
      return encodeStyleRule(node);
    case 'MediaRule':
      return encodeMediaRule(node);
    default:
      return undefined;
  }
}

export function encodeCSS(
  cssMap: Record<string, CSS.LynxStyleNode[]>,
): Uint8Array {
  const rawStyleInfo = new RawStyleInfo();

  for (const [cssId, nodes] of Object.entries(cssMap)) {
    const parsedCssId = Number(cssId);
    if (isNaN(parsedCssId)) {
      throw new Error(
        `Invalid cssId: ${cssId}. cssId should be a valid number string.`,
      );
    }

    for (const node of nodes) {
      if (node.type === 'ImportRule') {
        const href = node.href.startsWith('/') ? node.href.slice(1) : node.href;
        const importCssId = Number(href);
        if (isNaN(importCssId)) {
          throw new Error(
            `Invalid importCssId: ${node.href}. importCssId should be a valid number string.`,
          );
        } else {
          rawStyleInfo.append_import(parsedCssId, importCssId);
        }
      } else {
        const rule = encodeRule(node);
        if (rule) {
          rawStyleInfo.push_rule(parsedCssId, rule);
        }
      }
    }
  }

  return rawStyleInfo.encode();
}
