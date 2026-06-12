// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const BUNDLE_STATS_JSON_OPTIONS = {
  assets: true,
  chunks: true,
  modules: true,
  entrypoints: true,
  chunkGroups: true,
};

export function pluginLynxBundleAnalysisStats() {
  return {
    name: 'example:lynx-bundle-analysis-stats',
    setup(api) {
      if (!process.env['RSPEEDY_BUNDLE_ANALYSIS']) {
        return;
      }

      api.onAfterBuild(({ stats }) => {
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
      });
    },
  };
}

export function getLynxBundleStatsJson(statsJson) {
  if (!statsJson.children || statsJson.children.length === 0) {
    return withoutEmptyChildren(statsJson);
  }

  const lynxStatsJson = statsJson.children.find(child =>
    isLynxStatsChild(child.name)
  );

  return withoutEmptyChildren(lynxStatsJson ?? statsJson.children[0]);
}

function isLynxStatsChild(name) {
  return name === 'lynx' || name?.startsWith('lynx-') === true;
}

function withoutEmptyChildren(statsJson) {
  if (!statsJson.children || statsJson.children.length > 0) {
    return statsJson;
  }

  const statsJsonWithoutEmptyChildren = { ...statsJson };
  delete statsJsonWithoutEmptyChildren.children;
  return statsJsonWithoutEmptyChildren;
}
