// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import js from '@eslint/js';
import markdown from '@eslint/markdown';
import vitest from '@vitest/eslint-plugin';
import headers from 'eslint-plugin-headers';
import importPlugin from 'eslint-plugin-import';
import nodePlugin from 'eslint-plugin-n';
import * as regexpPlugin from 'eslint-plugin-regexp';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  // Global ignores
  // https://eslint.org/docs/latest/use/configure/configuration-files-new#globally-ignoring-files-with-ignores
  {
    ignores: [
      // dependencies
      '**/node_modules/**',
      '.pnpm-store/**',

      // Outputs
      '**/.rslib/**',
      '**/.turbo/**',
      '**/coverage/**',
      'output/**',
      'target/**',
      '**/test/js',
      '**/dist/**',
      '**/lib/**',
      '.changeset/*',
      '**/CHANGELOG.md',
      '**/etc/*.md',
      'website/docs/en/api/**',
      'website/docs/zh/api/**',
      'website/docs/en/changelog/**',
      'website/docs/zh/changelog/**',

      // Test snapshots
      '**/expected/**',
      '**/rspack-expected/**',
      'packages/react/transform/tests/__swc_snapshots__/**',
      'packages/react/transform/__test__/**/__snapshots__/**',

      'packages/react/transform/**/tests/__swc_snapshots__/**',

      // Configs
      'eslint.config.js',
      'vitest.config.ts',
      '**/rslib.config.ts',

      // Ignored packages
      'packages/**/vitest.config.ts',
      'packages/react/runtime/compat/**',
      'packages/rspeedy/create-rspeedy/template-*/**',
      'packages/{rspeedy,webpack}/*/test/**/cases/**',
      'packages/{rspeedy,webpack}/*/test/**/hotCases/**',
      'packages/{rspeedy,webpack}/*/test/**/diagnostic/**',
      'packages/{rspeedy,webpack}/*/test/**/fixtures/**',
      'packages/webpack/**/runtime/**',
      'packages/webpack/css-extract-webpack-plugin/test/js/**',
      'packages/webpack/css-extract-webpack-plugin/test/rspack-js/**',
      // Generated
      'packages/react/transform/index.d.ts',
      'packages/react/transform/index.cjs',
      'packages/react/transform/**/index.d.ts',

      // TODO: enable eslint for react
      // react
      'packages/react/types/**',
      'packages/react/runtime/__test__/**',
      'packages/react/runtime/jsx-dev-runtime/**',
      'packages/react/runtime/jsx-runtime/**',
      'packages/react/runtime/lazy/**',
      'packages/react/runtime/lepus/**',
      'packages/react/runtime/src/renderToOpcodes/**',
      'packages/react/runtime/types/**',

      // TODO: enable eslint for react-runtime
      'packages/react/runtime/src/compat/**',
      'packages/react/runtime/src/opcodes.ts',

      // TODO: enable eslint for tools
      // tools
      'packages/tools/**',

      // TODO: enable eslint for web-platform
      // web-platform
      'packages/web-platform/**',

      // TODO: enable eslint for testing-library
      // testing-library
      'packages/testing-library/**',
      'packages/react/testing-library/**',

      // gesture-runtime-testing
      'packages/lynx/gesture-runtime/__test__/**',
      // TODO: enable eslint for tailwind-preset
      // tailwind-preset
      'packages/tailwind-preset/**',
    ],
  },
  js.configs.recommended,
  {
    plugins: {
      headers,
    },
    ignores: ['**/*.md/*'],
    rules: {
      'headers/header-format': [
        'error',
        {
          source: 'string',
          style: 'line',
          content: [
            'Copyright (year) {authors}. All rights reserved.',
            'Licensed under the (license) that can be found in the',
            'LICENSE file in the root directory of this source tree.',
          ].join('\n'),
          variables: {
            authors: 'The Lynx Authors',
          },
          patterns: {
            year: {
              pattern: '\\d{4}',
              defaultValue: new Date().getFullYear().toString(),
            },
            license: {
              pattern: [
                'Apache License Version 2.0',
                'MIT license',
              ].join('|'),
              defaultValue: 'Apache License Version 2.0',
            },
          },
        },
      ],
    },
  },
  regexpPlugin.configs['flat/recommended'],
  ...markdown.configs.recommended,
  ...markdown.configs.processor,
  // Rules from eslint-plugin-n
  nodePlugin.configs['flat/recommended-module'],
  {
    rules: {
      'n/file-extension-in-import': ['error', 'always'],
      'n/prefer-node-protocol': 'error',
      'n/no-extraneous-import': ['error', {
        allowModules: ['vitest', 'preact'],
      }],
      'n/no-unpublished-import': 'off',
      'n/no-missing-import': 'off',
      'n/hashbang': 'off',
    },
  },
  // Rules from eslint-plugin-unicorn
  {
    plugins: {
      unicorn: eslintPluginUnicorn,
    },
    rules: {
      'unicorn/consistent-function-scoping': 'error',
      'unicorn/empty-brace-spaces': 'error',
      'unicorn/expiring-todo-comments': 'error',
      'unicorn/no-abusive-eslint-disable': 'error',
      'unicorn/no-anonymous-default-export': 'error',
      'unicorn/no-array-callback-reference': 'error',
      'unicorn/no-array-push-push': 'error',
      'unicorn/no-await-expression-member': 'error',
      'unicorn/no-await-in-promise-methods': 'error',
      'unicorn/no-console-spaces': 'error',
      'unicorn/no-hex-escape': 'error',
      'unicorn/no-invalid-remove-event-listener': 'error',
      'unicorn/no-lonely-if': 'error',
      'unicorn/no-negated-condition': 'error',
      'unicorn/no-nested-ternary': 'error',
      'no-nested-ternary': 'off',
      'unicorn/no-new-array': 'error',
    },
  },
  // Import-related
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
      'import/internal-regex': '^@lynx-js/',
    },
    rules: {
      'import/no-commonjs': 'error',
      'import/no-cycle': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/order': [
        'error',
        {
          'groups': [
            'builtin', // Built-in imports (come from NodeJS native) go first
            'external', // <- External imports
            'internal', // <- Absolute imports
            ['sibling', 'parent'], // <- Relative imports, the sibling and parent types they can be mingled together
            'index', // <- index imports
            'unknown', // <- unknown
          ],
          'newlines-between': 'always',
          'alphabetize': {
            /* sort in ascending order. Options: ["ignore", "asc", "desc"] */
            order: 'asc',
            /* ignore case. Options: [true, false] */
            caseInsensitive: true,
          },
        },
      ],
      'import/consistent-type-specifier-style': 'warn',
      'sort-imports': [
        'error',
        {
          ignoreCase: false,
          ignoreDeclarationSort: true, // don't want to sort import lines, use eslint-plugin-import instead
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
          allowSeparatedGroups: true,
        },
      ],
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.nodeBuiltin,
        ...globals.es2021,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  // TypeScript-related
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.md/**'],
    extends: [
      tseslint.configs.eslintRecommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: {
          allowDefaultProject: ['*.js', 'rslib.config.ts', 'vitest.config.ts'],
          defaultProject: './tsconfig.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-generic-constructors': 'off',
    },
  },
  // JavaScript-related
  {
    files: ['**/*.{js,jsx,cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      // turn off other type-aware rules
      'deprecation/deprecation': 'off',
      '@typescript-eslint/internal/no-poorly-typed-ts-props': 'off',

      // turn off rules that don't apply to JS code
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        jsxPragma: null,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: [
      'e2e/**',
      'examples/**/*.{js,mjs,cjs,jsx,ts,tsx}',
      'website/**/*.{js,mjs,cjs,jsx,ts,tsx}',
    ],
    languageOptions: {
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        jsxPragma: null,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Vitest-related
  {
    files: ['**/*.test.ts', '**/*.test-d.ts'],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
    },
    settings: {
      vitest: {
        typecheck: true,
      },
    },
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
  },
  // CommonJS-related
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        sourceType: 'commonjs',
      },
    },
    rules: {
      'import/no-commonjs': 'off',
    },
  },
  {
    rules: {
      // Migrated to biomejs
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/adjacent-overload-signatures': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/consistent-type-exports': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'default-param-last': 'off',
      '@typescript-eslint/default-param-last': 'off',
      'no-empty': 'off',
      'no-empty-static-block': 'off',
      'no-empty-function': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-extra-non-null-assertion': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-invalid-void-type': 'off',
      '@typescript-eslint/no-misused-new': 'off',
      '@typescript-eslint/no-namespace': 'off',
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unnecessary-type-constraint': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-empty-export': 'off',
      'no-throw-literal': 'off',
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/prefer-enum-initializers': 'off',
      '@typescript-eslint/prefer-for-of': 'off',
      '@typescript-eslint/prefer-function-type': 'off',
      '@typescript-eslint/prefer-literal-enum-member': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  // React-related
  {
    files: [
      'examples/**/*.{jsx,tsx}',
    ],
    extends: [
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
  },
  {
    files: [
      'examples/**',
    ],
    settings: {
      'import/resolver': {
        typescript: {
          project: 'examples/**/tsconfig.json',
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      // TODO: enable header for examples
      'headers/header-format': 'off',
    },
  },
);
