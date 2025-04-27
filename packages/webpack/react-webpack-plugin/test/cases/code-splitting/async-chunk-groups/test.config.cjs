/** @type {import("@lynx-js/test-tools").TConfigCaseConfig} */
module.exports = {
  bundlePath: [
    // We do not run main-thread.js since the async chunk has been modified.
    // 'main:main-thread.js',
    'main:background.js',
  ],
};
