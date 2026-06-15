// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * @typedef {{ toJson: (options: typeof BUNDLE_STATS_JSON_OPTIONS) => BundleStatsJson }} BundleStats
 * @typedef {{ stats?: BundleStats }} AfterBuildResult
 * @typedef {{
 *   context: { distPath: string };
 *   onAfterBuild: (callback: (result: AfterBuildResult) => void) => void;
 * }} BundleStatsPluginAPI
 * @typedef {{
 *   name: string;
 *   setup: (api: BundleStatsPluginAPI) => void;
 * }} BundleStatsPlugin
 * @typedef {{
 *   name?: string;
 *   children?: BundleStatsJson[];
 *   [key: string]: unknown;
 * }} BundleStatsJson
 */

export const BUNDLE_STATS_JSON_OPTIONS = {
  assets: true,
  chunks: true,
  modules: true,
  entrypoints: true,
  chunkGroups: true,
};

/**
 * @returns {BundleStatsPlugin}
 */
export function pluginLynxBundleAnalysisStats() {
  return {
    name: 'example:lynx-bundle-analysis-stats',
    /**
     * @param {BundleStatsPluginAPI} api
     */
    setup(api) {
      if (!process.env['RSPEEDY_BUNDLE_ANALYSIS']) {
        return;
      }

      /**
       * @param {AfterBuildResult} result
       */
      const writeLynxStatsJson = ({ stats }) => {
        if (!stats) {
          return;
        }

        const statsPath = path.join(api.context.distPath, 'stats.json');
        mkdirSync(path.dirname(statsPath), { recursive: true });
        writeFileSync(
          statsPath,
          JSON.stringify(
            getLynxBundleStatsJson(stats.toJson(BUNDLE_STATS_JSON_OPTIONS)),
            null,
            2,
          ),
        );
      };

      api.onAfterBuild(writeLynxStatsJson);
    },
  };
}

/**
 * @param {BundleStatsJson} statsJson
 * @returns {BundleStatsJson}
 */
export function getLynxBundleStatsJson(statsJson) {
  if (!statsJson.children || statsJson.children.length === 0) {
    return withoutEmptyChildren(statsJson);
  }

  const lynxStatsJson = statsJson.children.find(child =>
    isLynxStatsChild(child.name)
  );
  const fallbackStatsJson = statsJson.children[0];
  if (!fallbackStatsJson) {
    return withoutEmptyChildren(statsJson);
  }

  return withoutEmptyChildren(lynxStatsJson ?? fallbackStatsJson);
}

/**
 * @param {string | undefined} name
 * @returns {boolean}
 */
function isLynxStatsChild(name) {
  return name === 'lynx' || name?.startsWith('lynx-') === true;
}

/**
 * @param {BundleStatsJson} statsJson
 * @returns {BundleStatsJson}
 */
function withoutEmptyChildren(statsJson) {
  if (!statsJson.children || statsJson.children.length > 0) {
    return statsJson;
  }

  const statsJsonWithoutEmptyChildren = { ...statsJson };
  delete statsJsonWithoutEmptyChildren.children;
  return statsJsonWithoutEmptyChildren;
}
