/** @type {import("@lynx-js/test-tools").TConfigCaseConfig} */
module.exports = {
  bundlePath: [
    'main.js',
  ],
  beforeExecute: () => {
    global.lynxCoreInject = {
      tt: {},
    };
    global.lynx = { ...global.lynx, getApp: () => global.lynxCoreInject.tt };
  },
};
