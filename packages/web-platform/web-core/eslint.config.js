import compat from 'eslint-plugin-compat';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
export default defineConfig(
  compat.configs['flat/recommended'],
  {
    ignores: ['dist/**', 'binary/**', 'css/**', 'scripts/**', 'tests/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'lintAllEsApis': true,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.object.name="Promise"][callee.property.name="withResolvers"]',
          message: 'Promise.withResolvers is not supported in target browsers.',
        },
      ],
    },
  },
);
