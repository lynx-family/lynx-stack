# Contributing

## Getting Started

```bash
# Run from the repository root
pnpm install --frozen-lockfile

pnpm turbo build
pnpm run test --project tailwind-preset
```

## Architecture

`createLynxPreset()` in `src/lynx.ts` combines three parts:

- `corePlugins`: the enabled Tailwind CSS v3 Core plugins from
  `DEFAULT_CORE_PLUGINS` in `src/core.ts`.
- `plugins`: the ordered Lynx and Lynx UI plugins.
- `theme`: the Lynx defaults from `src/theme.ts`.

The default export uses the standard options. Use the named
`createLynxPreset()` export to configure plugins or override top-level theme
keys.

### Utility Sources

**Tailwind Core plugins** generate standard Tailwind utilities.
`DEFAULT_CORE_PLUGINS` is an allowlist: omitted plugins stay disabled.
Commented names in `src/core.ts` are notes only.

**Lynx plugins** live in `src/plugins/lynx/` and serve two roles:

- Replacements adapt Tailwind utilities to Lynx CSS.
- Extensions add Lynx-specific utilities or selected newer syntax.

Keep the matching Core plugin disabled when adding a replacement. Enabling
both implementations can produce conflicting declarations.

The registry entries form the built-in Lynx plugin set. They are enabled by
default and configurable through `lynxPlugins`. The `defaults` plugin cannot be
disabled.

**Lynx UI plugins** support common UI patterns without depending on a component
library. They live in `src/plugins/lynx-ui/` and are configurable through
`lynxUIPlugins`. Inspired by `@headlessui/tailwindcss`, `uiVariants` provides
`ui-*`, `parent-ui-*`, `group-ui-*`, and `peer-ui-*` variants for state classes
such as `.ui-open` and `.ui-checked`.

**The Lynx theme** limits named values used by Core and Lynx plugins. The
`theme` option passed to `createLynxPreset()` replaces matching top-level keys.
Use `theme.extend` in a downstream leaf preset to add project tokens.

### Plugin Registration and Order

`src/plugins/lynx/plugin-registry.ts` defines each Lynx plugin's name,
implementation, and order. `createLynxPreset()` always follows this order,
regardless of the `lynxPlugins` option form.

Order is part of plugin behavior:

- `defaults` is always registered first, even when `lynxPlugins` is disabled.
  It initializes the variables used by composed transforms.
- Transform components run before plugins that write the complete `transform`
  property.
- Each Filter plugin writes the complete `filter` property, so Filter
  utilities are mutually exclusive.
- Transition Property runs before Delay, Duration, and Timing Function, which
  depend on its property list.

### Project Structure

- `src/lynx.ts`: assembles and exports the preset.
- `src/core.ts`: selects Core plugins and resolves plugin options.
- `src/theme.ts`: defines Lynx theme defaults.
- `src/plugins/lynx/`: utility replacements and Lynx extensions.
- `src/plugins/lynx-ui/`: configurable UI plugins.
- `src/helpers.ts`: typed wrappers for Tailwind APIs and internals.
- `src/plugin-utils/`: shared plugin helpers.
- `src/__tests__/plugins/`: isolated plugin tests.
- `src/__tests__/config.test.ts`: Tailwind CLI integration.
- `docs/tailwind-css-v3-support.md`: current utility support.
- `docs/preset-extensions.md`: utilities and variants outside Tailwind CSS v3.
- `docs/utility-design-notes.md`: pending design decisions.

## Adding New Utilities

### Verify the Lynx CSS capability

Check all of these sources:

1. Public Lynx CSS documentation, including target and SDK restrictions.
2. [`@lynx-js/css-defines`][css-defines].
3. Runtime behavior on every supported target.

An entry in CSS definitions confirms registration, not continued support.
Check that the property is maintained and accepts the values emitted by
Tailwind.

### Enable a Tailwind Core plugin

Use a Core plugin when its output works in Lynx. Remove unsupported named
values through `lynxTheme` where possible.

1. Add the plugin name to `DEFAULT_CORE_PLUGINS` in `src/core.ts`.
2. Add representative positive and negative CLI candidates.
3. Update the support matrix with any remaining restrictions.

### Add a Lynx plugin

Add a Lynx plugin when Tailwind output needs adapting or the utility is
Lynx-specific.

1. Create a new plugin in `src/plugins/lynx/`.
2. Reuse `src/helpers.ts` and `src/plugin-utils/` where possible.
3. Export it from `src/plugins/lynx/index.ts`.
4. Register it at the correct position in
   `src/plugins/lynx/plugin-registry.ts`.
5. Add plugin tests, CLI coverage, and documentation.

### Add another plugin category

Create a category only when its plugins need options or enablement separate
from `lynxPlugins` and `lynxUIPlugins`.

1. Create a category folder under `src/plugins/`, such as
   `src/plugins/experimental/`.
2. Add and export the plugin from that category.
3. Add a registry when the category contains ordered plugins.
4. Resolve its enablement and options in `src/core.ts`.
5. Add the selected plugins to `src/lynx.ts`.

## Adding Tests

The test suite has three layers:

- Plugin tests use a mocked Tailwind API to check one plugin at a time.
- `config.test.ts` runs the real Tailwind CSS v3 CLI without Autoprefixer. It
  checks representative selectors, `output.css`, and generated properties.
- `dist-interop.test.ts` checks the built ESM and CommonJS exports.

To test new Tailwind utilities:

1. Add supported classes to their sidebar group in `test-content.ts`.
2. Add classes that must stay unavailable to `unsupportedClasses`.
3. If the generated CSS uses a property missing from `documentedProperties`,
   add it to `verifiedUndocumentedProperties` with runtime or source evidence.
   Update `documentedProperties` only when refreshing the July 4, 2025
   documentation snapshot.
4. Run `pnpm run test --project tailwind-preset` from the repository root.

To test new plugins:

1. Add a test in `src/__tests__/plugins/` using the `runPlugin` helper and
   mocked theme values.
2. Run `pnpm run test --project tailwind-preset` from the repository root.

[css-defines]: https://www.npmjs.com/package/@lynx-js/css-defines
