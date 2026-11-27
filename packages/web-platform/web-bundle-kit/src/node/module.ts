// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference path="./packages.d.ts" />

// `createRequire` that resolves against memfs.
//
// `require.resolve` follows the Node.js algorithm with Rspack's resolver over
// memfs, so it finds the mirror under `/node_modules` and the project's own
// `node_modules`. `require` returns a Node.js built-in stand-in (the default
// export of its module), a module bundled into the kit (looked up by the path
// it resolved to), or a JSON file read from memfs. Anything else cannot run
// in the kit and throws.
//
// This module imports every other stand-in and no stand-in imports it, so
// there is no import cycle: they are all evaluated before the table below.

import assert from 'assert/build/assert.js';
import events from 'events/events.js';

import buffer from './buffer.js';
import childProcess from './child-process.js';
import crypto from './crypto.js';
import fsPromises from './fs-promises.js';
import fs from './fs.js';
import { host } from './host.js';
import net from './net.js';
import os from './os.js';
import perfHooks from './perf-hooks.js';
import path from './path.js';
import process from './process.js';
import querystring from './querystring.js';
import readline from './readline.js';
import stream from './stream.js';
import stringDecoder from './string-decoder.js';
import tty from './tty.js';
import utilTypes from './util-types.js';
import util from './util.js';
import url from './url.js';
import v8 from './v8.js';
import vm from './vm.js';
import workerThreads from './worker-threads.js';
import zlib from './zlib.js';

/** The built-ins the kit stands in for; the kit's build aliases each one. */
const builtinModules = [
  'assert',
  'buffer',
  'child_process',
  'crypto',
  'events',
  'fs',
  'fs/promises',
  'module',
  'net',
  'os',
  'path',
  'path/posix',
  'perf_hooks',
  'process',
  'querystring',
  'readline',
  'stream',
  'string_decoder',
  'tty',
  'url',
  'util',
  'util/types',
  'v8',
  'vm',
  'worker_threads',
  'zlib',
] as const;

type BuiltinName = (typeof builtinModules)[number];

const stripNode = (id: string) => (id.startsWith('node:') ? id.slice(5) : id);
const isBuiltin = (id: unknown): boolean =>
  (builtinModules as readonly string[]).includes(stripNode(String(id)));

type ResolverFactory = NonNullable<typeof host.ResolverFactory>;

const resolvers = new Map<string, InstanceType<ResolverFactory>>();
function resolver(): InstanceType<ResolverFactory> {
  let factory = resolvers.get('require');
  if (!factory) {
    if (!host.ResolverFactory) {
      throw new Error('web-bundle-kit: require.resolve was used before setup');
    }
    factory = new host.ResolverFactory({
      // The kit is a browser build: prefer what a browser bundle of the
      // package would use, as Rspack did when it bundled the kit.
      conditionNames: ['browser', 'require', 'node', 'default'],
      mainFields: ['main'],
      extensions: ['.js', '.cjs', '.json', '.node'],
      symlinks: false,
    });
    resolvers.set('require', factory);
  }
  return factory;
}

function withCode(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

function resolveFrom(request: string, dirs: readonly string[]): string {
  for (const dir of dirs) {
    const absolute = request.startsWith('/') ? request : undefined;
    const result = absolute && !request.includes('?')
      ? resolver().sync('/', absolute)
      : resolver().sync(dir, request);
    if (result.path) return result.path;
  }
  throw withCode(
    `Cannot find module '${request}' from '${dirs.join(', ')}'`,
    'MODULE_NOT_FOUND',
  );
}

function createRequire(from: string | URL) {
  const filename = String(from).startsWith('file:')
    ? url.fileURLToPath(String(from))
    : String(from);
  const dirname = filename.endsWith('/') ? filename : path.dirname(filename);

  function resolve(
    request: string,
    options?: { paths?: readonly string[] },
  ): string {
    if (isBuiltin(request)) return stripNode(request);
    const dirs = options?.paths ?? [dirname];
    return resolveFrom(request, dirs);
  }
  resolve.paths = (): string[] => [];

  function requireModule(request: string): unknown {
    if (isBuiltin(request)) {
      return builtins[stripNode(request) as BuiltinName];
    }
    const resolved = resolve(request);
    const bundled = host.modules[resolved];
    if (bundled) return bundled;
    if (resolved.endsWith('.json')) {
      return JSON.parse(fs.readFileSync(resolved, 'utf-8'));
    }
    throw withCode(
      `Cannot require '${request}' (${resolved}) from ${filename}: `
        + 'it is not bundled into @lynx-js/web-bundle-kit',
      'ERR_WEB_BUNDLE_KIT_NOT_BUNDLED',
    );
  }
  requireModule.resolve = resolve;
  requireModule.cache = Object.create(null) as Record<string, unknown>;
  requireModule.main = undefined;
  return requireModule;
}

class Module {
  static createRequire = createRequire;
  static builtinModules = builtinModules;
  static isBuiltin = isBuiltin;
}

const nodeModule = {
  createRequire,
  builtinModules,
  isBuiltin,
  Module,
};

/** What `require()` from `createRequire` returns for each built-in. */
const builtins: Record<BuiltinName, unknown> = {
  // `assert` and `events` are the npm packages, which the kit's build also
  // aliases them to.
  assert,
  buffer,
  child_process: childProcess,
  crypto,
  events,
  fs,
  'fs/promises': fsPromises,
  module: nodeModule,
  net,
  os,
  path,
  'path/posix': path,
  perf_hooks: perfHooks,
  process,
  querystring,
  readline,
  stream,
  string_decoder: stringDecoder,
  tty,
  url,
  util,
  'util/types': utilTypes,
  v8,
  vm,
  worker_threads: workerThreads,
  zlib,
};

export { builtinModules, createRequire, isBuiltin, Module };
export default nodeModule;
