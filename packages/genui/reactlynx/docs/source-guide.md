# ReactLynx source and builds

## Two-file contract

The response is one JSON object containing exactly `files["App.tsx"]` and
`files["App.css"]`. `App.tsx` is non-empty and default-exports the `App` function
component; `App.css` may be empty. Additional files or top-level fields are rejected.

```ts
const modelOutput = JSON.stringify({
  files: {
    'App.tsx': `import { useState } from '@lynx-js/react';
export default function App() {
  const [count, setCount] = useState(0);
  return <view className="page">
    <text bindtap={() => setCount(value => value + 1)}>Count: {count}</text>
  </view>;
}`,
    'App.css':
      '.page { display: flex; flex-direction: column; padding: 24px; }',
  },
});
```

`parseReactLynxSource` accepts JSON and JSON Markdown fences. It checks shape and
string-length limits: 512,000 characters for JSON, 256,000 for TSX, and 128,000
for CSS. `normalizeReactLynxSource` applies the same validation and returns JSON.
Neither helper compiles source; syntax and import checks run during compilation.

## Build API

```ts
import { buildReactLynx, parseReactLynxSource } from '@lynx-js/genui/reactlynx';

const controller = new AbortController();
const assets = await buildReactLynx(
  parseReactLynxSource(modelOutput),
  controller.signal,
  status => console.log(status),
);
// Call controller.abort() to cancel queued or running work.
```

The callback reports `queued` and `building`. A successful call returns
`ReactLynxBuildAsset[]`, with a relative `name` and `Buffer` `data` for each asset,
including `main.web.js` and `main.lynx.js`. Publish every asset together; the API
does not upload files or create preview URLs.

The compiler allows two active builds and eight queued builds per loaded module,
limits worker lifetime to 120 seconds, and limits output to 16 MiB and 128 files.
An invalid source, full queue, cancellation, timeout, or compiler error rejects
the promise. Temporary projects are removed on completion or failure.

Keep the package entry external in server builds and retain its installed runtime
dependencies. This preserves the adjacent `build-worker.js` and module resolution.
