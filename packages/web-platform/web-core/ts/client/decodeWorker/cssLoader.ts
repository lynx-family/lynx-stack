import type { Selector } from '../../encode/encodeCSS.js';
import type { RawStyleInfo } from '../../server/wasm.js';
import type {
  OrderedStyleEntry,
  StyleInfoRule,
} from '../../common/xml/cssToStyleInfo.js';
import { wasmInstance } from '../wasm.js';

interface CSSRule {
  sel: string[][][];
  decl: [string, string][];
}

interface OneInfo {
  content: string[];
  rules: CSSRule[];
  imports?: string[];
  /**
   * Stylesheet entries in document order, mixing tokenized rules and verbatim
   * CSS.
   *
   * Set only by the buildless XML path, whose stylesheet cannot be expressed by
   * `content` / `rules` alone: those two are drained one after the other, which
   * would hoist every verbatim fragment ahead of every tokenized rule and so
   * reorder the cascade. When present, `content` and `rules` are ignored for
   * this stylesheet.
   */
  ordered?: OrderedStyleEntry[];
}

type StyleInfo = Record<string, OneInfo>;

export function loadStyleFromJSON(
  styleInfo: StyleInfo,
  configEnableCSSSelector: boolean,
  transformVW: boolean,
  transformVH: boolean,
  transformREM: boolean,
  entryName?: string,
): Uint8Array {
  const rawStyleInfo = new wasmInstance.RawStyleInfo();

  for (const [cssIdStr, info] of Object.entries(styleInfo)) {
    const cssId = parseInt(cssIdStr, 10);

    // Handle imports
    if (info.imports) {
      info.imports.forEach(importIdStr => {
        const importId = parseInt(importIdStr, 10);
        if (!isNaN(importId)) {
          rawStyleInfo.append_import(cssId, importId);
        }
      });
    }

    if (info.ordered) {
      // Document order is significant, so entries are replayed one by one
      // rather than per channel.
      for (const entry of info.ordered) {
        if (entry.channel === 'verbatim') {
          const text = entry.text.trim();
          if (text.length > 0) {
            parseAndPushContentRules(rawStyleInfo, cssId, text);
          }
        } else {
          pushTokenizedRule(rawStyleInfo, cssId, entry.rule);
        }
      }
      continue;
    }

    if (info.content) {
      const contentStr = info.content.join('\n').trim();
      if (contentStr.length > 0) {
        parseAndPushContentRules(rawStyleInfo, cssId, contentStr);
      }
    }

    // Handle rules
    for (const rule of info.rules) {
      const wasmRule = new wasmInstance.Rule('StyleRule');

      // Declarations
      for (const [prop, val] of rule.decl) {
        wasmRule.push_declaration(prop, val);
      }

      wasmRule.set_prelude(buildPrelude(rule.sel));
      rawStyleInfo.push_rule(cssId, wasmRule);
    }
  }

  return wasmInstance.encode_legacy_json_generated_raw_style_info(
    rawStyleInfo,
    configEnableCSSSelector,
    entryName,
    transformVW,
    transformVH,
    transformREM,
  );
}

/**
 * Builds a rule prelude from the `sel` wire shape: a list of selectors, each a
 * flat list of `[plain, pseudoClass, pseudoElement, combinator]` groups.
 */
function buildPrelude(sel: string[][][]) {
  const prelude = new wasmInstance.RulePrelude();
  for (const selectorChain of sel) {
    const selector = new wasmInstance.Selector();

    // Iterate in chunks of 4
    for (let i = 0; i < selectorChain.length; i += 4) {
      const plain = selectorChain[i] || [];
      const pseudoClass = selectorChain[i + 1] || [];
      const pseudoElement = selectorChain[i + 2] || [];
      const combinator = selectorChain[i + 3] || [];

      for (const s of plain) {
        parseAndPushSelector(selector, s);
      }
      for (const s of pseudoClass) {
        if (s === '::part(input)::placeholder') {
          selector.push_one_selector_section(
            'PseudoElementSelector',
            'placeholder',
          );
        } else {
          // Strip leading :
          const val = s.startsWith(':') ? s.substring(1) : s;
          selector.push_one_selector_section('PseudoClassSelector', val);
        }
      }
      for (const s of pseudoElement) {
        // Strip leading ::
        const val = s.startsWith('::')
          ? s.substring(2)
          : s.startsWith(':')
          ? s.substring(1)
          : s;
        selector.push_one_selector_section('PseudoElementSelector', val);
      }
      if (combinator.length > 0) {
        selector.push_one_selector_section('Combinator', combinator[0]!);
      }
    }
    prelude.push_selector(selector);
  }
  return prelude;
}

