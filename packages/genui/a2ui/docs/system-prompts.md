# System prompts

Generate and customize the system instructions that teach an LLM to emit valid A2UI messages.

Generate a reusable prompt with the CLI for most deployments, or build one programmatically when the backend needs request-specific catalog or policy inputs. The prompt tells the model how to produce A2UI v0.9 JSON. It includes the protocol rules, the component catalog, function signatures, validated examples, and hard constraints that keep the renderer output safe and parseable.

## 1. CLI

Use `npx @lynx-js/genui a2ui generate prompt` when the backend only needs a static prompt file.

Generate a prompt with the built-in A2UI basic catalog:

```bash
npx @lynx-js/genui a2ui generate prompt --out dist/a2ui-system-prompt.txt
```

Print the prompt to stdout:

```bash
npx @lynx-js/genui a2ui generate prompt
```

Append deployment-specific instructions:

```bash
npx @lynx-js/genui a2ui generate prompt \
  --appendix "Prefer compact mobile layouts for travel booking flows." \
  --out dist/a2ui-system-prompt.txt
```

`generate prompt` uses the built-in A2UI basic catalog by default. The generated prompt requires `createSurface.catalogId` to match the catalog id embedded in the prompt.

### Custom catalogs

For custom components, first generate catalog artifacts:

```bash
npx @lynx-js/genui a2ui generate catalog \
  --catalog-dir src/catalog \
  --source src/functions \
  --out-dir dist/catalog
```

Then generate the prompt from those artifacts:

```bash
npx @lynx-js/genui a2ui generate prompt \
  --catalog-dir dist/catalog \
  --catalog-id https://example.com/catalogs/custom/v1/catalog.json \
  --out dist/a2ui-system-prompt.txt
```

`--catalog-dir` must point at generated files such as `<Component>/catalog.json`. If the catalog also has generated function files under `functions/*.json`, they are included in the prompt as callable function signatures.

The package exposes the same commands through the `genui` binary after installation, so project scripts may use `genui a2ui ...` when `@lynx-js/genui` is already installed locally. Existing A2UI-only scripts may also use the `a2ui-cli` compatibility alias.

## 2. Programmatic usage

Use `@lynx-js/genui/a2ui-prompt` when the backend needs to construct prompts in Node.js code.

Build the default prompt:

```ts
import { buildA2UISystemPrompt } from '@lynx-js/genui/a2ui-prompt';

const systemPrompt = buildA2UISystemPrompt();
```

Add request- or deployment-specific instructions:

```ts
import { buildA2UISystemPrompt } from '@lynx-js/genui/a2ui-prompt';

const systemPrompt = buildA2UISystemPrompt({
  appendix: [
    'Prefer concise mobile-first layouts.',
    'When the user asks for charts, use LineChart only when numeric series are available.',
  ].join('\n'),
});
```

Read a generated custom catalog and build a prompt for it:

```ts
import {
  buildA2UISystemPrompt,
  readA2UICatalogFromDirectory,
} from '@lynx-js/genui/a2ui-prompt';

const catalog = readA2UICatalogFromDirectory({
  catalogDir: 'dist/catalog',
  catalogId: 'https://example.com/catalogs/custom/v1/catalog.json',
  label: 'Example app catalog',
  version: 'v1',
});

const systemPrompt = buildA2UISystemPrompt({ catalog });
```

For fully in-memory catalog construction, use `createA2UICatalogFromManifests(...)` with component JSON schemas and optional function specs, then pass the resulting catalog to `buildA2UISystemPrompt`.

## What gets generated

The generated prompt includes:

- A2UI v0.9 protocol overview and design principles.
- Required server-to-client message types: `createSurface`, `updateComponents`, `updateDataModel`, and `deleteSurface`.
- Required message ordering for a fresh response.
- Data binding rules for `{ "path": "/..." }` values and list children.
- Client action rules for events and function calls.
- A rendered catalog reference with component summaries, props, required fields, container shape, enum values, and function signatures.
- Hard rules for JSON-only output, catalog id matching, flat component trees, `root` component requirements, button labels/actions, modal confirmation flows, image query handling, and action-response patches.
- Validated examples from the catalog, when the catalog provides examples.
- Optional appendix text supplied by the CLI or programmatic API.

The model should return a JSON array of A2UI messages, not Markdown or prose:

```json
[
  {
    "version": "v0.9",
    "createSurface": {
      "surfaceId": "main",
      "catalogId": "https://a2ui.org/specification/v0_9/basic_catalog.json"
    }
  },
  {
    "version": "v0.9",
    "updateComponents": {
      "surfaceId": "main",
      "components": [
        {
          "id": "root",
          "component": "Text",
          "text": "Hello A2UI"
        }
      ]
    }
  }
]
```

## Backend usage example

The prompt can be used with any model provider that accepts a system message. The backend should send the system prompt before user messages and then parse or stream the model output as A2UI JSON.

```ts
import OpenAI from 'openai';
import { buildA2UISystemPrompt } from '@lynx-js/genui/a2ui-prompt';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const systemPrompt = buildA2UISystemPrompt();

export async function POST(req: Request) {
  const { messages } = await req.json();
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? 'your-model',
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  });

  return new Response(completion.toReadableStream(), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

If the backend supports interactive A2UI actions, preserve the conversation history and pass client action messages back to the model. Action responses should update the existing surface with `updateDataModel` and/or `updateComponents` instead of creating a new surface.

## Choosing an approach

Use the CLI when:

- The catalog changes at build time.
- The backend can read a checked-in or generated prompt file.
- Multiple services should share exactly the same prompt text.

Use programmatic generation when:

- The catalog, appendix, or safety policy changes per deployment or request.
- The backend already loads generated catalog artifacts.
- You need to compose custom `A2UICatalog` objects in code.

For custom renderer catalogs and manifest generation, see [Catalogs and manifests](./catalog-guide.md) and [Custom components](./custom-components.md).
