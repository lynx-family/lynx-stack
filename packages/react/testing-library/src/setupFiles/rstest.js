import { LynxTestingEnv } from '@lynx-js/testing-environment';

global.jsdom = {
  window,
};
const lynxTestingEnv = new LynxTestingEnv();
global.lynxTestingEnv = lynxTestingEnv;

const {
  onInjectBackgroundThreadGlobals,
} = globalThis;

globalThis.onInjectBackgroundThreadGlobals = (target) => {
  if (onInjectBackgroundThreadGlobals) {
    onInjectBackgroundThreadGlobals(target);
  }

  target.lynx.requireModuleAsync = async (url, callback) => {
    throw new Error('lynx.requireModuleAsync not implemented for rstest');
  };
};

import('./common.js');
