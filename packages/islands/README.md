# Lynx Islands

Render Lynx XML inside a ReactLynx page by registering a source with the build plugin and using the `Island` component. The XML is included in the host bundle.

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

## First-frame rendering

When the component and its initial props are present in the host's first render, the XML UI joins that first frame. Background initialization does not block it. Components mounted after an interaction or data request render when they are mounted.

This package requires Lynx SDK 3.7 or newer. The public entry points are `@lynx-js/islands/build` and `@lynx-js/islands/react`.

See [the ReactLynx XML example](../../examples/react-lynx-xml) for a complete application.
