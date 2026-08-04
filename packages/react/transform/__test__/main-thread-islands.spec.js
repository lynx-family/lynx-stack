// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../main.js';

const ids = (code) => [...new Set(code.match(/__snapshot_[\w$]+/g) ?? [])];
const worklets = (code) => [...new Set(code.match(/_wkltId: *"[^"]+"/g) ?? [])];

function options(target, extra = {}) {
  const isMainThread = target === 'LEPUS';
  return {
    mode: 'test',
    pluginName: '',
    filename: 'test.jsx',
    sourcemap: false,
    cssScope: false,
    shake: false,
    compat: false,
    refresh: false,
    directiveDCE: { target },
    defineDCE: {
      define: {
        __LEPUS__: String(isMainThread),
        __MAIN_THREAD__: String(isMainThread),
        __JS__: String(!isMainThread),
        __BACKGROUND__: String(!isMainThread),
      },
    },
    worklet: {
      target,
      filename: 'test.jsx',
      runtimePkg: '@lynx-js/react/internal',
    },
    snapshot: {
      preserveJsx: false,
      runtimePkg: '@lynx-js/react/internal',
      jsxImportSource: isMainThread ? '@lynx-js/react/lepus' : '@lynx-js/react',
      target,
      filename: 'test',
    },
    ...extra,
  };
}

describe(`the 'main thread component' marker`, () => {
  it('reports a marked component and strips the directive', async () => {
    const result = await transformReactLynx(
      `
      export function Header() {
        'main thread component';
        return <view><text>Header</text></view>;
      }
      `,
      options('JS'),
    );

    expect(result.mainThreadIslands?.components).toEqual([
      { name: 'Header', exported: 'Header' },
    ]);
    expect(result.code).not.toContain('main thread component');
  });

  it('reports the same components from either layer', async () => {
    const source = `
      const Header = () => {
        'main thread component';
        return <view />;
      };
      export { Header as PageHeader };
    `;

    const background = await transformReactLynx(source, options('JS'));
    const mainThread = await transformReactLynx(source, options('LEPUS'));

    expect(background.mainThreadIslands?.components).toEqual([
      { name: 'Header', exported: 'PageHeader' },
    ]);
    expect(mainThread.mainThreadIslands?.components).toEqual(
      background.mainThreadIslands?.components,
    );
  });

  it(`does not collide with the 'main thread' worklet directive`, async () => {
    const result = await transformReactLynx(
      `
      export function App() {
        const onTap = () => {
          'main thread';
          return 1;
        };
        return <view main-thread:bindtap={onTap} />;
      }
      `,
      options('JS'),
    );

    // No island at all: the field is absent, not an empty report.
    expect(result.mainThreadIslands).toBeUndefined();
    // The worklet transform still ran.
    expect(result.code).toContain('_wkltId');
  });

  it('keeps the snapshot and worklet ids identical in both layers', async () => {
    const source = `
      export function Header(props) {
        'main thread component';
        const onTap = (e) => {
          'main thread';
          e.currentTarget.setStyleProperty('opacity', '0.5');
        };
        return <view main-thread:bindtap={onTap}><text>{props.title}</text></view>;
      }
    `;

    const background = await transformReactLynx(source, options('JS'));
    const mainThread = await transformReactLynx(source, options('LEPUS'));

    // This is what makes an island adoptable: the two threads build the same
    // snapshot types, so the first-screen hydrate matches them by type and
    // takes ownership of the elements the main thread already created.
    expect(ids(mainThread.code)).toEqual(ids(background.code));
    expect(ids(background.code)).not.toEqual([]);
    expect(worklets(mainThread.code)).toEqual(worklets(background.code));
    expect(worklets(background.code)).not.toEqual([]);
  });
});

describe('a root-level <MainThread>', () => {
  it('resolves the island it wraps back to its import', async () => {
    const result = await transformReactLynx(
      `
      import { root, MainThread } from '@lynx-js/react';
      import { Shell } from './Shell.jsx';

      root.render(
        <MainThread fallback={<view class="skeleton" />}>
          <Shell />
        </MainThread>,
      );
      `,
      options('JS', { collectMTSDefines: true }),
    );

    expect(result.mainThreadIslands?.rootIsland).toEqual({
      source: './Shell.jsx',
      imported: 'Shell',
      local: 'Shell',
    });
    expect(result.mainThreadIslands?.rootIslandWarning).toBeUndefined();
    // The fallback still compiles into a static snapshot, so the M1 channel
    // can paint it when the island does not make it to the main thread.
    expect(result.code).toMatch(/fallback: .*_jsx\(__snapshot_/);
  });

  it('ignores a nested <MainThread>', async () => {
    const result = await transformReactLynx(
      `
      import { MainThread } from '@lynx-js/react';
      import { Shell } from './Shell.jsx';

      export function App() {
        return <view><MainThread><Shell /></MainThread></view>;
      }
      `,
      options('JS'),
    );

    expect(result.mainThreadIslands?.rootIsland).toBeUndefined();
  });

  it('warns instead of naming an island when it wraps a host element', async () => {
    const result = await transformReactLynx(
      `
      import { root, MainThread } from '@lynx-js/react';
      root.render(<MainThread><view /></MainThread>);
      `,
      options('JS'),
    );

    expect(result.mainThreadIslands?.rootIsland).toBeUndefined();
    expect(result.mainThreadIslands?.rootIslandWarning).toContain('<view>');
  });

  it('only matches the <MainThread> imported from @lynx-js/react', async () => {
    const result = await transformReactLynx(
      `
      import { root } from '@lynx-js/react';
      import { MainThread } from './my-ui.jsx';
      import { Shell } from './Shell.jsx';
      root.render(<MainThread><Shell /></MainThread>);
      `,
      options('JS'),
    );

    expect(result.mainThreadIslands?.rootIsland).toBeUndefined();
  });
});
