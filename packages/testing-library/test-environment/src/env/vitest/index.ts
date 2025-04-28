import { builtinEnvironments } from 'vitest/environments';
import { LynxEnv } from '@lynx-js/test-environment';

const env = {
  name: 'lynxEnv',
  transformMode: 'web',
  async setup(global) {
    const fakeGlobal: {
      jsdom?: any;
    } = {};
    await builtinEnvironments.jsdom.setup(fakeGlobal, {});
    global.jsdom = fakeGlobal.jsdom;

    const lynxEnv = new LynxEnv();
    global.lynxEnv = lynxEnv;

    return {
      teardown(global) {
        delete global.lynxEnv;
        delete global.jsdom;
      },
    };
  },
};

export default env;
