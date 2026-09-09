import { defineConfig } from '@rstest/core'
import { withRslibConfig } from '@rstest/adapter-rslib'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config'

export default defineConfig({
  extends: [withDefaultConfig(), withRslibConfig()],
  plugins: [pluginReactLynx()],
})
