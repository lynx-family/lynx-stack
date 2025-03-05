import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Plugin } from 'vitest/config';
import resolver from 'enhanced-resolve';
import { createRequire } from 'module';
import fs from 'fs';

const utils = {
  require: typeof require === 'undefined'
    ? createRequire(import.meta.url)
    : require,
  __filename: typeof __filename === 'undefined'
    ? fileURLToPath(import.meta.url)
    : __filename,
  __dirname: typeof __dirname === 'undefined'
    ? path.dirname(fileURLToPath(import.meta.url))
    : __dirname,
};

const runtimePkgName = '@lynx-js/react';
const runtimeOSSPkgName = '@lynx-js/react';
let runtimeDir = null;
try {
  runtimeDir = path.dirname(
    utils.require.resolve(`${runtimePkgName}/package.json`, {
      paths: [process.cwd()],
    }),
  );
} catch (e) {
  // ignore since user may not using internal version
}

let runtimeOSSDir = null;
try {
  runtimeOSSDir = path.dirname(
    utils.require.resolve(`${runtimeOSSPkgName}/package.json`, {
      paths: [process.cwd(), runtimeDir].filter(Boolean),
    }),
  );
} catch (e) {
  console.error(
    `Package ${runtimeOSSPkgName} not found, please check if your Lynx project is setup correctly.`,
  );
  throw e;
}
if (process.env.DEBUG) {
  console.log('runtimeDir', runtimeDir);
  console.log('runtimeOSSDir', runtimeOSSDir);
}
const runtimeOSSExports = JSON.parse(
  fs.readFileSync(
    path.join(runtimeOSSDir, 'package.json'),
  ).toString(),
).exports;
const runtimeOSSAlias = [];
Object.entries(runtimeOSSExports).forEach(([key, value]) => {
  const relPath = value?.import?.default ?? value?.default ?? value;
  if (key === '.') {
    // runtimeOSSAlias[runtimeOSSPkgName] = path.join(
    //   runtimeOSSDir, relPath
    // )
    runtimeOSSAlias.push({
      // No `$` sign, make sure all relative path imports work
      // such as `import { SnapshotInstance } from '@lynx-js/react/runtime/lib/snapshot.js'`
      find: new RegExp(runtimeOSSPkgName + '$'),
      replacement: path.join(
        runtimeOSSDir,
        relPath,
      ),
    });
  } else {
    runtimeOSSAlias.push({
      find: new RegExp(runtimeOSSPkgName + key.slice(1) + '$'),
      replacement: path.join(
        runtimeOSSDir,
        relPath,
      ),
    });
    // runtimeOSSAlias[runtimeOSSPkgName + key.slice(1)] = path.join(
    //   runtimeOSSDir, relPath
    // )
  }
});
// last precedence
runtimeOSSAlias.push({
  // No `$` sign, make sure all relative path imports work
  // such as `import { SnapshotInstance } from '@lynx-js/react/runtime/lib/snapshot.js'`
  find: new RegExp('^' + runtimeOSSPkgName + '/'),
  replacement: path.join(
    runtimeOSSDir,
  ) + '/',
});
if (process.env.DEBUG) {
  console.log('runtimeOSSAlias', runtimeOSSAlias);
}

function transformReactLynxPlugin(): Plugin {
  return {
    name: 'transformReactLynxPlugin',
    enforce: 'pre',
    transform(sourceText, sourcePath) {
      const id = sourcePath;
      if (id.endsWith('.css') || id.endsWith('.less') || id.endsWith('.scss')) {
        if (process.env.DEBUG) {
          console.log('ignoring css file', id);
        }
        return '';
      }

      const { transformReactLynxSync } = utils.require(
        '@lynx-js/react/transform',
      );
      const relativePath = path.relative(
        process.cwd(),
        sourcePath,
      );
      const basename = path.basename(sourcePath);
      const result = transformReactLynxSync(sourceText, {
        mode: 'test',
        pluginName: '',
        filename: basename,
        sourcemap: true,
        snapshot: {
          preserveJsx: true,
          runtimePkg: `${runtimeOSSPkgName}/internal`,
          jsxImportSource: runtimeOSSPkgName,
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
          runtimePkg: `${runtimeOSSPkgName}/internal`,
          target: 'MIXED',
        },
        refresh: false,
        cssScope: false,
      });

      if (result.errors.length > 0) {
        console.error(result.errors);
        throw new Error('transformReactLynxSync failed');
      }

      return {
        code: result.code,
        map: result.map,
      };
    },
  };
}

const preactEntries = [
  'preact',
  'preact/compat',
  'preact/debug',
  'preact/devtools',
  'preact/hooks',
  'preact/test-utils',
  'preact/jsx-runtime',
  'preact/jsx-dev-runtime',
  'preact/compat',
  'preact/compat/client',
  'preact/compat/server',
  'preact/compat/jsx-runtime',
  'preact/compat/jsx-dev-runtime',
  'preact/compat/scheduler',
];
const preactAlias = preactEntries.map((entry) => ({
  find: new RegExp(entry + '$'),
  replacement: resolver.create.sync({
    conditionNames: [
      'import',
    ],
  })(
    runtimeOSSDir,
    entry,
  ) as string,
}));
if (process.env.DEBUG) {
  console.log('preactAlias', preactAlias);
}

export default defineConfig({
  server: {
    fs: {
      allow: [
        path.join(utils.__dirname, '..'),
      ],
    },
  },
  plugins: [
    transformReactLynxPlugin(),
    react({ jsxImportSource: runtimeOSSPkgName }),
  ],
  resolve: {
    alias: [
      ...preactAlias,
      ...runtimeOSSAlias,
    ],
    // conditions: conditionNames,
  },
  test: {
    // builtin environment:
    // environment: "jsdom",
    // custom environment:
    environment: path.join(utils.__dirname, 'vitest-environment-lynxdom'),
    // setupFiles: "src/__tests__/setup.ts",
    globals: true,

    setupFiles: [path.join(utils.__dirname, 'vitest-global-setup')],
  },
});
