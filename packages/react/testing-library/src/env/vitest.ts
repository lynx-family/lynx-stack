import { builtinEnvironments, type Environment } from 'vitest/environments';
import { LynxTestingEnv } from './index.js';

const env: Environment = {
  name: 'lynxTestingEnv',
  transformMode: 'web',
  async setup(global) {
    const fakeGlobal: {
      jsdom?: any;
    } = {};
    await builtinEnvironments.jsdom.setup(fakeGlobal, {});
    global.jsdom = fakeGlobal.jsdom;

    const lynxTestingEnv = new LynxTestingEnv();
    global.lynxTestingEnv = lynxTestingEnv;

    return {
      teardown(global) {
        delete global.lynxTestingEnv;
        delete global.jsdom;
      },
    };
  },
};

export default env;
