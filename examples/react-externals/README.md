# @lynx-js/example-react-externals

In this example, we show:

- Use `@lynx-js/lynx-bundle-rslib-config` to bundle a simple ReactLynx component library to a separate Lynx bundle.
- Use `@lynx-js/debug-metadata-rsbuild-plugin` to collect source maps and per-custom-section TASM bytecode debug information for that external bundle.
- Use `@lynx-js/external-bundle-rsbuild-plugin` to load the built-in ReactLynx runtime bundle (sync) and component bundle (async).

## Usage

```bash
pnpm build:comp-lib
pnpm dev
```

The dev server will automatically serve the built-in ReactLynx runtime bundle and the component library bundle.

## Inspecting debug metadata

Run the dedicated debug build to retain intermediate assets and
`debug-metadata.json` locally:

```bash
pnpm build:comp-lib:debug-metadata
```

The result is written to
`dist-external-bundle/debug-metadata.json`. Its main-thread artifact is matched
to bytecode debug information through the emitted asset's actual TASM
`customSections` key; the example does not rely on an entry filename convention.

The regular production build keeps the same plugin configuration for CI upload
integrations, but the debug metadata plugin removes the local metadata asset
after reporting unless debug mode is enabled.
