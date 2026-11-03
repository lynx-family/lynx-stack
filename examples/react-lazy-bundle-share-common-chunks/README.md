# Lazy bundles with a common chunk

PageA and PageB are lazy bundles that both import `shared.ts`. Rsbuild puts the shared module in one common chunk.

Run `pnpm dev` to open the demo in LynxExplorer, or `pnpm build` to inspect the output in `dist/`.
