// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The files the kit writes under `/node_modules` in memfs before a build.
//
// - `package.json` of every package in the virtual tree, so that resolution
//   and `require('<pkg>/package.json')` work.
// - A placeholder for every module that is bundled into the kit, so that
//   resolving it succeeds (Rspack then gets the module itself from
//   BrowserRequirePlugin, and `require()` from the kit's registry).
// - The real content of the files Rspack compiles into a card or plugins read
//   with `fs`: the packages and folders listed in `RUNTIME_FILES`.

import { globSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Packages, by name in the virtual tree, whose files are compiled into a card
 * or read at build time, with the files to take. `null` takes the files the
 * package publishes (its `files` field).
 */
const RUNTIME_FILES = {
  '@lynx-js/react': null,
  preact: null,
  '@swc/helpers': null,
  'background-only': null,
  '@lynx-js/use-sync-external-store': null,
  '@lynx-js/websocket': null,
  '@lynx-js/webpack-dev-transport': null,
  '@lynx-js/webpack-runtime-globals': null,
  '@rspack/core': ['hot'],
  // The css-loader runtime, imported by the modules css-loader generates.
  '@rsbuild/core': [
    'compiled/css-loader/api.js',
    'compiled/css-loader/getUrl.js',
    'compiled/css-loader/noSourceMaps.js',
    'compiled/css-loader/sourceMaps.js',
  ],
  '@lynx-js/css-extract-webpack-plugin': ['runtime'],
  '@lynx-js/react-refresh-webpack-plugin': ['runtime'],
  '@lynx-js/rsbuild-plugin': ['client'],
};

/** Never mirrored: types, maps, docs and sources. */
const EXCLUDE = [
  /\.d\.[cm]?ts$/,
  /\.md$/,
  /\.tsbuildinfo$/,
  /(^|\/)(src|__test__|test|tests|docs|node_modules|testing-library|types)\//,
  /(^|\/)(tsconfig[^/]*\.json|turbo\.json|rslib\.config\.ts|vitest\.config\.ts|LICENSE[^/]*)$/,
  // The ReactLynx transform is bundled into the kit.
  /^transform\//,
];

const PLACEHOLDER = '// Bundled into @lynx-js/web-bundle-kit.\n';

function listPackageFiles(realDir, patterns) {
  const out = new Set();
  const negated = [];
  for (const pattern of patterns) {
    if (pattern.startsWith('!')) {
      negated.push(pattern.slice(1));
      continue;
    }
    for (const match of globSync(pattern, { cwd: realDir })) {
      const absolute = path.join(realDir, match);
      if (statSync(absolute).isDirectory()) {
        for (const nested of globSync('**/*', { cwd: absolute })) {
          if (statSync(path.join(absolute, nested)).isFile()) {
            out.add(
              path.posix.join(
                match.split(path.sep).join('/'),
                nested.split(path.sep).join('/'),
              ),
            );
          }
        }
      } else {
        out.add(match.split(path.sep).join('/'));
      }
    }
  }
  for (const pattern of negated) {
    for (const match of globSync(pattern, { cwd: realDir })) {
      out.delete(match.split(path.sep).join('/'));
    }
  }
  return [...out].filter((file) => !EXCLUDE.some((re) => re.test(file))).sort();
}

/**
 * @param {{ layout: ReturnType<typeof import('./layout.mjs').createLayout>, bundled: Set<string> }} options
 */
export function collectMirror({ layout, bundled }) {
  /** @type {Record<string, string>} */
  const files = {};
  const sizes = {};
  for (const instance of layout.instances()) {
    files[`${instance.virtualDir}/package.json`] = readFileSync(
      path.join(instance.realDir, 'package.json'),
      'utf-8',
    );
  }
  for (const file of [...bundled].sort()) {
    const virtual = layout.toVirtual(file);
    if (virtual && !files[virtual]) files[virtual] = PLACEHOLDER;
  }
  for (const instance of layout.instances()) {
    if (!Object.hasOwn(RUNTIME_FILES, instance.name)) continue;
    const patterns = RUNTIME_FILES[instance.name]
      ?? [...(instance.json.files ?? ['**/*']), 'package.json'];
    let size = 0;
    for (const relative of listPackageFiles(instance.realDir, patterns)) {
      const content = readFileSync(
        path.join(realpathSync(instance.realDir), relative),
        'utf-8',
      );
      files[`${instance.virtualDir}/${relative}`] = content;
      size += content.length;
    }
    sizes[instance.virtualDir] = size;
  }
  const sorted = Object.fromEntries(
    Object.keys(files).sort().map((key) => [key, files[key]]),
  );
  return { files: sorted, sizes };
}
