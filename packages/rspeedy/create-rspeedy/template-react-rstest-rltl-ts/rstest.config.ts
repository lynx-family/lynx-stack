import { defineConfig } from '@rstest/core'
import { withLynxConfig } from '@lynx-js/react/testing-library/rstest-adapter'

export default defineConfig({
  extends: withLynxConfig(),
})
