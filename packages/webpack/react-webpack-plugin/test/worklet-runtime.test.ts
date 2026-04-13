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
  expectedInlineInitSignatureCount: number;
  expectedRegisterIdCount: number;
}

interface BuildOutput {
  lepusChunk: Record<string, string>;
  mainThreadSource: string;
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
    /registerWorkletInternal\(\\"main-thread\\",\s*\\"([^\\"]+)\\"/g,
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
  const mainThreadPath = path.join(outputPath, 'main__main-thread.js');
  const mainThreadSource = await fs.readFile(mainThreadPath, 'utf8');

  return {
    lepusChunk: parseLepusChunk(tasm, caseName),
    mainThreadSource,
  };
}

describe('worklet-runtime bundler guardrails', () => {
  it.each<WorkletRuntimeCase>([
    {
      caseName: 'chunk',
      expectedChunkNames: [],
      expectedInlineInitSignatureCount: 1,
      expectedRegisterIdCount: 2,
    },
    {
      caseName: 'not-using',
      expectedChunkNames: [],
      expectedInlineInitSignatureCount: 0,
      expectedRegisterIdCount: 0,
    },
  ])(
    'should emit the expected worklet chunks for $caseName',
    async ({
      caseName,
      expectedChunkNames,
      expectedInlineInitSignatureCount,
      expectedRegisterIdCount,
    }) => {
      const { lepusChunk, mainThreadSource } = await buildCase(caseName);
      const workletRuntimeChunks = Object.keys(lepusChunk).filter(
        name => name === 'worklet-runtime',
      );
      const registeredWorkletIds = extractRegisteredWorkletIds(
        mainThreadSource,
      );

      expect(workletRuntimeChunks).toEqual(expectedChunkNames);

      if (expectedChunkNames.length > 0) {
        expect(lepusChunk['worklet-runtime'].length).toBeGreaterThan(0);
      } else {
        expect(lepusChunk['worklet-runtime']).toBeUndefined();
      }

      expect(
        countOccurrences(
          mainThreadSource,
          'globalThis.lynxWorkletImpl = {',
        ),
      ).toBe(expectedInlineInitSignatureCount);

      expect(registeredWorkletIds).toHaveLength(expectedRegisterIdCount);
      expect(new Set(registeredWorkletIds).size).toBe(
        expectedRegisterIdCount,
      );
    },
  );
});
