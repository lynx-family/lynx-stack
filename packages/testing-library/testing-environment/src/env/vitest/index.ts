import { builtinEnvironments, type Environment } from 'vitest/environments';
import { installLynxTestingEnv, uninstallLynxTestingEnv } from '../../index.js';

const env = {
  name: 'lynxTestingEnv',
  transformMode: 'web',
  async setup(global) {
    const fakeGlobal: {
      jsdom?: any;
    } = {};
    const jsdomEnvironment = await builtinEnvironments.jsdom.setup(
      fakeGlobal,
      {},
    );

    installLynxTestingEnv(global, fakeGlobal.jsdom);

    return {
      async teardown(global) {
        await jsdomEnvironment.teardown(fakeGlobal);
        uninstallLynxTestingEnv(global);
      },
    };
  },
} satisfies Environment;

export default env;
