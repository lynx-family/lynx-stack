import { builtinEnvironments, Environment } from 'vitest/environments';
import { LynxTestingEnv } from '@lynx-js/testing-environment';
import { JSDOM } from 'jsdom';

const env = {
  name: 'lynxTestingEnv',
  transformMode: 'web', // For Vitest v3
  viteEnvironment: 'client', // For Vitest v4
  async setup(global) {
    const fakeGlobal: {
      jsdom?: any;
    } = {};
    await builtinEnvironments.jsdom.setup(fakeGlobal, {});

    const lynxTestingEnv = new LynxTestingEnv(fakeGlobal.jsdom as JSDOM);
    global.lynxTestingEnv = lynxTestingEnv;
    global.Node = lynxTestingEnv.jsdom.window.Node;

    return {
      teardown(global) {
        delete global.lynxTestingEnv;
        delete global.jsdom;
        delete global.Node;
      },
    };
  },
} satisfies Environment;

export default env;
