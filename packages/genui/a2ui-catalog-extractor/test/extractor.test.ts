// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, test } from '@rstest/core';

import {
  createA2UICatalog,
  extractCatalogComponents,
  findCatalogSourceFiles,
  writeComponentCatalogs,
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const packageDir = path.resolve(path.dirname(__filename), '..');
const fixtureDir = path.join(packageDir, 'test/fixtures');
const catalogFixtureDir = path.join(fixtureDir, 'catalog');
const expectedCatalogDir = path.join(fixtureDir, 'expected-catalog');
const fixtureTsconfig = 'tsconfig.json';
const tempDirs: string[] = [];

void afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('extractCatalogComponents', () => {
  test('extracts component schemas from TSX catalog fixtures', async () => {
    const sourceFiles = findCatalogSourceFiles(catalogFixtureDir);

    expect(sourceFiles.map(file => path.basename(file))).toEqual([
      'DemoCard.tsx',
      'DemoText.tsx',
    ]);

    const components = await extractCatalogComponents({
      cwd: fixtureDir,
      sourceFiles,
      tsconfig: fixtureTsconfig,
    });
    const componentsByName = Object.fromEntries(
      components.map(component => [component.name, component]),
    );
    const expectedCatalogs = readExpectedCatalogs();

    expect(Object.keys(componentsByName).sort()).toEqual([
      'DemoCard',
      'DemoText',
    ]);
    expect(componentsByName['DemoCard']).toMatchObject({
      filePath: path.join(catalogFixtureDir, 'DemoCard.tsx'),
      interfaceName: 'DemoCardProps',
      name: 'DemoCard',
      schema: expectedCatalogs['DemoCard']!['DemoCard'],
    });
    expect(componentsByName['DemoText']).toMatchObject({
      filePath: path.join(catalogFixtureDir, 'DemoText.tsx'),
      interfaceName: 'DemoTextProps',
      name: 'DemoText',
      schema: expectedCatalogs['DemoText']!['DemoText'],
    });
  });

  test('writes catalog.json files from TSX catalog fixtures', async () => {
    const outDir = createTempDir();
    const expectedCatalogs = readExpectedCatalogs();

    const components = await writeComponentCatalogs({
      cwd: fixtureDir,
      outDir,
      sourceFiles: findCatalogSourceFiles(catalogFixtureDir),
      tsconfig: fixtureTsconfig,
    });

    expect(components.map(component => component.name).sort()).toEqual([
      'DemoCard',
      'DemoText',
    ]);

    for (const componentName of Object.keys(expectedCatalogs)) {
      expect(readCatalogJson(outDir, componentName)).toEqual(
        expectedCatalogs[componentName],
      );
    }
  });

  test('creates a full catalog from TSX-extracted components', async () => {
    const components = await extractCatalogComponents({
      cwd: fixtureDir,
      sourceFiles: findCatalogSourceFiles(catalogFixtureDir),
      tsconfig: fixtureTsconfig,
    });
    const expectedCatalogs = readExpectedCatalogs();

    expect(createA2UICatalog({
      catalogId: 'https://example.com/catalog.json',
      components,
    })).toEqual({
      catalogId: 'https://example.com/catalog.json',
      components: {
        DemoCard: expectedCatalogs['DemoCard']!['DemoCard'],
        DemoText: expectedCatalogs['DemoText']!['DemoText'],
      },
    });
  });

  test('throws for ambiguous intrinsic catalog property types in TSX fixtures', async () => {
    await expect(extractCatalogComponents({
      cwd: fixtureDir,
      sourceFiles: ['invalid/AmbiguousPayload.tsx'],
      tsconfig: fixtureTsconfig,
    })).rejects.toThrow(
      'Unsupported ambiguous intrinsic TypeDoc type "unknown" for "payload".',
    );
  });

  test('throws for nullable unions in TSX fixtures', async () => {
    await expect(extractCatalogComponents({
      cwd: fixtureDir,
      sourceFiles: ['invalid/NullableLabel.tsx'],
      tsconfig: fixtureTsconfig,
    })).rejects.toThrow('Unsupported nullable union for "label".');
  });
});

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2ui-catalog-out-'));
  tempDirs.push(dir);
  return dir;
}

function readExpectedCatalogs(): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    fs.readdirSync(expectedCatalogDir)
      .map(componentName => [
        componentName,
        readCatalogJson(expectedCatalogDir, componentName),
      ]),
  );
}

function readCatalogJson(
  rootDir: string,
  componentName: string,
): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(
      path.join(rootDir, componentName, 'catalog.json'),
      'utf8',
    ),
  ) as Record<string, unknown>;
}
