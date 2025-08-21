import { LynxTestingEnv } from './index.js';

// @ts-ignore
global.jsdom = {
  window,
};
const lynxTestingEnv = new LynxTestingEnv();
global.lynxTestingEnv = lynxTestingEnv;
