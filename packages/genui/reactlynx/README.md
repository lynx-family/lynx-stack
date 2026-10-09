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

The repository Dockerfile builds the workspace with Turbo and retains its full
installed dependency graph, including development dependencies. This preserves
the peer links used by workspace packages in the runtime compiler.
Workspace packages keep their existing entry points. Keeping the complete
workspace layout increases image size but leaves published dependency
declarations unchanged.

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
