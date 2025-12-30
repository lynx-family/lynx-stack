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
      } else if (node.type === 'KeyframesRule') {
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

          for (const decl of keyframesStyle.style) {
            keyFrameChildrenRule.push_declaration(decl.name, decl.value);
          }
          rule.push_rule_children(keyFrameChildrenRule);
        }
        rawStyleInfo.push_rule(parsedCssId, rule);
      } else if (node.type === 'FontFaceRule') {
        const rule = new Rule('FontFaceRule');
        for (const decl of node.style) {
          rule.push_declaration(decl.name, decl.value);
        }
        rawStyleInfo.push_rule(parsedCssId, rule);
      } else if (node.type === 'StyleRule') {
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
          const value = decl.value.replaceAll(
            /\{\{--([^}]+)\}\}/g,
            'var(--$1)',
          );
          rule.push_declaration(decl.name, value);
        }

        // Variables
        for (const [name, value] of Object.entries(node.variables)) {
          rule.push_declaration(name, value);
        }

        rawStyleInfo.push_rule(parsedCssId, rule);
      }
    }
  }

  return rawStyleInfo.encode();
}
