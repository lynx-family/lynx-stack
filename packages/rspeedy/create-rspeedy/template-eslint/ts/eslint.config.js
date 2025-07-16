import { globalIgnores } from 'eslint/config'
import * as tseslint from 'typescript-eslint'

import configs from '@lynx-js/eslint-config-reactlynx/ts'

/** @type {tseslint.ConfigArray} */
const config = tseslint.config([
  ...configs,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
  },
  globalIgnores(['dist']),
])

export default config
