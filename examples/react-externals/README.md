# @lynx-js/example-react-externals

In this example, we show:

- Use `@lynx-js/lynx-bundle-rslib-config` to bundle ReactLynx runtime to a separate Lynx bundle.
- Use `@lynx-js/lynx-bundle-rslib-config` to bundle a simple ReactLynx component library to a separate Lynx bundle.
- Use `@lynx-js/external-bundle-rsbuild-plugin` to load ReactLynx runtime (sync) and component bundle (async).

## Usage

```bash
pnpm build:reactlynx
pnpm build:comp-lib
pnpx http-server -p 8080 dist
EXTERNAL_BUNDLE_PREFIX=http://${YOUR_IP_HERE}:8080 pnpm dev
```
