// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from '@rstest/core';

import {
  checkCatalogFiles,
  extractCatalog,
  renderCatalogFiles,
  writeCatalogFiles,
} from '../src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..', '..', '..');

function fixturePath(...segments: string[]): string {
  return path.join(__dirname, 'fixtures', ...segments);
}

async function withTempDir<T>(
  prefix: string,
  callback: (directory: string) => Promise<T>,
): Promise<T> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await callback(directory);
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
}

describe('extractCatalog', () => {
  test('extracts TSX declarations and standard tags', async () => {
    const result = await extractCatalog({
      sourceDir: fixturePath('tsx', 'catalog'),
      tsconfigPath: fixturePath('tsx', 'tsconfig.json'),
    });

    expect(result.components).toHaveLength(1);
    expect(result.components[0]?.name).toBe('Chip');
    expect(result.components[0]?.schema).toEqual({
      properties: {
        label: {
          description: 'Label text or a binding path.',
          oneOf: [
            { type: 'string' },
            {
              additionalProperties: false,
              properties: {
                path: {
                  type: 'string',
                },
              },
              required: ['path'],
              type: 'object',
            },
          ],
        },
        tone: {
          default: 'primary',
          description: 'Visual tone.',
          enum: ['primary', 'secondary'],
          type: 'string',
        },
      },
      required: ['label'],
    });
  });

  test('extracts JSX typedef/property shapes in best-effort mode', async () => {
    const result = await extractCatalog({
      sourceDir: fixturePath('jsx', 'catalog'),
      tsconfigPath: fixturePath('jsx', 'tsconfig.json'),
    });

    expect(result.components).toHaveLength(1);
    expect(result.components[0]?.schema).toEqual({
      properties: {
        text: {
          description: 'Literal badge text.',
          oneOf: [
            { type: 'string' },
            {
              additionalProperties: false,
              properties: {
                path: {
                  type: 'string',
                },
              },
              required: ['path'],
              type: 'object',
            },
          ],
        },
        tone: {
          description: 'Badge tone.',
          enum: ['info', 'warning'],
          type: 'string',
        },
      },
      required: ['text'],
    });
  });

  test('extracts nested TSX object graphs without custom schema tags', async () => {
    const result = await extractCatalog({
      sourceDir: fixturePath('tsx-complex', 'catalog'),
      tsconfigPath: fixturePath('tsx-complex', 'tsconfig.json'),
    });

    expect(result.components).toHaveLength(1);
    expect(result.components[0]?.schema).toEqual({
      properties: {
        action: {
          additionalProperties: false,
          description: 'Host action payload.',
          properties: {
            event: {
              additionalProperties: false,
              properties: {
                context: {
                  additionalProperties: {
                    oneOf: [
                      { type: 'string' },
                      { type: 'number' },
                      { type: 'boolean' },
                      {
                        additionalProperties: false,
                        properties: {
                          path: {
                            type: 'string',
                          },
                        },
                        required: ['path'],
                        type: 'object',
                      },
                    ],
                  },
                  description: 'Context is a JSON object map in v0.9.',
                  type: 'object',
                },
                name: {
                  type: 'string',
                },
              },
              required: ['name'],
              type: 'object',
            },
          },
          required: ['event'],
          type: 'object',
        },
      },
      required: ['action'],
    });
  });

  test('rejects literal undefined defaults with a clear error', async () => {
    await expect(extractCatalog({
      sourceDir: fixturePath('tsx-invalid-default', 'catalog'),
      tsconfigPath: fixturePath('tsx-invalid-default', 'tsconfig.json'),
    })).rejects.toThrow(
      'The literal "undefined" is not supported in @defaultValue.',
    );
  });

  test('wraps malformed JSON errors with tag context', async () => {
    await expect(extractCatalog({
      sourceDir: fixturePath('tsx-invalid-json', 'catalog'),
      tsconfigPath: fixturePath('tsx-invalid-json', 'tsconfig.json'),
    })).rejects.toThrow('Failed to parse @defaultValue value');
  });

  test('rejects named re-export component entry files', async () => {
    await expect(extractCatalog({
      sourceDir: fixturePath('tsx-invalid-export-named', 'catalog'),
      tsconfigPath: fixturePath('tsx-invalid-export-named', 'tsconfig.json'),
    })).rejects.toThrow('Unsupported component export');
  });

  test('rejects default-export component entry files', async () => {
    await expect(extractCatalog({
      sourceDir: fixturePath('tsx-invalid-export-default', 'catalog'),
      tsconfigPath: fixturePath('tsx-invalid-export-default', 'tsconfig.json'),
    })).rejects.toThrow('Unsupported component export');
  });

  test('fails loudly on unsupported TSX type syntax', async () => {
    await expect(extractCatalog({
      sourceDir: fixturePath('tsx-invalid-type', 'catalog'),
      tsconfigPath: fixturePath('tsx-invalid-type', 'tsconfig.json'),
    })).rejects.toThrow('Unsupported type "Map<string, string>"');
  });

  test('keeps unsupported JSX types in best-effort string mode', async () => {
    const result = await extractCatalog({
      sourceDir: fixturePath('jsx-loose', 'catalog'),
      tsconfigPath: fixturePath('jsx-loose', 'tsconfig.json'),
    });

    expect(result.components).toHaveLength(1);
    expect(result.components[0]?.schema).toEqual({
      properties: {
        value: {
          description: 'Unsupported types fall back to string in JSX mode.',
          type: 'string',
        },
      },
      required: ['value'],
    });
  });

  test('matches the legacy A2UI catalog fixtures exactly', async () => {
    const result = await extractCatalog({
      sourceDir: path.join(workspaceRoot, 'packages/genui/a2ui/src/catalog'),
      tsconfigPath: path.join(
        workspaceRoot,
        'packages/genui/a2ui/tsconfig.json',
      ),
    });

    const renderedFiles = renderCatalogFiles(result, {
      outDir: path.join(workspaceRoot, 'packages/genui/a2ui/dist/catalog'),
    });

    expect(renderedFiles).toHaveLength(10);

    for (const renderedFile of renderedFiles) {
      const componentName = path.basename(path.dirname(renderedFile.path));
      const fixtureFile = fixturePath(
        'legacy-baseline',
        componentName,
        'catalog.json',
      );
      const expected = await fs.readFile(fixtureFile, 'utf8');
      expect(renderedFile.content).toBe(expected);
    }
  });

  test('renders full catalog output from the API', async () => {
    const result = await extractCatalog({
      catalogId: 'demo-catalog',
      description: 'Demo catalog',
      format: 'a2ui-catalog',
      functions: {
        open: {
          type: 'string',
        },
      },
      schema: 'https://example.com/catalog.schema.json',
      sourceDir: fixturePath('tsx', 'catalog'),
      theme: {
        color: 'blue',
      },
      title: 'Demo',
      tsconfigPath: fixturePath('tsx', 'tsconfig.json'),
    });

    expect(result.catalog).toEqual({
      $schema: 'https://example.com/catalog.schema.json',
      catalogId: 'demo-catalog',
      components: {
        Chip: result.components[0]?.schema,
      },
      description: 'Demo catalog',
      functions: {
        open: {
          type: 'string',
        },
      },
      theme: {
        color: 'blue',
      },
      title: 'Demo',
    });
  });
});

