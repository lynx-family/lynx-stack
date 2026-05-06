// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, Fragment, createContext, h, options } from 'preact';
import { Suspense } from 'preact/compat';
import { useState } from '@lynx-js/react/lepus/hooks';
import { describe, expect, it } from 'vitest';

import {
  __OpAttr,
  __OpBegin,
  __OpEnd,
  __OpSlot,
  __OpText,
  renderToString,
} from '../../../../src/element-template/runtime/render/render-to-opcodes';
import { DIFFED, PARENT } from '../../../../src/shared/render-constants';

describe('Element Template renderToOpcodes', () => {
  it('should export correct opcodes', () => {
    expect(__OpBegin).toBe(0);
    expect(__OpEnd).toBe(1);
    expect(__OpAttr).toBe(2);
    expect(__OpText).toBe(3);
    expect(__OpSlot).toBe(4);
  });

  it('should emit slot opcodes for ET host slot arrays', () => {
    const Template = '_et_test_root';
    const opcodes = renderToString(
      <Template children={[null, null, null, 'marker']} />,
    );

    expect(opcodes[0]).toBe(__OpBegin);
    expect(opcodes).toContain(__OpSlot);
    expect(opcodes[opcodes.indexOf(__OpSlot) + 1]).toBe(3);
    expect(opcodes).toContain(__OpEnd);
  });

  it('should skip empty slot entries when rendering ET host slot arrays', () => {
    const Template = '_et_test_root';
    const opcodes = renderToString(
      <Template children={[false, 'first', null, true, 'second']} />,
    );

    const normalized = opcodes.map(item => (typeof item === 'object' ? '<vnode>' : item));
    expect(normalized).toEqual([
      __OpBegin,
      '<vnode>',
      __OpSlot,
      1,
      __OpText,
      'first',
      __OpSlot,
      4,
      __OpText,
      'second',
      __OpEnd,
    ]);
  });

  it('ignores function values in render output', () => {
    expect(renderToString(() => {})).toEqual([]);
  });

  it('throws in development when a plain host vnode reaches the ET render path', () => {
    expect(() => renderToString(h('view', null))).toThrow(
      'Element Template main-thread renderer received an uncompiled host vnode: view',
    );
  });

  it('throws in development when an invalid vnode reaches the ET render path', () => {
    expect(() => renderToString({ type: null, props: {} })).toThrow(
      'Element Template main-thread renderer received an invalid vnode.',
    );
  });

  it('cleans vnodes before throwing development renderer invariant errors', () => {
    const previousDiffed = options[DIFFED];
    const cleaned = [];
    const plainHostVNode = h('view', null);
    const invalidVNode = { type: null, props: {} };
    options[DIFFED] = vnode => {
      cleaned.push(vnode);
    };

    try {
      expect(() => renderToString(plainHostVNode)).toThrow(
        'Element Template main-thread renderer received an uncompiled host vnode: view',
      );
      expect(() => renderToString(invalidVNode)).toThrow(
        'Element Template main-thread renderer received an invalid vnode.',
      );
    } finally {
      options[DIFFED] = previousDiffed;
    }

    expect(cleaned).toEqual([plainHostVNode, invalidVNode]);
    expect(plainHostVNode[PARENT]).toBeUndefined();
    expect(invalidVNode[PARENT]).toBeUndefined();
  });

  it('calls the unmount option while cleaning rendered vnodes', () => {
    const previousUnmount = options.unmount;
    let unmountCount = 0;
    options.unmount = () => {
      unmountCount += 1;
    };

    try {
      renderToString(h('__et_builtin_raw_text__', { attributeSlots: ['cleanup'] }));
    } finally {
      options.unmount = previousUnmount;
    }

    expect(unmountCount).toBeGreaterThan(0);
  });

  it('renders direct fragments', () => {
    expect(renderToString(
      h(Fragment, null, 'direct-fragment'),
    )).toContain('direct-fragment');
  });

  it('unwraps unkeyed top-level fragments returned from components', () => {
    function UnkeyedFragment() {
      return h(Fragment, null, 'unkeyed-fragment');
    }

    expect(renderToString(h(UnkeyedFragment, null))).toContain('unkeyed-fragment');
  });

  it('reuses class component instances and reapplies derived state from props', () => {
    class DerivedMessage extends Component {
      state = {
        value: 'seed',
      };

      static getDerivedStateFromProps(props, state) {
        return {
          value: `${props.label}:${state.value}`,
        };
      }

      render() {
        return this.state.value;
      }
    }

    const vnode = h(DerivedMessage, { label: 'Ada' });
    expect(renderToString(vnode)).toContain('Ada:seed');

    vnode.props = { label: 'Linus' };
    expect(renderToString(vnode)).toContain('Linus:seed');
  });

  it('passes both modern and legacy context into component rendering', () => {
    const ThemeContext = createContext('light');

    class LegacyProvider extends Component {
      getChildContext() {
        return {
          legacyTheme: 'legacy-dark',
        };
      }

      render() {
        return this.props.children;
      }
    }

    class ModernReader extends Component {
      static contextType = ThemeContext;

      render() {
        return this.context;
      }
    }

    function LegacyReader(_props, context) {
      return context.legacyTheme;
    }

    function FragmentWrapper() {
      return h(
        Fragment,
        null,
        h(ModernReader, null),
        h(LegacyReader, null),
      );
    }

    const opcodes = renderToString(
      h(
        ThemeContext.Provider,
        { value: 'modern-dark' },
        h(
          LegacyProvider,
          null,
          h(FragmentWrapper, null),
        ),
      ),
    );

    expect(opcodes).toContain('modern-dark');
    expect(opcodes).toContain('legacy-dark');
  });

  it('renders suspense fallbacks when a child throws a promise', () => {
    function AsyncText() {
      throw Promise.resolve();
    }

    const opcodes = renderToString(
      h(
        Suspense,
        { fallback: 'loading' },
        h(AsyncText, null),
      ),
    );

    expect(opcodes).toContain('loading');
  });

  it('does not re-render function components when main-thread hooks schedule an update during render', () => {
    function DirtyHookComponent() {
      const [count, setCount] = useState(0);
      if (count === 0) {
        setCount(1);
      }
      return String(count);
    }

    expect(renderToString(h(DirtyHookComponent, null))).toContain('0');
  });

  it('falls back to the default context value when no provider is mounted', () => {
    const ThemeContext = createContext('default-theme');

    class ThemeReader extends Component {
      static contextType = ThemeContext;

      render() {
        return this.context;
      }
    }

    const opcodes = renderToString(h(ThemeReader, null));
    expect(opcodes).toContain('default-theme');
  });
});
