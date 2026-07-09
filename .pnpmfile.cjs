'use strict';

const packagesUsingLegacyTypeScriptApi = new Set([
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  '@typescript-eslint/project-service',
  '@typescript-eslint/tsconfig-utils',
  '@typescript-eslint/type-utils',
  '@typescript-eslint/typescript-estree',
  '@typescript-eslint/utils',
  'rsbuild-plugin-arethetypeswrong',
  'ts-api-utils',
  'typedoc',
  'typescript-eslint',
]);

module.exports = {
  hooks: {
    readPackage(pkg) {
      if (!packagesUsingLegacyTypeScriptApi.has(pkg.name)) {
        return pkg;
      }

      pkg.dependencies = {
        ...pkg.dependencies,
        typescript: '5.9.3',
      };

      delete pkg.peerDependencies?.typescript;
      delete pkg.peerDependenciesMeta?.typescript;

      return pkg;
    },
  },
};
