import path from 'node:path';

import { describe, expect, it } from 'vitest';

import jsxLoader from '../../loaders/jsx-loader.js';

describe('jsx-loader', () => {
  it('should emit the public runtime entry without using the removed internal worklet entry', async () => {
    const source = `
      import { runOnBackground } from '@lynx-js/react';
      const jsFn = () => {};
      export default function Comp() {
        runOnBackground(jsFn);
        return <view main-thread:bindtap={() => { 'main thread'; }} />;
      }
    `;

    const output = await new Promise((resolve, reject) => {
      jsxLoader.call(
        {
          resourcePath: path.join(process.cwd(), 'src', '__tests__', 'jsx-loader-fixture.jsx'),
          callback(error, code, map) {
            if (error) {
              reject(error);
              return;
            }
            resolve({ code, map });
          },
        },
        source,
      );
    });

    expect(output.code).toContain('import "@lynx-js/react/worklet-runtime";');
    expect(output.code).toContain('from "@lynx-js/react/internal";');
    expect(output.code).not.toContain('@lynx-js/react/internal/worklet-runtime');
  });
});
