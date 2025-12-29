// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @returns {import("@lynx-js/rspeedy").RsbuildPlugin}
 */
export const pluginScriptLoad = () => ({
  name: 'pluginScriptLoad',
  /**
   * @param {import("@lynx-js/rspeedy").RsbuildPluginAPI} api
   */
  setup(api) {
    api.modifyRspackConfig((_config, { rspack, appendPlugins }) => {
      appendPlugins(
        new rspack.BannerPlugin({
          stage: rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
          raw: true,
          banner: () => {
            return `\
const runAfterLoadScript = (() => {
  const q = [];
  const r = (cb) => { q.push(cb); };
  r.flush = () => { for (const cb of q) { cb(); } };
  return r;
})();
if (typeof Codspeed !== "undefined") {
  Codspeed.startBenchmark();
}
`;
          },
        }),
      );
      appendPlugins(
        new rspack.BannerPlugin({
          stage: rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
          footer: true,
          raw: true,
          banner: ({ filename }) => {
            // TODO(hzy): avoid hardcoded case dir
            const caseDir = `benchmark/react`;
            const chunkName = filename.replace(/^\.rspeedy\//, '');
            // dprint-ignore
            return `\
if (typeof Codspeed !== "undefined") {
  Codspeed.stopBenchmark();
  Codspeed.setExecutedBenchmark(\`${caseDir}::\${${JSON.stringify(chunkName)}}_LoadScript\`);
}
runAfterLoadScript.flush();
`;
          },
        }),
      );
    });
  },
});
