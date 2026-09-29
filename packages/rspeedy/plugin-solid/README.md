# `@lynx-js/solid-rsbuild-plugin`

Rsbuild integration for SolidLynx applications.

The plugin compiles one authored SolidJS entry into Lynx main-thread and
background-thread assets. It configures Solid's DOM JSX transform to emit
static template fragments, then converts those fragments into Lynx Element
Template metadata and `createTemplate()` calls. The generated runtime bundle
contains template keys and direct attribute, text, and child slot operations
rather than HTML template strings or a shadow tree for static nodes.

Reactive slot reads are grouped into Solid effects in the background bundle.
The main-thread bundle runs the component once for the first frame, then
disposes its Solid owner so it cannot react to later signal updates. The
background bundle establishes the long-lived reactive graph and sends later
slot updates to the existing main-thread Element Template handles. Main-thread
Signal exports expose immutable first-render snapshots and do not subscribe.

## Usage

```ts
import { pluginLynx } from '@lynx-js/rsbuild-plugin'
import { pluginSolidLynx } from '@lynx-js/solid-rsbuild-plugin'
import { defineConfig } from '@rsbuild/core'

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  plugins: [
    pluginLynx(),
    pluginSolidLynx(),
  ],
})
```

Do not create separate application entries for each thread. The same source is
compiled into both assets, while `@lynx-js/solid` selects the appropriate
runtime behavior.
