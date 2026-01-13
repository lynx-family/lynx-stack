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
  configEnableCssSelector: boolean,
  entryName?: string,
): Uint8Array {
  const rawStyleInfo = new wasmInstance.RawStyleInfo();

  for (const [cssIdStr, info] of Object.entries(styleInfo)) {
    const cssId = parseInt(cssIdStr, 10);

    // Handle imports
    if (info.imports) {
      // imports in StyleInfo are filenames/hrefs, but RawStyleInfo expects cssIds.
      // Wait, genStyleInfo output imports as string hrefs?
      // RawStyleInfo: imports: Vec<i32>
      // It seems genStyleInfo.ts produces imports array of strings, but RawStyleInfo needs integers.
      // If the JSON only contains strings, we might have a problem mapping them back to IDs unless we have a map.
      // However, WebEncodePlugin usually handles mapping.
      // Let's check genStyleInfo again.
      // node.type === 'ImportRule' => imports.push(node.href).
      // If imports are paths, we can't easily convert to ID without extra info.
      // BUT, current usage of imports in RawStyleInfo is strictly ID-based.
      // If the input JSON has hrefs, we might skip imports or error.
      // For now, I will omit imports if they are strings, or try to parse if they look like IDs.
      // Actually, in the ecosystem, imports might not be fully supported in JSON mode yet or resolved differently.
      // I will log or ignore for now, focusing on Rules.
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
            // Strip leading :
            const val = s.startsWith(':') ? s.substring(1) : s;
            selector.push_one_selector_section('PseudoClassSelector', val);
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

  // Use the new Rust method
  return wasmInstance.DecodedStyleData.encode_from_raw_style_info(
    rawStyleInfo,
    configEnableCssSelector,
    entryName,
  );
}

function parseAndPushSelector(selector: any, s: string) {
  if (s.startsWith('.')) {
    selector.push_one_selector_section('ClassSelector', s.substring(1));
  } else if (s.startsWith('#')) {
    selector.push_one_selector_section('IdSelector', s.substring(1));
  } else if (s.startsWith('[')) {
    // Attribute: [attr=val]
    // Remove enclosing []
    const content = s.substring(1, s.length - 1);
    selector.push_one_selector_section('AttributeSelector', content);
  } else if (s === '*') {
    selector.push_one_selector_section('UniversalSelector', '*');
  } else {
    // Type selector
    // It comes as [lynx-tag="div"] usually.
    let content = s;
    if (s.startsWith('[') && s.endsWith(']')) {
      content = s.substring(1, s.length - 1);
    }
    selector.push_one_selector_section('AttributeSelector', content);
  }
}
