import type { RslibConfig } from '@rslib/core';
import { defineConfig } from '@rslib/core';

const config: RslibConfig = defineConfig(
  {
    lib: ['runtime', 'components'].map(folder => {
      return {
        source: {
          entry: {
            [folder]: `./${folder}/src/**`,
          },
        },
        output: {
          distPath: {
            root: `./${folder}/lib`,
          },
          cleanDistPath: false,
        },
        format: 'esm',
        syntax: 'es2021',
        bundle: false,
      };
    }),
  },
);

export default config;
