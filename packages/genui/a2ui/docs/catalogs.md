# Catalogs and manifests

Catalogs define which protocol components and functions the renderer can use.
They also provide the optional JSON schemas that an Agent can use during a
handshake.

## Start with renderer-only components

If your app only needs to render, pass bare components. The protocol name comes
from `displayName ?? component.name`.

```ts
import { defineCatalog, Text, Button } from '@lynx-js/genui/a2ui';

const catalog = defineCatalog([Text, Button]);
```

Production minifiers can rewrite function names. For production safety, set an
explicit `displayName` on every custom component, or pair the component with
its `catalog.json` manifest. The manifest key is authoritative.

## Add manifests for Agent handshakes

If you want `serializeCatalog(...)` to emit JSON Schema for each component,
pair each component with the JSON emitted at `dist/catalog/<Name>/catalog.json`.

```ts
import { Text, defineCatalog, serializeCatalog } from '@lynx-js/genui/a2ui';
import textManifest from '@lynx-js/genui/a2ui/catalog/Text/catalog.json'
  with { type: 'json' };

const catalog = defineCatalog([[Text, textManifest]]);
agentChannel.handshake({ catalog: serializeCatalog(catalog) });
```

## Include basic functions when messages use function calls

A2UI messages may use basic-catalog function calls such as `formatDate`,
`formatString`, or `required`. Include `...basicFunctions` in the same catalog
input list so the client can execute those calls at render time.

```ts
import { Text, basicFunctions, defineCatalog } from '@lynx-js/genui/a2ui';

const catalog = defineCatalog([
  Text,
  ...basicFunctions,
]);
```

## No `catalog/all`

The package intentionally does not ship a `catalog/all` aggregate. A single
top-level array that references every component forces consumers to bundle
every built-in even when they render only a few. Compose the catalog at the
call site so the bundle cost is explicit.

For the complete "every built-in" recipe, see
[../src/catalog/README.md](../src/catalog/README.md).
