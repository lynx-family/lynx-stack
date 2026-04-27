// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from '@rstest/core';

import {
  createA2UICatalog,
  extractCatalogComponents,
  extractCatalogComponentsFromTypeDocJson,
  writeComponentCatalogs,
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const packageDir = path.resolve(path.dirname(__filename), '..');
const a2uiDir = path.resolve(packageDir, '../a2ui');
const a2uiDistCatalogDir = path.join(a2uiDir, 'dist/catalog');
const a2uiSourceCatalogDir = path.join(a2uiDir, 'src/catalog');

describe('extractCatalogComponents', () => {
  test('extracts a component schema from a TypeDoc-marked interface', async () => {
    const fixtureDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'a2ui-catalog-fixture-'),
    );
    const fixture = path.join(fixtureDir, 'DemoCard.tsx');
    const fixtureTsconfig = path.join(fixtureDir, 'tsconfig.json');
    fs.writeFileSync(
      fixture,
      `
/**
 * @a2uiCatalog DemoCard
 */
export interface DemoCardProps {
  /** Main title. */
  title: string | { path: string };
  /** Visual tone. */
  tone?: 'neutral' | 'accent';
  /** Extra payload.
   * @defaultValue \`{}\`
   */
  context?: Record<string, string | number | boolean>;
  action: {
    event: {
      name: string;
    };
  };
}
`,
    );
    fs.writeFileSync(
      fixtureTsconfig,
      JSON.stringify({
        compilerOptions: {
          jsx: 'preserve',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          target: 'ESNext',
        },
        include: ['DemoCard.tsx'],
      }),
    );

    const components = await extractCatalogComponents({
      cwd: fixtureDir,
      sourceFiles: ['DemoCard.tsx'],
    });

    expect(components).toEqual([
      {
        filePath: fixture,
        interfaceName: 'DemoCardProps',
        name: 'DemoCard',
        schema: {
          properties: {
            title: {
              oneOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: { path: { type: 'string' } },
                  required: ['path'],
                  additionalProperties: false,
                },
              ],
              description: 'Main title.',
            },
            tone: {
              type: 'string',
              enum: ['neutral', 'accent'],
              description: 'Visual tone.',
            },
            context: {
              type: 'object',
              additionalProperties: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                  { type: 'boolean' },
                ],
              },
              description: 'Extra payload.',
              default: {},
            },
            action: {
              type: 'object',
              properties: {
                event: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                  },
                  required: ['name'],
                  additionalProperties: false,
                },
              },
              required: ['event'],
              additionalProperties: false,
            },
          },
          required: ['title', 'action'],
        },
      },
    ]);
  });

  test('extracts a component schema from TypeDoc JSON', () => {
    const components = extractCatalogComponentsFromTypeDocJson({
      children: [
        {
          name: 'DemoTextProps',
          kindString: 'Interface',
          comment: {
            blockTags: [
              {
                tag: '@a2uiCatalog',
                content: [{ text: 'DemoText' }],
              },
            ],
          },
          children: [
            {
              name: 'text',
              kindString: 'Property',
              comment: {
                summary: [{ text: 'Literal text or path binding.' }],
              },
              type: {
                type: 'union',
                types: [
                  { type: 'intrinsic', name: 'string' },
                  {
                    type: 'reflection',
                    declaration: {
                      name: '__type',
                      children: [
                        {
                          name: 'path',
                          kindString: 'Property',
                          type: { type: 'intrinsic', name: 'string' },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(components).toEqual([
      {
        filePath: '',
        interfaceName: 'DemoTextProps',
        name: 'DemoText',
        schema: {
          properties: {
            text: {
              description: 'Literal text or path binding.',
              oneOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: { path: { type: 'string' } },
                  required: ['path'],
                  additionalProperties: false,
                },
              ],
            },
          },
          required: ['text'],
        },
      },
    ]);
  });

  test('throws for ambiguous intrinsic catalog property types', () => {
    expect(() =>
      extractCatalogComponentsFromTypeDocJson({
        children: [
          {
            name: 'DemoPayloadProps',
            kindString: 'Interface',
            comment: {
              blockTags: [
                {
                  tag: '@a2uiCatalog',
                  content: [{ text: 'DemoPayload' }],
                },
              ],
            },
            children: [
              {
                name: 'payload',
                kindString: 'Property',
                type: { type: 'intrinsic', name: 'unknown' },
              },
            ],
          },
        ],
      })
    ).toThrow(
      'Unsupported ambiguous intrinsic TypeDoc type "unknown" for "payload".',
    );
  });

  test('throws for nullable unions instead of silently dropping null', () => {
    expect(() =>
      extractCatalogComponentsFromTypeDocJson({
        children: [
          {
            name: 'DemoNullableProps',
            kindString: 'Interface',
            comment: {
              blockTags: [
                {
                  tag: '@a2uiCatalog',
                  content: [{ text: 'DemoNullable' }],
                },
              ],
            },
            children: [
              {
                name: 'label',
                kindString: 'Property',
                type: {
                  type: 'union',
                  types: [
                    { type: 'intrinsic', name: 'string' },
                    { type: 'literal', value: null },
                  ],
                },
              },
            ],
          },
        ],
      })
    ).toThrow('Unsupported nullable union for "label".');
  });

  test('generates JSON deep-equal to packages/genui/a2ui/dist/catalog', async () => {
    const expectedCatalogs = readDistCatalogs();
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2ui-catalog-out-'));

    await writeComponentCatalogs({
      cwd: a2uiDir,
      outDir,
      sourceFiles: expectedCatalogs.map(({ componentName }) =>
        getSourceFileForComponent(componentName)
      ),
    });

    for (const expectedCatalog of expectedCatalogs) {
      const actualJsonPath = path.join(
        outDir,
        expectedCatalog.componentName,
        'catalog.json',
      );
      expect(JSON.parse(fs.readFileSync(actualJsonPath, 'utf8'))).toEqual(
        expectedCatalog.json,
      );
    }
  });

  test('can create a full catalog from extracted components', async () => {
    const textCatalog = readDistCatalogs().find(({ componentName }) =>
      componentName === 'Text'
    );
    expect(textCatalog).toBeDefined();

    const components = await extractCatalogComponents({
      cwd: a2uiDir,
      sourceFiles: [getSourceFileForComponent('Text')],
    });

    expect(createA2UICatalog({
      catalogId: 'https://example.com/catalog.json',
      components,
    })).toEqual({
      catalogId: 'https://example.com/catalog.json',
      components: {
        Text: textCatalog!.json['Text'],
      },
    });
  });
});

function readDistCatalogs(): {
  componentName: string;
  json: Record<string, unknown>;
}[] {
  expect(fs.existsSync(a2uiDistCatalogDir)).toBe(true);

  const catalogJsonPaths = fs.readdirSync(a2uiDistCatalogDir)
    .map(componentName => path.join(a2uiDistCatalogDir, componentName))
    .filter(componentPath => fs.statSync(componentPath).isDirectory())
    .map(componentPath => path.join(componentPath, 'catalog.json'))
    .filter(catalogJsonPath => fs.existsSync(catalogJsonPath))
    .sort((left, right) => left.localeCompare(right));

  expect(catalogJsonPaths.length).toBeGreaterThan(0);

  return catalogJsonPaths.map(catalogJsonPath => {
    const componentName = path.basename(path.dirname(catalogJsonPath));
    return {
      componentName,
      json: JSON.parse(fs.readFileSync(catalogJsonPath, 'utf8')) as Record<
        string,
        unknown
      >,
    };
  });
}

function getSourceFileForComponent(componentName: string): string {
  return path.join(a2uiSourceCatalogDir, componentName, 'index.tsx');
}
