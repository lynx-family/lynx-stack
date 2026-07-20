# System prompts

Generate and customize the instructions that teach an LLM to emit valid OpenUI
Lang for the component Library your ReactLynx client renders.

Use the CLI when the built-in Library and a static prompt file are enough. Use
the programmatic API when tools, feature flags, custom components, or deployment
policy must be assembled in backend code.

## The contract to preserve

An OpenUI system prompt describes:

- the one-assignment-per-line language syntax;
- the required `root` entry point and top-down streaming order;
- component signatures derived from ordered Zod schemas;
- reactive `$variables` and built-in functions;
- Query/Mutation and Action rules;
- tool names and input/output schemas, when supplied;
- examples and hard constraints for parseable output.

The prompt-side Library and client renderer Library must agree on every
component name and positional prop order. If they drift, the model can produce
valid text for one side that the other side rejects.

## 1. CLI

Generate the default built-in OpenUI prompt to a file:

```sh
npx @lynx-js/genui openui generate prompt \
  --out dist/openui-system-prompt.txt
```

Print it to stdout:

```sh
npx @lynx-js/genui openui generate prompt
```

Append deployment-specific rules:

```sh
npx @lynx-js/genui openui generate prompt \
  --appendix "Prefer compact mobile layouts for booking flows." \
  --out dist/openui-system-prompt.txt
```

The CLI uses the headless mirror of the built-in ReactLynx Library. Its prompt
generation command accepts:

| Option              | Purpose                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `--out <file>`      | Write to a file instead of stdout. Parent directories are created. |
| `--appendix <text>` | Append application-specific instructions.                          |
| `--version`         | Print the package version.                                         |
| `--help`            | Print command help.                                                |

The CLI does not load a custom component directory or tool manifest. Use the
programmatic API when the Agent contract contains custom components or rich
tool schemas.

## 2. Programmatic usage

Build the default prompt in server-side TypeScript:

```ts
import { buildOpenUiSystemPrompt } from '@lynx-js/genui/openui/prompt';

const systemPrompt = buildOpenUiSystemPrompt();
```

Add application policy and tool descriptions:

```ts
import { buildOpenUiSystemPrompt } from '@lynx-js/genui/openui/prompt';

const systemPrompt = buildOpenUiSystemPrompt({
  appendix: [
    'Prefer one-column mobile layouts.',
    'Never invent tool names or arguments.',
  ].join('\n'),
  promptOptions: {
    tools: [
      {
        name: 'list_orders',
        description: 'List orders filtered by status.',
        inputSchema: {
          type: 'object',
          properties: { status: { type: 'string' } },
          required: ['status'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            rows: { type: 'array', items: { type: 'object' } },
          },
          required: ['rows'],
        },
        annotations: { readOnlyHint: true },
      },
    ],
  },
});
```

The client must expose a matching tool implementation:

```tsx
<OpenUiRenderer
  response={response}
  library={library}
  toolProvider={{
    list_orders: async ({ status }) => {
      return await api.listOrders({ status: String(status) });
    },
  }}
/>;
```

Tool schemas teach the model what it may call; `toolProvider` is the code that
actually executes those calls. Do not put secrets or provider credentials in
the prompt or browser-side tool arguments.

## Prompt options

`buildOpenUiSystemPrompt` accepts Library options, prompt feature flags, and an
optional appendix:

| Option                          | Purpose                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `root`                          | Override the required root component name. The component must exist in the prompt Library and client Library. |
| `components`                    | Append headless component definitions; later duplicate names replace defaults.                                |
| `componentGroups`               | Append prompt grouping metadata.                                                                              |
| `promptOptions.preamble`        | Replace or extend the product framing before language rules.                                                  |
| `promptOptions.additionalRules` | Add rules after the built-in mobile/OpenUI constraints.                                                       |
| `promptOptions.examples`        | Replace the default static examples.                                                                          |
| `promptOptions.toolExamples`    | Provide examples used when tools are present.                                                                 |
| `promptOptions.tools`           | Describe Query/Mutation tools by name or rich schema.                                                         |
| `promptOptions.toolCalls`       | Enable or disable Query, Mutation, `@Run`, and tool workflow instructions.                                    |
| `promptOptions.bindings`        | Enable or disable `$variables`, `@Set`, `@Reset`, and reactive filter instructions.                           |
| `promptOptions.editMode`        | Teach the model to return only changed statements for incremental editing.                                    |
| `promptOptions.inlineMode`      | Allow prose with optional fenced OpenUI instead of raw OpenUI-only output.                                    |
| `appendix`                      | Append final deployment-specific instructions verbatim.                                                       |

