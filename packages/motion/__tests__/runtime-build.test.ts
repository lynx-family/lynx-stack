// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL, URL as NodeURL } from 'node:url';
import { createRslib } from '@rslib/core';
import { describe, test } from 'vitest';

import { pluginMotionRuntime } from '../build/pluginMotionRuntime.js';

describe('Motion build runtime imports', () => {
  test(
    'native Rslib substitutions preserve scopes, property names and typeof guards',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'motion-runtime-plugin-'));
      const names = [
        'document',
        'window',
        'Element',
        'HTMLElement',
        'SVGElement',
        'NodeList',
        'EventTarget',
        'getComputedStyle',
        'performance',
        'queueMicrotask',
      ];
      const accessors = [
        (name: string) => name,
        (name: string) => `globalThis.${name}`,
        (name: string) => `globalThis['${name}']`,
        (name: string) => `globalThis?.${name}`,
      ];
      try {
        await writeFile(join(directory, 'package.json'), '{"type":"module"}');
        const entry = join(directory, 'input.js');
        await writeFile(
          entry,
          `
        export const values = [${
            accessors.map(access => `[${names.map(access).join(',')}]`).join(
              ',',
            )
          }];
        export const types = [${
            accessors.map(access =>
              `[${names.map(name => `typeof ${access(name)}`).join(',')}]`
            ).join(',')
          }];
        export function local(${names.join(',')}) {
          return [{${names.join(',')}}, [${
            names.map(name => `typeof ${name}`).join(',')
          }]];
        }
        export function shadowed(globalThis) {
          return [globalThis.document, globalThis['document'], globalThis?.document,
            typeof globalThis.document, typeof globalThis['document'], typeof globalThis?.document];
        }
        export function declared() {
          const window = { document: 1 };
          function read(document) { return document; }
          return [window.document, read(2)];
        }
      `,
        );
        const rslib = await createRslib({
          cwd: directory,
          config: {
            lib: [{
              format: 'esm',
              syntax: 'es2022',
              plugins: [pluginMotionRuntime()],
            }],
            source: { entry: { 'upstream/fixture': entry } },
            output: { distPath: { root: 'dist' } },
            performance: { printFileSize: false },
          },
        });
        const build = await rslib.build();
        await build.close();
        const polyfill = join(directory, 'dist/polyfill');
        await mkdir(polyfill, { recursive: true });
        await writeFile(
          join(polyfill, 'runtime.js'),
          `
        export const document = {}, window = {}, performance = {};
        export class Element {} export class HTMLElement {} export class SVGElement {}
        export class NodeList {} export class EventTarget {}
        export function getComputedStyle() {}
      `,
        );
        await writeFile(
          join(polyfill, 'microtask.js'),
          'export function queueMicrotask() {}',
        );
        for (const browser of [false, true]) {
          await promisify(execFile)(process.execPath, [
            '--input-type=module',
            '-e',
            `
          import assert from 'node:assert/strict';
          const names = ${JSON.stringify(names)};
          for (const name of names) Object.defineProperty(globalThis, name, {
            value: ${browser} ? Object.freeze(function HostAPI() {}) : undefined,
            writable: false, configurable: true,
          });
          const before = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
          const fixture = await import(${
              JSON.stringify(
                pathToFileURL(join(directory, 'dist/upstream/fixture.js')).href,
              )
            });
          const runtime = await import(${
              JSON.stringify(pathToFileURL(join(polyfill, 'runtime.js')).href)
            });
          const microtask = await import(${
              JSON.stringify(pathToFileURL(join(polyfill, 'microtask.js')).href)
            });
          const privateAPIs = { ...runtime, ...microtask };
          for (const values of fixture.values) assert.deepEqual(values, names.map(name => privateAPIs[name]));
          for (const types of fixture.types) assert.deepEqual(types, names.map(name => typeof privateAPIs[name]));
          const [object, types] = fixture.local(...names.map(() => 123));
          assert.deepEqual(object, Object.fromEntries(names.map(name => [name, 123])));
          assert.deepEqual(types, names.map(() => 'number'));
          assert.deepEqual(fixture.shadowed({document: 'local'}), ['local', 'local', 'local', 'string', 'string', 'string']);
          assert.deepEqual(fixture.declared(), [1, 2]);
          assert.deepEqual(names.map(name => Object.getOwnPropertyDescriptor(globalThis, name)), before);
        `,
          ]);
        }
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
    15_000,
  );

  test.each(['absent', 'browser'])(
    'compiled full and mini feature suites preserve %s host globals',
    async (host) => {
      try {
        await promisify(execFile)(process.execPath, [
          fileURLToPath(
            new NodeURL('./fixtures/compiled-features.mjs', import.meta.url),
          ),
        ], {
          env: { ...process.env, MOTION_TEST_HOST: host },
          timeout: 10_000,
        });
      } catch (error) {
        const failure = error as Error & { stdout?: string; stderr?: string };
        throw new Error(
          [failure.message, failure.stdout, failure.stderr].filter(Boolean)
            .join('\n'),
        );
      }
    },
    15_000,
  );

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
