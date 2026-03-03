import { defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Skiplist plugin (same pattern as vitest.config.ts for runtime-core)
// ---------------------------------------------------------------------------

interface Skiplist {
  skip_list: string[];
}

const skiplistPath = path.resolve(__dirname, 'skiplist-dom.json');
const skiplist: Skiplist = JSON.parse(fs.readFileSync(skiplistPath, 'utf-8'));
const skipSet = new Set(skiplist.skip_list);

function skiplistPlugin() {
  return {
    name: 'vue-upstream-dom-skiplist',
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
// Import rewriting plugin for runtime-dom tests
// ---------------------------------------------------------------------------

/**
 * Rewrite imports in upstream runtime-dom test files to point to our bridge
 * module. The bridge provides patchProp (routed through our pipeline) and
 * stub exports for runtime-dom internals.
 */
function rewriteRuntimeDomImportsPlugin() {
  const bridgePath = path.resolve(
    __dirname,
    'src/lynx-runtime-dom-bridge.ts',
  );

  return {
    name: 'vue-upstream-rewrite-runtime-dom-imports',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('runtime-dom/__tests__')) return;

      let result = code;

      // '../src/patchProp' → bridge
      result = result.replace(
        /from\s+['"]\.\.\/src\/patchProp['"]/g,
        `from '${bridgePath}'`,
      );

      // '../src/nodeOps' → bridge
      result = result.replace(
        /from\s+['"]\.\.\/src\/nodeOps['"]/g,
        `from '${bridgePath}'`,
      );

      // '../src/components/Transition' → bridge
      result = result.replace(
        /from\s+['"]\.\.\/src\/components\/Transition['"]/g,
        `from '${bridgePath}'`,
      );

      // '../src/modules/attrs' → bridge
      result = result.replace(
        /from\s+['"]\.\.\/src\/modules\/attrs['"]/g,
        `from '${bridgePath}'`,
      );

      // '../src' (runtime-dom entry) → bridge
      result = result.replace(
        /from\s+['"]\.\.\/src['"]/g,
        `from '${bridgePath}'`,
      );

      // '@vue/runtime-dom' → bridge
      result = result.replace(
        /from\s+['"]@vue\/runtime-dom['"]/g,
        `from '${bridgePath}'`,
      );

      // 'vue' → bridge (some tests import from 'vue')
      result = result.replace(
        /from\s+['"]vue['"]/g,
        `from '${bridgePath}'`,
      );

      return result !== code ? result : undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Test file selection
// ---------------------------------------------------------------------------

const testDir = 'core/packages/runtime-dom/__tests__';

const includedTests = [
  'patchStyle',
  'patchClass',
  'patchEvents',
  'patchProps',
  'patchAttrs',
].map((name) => `${testDir}/${name}.spec.ts`);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export default defineConfig({
  plugins: [skiplistPlugin(), rewriteRuntimeDomImportsPlugin()],
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
    setupFiles: [
      path.resolve(__dirname, 'src/runtime-dom-setup.ts'),
      path.resolve(__dirname, 'core/scripts/setup-vitest.ts'),
    ],
    testTimeout: 10000,
  },
});
