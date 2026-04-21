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

const legacySourceDirs = [
  'alog',
  'compat',
  'debug',
  'gesture',
  'hooks',
  'legacy-react-runtime',
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

const containedTestDirs = [
  'alog',
  'compat',
  'css',
  'debug',
  'gesture',
  'hooks',
  'lifecycle',
  'lynx',
  'utils',
  'worklet',
];

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

describe('snapshot containment guardrails', () => {
  test('keeps legacy runtime implementation directories under snapshot backend', () => {
    for (const dir of legacySourceDirs) {
      expect(fs.existsSync(path.join(srcRoot, dir)), dir).toBe(false);
      expect(fs.existsSync(path.join(srcRoot, 'snapshot', dir)), dir).toBe(true);
    }
  });

  test('keeps legacy runtime tests under snapshot test namespace', () => {
    for (const dir of containedTestDirs) {
      expect(fs.existsSync(path.join(testRoot, dir)), dir).toBe(false);
      expect(fs.existsSync(path.join(testRoot, 'snapshot', dir)), dir).toBe(true);
    }
  });

  test('keeps loose legacy runtime tests under snapshot test namespace', () => {
    const looseRuntimeTests = fs.readdirSync(testRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .filter((entry) => /\.(?:[cm]?[jt]sx?)$/.test(entry.name))
      .map((entry) => entry.name);

    expect(looseRuntimeTests).toEqual([]);
  });

  test('does not import old implementation paths outside the snapshot backend', () => {
    const oldPathPattern = new RegExp(
      String.raw`(?:from\s+|import\s*\(\s*)['"]\.{1,2}/(?:${legacySourceDirPattern})(?:/|['"])`,
    );
    const offenders = walkFiles(srcRoot)
      .filter((file) => !file.includes(`${path.sep}src${path.sep}snapshot${path.sep}`))
      .filter((file) => oldPathPattern.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(runtimeRoot, file));

    expect(offenders).toEqual([]);
  });

  test('prevents element-template from depending on snapshot private paths', () => {
    const elementTemplateRoot = path.join(srcRoot, 'element-template');
    const forbiddenImportPattern =
      /(?:from\s+|import\s*\(\s*)['"]\.{1,2}\/(?:snapshot|internal|root|lifecycle|renderToOpcodes)(?:\/|['"])/;
    const offenders = walkFiles(elementTemplateRoot)
      .filter((file) => forbiddenImportPattern.test(fs.readFileSync(file, 'utf8')))
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

  test('keeps package type metadata aligned with contained runtime paths', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(reactRoot, 'package.json'), 'utf8'),
    );
    const typesVersions = JSON.stringify(packageJson.typesVersions ?? {});

    expect(typesVersions).not.toContain('./runtime/lib/hooks/');
    expect(typesVersions).not.toContain('./runtime/lib/legacy-react-runtime/');
    expect(typesVersions).toContain('./runtime/lib/snapshot/hooks/react.d.ts');
    expect(typesVersions).toContain(
      './runtime/lib/snapshot/legacy-react-runtime/index.d.ts',
    );
  });
});
