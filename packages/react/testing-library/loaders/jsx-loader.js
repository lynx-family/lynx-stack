import { transformReactLynx } from '../../transform/main.js';

export default async function jsxLoader(source) {
  const callback = this.async();

  const runtimePkgName = '@lynx-js/react';

  const result = await transformReactLynx(source, {
    mode: 'test',
    sourcemap: true,
    snapshot: {
      preserveJsx: false,
      runtimePkg: `${runtimePkgName}/internal`,
      jsxImportSource: runtimePkgName,
      target: 'MIXED',
    },
    directiveDCE: false,
    defineDCE: false,
    shake: false,
    compat: false,
    worklet: {
      runtimePkg: `${runtimePkgName}/internal`,
      target: 'MIXED',
    },
    cssScope: false,
  });

  if (result.errors.length > 0) {
    console.error(result.errors);
    throw new Error('transformReactLynxSync failed');
  }

  callback(null, result.code, result.map);
}
