/** @jsxImportSource ../../lepus */

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Component, createContext } from 'preact';
import { use } from 'preact/compat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { elementTree } from './utils/nativeMethod';
import { globalEnvManager } from './utils/envManager';
import { setupDocument } from '../../src/document';
import renderToStringBase from '../../src/snapshot/renderToOpcodes';
import { setupPage, snapshotInstanceManager } from '../../src/snapshot';
import { __root } from '../../src/root';

const renderToString = element => renderToStringBase(element, null, __root);

describe('use() on the main thread', () => {
  beforeAll(() => {
    globalEnvManager.switchToMainThread();
  });

  beforeEach(() => {
    setupPage(__CreatePage('0', 0));
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalEnvManager.resetEnv();
    elementTree.clear();
    snapshotInstanceManager.clear();
  });

  it('reads a provided value and falls back to the default', () => {
    const Ctx = createContext('default');
    const seen = [];

    function Reader() {
      seen.push(use(Ctx));
      return <text>ok</text>;
    }

    renderToString(
      <view>
        <Ctx.Provider value='provided'>
          <Reader />
        </Ctx.Provider>
        <Reader />
      </view>,
    );

    expect(seen).toEqual(['provided', 'default']);
  });

  it('reads the nearest provider when they nest', () => {
    const Ctx = createContext('default');
    const seen = [];

    function Reader() {
      seen.push(use(Ctx));
      return <text>ok</text>;
    }

    renderToString(
      <Ctx.Provider value='outer'>
        <Reader />
        <Ctx.Provider value='inner'>
          <Reader />
        </Ctx.Provider>
      </Ctx.Provider>,
    );

    expect(seen).toEqual(['outer', 'inner']);
  });

  it('works inside a class component render', () => {
    const Ctx = createContext('default');
    const seen = [];

    class Reader extends Component {
      render() {
        seen.push(use(Ctx));
        return <text>ok</text>;
      }
    }

    renderToString(
      <Ctx.Provider value='provided'>
        <Reader />
      </Ctx.Provider>,
    );

    expect(seen).toEqual(['provided']);
  });

  describe('alongside contextType', () => {
    it('gives a class its contextType value while use() still reads the provider', () => {
      const Ctx = createContext('default');
      const seen = [];

      class Reader extends Component {
        static contextType = Ctx;
        render() {
          seen.push(['this.context', this.context], ['use', use(Ctx)]);
          return <text>ok</text>;
        }
      }

      renderToString(
        <Ctx.Provider value='provided'>
          <Reader />
        </Ctx.Provider>,
      );

      expect(seen).toEqual([['this.context', 'provided'], ['use', 'provided']]);
    });

    it('gives a function its contextType value while use() still reads the provider', () => {
      const Ctx = createContext('default');
      const seen = [];

      function Reader(_props, context) {
        seen.push(['arg', context], ['use', use(Ctx)]);
        return <text>ok</text>;
      }
      Reader.contextType = Ctx;

      renderToString(
        <Ctx.Provider value='provided'>
          <Reader />
        </Ctx.Provider>,
      );

      // `context` is the resolved contextType value here, so `use` has to read
      // the provider map from `_globalContext` instead.
      expect(seen).toEqual([['arg', 'provided'], ['use', 'provided']]);
    });
  });
});
