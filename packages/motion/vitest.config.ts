import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';
import type { DirectiveInferenceConfig } from '@lynx-js/react/transform';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  fs.readFileSync(path.join(dirname, 'directive-inference.json'), 'utf8'),
) as {
  protocolVersion: 1;
  exports: DirectiveInferenceConfig['modules'][number]['exports'];
};

export default defineConfig({
  plugins: [
    vitestTestingLibraryPlugin({
      directiveInference: {
        protocolVersion: 1,
        modules: [{
          source: '@lynx-js/motion',
          package: '@lynx-js/motion',
          packageVersion: '0.0.6',
          manifest: 'directive-inference.json',
          exports: manifest.exports,
        }],
      },
    }),
  ],
  resolve: {
    alias: {
      '@lynx-js/motion': path.join(dirname, 'src/index.ts'),
    },
  },
  test: {
    include: ['__tests__/**/*.test.{js,ts,jsx,tsx}'],
    exclude: ['__tests__/utils/**'],
    coverage: {
      include: ['src/**'],
    },
  },
});
