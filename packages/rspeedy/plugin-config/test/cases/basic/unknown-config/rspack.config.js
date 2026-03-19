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
        unknown: 'unknown',
      },
      compilerOptionsKeys,
      configKeys,
    }),
    new LynxTemplatePlugin({
      intermediate: '',
    }),
    new LynxEncodePlugin(),
  ],
}
