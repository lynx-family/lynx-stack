# @lynx-js/rsbuild-plugin

An Rsbuild plugin for building Lynx apps.

## Usage

```ts
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core'

import { pluginLynx } from '@lynx-js/rsbuild-plugin'

export default defineConfig({
  plugins: [pluginLynx()],
})
```

## Object.hasOwn compatibility

For `lynx` and `lynx-*` environments, the engine includes the core-js Object.hasOwn shim through SWC's `env.include`. The plugin provides the dependency and resolves it when the application has no core-js installation. No application configuration or pre-entries are required.

ReactLynx carries builtin includes to both threads while preserving the main thread's syntax baseline. The shim keeps a working native implementation when one is available. Add `es.object.has-own` to `tools.swc.env.exclude` to disable the internal rule. The engine excludes core-js itself from compilation to avoid recursive injection. Web environments are unchanged.
