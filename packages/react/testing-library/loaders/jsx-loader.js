import { fileURLToPath } from 'node:url';
import { transformReactLynxSync } from '../../transform/main.js';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function jsxLoader(source) {
  const runtimePkgName = '@lynx-js/react';
  const sourcePath = this.resourcePath;
  const basename = path.basename(sourcePath);
  const relativePath = path.relative(
    __dirname,
    sourcePath,
  );

  const result = transformReactLynxSync(source, {
    mode: 'test',
    pluginName: '',
    filename: basename,
    sourcemap: true,
    snapshot: {
      preserveJsx: false,
      runtimePkg: `${runtimePkgName}/internal`,
      jsxImportSource: runtimePkgName,
      filename: relativePath,
      target: 'MIXED',
    },
    // snapshot: true,
    directiveDCE: false,
    defineDCE: false,
    shake: false,
    compat: false,
    worklet: {
      filename: relativePath,
      runtimePkg: `${runtimePkgName}/internal`,
      target: 'MIXED',
    },
    refresh: false,
    cssScope: false,
  });

  if (result.errors.length > 0) {
    console.error(result.errors);
    throw new Error('transformReactLynxSync failed');
  }

  this.callback(null, result.code, result.map);
}
