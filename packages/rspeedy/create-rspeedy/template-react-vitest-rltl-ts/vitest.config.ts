import { defineConfig } from 'vitest/config'
import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins'

export default defineConfig({
  plugins: [vitestTestingLibraryPlugin()],
})
