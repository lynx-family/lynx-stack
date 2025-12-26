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
        engineVersion: '2.16.0',
        enableCSSSelector: false,
      },
      compilerOptionsKeys,
      configKeys,
    }),
    new LynxTemplatePlugin({
      intermediate: '',

      enableCSSSelector: true,
      enableRemoveCSSScope: false,
    }),
    new LynxEncodePlugin(),
  ],
}
