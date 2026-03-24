import type { Selector } from '../../encode/encodeCSS.js';
import type { RawStyleInfo } from '../../server/wasm.js';
import { wasmInstance } from '../wasm.js';

interface CSSRule {
  sel: string[][][];
  decl: [string, string][];
}

interface OneInfo {
  content: string[];
  rules: CSSRule[];
  imports?: string[];
}

type StyleInfo = Record<string, OneInfo>;

export function loadStyleFromJSON(
  styleInfo: StyleInfo,
  configEnableCSSSelector: boolean,
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

      // Selectors
      const prelude = new wasmInstance.RulePrelude();
      for (const selectorChain of rule.sel) {
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
      wasmRule.set_prelude(prelude);
      rawStyleInfo.push_rule(cssId, wasmRule);
    }
  }

  return wasmInstance.encode_legacy_json_generated_raw_style_info(
    rawStyleInfo,
    configEnableCSSSelector,
    entryName,
  );
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
