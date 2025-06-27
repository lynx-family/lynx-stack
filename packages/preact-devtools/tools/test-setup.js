import { expect } from 'chai';
import * as sinon from 'sinon';
import { performance } from 'perf_hooks';
import { options } from 'preact';
import { JSDOM } from 'jsdom';
import { LynxTestingEnv } from '@lynx-js/testing-environment';

global.__DEBUG__ = false;

global.expect = expect;
global.sinon = sinon;

global.lynxTestingEnv = new LynxTestingEnv(new JSDOM());
lynxTestingEnv.mainThread.globalThis.getUniqueIdListBySnapshotId = (id) => {
  return [];
};
lynxTestingEnv.switchToBackgroundThread();

global.window = lynxTestingEnv.jsdom.window;
global.performance = performance;
options.document = lynxTestingEnv.jsdom.window.document;
global.preactDevtoolsCtx = {
  ...lynxTestingEnv.mainThread.globalThis,
  performance,
  Blob: window.Blob,
};
