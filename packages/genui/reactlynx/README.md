# GenUI ReactLynx

English | [简体中文](./README_zh.md)

ReactLynx generation turns a request into a complete interactive Lynx page. The
model returns `App.tsx` and `App.css`; your Node.js backend validates the response,
compiles Web and Native bundles, and publishes all emitted assets for your host.

## Install

```bash
pnpm add @lynx-js/genui @lynx-js/react
```

## Generate and build

```ts
import {
  buildReactLynx,
  parseReactLynxSource,
  REACTLYNX_SYSTEM_PROMPT,
} from '@lynx-js/genui/reactlynx';

// Supply REACTLYNX_SYSTEM_PROMPT as the system message to your model.
// modelOutput is the complete response text from your model integration.
const source = parseReactLynxSource(modelOutput);
const controller = new AbortController();
const assets = await buildReactLynx(source, controller.signal, status => {
  console.log(status); // queued, then building
});
```

These APIs are also exported from `@lynx-js/genui`. Use the focused subpath in
Node.js tools and servers. Keep `@lynx-js/genui/reactlynx` external when bundling
those servers so its compiler worker stays beside its entry point.

Publish every asset using its `name` as a relative path and `data` as the bytes.
Load `main.web.js` with Lynx for Web or `main.lynx.js` with a Native Lynx host.
Compilation returns assets; storage, URLs, model calls, and transport belong to
your application. Render the completed bundle after compilation and publication.

## Guides

- [Overview and architecture](./docs/overview.md)
- [Source and builds](./docs/source-guide.md)
- [System prompts](./docs/system-prompts.md)

Try generation and preview in the [GenUI Playground](https://lynx-stack.dev/genui/).
