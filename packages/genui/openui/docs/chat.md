# OpenUI Chat

Use this opt-in library for the official **OpenUI Chat** positional contracts. The default `createOpenUiLibrary()` continues to use the existing `Stack` catalog. In particular, Chat uses `Card(children, sources?)` and `Text(variant, value, subtext?, subtextVariant?, size?)`.

```tsx
import { OpenUiRenderer } from '@lynx-js/genui/openui';
import { createOpenUiChatLibrary } from '@lynx-js/genui/openui/chat';
import '@lynx-js/luna-styles/index.css';
import '@lynx-js/genui/openui/styles/theme.css';

const library = createOpenUiChatLibrary();
const response =
  'root = Card([TextContent("**Hello** [1]")], [{title:"Lynx",sourceName:"Documentation",url:"https://lynxjs.org"}])';
// Place under the host's luna-light / luna-dark theme.
<OpenUiRenderer
  library={library}
  response={response}
  onAction={handleAction}
/>;
```

The host handles `OpenUrl` and conversation actions through `onAction`; the components do not assume a browser or a backend. Markdown renders as native Lynx elements, and raw HTML is displayed as text. The native main-thread first frame displays plain text; background hydration applies Markdown, keeping Unicode-dependent parsing out of the main-thread VM. Citations are one-based indices into `Card.sources`.

## Import selected components

`createOpenUiChatLibrary()` registers the entire Chat catalog, including all of its component styles. It does not remove styles based on which components occur in a response. To keep unused components and their styles out of an application, use the individual component entry points and the catalog-free factory:

```tsx
import {
  createOpenUiLibrary,
  OpenUiRenderer,
} from '@lynx-js/genui/openui/explicit';
import { Card } from '@lynx-js/genui/openui/chat/Card';
import { Text } from '@lynx-js/genui/openui/chat/Text';
import { Button } from '@lynx-js/genui/openui/chat/Button';
import '@lynx-js/luna-styles/index.css';
import '@lynx-js/genui/openui/styles/theme.css';

const library = createOpenUiLibrary({
  root: 'Card',
  includeDefaultComponents: false,
  components: [Card, Text, Button],
});

<OpenUiRenderer
  library={library}
  response={'root = Card([Text("text", "Hello"), Button("Continue")])'}
/>;
```

Each component imports its own CSS automatically; there is no separate component stylesheet to import. Shared implementation styles remain included where needed: `BoldText` uses the `Text` styles, and `TextContent` uses the Chat Markdown styles. Theme tokens remain a host-level import. Schema-only items such as `Col` have no renderer styles. Prefer the component subpaths over the aggregate `openui/chat` entry when unused modules must stay outside the dependency graph.

## Server-side prompt generation and validation

```ts
import { createOpenUiChatPromptLibrary } from '@lynx-js/genui/openui/chat/agent';
const library = createOpenUiChatPromptLibrary();
const prompt = library.prompt();
const schema = library.toJSONSchema();
```

For a reduced client library, use the matching headless component subpaths so the Agent generates the same vocabulary:

```ts
import { createLibrary } from '@openuidev/lang-core';
import { Card } from '@lynx-js/genui/openui/chat/agent/Card';
import { Text } from '@lynx-js/genui/openui/chat/agent/Text';
import { Button } from '@lynx-js/genui/openui/chat/agent/Button';

const library = createLibrary({
  root: 'Card',
  components: [Card, Text, Button],
});
const prompt = library.prompt();
```

These entries load neither ReactLynx nor CSS. Both component and agent subpaths cover every component listed below, including the shared `Button`.

Supported components:

- Content: `Card`, `TextContent`, `Text`, `BoldText`, `Button`, `Buttons`, `ImageText`.
- Collections: `ListBlock`, `ListItem`, `Steps`, `StepsItem`, `SectionBlock`, `SectionItem`, `Table`, `Col`.
- Cards: `CompositeCardBlock`, `CompositeCardItem`.
- Forms: `Form`, `FormControl`, `Input`, `RadioGroup`, `RadioItem`, `CheckBoxGroup`, `CheckBoxItem`, `Slider`.
- Document extension: `ProductFeature(src, alt, title, subtitle, paragraphs, price, url)`. This is not an upstream OpenUI Chat component.

This is an explicit subset of the upstream Chat library; unknown components are reported by the parser. Composite headers support ImageText and Text; bodies support Text, BoldText and ListBlock, with BoldText prices and Button footers. Skipped optional positional arguments must remain `null` when supplying a later argument.

Sections support streaming expansion and `isFoldable=false`. Their contents stay mounted while folded. Named component declarations retain their identity across array changes; repeat references are also supported. Table column data can contain both scalar values and registered component nodes, and short columns leave empty cells. Grid and carousel layouts share the same CompositeCardItem contract. A card block action includes the selected item context; footer buttons dispatch their own action.

Forms use `Form(name, buttons, fields)` and `FormControl(label, input, hint?)`. `Input`, `RadioGroup`, `CheckBoxGroup` and `Slider` accept an optional reactive binding in their last position. Without one, the field name identifies its value within the enclosing form. Use stable, unique field names and named component declarations when inserting, deleting or reordering fields.

```text
root = Card([form, progress])
$ready = {passport: false, boots: false}
form = Form("trip", Buttons([Button("Continue")]), [documents, clothing])
documents = FormControl("Documents", CheckBoxGroup("ready", [CheckBoxItem("Passport", "Check expiry", "passport")], {required: true}, $ready))
clothing = FormControl("Clothing", CheckBoxGroup("ready", [CheckBoxItem("Boots", "Pack footwear", "boots")], {required: true}, $ready))
progress = TextContent("Ready: " + ($ready.passport ? 1 : 0) + " / " + ($ready.boots ? 1 : 0))
```

Checkbox groups sharing a binding merge their changes into the complete object; validation checks only each group's own items. Defaults initialize missing values without overwriting hydrated or edited state. Streaming disables editing and submission. Structured validation rules run before button actions, which receive the current form state.

Slider state and `defaultValue` use arrays even for a single value, matching Chat expressions such as `@First($budget)`. Multiple values render as separate bounded Lynx slider controls, constrained to preserve their order. Native rendering differs from the upstream multi-thumb track; the positional and state contracts remain the same.

Contracts are pinned to [thesysdev/openui](https://github.com/thesysdev/openui/tree/86da07f6266887ff819cd5a8e295c75b2edc8251/packages/react-ui/src/genui-lib). See `THIRD_PARTY_NOTICES.md` for attribution.
