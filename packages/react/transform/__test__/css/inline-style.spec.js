// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { swcPluginReactLynx, transformReactLynx } from '../../main.js';

describe('Parse Inline Style', () => {
  it('should fallback to SetInlineStyles when have unknown CSS property', () => {
    const result = transformReactLynx(
      `<view style="height:100px;invalid:true;width: 200px"/>`,
      [[swcPluginReactLynx, {}]],
    );
    // Should not have `__AddInlineStyle`
    expect(result.code).not.toContain(`__AddInlineStyle`);
    // Should have __SetInlineStyles(element, "height:100px;invalid:true;width: 200px")
    expect(result.code).toContain('height:100px;invalid:true;width: 200px');
  });

  it('should fallback to SetInlineStyles when parse CSS value failed', () => {
    const result = transformReactLynx(
      `<view style="height:100px;width:     ;  ;color: #0f0f0f"/>`,
      [[swcPluginReactLynx, {}]],
    );
    // Should not have `__AddInlineStyle`
    expect(result.code).not.toContain(`__AddInlineStyle`);
    // Should have __SetInlineStyles(element, "height:100px;width:     ;  ;color: #0f0f0f")
    expect(result.code).toContain('height:100px;width:     ;  ;color: #0f0f0f');
  });

  it('should fallback to SetInlineStyles when parse CSS failed', () => {
    const result = transformReactLynx(
      `<view style="?*xxxxxxx;foo bar;"/>`,
      [[swcPluginReactLynx, {}]],
    );
    // Should not have `__AddInlineStyle`
    expect(result.code).not.toContain(`__AddInlineStyle`);

    // Should have __SetInlineStyles(element, "?*xxxxxxx;foo bar;")
    expect(result.code).toContain('?*xxxxxxx;foo bar;');
  });
});
