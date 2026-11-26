// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The virtual `node_modules` tree of the kit.
//
// Every package the kit bundles or provides gets one place under
// `/node_modules`, laid out the way a package manager that hoists would lay it
// out: a package goes to `/node_modules/<name>` unless another package already
// sits there, and then under the `node_modules` of the package that depends on
// it. The bundled code is told it runs from there (`import.meta.url`,
// `__dirname`), and the mirror puts files there, so `require.resolve`,
// `path.resolve(__dirname, ...)` and `fs.readFileSync` inside the bundled code
// find what they look for.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * @typedef {{ name: string, version: string, realDir: string, virtualDir: string, json: Record<string, any> }} PackageInstance
 */

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf-8'));
}

/**
 * Finds the directory of a dependency the way Node.js looks up
 * `node_modules`, ignoring `exports`.
 */
function findDependencyDir(fromDir, name) {
  for (let dir = fromDir;; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (existsSync(path.join(candidate, 'package.json'))) {
      return realpathSync(candidate);
    }
    if (path.dirname(dir) === dir) return undefined;
  }
}

function parentDirOfPackageDir(virtualDir) {
  // `/a/node_modules/@s/n` -> `/a`, `/node_modules/n` -> `/`
  const index = virtualDir.lastIndexOf('/node_modules/');
  return index <= 0 ? '/' : virtualDir.slice(0, index);
}

/** The root of the package a real file belongs to (nearest named package.json). */
export function findPackageRoot(file) {
  let dir = statSync(file).isDirectory() ? file : path.dirname(file);
  for (;; dir = path.dirname(dir)) {
    const pkg = path.join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        if (typeof readJson(pkg).name === 'string') return dir;
      } catch {
        // not a package.json we understand
      }
    }
    if (path.dirname(dir) === dir) return undefined;
  }
}

/**
 * Builds the layout from root packages, given as real directories.
 *
 * @param {string[]} rootDirs
 */
export function createLayout(rootDirs) {
  /** @type {Map<string, PackageInstance>} virtual dir -> instance */
  const byVirtualDir = new Map();
  /** @type {Map<string, PackageInstance>} real dir -> first instance */
  const byRealDir = new Map();
  /** @type {string[]} */
  const missing = [];

  /** @param {string} realDir @param {string} parentVirtualDir */
  function place(realDir, name, parentVirtualDir) {
    // Node.js looks in `<dependent>/node_modules`, then in the
    // `node_modules` of each package folder above it, then `/node_modules`.
    const candidates = [];
    for (let dir = parentVirtualDir;; dir = parentDirOfPackageDir(dir)) {
      candidates.push(
        dir === '/' ? `/node_modules/${name}` : `${dir}/node_modules/${name}`,
      );
      if (dir === '/') break;
    }
    // candidates go from nearest to farthest; pick the farthest that is free
    // or already the same package, as long as nothing nearer shadows it.
    let chosen;
    for (const candidate of candidates) {
      const existing = byVirtualDir.get(candidate);
      if (existing) {
        if (existing.realDir === realDir) {
          return { instance: existing, isNew: false };
        }
        break; // shadowed: must go nearer
      }
      chosen = candidate;
    }
    if (!chosen) chosen = candidates[0];
    const json = readJson(path.join(realDir, 'package.json'));
    const instance = {
      name,
      version: json.version ?? '0.0.0',
      realDir,
      virtualDir: chosen,
      json,
    };
    byVirtualDir.set(chosen, instance);
    if (!byRealDir.has(realDir)) byRealDir.set(realDir, instance);
    return { instance, isNew: true };
  }

  /** @type {Array<[string, string, string]>} */
  const queue = [];
  for (const realDir of rootDirs) {
    const json = readJson(path.join(realDir, 'package.json'));
    queue.push([realpathSync(realDir), json.name, '/']);
  }
  while (queue.length > 0) {
    const [realDir, name, parent] = queue.shift();
    const { instance, isNew } = place(realDir, name, parent);
    if (!isNew) continue;
    const deps = {
      ...instance.json.peerDependencies,
      ...instance.json.optionalDependencies,
      ...instance.json.dependencies,
    };
    for (const depName of Object.keys(deps).sort()) {
      const depDir = findDependencyDir(realDir, depName);
      if (!depDir) {
        if (
          !instance.json.peerDependenciesMeta?.[depName]?.optional
          && !instance.json.optionalDependencies?.[depName]
          && !instance.json.peerDependencies?.[depName]
        ) {
          missing.push(`${depName} (dependency of ${instance.name})`);
        }
        continue;
      }
      queue.push([depDir, depName, instance.virtualDir]);
    }
  }

  return {
    missing,
    /** @returns {PackageInstance[]} */
    instances: () => [...byVirtualDir.values()],
    /**
     * The virtual path of a real file, or undefined when its package is not
     * part of the layout.
     */
    toVirtual(realFile) {
      // The nearest enclosing package that is in the tree: packages may ship
      // prebundled packages inside them (`@rsbuild/core/compiled/*`).
      const real = realpathSync(realFile);
      for (let dir = path.dirname(real);; dir = path.dirname(dir)) {
        const instance = byRealDir.get(dir);
        if (instance) {
          const relative = path.relative(dir, real).split(path.sep).join('/');
          return path.posix.join(instance.virtualDir, relative);
        }
        if (path.dirname(dir) === dir) return undefined;
      }
    },
    /** The instance placed for a real package directory. */
    instanceOf(realDir) {
      return byRealDir.get(realpathSync(realDir));
    },
  };
}
