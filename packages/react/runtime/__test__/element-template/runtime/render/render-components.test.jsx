// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, Fragment, createContext, h, options } from 'preact';
import { Suspense, use } from 'preact/compat';
import { useState } from '@lynx-js/react/lepus/hooks';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderToElementTemplate } from '../../../../src/element-template/runtime/render/render-direct.js';
import { __ElementTemplatePage } from '../../../../src/element-template/runtime/page/authored-page.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { registerBuiltinRawTextTemplate } from '../../test-utils/debug/registry.js';
import { DIFFED, PARENT } from '../../../../src/shared/render-constants.js';

beforeEach(() => {
  resetTemplateId();
  elementTemplateRegistry.clear();
  registerBuiltinRawTextTemplate();
});

function renderText(vnode) {
  return renderToElementTemplate(vnode).rootRefs.map(ref => __SerializeElementTemplate(ref).attributeSlots[0]);
}

describe('Element Template synchronous components', () => {
  it('lets use() read a context', () => {
    const Ctx = createContext('default');

    function Reader() {
      return use(Ctx);
    }

    expect(
      renderText(h(Ctx.Provider, { value: 'provided' }, h(Reader, null))),
    ).toContain('provided');
    expect(renderText(h(Reader, null))).toContain('default');
  });

  it('lets use() read a context from a class that declares contextType', () => {
    const Ctx = createContext('default');
    const seen = [];

    class Reader extends Component {
      static contextType = Ctx;
      render() {
        seen.push(['this.context', this.context], ['use', use(Ctx)]);
        return 'ok';
      }
    }

    renderText(h(Ctx.Provider, { value: 'provided' }, h(Reader, null)));

    expect(seen).toEqual([['this.context', 'provided'], ['use', 'provided']]);
  });

  it('lets use() read a context from a function that declares contextType', () => {
    const Ctx = createContext('default');
    const seen = [];

    function Reader(_props, context) {
      seen.push(['arg', context], ['use', use(Ctx)]);
      return 'ok';
    }
    Reader.contextType = Ctx;

    renderText(h(Ctx.Provider, { value: 'provided' }, h(Reader, null)));

    // `context` is the resolved contextType value here, so `use` has to read
    // the provider map from `_globalContext` instead.
    expect(seen).toEqual([['arg', 'provided'], ['use', 'provided']]);
  });

  it.each(['direct', 'spread'])('prepares %s page refs from typed attributes', mode => {
    const ref = () => {};
    const attributes = mode === 'direct'
      ? { id: 'screen', ref }
      : { id: 'screen', ...{ ref } };
    const vnode = h(__ElementTemplatePage, { attributes });

    expect(renderToElementTemplate(vnode).pageAttributes).toEqual({ id: 'screen', ref: '0-0' });
  });

  it('rejects non-list uncompiled hosts outside development too', () => {
    const originalDev = globalThis.__DEV__;
    globalThis.__DEV__ = false;
    try {
      expect(() => renderText(h('view', null))).toThrow(
        'Element Template main-thread renderer received an uncompiled host vnode: view',
      );
    } finally {
      globalThis.__DEV__ = originalDev;
    }
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
      expect(() => renderText(plainHostVNode)).toThrow(
        'Element Template main-thread renderer received an uncompiled host vnode: view',
      );
      expect(() => renderText(invalidVNode)).toThrow(
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
      renderText(h('_et_builtin_raw_text', { attributeSlots: ['cleanup'] }));
    } finally {
      options.unmount = previousUnmount;
    }

    expect(unmountCount).toBeGreaterThan(0);
  });

  it('renders direct fragments', () => {
    expect(renderText(
      h(Fragment, null, 'direct-fragment'),
    )).toContain('direct-fragment');
  });

  it('unwraps unkeyed top-level fragments returned from components', () => {
    function UnkeyedFragment() {
      return h(Fragment, null, 'unkeyed-fragment');
    }

    expect(renderText(h(UnkeyedFragment, null))).toContain('unkeyed-fragment');
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
    expect(renderText(vnode)).toContain('Ada:seed');

    vnode.props = { label: 'Linus' };
    expect(renderText(vnode)).toContain('Linus:seed');
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

    const text = renderText(
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

    expect(text).toContain('modern-dark');
    expect(text).toContain('legacy-dark');
  });

  it('renders already resolved Suspense content without fallback', async () => {
    let resolved = false;
    const pending = Promise.resolve();
    void pending.then(() => {
      resolved = true;
    });

    function Suspender() {
      if (!resolved) {
        throw pending;
      }
      return 'ready';
    }

    const pendingText = renderText(
      h(
        Suspense,
        { fallback: 'loading' },
        h(Suspender, null),
      ),
    );

    expect(pendingText).toContain('loading');
    expect(pendingText).not.toContain('ready');

    await pending;

    const resolvedText = renderText(
      h(
        Suspense,
        { fallback: 'loading' },
        h(Suspender, null),
      ),
    );

    expect(resolvedText).toContain('ready');
    expect(resolvedText).not.toContain('loading');
  });

  it('does not re-render function components when main-thread hooks schedule an update during render', () => {
    function DirtyHookComponent() {
      const [count, setCount] = useState(0);
      if (count === 0) {
        setCount(1);
      }
      return String(count);
    }

    expect(renderText(h(DirtyHookComponent, null))).toContain('0');
  });

  it('falls back to the default context value when no provider is mounted', () => {
    const ThemeContext = createContext('default-theme');

    class ThemeReader extends Component {
      static contextType = ThemeContext;

      render() {
        return this.context;
      }
    }

    const text = renderText(h(ThemeReader, null));
    expect(text).toContain('default-theme');
  });
});
