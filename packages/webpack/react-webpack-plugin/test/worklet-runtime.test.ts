// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

import { rspack } from '@rspack/core';
import type { RspackOptions, Stats } from '@rspack/core';
import { describe, expect, it } from '@rstest/core';

interface WorkletRuntimeCase {
  caseName: string;
  expectedRuntimeImplementationCount: number;
  expectedRegisterIdCount: number;
}

interface BuildOutput {
  lepusChunk: Record<string, string>;
  jsAssets: Map<string, string>;
  compileResult: unknown;
}

const REACT_COMPILATION_RESULT = Symbol.for(
  '@lynx-js/react/internal:compilation-result',
);

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
    /registerWorkletInternal\((?:\\"|")main-thread(?:\\"|"),\s*(?:\\"|")([^\\"]+)(?:\\"|")/g,
  );

  return Array.from(matches, match => match[1]!);
}

const noop = () => undefined;

function executeStandaloneLazyArtifact(source: string): {
  registeredWorkletIds: string[];
  hasSelectorApis: boolean;
} {
  const jsContext = {
    addEventListener: noop,
    dispatchEvent: noop,
  };
  const lynx = {
    getJSContext: () => jsContext,
    setTimeout: noop,
    setInterval: noop,
    clearTimeout: noop,
    clearInterval: noop,
    requestAnimationFrame: noop,
    cancelAnimationFrame: noop,
  };
  const host: Record<string, unknown> = {
    console,
    lynx,
    SystemInfo: { lynxSdkVersion: '2.16' },
    __DEV__: false,
    __LEPUS__: true,
    __MAIN_THREAD__: true,
    __OnLifecycleEvent: noop,
  };

  const artifactFactory = runInNewContext(source, host, {
    filename: 'standalone-lazy-main-thread.js',
  }) as unknown;
  if (typeof artifactFactory !== 'function') {
    throw new TypeError(
      'Standalone lazy artifact should evaluate to a function',
    );
  }
  (artifactFactory as (schema: string) => unknown)(
    'legacy-host://standalone-lazy',
  );

  const runtime = host['lynxWorkletImpl'];
  if (typeof runtime !== 'object' || runtime === null) {
    throw new TypeError(
      'Standalone lazy artifact did not initialize the runtime',
    );
  }
  const workletMap = (runtime as { _workletMap?: unknown })._workletMap;
  if (typeof workletMap !== 'object' || workletMap === null) {
    throw new TypeError(
      'Standalone lazy artifact did not create a worklet map',
    );
  }

  return {
    registeredWorkletIds: Object.keys(workletMap),
    hasSelectorApis:
      typeof (lynx as Record<string, unknown>)['querySelector'] === 'function'
      && typeof (lynx as Record<string, unknown>)['querySelectorAll']
        === 'function',
  };
}

async function buildCase(
  caseName: string,
  mode: 'development' | 'production' = 'development',
): Promise<BuildOutput> {
  const caseDir = path.join(casesRoot, caseName);
  const caseConfigPath = path.join(caseDir, 'rspack.config.js');
  const outputPath = path.join(distRoot, `${caseName}-${mode}`);

  await fs.rm(outputPath, { recursive: true, force: true });

  const configModule = await import(
    pathToFileURL(caseConfigPath).href
  ) as { default: RspackOptions };
  const baseConfig = configModule.default;
  const config: RspackOptions = {
    ...baseConfig,
    mode,
    optimization: {
      ...baseConfig.optimization,
      minimize: false,
    },
    output: {
      ...(baseConfig.output ?? {}),
      path: outputPath,
    },
  };

  const stats = await new Promise<Stats>((resolve, reject) => {
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
  return {
    lepusChunk: parseLepusChunk(tasm, caseName),
    jsAssets: await collectJsAssets(outputPath),
    compileResult: (
      stats.compilation as unknown as Record<symbol, unknown>
    )[REACT_COMPILATION_RESULT],
  };
}

async function collectJsAssets(
  rootDir: string,
  relativeDir = '.',
): Promise<Map<string, string>> {
  const entries = await fs.readdir(path.join(rootDir, relativeDir), {
    withFileTypes: true,
  });
  const assets = new Map<string, string>();

  await Promise.all(entries.map(async (entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectJsAssets(rootDir, relativePath);
      for (const [name, source] of nested) {
        assets.set(name, source);
      }
    } else if (entry.name.endsWith('.js')) {
      assets.set(
        path.normalize(relativePath),
        await fs.readFile(path.join(rootDir, relativePath), 'utf8'),
      );
    }
  }));

  return assets;
}

describe('worklet-runtime bundler guardrails', () => {
  it.each<WorkletRuntimeCase>([
    {
      caseName: 'chunk',
      expectedRuntimeImplementationCount: 1,
      expectedRegisterIdCount: 2,
    },
    {
      caseName: 'not-using',
      expectedRuntimeImplementationCount: 0,
      expectedRegisterIdCount: 0,
    },
  ])(
    'should emit the expected worklet chunks for $caseName',
    async ({
      caseName,
      expectedRuntimeImplementationCount,
      expectedRegisterIdCount,
    }) => {
      const { lepusChunk, jsAssets } = await buildCase(caseName);
      const mainThreadSource = jsAssets.get('main__main-thread.js');
      expect(mainThreadSource).toBeDefined();
      const workletRuntimeChunks = Object.keys(lepusChunk).filter(
        name => name === 'worklet-runtime',
      );
      const registeredWorkletIds = extractRegisteredWorkletIds(
        mainThreadSource!,
      );

      expect(workletRuntimeChunks).toEqual([]);
      expect(lepusChunk['worklet-runtime']).toBeUndefined();
      expect(
        countOccurrences(
          mainThreadSource!,
          'globalThis.lynxWorkletImpl = {',
        ),
      ).toBe(expectedRuntimeImplementationCount);

      expect(registeredWorkletIds).toHaveLength(expectedRegisterIdCount);
      expect(new Set(registeredWorkletIds).size).toBe(
        expectedRegisterIdCount,
      );
    },
  );

  it.each(['development', 'production'] as const)(
    'keeps one shared implementation while paired main and lazy assets register locally (%s)',
    async (mode) => {
      const { lepusChunk, jsAssets } = await buildCase('lazy', mode);
      const runtimeOwners = [...jsAssets.entries()].filter(([, source]) =>
        source.includes('globalThis.lynxWorkletImpl = {')
      );
      const registrationOwners = [...jsAssets.entries()].filter(([, source]) =>
        source.includes('registerWorkletInternal("main-thread"')
      );
      const registeredWorkletIds = registrationOwners.flatMap(([, source]) =>
        extractRegisteredWorkletIds(source)
      );

      expect(lepusChunk['worklet-runtime']).toBeUndefined();
      expect(runtimeOwners).toHaveLength(1);
      expect(runtimeOwners[0]![0]).toBe('main__main-thread.js');
      expect(registrationOwners).toHaveLength(2);
      expect(registrationOwners.map(([name]) => name)).toContain(
        'main__main-thread.js',
      );
      expect(
        registrationOwners.some(([name]) =>
          name !== 'main__main-thread.js' && name.includes('main-thread')
        ),
      ).toBe(true);
      expect(registeredWorkletIds).toHaveLength(2);
      expect(new Set(registeredWorkletIds).size).toBe(2);
      for (const [, source] of registrationOwners) {
        expect(source).not.toContain('__workletRuntimeLoaded');
      }
    },
  );

  it.each(['development', 'production'] as const)(
    'keeps a complete, executable runtime closure in a standalone lazy artifact (%s)',
    async (mode) => {
      const { lepusChunk, jsAssets } = await buildCase(
        'standalone-lazy',
        mode,
      );
      const mainThreadSource = jsAssets.get('main__main-thread.js');
      expect(mainThreadSource).toBeDefined();

      const registeredWorkletIds = extractRegisteredWorkletIds(
        mainThreadSource!,
      );
      expect(lepusChunk['worklet-runtime']).toBeUndefined();
      expect(mainThreadSource).toContain('/worklet-runtime/init.js');
      expect(
        countOccurrences(
          mainThreadSource!,
          'globalThis.lynxWorkletImpl = {',
        ),
      ).toBe(1);
      expect(registeredWorkletIds).toHaveLength(1);

      const execution = executeStandaloneLazyArtifact(mainThreadSource!);
      expect(execution.hasSelectorApis).toBe(true);
      expect(execution.registeredWorkletIds).toEqual(registeredWorkletIds);
    },
  );

  it('keeps the template-time runtime chunk only for a supported older transform', async () => {
    const { compileResult, lepusChunk, jsAssets } = await buildCase(
      'legacy-transform',
    );
    const mainThreadSource = jsAssets.get('main__main-thread.js');

    expect(mainThreadSource).toBeDefined();
    expect(compileResult).toBeUndefined();
    expect(mainThreadSource).toContain('loadWorkletRuntime');
    expect(mainThreadSource).toContain('legacy-transform:1');
    expect(lepusChunk['worklet-runtime']).toBeDefined();
    expect(
      countOccurrences(
        lepusChunk['worklet-runtime']!,
        'globalThis.lynxWorkletImpl = {',
      ),
    ).toBe(1);
    expect(mainThreadSource).not.toContain(
      'globalThis.lynxWorkletImpl = {',
    );
  });

  it('applies normal production defines and dead-code elimination to the runtime', async () => {
    const { lepusChunk, jsAssets } = await buildCase('chunk', 'production');
    const mainThreadSource = jsAssets.get('main__main-thread.js');

    expect(lepusChunk['worklet-runtime']).toBeUndefined();
    expect(mainThreadSource).toContain('globalThis.lynxWorkletImpl = {');
    expect(mainThreadSource).not.toContain(
      '[ReactLynx][DEV] MainThread flush loop detected',
    );
    expect(mainThreadSource).not.toContain('MainThreadFunction id=');
  });
});
