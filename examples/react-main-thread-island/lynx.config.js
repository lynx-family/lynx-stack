import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];

export default defineConfig({
  plugins: [
    // The root-level `<MainThread>` in `src/index.tsx` is the declarative
    // trigger, the opt-in twin of a root `<Background>`: a production build
    // detects it and stops compiling business code for the main thread
    // (`enableMTSRendering` defaults to `'auto'`) — except for the island,
    // whose module is compiled into the main-thread layer so it renders on
    // the first frame.
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`;
      },
    }),
  ],
  performance: {
    profile: enableBundleAnalysis,
  },
});
