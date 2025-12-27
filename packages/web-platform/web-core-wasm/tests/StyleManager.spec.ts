// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { encodeCSS } from '../ts/encode/encodeCSS.js';
import { DecodedStyle } from '../ts/client/wasm.js';
import * as CSS from '@lynx-js/css-serializer';

vi.mock('wasm-feature-detect', () => ({
  referenceTypes: async () => true,
}));

describe('StyleManager', () => {
  let rootNode: HTMLElement;
  let styleManager: any;
  let StyleManager: any;

  beforeAll(async () => {
    const module = await import('../ts/client/mainthread/StyleManager.js');
    StyleManager = module.StyleManager;
  });

  beforeEach(() => {
    rootNode = document.createElement('div');
    document.body.appendChild(rootNode);
  });

  it('should create StyleManager', () => {
    styleManager = new StyleManager(rootNode);
    expect(styleManager).toBeDefined();
  });

  it('should push style sheet in CSS Selector mode', () => {
    styleManager = new StyleManager(rootNode);
    const encoded = encodeCSS({
      '0': CSS.parse(`
      .test {
        color: red;
      }
    `).root,
    });
    const decodedStyle = new DecodedStyle(
      DecodedStyle.webWorkerDecode(encoded, true, undefined),
    );
    styleManager.pushStyleSheet(decodedStyle);

    const styleElement = rootNode.querySelector('style');
    expect(styleElement).not.toBeNull();
    expect(styleElement?.textContent).toContain('.test');
    expect(styleElement?.textContent).toContain('color:red');
  });

  it('should push style sheet and populate map in Non-CSS Selector mode', () => {
    styleManager = new StyleManager(rootNode);
    const encoded = encodeCSS({
      '0': CSS.parse(`
      .test-class {
        color: red;
        width: 100px;
      }
    `).root,
    });

    const decodedStyle = new DecodedStyle(
      DecodedStyle.webWorkerDecode(encoded, false),
    );

    styleManager.pushStyleSheet(decodedStyle, 'entry1');
  });

  it('should update styles in Non-CSS Selector mode', () => {
    styleManager = new StyleManager(rootNode);

    // Setup style info
    const encoded = encodeCSS({
      '0': CSS.parse(`
      .test-class {
        color: red;
        width: 100px;
      }
    `).root,
    });

    const decodedStyle = new DecodedStyle(
      DecodedStyle.webWorkerDecode(encoded, false, 'entry1'),
    );

    styleManager.pushStyleSheet(decodedStyle, 'entry1');

    // updateCssOgStyle
    // Signature: updateCssOgStyle(uniqueId, cssId, classNames, entryName)
    // We pass array as classNames, which has forEach.
    styleManager.updateCssOgStyle(1, 0, ['test-class'] as any, 'entry1');

    // Check if rule was inserted
    const styleElements = rootNode.querySelectorAll('style');
    const styleElement = styleElements[styleElements.length - 1];
    const sheet = styleElement?.sheet;
    expect(sheet).toBeDefined();
    if (sheet) {
      expect(sheet.cssRules.length).toBe(1);
      const rule = sheet.cssRules[0] as CSSStyleRule;
      expect(rule.selectorText).toBe('[l-uid="1"]');
      // The implementation joins declarations: finalDeclarations.join('')
      // 'color: red; width: 100px;'
      expect(rule.style.color).toBe('red');
      expect(rule.style.width).toBe('100px');
    }

    // Update again
    styleManager.updateCssOgStyle(1, 0, ['test-class'] as any, 'entry1');
    // Should update existing rule
    if (sheet) {
      expect(sheet.cssRules.length).toBe(1);
    }
  });
});
