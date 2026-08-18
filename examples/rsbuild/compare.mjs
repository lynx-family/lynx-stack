// Builds this example's source twice, once through Rspeedy and once through
// Rsbuild, and compares the Lynx bundles.
//
// `output.filenameHash` is turned off because the chunk content hash is not
// stable between builds, including two builds of the same configuration, so it
// would drown out any real difference.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRsbuild } from '@rsbuild/core';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { createRspeedy } from '@lynx-js/rspeedy';

const cwd = path.dirname(fileURLToPath(import.meta.url));

const shared = {
  mode: 'production',
  environments: { lynx: {} },
  source: { entry: { main: './src/index.tsx' } },
};

const bundleOf = (root) =>
  readFileSync(path.join(cwd, root, 'main.lynx.bundle'));

const rspeedy = await createRspeedy({
  cwd,
  rspeedyConfig: {
    ...shared,
    output: { distPath: { root: 'dist-rspeedy' }, filenameHash: false },
    plugins: [pluginReactLynx()],
  },
});
await rspeedy.build();

const rsbuild = await createRsbuild({
  cwd,
  rsbuildConfig: {
    ...shared,
    output: { distPath: { root: 'dist-rsbuild' }, filenameHash: false },
    plugins: [pluginReactLynx()],
  },
});
await rsbuild.build();

const fromRspeedy = bundleOf('dist-rspeedy');
const fromRsbuild = bundleOf('dist-rsbuild');

console.info(`rspeedy: ${fromRspeedy.length} bytes`);
console.info(`rsbuild: ${fromRsbuild.length} bytes`);

if (fromRspeedy.equals(fromRsbuild)) {
  console.info('the bundles are byte-identical');
} else {
  const at = fromRspeedy.findIndex((byte, i) => byte !== fromRsbuild[i]);
  console.error(`the bundles differ, first at byte ${at}`);
  process.exitCode = 1;
}
