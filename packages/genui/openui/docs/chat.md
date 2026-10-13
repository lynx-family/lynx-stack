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

For server-side prompt generation and validation:

```ts
import { createOpenUiChatPromptLibrary } from '@lynx-js/genui/openui/chat/agent';
const library = createOpenUiChatPromptLibrary();
const prompt = library.prompt();
const schema = library.toJSONSchema();
```

Supported components:

- Content: `Card`, `TextContent`, `Text`, `BoldText`, `Button`, `Buttons`, `ImageText`.
- Collections: `ListBlock`, `ListItem`, `Steps`, `StepsItem`, `SectionBlock`, `SectionItem`, `Table`, `Col`.
- Cards: `CompositeCardBlock`, `CompositeCardItem`.
- Document extension: `ProductFeature(src, alt, title, subtitle, paragraphs, price, url)`. This is not an upstream OpenUI Chat component.

This is an explicit subset of the upstream Chat library; unknown components are reported by the parser. Composite headers support ImageText and Text; bodies support Text, BoldText and ListBlock, with BoldText prices and Button footers. Skipped optional positional arguments must remain `null` when supplying a later argument.

Sections support streaming expansion and `isFoldable=false`. Their contents stay mounted while folded. Named component declarations retain their identity across array changes; repeat references are also supported. Table column data can contain both scalar values and registered component nodes, and short columns leave empty cells. Grid and carousel layouts share the same CompositeCardItem contract. A card block action includes the selected item context; footer buttons dispatch their own action.

Contracts are pinned to [thesysdev/openui](https://github.com/thesysdev/openui/tree/86da07f6266887ff819cd5a8e295c75b2edc8251/packages/react-ui/src/genui-lib). See `THIRD_PARTY_NOTICES.md` for attribution.
