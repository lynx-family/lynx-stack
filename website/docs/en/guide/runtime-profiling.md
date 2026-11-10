# Runtime Profiling

## Profiling Lynx

Following the instruction of [Record Trace](https://lynxjs.org/guide/devtool/trace/record-trace.html) to profiling Lynx.

## Profiling Framework

You can analyze framework performance in two ways: via build configuration and using the [JS Profile](https://lynxjs.org/guide/devtool/trace/js-profile.html).

### Enabling via Build Configuration

We provide the builtin trace points in frameworks like ReactLynx (Components' `render` and `diff`).

![react profile](https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/plugin/static/rspeedy-react-profile.png)

- In development(`rspeedy dev`): ReactLynx-related trace points are _**added**_ by default.
- In production(`rspeedy build`): ReactLynx-related trace points are _**removed**_ by default.

These tracing points show how components are rendered and diffed.

#### Run profiling in production

The trace points can be enabled by setting the [`performance.profile`] to `true` when build.

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  performance: {
    // [!code ++]
    profile: true, // [!code ++]
  }, // [!code ++]
});
```

:::tip
You may use [`rspeedy preview`](./cli.md#rspeedy-preview) to preview the output locally.
:::

This is useful when trying to optimize the performance of the application.

:::warning
Do **NOT** deploy the output with `performance.profile: true`. They are not for production.
:::

#### Disable profiling in development

The trace points can be disabled by setting the [`performance.profile`] to `false` when dev.

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  performance: {
    // [!code ++]
    profile: false, // [!code ++]
  }, // [!code ++]
});
```

### Dynamic Sampling with JS Profile

Use the [JS Profile](https://lynxjs.org/guide/devtool/trace/js-profile.html) tool to collect call stack data at runtime without modifying the build configuration.

[`performance.profile`]: ../api/rspeedy.performance.profile.md
