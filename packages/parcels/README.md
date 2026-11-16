# Lynx Parcels

A Lynx Parcel is a compiled DSL artifact that a Lynx host can load and render
inside an existing container. It provides a main-thread lifecycle and can
include a background script and stylesheet. The name follows the mountable
units in [single-spa Parcels](https://single-spa.js.org/docs/parcels-overview/).

| Entry                                | Use                                                  |
| ------------------------------------ | ---------------------------------------------------- |
| `@lynx-js/parcels/common`            | Resolve named sections with `parcelSections(prefix)` |
| `@lynx-js/parcels/runtime/core`      | Load and render a parcel in a native Lynx host       |
| `@lynx-js/parcels/compiler`          | Package artifact scripts and styles with Rsbuild     |
| `@lynx-js/parcels/compiler/lynx-xml` | Compile embeddable `.lynxml` documents               |
| `@lynx-js/parcels/runtime/react`     | Render a parcel with a ReactLynx component or hook   |

## Build a parcel

Add the plugin to the host's Rsbuild configuration alongside its Lynx build
plugin. The `compile` function converts the input DSL to the native main-thread
script, optional background script, and optional parsed stylesheet rules.

```ts
import { pluginParcels } from '@lynx-js/parcels/compiler';
import { compileLynxXml } from '@lynx-js/parcels/compiler/lynx-xml';

export const cardParcel = pluginParcels({
  sourcePath: 'ui/card.lynxml',
  sectionPrefix: 'card',
  compile: compileLynxXml,
});
```

The default delivery mode adds the parcel to the host's `main` entry. Set
`delivery: { kind: 'embedded', entry: 'otherEntry' }` to select another entry,
or `delivery: { kind: 'external', filename: 'card.lynx.bundle' }` to emit a
separately fetched Lynx bundle. Each parcel on a page needs a distinct
`sectionPrefix`. Both modes watch the source and emit the same named sections.

An artifact's main script assigns `mount(containerSelector, initialData)`,
`update(nextData)`, and `unmount()` to `module.exports`. It owns the nodes
inside the selected container, while the host owns the container itself.
`update` receives a complete data snapshot. `unmount` releases the artifact's
nodes, subscriptions, and instance state and can be called repeatedly.

A document that also runs as a standalone page can use
`typeof __lynxParcel !== 'undefined'` to detect the parcel wrapper and skip
standalone page lifecycle registration. Artifacts that use the background
script can export `setBackgroundReady()`. This callback may run before or
after `mount`, so the artifact should track both independently. Stylesheets
are adopted at page scope and remain adopted across remounts.

## Render in a host

On the main thread, call `mountParcel` with the parcel source, an empty
container selector, and the initial props. It returns a handle immediately.

```ts
import { mountParcel } from '@lynx-js/parcels/runtime/core';

const card = mountParcel(
  { kind: 'embedded', sectionPrefix: 'card' },
  { container: '#card-slot', props: { title: 'Welcome' } },
);

await card.mountPromise;

// When host data changes, pass a complete snapshot.
await card.update({ title: 'Updated' });

// When the host removes the container, release the parcel.
card.unmount();
```

For external delivery, use `{ kind: 'external', sectionPrefix: 'card', url }`
with a bundle URL reachable from the device. In both modes, match the
compiler's `sectionPrefix`. Native loading requires Lynx SDK 3.7 or later.

You can call `update` during loading. The first render uses the latest props.
Calling `unmount()` during loading cancels that mount and rejects
`mountPromise`. Repeated unmounts are safe. Features that use the background
script can await `card.backgroundReady`. A background error rejects that
promise while the mounted UI remains usable.

### Host background entry

At background startup, call `installParcelBackground()` once for the page.
Its listener receives requests from `mountParcel`, loads each parcel's
background script, and reports success or failure to the main thread.
All mounts on the page share this listener. Call the returned cleanup
function when the host page is destroyed.

```ts
import { installParcelBackground } from '@lynx-js/parcels/runtime/core';

export const disposeParcelBackground = installParcelBackground();
```

Hosts with a custom thread bridge can use `loadParcel(source, dispatchBackground)`
and `prepareParcelBackground` directly.

### ReactLynx hosts

Render a compiled XML parcel with `ParcelView`. Give each container a unique
ID and pass a complete serializable data snapshot. The component mounts the
parcel when a source is present, updates it when the data changes, and unmounts
it when removed or when its source becomes `null`.

```tsx
import { ParcelView } from '@lynx-js/parcels/runtime/react';

export function CardSlot({ title }: { title: string }) {
  return (
    <ParcelView
      id='card-slot'
      source={{ kind: 'embedded', sectionPrefix: 'card' }}
      data={{ title }}
    />
  );
}
```

Use `onStatusChange(status, message)` to observe mounting, updates, background
readiness, and errors. For a custom container, call
`useParcel(source, { container, props, onStatusChange })` and attach the
returned callback to its `main-thread:ref`. Both APIs use ReactLynx's built-in
thread dispatcher.
