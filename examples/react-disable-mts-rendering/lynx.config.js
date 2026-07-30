import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];

export default defineConfig({
  plugins: [
    // The root-level `<Background fallback={…}>` in `src/index.tsx` is the
    // declarative trigger: a production build detects it and disables MTS
    // rendering (`enableMTSRendering` defaults to `'auto'`), assembling the
    // main-thread bundle from the background-collected definitions and
    // rendering the static fallback as the first frame.
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
