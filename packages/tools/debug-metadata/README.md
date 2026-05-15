# `@lynx-js/debug-metadata`

Schema types for the Lynx `debug-metadata.json` format.

This package is intentionally a tiny, zero-dependency protocol library:
it can be imported from rsbuild plugins, dev-server middleware,
reverse-symbolication services, debugging CLIs, or anywhere else that
needs to read the format. Producers (today only
`@lynx-js/debug-metadata-rsbuild-plugin`) import the types here too, so
the schema stays the single source of truth.

```ts
import type { DebugMetadataAsset } from '@lynx-js/debug-metadata';

const metadata = JSON.parse(
  await readFile('debug-metadata.json', 'utf8'),
) as DebugMetadataAsset;

console.log(metadata.uiSourceMap.sources.length);
```

No runtime helpers are provided yet — the schema has nothing to validate
beyond what the type already states. A `validateDebugMetadata` (or
similar) will be added if the format grows fields whose runtime
correctness cannot be expressed in the type system.

The schema evolves alongside the emitter — new top-level fields (JS /
bytecode source maps, per-artifact debug info, …) will land here as the
emitter implements them. Consumers should treat fields they do not
recognise as opaque rather than rejecting the payload.
