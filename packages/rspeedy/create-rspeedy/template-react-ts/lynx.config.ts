import { defineConfig, type RsbuildPlugin } from '@lynx-js/rspeedy'

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { pluginTypeCheck } from '@rsbuild/plugin-type-check'

const pluginLynxFullscreenHint = (): RsbuildPlugin => ({
  name: 'rspeedy:lynx-fullscreen-hint',
  setup(api) {
    api.modifyRsbuildConfig({
      order: 'post',
      handler: (config, { mergeRsbuildConfig }) => {
        const prev = config.server?.printUrls
        if (typeof prev !== 'function') return
        return mergeRsbuildConfig(config, {
          server: {
            printUrls: (params) => {
              const urls = prev(params) ?? []
              const out: typeof urls = []
              for (const entry of urls) {
                out.push(entry)
                if (typeof entry !== 'string' && entry.label === 'Lynx') {
                  out.push({
                    label: '∟ No nav',
                    url: `${entry.url}?fullscreen=true`,
                  })
                }
              }
              return out
            },
          },
        })
      },
    })
  },
})

export default defineConfig({
  plugins: [
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`
      },
    }),
    pluginReactLynx(),
    pluginLynxFullscreenHint(),
    pluginTypeCheck(),
  ],
})
