// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

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
const syncScriptPath = fileURLToPath(
  new URL('../skills/lynx-runtime/scripts/sync-lynxml.mjs', import.meta.url),
);

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

  it('syncs and checks marked IIFE blocks in .lynxml files via sync-lynxml.mjs', () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'lynx-runtime-sync-lynxml-'),
    );
    try {
      const pagePath = path.join(tmpDir, 'demo.lynxml');
      const initialDoc = [
        '<!doctype lynx>',
        '<!-- Example <script thread="main">doNotTouch();</script> inside comment -->',
        '<lynx engine-version="4.2">',
        '<style>.box { width: 10px; }</style>',
        '<script thread = \'main\' >',
        '\'use strict\';',
        'const mts = LynxRuntime;',
        'const renderPage = () => 1;',
        'function outer() { const LynxRuntime = 1; function updatePage() {} return [LynxRuntime, updatePage]; }',
        'const expr = function getPageData() {};',
        'function isStrict() { return this === undefined; }',
        'function mountPage(data) { record(["mts", isStrict(), data.title, renderPage(), outer().length, typeof expr]); }',
        'mts.onRenderPage(mountPage);',
        '</script >',
        '<script thread="background">',
        'const bts = LynxRuntime.bindPage();',
        'record(["bts", bts.getId()]);',
        '</script>',
        '</lynx>',
        '',
      ].join('\n');
      fs.writeFileSync(pagePath, initialDoc, 'utf8');

      execFileSync(process.execPath, [syncScriptPath, pagePath], {
        encoding: 'utf8',
      });
      const synced = fs.readFileSync(pagePath, 'utf8');
      // Commented example <script> must stay untouched.
      expect(synced).toContain(
        '<!-- Example <script thread="main">doNotTouch();</script> inside comment -->',
      );
      expect(synced).toContain(readIife(mtsIifePath).trim());
      expect(synced).toContain(readIife(btsIifePath).trim());
      expect(synced).toContain('// BEGIN @lynx-js/lynx-runtime iife/mts');
      expect(synced).toContain('// END @lynx-js/lynx-runtime iife/mts');
      expect(synced).toContain('// BEGIN @lynx-js/lynx-runtime iife/bts');
      // `'use strict';` must stay ahead of the inserted runtime block.
      expect(synced.indexOf('\'use strict\';')).toBeLessThan(
        synced.indexOf('// BEGIN @lynx-js/lynx-runtime iife/mts'),
      );

      // Clean synced file passes --check (non-colliding `const renderPage`, local `const LynxRuntime`, and Native `</script >`).
      const ok = spawnSync(
        process.execPath,
        [syncScriptPath, '--check', pagePath],
        { encoding: 'utf8' },
      );
      expect(ok.status, ok.stderr).toBe(0);

      // Re-running sync is idempotent.
      const secondRun = execFileSync(
        process.execPath,
        [syncScriptPath, pagePath],
        { encoding: 'utf8' },
      );
      expect(secondRun).toContain('UNCHANGED');

      // Execute both extracted scripts from the synced .lynxml (honoring
      // Native/Web closing-tag whitespace) to verify strict mode and startup code.
      const mtsBodyMatch = /<script thread = 'main' >([\s\S]*?)<\/script\s*>/
        .exec(synced);
      const btsBodyMatch = /<script thread="background">([\s\S]*?)<\/script\s*>/
        .exec(synced);
      expect(mtsBodyMatch).not.toBeNull();
      expect(btsBodyMatch).not.toBeNull();

      const recorded: unknown[] = [];
      const engine = createMockProxy();
      const mtsCtx = vm.createContext({
        lynx: {
          getEngine: () => engine,
          getNative: () => createMockProxy(),
          getJSContext: () => createMockProxy(),
        },
        record: (entry: unknown) => recorded.push(entry),
      });
      vm.runInContext(mtsBodyMatch![1]!, mtsCtx);
      engine.emit(
        '__RenderPage',
        vm.runInContext('[{ title: "synced" }, {}]', mtsCtx),
      );

      const btsCtx = vm.createContext({
        lynx: {
          getApp: () => ({ nativeAppId: 'synced-card' }),
          getCoreContext: () => createMockProxy(),
        },
        record: (entry: unknown) => recorded.push(entry),
      });
      vm.runInContext(btsBodyMatch![1]!, btsCtx);
      expect(recorded).toEqual([
        ['mts', true, 'synced', 1, 2, 'function'],
        ['bts', 'synced-card'],
      ]);

      // Do not split multi-line string expressions or flip sloppy `"use strict"\n+ "foo"`.
      const exprPath = path.join(tmpDir, 'expr.lynxml');
      fs.writeFileSync(
        exprPath,
        [
          '<!doctype lynx>',
          '<lynx engine-version="4.2">',
          '<script thread="main">',
          '"hello"',
          '.toUpperCase();',
          'result = "use strict"\n+ "foo";',
          'sloppy = (function() { return this !== undefined; })();',
          '</script>',
          '<script thread="background">',
          '"use strict"',
          '+ "foo";',
          'sloppy = (function() { return this !== undefined; })();',
          '</script>',
          '</lynx>',
          '',
        ].join('\n'),
        'utf8',
      );
      execFileSync(process.execPath, [syncScriptPath, exprPath], {
        encoding: 'utf8',
      });
      expect(
        spawnSync(process.execPath, [syncScriptPath, '--check', exprPath], {
          encoding: 'utf8',
        }).status,
      ).toBe(0);
      const exprSynced = fs.readFileSync(exprPath, 'utf8');
      const exprMts = /<script thread="main">([\s\S]*?)<\/script>/.exec(
        exprSynced,
      )![1]!;
      const exprBts = /<script thread="background">([\s\S]*?)<\/script>/.exec(
        exprSynced,
      )![1]!;
      const exprMtsCtx: Record<string, unknown> = {};
      vm.runInNewContext(exprMts, exprMtsCtx);
      expect(exprMtsCtx['result']).toBe('use strictfoo');
      expect(exprMtsCtx['sloppy']).toBe(true);
      const exprBtsCtx: Record<string, unknown> = {};
      vm.runInNewContext(exprBts, exprBtsCtx);
      expect(exprBtsCtx['sloppy']).toBe(true);

      // Detect drifted IIFE body (including leading whitespace).
      fs.writeFileSync(
        pagePath,
        synced.replace('var LynxRuntime;', '  var LynxRuntime;'),
        'utf8',
      );
      const indented = spawnSync(
        process.execPath,
        [syncScriptPath, '--check', pagePath],
        { encoding: 'utf8' },
      );
      expect(indented.status).toBe(1);
      expect(indented.stderr).toContain('does not match');

      // Detect executable code placed before the managed runtime block.
      fs.writeFileSync(
        pagePath,
        synced.replace(
          '\'use strict\';',
          '\'use strict\';\nLynxRuntime.getInitData();',
        ),
        'utf8',
      );
      const earlyCode = spawnSync(
        process.execPath,
        [syncScriptPath, '--check', pagePath],
        { encoding: 'utf8' },
      );
      expect(earlyCode.status).toBe(1);
      expect(earlyCode.stderr).toContain('executable code');

      // Reject unpaired duplicate BEGIN marker without deleting business code in between.
      const dupBeginDoc = synced.replace(
        '// BEGIN @lynx-js/lynx-runtime iife/mts',
        '// BEGIN @lynx-js/lynx-runtime iife/mts (0.0.0)\nconst preserveMe = 1;\n// BEGIN @lynx-js/lynx-runtime iife/mts',
      );
      fs.writeFileSync(pagePath, dupBeginDoc, 'utf8');
      expect(
        spawnSync(process.execPath, [syncScriptPath, pagePath], {
          encoding: 'utf8',
        }).status,
      ).not.toBe(0);
      expect(fs.readFileSync(pagePath, 'utf8')).toBe(dupBeginDoc);
      expect(
        spawnSync(process.execPath, [syncScriptPath, '--check', pagePath], {
          encoding: 'utf8',
        }).status,
      ).toBe(1);

      // Reject a managed block wrapped inside a block comment `/* ... */`.
      const commentedDoc = synced
        .replace(
          '// BEGIN @lynx-js/lynx-runtime iife/mts',
          '/*\n// BEGIN @lynx-js/lynx-runtime iife/mts',
        )
        .replace(
          '// END @lynx-js/lynx-runtime iife/mts',
          '// END @lynx-js/lynx-runtime iife/mts\n*/',
        );
      fs.writeFileSync(pagePath, commentedDoc, 'utf8');
      expect(
        spawnSync(process.execPath, [syncScriptPath, '--check', pagePath], {
          encoding: 'utf8',
        }).status,
      ).toBe(1);

      // Detect MTS `var`/`function` globalThis collisions (including after a statement and hoisted `var`).
      fs.writeFileSync(
        pagePath,
        synced.replace(
          'function mountPage',
          'init()\nfunction updatePage() {}\nif (true) { var processData = function(d) { return d; }; }\nfunction mountPage',
        ),
        'utf8',
      );
      const hookCollision = spawnSync(
        process.execPath,
        [syncScriptPath, '--check', pagePath],
        { encoding: 'utf8' },
      );
      expect(hookCollision.status).toBe(1);
      expect(hookCollision.stderr).toContain('`updatePage`');
      expect(hookCollision.stderr).toContain('`processData`');

      // Detect an unmarked runtime copy appended after an already-marked block on both sync and --check.
      const extraCopyDoc = synced.replace(
        'mts.onRenderPage(mountPage);',
        `mts.onRenderPage(mountPage);\n${readIife(btsIifePath).trim()}`,
      );
      fs.writeFileSync(pagePath, extraCopyDoc, 'utf8');
      expect(
        spawnSync(process.execPath, [syncScriptPath, pagePath], {
          encoding: 'utf8',
        }).status,
      ).not.toBe(0);
      expect(
        spawnSync(process.execPath, [syncScriptPath, '--check', pagePath], {
          encoding: 'utf8',
        }).status,
      ).toBe(1);

      // Refuse unmarked `var LynxRuntime` on a shared line or top-level `class LynxRuntime` without modifying files.
      for (
        const snippet of [
          'var LynxRuntime;(()=>{})();const keepBusinessCode = 1;',
          'class LynxRuntime {}',
        ]
      ) {
        const conflictPath = path.join(tmpDir, 'conflict.lynxml');
        const conflictDoc = [
          '<!doctype lynx>',
          '<lynx engine-version="4.2">',
          '<script thread="main">',
          snippet,
          '</script>',
          '</lynx>',
          '',
        ].join('\n');
        fs.writeFileSync(conflictPath, conflictDoc, 'utf8');
        const refused = spawnSync(
          process.execPath,
          [syncScriptPath, conflictPath],
          { encoding: 'utf8' },
        );
        expect(refused.status).not.toBe(0);
        expect(refused.stderr).toContain('LynxRuntime');
        expect(fs.readFileSync(conflictPath, 'utf8')).toBe(conflictDoc);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
