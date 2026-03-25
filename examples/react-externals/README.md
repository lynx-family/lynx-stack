# @lynx-js/example-react-externals

In this example, we show:

- Use `@lynx-js/lynx-bundle-rslib-config` to bundle a simple ReactLynx component library to a separate Lynx bundle.
- Use `@lynx-js/external-bundle-rsbuild-plugin` to load the built-in ReactLynx runtime bundle (sync) and component bundle (async).

## Usage

```bash
pnpm build:comp-lib
pnpm dev
```

The dev server will automatically serve the built-in ReactLynx runtime bundle and the component library bundle.
