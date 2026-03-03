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
 * Rewrite `from '../src/...'` imports in upstream runtime-core test files to
 * `from '@vue/runtime-core'` ESM bundle.
 */
function rewriteRuntimeCoreImportsPlugin() {
  const runtimeCorePath = path.dirname(
    require.resolve('@vue/runtime-core/package.json'),
  );
  const runtimeCoreESM = path.join(
    runtimeCorePath,
    'dist/runtime-core.esm-bundler.js',
  );

  return {
    name: 'vue-upstream-rewrite-runtime-core-imports',
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

/**
 * Rewrite `from '../src/...'` imports in upstream reactivity test files to
 * `from '@vue/reactivity'` ESM bundle. The `../src/dep` internal module
 * is mapped to a shim that stubs non-exported symbols.
 */
function rewriteReactivityImportsPlugin() {
  const reactivityPath = path.dirname(
    require.resolve('@vue/reactivity/package.json'),
  );
  const reactivityESM = path.join(
    reactivityPath,
    'dist/reactivity.esm-bundler.js',
  );
  const depShimPath = path.resolve(__dirname, 'src/reactivity-dep-shim.ts');

  return {
    name: 'vue-upstream-rewrite-reactivity-imports',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('reactivity/__tests__')) return;

      let result = code;

      // ../src/dep → shim (has non-exported internal symbols)
      result = result.replace(
        /from\s+['"]\.\.\/src\/dep['"]/g,
        `from '${depShimPath}'`,
      );
      // ../../src/dep (from collections/) → shim
      result = result.replace(
        /from\s+['"]\.\.\/\.\.\/src\/dep['"]/g,
        `from '${depShimPath}'`,
      );

      // @vue/runtime-dom → @vue/reactivity (ref.spec.ts imports computed from runtime-dom)
      result = result.replace(
        /from\s+['"]@vue\/runtime-dom['"]/g,
        `from '${reactivityESM}'`,
      );

      // ../src/* and ../src → @vue/reactivity ESM
      result = result.replace(
        /from\s+['"]\.\.\/src(?:\/[^'"]*)?['"]/g,
        `from '${reactivityESM}'`,
      );
      // ../../src/* and ../../src (from collections/) → @vue/reactivity ESM
      result = result.replace(
        /from\s+['"]\.\.\/\.\.\/src(?:\/[^'"]*)?['"]/g,
        `from '${reactivityESM}'`,
      );

      return result !== code ? result : undefined;
    },
  };
}

/**
 * Rewrite `from '../src/...'` imports in upstream shared test files to
 * `from '@vue/shared'` ESM bundle.
 */
function rewriteSharedImportsPlugin() {
  const sharedPath = path.dirname(
    require.resolve('@vue/shared/package.json'),
  );
  const sharedESM = path.join(
    sharedPath,
    'dist/shared.esm-bundler.js',
  );

  return {
    name: 'vue-upstream-rewrite-shared-imports',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('shared/__tests__')) return;
      if (!code.includes('from \'../src')) return;

      const result = code.replace(
        /from\s+['"]\.\.\/src(?:\/[^'"]*)?['"]/g,
        `from '${sharedESM}'`,
      );
      return result !== code ? result : undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Test file selection
// ---------------------------------------------------------------------------

const runtimeCoreDir = 'core/packages/runtime-core/__tests__';
const reactivityDir = 'core/packages/reactivity/__tests__';
const sharedDir = 'core/packages/shared/__tests__';

const runtimeCoreTests = [
  // Phase 2 — original 17 suites
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
  // Phase 3 — additional suites
  'misc',
  'rendererTemplateRef',
  'apiSetupContext',
  'apiExpose',
  'apiAsyncComponent',
  'scopeId',
].map((name) => `${runtimeCoreDir}/${name}.spec.ts`);

const reactivityTests = [
  // 'computed', // EXCLUDED: hangs during collection (imports @vue/runtime-test adapter which has initialization conflict)
  'effect',
  'effectScope',
  'gc',
  'reactive',
  'reactiveArray',
  'readonly',
  'ref',
  'shallowReactive',
  'shallowReadonly',
  'watch',
].map((name) => `${reactivityDir}/${name}.spec.ts`);

const reactivityCollectionTests = [
  'Map',
  'Set',
  'shallowReadonly',
  'WeakMap',
  'WeakSet',
].map((name) => `${reactivityDir}/collections/${name}.spec.ts`);

const sharedTests = [
  'codeframe',
  'escapeHtml',
  'looseEqual',
  'normalizeProp',
  'toDisplayString',
].map((name) => `${sharedDir}/${name}.spec.ts`);

const includedTests = [
  ...runtimeCoreTests,
  ...reactivityTests,
  ...reactivityCollectionTests,
  ...sharedTests,
];

export default defineConfig({
  plugins: [
    skiplistPlugin(),
    rewriteRuntimeCoreImportsPlugin(),
    rewriteReactivityImportsPlugin(),
    rewriteSharedImportsPlugin(),
  ],
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
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
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
