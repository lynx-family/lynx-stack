/** @type {import("@lynx-js/test-tools").TConfigCaseConfig} */
module.exports = {
  beforeExecute() {
    global.lynx ??= {};
    global.__earlierRuntimeConfig = {
      earlierOnlyConfig: true,
      sharedConfig: {
        source: 'earlier',
      },
    };
    global.lynx.__runtime_configs__ = global.__earlierRuntimeConfig;
  },
};
