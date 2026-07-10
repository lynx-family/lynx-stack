# @lynx-js/genui

Generative UI primitives for Lynx applications.

`@lynx-js/genui` is the single npm package for the GenUI toolchain. It exposes
A2UI rendering, OpenUI rendering, A2UI prompt/catalog utilities, and the CLI
from one package while keeping implementation directories private to this
monorepo.

## Installation

```bash
pnpm add @lynx-js/genui @lynx-js/react
```

`@lynx-js/react` is a peer dependency. Some built-in A2UI catalog components
also use `@lynx-js/lynx-ui`; install it when your app renders those components.

## Entry Points

```ts
import {
  A2UI,
  createMessageStore,
  createOpenUiLibrary,
  createStreamingParser,
  buildA2UISystemPrompt,
  extractCatalogComponents,
} from '@lynx-js/genui';
```

The root entry point exports the stable APIs most applications and tools need:

- A2UI ReactLynx renderer and data-store helpers.
- OpenUI parser, library, and renderer APIs.
- A2UI prompt builders.
- A2UI catalog extraction utilities.

Focused subpaths are also available:

```ts
import { A2UI, Text, Button } from '@lynx-js/genui/a2ui';
import { createMessageStore } from '@lynx-js/genui/a2ui/store';
import { createOpenUiLibrary } from '@lynx-js/genui/openui';
import { buildA2UISystemPrompt } from '@lynx-js/genui/a2ui-prompt';
import { extractCatalogComponents } from '@lynx-js/genui/a2ui-catalog-extractor';
```

Catalog manifests are exported through a single public catalog entry:

```ts
import { Text, Button } from '@lynx-js/genui/a2ui/catalog';
```

## A2UI

A2UI renders agent-generated UI messages that follow the A2UI v0.9 protocol.
Create a message store, push protocol messages into it from your transport, and
render the latest surface with `<A2UI>`.

```tsx
import { A2UI, Button, Text, createMessageStore } from '@lynx-js/genui/a2ui';

const messageStore = createMessageStore();

export function GenUIScreen() {
  return (
    <A2UI
      messageStore={messageStore}
      catalogs={[Text, Button]}
      onAction={(action) => {
        // Send the action back to your agent, then push response messages
        // into the same messageStore.
      }}
    />
  );
}
```

Use the A2UI style entry when you want the packaged component styles:

```ts
import '@lynx-js/genui/a2ui/styles/theme.css';
```

See [`a2ui/README.md`](./a2ui/README.md) for catalog composition and custom
component details.

## OpenUI

OpenUI renders OpenUI Lang v0.5 responses through a configurable component
library.

```tsx
import { OpenUiRenderer, createOpenUiLibrary } from '@lynx-js/genui/openui';

const library = createOpenUiLibrary();
const response = 'root = Stack([TextContent("Hello")])';

export function OpenUIScreen() {
  return <OpenUiRenderer response={response} library={library} />;
}
```

Renderer styles are explicit:

```ts
import '@lynx-js/genui/openui/styles/renderer.css';
```

See [`openui/README.md`](./openui/README.md) for streaming and custom library
examples.

## CLI

The package installs the GenUI CLI and the low-level catalog extractor binary:

```bash
genui --help
genui-cli --help
a2ui-catalog-extractor --help
```

`a2ui-cli` is also kept as a compatibility alias for existing A2UI scripts. New
scripts should prefer the namespace-first `genui a2ui ...` or
`genui openui ...` form.

Generate catalog artifacts:

```bash
genui a2ui generate catalog \
  --catalog-dir src/catalog \
  --source src/functions \
  --out-dir dist/catalog
```

Generate an A2UI system prompt:

```bash
genui a2ui generate prompt \
  --catalog-dir dist/catalog \
  --out dist/a2ui-system-prompt.txt
```

Generate an OpenUI system prompt:

```bash
genui openui generate prompt --out dist/openui-system-prompt.txt
```

## Published Package Layout

Only `@lynx-js/genui` is intended to be published. The package contains compiled
JavaScript and declarations under `dist/` directories, plus CLI entry points,
README files, styles, and extractor skills.

The root `index.ts` is compiled during build. Do not hand-write
`dist/index.js` or `dist/index.d.ts`; run:

```bash
pnpm -C packages/genui build
```

Before publishing, verify the package contents:

```bash
pnpm -C packages/genui pack --dry-run
```

## License

Apache-2.0
