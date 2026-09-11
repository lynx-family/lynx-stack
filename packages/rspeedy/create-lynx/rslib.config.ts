import type { RslibConfig } from '@rslib/core'
import { defineConfig } from '@rslib/core'

const config: RslibConfig = defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2021' },
  ],
})

export default config
