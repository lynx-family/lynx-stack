# ReactLynx system prompts

```ts
import { REACTLYNX_SYSTEM_PROMPT } from '@lynx-js/genui/reactlynx';

const messages = [
  { role: 'system', content: REACTLYNX_SYSTEM_PROMPT },
  { role: 'user', content: 'Build an interactive counter page.' },
];
// Pass messages to your model provider on the backend.
```

The prompt asks for complete `App.tsx` and `App.css` files in JSON, including on
follow-up edits. It specifies a default-exported function component, imports
from `@lynx-js/react` only, Lynx elements such as `view` and `text`, `useState`
interactions, and `bindtap`/`catchtap` tap handlers. Every visible text belongs
inside `text`; layout containers use explicit flex direction.

The host owns the entry point and CSS import. Generated output must not include
package installation requests, build configuration, extra files, dynamic imports,
DOM/Node APIs, scripted network access, or CSS `@import`. Image URLs come from
user/host inputs or available image tools. Keep your extra instructions consistent
with these constraints; the compiler's module policy remains in effect.

Accumulate streamed response text before parsing and building. If compilation
fails, include bounded diagnostics and the previous source in a repair request,
and require both complete files again. A prompt describes the contract; parsing
and compilation validate the response before the host publishes it.
