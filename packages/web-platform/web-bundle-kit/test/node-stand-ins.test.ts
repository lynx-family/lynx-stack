// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import nodeAssert from 'node:assert';
import { createHash as nodeCreateHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { memfs as createMemfs } from '@napi-rs/wasm-runtime/fs';
import {
  builtinMappingResolved,
  getResolveFallback,
} from '@rsbuild/plugin-node-polyfill';
import { afterAll, describe, expect, test } from '@rstest/core';

import {
  nodePolyfillOptions,
  overridden,
  polyfilled,
} from '../scripts/builtins.ts';
import * as buffer from '../src/node/buffer.js';
import * as childProcess from '../src/node/child-process.js';
import * as crypto from '../src/node/crypto.js';
import * as fsPromises from '../src/node/fs-promises.js';
import * as fs from '../src/node/fs.js';
import { host } from '../src/node/host.js';
import * as nodeModule from '../src/node/module.js';
import * as net from '../src/node/net.js';
import * as os from '../src/node/os.js';
import * as path from '../src/node/path.js';
import * as perfHooks from '../src/node/perf-hooks.js';
import * as process from '../src/node/process.js';
import * as readline from '../src/node/readline.js';
import * as url from '../src/node/url.js';
import * as utilTypes from '../src/node/util-types.js';
import * as util from '../src/node/util.js';
import * as v8 from '../src/node/v8.js';
import * as vm from '../src/node/vm.js';
import * as workerThreads from '../src/node/worker-threads.js';

/** A module namespace, as `import * as` gives it. */
type Namespace = Record<string, unknown> & { default: unknown };

/** Named exports of a namespace, without `default`. */
const named = (ns: Namespace) =>
  Object.keys(ns).filter((key) => key !== 'default').sort();

const implemented: Record<string, Namespace> = {
  buffer,
  crypto,
  fs,
  'fs/promises': fsPromises,
  module: nodeModule,
  net,
  os,
  path,
  perf_hooks: perfHooks,
  process,
  url,
  util,
  'util/types': utilTypes,
};

const trapped: Record<string, Namespace> = {
  child_process: childProcess,
  readline,
  v8,
  vm,
  worker_threads: workerThreads,
};

describe('the named and default exports of a stand-in agree', () => {
  test.each(Object.entries(implemented))('%s', (_name, ns) => {
    const object = ns.default as Record<string, unknown>;
    // `path` keeps a `default` member that is the module itself.
    const keys = Object.keys(object).filter((key) => key !== 'default').sort();
    expect(named(ns)).toEqual(keys);
    for (const key of keys) expect(ns[key]).toBe(object[key]);
  });

  test.each(Object.entries(trapped))('%s', (_name, ns) => {
    const object = ns.default as Record<string, unknown>;
    for (const key of named(ns)) expect(ns[key]).toBe(object[key]);
  });

  test('`path` and its `default` member', () => {
    expect(path.default.default).toBe(path.default);
    expect(path.posix).toBe(path.default);
  });

  test('`process.exitCode` is the `exitCode` export', () => {
    expect(process.exitCode).toBeUndefined();
    process.default.exitCode = 3;
    expect(process.exitCode).toBe(3);
    process.default.exitCode = undefined;
  });

  test('`process` has no `versions.node`', () => {
    expect(process.versions).toEqual({});
  });
});

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('what each built-in becomes', () => {
  const fallback = getResolveFallback(nodePolyfillOptions(root));

  test('the polyfilled built-ins have a polyfill in the plugin', () => {
    for (const name of polyfilled) {
      expect(builtinMappingResolved[name]).toEqual(expect.any(String));
      expect(fallback[name]).toBe(builtinMappingResolved[name]);
    }
  });

  test('the overrides are modules of the kit', () => {
    for (const [name, file] of Object.entries(overridden)) {
      expect(fallback[name]).toBe(join(root, file));
      expect(existsSync(join(root, file))).toBe(true);
    }
  });

  test('the other built-ins are empty', () => {
    expect(fallback['http']).toBe(false);
    expect(fallback['timers']).toBe(false);
    expect(fallback['inspector']).toBe(false);
  });

  test('`module` lists the built-ins that are not empty', () => {
    const kept = Object.keys(fallback).filter((name) =>
      !name.startsWith('node:') && fallback[name] !== false
    );
    expect([...nodeModule.builtinModules].sort()).toEqual(kept.sort());
  });
});

describe('assert', () => {
  // The polyfill of the plugin, not the Node.js built-in.
  const assert = createRequire(import.meta.url)(
    builtinMappingResolved.assert!,
  ) as typeof nodeAssert;

  test('is the npm package', () => {
    expect(builtinMappingResolved.assert).toMatch(/[\\/]assert[\\/]/);
    expect(assert).not.toBe(nodeAssert);
  });

  test('is callable, with itself as `ok` and a strict variant', () => {
    expect(typeof assert).toBe('function');
    expect(assert.ok).toBe(assert);
    expect(() => assert(false, 'no')).toThrow('no');
    expect(() => assert.equal(1, 2)).toThrow(assert.AssertionError);
    expect(() => assert.equal(1, '1')).not.toThrow();
    expect(() => assert.strict.equal(1, '1')).toThrow(assert.AssertionError);
    expect(() => assert.deepStrictEqual({ a: [1] }, { a: [1] })).not.toThrow();
    expect(() => assert.deepStrictEqual({ a: 1 }, { a: '1' })).toThrow(
      assert.AssertionError,
    );
    expect(() => assert.fail('failed')).toThrow('failed');
  });
});

describe('trapped built-ins', () => {
  test('members throw on use and survive `extends`', () => {
    expect(() => childProcess.execFileSync('ls')).toThrow(
      'node:child_process.execFileSync() is not available',
    );
    expect(() => new vm.Script('1')).toThrow(
      'node:vm.new Script() is not available',
    );
    // A trap member is typed as returning `never`; `extends` needs a class.
    const Script = vm.Script as unknown as new() => object;
    expect(() => {
      class Source extends Script {}
      return Source;
    }).not.toThrow();
    expect(vm.default.Script).toBe(vm.Script);
  });
});

describe('fs', () => {
  const instance = createMemfs().fs;

  test('exports every key of a memfs `fs`', () => {
    const keys = Reflect.ownKeys(instance).filter((key) =>
      typeof key === 'string'
    );
    expect(keys.filter((key) => !(key in fs)).sort()).toEqual([]);
  });

  test('`fs/promises` exports every key of a memfs `fs.promises`', () => {
    const keys = Object.keys(instance.promises);
    expect(keys.filter((key) => !(key in fsPromises)).sort()).toEqual([]);
    expect(fs.promises).toBe(fsPromises.default);
  });

  test('what it takes from @napi-rs/wasm-runtime/fs is the same in every memfs', () => {
    const other = createMemfs().fs as unknown as Record<string, unknown>;
    for (
      const key of [
        'F_OK',
        'R_OK',
        'W_OK',
        'X_OK',
        'constants',
        'Stats',
        'Dir',
        'Dirent',
        '_toUnixTimestamp',
      ]
    ) {
      expect(fs.default[key as keyof typeof fs.default]).toBe(other[key]);
    }
    const promises = other['promises'] as Record<string, unknown>;
    expect(fsPromises.FileHandle).toBe(promises['FileHandle']);
    expect(fsPromises.constants).toBe(promises['constants']);
  });

  test('throws before setup', () => {
    expect(() => fs.existsSync('/')).toThrow(
      'web-bundle-kit: fs was used before setup',
    );
  });

  test('uses the memfs of the host after setup', async () => {
    host.fs = instance;
    fs.mkdirSync('/dir', { recursive: true });
    fs.writeFileSync('/dir/a.txt', 'hello');
    expect(fs.readFileSync('/dir/a.txt', 'utf-8')).toBe('hello');
    expect(await fsPromises.readFile('/dir/a.txt', 'utf-8')).toBe('hello');
    expect(fs.statSync('/dir/a.txt')).toBeInstanceOf(fs.Stats);
    const stream = fs.createReadStream('/dir/a.txt');
    expect(stream).toBeInstanceOf(fs.ReadStream);
    stream.destroy();
    expect(Object.keys(fs.promises.fs)).toEqual(
      Object.keys(Reflect.get(instance.promises, 'fs') as object),
    );
  });

  afterAll(() => {
    host.fs = undefined;
  });
});

describe('crypto', () => {
  const inputs = {
    empty: [''],
    short: ['abc'],
    // Longer than one 64-byte block, and a length whose padding needs a
    // second block.
    long: ['x'.repeat(200)],
    padding: ['y'.repeat(56)],
    unicode: ['名前 🙂'],
    'several updates': ['The quick brown fox ', 'jumps over ', 'the lazy dog'],
  };

  for (const algorithm of ['sha1', 'sha256']) {
    test.each(Object.entries(inputs))(`${algorithm} of %s`, (_name, parts) => {
      const ours = crypto.createHash(algorithm);
      const node = nodeCreateHash(algorithm);
      for (const part of parts) {
        ours.update(part);
        node.update(part);
      }
      expect(ours.digest('hex')).toBe(node.digest('hex'));
    });
  }

  // Each `update` feeds the hash: chunks that end inside a block, end on a
  // block boundary and span several blocks, as strings and as bytes.
  test.each(['sha1', 'sha256'])('%s of updates across blocks', (algorithm) => {
    const chunks = [
      'a'.repeat(63),
      'b',
      new Uint8Array(64).fill(7),
      'c'.repeat(129),
      new Uint16Array([0x4142, 0x4344]),
      '',
      'd'.repeat(55),
    ];
    const ours = crypto.createHash(algorithm);
    const node = nodeCreateHash(algorithm);
    for (const chunk of chunks) {
      ours.update(chunk);
      node.update(chunk);
    }
    expect(ours.digest('hex')).toBe(node.digest('hex'));
  });

  test('bytes, encodings and `hash`', () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    expect(crypto.createHash('SHA256').update(bytes).digest('base64')).toBe(
      nodeCreateHash('sha256').update(bytes).digest('base64'),
    );
    expect(crypto.hash('sha1', 'abc')).toBe(
      nodeCreateHash('sha1').update('abc').digest('hex'),
    );
    // A view of part of a buffer, and string input in other encodings.
    const view = new Uint8Array(
      new Uint8Array([9, 9, 1, 2, 3, 9]).buffer,
      2,
      3,
    );
    expect(crypto.createHash('sha1').update(view).digest('hex')).toBe(
      nodeCreateHash('sha1').update(view).digest('hex'),
    );
    expect(
      crypto.createHash('sha256').update('00ff10', 'hex').update(
        'YWJj',
        'base64',
      )
        .digest('hex'),
    ).toBe(
      nodeCreateHash('sha256').update('00ff10', 'hex').update('YWJj', 'base64')
        .digest('hex'),
    );
    // Without an encoding, `digest` gives the bytes as a Buffer.
    const digest = crypto.createHash('sha256').update('abc').digest();
    expect(buffer.Buffer.isBuffer(digest)).toBe(true);
    expect([...(digest as Uint8Array)]).toEqual([
      ...nodeCreateHash('sha256').update('abc').digest(),
    ]);
    expect(crypto.getHashes()).toEqual(['sha1', 'sha256']);
    expect(() => crypto.createHash('md5')).toThrow(
      'Digest method not supported in @lynx-js/web-bundle-kit: md5',
    );
  });
});

