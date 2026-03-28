import { describe, it, expect, vi } from 'vitest';

vi.mock('../css/in_shadow.css?inline', () => ({
  default: '/* INJECTED_SHADOW_CSS_BULK */',
}));

import { createElementAPI, type SSRBinding } from '../ts/server/index.js';

describe('Server SSR Bulk Styles', () => {
  it('should handle object-based SetInlineStyles', () => {
    const binding: SSRBinding = { ssrResult: '' };
    const config = { enableCSSSelector: true };
    const { globalThisAPIs: api, wasmContext: wasmCtx } = createElementAPI(
      binding,
      undefined,
      '',
      config as any,
    );

    const el = api.__CreateElement('view', 0);
    api.__SetAttribute(el, 'id', 'test-bulk');

    // Test object-based SetInlineStyles
    api.__SetInlineStyles(el, {
      'color': 'red',
      'font-size': '16px',
      'margin-top': '10px',
    });

    const uid = api.__GetElementUniqueID(el);
    const html = wasmCtx.generate_html(uid);

    console.log('Bulk Style HTML:', html);

    expect(html).toContain('color:red;');
    expect(html).toContain('font-size:16px;');
    expect(html).toContain('margin-top:10px;');
  });

  it('should handle numeric values in SetInlineStyles', () => {
    const binding: SSRBinding = { ssrResult: '' };
    const config = { enableCSSSelector: true };
    const { globalThisAPIs: api, wasmContext: wasmCtx } = createElementAPI(
      binding,
      undefined,
      '',
      config as any,
    );

    const el = api.__CreateElement('view', 0);

    // Test object-based with numbers (should be converted to string by TS binding)
    api.__SetInlineStyles(el, {
      'flex': 1 as any,
      'opacity': 0.5 as any,
    });

    const uid = api.__GetElementUniqueID(el);
    const html = wasmCtx.generate_html(uid);

    console.log('Bulk Style Numeric HTML:', html);

    // flex: 1 might be transformed to --flex:1 or similar, but let's check basic presence
    expect(html).toContain(':1');
    expect(html).toContain(':0.5');
  });
});
