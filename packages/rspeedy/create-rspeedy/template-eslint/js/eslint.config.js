import { defineConfig, globalIgnores } from 'eslint/config'

import configs from '@lynx-js/eslint-config-reactlynx'

export default defineConfig([
  ...configs,
  {
    files: ['src/**/*.{js,jsx}'],
  },
  globalIgnores(['dist']),
])
