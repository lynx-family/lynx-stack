# @lynx-js/a2ui-reactlynx

ReactLynx helpers for rendering A2UI responses.

This package includes:

- `A2UIRender`: render streaming A2UI UI updates.
- `BaseClient`: a minimal client to request A2UI responses.
- `catalog/*`: built-in component renderers (import to register).
- `Conversation`: an optional chat UI wrapper.

## Exports

- `@lynx-js/a2ui-reactlynx/core`: `A2UIRender`, `BaseClient`, registry utilities.
- `@lynx-js/a2ui-reactlynx/chat`: `Conversation` and related types/hooks.
- `@lynx-js/a2ui-reactlynx/catalog/all`: registers all built-in catalog components.
- `@lynx-js/a2ui-reactlynx/catalog/<Name>`: registers a single catalog component (tree-shake friendly).

## Installation

Make sure your app provides the peer dependencies:

- `@lynx-js/react`
- `@lynx-js/lynx-ui`
- `@lynx-js/lynx-ui-input`

## Quick Start (Core)

1. Register components you want to render.
2. Create a client and start a request.
3. Render the returned `resource` using `A2UIRender`.

```tsx
import { useEffect, useMemo, useState } from '@lynx-js/react';

import { A2UIRender, BaseClient } from '@lynx-js/a2ui-reactlynx/core';

// Option A: register everything in the built-in catalog (easiest).
import '@lynx-js/a2ui-reactlynx/catalog/all';

export function A2UIScreen(): import('@lynx-js/react').ReactNode {
  const client = useMemo(
    () => new BaseClient('http://<your-a2ui-host>/sse'),
    [],
  );
  const [resource, setResource] = useState<unknown>(null);

  useEffect(() => {
    void (async () => {
      const { resource } = await client.makeRequest('Hello');
      setResource(resource);
    })();
  }, [client]);

  if (!resource) return null;
  return <A2UIRender resource={resource as any} />;
}
```

### Catalog Registration Options

Register all built-in components:

```ts
import '@lynx-js/a2ui-reactlynx/catalog/all';
```

Or register only what you need:

```ts
import '@lynx-js/a2ui-reactlynx/catalog/Text';
import '@lynx-js/a2ui-reactlynx/catalog/Button';
import '@lynx-js/a2ui-reactlynx/catalog/Card';
```

## Chat SDK

`Conversation` offers a ready-to-use chat UI in two modes:

- Uncontrolled: pass `url`.
- Controlled: pass `messages` + `sendMessage`.

Uncontrolled:

```tsx
import { Conversation } from '@lynx-js/a2ui-reactlynx/chat';
import '@lynx-js/a2ui-reactlynx/catalog/all';

export function Chat(): import('@lynx-js/react').ReactNode {
  return <Conversation url='http://<your-a2ui-host>/sse' />;
}
```

Controlled:

```tsx
import { useState } from '@lynx-js/react';
import type { Message } from '@lynx-js/a2ui-reactlynx/chat';
import { Conversation } from '@lynx-js/a2ui-reactlynx/chat';

export function ChatControlled(): import('@lynx-js/react').ReactNode {
  const [messages, setMessages] = useState<Message[]>([]);

  return (
    <Conversation
      messages={messages}
      sendMessage={async (content) => {
        // Your own networking + resource wiring here.
        setMessages((prev) => [
          ...prev,
          { id: String(Date.now()), role: 'user', content },
        ]);
      }}
    />
  );
}
```

## Custom Components

If your server emits a `component` tag that is not in the built-in catalog, register your own renderer:

```tsx
import { componentRegistry } from '@lynx-js/a2ui-reactlynx/core';

componentRegistry.register('MyWidget', (props) => {
  return <text>{String(props.component?.id ?? 'MyWidget')}</text>;
});
```
