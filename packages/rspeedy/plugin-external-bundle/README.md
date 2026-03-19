<p align="center">
  <a href="https://lynxjs.org/rspeedy" target="blank"><img src="https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/rspeedy-banner.png" alt="Rspeedy Logo" /></a>
</p>

<p>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/@lynx-js/external-bundle-rsbuild-plugin">
    <img alt="" src="https://img.shields.io/npm/v/@lynx-js/external-bundle-rsbuild-plugin?logo=npm">
  </a>
  <a aria-label="License" href="https://www.npmjs.com/package/@lynx-js/external-bundle-rsbuild-plugin">
    <img src="https://img.shields.io/badge/License-Apache--2.0-blue" alt="license" />
  </a>
</p>

## Getting Started

```bash
npm install -D @lynx-js/external-bundle-rsbuild-plugin
```

## Usage

```ts
// lynx.config.ts
import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

export default {
  plugins: [
    pluginReactLynx(),
    pluginExternalBundle({
      externals: {
        lodash: {
          url: 'http://lodash.lynx.bundle',
          background: { sectionPath: 'background' },
          mainThread: { sectionPath: 'mainThread' },
        },
      },
    }),
  ],
}
```

## Documentation

Visit [Lynx Website](https://lynxjs.org/api/rspeedy/external-bundle-rsbuild-plugin) to view the full documentation.

## Contributing

Contributions to Rspeedy are welcome and highly appreciated. However, before you jump right into it, we would like you to review our [Contribution Guidelines](/CONTRIBUTING.md) to make sure you have a smooth experience contributing to this project.

## License

Rspeedy is Apache-2.0 licensed.
