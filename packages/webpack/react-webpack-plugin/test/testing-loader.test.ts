// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Invoke the testing loader synchronously by wrapping the callback pattern.
 */
function runTestingLoader(
  content: string,
  options: Record<string, unknown>,
): Promise<{ code: string; map?: string }> {
  return new Promise((resolve, reject) => {
    // Dynamically import the built loader
    const loaderPath = path.resolve(
      __dirname,
      '../lib/loaders/testing.js',
    );
    import(loaderPath).then(
      (
        mod: {
          default: (this: Record<string, unknown>, content: string) => void;
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
            else resolve({ code: code!, map });
          },
        };

        loader.call(ctx, content);
      },
    ).catch(reject);
  });
}

describe('testing loader', () => {
  it('handles partial compat object (missing target) without throwing', async () => {
    const jsxContent = `
      import { View } from '@lynx-js/react';
      export function App() {
        return <view />;
      }
    `;

    // Partial compat without required `target` field — this was the bug
    const result = await runTestingLoader(jsxContent, {
      compat: {
        componentsPkg: ['@byted-lynx/react-components'],
        newRuntimePkg: '@lynx-js/react',
        oldRuntimePkg: ['@byted-lynx/react-runtime'],
        // intentionally missing: target, addComponentElement, etc.
      },
      engineVersion: '3.2',
    });

    expect(result.code).toBeTruthy();
  });

  it('handles compat: false without throwing', async () => {
    const jsxContent = `
      export function App() {
        return <view />;
      }
    `;

    const result = await runTestingLoader(jsxContent, {
      compat: false,
      engineVersion: '3.2',
    });

    expect(result.code).toBeTruthy();
  });

  it('handles missing compat (defaults to false) without throwing', async () => {
    const jsxContent = `
      export function App() {
        return <view />;
      }
    `;

    const result = await runTestingLoader(jsxContent, {
      engineVersion: '3.2',
    });

    expect(result.code).toBeTruthy();
  });

  it('forwards element-template mode to the transform', async () => {
    const jsxContent = `
      export function App() {
        return <view className="foo"><text>Hello</text></view>;
      }
    `;

    const result = await runTestingLoader(jsxContent, {
      engineVersion: '3.2',
      experimental_useElementTemplate: true,
    });

    expect(result.code).toContain('const _et_');
    expect(result.code).not.toContain('const __snapshot_');
  });
});
