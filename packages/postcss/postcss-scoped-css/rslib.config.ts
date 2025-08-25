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
 * A PostCSS plugin to use scoped CSS in Lynx.
 *
 * @example
 *
 * \`\`\`js
 * // postcss.config.js
 * export default {
 *   plugins: {
 *     '@lynx-js/postcss-scoped-css': {},
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
