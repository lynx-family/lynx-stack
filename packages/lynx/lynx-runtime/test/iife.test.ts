// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import * as btsExports from '../src/bts.js';
import type {
  HostBTSApp,
  HostContextProxy,
  HostMessageEvent,
} from '../src/common/host-types.js';
import * as mtsExports from '../src/mts.js';

const pkgDir = new URL('../', import.meta.url);
const mtsIifePath = new URL('../dist/iife/mts.js', import.meta.url);
const btsIifePath = new URL('../dist/iife/bts.js', import.meta.url);
const skillPath = new URL('../skills/lynx-runtime/SKILL.md', import.meta.url);

function readIife(url: URL): string {
  return fs.readFileSync(url, 'utf8');
}

function createMockProxy(): HostContextProxy & {
  emit(type: string, data: unknown): void;
  dispatched: Array<{ type: string; data: unknown }>;
} {
  const listeners = new Map<string, Set<(event: HostMessageEvent) => void>>();
  const dispatched: Array<{ type: string; data: unknown }> = [];
  return {
    dispatched,
    dispatchEvent(event: { type: string; data: unknown }) {
      dispatched.push(event);
      const set = listeners.get(event.type);
      if (set) {
        for (const fn of [...set]) {
          fn({ type: event.type, data: event.data });
        }
      }
      return 0;
    },
    addEventListener: vi.fn(
      <T = unknown>(
        type: string,
        listener: (event: HostMessageEvent<T>) => void,
      ) => {
        let set = listeners.get(type);
        if (!set) {
          set = new Set();
          listeners.set(type, set);
        }
        set.add(listener as (event: HostMessageEvent) => void);
      },
    ),
    removeEventListener: vi.fn(
      <T = unknown>(
        type: string,
        listener: (event: HostMessageEvent<T>) => void,
      ) => {
        listeners.get(type)?.delete(
          listener as (event: HostMessageEvent) => void,
        );
      },
    ),
    emit(type: string, data: unknown) {
      const set = listeners.get(type);
      if (set) {
        for (const fn of [...set]) {
          fn({ type, data });
        }
      }
    },
  };
}

