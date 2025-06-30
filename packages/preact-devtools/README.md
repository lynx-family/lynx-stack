# Preact Devtools for ReactLynx

The [LynxDevtool](https://github.com/lynx-family/lynx-devtool) Panel that allows you to inspect a ReactLynx component hierarchy, including props and state.

## Usage

We need to import `@lynx-js/preact-devtools` somewhere to initialize the connection
to Preact Devtools Panel. Make sure that this import is **the first** import in your
whole app.

```bash
import '@lynx-js/preact-devtools'
```

## Contributing

- [`ldt-plugin`](./ldt-plugin/) contains the source code of Preact Devtools Panel in LynxDevtool. Run it by `pnpm run dev` when developing, and `pnpm run build` to build it.
- [`src`](./src/) contains the source code for ReactLynx App to setup Preact Devtools related hooks. You can build it just by `pnpm run build` in the root folder of this repository.

The ReactLynx App will communicate with the Preact Devtools Panel in LynxDevtool using CDP messages.

## Credits

Thanks to:

- [Preact Devtools](https://github.com/preactjs/preact-devtools) for the original Devtools implementation for Preact.
