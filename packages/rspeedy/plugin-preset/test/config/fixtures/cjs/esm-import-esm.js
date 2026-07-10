import { pluginFoo } from 'esm-pkg'

export default {
  source: {
    entry: 'esm-import-esm',
  },
  plugins: [pluginFoo()],
}
