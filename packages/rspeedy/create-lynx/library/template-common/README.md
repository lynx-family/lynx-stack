## ReactLynx library

This is a ReactLynx component library bootstrapped with `@lynx-js/create-lynx`.

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, build the library:

```bash
pnpm run build
```

The output in `dist/` keeps JSX as is (`*.jsx`), so that the Lynx app that
depends on this library compiles it with its own ReactLynx version.

Run the tests with:

```bash
pnpm run test
```

You can start editing the library by modifying the components under `src/`
and exporting them from `src/index`.
