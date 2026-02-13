// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../../main.js';

describe('Parse Inline Style', () => {
  it('should fallback to SetInlineStyles when have unknown CSS property', async () => {
    const result = await transformReactLynx(
      `<view style="height:100px;invalid:true;width: 200px"/>`,
    );
    // Should not have `__AddInlineStyle`
    expect(result.code).not.toContain(`__AddInlineStyle`);
    // Should have __SetInlineStyles(element, "height:100px;invalid:true;width: 200px")
    expect(result.code).toContain('height:100px;invalid:true;width: 200px');
    expect(result.warnings).toEqual([]);
  });

  it('should fallback to SetInlineStyles when parse CSS value failed', async () => {
    const result = await transformReactLynx(
      `<view style="height:100px;width:     ;  ;color: #0f0f0f"/>`,
    );
    // Should not have `__AddInlineStyle`
    expect(result.code).not.toContain(`__AddInlineStyle`);
    // Should have __SetInlineStyles(element, "height:100px;width:     ;  ;color: #0f0f0f")
    expect(result.code).toContain('height:100px;width:     ;  ;color: #0f0f0f');
    expect(result.warnings).toEqual([]);
  });

  it('should fallback to SetInlineStyles when parse CSS failed', async () => {
    const result = await transformReactLynx(
      `<view style="?*xxxxxxx;foo bar;"/>`,
    );
    // Should not have `__AddInlineStyle`
    expect(result.code).not.toContain(`__AddInlineStyle`);

    // Should have __SetInlineStyles(element, "?*xxxxxxx;foo bar;")
    expect(result.code).toContain('?*xxxxxxx;foo bar;');
    expect(result.warnings).toEqual([]);
  });
});
