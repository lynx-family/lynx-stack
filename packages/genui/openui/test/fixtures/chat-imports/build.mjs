// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { createRspeedy } from '@lynx-js/rspeedy';

const results = {};
for (const example of ['selected', 'markdown', 'full']) {
  const report = results[example] = {};
  const rspeedy = await createRspeedy({
    cwd: process.cwd(),
    loadEnv: false,
    rspeedyConfig: {
      mode: 'production',
      plugins: [pluginReactLynx()],
      source: { entry: { main: `./app/${example}.tsx` } },
      environments: { web: {}, lynx: {} },
      output: {
        distPath: { root: `dist/${example}` },
        filename: '[name].[platform].bundle',
        sourceMap: false,
      },
      tools: {
        rspack(config, { environment }) {
          config.plugins.push({
            apply(compiler) {
              compiler.hooks.thisCompilation.tap(
                'ChatBundleStyles',
                compilation => {
                  // Read the optimized CSS assets that are about to be encoded into
                  // each platform's template, before the encoder removes sidecars.
                  compilation.hooks.processAssets.tap({
                    name: 'ChatBundleStyles',
                    stage: compiler.webpack.Compilation
                      .PROCESS_ASSETS_STAGE_OPTIMIZE_HASH - 1,
                  }, () => {
                    report[environment.name] = {
                      css: compilation.getAssets()
                        .filter(asset => asset.name.endsWith('.css'))
                        .map(asset => asset.source.source().toString()).join(
                          '\n',
                        ),
                      modules: [...compilation.modules]
                        .map(module => module.nameForCondition?.())
                        .filter(Boolean)
                        .map(name => name.replaceAll('\\', '/')),
                    };
                  });
                },
              );
            },
          });
        },
      },
    },
  });
  await rspeedy.build();
  for (const platform of ['web', 'lynx']) {
    report[platform].bytes =
      (await readFile(path.resolve(`dist/${example}/main.${platform}.bundle`)))
        .length;
  }
}
console.log('CHAT_BUNDLES:' + JSON.stringify(results));
