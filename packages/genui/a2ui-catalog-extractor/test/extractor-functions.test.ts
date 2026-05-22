// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, test } from '@rstest/core';

import {
  extractCatalogFunctions,
  findCatalogSourceFiles,
  writeCatalogArtifacts,
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const packageDir = path.resolve(path.dirname(__filename), '..');
const fixtureDir = path.join(packageDir, 'test/fixtures');
const catalogFixtureDir = path.join(fixtureDir, 'catalog');
const functionsFixtureDir = path.join(fixtureDir, 'functions');
const expectedFunctionsDir = path.join(fixtureDir, 'expected-functions');
const fixtureTsconfig = 'tsconfig.json';
const tempDirs: string[] = [];

void afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('extractCatalogFunctions', () => {
  test('extracts function definitions from TS fixtures', async () => {
    const functions = await extractCatalogFunctions({
      cwd: fixtureDir,
      sourceFiles: findCatalogSourceFiles(functionsFixtureDir),
      tsconfig: fixtureTsconfig,
    });

    const byName = Object.fromEntries(functions.map(fn => [fn.name, fn]));
    expect(Object.keys(byName).sort()).toEqual(['formatString', 'required']);

    const expectedRequired = readExpectedFunctionJson('required');
    const expectedFormatString = readExpectedFunctionJson('formatString');

    expect(byName['required']).toMatchObject({
      filePath: path.join(functionsFixtureDir, 'basicFunctions.ts'),
      ...expectedRequired['required'],
    });
    expect(byName['formatString']).toMatchObject({
      filePath: path.join(functionsFixtureDir, 'basicFunctions.ts'),
      ...expectedFormatString['formatString'],
    });
  });

  test('writeCatalogArtifacts emits both component and function files', async () => {
    const outDir = createTempDir();
    const sourceFiles = [
      ...findCatalogSourceFiles(catalogFixtureDir),
      ...findCatalogSourceFiles(functionsFixtureDir),
    ];

    const { components, functions } = await writeCatalogArtifacts({
      cwd: fixtureDir,
      outDir,
      sourceFiles,
      tsconfig: fixtureTsconfig,
    });

    expect(components.map(component => component.name).sort()).toEqual([
      'DemoCard',
      'DemoText',
      'QuickStartCard',
    ]);
    expect(functions.map(fn => fn.name).sort()).toEqual([
      'formatString',
      'required',
    ]);

    expect(readFunctionJson(outDir, 'required')).toEqual(
      readExpectedFunctionJson('required'),
    );
    expect(readFunctionJson(outDir, 'formatString')).toEqual(
      readExpectedFunctionJson('formatString'),
    );
  });

  test('rejects async return types', async () => {
    await expect(extractCatalogFunctions({
      cwd: fixtureDir,
      sourceFiles: ['invalid/AsyncFunction.ts'],
      tsconfig: fixtureTsconfig,
    })).rejects.toThrow(/Async functions are not supported/);
  });
});

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2ui-catalog-out-'));
  tempDirs.push(dir);
  return dir;
}

function readExpectedFunctionJson(
  name: string,
): Record<string, Record<string, unknown>> {
  return JSON.parse(
    fs.readFileSync(path.join(expectedFunctionsDir, `${name}.json`), 'utf8'),
  ) as Record<string, Record<string, unknown>>;
}

function readFunctionJson(
  rootDir: string,
  name: string,
): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(
      path.join(rootDir, 'functions', `${name}.json`),
      'utf8',
    ),
  ) as Record<string, unknown>;
}
