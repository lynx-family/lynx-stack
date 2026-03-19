# Lynx Tailwind Preset (V3)

A [Tailwind CSS v3](https://v3.tailwindcss.com/) preset for the Lynx ecosystem.

This preset is not a 1:1 port of Tailwind's core. Instead, it provides a **Lynx-native Tailwind experience** tailored for the platform's rendering model and ecosystem needs by:

- Including only CSS utilities that Lynx supports

- Reimagining certain utilities to align with Lynx's styling constraints and runtime behavior

- Enabling ecosystem extensions such as UI state variants, animation presets, and design token integration

> **⚠️ Experimental**\
> This preset is currently in experimental stage as we are still exploring the best possible DX to write Tailwind upon Lynx. We welcome and encourage contributions from the community to help shape its future development. Your feedback, bug reports, and pull requests are invaluable in making this preset more robust and feature-complete.

## Basic Usage

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';
import preset from '@lynx-js/tailwind-preset';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [preset],
} satisfies Config;
```

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';
import { createLynxPreset } from '@lynx-js/tailwind-preset';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  presets: [
    createLynxPreset({
      lynxPlugins: { boxShadow: false }, // disable boxShadow plugin
    }),
  ],
};
export default config;
```

### Plugin Defaults

In this preset, all Lynx plugins (including UI plugins such as `uiVariants`) are **enabled by default** when not explicitly configured.
You can disable individual plugins by setting them to `false`, or override their options with an object.

```ts
createLynxPreset({
  lynxUIPlugins: {
    uiVariants: false, // disable uiVariants
  },
});
```

## Integration Notes

### tailwind-merge & rsbuild-plugin-tailwindcss

When you combine this preset with **`tailwind-merge`** and **`rsbuild-plugin-tailwindcss`**, you may notice a flood of seemingly unused class names in the final bundle.\
The root cause is that `rsbuild-plugin-tailwindcss` scans every file under `node_modules`, so any package that contains raw Tailwind source (for example, **tailwind-merge**) gets parsed and its classes are emitted—even if you never reference them.

To limit the scan to only the code you control while still allowing Tailwind-based component libraries to work, supply an `exclude` pattern that removes only the offending package(s).\
Here is a minimal example that **excludes _only_ `tailwind-merge`**:

```ts
// rsbuild.config.ts
import { pluginTailwindCSS } from 'rsbuild-plugin-tailwindcss';

export default {
  plugins: [
    pluginTailwindCSS({
      config: 'tailwind.config.ts',
      // Prevent Tailwind utilities inside `tailwind-merge` from being scanned
      exclude: [/[\\/]node_modules[\\/]tailwind-merge[\\/]/],
    }),
  ],
};
```

## Ecosystem Extensions

Beyond core utility coverage, this preset supports ecosystem-level extensions to improve component styling DX and support common Tailwind ecosystem patterns adapted for Lynx.

### Lynx UI Plugins

UI plugins (such as `uiVariants`) are **enabled by default**, consistent with Tailwind’s behavior.
This is because Lynx currently lacks pseudo-selectors and data-attribute selectors at the core level.
UI plugins are therefore recommended to bridge these gaps and provide practical ways to express component states.

Enabling them by default does **not** change core behavior.
If Lynx later adds native support for attribute selectors, this design choice will remain compatible and won't affect existing usage.

You can still disable or configure them explicitly:

```ts
// disable all UI plugins
createLynxPreset({
  lynxUIPlugins: false,
});
```

```ts
// disable a single plugin
createLynxPreset({
  lynxUIPlugins: { uiVariants: false },
});
```

```ts
// configure a plugin with custom options
createLynxPreset({
  lynxUIPlugins: {
    uiVariants: {
      prefixes: {
        ui: ['open', 'checked'],
      },
    },
  },
});
```

```ts
// keep defaults explicitly (same as `true`)
createLynxPreset({
  lynxUIPlugins: {},
});
```

#### Available Plugins

- [uiVariants](https://github.com/lynx-family/lynx-stack/tree/main/packages/tailwind-preset/docs/plugins/lynx-ui/uiVariants.md) — Class-based variants for expressing component state or structure using `ui-*` prefixes (e.g. `.ui-open:`, `.ui-side-left:`).
