/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { createElementAPI, type SSRBinding } from '../ts/server/index.js';
import { MainThreadServerContext } from '../ts/server/wasm.js';

describe('Server SSR', () => {
  it('should generate html correctly', () => {
    const binding: SSRBinding = {
      ssrResult: '',
    };
    const config = {
      enableCSSSelector: true,
      defaultOverflowVisible: false,
      defaultDisplayLinear: true,
    };
    const { globalThisAPIs: api } = createElementAPI(
      binding,
      undefined,
      '',
      config,
    );

    // Create Page
    const page = api.__CreatePage('0', 0);
    // Add content to page
    const view = api.__CreateElement('view', 0);
    api.__SetAttribute(view, 'id', 'main');
    api.__SetInlineStyles(view, 'color: red;');
    api.__AppendElement(page, view);

    // Create text
    const text = api.__CreateRawText('Hello World');
    api.__AppendElement(view, text);

    // Flush to generate HTML
    api.__FlushElementTree();

    // Retrieve result
    const html = binding.ssrResult;

    // Debug output
    console.log('Generated HTML:', html);

    expect(html).toContain('<div part="page"');
    expect(html).toContain('<x-view');
    expect(html).toContain('id="main"');
    expect(html).toContain('color:red');
    expect(html).toContain('<raw-text');
    expect(html).toContain('text="Hello World"');
    expect(html).toContain('</x-view>');
    expect(html).toContain('</div>');
  });

  it('should handle attributes and styles', () => {
    const binding: any = {};
    const config = { enableCSSSelector: true };
    const { globalThisAPIs: api, wasmContext: wasmCtx } = createElementAPI(
      binding,
      undefined,
      '',
      config,
    );

    const el = api.__CreateElement('image', 0);
    api.__SetAttribute(el, 'src', 'http://example.com/img.png');
    api.__AddInlineStyle(el, 'width', '100px');
    api.__AddInlineStyle(el, 'height', '100px');

    const uid = api.__GetElementUniqueID(el);
    const html = wasmCtx.generate_html(uid);

    console.log('Image HTML:', html);

    expect(html).toContain('<x-image');
    expect(html).toContain('src="http://example.com/img.png"');
    expect(html).toContain('width:100px;');
    expect(html).toContain('height:100px;');
  });

  it('should transform styles', () => {
    const binding: SSRBinding = {
      ssrResult: '',
    };
    const config = {
      enableCSSSelector: true,
      defaultOverflowVisible: false,
      defaultDisplayLinear: true,
    };
    const { globalThisAPIs: api, wasmContext: wasmCtx } = createElementAPI(
      binding,
      undefined,
      '',
      config,
    );

    const el = api.__CreateElement('view', 0);
    // Test key-value transformation
    api.__AddInlineStyle(el, 'flex', '1');

    const uid = api.__GetElementUniqueID(el);
    let html = wasmCtx.generate_html(uid);
    // Check key-value transform (flex -> --flex)
    expect(html).toContain('--flex:1');

    // Test string transformation
    const el2 = api.__CreateElement('view', 0);
    api.__SetAttribute(el2, 'style', 'linear-layout-gravity: right;');

    const uid2 = api.__GetElementUniqueID(el2);
    html = wasmCtx.generate_html(uid2);

    // Check string transform (linear-layout-gravity -> --align-self-column:end)
    expect(html).toContain('--align-self-column:end');
  });

  it('should infer css id from parent component in SSR', () => {
    const binding: SSRBinding = {
      ssrResult: '',
    };
    const config = {
      enableCSSSelector: true,
      defaultOverflowVisible: false,
      defaultDisplayLinear: true,
    };
    const { globalThisAPIs: api, wasmContext: wasmCtx } = createElementAPI(
      binding,
      undefined,
      '',
      config,
    );

    const root = api.__CreatePage('page', 0);
    const parentComponent = api.__CreateComponent(
      api.__GetElementUniqueID(root),
      'id',
      100,
      'test_entry',
      'name',
    );
    const parentComponentUniqueId = api.__GetElementUniqueID(parentComponent);
    const view = api.__CreateElement('view', parentComponentUniqueId);

    api.__AppendElement(parentComponent, view);
    api.__AppendElement(root, parentComponent);

    const viewUid = api.__GetElementUniqueID(view);
    const html = wasmCtx.generate_html(viewUid);

    expect(html).toContain('l-css-id="100"');
  });

  it('should not infer css id if parent css id is 0 in SSR', () => {
    const binding: SSRBinding = {
      ssrResult: '',
    };
    const config = {
      enableCSSSelector: true,
      defaultOverflowVisible: false,
      defaultDisplayLinear: true,
    };
    const { globalThisAPIs: api, wasmContext: wasmCtx } = createElementAPI(
      binding,
      undefined,
      '',
      config,
    );

    const root = api.__CreatePage('page', 0);
    const parentComponent = api.__CreateComponent(
      api.__GetElementUniqueID(root),
      'id',
      0,
      'test_entry',
      'name',
    );
    const parentComponentUniqueId = api.__GetElementUniqueID(parentComponent);
    const view = api.__CreateElement('view', parentComponentUniqueId);

    api.__AppendElement(parentComponent, view);
    api.__AppendElement(root, parentComponent);

    const viewUid = api.__GetElementUniqueID(view);
    const html = wasmCtx.generate_html(viewUid);

    expect(html).not.toContain('l-css-id');
  });
});
