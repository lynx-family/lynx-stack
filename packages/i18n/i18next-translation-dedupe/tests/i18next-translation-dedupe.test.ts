// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginI18nextExtractor } from 'rsbuild-plugin-i18next-extractor';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { createRspeedy } from '@lynx-js/rspeedy';

import { pluginLynxI18nextTranslationDedupe } from '../src/index.js';

interface TasmJson {
  customSections?: Record<string, {
    content?: Record<string, unknown>;
    type?: 'lazy';
  }>;
}

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(testDir, 'fixtures/i18next-rspeedy-project');
const pluginReactRoot = path.resolve(testDir, '../../../rspeedy/plugin-react');

beforeEach(() => {
  vi.stubEnv('DEBUG', 'rspeedy');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('i18next translation dedupe integration', () => {
  test('build injects i18n translations into customSections and removes JS inline translations', async () => {
    const distRoot = await mkdtemp(
      path.join(tmpdir(), 'i18next-translation-dedupe-'),
    );

    const rspeedy = await createRspeedy({
      cwd: pluginReactRoot,
      rspeedyConfig: {
        source: {
          entry: {
            main: path.join(fixtureRoot, 'src/index.tsx'),
          },
        },
        output: {
          distPath: {
            root: distRoot,
          },
          filenameHash: false,
        },
        tools: {
          rspack: {
            context: fixtureRoot,
            resolve: {
              extensionAlias: {
                '.js': ['.ts', '.js'],
                '.jsx': ['.tsx', '.jsx'],
              },
            },
          },
        },
        plugins: [
          pluginReactLynx(),
          pluginI18nextExtractor({
            localesDir: './src/locales',
          }),
          pluginLynxI18nextTranslationDedupe(),
        ],
      },
    });

    const result = await rspeedy.build();
    await result.close();

    const rspeedyDir = path.join(distRoot, '.rspeedy/main');
    const tasmPath = path.join(rspeedyDir, 'tasm.json');
    const mainThreadPath = path.join(rspeedyDir, 'main-thread.js');
    const backgroundPath = readDirBackgroundBundle(rspeedyDir);

    expect(existsSync(tasmPath)).toBe(true);
    expect(existsSync(mainThreadPath)).toBe(true);
    expect(backgroundPath).toBeTruthy();

    const tasmJson = JSON.parse(readFileSync(tasmPath, 'utf8')) as TasmJson;
    const customSection =
      tasmJson.customSections?.['i18next-translations']?.content ?? null;

    expect(customSection).toEqual({
      en: {
        hello: 'Hello world',
      },
      zh: {
        hello: '你好，世界',
      },
    });

    const mainThreadContent = readFileSync(mainThreadPath, 'utf8');
    const backgroundContent = readFileSync(
      path.join(rspeedyDir, backgroundPath!),
      'utf8',
    );

    expect(mainThreadContent.includes('Hello world')).toBe(false);
    expect(mainThreadContent.includes('你好，世界')).toBe(false);
    expect(backgroundContent.includes('Hello world')).toBe(false);
    expect(backgroundContent.includes('你好，世界')).toBe(false);
  });
});

function readDirBackgroundBundle(rspeedyDir: string): string | undefined {
  return readdirSync(rspeedyDir).find(
    (file: string) => file.startsWith('background.') && file.endsWith('.js'),
  );
}
