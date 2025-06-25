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

## Structure

- `src/lynx.ts`: Main preset configuration that reverse-engineered [Tailwind's core plugins](https://github.com/tailwindlabs/tailwindcss/blob/v3/src/corePlugins.js).
- `src/plugins/lynx/`: Custom plugins as replacement when per-class customization are needed.
- `src/__tests__/`: Test files to ensure correct utility generation

## Contributing

### Getting Started

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test
```

### Adding New Utilities

#### 1. Check if the CSS property is supported by Lynx

This can be verified in three ways:

1. [`@lynx-js/css-defines`](https://www.npmjs.com/package/@lynx-js/css-defines), this is the most accurate list of CSS properties supported by Lynx, directly generated from the source of Lynx internal definitions and released along with each Lynx releases.
2. `csstype.d.ts` in `@lynx-js/types`, this is used as the types of inline styles (e.g. `<view style>`) but this is currently maintained manually.
3. Lynx's runtime behaviors.

#### 2. Add/Remove it from the preset

If it's part of a core Tailwind plugin:

- Add it to `corePlugins` in `src/lynx.ts`
- Add the property to `supportedProperties` in `src/__tests__/config.test.ts`
- Add the utility mapping to `cssPropertyValueToTailwindUtility`

If it needs custom handling e.g. Lynx only support a partial set of the core plugin defined classes, or we need extensions e.g. `.linear`:

- Create a new plugin in `src/plugins/lynx/`
- Export it in `src/plugins/lynx/index.ts`
- Add it to the plugins array in `src/core.ts`

#### 3. Adding Tests

We test by using Tailwind CLI to build `src/__tests__/` demo project with our preset, then extracting all properties used in the generated utilities and verify if all used properties are allowed according to `@lynx-js/types`.

To test new Tailwind utilities:

1. Modify `testClasses` in `src/__tests__/test-content.tsx`
2. Modify `supportedProperties` or `allowedUnsupportedProperties` in `config.test.ts`
3. Run tests with `pnpm test` to verify with Vitest.

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
