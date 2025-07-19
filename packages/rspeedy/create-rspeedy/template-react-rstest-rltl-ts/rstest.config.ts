import { defineConfig } from '@rstest/core'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { rstestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins'

export default defineConfig({
  plugins: [
    rstestTestingLibraryPlugin(),
    pluginReactLynx({
      enableTestingLibrary: true,
    }),
  ],
  testEnvironment: 'jsdom',
  setupFiles: [
    require.resolve('@lynx-js/react/testing-library/setupFiles/rstest'),
  ],
  globals: true,
})
