# Lynx Islands

A Lynx island is an independent UI region rendered inside a host-owned container. The design follows two useful ideas:

- [Astro islands](https://docs.astro.build/en/concepts/islands/) isolate interactive UI by component and let each region run independently.
- [Module Federation](https://module-federation.io/configure/index.html) exposes named modules and configures remote entries for loading them.

`@lynx-js/islands` combines those ideas for native Lynx. A build exposes named island modules. A host loads a module factory and creates independent instances for its containers. Each instance owns its nodes, state, subscriptions, and cleanup.

The implementation uses native Lynx custom sections and container renderers. HTML hydration, Astro client directives, and Module Federation share scopes or version negotiation are outside this package's contract.

| Entry                      | Use                                             |
| -------------------------- | ----------------------------------------------- |
| `@lynx-js/islands/build`   | Expose DSL sources through Rsbuild              |
| `@lynx-js/islands/runtime` | Load modules and create native island instances |
| `@lynx-js/islands/react`   | Render islands from ReactLynx                   |
| `@lynx-js/islands/shared`  | Resolve native custom-section names             |

## Delivery and rendering entry

These terms describe separate concerns. They are local design terms, not required modes of islands architecture.

| Concern         | Term       | Meaning                                                                                        |
| --------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| Delivery        | `inline`   | Include the named sections in a host bundle; it does not mean inline JavaScript in the source. |
| Delivery        | `remote`   | Emit a separate bundle that the host loads by URL; the bundle is not a standalone page.        |
| Rendering entry | hosted     | Render inside an existing host Page and container, sharing the host's runtime context.         |
| Rendering entry | standalone | An optional page entry supplied by the DSL source for preview or independent use.              |

Both delivery choices in this package serve hosted rendering. `IslandReference` selects an exposed module and an optional remote entry; it does not contain a hosted/standalone switch. An island source need not provide a standalone page entry. Node and state ownership are per instance, while the host environment and adopted page styles are shared.

## Expose modules

```ts
import { pluginIslands } from '@lynx-js/islands/build';
import { parseLynxXML } from '@lynx-js/lynx-xml/parser';

export const islands = pluginIslands({
  exposes: {
    card: {
      source: 'ui/card.lynxml',
      parse: parseLynxXML,
    },
  },
});
```

`exposes` maps the public module name to its source and parser. The default output stores sections in the host's `main` entry. Use `output: { mode: 'inline', entry: 'otherEntry' }` to select another host entry, or `output: { mode: 'remote', filename: 'ui.lynx.bundle' }` to emit a separately fetched bundle. All sources are watched.

The default hosted path needs neither an `output` option at build time nor an `entry` URL in the module reference. Remote delivery is an explicit opt-in on both sides.

The parser returns a success/error result with `mainThreadScript`, optional `backgroundThreadScript`, and optional raw `style`. Islands forwards XML errors with their source path and offset, then converts CSS with the existing Lynx CSS serializer. Stylesheet imports, unsupported at-rules, and CSS diagnostics fail the build instead of silently changing the rendered result. Absent optional sections produce empty background and CSS sections.

Each main-thread source exports a module factory:

```ts
interface IslandModule<Props> {
  create(): {
    render(containerSelector: string, props: Props): void;
    update(props: Props): void;
    dispose(): void;
    setBackgroundReady?(): void;
  };
}
```

`create()` must return fresh state. A loaded module can therefore render in several containers without sharing native handles, lifecycle subscriptions, or instance data. The host owns the empty container; the renderer owns only its children. `dispose()` is idempotent.

A source that also renders as a standalone page can test `typeof __lynxIsland !== 'undefined'` and skip standalone page registration when evaluated as an island. Stylesheets are adopted at page scope and remain adopted after instances are disposed.

## Load and create instances

```ts
import { createIsland, loadIslandModule } from '@lynx-js/islands/runtime';

const cardModule = await loadIslandModule<{ title: string }>({
  expose: 'card',
});

const first = createIsland(cardModule, {
  container: '#first-card',
  props: { title: 'First' },
});
const second = createIsland(cardModule, {
  container: '#second-card',
  props: { title: 'Second' },
});

await Promise.all([first.ready, second.ready]);
await first.update({ title: 'Updated' });
first.dispose();
second.dispose();
```

Pass `entry` to load the same expose from a remote bundle:

```ts
const cardModule = await loadIslandModule({
  expose: 'card',
  entry: 'https://host.example/ui.lynx.bundle',
});
```

`entry` must be an absolute URL reachable from the device. Native loading requires Lynx SDK 3.7 or later. Reuse the returned module across containers when you want to avoid repeated main-thread preparation; `loadIslandModule` currently has no shared main-thread module cache.

`createIsland(reference, options)` loads and creates one instance. Inline references and already loaded modules render synchronously before it returns; remote references render after loading. `loadIslandModule()` retains its Promise API. Updates made before `ready` are coalesced into the initial props. `dispose()` cancels pending rendering and is safe to repeat. `backgroundReady` reports background initialization independently; a rejected background promise leaves the rendered main-thread UI usable.

### Background entry

Call `installIslandBackground()` once during background startup. It listens for native runtime requests, loads each exposed background section once per entry, and returns a cleanup function.

```ts
import { installIslandBackground } from '@lynx-js/islands/runtime';

export const disposeIslandBackground = installIslandBackground();
```

A custom host bridge can pass its own dispatcher to `loadIslandModule(reference, dispatchBackground)` and call `prepareIslandBackground` on the background thread.

## Render in a ReactLynx host

```tsx
import { Island } from '@lynx-js/islands/react';

export function CardSlot({ title }: { title: string }) {
  return (
    <Island
      id='card-slot'
      module={{ expose: 'card' }}
      props={{ title }}
      onStatusChange={status => console.log(status)}
    />
  );
}
```

`Island` renders an inline module synchronously when its main-thread container ref attaches. When the module and initial props are present in the host's first render, the XML UI is created before the host's first-frame flush, without waiting for background effects or the island background script. ReactLynx hydration retains the same main-thread ref and instance, and later `props` changes update that instance.

A `module` that starts as `null` cannot render until supplied. Remote references still start from the background effect and load asynchronously, even if their resource fetch hits a cache; this package does not provide a synchronous remote preload registry. Background status callbacks are delivered after the host background runtime can receive them, so `onStatusChange('ready')` is not a first-frame timestamp.

`Island` creates a fresh instance for its view, updates it when `props` changes, and disposes it when `module` becomes `null` or the view detaches. Inline ref cleanup waits until the current synchronous handoff finishes so hydration can keep the same native container and instance; an actual container replacement creates a new instance. Remote ref cleanup cancels pending rendering immediately. Status values are `ready`, `updated`, `background-ready`, `render-error`, `update-error`, and `background-error`.

Use `useIsland(module, { container, props, onStatusChange })` for a custom empty container and attach the returned callback to `main-thread:ref`.