/**
 * Pushes one rule of an ordered (buildless) stylesheet.
 *
 * Unlike the `rules` channel, which only ever carries style rules, a
 * hand-written stylesheet can also declare `@keyframes` and `@font-face`, both
 * of which the binary format represents natively.
 */
function pushTokenizedRule(
  rawStyleInfo: RawStyleInfo,
  cssId: number,
  rule: StyleInfoRule,
) {
  const wasmRule = new wasmInstance.Rule(rule.type);

  if (rule.type === 'KeyframesRule') {
    // A keyframes rule carries its name as a bare prelude text and its steps as
    // nested rules, matching `encode/encodeCSS.ts`.
    const prelude = new wasmInstance.RulePrelude();
    const nameSelector = new wasmInstance.Selector();
    nameSelector.push_one_selector_section('UnknownText', rule.name ?? '');
    prelude.push_selector(nameSelector);
    wasmRule.set_prelude(prelude);

    for (const step of rule.children ?? []) {
      const stepRule = new wasmInstance.Rule('StyleRule');
      const stepPrelude = new wasmInstance.RulePrelude();
      const stepSelector = new wasmInstance.Selector();
      stepSelector.push_one_selector_section('UnknownText', step.keyText);
      stepPrelude.push_selector(stepSelector);
      stepRule.set_prelude(stepPrelude);
      for (const [prop, val] of step.decl) {
        stepRule.push_declaration(prop, val);
      }
      wasmRule.push_rule_children(stepRule);
    }
    rawStyleInfo.push_rule(cssId, wasmRule);
    return;
  }

  for (const [prop, val] of rule.decl) {
    wasmRule.push_declaration(prop, val);
  }
  // `@font-face` has no prelude; a style rule always does.
  if (rule.type === 'StyleRule') {
    wasmRule.set_prelude(buildPrelude(rule.sel ?? []));
  }
  rawStyleInfo.push_rule(cssId, wasmRule);
}

function parseAndPushSelector(selector: Selector, s: string) {
  if (s.startsWith('.')) {
    selector.push_one_selector_section('ClassSelector', s.substring(1));
  } else if (s.startsWith('#')) {
    selector.push_one_selector_section('IdSelector', s.substring(1));
  } else if (
    s.startsWith('[') && s.startsWith('[lynx-tag=') && s.endsWith(']')
  ) {
    // Handling [lynx-tag="tag_name"] or [lynx-tag='tag_name'] or [lynx-tag=tag_name]
    let tag = s.substring('[lynx-tag='.length, s.length - 1);
    if (
      (tag.startsWith('"') && tag.endsWith('"'))
      || (tag.startsWith('\'') && tag.endsWith('\''))
    ) {
      tag = tag.substring(1, tag.length - 1);
    }
    if (tag === 'page') {
      selector.push_one_selector_section('AttributeSelector', 'part="page"');
    } else {
      const typeName = tag.includes('-') ? tag : `x-${tag}`;
      selector.push_one_selector_section('TypeSelector', typeName);
    }
  } else if (s.startsWith('[')) {
    // Attribute: [attr=val]
    // Remove enclosing []
    const content = s.substring(1, s.length - 1);
    selector.push_one_selector_section('AttributeSelector', content);
  } else if (s === '*') {
    selector.push_one_selector_section('UniversalSelector', '*');
  } else {
    selector.push_one_selector_section('TypeSelector', s);
  }
}

function parseAndPushContentRules(
  rawStyleInfo: RawStyleInfo,
  cssId: number,
  content: string,
) {
  const rule = new wasmInstance.Rule('StyleRule');
  const prelude = new wasmInstance.RulePrelude();
  const selector = new wasmInstance.Selector();
  selector.push_one_selector_section('UnknownText', '{}' + content); // this is a hack We put it into selector section and use a {} to make the prior part be a valid rule (`{}` means corresponding block)
  prelude.push_selector(selector);
  rule.set_prelude(prelude);
  rawStyleInfo.push_rule(cssId, rule);
}
