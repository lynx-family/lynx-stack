# `@lynx-js/debug-metadata`

Schema types and resolver helpers for the Lynx `debug-metadata.json` format.

Intentionally tiny and zero-dependency — safe to import from rsbuild plugins, dev-server middleware, reverse-symbolication services, debugging CLIs, or anywhere else that needs to read the format. Producers (today only `@lynx-js/debug-metadata-rsbuild-plugin`) import the same types, so the schema stays the single source of truth.

## File shape

Every Lynx entry build emits one `debug-metadata.json` under the entry's intermediate dir (e.g. `dist/.rspeedy/main/debug-metadata.json`):

```ts
interface DebugMetadataAsset {
  artifacts: Artifact[]; // one entry per JS / CSS / bytecode bundle
  uiSourceMap: UiSourceMapData; // compact UI source-map payload
  meta: { git?: GitMetadata; rspeedy?: RspeedyMeta };
}
```

Each `Artifact` carries a `debugSources[]` ordered for the reverse-symbolication decode chain: `bytecode-debug-info` first (if present) maps PC offsets back to encoded JS `(line, column)`; `source-map` then maps that back to authored sources.

See `src/types.ts` for the full set of exported types.

## Reading the file

Plain `JSON.parse` is the supported path:

```ts
import type { DebugMetadataAsset } from '@lynx-js/debug-metadata';

const metadata = JSON.parse(
  await readFile('debug-metadata.json', 'utf8'),
) as DebugMetadataAsset;
```

## Looking up a single field

For consumers serving `?field=…` queries (the rspeedy dev-server middleware does this) the package ships a small resolver registry:

```ts
import { resolveField, knownFields } from '@lynx-js/debug-metadata';

const res = resolveField(metadata, 'source-map', {
  filename: 'main-thread.js.map',
});

if (res === undefined) {
  // unknown field name; HTTP layer → 400 with knownFields()
} else if (!res.found) {
  // valid field, but no value matched the query → 404
} else {
  // res.payload is already unwrapped — for `source-map` it's the inner
  // SourceMap (not the SourceMapDebugSource wrapper).
}
```

Registered fields:

| field                 | query keys                  | payload                  |
| --------------------- | --------------------------- | ------------------------ |
| `source-map`          | `path` / `filename` / `key` | inner `SourceMap` v3     |
| `bytecode-debug-info` | `filename` (JS asset)       | inner `LepusNGDebugInfo` |
| `artifact`            | `filename`                  | full `Artifact`          |
| `artifacts`           | —                           | `Artifact[]`             |
| `ui-source-map`       | —                           | `UiSourceMapData`        |
| `meta`                | —                           | `meta` block             |
| `git`                 | —                           | `meta.git`               |
| `rspeedy`             | —                           | `meta.rspeedy`           |

`FIELDS` is exported as a live `Map<string, FieldResolver>` — plugins can register their own at startup with a one-liner.

For direct lookups bypassing the `?field=` dispatch, the typed helpers `findArtifact`, `findSourceMap`, and `findBytecodeDebugInfo` are also exported.

## Validation

No runtime helpers are provided yet — the schema has nothing to validate beyond what the types already state. A `validateDebugMetadata` (or similar) will be added if the format grows fields whose runtime correctness cannot be expressed in the type system.

## Compatibility

The schema evolves alongside the emitter. New top-level / per-artifact fields will land here as producers implement them. **Consumers should treat fields they do not recognise as opaque rather than rejecting the payload.**
