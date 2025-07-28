# Lynx Tailwind Preset (V3)

A [Tailwind V3](https://v3.tailwindcss.com/) CSS preset specifically designed for Lynx, ensuring that only CSS properties supported by Lynx are available as Tailwind utilities.

> **⚠️ Experimental**\
> This preset is currently in experimental stage as we are still exploring the best possible DX to write Tailwind upon Lynx. We welcome and encourage contributions from the community to help shape its future development. Your feedback, bug reports, and pull requests are invaluable in making this preset more robust and feature-complete.

## Basic Usage

```typescript
// tailwind.config.ts
import preset from '@lynx-js/tailwind-preset';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [preset],
};
```

```typescript
// tailwind.config.ts
import { createLynxPreset } from '@lynx-js/tailwind-preset';

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  presets: [
    createLynxPreset({
      lynxPlugins: { boxShadow: false }, // disable boxShadow plugin
    }),
  ],
};
```

## Integration notes

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