describe('IIFE builds for build-free .lynxml scripts', () => {
  beforeAll(() => {
    if (!fs.existsSync(mtsIifePath) || !fs.existsSync(btsIifePath)) {
      const require = createRequire(import.meta.url);
      const rslibPkg = require.resolve('@rslib/core/package.json');
      const rslibBin = path.join(path.dirname(rslibPkg), 'bin/rslib.js');
      execFileSync(process.execPath, [rslibBin], {
        cwd: fileURLToPath(pkgDir),
        stdio: 'inherit',
      });
    }
  });
  it('declares ./iife/mts and ./iife/bts exports and emits self-contained .lynxml-safe ES2017 scripts', () => {
    const pkg = JSON.parse(
      fs.readFileSync(new URL('package.json', pkgDir), 'utf8'),
    ) as { exports?: Record<string, unknown>; files?: string[] };
    expect(pkg.exports?.['./iife/mts']).toBe('./dist/iife/mts.js');
    expect(pkg.exports?.['./iife/bts']).toBe('./dist/iife/bts.js');
    expect(pkg.exports?.['./skill']).toBe('./skills/lynx-runtime/SKILL.md');
    expect(pkg.files).toContain('skills');
    expect(fs.existsSync(skillPath)).toBe(true);

    for (
      const [label, url] of [['mts', mtsIifePath], [
        'bts',
        btsIifePath,
      ]] as const
    ) {
      const code = readIife(url);
      expect(code.length, `${label} bundle should be non-empty`)
        .toBeGreaterThan(0);
      // Native LynxML terminates a <script> block on any literal `</script` sequence.
      expect(code).not.toMatch(/<\/script/i);
      // Must be standalone classic scripts with no module syntax or browser/CJS globals.
      expect(code).not.toMatch(/\b(?:import|export)\b/);
      expect(code).not.toMatch(/\brequire\s*\(/);
      expect(code).not.toMatch(/\b(?:window|document)\b/);
      // Rspeedy default ES2017 target must lower ES2020+ optional chaining and nullish coalescing.
      expect(code).not.toContain('?.');
      expect(code).not.toContain('??');
    }
  });

  it('matches ESM export surfaces and stays side-effect-free on evaluation', () => {
    const getEngine = vi.fn();
    const getNative = vi.fn();
    const mtsSandbox: Record<string, unknown> = {
      lynx: {
        SystemInfo: { platform: 'android', pixelRatio: 2 },
        getEngine,
        getNative,
      },
    };
    const mtsContext = vm.createContext(mtsSandbox);
    vm.runInContext(readIife(mtsIifePath), mtsContext);

    const mtsRuntime = mtsSandbox['LynxRuntime'] as Record<string, unknown>;
    expect(Object.keys(mtsRuntime).sort()).toEqual(
      Object.keys(mtsExports).sort(),
    );
    expect(mtsSandbox['renderPage']).toBeUndefined();
    expect(mtsSandbox['processData']).toBeUndefined();
    expect(mtsSandbox['SystemInfo']).toBeUndefined();
    expect(getEngine).not.toHaveBeenCalled();
    expect(getNative).not.toHaveBeenCalled();

    const btsSandbox: Record<string, unknown> = {};
    const btsContext = vm.createContext(btsSandbox);
    vm.runInContext(readIife(btsIifePath), btsContext);

    const btsRuntime = btsSandbox['LynxRuntime'] as Record<string, unknown>;
    expect(Object.keys(btsRuntime).sort()).toEqual(
      Object.keys(btsExports).sort(),
    );
  });

  it('executes MTS lifecycle, timingFlag flush, messaging, and destroy inside a main-thread script block', () => {
    const engine = createMockProxy();
    const native = createMockProxy();
    const peer = createMockProxy();
    const flush = vi.fn();
    const events: unknown[] = [];

    const sandbox: Record<string, unknown> = {
      __FlushElementTree: flush,
      lynx: {
        __globalProps: { theme: 'light' },
        getEngine: () => engine,
        getNative: () => native,
        getJSContext: () => peer,
      },
      record: (entry: unknown) => {
        events.push(entry);
      },
    };
    const context = vm.createContext(sandbox);

    const script = `${readIife(mtsIifePath)}
LynxRuntime.onRenderPage(function(data) {
  var firstCopy = LynxRuntime.getInitData();
  firstCopy.title = 'mutated';
  record(['render', data.title, LynxRuntime.getInitData().title, LynxRuntime.getGlobalProps().theme]);
});
LynxRuntime.onUpdateData(function(data, options) {
  record(['update', data.title, options.timingFlag]);
  LynxRuntime.flushElementTree(options);
});
LynxRuntime.onMessage('ping', function(payload) {
  record(['msg', payload.step]);
  LynxRuntime.sendMessage('pong', { ok: true });
});
LynxRuntime.onDestroy(function() {
  record(['destroy', LynxRuntime.isDestroyed()]);
});
function emitInRealm(target, type, payload) {
  target.emit(type, payload);
}
`;
    vm.runInContext(script, context);

    const emitInRealm = sandbox['emitInRealm'] as (
      target: typeof engine,
      type: string,
      payload: unknown,
    ) => void;
    const evalInContext = <T>(expr: string): T =>
      vm.runInContext(`(${expr})`, context) as T;

    emitInRealm(
      engine,
      '__RenderPage',
      evalInContext('[{ title: \'hello\' }, {}]'),
    );
    emitInRealm(
      engine,
      '__UpdatePage',
      evalInContext(
        '[{ title: \'updated\' }, { timingFlag: \'flag-1\', triggerLayout: true }]',
      ),
    );
    emitInRealm(peer, 'ping', evalInContext('{ step: 1 }'));
    emitInRealm(native, '__DestroyLifetime', undefined);

    expect(events).toEqual([
      ['render', 'hello', 'hello', 'light'],
      ['update', 'updated', 'flag-1'],
      ['msg', 1],
      ['destroy', true],
    ]);
    expect(flush).toHaveBeenCalledExactlyOnceWith(undefined, {
      timingFlag: 'flag-1',
      triggerLayout: true,
      __lynx_timing_flag: 'flag-1',
    });
    expect(peer.dispatched).toEqual([{ type: 'pong', data: { ok: true } }]);
  });

  it('executes BTS inside the app-service.js wrapper without CJS hijacking or globalThis leakage across cards', () => {
    // Mirror a shared BTS worker (Web / LynxGroup): globalThis has no lynx/tt and
    // each card runs inside a module-wrapper function with module, exports, window=undefined,
    // global=undefined, and its own lexical lynx parameter.
    const sharedSandbox: Record<string, unknown> = {};
    const sharedContext = vm.createContext(sharedSandbox);
    const btsIife = readIife(btsIifePath);
    const evalInShared = <T>(expr: string): T =>
      vm.runInContext(`(${expr})`, sharedContext) as T;

    function runCard(app: HostBTSApp, coreProxy: HostContextProxy) {
      const cardLynx = {
        getApp: () => app,
        getCoreContext: () => coreProxy,
        __globalProps: evalInShared(
          `({ card: ${JSON.stringify(app.nativeAppId)} })`,
        ),
      };
      const moduleObj = evalInShared<{ exports: Record<string, unknown> }>(
        '{ exports: {} }',
      );
      const wrapper = vm.runInContext(
        `(function(require, module, exports, tt, lynx, window, global) {\n${btsIife}\nreturn (function() {\n  var page = LynxRuntime.bindPage();\n  return { page: page, hasGlobalLeak: 'LynxRuntime' in globalThis };\n})();\n})`,
        sharedContext,
      ) as (
        requireFn: unknown,
        mod: { exports: Record<string, unknown> },
        exp: Record<string, unknown>,
        tt: HostBTSApp,
        lynx: unknown,
        win: undefined,
        glob: undefined,
      ) => {
        page: import('../src/common/types.js').BTSPageRuntime;
        hasGlobalLeak: boolean;
      };

      const result = wrapper(
        undefined,
        moduleObj,
        moduleObj.exports,
        app,
        cardLynx,
        undefined,
        undefined,
      );
      return { ...result, moduleExports: moduleObj.exports };
    }

    const appA = evalInShared<HostBTSApp>(
      '{ nativeAppId: \'card-a\', _params: { initData: { staticKey: \'a\' }, updateData: { count: 1 } } }',
    );
    const appB = evalInShared<HostBTSApp>(
      '{ nativeAppId: \'card-b\', _params: { initData: { staticKey: \'b\' }, updateData: { count: 2 } } }',
    );
    const coreA = createMockProxy();
    const coreB = createMockProxy();

    const a = runCard(appA, coreA);
    const b = runCard(appB, coreB);

    // Must bind via `var LynxRuntime` inside the card wrapper, not write to CJS module.exports or globalThis.
    expect(a.moduleExports).toEqual({});
    expect(b.moduleExports).toEqual({});
    expect(a.hasGlobalLeak).toBe(false);
    expect(b.hasGlobalLeak).toBe(false);
    expect(sharedSandbox['LynxRuntime']).toBeUndefined();

    expect(a.page.getId()).toBe('card-a');
    expect(b.page.getId()).toBe('card-b');
    const aInitCopy = a.page.getInitData<
      { staticKey: string; count: number }
    >();
    aInitCopy.count = 999;
    expect(a.page.getInitData()).toEqual({ staticKey: 'a', count: 1 });
    expect(b.page.getInitData()).toEqual({ staticKey: 'b', count: 2 });
    expect(a.page.getGlobalProps()).toEqual({ card: 'card-a' });
    expect(b.page.getGlobalProps()).toEqual({ card: 'card-b' });

    const reloadedA = vi.fn();
    a.page.onReload(reloadedA);
    appA.onAppReload?.(
      evalInShared('{ count: 10 }'),
      evalInShared('{ processorName: \'\' }'),
    );
    expect(reloadedA).toHaveBeenCalledExactlyOnceWith(
      { count: 10 },
      { processorName: undefined },
    );
    expect(a.page.getInitData()).toEqual({ staticKey: 'a', count: 10 });
    expect(b.page.getInitData()).toEqual({ staticKey: 'b', count: 2 });

    a.page.sendMessage('hello', { from: 'a' });
    b.page.sendMessage('hello', { from: 'b' });
    expect(coreA.dispatched).toEqual([{ type: 'hello', data: { from: 'a' } }]);
    expect(coreB.dispatched).toEqual([{ type: 'hello', data: { from: 'b' } }]);

    appA.callDestroyLifetimeFun?.();
    expect(a.page.isDestroyed()).toBe(true);
    expect(b.page.isDestroyed()).toBe(false);
  });
});
