// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(testDir, '../..');
const reactRoot = path.resolve(runtimeRoot, '..');
const srcRoot = path.join(runtimeRoot, 'src');
const testRoot = path.join(runtimeRoot, '__test__');
const transformRoot = path.join(reactRoot, 'transform');
const coreRoot = path.join(srcRoot, 'core');
const sharedRoot = path.join(srcRoot, 'shared');

const legacySourceDirs = [
  'alog',
  'compat',
  'debug',
  'gesture',
  'lifecycle',
  'list',
  'lynx',
  'renderToOpcodes',
  'worklet',
];
const legacySourceDirPattern = legacySourceDirs.join('|');
const knownTransformSourcePathExceptions = new Set([
  'transform/src/swc_plugin_compat_post/mod.rs',
  'transform/tests/__swc_snapshots__/src/swc_plugin_compat_post/mod.rs/should_compat_dark_mode.js',
  'transform/tests/__swc_snapshots__/src/swc_plugin_compat_post/mod.rs/should_compat_dark_mode_custom_theme_expr.js',
]);
const snapshotRootFiles = new Set(
  ['document', 'index', 'internal', 'lynx', 'lynx-api', 'root', 'runtime-marker'].map((name) =>
    path.join(srcRoot, name)
  ),
);

function toPosixPath(file: string): string {
  return file.split(path.sep).join('/');
}

function walkFiles(dir: string, pattern = /\.(?:[cm]?[jt]sx?)$/): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(target, pattern);
    }
    return pattern.test(entry.name) ? [target] : [];
  });
}

function getResolvedRelativeImports(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  const relativeImportPattern = /(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g;
  return Array.from(
    source.matchAll(relativeImportPattern),
    (match) => path.resolve(path.dirname(file), match[1]!),
  );
}

function stripModuleExtension(filePath: string): string {
  return filePath.replace(/\.(?:[cm]?[jt]sx?)$/, '');
}

describe('snapshot containment guardrails', () => {
  test('keeps loose legacy runtime tests under snapshot test namespace', () => {
    const looseRuntimeTests = fs.readdirSync(testRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .filter((entry) => /\.(?:[cm]?[jt]sx?)$/.test(entry.name))
      .map((entry) => entry.name);

    expect(looseRuntimeTests).toEqual([]);
  });

  test('prevents element-template from depending on snapshot private paths', () => {
    const elementTemplateRoot = path.join(srcRoot, 'element-template');
    const snapshotPrefix = `${path.join(srcRoot, 'snapshot')}${path.sep}`;
    const offenders = walkFiles(elementTemplateRoot)
      .filter((file) =>
        getResolvedRelativeImports(file).some((resolved) =>
          resolved.startsWith(snapshotPrefix) || snapshotRootFiles.has(stripModuleExtension(resolved))
        )
      )
      .map((file) => path.relative(runtimeRoot, file));

    expect(offenders).toEqual([]);
  });

  test('keeps the ET lazy import entry on ET-owned root/internal and background JSX runtime exports', () => {
    const entry = path.join(runtimeRoot, 'lazy', 'element-template-import.js');

    expect(fs.existsSync(entry)).toBe(true);

    const code = fs.readFileSync(entry, 'utf8');

    expect(code).toContain('@lynx-js/react/element-template');
    expect(code).toContain('@lynx-js/react/compat');
    expect(code).toContain('@lynx-js/react/element-template/internal');
    expect(code).toContain('@lynx-js/react/jsx-runtime');
    expect(code).toContain('@lynx-js/react/jsx-dev-runtime');
    expect(code).toContain('@lynx-js/react/legacy-react-runtime');
    expect(code).not.toContain('@lynx-js/react/element-template/jsx-runtime');
    expect(code).not.toContain('@lynx-js/react/element-template/jsx-dev-runtime');
    expect(code).not.toContain('@lynx-js/react/internal');
    expect(code).not.toContain('@lynx-js/react/lepus');
    expect(code).not.toMatch(
      /snapshot\/|SnapshotInstance|snapshotCreatorMap|__ComponentIsPolyfill|__DynamicPart|lazy-bundle-url/,
    );
  });

  test('prevents core and shared modules from depending on runtime backends', () => {
    const backendPrefixes = [
      `${path.join(srcRoot, 'snapshot')}${path.sep}`,
      `${path.join(srcRoot, 'element-template')}${path.sep}`,
    ];
    const offenders = [
      ...walkFiles(coreRoot),
      ...walkFiles(sharedRoot),
    ]
      .filter((file) =>
        getResolvedRelativeImports(file).some((resolved) =>
          backendPrefixes.some((prefix) => resolved.startsWith(prefix))
          || snapshotRootFiles.has(stripModuleExtension(resolved))
        )
      )
      .map((file) => path.relative(runtimeRoot, file));

    expect(offenders).toEqual([]);
  });

  test('keeps shared modules pure and free of framework or higher-layer runtime imports', () => {
    const sharedPrefix = `${sharedRoot}${path.sep}`;
    const importSpecifierPattern = /(?:from\s+|import\s*\(\s*|import\s+(?:type\s+)?)['"]([^'"]+)['"]/g;
    const offenders = walkFiles(sharedRoot)
      .filter((file) => {
        const source = fs.readFileSync(file, 'utf8');
        const specifiers = Array.from(source.matchAll(importSpecifierPattern), (match) => match[1]!);
        return specifiers.some((specifier) => {
          if (!specifier.startsWith('.')) {
            return true;
          }
          const resolved = path.resolve(path.dirname(file), specifier);
          return !resolved.startsWith(sharedPrefix);
        });
      })
      .map((file) => path.relative(runtimeRoot, file));

    expect(offenders).toEqual([]);
  });

  test('prevents transform output from referencing untracked old runtime source paths', () => {
    const oldPackageSourcePattern = new RegExp(
      String.raw`@lynx-js/react/src/(?:${legacySourceDirPattern})(?:/|['"])`,
    );
    const offenders = walkFiles(transformRoot, /\.(?:rs|[cm]?[jt]sx?)$/)
      .map((file) => toPosixPath(path.relative(reactRoot, file)))
      .filter((file) => !knownTransformSourcePathExceptions.has(file))
      .filter((file) =>
        oldPackageSourcePattern.test(
          fs.readFileSync(path.join(reactRoot, file), 'utf8'),
        )
      );

    expect(offenders).toEqual([]);
  });
});