The Lynx OpenUI prompt builder enables `bindings` and `toolCalls` by default.
Disable them explicitly for a static-only product surface:

```ts
const systemPrompt = buildOpenUiSystemPrompt({
  promptOptions: {
    bindings: false,
    toolCalls: false,
  },
});
```

`inlineMode` is disabled by default. In the default mode, the model should
return raw OpenUI Lang only—no explanation and no Markdown code fence—so the
full response can go directly into `<OpenUiRenderer response={...}>`.

## Custom component prompts

Keep shared Zod schemas in a framework-neutral module. The client wraps the
schema with the ReactLynx `defineComponent`; the server wraps the same schema
with the headless `@openuidev/lang-core` definition.

```ts
// shared/bannerSchema.ts
import { z } from 'zod/v4';

export const bannerProps = z.object({
  title: z.string(),
  tone: z.enum(['info', 'success', 'warning']).optional(),
});
```

```tsx
// client/Banner.tsx
import { defineComponent } from '@lynx-js/genui/openui';
import { bannerProps } from '../shared/bannerSchema.js';

export const Banner = defineComponent({
  name: 'Banner',
  description: 'Compact status banner with a title and tone.',
  props: bannerProps,
  component: ({ props }) => (
    <view className={`Banner Banner-${props.tone ?? 'info'}`}>
      <text className='BannerTitle'>{props.title}</text>
    </view>
  ),
});
```

```ts
// server/openuiPrompt.ts
import { defineComponent } from '@openuidev/lang-core';
import { buildOpenUiSystemPrompt } from '@lynx-js/genui/openui/prompt';
import { bannerProps } from '../shared/bannerSchema.js';

const PromptBanner = defineComponent({
  name: 'Banner',
  description: 'Compact status banner with a title and tone.',
  props: bannerProps,
  component: () => null,
});

export const systemPrompt = buildOpenUiSystemPrompt({
  components: [PromptBanner],
  componentGroups: [
    { name: 'Product', components: ['Banner'] },
  ],
});
```

Install `@openuidev/lang-core` and `zod` as direct dependencies of the server
workspace when it owns custom headless definitions. Keeping the prompt
component renderer as `() => null` prevents server routes from importing
ReactLynx, Lynx UI components, or component CSS.

## Other prompt exports

`@lynx-js/genui/openui/prompt` also exports:

| Export                               | Purpose                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `createOpenUiPromptLibrary(options)` | Build the headless built-in Library for inspection or lower-level prompt composition. |
| `OPENUI_SYSTEM_PROMPT`               | Prebuilt default prompt created with no options.                                      |
| `openUiPromptActionPropSchema`       | Shared prompt schema for v0.5 action plans and legacy action objects.                 |

Prefer `buildOpenUiSystemPrompt()` in application code so customization remains
explicit and testable.

## Backend integration pattern

Send the generated prompt as the model's system instruction, preserve the raw
text stream, and return that text to the client. The server does not need to
parse the UI simply to forward it, but it should enforce its own model-output
and tool policies.

```ts
const systemPrompt = buildOpenUiSystemPrompt({
  promptOptions: { tools: toolSpecs },
  appendix: productPolicy,
});

const stream = await model.generate({
  system: systemPrompt,
  messages,
});

return streamOpenUiText(stream);
```

On the client, append every received delta to one string. Pass that accumulated
value to `response` and keep `isStreaming={true}` until the server signals
completion. Use an `AbortController` to cancel an older generation before a new
turn starts.

When `onError` reports stable parser/runtime errors, an application may send a
compact description back to the Agent for correction. Do not automatically
retry forever; bound correction attempts and retain the original user request.

## Choosing an approach

Use the CLI when:

- the built-in component contract is sufficient;
- a checked-in or generated static prompt file is convenient;
- deployment policy fits in an appendix.

Use programmatic generation when:

- tools have request- or deployment-specific schemas;
- feature flags differ between products;
- the Library contains custom or overridden components;
- examples, groups, or policy are assembled from code.

For the renderer-side contract, continue with
[Libraries, built-ins, and custom components](./library-guide.md).
