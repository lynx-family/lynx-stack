import { defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Skiplist plugin
// ---------------------------------------------------------------------------

interface Skiplist {
  skip_list: string[];
}

const skiplistPath = path.resolve(__dirname, 'skiplist.json');
const skiplist: Skiplist = JSON.parse(fs.readFileSync(skiplistPath, 'utf-8'));
const skipSet = new Set(skiplist.skip_list);

function skiplistPlugin() {
  return {
    name: 'vue-upstream-skiplist',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('__tests__') || !id.endsWith('.spec.ts')) return;
      if (skipSet.size === 0) return;

      const itPattern =
        /\b((?:it|test)(?:\.only)?)\s*\(\s*(['"`])((?:(?!\2).)*)\2/g;
      let modified = false;
      const result = code.replace(
        itPattern,
        (match, keyword, quote, testName) => {
          if (skipSet.has(testName)) {
            modified = true;
            const base = keyword.startsWith('test') ? 'test' : 'it';
            return `${base}.skip(${quote}${testName}${quote}`;
          }
          return match;
        },
      );

      if (modified) return result;
      return undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Define globals plugin — inject __DEV__ etc.
// ---------------------------------------------------------------------------

/**
 * Rewrite `from '../src/...'` imports in upstream test files to
 * `from '@vue/runtime-core'`. These relative paths point into the
 * vuejs/core source tree which isn't available via the installed package.
 */
/**
 * Rewrite `from '../src/...'` imports in upstream test files to
 * `from '@vue/runtime-core'`. These relative paths point into the
 * vuejs/core source tree which isn't available via the installed package.
 */
function rewriteRelativeImportsPlugin() {
  const runtimeCorePath = path.dirname(
    require.resolve('@vue/runtime-core/package.json'),
  );
  const runtimeCoreESM = path.join(
    runtimeCorePath,
    'dist/runtime-core.esm-bundler.js',
  );

  return {
    name: 'vue-upstream-rewrite-imports',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('runtime-core/__tests__')) return;
      if (!code.includes('from \'../src')) return;

      const result = code.replace(
        /from\s+['"]\.\.\/src(?:\/[^'"]*)?['"]/g,
        `from '${runtimeCoreESM}'`,
      );
      return result !== code ? result : undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Test file selection
// ---------------------------------------------------------------------------

const testDir = 'core/packages/runtime-core/__tests__';

const includedTests = [
  'rendererElement',
  'rendererChildren',
  'rendererFragment',
  'rendererComponent',
  'componentProps',
  'componentSlots',
  'componentEmits',
  'apiLifecycle',
  'apiWatch',
  'apiInject',
  'apiCreateApp',
  'directives',
  'errorHandling',
  'h',
  'vnode',
  'vnodeHooks',
  'scheduler',
].map((name) => `${testDir}/${name}.spec.ts`);

export default defineConfig({
  plugins: [skiplistPlugin(), rewriteRelativeImportsPlugin()],
  define: {
    __DEV__: 'true',
    __TEST__: 'true',
    __BROWSER__: 'false',
    __GLOBAL__: 'false',
    __ESM_BUNDLER__: 'true',
    __ESM_BROWSER__: 'false',
    __CJS__: 'false',
    __SSR__: 'false',
    __FEATURE_OPTIONS_API__: 'true',
    __FEATURE_SUSPENSE__: 'true',
    __FEATURE_PROD_DEVTOOLS__: 'false',
    __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    __COMPAT__: 'false',
    __VERSION__: '"3.5.12"',
  },
  test: {
    globals: true,
    include: includedTests,
    alias: [
      {
        find: '@vue/runtime-test',
        replacement: path.resolve(__dirname, 'src/lynx-runtime-test.ts'),
      },
      // Some tests import from 'vue' directly
      {
        find: /^vue$/,
        replacement: path.resolve(__dirname, 'src/lynx-runtime-test.ts'),
      },
      // @vue/server-renderer is not available
      {
        find: '@vue/server-renderer',
        replacement: path.resolve(__dirname, 'src/stubs/server-renderer.ts'),
      },
    ],
    setupFiles: [
      path.resolve(__dirname, 'core/scripts/setup-vitest.ts'),
    ],
    testTimeout: 10000,
  },
});
