import { builtinEnvironments } from 'vitest/environments';
import { LynxTestingEnv } from '@lynx-js/testing-environment';

const env = {
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
