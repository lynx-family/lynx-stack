import { builtinEnvironments } from 'vitest/environments';
import { LynxTestingEnv } from '@lynx-js/testing-environment';
import { JSDOM } from 'jsdom';

const env = {
  name: 'lynxTestingEnv',
  transformMode: 'web',
  async setup(global) {
    const fakeGlobal: {
      jsdom?: any;
    } = {};
    await builtinEnvironments.jsdom.setup(fakeGlobal, {});

    const lynxTestingEnv = new LynxTestingEnv(fakeGlobal.jsdom as JSDOM);
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
