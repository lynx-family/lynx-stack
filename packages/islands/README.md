# Lynx Islands

Render Lynx XML inside a ReactLynx page by registering a source with the build plugin and using the `Island` component. By default, the XML is included in the host bundle. The same exposes map can produce a separate bundle resource for remote loading.

## Register the XML source

Add the Islands plugin to your existing Rsbuild configuration:

```ts
import { pluginIslands } from '@lynx-js/islands/build';

export const islands = pluginIslands({
  exposes: {
    card: 'ui/card.lynxml',
  },
});
```

Source paths are relative to the project root. The plugin parses Lynx XML, watches the source, and packages it into the host's `main` entry. For a different host entry, set `entry: 'details'` on the plugin.

During development, saving an exposed XML source recompiles the host bundle and reloads the page through the existing Lynx dev transport. Changes to main-thread scripts, background scripts, and styles reset page state. The source fingerprint participates in the compilation hash, and its virtual module declines HMR so the client reloads the complete bundle. When HMR is disabled, `dev.liveReload` still supports these updates; disabling both `dev.hmr` and `dev.liveReload` disables automatic reload.

## Render the component

```tsx
import { Island } from '@lynx-js/islands/react';

export function Card({ title }: { title: string }) {
  return (
    <Island
      name='card'
      props={{ title }}
      className='Card'
    />
  );
}
```

`name` matches a key in the plugin's `exposes` map. Pass serializable data through `props`; changing it updates the existing instance. Give the component a size through its CSS class:

```css
.Card {
  width: 100%;
  height: 240px;
}
```

Mount or unmount the component using ordinary ReactLynx rendering:

```tsx
import { Island } from '@lynx-js/islands/react';

export function OptionalCard({ visible }: { visible: boolean }) {
  return visible
    ? <Island name='card' props={{ title: 'Hello' }} className='Card' />
    : null;
}
```

Each component owns an independent instance, generates its own container ID, and cleans up on unmount. Loading, background initialization, hydration and native commits are managed internally. Applications do not need to call a loader or manage readiness promises.

## Independent resources

Set `output.mode` to `remote` to package the same exposes into an independent
bundle. A producer needs only Rsbuild and `@lynx-js/islands/build`; it does not
need ReactLynx, a React plugin or an application entry.

```ts
import { defineConfig } from '@rsbuild/core';
import { pluginIslands } from '@lynx-js/islands/build';

export default defineConfig({
  environments: { lynx: {} },
  plugins: [
    pluginIslands({
      exposes: { card: 'ui/card.lynxml' },
      output: { mode: 'remote', filename: 'cards.lynx.bundle' },
    }),
  ],
});
```

The resource contains the same `card/main`, `card/background` and `card/css`
sections as inline delivery. All exposes in that plugin share the output file.
The filename is a relative asset path. This is a resource for an existing host
Page, not a standalone page.

Publish the resource at an absolute URL reachable from the host. Use the same
component with its expose name and the resource URL:

```tsx
import { Island } from '@lynx-js/islands/react';

export function RemoteCard({ title }: { title: string }) {
  return (
    <Island
      name='card'
      entry='https://example.com/cards.lynx.bundle'
      props={{ title }}
      className='Card'
    />
  );
}
```

The consuming project does not need `pluginIslands` or the producer's XML.
Remote loading uses native `fetchBundle` and `loadScript` in each thread;
scripts and CSS use the resolved resource identity. The renderer still shares
the host's Page, runtime and page stylesheet scope. Native bundle caching is
owned by the host; use a new resource URL for a new deployed version.

Remote content appears after the fetch completes. Updates before completion
coalesce into the latest full props snapshot. Unmounting or changing entry/name
prevents the old pending instance from rendering. Background initialization is
shared by bundle and expose, and its failure does not remove rendered UI.

See the separate [producer](../../examples/islands-producer) and
[consumer](../../examples/islands-consumer) projects for independent builds.

## First-frame rendering

When an inline component and its initial props are present in the host's first render, the XML UI joins that first frame. Background initialization does not block it. Remote components render asynchronously and commit their own node changes after loading. Components mounted after an interaction or data request render when they are mounted.

This package requires Lynx SDK 3.7 or newer. The public entry points are `@lynx-js/islands/build` and `@lynx-js/islands/react`.

See [the ReactLynx XML example](../../examples/react-lynx-xml) for a complete application.
