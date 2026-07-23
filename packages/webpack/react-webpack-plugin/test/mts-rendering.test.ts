// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { rspack } from '@rspack/core';
import type { RspackOptions, Stats } from '@rspack/core';
import { describe, expect, it } from '@rstest/core';

interface Tasm {
  lepusCode: {
    root: string;
    lepusChunk: Record<string, string>;
  };
}

const casesRoot = path.resolve(__dirname, 'cases', 'mts-rendering');
const distRoot = path.resolve(__dirname, 'dist', 'mts-rendering');

async function buildCase(caseName: string): Promise<{
  tasm: Tasm;
  backgroundSource: string;
}> {
  const caseDir = path.join(casesRoot, caseName);
  const outputPath = path.join(distRoot, caseName);

  await fs.rm(outputPath, { recursive: true, force: true });

  const configModule = await import(
    pathToFileURL(path.join(caseDir, 'rspack.config.js')).href
  ) as { default: RspackOptions };
  const config: RspackOptions = {
    ...configModule.default,
    mode: 'development' as const,
    output: {
      ...(configModule.default.output ?? {}),
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

  const tasm = JSON.parse(
    await fs.readFile(path.join(outputPath, '.rspeedy', 'tasm.json'), 'utf8'),
  ) as Tasm;
  const backgroundSource = await fs.readFile(
    path.join(outputPath, 'main__background.js'),
    'utf8',
  );

  return { tasm, backgroundSource };
}

describe('enableMTSRendering: false', () => {
  it('should assemble collected registrations into the main-thread script', async () => {
    const { tasm, backgroundSource } = await buildCase('disabled');
    const root = tasm.lepusCode.root;

    expect(root).toContain('snapshotCreatorMap[');

    expect(root).toContain('COMP_LIB_COUNTER_TEXT');

    expect(root).toContain('registerWorkletInternal');
    expect(Object.keys(tasm.lepusCode.lepusChunk)).toContain(
      'worklet-runtime',
    );

    expect(root).not.toContain('MODULE_SIDE_EFFECT_MARKER');
    expect(backgroundSource).toContain('MODULE_SIDE_EFFECT_MARKER');
  });
});
