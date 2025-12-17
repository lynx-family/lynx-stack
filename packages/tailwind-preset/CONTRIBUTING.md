# Contributing

## Getting Started

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test
```

## Structure

- `src/lynx.ts`: Main preset configuration that reverse-engineered [Tailwind's core plugins](https://github.com/tailwindlabs/tailwindcss/blob/v3/src/corePlugins.js).
- `src/plugins/lynx/`: Custom plugins as replacement when per-class customization are needed.
- `src/__tests__/`: Test files to ensure correct utility generation

## Adding New Utilities

### Check if the CSS property is supported by Lynx

This can be verified in three ways:

1. [`@lynx-js/css-defines`](https://www.npmjs.com/package/@lynx-js/css-defines), this is the most accurate list of CSS properties supported by Lynx, directly generated from the source of Lynx internal definitions and released along with each Lynx releases.
2. `csstype.d.ts` in `@lynx-js/types`, this is used as the types of inline styles (e.g. `<view style>`) but this is currently maintained manually.
3. Lynx's runtime behaviors.

### If enabling a Tailwind core plugin

1. Add it to `DEFAULT_CORE_PLUGINS` array in `src/core.ts`.

### If adding Lynx core plugins

For plugins that are considered **part of the Lynx core preset** — either implementing Tailwind core utilities or providing Lynx-specific functionality.

1. Create a new plugin in `src/plugins/lynx/`.
2. Use shared helpers from `src/helpers.ts` and `src/plugin-utils/` where applicable.
3. Export it from `src/plugins/lynx/index.ts`.
4. Register it in `src/plugins/lynx/plugin-registry.ts`.\
   _(This ensures a stable sorting order for the core set)_
5. It will be automatically included in `src/core.ts` via the Lynx plugin registry.

### If adding non-core / custom plugin categories

For plugins that are **not part of the Lynx core preset**–such as experimental features, app-specific utilities, or standalone plugin groups:

1. These plugins require explicit registration and ordering
2. Create a new category folder under `src/plugins/` (e.g. `src/plugins/experimental/`)
3. Add the plugin in that folder, and optionally extract shared logic into `plugin-utils/`
4. Export the plugin from `src/plugins/{category}/index.ts`
5. Define a `plugin-registry.ts` in the same folder to control plugin order
6. Import the registry in `src/core.ts` and include it in the appropriate position

## Adding Tests

We test by using Tailwind CLI to build `src/__tests__/` demo project with our preset, then extracting all properties used in the generated utilities and verify if all used properties are allowed according to `@lynx-js/types`.

To test new Tailwind utilities:

1. Modify `testClasses` in `src/__tests__/test-content.tsx`.
2. Modify `supportedProperties` or `allowedUnsupportedProperties` in `config.test.ts`.
3. Run tests with `pnpm test` to verify with Vitest.

To test new plugins:

1. Add new test file in `src/__tests__/plugins`. Import `runPlugin` test util function from `src/__tests__/utils/run-plugin.ts`. Mock theme values.
2. Run tests with `pnpm test` to verify with Vitest.
