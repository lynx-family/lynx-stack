import { defineConfig } from '@rslib/core';
import type { RslibConfig } from '@rslib/core';

const config: RslibConfig = defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: { bundle: true },
      banner: {
        dts: `\
/**
 * @packageDocumentation
 *
 * A PostCSS plugin to remove the unsupported style rule based on engineVersion.
 *
 * @example
 *
 * \`\`\`js
 * // postcss.config.js
 * export default {
 *   plugins: {
 *     '@lynx-js/postcss-remove-unsupported': {
 *       engineVersion: '3.4',
 *     },
 *   },
 * }
 * \`\`\`
 */
`,
      },
    },
  ],
});

export default config;