describe('util', () => {
  test('has the members that build tools use', () => {
    expect(util.styleText('red', 'text')).toBe('text');
    expect(util.stripVTControlCharacters('\u001B[31mred\u001B[39m')).toBe(
      'red',
    );
    expect(util.isDeepStrictEqual({ a: [1] }, { a: [1] })).toBe(true);
    expect(util.isDeepStrictEqual({ a: 1 }, { a: '1' })).toBe(false);
    expect(util.format('%s=%d', 'a', 1)).toBe('a=1');
    expect(util.types).toBe(utilTypes.default);
    expect(utilTypes.isProxy(new Proxy({}, {}))).toBe(false);
    expect(utilTypes.isRegExp(/a/)).toBe(true);
  });
});

describe('url', () => {
  test('converts file URLs and keeps the legacy API', () => {
    expect(url.fileURLToPath('file:///node_modules/a%20b/index.js')).toBe(
      '/node_modules/a b/index.js',
    );
    expect(url.pathToFileURL('/a b/c.js').href).toBe('file:///a%20b/c.js');
    expect(() => url.fileURLToPath('https://example.com/')).toThrow(
      'The URL must be of scheme file',
    );
    expect(url.parse('https://example.com:8080/a?b=1').port).toBe('8080');
    expect(url.format({ protocol: 'https', host: 'example.com' })).toBe(
      'https://example.com',
    );
    expect(url.URL).toBe(globalThis.URL);
  });
});

describe('module', () => {
  test('`require()` of a built-in returns its default export', () => {
    const load = nodeModule.createRequire('/project/index.js');
    // In Node.js, the built-ins of the plugin are Node.js's own.
    expect(load('assert')).toBe(nodeAssert);
    expect(load('node:path')).toBe(path.default);
    expect(load('path/posix')).toBe(path.default);
    expect(load('fs/promises')).toBe(fsPromises.default);
    expect(load('module')).toBe(nodeModule.default);
    expect(load('url')).toBe(url.default);
    expect(load('vm')).toBe(vm.default);
    const events = load('events') as { EventEmitter: unknown };
    expect(typeof events).toBe('function');
    expect(events.EventEmitter).toBe(events);
    for (const name of nodeModule.builtinModules) {
      expect(load(name)).toBeDefined();
    }
  });
});
