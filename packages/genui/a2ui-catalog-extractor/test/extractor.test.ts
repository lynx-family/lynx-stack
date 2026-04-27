// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, test } from '@rstest/core';

import { runCli } from '../src/cli.js';
import {
  createA2UICatalog,
  extractCatalogComponents,
  findCatalogSourceFiles,
  writeComponentCatalogs,
} from '../src/index.js';
import type { TypeDocProject } from '../src/index.js';

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
      'QuickStartCard.tsx',
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
      'QuickStartCard',
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
    expect(componentsByName['QuickStartCard']).toMatchObject({
      filePath: path.join(catalogFixtureDir, 'QuickStartCard.tsx'),
      interfaceName: 'QuickStartCardProps',
      name: 'QuickStartCard',
      schema: expectedCatalogs['QuickStartCard']!['QuickStartCard'],
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
      'QuickStartCard',
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
      functions: [
        {
          description: 'Format a raw value for display.',
          name: 'formatDisplayValue',
          parameters: {
            type: 'object',
            properties: {
              value: { type: 'string' },
            },
            required: ['value'],
            additionalProperties: false,
          },
          returnType: 'string',
        },
      ],
      theme: {
        accentColor: { type: 'string' },
      },
    })).toEqual({
      catalogId: 'https://example.com/catalog.json',
      components: {
        DemoCard: expectedCatalogs['DemoCard']!['DemoCard'],
        DemoText: expectedCatalogs['DemoText']!['DemoText'],
        QuickStartCard: expectedCatalogs['QuickStartCard']!['QuickStartCard'],
      },
      functions: [
        {
          description: 'Format a raw value for display.',
          name: 'formatDisplayValue',
          parameters: {
            type: 'object',
            properties: {
              value: { type: 'string' },
            },
            required: ['value'],
            additionalProperties: false,
          },
          returnType: 'string',
        },
      ],
      theme: {
        accentColor: { type: 'string' },
      },
    });
  });

  test('writes catalog files from an existing TypeDoc JSON project through the CLI', async () => {
    const cwd = createTempDir();
    const typedocJsonPath = path.join(cwd, 'typedoc.json');
    fs.writeFileSync(
      typedocJsonPath,
      `${JSON.stringify(createCliTypeDocProjectFixture(), null, 2)}\n`,
    );

    await expect(runCli([
      '--typedoc-json',
      'typedoc.json',
      '--out-dir',
      'catalog-out',
    ], cwd)).resolves.toBe(0);

    expect(readCatalogJson(path.join(cwd, 'catalog-out'), 'CliBadge')).toEqual({
      CliBadge: {
        properties: {
          label: {
            type: 'string',
            description: 'Badge label.',
          },
        },
        required: ['label'],
        description: 'CLI badge fixture.',
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

function createCliTypeDocProjectFixture(): TypeDocProject {
  return {
    children: [
      {
        kindString: 'Interface',
        name: 'CliBadgeProps',
        comment: {
          summary: [{ text: 'CLI badge fixture.' }],
          blockTags: [
            {
              tag: '@a2uiCatalog',
              content: [{ text: 'CliBadge' }],
            },
          ],
        },
        children: [
          {
            kindString: 'Property',
            name: 'label',
            comment: {
              summary: [{ text: 'Badge label.' }],
            },
            type: {
              type: 'intrinsic',
              name: 'string',
            },
          },
        ],
      },
    ],
  };
}
