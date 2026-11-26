// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// `createRequire` that resolves against memfs.
//
// `require.resolve` follows the Node.js algorithm with Rspack's resolver over
// memfs, so it finds the mirror under `/node_modules` and the project's own
// `node_modules`. `require` returns a Node.js built-in stand-in, a module
// bundled into the kit (looked up by the path it resolved to), or a JSON file
// read from memfs. Anything else cannot run in the kit and throws.

const host = require('./host.cjs');
const path = require('./path.cjs');
const { fileURLToPath } = require('./url.cjs');

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
];

// Loaded on first use: builtins.cjs requires this module too.
const loadBuiltins = () => require('./builtins.cjs');

const stripNode = (id) => (id.startsWith('node:') ? id.slice(5) : id);
const isBuiltin = (id) => builtinModules.includes(stripNode(String(id)));

/** @type {Map<string, any>} */
const resolvers = new Map();
function resolver() {
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

function notFound(request, from) {
  const error = new Error(`Cannot find module '${request}' from '${from}'`);
  error.code = 'MODULE_NOT_FOUND';
  return error;
}

function resolveFrom(request, dirs) {
  for (const dir of dirs) {
    const absolute = request.startsWith('/') ? request : undefined;
    const result = absolute && !request.includes('?')
      ? resolver().sync('/', absolute)
      : resolver().sync(dir, request);
    if (result.path) return result.path;
  }
  throw notFound(request, dirs.join(', '));
}

function createRequire(from) {
  const filename = String(from).startsWith('file:')
    ? fileURLToPath(String(from))
    : String(from);
  const dirname = filename.endsWith('/') ? filename : path.dirname(filename);

  function resolve(request, options) {
    if (isBuiltin(request)) return stripNode(request);
    const dirs = options?.paths ?? [dirname];
    return resolveFrom(request, dirs);
  }
  resolve.paths = () => [];

  function requireModule(request) {
    if (isBuiltin(request)) {
      return loadBuiltins()[stripNode(request)];
    }
    const resolved = resolve(request);
    const bundled = host.modules[resolved];
    if (bundled) return bundled;
    if (resolved.endsWith('.json')) {
      return JSON.parse(host.fs.readFileSync(resolved, 'utf-8'));
    }
    const error = new Error(
      `Cannot require '${request}' (${resolved}) from ${filename}: `
        + 'it is not bundled into @lynx-js/web-bundle-kit',
    );
    error.code = 'ERR_WEB_BUNDLE_KIT_NOT_BUNDLED';
    throw error;
  }
  requireModule.resolve = resolve;
  requireModule.cache = Object.create(null);
  requireModule.main = undefined;
  return requireModule;
}

class Module {
  static createRequire = createRequire;
  static builtinModules = builtinModules;
  static isBuiltin = isBuiltin;
}

module.exports = {
  createRequire,
  builtinModules,
  isBuiltin,
  Module,
};
