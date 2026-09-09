import { defineConfig } from '@rstest/core'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config'

export default defineConfig({
  extends: withDefaultConfig(),
  plugins: [pluginReactLynx()],
})
