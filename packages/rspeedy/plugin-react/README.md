<p align="center">
  <a href="https://lynxjs.org/rspeedy" target="blank"><img src="https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/rspeedy-banner.png" alt="Rspeedy Logo" /></a>
</p>

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

```js
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { defineConfig } from '@rsbuild/core'

export default defineConfig({
  plugins: [
    pluginReactLynx(),
  ],
})
```

## Version compatibility

Upgrade this plugin and `@lynx-js/react` together. The module-delivery release requires `@lynx-js/react@^0.128.0`, which includes both the runtime and its matching transform. Custom transforms must implement the same registration-import and semantic runtime-requirements protocol.

Main-thread functions import `@lynx-js/react/worklet-runtime/init` through the application module graph. Rebuild libraries and lazy bundles with the matching toolchain. The lightweight `loadWorkletRuntime` compatibility export remains for precompiled consumers: it can reuse an initialized runtime or request a host-provided legacy chunk. The current toolchain does not emit that legacy chunk.

## Compilation results

Other Rsbuild plugins can read React's semantic runtime requirements through the versioned compile-result exposure. Import its types from the package root and obtain the exposure with `Symbol.for`:

```ts
import type { ReactCompileResultExposureV1 } from '@lynx-js/react-rsbuild-plugin'
import type { RsbuildPlugin } from '@rsbuild/core'

const consumeReactCompileResult: RsbuildPlugin = {
  name: 'consume-react-compile-result',
  setup(api) {
    const exposure = api.useExposed<ReactCompileResultExposureV1>(
      Symbol.for('@lynx-js/react/internal:compile-result'),
    )

    api.onAfterEnvironmentCompile(({ environment, stats }) => {
      if (environment.name !== 'lynx' || !stats || stats.hasErrors()) {
        return
      }

      const result = exposure?.getCompileResult(stats)
      // result?.runtimeRequirements.mainThreadProgrammability is true,
      // false, or undefined when no compatible result is available.
    })
  },
}
```

Register this consumer after `pluginReactLynx()`. Pass the original `Stats` or `MultiStats` while the compiler is available, before closing the build; serialized `stats.toJson()` output is not supported. Hooks may omit `stats`, so check it before calling the exposure.

A known result distinguishes an explicit `false` from `undefined` (unknown). For `MultiStats`, all child compilations must provide a compatible semantic result; their requirements are combined with OR. If any child has no compatible producer, the entire result is unknown. For a mixed Lynx/web build, pass the target environment's single `Stats`, as in the example, to read only that environment's requirements.

## Documentation

Visit [Lynx Website](https://lynxjs.org/api/rspeedy/react-rsbuild-plugin.pluginreactlynx.html) to view the full documentation.

## Contributing

Contributions to Rspeedy are welcome and highly appreciated. However, before you jump right into it, we would like you to review our [Contribution Guidelines](/CONTRIBUTING.md) to make sure you have a smooth experience contributing to this project.

## License

Rspeedy is Apache-2.0 licensed.
