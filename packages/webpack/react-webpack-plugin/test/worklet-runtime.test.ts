// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { rspack } from '@rspack/core';
import type { RspackOptions, Stats } from '@rspack/core';
import { describe, expect, it } from 'vitest';

interface WorkletRuntimeCase {
  caseName: string;
  expectedChunkNames: string[];
  expectedRuntimeInitOwners: string[];
  expectedRuntimeImplementationOwners: string[];
  expectedRegisterIdCount: number;
}

interface BuildOutput {
  lepusChunk: Record<string, string>;
  jsAssets: Map<string, string>;
}

const casesRoot = path.resolve(
  __dirname,
  'cases',
  'worklet-runtime',
);
const distRoot = path.resolve(
  __dirname,
  'dist',
  'worklet-runtime',
);
const RUNTIME_INIT_OWNER_MARKER = 'worklet-runtime/init.ts?owner=';
const RUNTIME_IMPLEMENTATION_MARKER = 'globalThis.lynxWorkletImpl = {';

function parseLepusChunk(
  source: string,
  caseName: string,
): Record<string, string> {
  const data: unknown = JSON.parse(source);
  if (
    typeof data !== 'object'
    || data === null
    || !('lepusCode' in data)
    || typeof data.lepusCode !== 'object'
    || data.lepusCode === null
    || !('lepusChunk' in data.lepusCode)
    || typeof data.lepusCode.lepusChunk !== 'object'
    || data.lepusCode.lepusChunk === null
  ) {
    throw new Error(`Unexpected tasm shape for case ${caseName}`);
  }

  return data.lepusCode.lepusChunk as Record<string, string>;
}

function countOccurrences(source: string, needle: string): number {
  let count = 0;
  let index = -1;

  while ((index = source.indexOf(needle, index + 1)) !== -1) {
    count += 1;
  }

  return count;
}

