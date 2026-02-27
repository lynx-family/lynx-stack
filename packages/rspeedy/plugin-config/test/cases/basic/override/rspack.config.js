import {
  LynxTemplatePlugin,
  LynxEncodePlugin,
} from '@lynx-js/template-webpack-plugin'
import { compilerOptionsKeys, configKeys } from '@lynx-js/type-config'

import { LynxConfigWebpackPlugin } from '../../../../src/LynxConfigWebpackPlugin'

export default {
  plugins: [
    new LynxConfigWebpackPlugin({
      LynxTemplatePlugin,
      config: {
        enableA11y: false,
        enableNewIntersectionObserver: false,
      },
      compilerOptionsKeys,
      configKeys,
    }),
    new LynxTemplatePlugin({
      intermediate: '',
      enableA11y: true,
    }),
    new LynxEncodePlugin(),
  ],
}
