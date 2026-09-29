# `@lynx-js/element-template-runtime`

Framework-neutral Element Template primitives for Lynx renderers.

The package provides:

- Element Template protocol constants and template identity helpers.
- A compact host descriptor shared by framework integrations.
- Logical handle and parent/child tracking around native Element PAPI.
- A serializable command bridge for background-to-main rendering.

Framework-specific reconciliation, hydration, refs, lists, and worklets remain
in their owning framework packages.

## Command bridge

The background thread creates a remote runtime:

```ts
const remote = createRemoteElementTemplateRuntime(backgroundChannel);

remote.api.batch(() => {
  const child = remote.runtime.createTemplate({
    templateKey: 'view',
    attributeSlots: [{ class: 'card' }],
  });
  remote.runtime.insertNode(remote.root, 0, child);
});
```

The main thread applies each commit to native Element PAPI:

```ts
const receiver = new ElementTemplateCommandReceiver(
  mainChannel,
  nativeElementTemplateApi,
  page,
);
```

Channels must transfer only serializable command payloads. Native handles stay
on the main thread.
