// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../main.js';

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

// A background-only module: the only export carries the component-level
// directive. It has a worklet, a snapshot, and a top-level side effect.
const backgroundOnlySource = `
import { formatFeed } from './heavy-format.js';

console.info('TOP_LEVEL_SIDE_EFFECT_MARKER');

export function Feed() {
  'background only';
  const items = formatFeed(1, 2, 3);
  const onScroll = (e) => {
    'main thread';
    console.info('SCROLL_WORKLET_MARKER', e);
  };
  return (
    <scroll-view main-thread:bindscroll={onScroll}>
      <text>FEED_SNAPSHOT_STATIC_MARKER</text>
      {items.map((it) => <text key={it.id}>{it.label}</text>)}
    </scroll-view>
  );
}
`;

const normalSource = `
export function App() {
  return <view><text>hi</text></view>;
}
`;

describe('stubBackgroundOnlyModules', () => {
  it('compiles a background-only module as a stub shell', async () => {
    const result = await transformReactLynx(
      backgroundOnlySource,
      options('LEPUS', { stubBackgroundOnlyModules: true }),
    );

    expect(result.backgroundOnlyStub).toBe(true);
    expect(result.code).toContain('export var Feed = function() {}');
    expect(result.code).not.toContain('TOP_LEVEL_SIDE_EFFECT_MARKER');
    expect(result.code).not.toContain('FEED_SNAPSHOT_STATIC_MARKER');
    expect(result.code).not.toContain('createSnapshot');
    expect(result.code).not.toContain('registerWorkletInternal');
    expect(result.code).not.toContain('heavy-format.js');
  });

  it('warns that the dropped top-level statements no longer run on the main thread', async () => {
    const result = await transformReactLynx(
      backgroundOnlySource,
      options('LEPUS', { stubBackgroundOnlyModules: true }),
    );

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].text).toMatch(
      /top-level statements no longer run on the main thread/,
    );
  });

  it('leaves a module that is not background-only alone', async () => {
    const result = await transformReactLynx(
      normalSource,
      options('LEPUS', { stubBackgroundOnlyModules: true }),
    );

    expect(result.backgroundOnlyStub).toBe(false);
    expect(result.code).toContain('createSnapshot');
  });

  it('stubs a module-level directive regardless of its exports', async () => {
    const result = await transformReactLynx(
      `
'background only';
export const config = { url: 'https://example.com' };
export function send() {
  return fetch(config.url);
}
`,
      options('LEPUS', { stubBackgroundOnlyModules: true }),
    );

    expect(result.backgroundOnlyStub).toBe(true);
    expect(result.code).toContain('export var config = function() {}');
    expect(result.code).toContain('export var send = function() {}');
    expect(result.code).not.toContain('example.com');
  });

  it('keeps a mixed module on the in-place path', async () => {
    const result = await transformReactLynx(
      `
export function Feed() {
  'background only';
  return <view />;
}
export function Header() {
  return <text>header</text>;
}
`,
      options('LEPUS', { stubBackgroundOnlyModules: true }),
    );

    expect(result.backgroundOnlyStub).toBe(false);
    expect(result.code).toContain('createSnapshot');
  });
});

describe('collectMTSDefinesBackgroundOnly', () => {
  it('collects the definitions of a background-only module', async () => {
    const result = await transformReactLynx(
      backgroundOnlySource,
      options('JS', { collectMTSDefinesBackgroundOnly: true }),
    );

    // The list item `<text>` hoists a second snapshot.
    expect(result.mtsDefines.map(({ kind }) => kind).sort()).toEqual([
      'snapshot',
      'snapshot',
      'worklet',
    ]);
    const codes = result.mtsDefines.map(({ code }) => code).join('\n');
    expect(codes).toContain('FEED_SNAPSHOT_STATIC_MARKER');
  });

  it('collects nothing for a module that is not background-only', async () => {
    const result = await transformReactLynx(
      normalSource,
      options('JS', { collectMTSDefinesBackgroundOnly: true }),
    );

    expect(result.mtsDefines).toBeUndefined();
  });

  it('leaves the emitted background code unchanged', async () => {
    const withCollect = await transformReactLynx(
      backgroundOnlySource,
      options('JS', { collectMTSDefinesBackgroundOnly: true }),
    );
    const withoutCollect = await transformReactLynx(
      backgroundOnlySource,
      options('JS'),
    );

    expect(withCollect.code).toBe(withoutCollect.code);
  });
});

describe('collectMTSInPlaceDefines', () => {
  it('records the identities the main-thread compile registers in place', async () => {
    const result = await transformReactLynx(
      normalSource,
      options('LEPUS', { collectMTSInPlaceDefines: true }),
    );

    expect(result.mtsInPlaceDefines).toHaveLength(1);
    expect(result.mtsInPlaceDefines[0].kind).toBe('snapshot');
    expect(result.mtsInPlaceDefines[0].id).toMatch(/^__snapshot_/);
  });

  it('records nothing for a stubbed module', async () => {
    const result = await transformReactLynx(
      backgroundOnlySource,
      options('LEPUS', {
        stubBackgroundOnlyModules: true,
        collectMTSInPlaceDefines: true,
      }),
    );

    expect(result.mtsInPlaceDefines).toEqual([]);
  });

  it('does not change the emitted main-thread code', async () => {
    const withRecording = await transformReactLynx(
      normalSource,
      options('LEPUS', { collectMTSInPlaceDefines: true }),
    );
    const withoutRecording = await transformReactLynx(
      normalSource,
      options('LEPUS'),
    );

    expect(withRecording.code).toBe(withoutRecording.code);
  });
});

describe('in-place vs assembled parity', () => {
  it('collects from the background exactly the identities the main thread would define in place', async () => {
    const inPlace = await transformReactLynx(
      backgroundOnlySource,
      options('LEPUS', { collectMTSInPlaceDefines: true }),
    );
    const assembled = await transformReactLynx(
      backgroundOnlySource,
      options('JS', { collectMTSDefinesBackgroundOnly: true }),
    );

    const inPlaceIds = inPlace.mtsInPlaceDefines
      .map(({ kind, id }) => `${kind}:${id}`)
      .sort();
    const assembledIds = assembled.mtsDefines
      .map(({ kind, id }) => `${kind}:${id}`)
      .sort();

    expect(assembledIds).toEqual(inPlaceIds);
    expect(assembledIds.length).toBeGreaterThan(0);
  });

  it('collects the same definitions the whole-compilation collector would', async () => {
    const scoped = await transformReactLynx(
      backgroundOnlySource,
      options('JS', { collectMTSDefinesBackgroundOnly: true }),
    );
    const whole = await transformReactLynx(
      backgroundOnlySource,
      options('JS', { collectMTSDefines: true }),
    );

    expect(scoped.mtsDefines).toStrictEqual(whole.mtsDefines);
  });
});
