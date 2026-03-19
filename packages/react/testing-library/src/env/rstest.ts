import { LynxTestingEnv } from './index.js';

global.lynxEnv = {
  window,
};
const lynxTestingEnv = new LynxTestingEnv();
global.lynxTestingEnv = lynxTestingEnv;
