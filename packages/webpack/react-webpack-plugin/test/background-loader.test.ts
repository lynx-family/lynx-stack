// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from '@rstest/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runBackgroundLoader(
  content: string,
  options: Record<string, unknown>,
): Promise<{ code: string; map?: string }> {
  return new Promise((resolve, reject) => {
    const loaderPath = path.resolve(
      __dirname,
      '../lib/loaders/background.js',
    );

    import(loaderPath).then(
      (
        mod: {
          default: (
            this: Record<string, unknown>,
            content: string,
            sourceMap?: string,
          ) => void;
        },
      ) => {
        const loader = mod.default;

        const ctx: Record<string, unknown> = {
          getOptions: () => options,
          resourcePath: path.resolve(__dirname, 'fixture.tsx'),
          rootContext: __dirname,
          sourceMap: false,
          hot: false,
          experiments: undefined,
          emitError: (err: Error) => reject(err),
          // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
          emitWarning: () => {},
          callback: (
            err: Error | null,
            code?: string,
            map?: string,
          ) => {
            if (err) reject(err);
            // `exactOptionalPropertyTypes`: only set `map` when defined.
            else {resolve(
                map === undefined ? { code: code! } : { code: code!, map },
              );}
          },
        };

        loader.call(ctx, content, undefined);
      },
    ).catch(reject);
  });
}

describe('background loader', () => {
  it('compiles ET background output to Preact JSX with multi-slot template ids', async () => {
    const jsxContent = `
      export function App({ name }) {
        return <view>Hello, {name}</view>;
      }
    `;

    const result = await runBackgroundLoader(jsxContent, {
      engineVersion: '3.2',
      experimental_useElementTemplate: true,
    });

    expect(result.code).toContain(
      '"@lynx-js/react/jsx-runtime"',
    );
    expect(result.code).not.toContain(
      '"@lynx-js/react/element-template/jsx-runtime"',
    );
    expect(result.code).not.toContain(
      '"@lynx-js/react/element-template/internal"',
    );
    expect(result.code).not.toContain('"@lynx-js/react/element-template"');
    expect(result.code).not.toContain('"@lynx-js/react/internal"');

    // eg. const _et_e5e2854282ab = "_et_e5e2854282ab";
    expect(result.code).toMatch(/_et_[a-f0-9]{12}(?![a-f0-9])/);
  });
});
