# A2UI Prompt

`@lynx-js/genui/a2ui-prompt` provides A2UI system prompt construction utilities for
CLI and backend usage.

The source of truth for the built-in prompt and catalog is
`packages/genui/server/agent`. This package re-exports and bundles those server
agent sources for publishing, so the server package stays self-contained for
package-root deployments while CLI users can still install a standalone prompt
package.

## Usage

Build a prompt with the built-in A2UI basic catalog:

```ts
import { buildA2UISystemPromptAsync } from '@lynx-js/genui/a2ui-prompt';

const prompt = await buildA2UISystemPromptAsync();
```

Read generated catalog artifacts and build a prompt for a custom catalog:

```ts
import {
  buildA2UISystemPrompt,
  readA2UICatalogFromDirectory,
} from '@lynx-js/genui/a2ui-prompt';

const catalog = readA2UICatalogFromDirectory({
  catalogDir: 'dist/catalog',
  catalogId: 'https://example.com/catalogs/custom/v1/catalog.json',
});

const prompt = buildA2UISystemPrompt({ catalog });
```

`readA2UICatalogFromDirectory` prefers the full catalog file, such as
`dist/catalog.json`, and falls back to generated component files such as
`catalog/<Component>/catalog.json`.
Use `genui a2ui generate catalog` to create those artifacts.

## Exports

- `buildA2UISystemPrompt`
- `BASIC_CATALOG_ID`
- `renderCatalogReference`
- `createA2UICatalogFromManifests`
- `loadBasicCatalog`
- `buildA2UISystemPromptAsync`
- `readA2UICatalogFromDirectory`

## Local Development

Build the publishable bundle:

```bash
pnpm -C packages/genui/a2ui-prompt build
```

Run the package type check:

```bash
pnpm -C packages/genui/a2ui-prompt exec tsc -p tsconfig.json --noEmit
```
