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

// The built-ins that get the polyfills of pluginNodePolyfill, by their
// `node:` names (scripts/builtins.ts).
import assert from 'node:assert';
import events from 'node:events';
import querystring from 'node:querystring';
import stream from 'node:stream';
import stringDecoder from 'node:string_decoder';
import tty from 'node:tty';
import zlib from 'node:zlib';

// The built-ins that are the kit's own.
import buffer from './buffer.js';
import childProcess from './child-process.js';
import crypto from './crypto.js';
import fsPromises from './fs-promises.js';
import fs from './fs.js';
import { host } from './host.js';
import net from './net.js';
import os from './os.js';
import path from './path.js';
import process from './process.js';
import utilTypes from './util-types.js';
import util from './util.js';
import url from './url.js';

/**
 * What `require()` from `createRequire` returns for each built-in that is not
 * an empty module in the kit (scripts/builtins.ts). `module` is set below.
 */
const builtins: Record<string, unknown> = {
  assert,
  buffer,
  child_process: childProcess,
  crypto,
  events,
  fs,
  'fs/promises': fsPromises,
  module: undefined,
  net,
  os,
  path,
  'path/posix': path,
  process,
  querystring,
  stream,
  string_decoder: stringDecoder,
  tty,
  url,
  util,
  'util/types': utilTypes,
  zlib,
};
const builtinModules = Object.keys(builtins);

const stripNode = (id: string) => (id.startsWith('node:') ? id.slice(5) : id);
const isBuiltin = (id: unknown): boolean =>
  builtinModules.includes(stripNode(String(id)));

type ResolverFactory = NonNullable<typeof host.ResolverFactory>;

let resolver: InstanceType<ResolverFactory> | undefined;

function resolveSync(dir: string, request: string) {
  resolver ??= new host.ResolverFactory!({
    // The kit is a browser build: prefer what a browser bundle of the
    // package would use, as Rspack did when it bundled the kit.
    conditionNames: ['browser', 'require', 'node', 'default'],
    mainFields: ['main'],
    extensions: ['.js', '.cjs', '.json', '.node'],
    symlinks: false,
  });
  return resolver.sync(dir, request);
}

function withCode(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

function resolveFrom(request: string, dirs: readonly string[]): string {
  for (const dir of dirs) {
    const result = resolveSync(dir, request);
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
      return builtins[stripNode(request)];
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

builtins['module'] = nodeModule;

export { builtinModules, createRequire, isBuiltin, Module };
export default nodeModule;
