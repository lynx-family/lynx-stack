// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { URL as NodeURL } from 'node:url';
import { describe, expect, test } from 'vitest';

type Loader = (this: {
  resourcePath: string;
  async(): (error: Error | null, code?: string) => void;
}, source: string) => void;
const loader = createRequire(import.meta.url)(
  '../build/runtime-loader.cjs',
) as Loader;

function transform(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    loader.call({
      resourcePath: 'fixture.mjs',
      async: () => (error, code) => error ? reject(error) : resolve(code!),
    }, source);
  });
}

describe('Motion build runtime imports', () => {
  test('rewrites bare, qualified, computed and optional accesses while preserving local bindings', async () => {
    const code = await transform(`
      export const runtime = [document, typeof queueMicrotask,
        globalThis.queueMicrotask, globalThis['document'], globalThis?.performance];
      export function local(queueMicrotask, globalThis) {
        return [queueMicrotask, globalThis.document];
      }
      export const object = { document };
    `);
    expect(code).toContain('from "lynx-motion-microtask"');
    expect(code).toContain('from "lynx-motion-runtime"');
    expect(code).toContain('typeof _queueMicrotask');
    expect(code).toContain('return [queueMicrotask, globalThis.document]');
    expect(code).toContain('document: _document');
    expect(code).not.toContain('globalThis.queueMicrotask');
    expect(code).not.toContain('globalThis[\'document\']');
    expect(code).not.toContain('globalThis?.performance');
  });

  test('does not rewrite declarations, property names or shadowed browser identifiers', async () => {
    const code = await transform(`
      const window = { document: 1 };
      function read(document) { return document; }
      export { window, read };
    `);
    expect(code).not.toContain('lynx-motion-');
  });

  test.each(['absent', 'browser'])(
    'compiled ESM preserves %s host globals',
    async (host) => {
      // A separate process bypasses Vitest's loader and the Lynx test runtime.
      const full =
        new NodeURL('../dist/upstream/full.js', import.meta.url).href;
      const mini =
        new NodeURL('../dist/upstream/mini.js', import.meta.url).href;
      const runtime =
        new NodeURL('../dist/polyfill/runtime.js', import.meta.url).href;
      const microtask =
        new NodeURL('../dist/polyfill/microtask.js', import.meta.url).href;
      await promisify(execFile)(process.execPath, [
        '--input-type=module',
        '-e',
        `
      import assert from 'node:assert/strict';
      const names = ['window', 'document', 'Element', 'HTMLElement', 'SVGElement',
        'NodeList', 'EventTarget', 'getComputedStyle', 'queueMicrotask', 'performance'];
      const browser = ${JSON.stringify(host)} === 'browser';
      for (const name of names) {
        const value = browser
          ? (globalThis[name] ?? Object.freeze(function BrowserAPI() {}))
          : undefined;
        Object.defineProperty(globalThis, name, { value, writable: false, configurable: true });
      }
      const before = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
      globalThis.requestAnimationFrame = callback => setTimeout(() => callback(Date.now()), 1);
      const motion = await import(${JSON.stringify(full)});
      const mini = await import(${JSON.stringify(mini)});
      const styles = { opacity: '0', transform: 'none' };
      globalThis.__GetComputedStyleByKey = (_element, key) => styles[key];
      const nativeElement = {
        element: 1,
        setStyleProperty(name, value) { styles[name] = value; },
      };
      globalThis.lynx = { querySelectorAll: () => [nativeElement] };
      const opacity = motion.motionValue(0);
      const cleanup = motion.styleEffect('.item', { opacity });
      opacity.set(0.5);
      await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(Number(styles.opacity), 0.5);
      cleanup();
      const { Element } = await import(${JSON.stringify(runtime)});
      await motion.animate(new Element(nativeElement), { opacity: 1 }, { duration: 0.01 });
      assert.equal(Number(styles.opacity), 1);
      assert.equal(motion.motionValue(42).get(), 42);
      assert.equal(typeof mini.spring({ keyframes: [0, 1] }).next(10).value, 'number');
      const { queueMicrotask } = await import(${JSON.stringify(microtask)});
      await new Promise(resolve => queueMicrotask(resolve));
      assert.deepEqual(names.map(name => Object.getOwnPropertyDescriptor(globalThis, name)), before);
    `,
      ]);
    },
  );
});