describe('catalog file helpers', () => {
  test('writeCatalogFiles and checkCatalogFiles round-trip generated shards', async () => {
    await withTempDir('a2ui-catalog-roundtrip-', async (outputDir) => {
      const result = await extractCatalog({
        sourceDir: fixturePath('tsx', 'catalog'),
        tsconfigPath: fixturePath('tsx', 'tsconfig.json'),
      });

      await writeCatalogFiles(result, { outDir: outputDir });
      const generatedPath = path.join(outputDir, 'Chip', 'catalog.json');

      const initialCheck = await checkCatalogFiles(result, {
        outDir: outputDir,
      });
      expect(initialCheck.ok).toBe(true);

      const lfContent = await fs.readFile(generatedPath, 'utf8');
      await fs.writeFile(
        generatedPath,
        lfContent.replace(/\n/gu, '\r\n'),
        'utf8',
      );

      const crlfCheck = await checkCatalogFiles(result, { outDir: outputDir });
      expect(crlfCheck.ok).toBe(true);

      await fs.writeFile(generatedPath, '{}\r\n', 'utf8');

      const changedCheck = await checkCatalogFiles(result, {
        outDir: outputDir,
      });
      expect(changedCheck.ok).toBe(false);
      expect(changedCheck.mismatched).toContain(generatedPath);
    });
  });
});
