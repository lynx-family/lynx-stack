import { pluginReact } from '@rsbuild/plugin-react'
import { defineConfig } from '@rslib/core'

export default defineConfig({
  bundle: false,
  output: {
    target: 'web',
    // Keep JSX in the output. The Lynx app that uses this library compiles it
    // with its own ReactLynx version.
    filename: {
      js: '[name].jsx',
    },
  },
  plugins: [
    pluginReact({
      swcReactOptions: {
        runtime: 'preserve',
      },
    }),
  ],
})
