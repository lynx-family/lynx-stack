<p>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/@lynx-js/react-rsbuild-plugin">
    <img alt="" src="https://img.shields.io/npm/v/@lynx-js/react-rsbuild-plugin?logo=npm">
  </a>
  <a aria-label="License" href="https://www.npmjs.com/package/@lynx-js/react-rsbuild-plugin">
    <img src="https://img.shields.io/badge/License-Apache--2.0-blue" alt="license" />
  </a>
</p>

A Rsbuild plugin to integrate with ReactLynx.

## Getting Started

```bash
npm install -D @lynx-js/react-rsbuild-plugin
```

## Getting Started

<!-- eslint-disable -->

```ts
// rsbuild.config.ts
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { defineConfig } from '@rsbuild/core'

export default defineConfig({
  environments: { lynx: {} },
  plugins: [
    pluginReactLynx(),
  ],
})
```

## Documentation

Visit [Lynx Website](https://lynxjs.org/api/rspeedy/react-rsbuild-plugin.pluginreactlynx.html) to view the full documentation.

## Contributing

Contributions to Rspeedy are welcome and highly appreciated. However, before you jump right into it, we would like you to review our [Contribution Guidelines](/CONTRIBUTING.md) to make sure you have a smooth experience contributing to this project.

## License

Rspeedy is Apache-2.0 licensed.
