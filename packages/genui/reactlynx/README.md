# GenUI ReactLynx

`@lynx-js/genui-reactlynx` owns the ReactLynx generation contract and the
restricted server-side compiler used by GenUI.

The package exports:

- `REACTLYNX_SYSTEM_PROMPT`, the model instructions for the two-file artifact.
- `parseReactLynxSource` and `normalizeReactLynxSource`, which accept exactly
  `App.tsx` and `App.css` within their configured limits.
- `buildReactLynx`, which builds Web and Native bundles in an isolated child
  process and returns every emitted asset.

The compiler accepts imports from `@lynx-js/react` only. It owns the generated
entry point and Rsbuild configuration, disables CSS URL and import resolution,
and never executes model-authored build configuration. Builds have bounded
concurrency, queue depth, diagnostics, output size, lifetime, and heap size.

The package must remain a runtime dependency of its server consumer so
`dist/build-worker.js` stays beside `dist/index.js`. Do not bundle its public
entry into a different output directory.

The repository Dockerfile uses `pnpm deploy --prod` to install this package with
its own production and peer dependencies at the existing workspace package path.
The compiler worker enables Node's `production` export condition so workspace
plugins load their bundled `dist` entries. Deployment requires no tarballs or
manifest rewriting.

```ts
import {
  buildReactLynx,
  parseReactLynxSource,
  REACTLYNX_SYSTEM_PROMPT,
} from '@lynx-js/genui-reactlynx';

const source = parseReactLynxSource(modelOutput);
const assets = await buildReactLynx(source, signal, status => {
  console.log(status);
});
```
