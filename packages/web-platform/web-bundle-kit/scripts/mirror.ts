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

import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { Layout } from './layout.ts';
import { toPosix } from './paths.ts';

/**
 * Packages, by name in the virtual tree, whose files are compiled into a card
 * or read at build time, with the files to take. `null` takes the files the
 * package publishes (its `files` field).
 */
const RUNTIME_FILES: Record<string, string[] | null> = {
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

/** The content of `mirror.json`. */
export interface Mirror {
  /** Virtual path -> content. */
  files: Record<string, string>;
  /** Virtual directory of a runtime package -> size of its mirrored files. */
  sizes: Record<string, number>;
}

/**
 * The files of the package in `realDir` that `patterns` (`files` globs, with
 * `!` for exclusions) match, a directory standing for the files in it.
 */
function listPackageFiles(realDir: string, patterns: string[]): string[] {
  const excluded = new Set(
    patterns.filter((pattern) => pattern.startsWith('!')).flatMap((pattern) =>
      globSync(pattern.slice(1), { cwd: realDir }).map((file) => toPosix(file))
    ),
  );
  const included = patterns.filter((pattern) => !pattern.startsWith('!'));
  const files = globSync(
    included.flatMap((pattern) => [pattern, `${pattern}/**`]),
    { cwd: realDir, withFileTypes: true },
  ).filter((entry) => entry.isFile()).map((entry) =>
    toPosix(path.relative(realDir, path.join(entry.parentPath, entry.name)))
  );
  return [...new Set(files)].filter((file) =>
    !excluded.has(file) && !EXCLUDE.some((re) => re.test(file))
  ).sort();
}

/**
 * Collects the mirror from the layout and the real paths of the modules
 * bundled into the kit.
 */
export function collectMirror(
  { layout, bundled }: { layout: Layout; bundled: Set<string> },
): Mirror {
  const files: Record<string, string> = {};
  const sizes: Record<string, number> = {};
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
        path.join(instance.realDir, relative),
        'utf-8',
      );
      files[`${instance.virtualDir}/${relative}`] = content;
      size += content.length;
    }
    sizes[instance.virtualDir] = size;
  }
  const sorted = Object.fromEntries(
    Object.keys(files).sort().map((key) => [key, files[key]!]),
  );
  return { files: sorted, sizes };
}
