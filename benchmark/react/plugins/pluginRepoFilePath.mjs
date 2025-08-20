// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { dirname, relative } from 'node:path';

import * as find from 'empathic/find';
import MagicString from 'magic-string';

/**
 * @returns {import("@lynx-js/rspeedy").RsbuildPlugin}
 */
export const pluginRepoFilePath = () => ({
  name: 'pluginRepoFilePath',
  /**
   * @param {import("@lynx-js/rspeedy").RsbuildPluginAPI} api
   */
  setup(api) {
    let repoRoot = find.dir('.git', { cwd: api.context.rootPath });
    if (!repoRoot) {
      return;
    }
    repoRoot = dirname(repoRoot); // trim `.git`

    api.transform({}, (context) => {
      const ident = '__REPO_FILEPATH__';

      const filePath = relative(repoRoot, context.resourcePath)
        .replaceAll(
          /\\/g,
          '/',
        );

      const code = new MagicString(context.code);
      code.replaceAll(ident, JSON.stringify(filePath));
      const sourceMap = code.generateMap({
        hires: true,
        includeContent: true,
        source: context.resourcePath,
      });

      return {
        code: code.toString(),
        map: sourceMap,
      };
    });
  },
});