function extractRegisteredWorkletIds(source: string): string[] {
  const matches = source.matchAll(
    /registerWorkletInternal\((?:\\"|")main-thread(?:\\"|"),\s*(?:\\"|")([^"\\]+)(?:\\"|")/g,
  );

  return Array.from(matches, match => match[1]);
}

async function buildCase(caseName: string): Promise<BuildOutput> {
  const caseDir = path.join(casesRoot, caseName);
  const caseConfigPath = path.join(caseDir, 'rspack.config.js');
  const outputPath = path.join(distRoot, caseName);

  await fs.rm(outputPath, { recursive: true, force: true });

  const configModule = await import(
    pathToFileURL(caseConfigPath).href
  ) as { default: RspackOptions };
  const baseConfig = configModule.default;
  const config: RspackOptions = {
    ...baseConfig,
    mode: 'development' as const,
    output: {
      ...(baseConfig.output ?? {}),
      path: outputPath,
    },
  };

  await new Promise<Stats>((resolve, reject) => {
    const compiler = rspack(config);
    compiler.run((error, stats) => {
      compiler.close(closeError => {
        if (error) {
          reject(error);
          return;
        }
        if (closeError) {
          reject(closeError);
          return;
        }
        if (!stats) {
          reject(new Error(`Missing stats for case ${caseName}`));
          return;
        }
        if (stats.hasErrors()) {
          reject(
            new Error(
              stats.toString({
                all: false,
                errors: true,
                errorDetails: true,
              }),
            ),
          );
          return;
        }
        resolve(stats);
      });
    });
  });

  const tasmPath = path.join(outputPath, '.rspeedy', 'tasm.json');
  const tasm = await fs.readFile(tasmPath, 'utf8');
  const jsAssets = await collectJsAssets(outputPath);

  return {
    lepusChunk: parseLepusChunk(tasm, caseName),
    jsAssets,
  };
}

async function collectJsAssets(
  rootDir: string,
  relativeDir = '.',
): Promise<Map<string, string>> {
  const dirPath = path.join(rootDir, relativeDir);
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const assets = new Map<string, string>();

  await Promise.all(entries.map(async (entry) => {
    const entryRelativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      const nestedAssets = await collectJsAssets(rootDir, entryRelativePath);
      for (const [file, source] of nestedAssets) {
        assets.set(file, source);
      }
      return;
    }

    if (!entry.name.endsWith('.js')) {
      return;
    }

    const source = await fs.readFile(
      path.join(rootDir, entryRelativePath),
      'utf8',
    );
    assets.set(path.normalize(entryRelativePath), source);
  }));

  return assets;
}

function isMainThreadAsset(name: string): boolean {
  return name.endsWith('.js') && name.includes('main-thread');
}

function collectAssetOwners(
  jsAssets: Map<string, string>,
  needle: string,
): string[] {
  return [...jsAssets.entries()]
    .filter(([, source]) => countOccurrences(source, needle) > 0)
    .map(([name]) => name);
}

function expectOwnersToMatch(
  actualOwners: string[],
  expectedOwners: string[],
  label: string,
) {
  expect(actualOwners).toHaveLength(expectedOwners.length);
  for (const pattern of expectedOwners) {
    expect(
      actualOwners.some(name => name.includes(pattern)),
      `Expected a ${label} owner matching "${pattern}" in ${
        actualOwners.join(', ')
      }`,
    ).toBe(true);
  }
}

describe('worklet-runtime bundler guardrails', () => {
  it.each<WorkletRuntimeCase>([
    {
      caseName: 'chunk',
      expectedChunkNames: [],
      expectedRuntimeInitOwners: ['main__main-thread.js'],
      expectedRuntimeImplementationOwners: ['main__main-thread.js'],
      expectedRegisterIdCount: 2,
    },
    {
      caseName: 'lazy',
      expectedChunkNames: [],
      expectedRuntimeInitOwners: [
        'main__main-thread.js',
        'lazy.jsx-react__main-thread',
      ],
      expectedRuntimeImplementationOwners: ['main__main-thread.js'],
      expectedRegisterIdCount: 2,
    },
    {
      caseName: 'not-using',
      expectedChunkNames: [],
      expectedRuntimeInitOwners: [],
      expectedRuntimeImplementationOwners: [],
      expectedRegisterIdCount: 0,
    },
  ])(
    'should emit the expected worklet chunks for $caseName',
    async ({
      caseName,
      expectedChunkNames,
      expectedRuntimeInitOwners,
      expectedRuntimeImplementationOwners,
      expectedRegisterIdCount,
    }) => {
      const { lepusChunk, jsAssets } = await buildCase(caseName);
      const workletRuntimeChunks = Object.keys(lepusChunk).filter(
        name => name === 'worklet-runtime',
      );
      const runtimeInitOwners = collectAssetOwners(
        jsAssets,
        RUNTIME_INIT_OWNER_MARKER,
      );
      const runtimeImplementationOwners = collectAssetOwners(
        jsAssets,
        RUNTIME_IMPLEMENTATION_MARKER,
      );
      const registeredWorkletIds = [...jsAssets.values()].flatMap(
        source => extractRegisteredWorkletIds(source),
      );

      expect(workletRuntimeChunks).toEqual(expectedChunkNames);

      if (expectedChunkNames.length > 0) {
        expect(lepusChunk['worklet-runtime'].length).toBeGreaterThan(0);
      } else {
        expect(lepusChunk['worklet-runtime']).toBeUndefined();
      }

      expectOwnersToMatch(
        runtimeInitOwners,
        expectedRuntimeInitOwners,
        'runtime init',
      );
      expectOwnersToMatch(
        runtimeImplementationOwners,
        expectedRuntimeImplementationOwners,
        'runtime implementation',
      );

      for (const [name, source] of jsAssets) {
        const inlineInitImportCount = countOccurrences(
          source,
          RUNTIME_INIT_OWNER_MARKER,
        );
        const inlineInitCount = countOccurrences(
          source,
          RUNTIME_IMPLEMENTATION_MARKER,
        );

        if (runtimeInitOwners.includes(name)) {
          expect(isMainThreadAsset(name)).toBe(true);
          expect(inlineInitImportCount).toBeGreaterThan(0);
        } else {
          expect(inlineInitImportCount).toBe(0);
        }

        if (runtimeImplementationOwners.includes(name)) {
          expect(isMainThreadAsset(name)).toBe(true);
          expect(inlineInitCount).toBe(1);
        } else {
          expect(inlineInitCount).toBe(0);
        }
      }

      expect(registeredWorkletIds).toHaveLength(expectedRegisterIdCount);
      expect(new Set(registeredWorkletIds).size).toBe(
        expectedRegisterIdCount,
      );
    },
  );
});
