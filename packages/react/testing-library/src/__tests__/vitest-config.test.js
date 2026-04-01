import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createVitestConfig } from '../vitest.config.js';

describe('createVitestConfig', () => {
  it('should alias worklet runtime entries to the testing shim', async () => {
    const config = await createVitestConfig({
      runtimePkgName: '@lynx-js/react',
      include: [],
    });
    const alias = config.test.alias;

    const runtimeAlias = alias.find((entry) => String(entry.find) === String(/^@lynx-js\/react\/worklet-runtime$/));
    const devRuntimeAlias = alias.find((entry) => String(entry.find) === String(/^@lynx-js\/react\/worklet-dev-runtime$/));
    const legacyRuntimeAlias = alias.find((entry) => String(entry.find) === String(/^@lynx-js\/react\/internal\/worklet-runtime$/));

    expect(runtimeAlias?.replacement).toBe(
      path.join(process.cwd(), 'src', 'env', 'worklet-runtime.ts'),
    );
    expect(devRuntimeAlias?.replacement).toBe(
      path.join(process.cwd(), 'src', 'env', 'worklet-runtime.ts'),
    );
    expect(legacyRuntimeAlias?.replacement).toBe(
      path.join(process.cwd(), 'src', 'env', 'worklet-runtime.ts'),
    );
  });

  it('should import worklet runtime from the public entry but named helpers from internal', async () => {
    const config = await createVitestConfig({
      runtimePkgName: '@lynx-js/react',
      include: [],
    });
    const plugin = config.plugins.find((entry) => entry.name === 'transformReactLynxPlugin');

    const result = plugin.transform.call(
      {
        error(error) {
          throw error;
        },
        warn() {},
      },
      `
        import { runOnBackground } from '@lynx-js/react';
        const jsFn = () => {};
        export function Comp() {
          runOnBackground(jsFn);
          return <view main-thread:bindtap={() => { 'main thread'; }} />;
        }
      `,
      path.join(process.cwd(), 'src', '__tests__', 'worklet-config.jsx'),
    );

    expect(result.code).toContain('import "@lynx-js/react/worklet-runtime";');
    expect(result.code).toContain('from "@lynx-js/react/internal";');
    expect(result.code).not.toContain('@lynx-js/react/internal/worklet-runtime');
  });
});
