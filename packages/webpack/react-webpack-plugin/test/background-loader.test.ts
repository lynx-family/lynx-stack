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
  it('does not convert camelCase attributes by default', async () => {
    const result = await runBackgroundLoader(
      `
        const spread = {};
        export const node = <view textMaxline={2} {...spread} />;
      `,
      { engineVersion: '3.2' },
    );

    expect(result.code).toContain('"textMaxline"');
    expect(result.code).not.toContain('"text-maxline"');
  });

  it('converts explicit builtin attributes with the default rule', async () => {
    const jsxContent = `
      const spread = { spreadAttribute: true };
      const Custom = () => <view />;
      export const node = (
        <view
          className="root"
          textMaxline={2}
          tailColorConvert
          onClick={() => {}}
          onCatchTap={() => {}}
          onReady={() => {}}
          onTouchStart={() => {}}
          bindCustom={() => {}}
          {...spread}
        >
          <Custom customAttribute />
        </view>
      );
    `;

    const result = await runBackgroundLoader(jsxContent, {
      engineVersion: '3.2',
      experimental_transformBuiltinAttributeNames: true,
    });

    expect(result.code).toContain('"text-maxline"');
    expect(result.code).toContain('"tail-color-convert"');
    expect(result.code).not.toContain('"textMaxline"');
    expect(result.code).not.toContain('"tailColorConvert"');
    expect(result.code).toContain('"className"');
    expect(result.code).toContain('"bindtap"');
    expect(result.code).toContain('"catchtap"');
    expect(result.code).toContain('"bindready"');
    expect(result.code).toContain('"bindtouchstart"');
    expect(result.code).toContain('"bindCustom"');
    expect(result.code).not.toContain('"onClick"');
    expect(result.code).not.toContain('"onCatchTap"');
    expect(result.code).not.toContain('"onReady"');
    expect(result.code).not.toContain('"onTouchStart"');
    expect(result.code).toContain('spreadAttribute');
    expect(result.code).toContain('customAttribute');
  });

  it('applies serializable custom builtin attribute rules', async () => {
    const result = await runBackgroundLoader(
      `
        const spread = { spreadAttribute: true };
        const Custom = () => <view />;
        export const node = (
          <view
            textMaxline={2}
            tailColorConvert
            accessibilityLabel="label"
            {...spread}
          >
            <Custom textMaxline={2} onClick={() => {}} />
          </view>
        );
      `,
      {
        engineVersion: '3.2',
        experimental_transformBuiltinAttributeNames: {
          mode: 'dash-case',
          preserve: ['tailColorConvert'],
          rename: {
            textMaxline: 'custom-maxline',
          },
        },
      },
    );

    expect(result.code).toContain('"custom-maxline"');
    expect(result.code).toContain('"tailColorConvert"');
    expect(result.code).toContain('"accessibility-label"');
    expect(result.code).toContain('spreadAttribute');
    expect(result.code).toContain('textMaxline');
    expect(result.code).toContain('onClick');
  });

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
