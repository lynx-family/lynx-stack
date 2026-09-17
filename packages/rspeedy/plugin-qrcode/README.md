<p>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/@lynx-js/qrcode-rsbuild-plugin">
    <img alt="" src="https://img.shields.io/npm/v/@lynx-js/qrcode-rsbuild-plugin?logo=npm">
  </a>
  <a aria-label="License" href="https://www.npmjs.com/package/@lynx-js/qrcode-rsbuild-plugin">
    <img src="https://img.shields.io/badge/License-Apache--2.0-blue" alt="license" />
  </a>
</p>

A Rsbuild plugin that generates and displays QR codes for Lynx bundles directly in the terminal.

## Getting Started

```bash
npm install -D @lynx-js/qrcode-rsbuild-plugin
```

## Usage

<!-- eslint-disable -->

```ts
// rsbuild.config.ts
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { defineConfig } from '@rsbuild/core'

export default defineConfig({
  plugins: [pluginReactLynx(), pluginQRCode()],
})
```

## Options

### `schema`

Type: `(url: string) => string | Record<string, string>`\
Default: `(url) => ({ http: url })`

The `schema` option allows you to customize the URL format displayed in the QR code.

<!-- eslint-disable -->

```ts
// rsbuild.config.ts
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { defineConfig } from '@rsbuild/core'

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        return `lynx://${url}?dev=1`
      },
    }),
  ],
})
```

You can also define multiple schemas to switch between them by pressing `a` in the terminal:

<!-- eslint-disable -->

```ts
// rsbuild.config.ts
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { defineConfig } from '@rsbuild/core'

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        return {
          http: url,
          foo: `foo://lynx?url=${encodeURIComponent(url)}&dev=1`,
          bar: `bar://lynx?url=${encodeURIComponent(url)}`,
        }
      },
    }),
  ],
})
```

## Documentation

Visit [Lynx Website](https://lynxjs.org/api/rspeedy/qrcode-rsbuild-plugin.pluginqrcode.html) to view the full documentation.

## Contributing

Contributions to Rspeedy are welcome and highly appreciated. However, before you jump right into it, we would like you to review our [Contribution Guidelines](/CONTRIBUTING.md) to make sure you have a smooth experience contributing to this project.

## License

Rspeedy is Apache-2.0 licensed.
