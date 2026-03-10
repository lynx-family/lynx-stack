import { defineConfig, type RstestConfig } from '@rstest/core'
import lynxConfig from './lynx.config.js'

export default defineConfig({
  ...lynxConfig as RstestConfig,
  testEnvironment: 'jsdom',
  setupFiles: [
    require.resolve('@lynx-js/react/testing-library/setupFiles/rstest'),
  ],
  globals: true,
})
