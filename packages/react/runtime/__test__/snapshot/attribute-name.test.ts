// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it } from 'vitest';

import { isEventPropKey, isNamespacedEventPropKey, transformAttrName } from '../../src/shared/attribute-name.js';

afterEach(() => {
  globalThis.__EXPERIMENTAL_TRANSFORM_BUILTIN_ATTRIBUTE_NAMES__ = false;
});

describe('transformAttrName', () => {
  it('identifies event prop keys', () => {
    expect(isEventPropKey('bindtap')).toBe(true);
    expect(isEventPropKey('bindTap')).toBe(true);
    expect(isEventPropKey('onClick')).toBe(false);
  });

  it('identifies namespaced event prop keys', () => {
    expect(isNamespacedEventPropKey('foo:bindtap')).toBe(true);
    expect(isNamespacedEventPropKey('foo:bindTap')).toBe(true);
    expect(isNamespacedEventPropKey('foo:text-maxline')).toBe(false);
  });

  it('does not transform names when the feature is disabled', () => {
    expect(transformAttrName('textMaxline')).toBe('textMaxline');
    expect(transformAttrName('bindtap')).toBe('bindtap');
  });

  it('applies the default builtin and event mappings', () => {
    globalThis.__EXPERIMENTAL_TRANSFORM_BUILTIN_ATTRIBUTE_NAMES__ = true;

    expect(transformAttrName('bindTap')).toBe('bindTap');
    expect(transformAttrName('onClick')).toBe('bindtap');
    expect(transformAttrName('onCatchTap')).toBe('catchtap');
    expect(transformAttrName('onReady')).toBe('bindready');
    expect(transformAttrName('onTouchStart')).toBe('bindtouchstart');
    expect(transformAttrName('textMaxline')).toBe('text-maxline');
    expect(transformAttrName('XMLValue')).toBe('x-m-l-value');
    expect(transformAttrName('autoplay')).toBe('autoplay');
  });

  it('does not treat invalid React-style event names as events', () => {
    globalThis.__EXPERIMENTAL_TRANSFORM_BUILTIN_ATTRIBUTE_NAMES__ = true;

    expect(transformAttrName('onclick')).toBe('onclick');
    expect(transformAttrName('on')).toBe('on');
    expect(transformAttrName('onTap1')).toBe('on-tap1');
    expect(transformAttrName('readyState')).toBe('ready-state');
  });

  it('applies custom rules in rename, preserve, then mode order', () => {
    const config = {
      mode: 'dash-case' as const,
      preserve: ['tailColorConvert', 'textMaxline'],
      rename: {
        handleTap: 'bindtap',
        textMaxline: 'custom-maxline',
      },
    };
    globalThis.__EXPERIMENTAL_TRANSFORM_BUILTIN_ATTRIBUTE_NAMES__ = config;

    expect(transformAttrName('textMaxline')).toBe('custom-maxline');
    expect(transformAttrName('handleTap')).toBe('bindtap');
    expect(isEventPropKey(transformAttrName('handleTap'))).toBe(true);
    expect(transformAttrName('tailColorConvert')).toBe('tailColorConvert');
    expect(transformAttrName('accessibilityLabel')).toBe(
      'accessibility-label',
    );
    globalThis.__EXPERIMENTAL_TRANSFORM_BUILTIN_ATTRIBUTE_NAMES__ = {
      mode: 'mapping-only',
    };
    expect(transformAttrName('accessibilityLabel')).toBe('accessibilityLabel');
  });
});
