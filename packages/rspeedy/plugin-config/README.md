<p align="center">
  <a href="https://lynxjs.org/rspeedy" target="blank"><img src="https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/rspeedy-banner.png" alt="Rspeedy Logo" /></a>
</p>

<p>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/@lynx-js/config-rsbuild-plugin">
    <img alt="" src="https://img.shields.io/npm/v/@lynx-js/config-rsbuild-plugin?logo=npm">
  </a>
  <a aria-label="License" href="https://www.npmjs.com/package/@lynx-js/config-rsbuild-plugin">
    <img src="https://img.shields.io/badge/License-Apache--2.0-blue" alt="license" />
  </a>
</p>

## Getting Started

```bash
npm install -D @lynx-js/config-rsbuild-plugin
```

## Usage

```ts
// rsbuild.config.ts
import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { defineConfig } from '@rsbuild/core'

export default defineConfig({
  environments: { lynx: {} },
  plugins: [
    pluginReactLynx(),
    pluginLynxConfig({
      enableCheckExposureOptimize: false,
    }),
  ],
})
```

## Contributing

Contributions to Rspeedy are welcome and highly appreciated. However, before you jump right into it, we would like you to review our [Contribution Guidelines](/CONTRIBUTING.md) to make sure you have a smooth experience contributing to this project.

## License

Rspeedy is Apache-2.0 licensed.
