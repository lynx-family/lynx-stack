# MessageStore behavior

`MessageStore` connects your transport adapter to `<A2UI>`. Use `push` for
incremental protocol messages, `replace` for a complete final response, and
`clear` when you only want to discard the buffered messages.

The store holds raw messages. `<A2UI>` owns the live surfaces, component
resources, and data model produced by processing them. These are separate:
clearing the buffer does not clear the UI, and user input can change the live
data model without adding a message to the buffer.

## Operations at a glance

| Operation                                 | Raw message buffer                                                   | Effect on a mounted `<A2UI>`                                     |
| ----------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `createMessageStore()`                    | Starts empty.                                                        | Shows `renderEmpty` until a surface is ready.                    |
| `createMessageStore({ initialMessages })` | Copies the supplied array.                                           | Processes its messages when mounted.                             |
| `push(message)` / `push(messages)`        | Appends messages in order.                                           | Applies the appended protocol operations to existing state.      |
| `replace(fullMessages)`                   | Replaces the entire array.                                           | Builds the target state and reconciles it with live state.       |
| `replace([])`                             | Becomes empty.                                                       | Removes all surfaces and returns to `renderEmpty`.               |
| `clear()`                                 | Becomes empty.                                                       | Keeps live surfaces and local state; later pushes apply to them. |
| `getSnapshot()`                           | Returns the current readonly array.                                  | Does not trigger processing or rendering.                        |
| `subscribe(callback)`                     | Registers a buffer-change listener; returns an unsubscribe function. | Does not subscribe directly to user input or component state.    |

`push`, `replace`, and `clear` return `void`. They change the buffer synchronously;
returning from a call does not mean that rendering has completed or that a
replacement passed protocol checks. Subscribers are notified once for a nonempty
`push`, once for every `replace`, and once for `clear` when the buffer was
nonempty. `push([])` and clearing an already-empty buffer are no-ops.

`getSnapshot()` keeps the same array reference between mutations. The store
copies and freezes the array when you read it after a mutation, so read it when
you need the messages rather than on every `push`. It does not deep-copy or
freeze the message objects. Treat submitted messages and nested JSON as immutable; create new
values for subsequent updates. A raw snapshot does not include local input edits
and should not be treated as an export of all live UI state.

## Streaming and a complete final response

This example appends a streaming update, then replaces the history with a
complete final snapshot:

```tsx
import { A2UI, Text, createMessageStore } from '@lynx-js/genui/a2ui';
import type {
  CatalogComponent,
  ServerToClientMessage,
} from '@lynx-js/genui/a2ui';

const catalogId = 'example';
const catalogs = [Text as CatalogComponent];
const store = createMessageStore();

function fullResponse(text: string): ServerToClientMessage[] {
  return [{
    version: '1.0',
    createSurface: {
      surfaceId: 'answer',
      catalogId,
      components: [{ id: 'root', component: 'Text', text }],
    },
  }];
}

store.push(fullResponse('Generating…'));
store.push({
  version: '1.0',
  updateComponents: {
    surfaceId: 'answer',
    components: [{ id: 'root', component: 'Text', text: 'Partial answer' }],
  },
});
store.replace(fullResponse('Complete answer'));

<A2UI
  messageStore={store}
  catalogs={catalogs}
  catalogId={catalogId}
  renderEmpty={() => <text>Waiting for content</text>}
/>;
```

In an application, these calls happen as transport responses arrive. For REST,
use `replace` when the response is a complete snapshot, or `push` when it is an
update to an existing surface. For SSE, append validated incremental envelopes
and use the final validated `done` payload as the replacement source.

Keep cancellation in the transport adapter: cancel obsolete prompt and action
requests with `AbortController` and ignore late responses from a previous turn.
Do not expose provider credentials in the client or accept untrusted endpoint
overrides. The store does not own requests or decide which response is current.

## What `push` means

`push` appends protocol operations. A surface must be created before its
component or data updates. Repeating `createSurface` for an existing surface
without first deleting it is rejected.

For `updateComponents`, supplied component IDs are inserted or updated; omitted
IDs remain in the surface. Each supplied component is its new description, not
a patch of selected props. A description that is identical to the one already
held is treated as a resend: it notifies nothing and its component does not run
again. A component that does change is announced together with the parents
that refer to it when it is new, or when its `weight` or component type changes.
Components may therefore arrive in any order across messages; a parent renders
a child as soon as both exist.

`updateDataModel` with a value equal to the current one is likewise a no-op.
Template instances are rebuilt only when the items at the template's path, or
the template's own components, change.

`updateDataModel` replaces the value at its JSON Pointer path; an omitted or
empty path targets the root, and `null` deletes the targeted value. These are
explicit server writes, so they can overwrite local input. The local-input merge
policy below applies to `replace`.

Multiple messages passed in one `push` generate one buffer notification.
`<A2UI>` applies every `push`, `replace`, and `clear` in the order it was made,
including several made in one batch: `replace(fullMessages)` followed by
`push(updates)` applies the replacement first, then its appended tail. A
message that cannot be applied is reported and skipped; the messages after it
are still applied.

The buffer keeps every pushed message until the next `replace` or `clear`. End
a long stream with `replace(finalMessages)`, or call `clear()` once its messages
are on screen, to release them.

## What counts as a complete replacement

The replacement must describe the state independently, including `createSurface`
before updates for each surface. It may be a complete operation history or a
compacted snapshot. A full `components` array without surface creation is still
only an update; use `push` for that payload.

The live UI can already contain a surface with the same ID. A single
`createSurface` in the replacement is valid because target state is built
separately. Repeated creation of the same surface within the replacement, without
an intervening deletion, is an error.

The resulting state covers the entire store. Surfaces absent from it are removed,
as are component IDs absent from a retained surface's resulting component map.
With a full history, earlier definitions still count unless later operations
remove their state. Omission from just the last `updateComponents` message does
not delete an earlier component.

### Diff and component reuse

Replacement compares the resulting state rather than message count, object
identity alone, or the original streaming batch boundaries:

- Components are matched by surface ID and component ID, then compared
  recursively as JSON. Object property order is ignored; array order matters.
- Unchanged component descriptions and resources are reused. When the entire
  rendered state and active surface are unchanged, no component-resource update
  is published.
- Changed components and relevant parents are notified. Data bindings update
  their consumers; child membership changes may also refresh the root.
- A parent update does not run a descendant again when the descendant is
  rendered through `NodeRenderer` with an unchanged description. A catalog
  component that renders children some other way still runs them.

The current surface and root resource remain mounted while their identities are
retained. Replacing the active surface or recreating its root resource resets the
rendered subtree. Component type changes or changes to parent structure can also
reset component state. Keep IDs stable when they represent the same UI entity.

There is still a cost to building and comparing the complete target state.
`replace` is intended for full responses, not as a guarantee of work proportional
only to the changed fields.

Parents that read child definitions are detected using catalog `ComponentId` /
`ChildList` reference schemas. Without a schema, the built-in `child`, `children`,
`trigger`, `content`, and `tabs[].child` fields are recognized. Declare custom
child props in the catalog schema. Ordinary text or metadata equal to an ID is
not a reference.

### Local input and arrays

Replacement compares the previous server data, the new server data, and the live
data containing local edits:

| Server change                | Live data after replacement                                   |
| ---------------------------- | ------------------------------------------------------------- |
| A field is unchanged.        | Keeps its current local value.                                |
| A field is changed or added. | Applies the server change, recursively merging object fields. |
| A field is removed.          | Removes that field, including any local edit at that path.    |

When an array changes, matching follows these rules:

1. If all three arrays have unique string or finite-number `id` fields, match
   items by `id`. Otherwise try unique `key` fields with the same requirements.
2. For matched items, preserve local fields unchanged by the server. The new
   server array determines ordering and membership, including inserted and
   removed items.
3. Without usable identities, merge by index only when all three lengths agree.
   If lengths differ, replace with the server array.

For example, if the server changes item A but leaves item B's `label` unchanged,
an edited local `label` on B survives when B can be matched. Provide stable
identities for reorderable collections; index matching cannot identify which
business item moved. These rules preserve data-model values, not component
instances across every possible list reorder.

## Rejected replacement and recovery

Before touching live state, the processor checks the replacement in a separate
state. Any reported protocol error rejects the whole replacement. Common causes:

| Cause                                                               | Error                                                                      |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Missing `version` or a version other than `"1.0"`.                  | `UNSUPPORTED_VERSION`                                                      |
| Updating or deleting a surface not yet created in this replacement. | `VALIDATION_FAILED`: `Surface must be created exactly once before updates` |
| Creating an existing surface twice in the replacement.              | `VALIDATION_FAILED`: `Surface already exists`                              |
| Violating a catalog's parent/child composition constraints.         | `UNALLOWED_PARENT` or `UNALLOWED_CHILD`                                    |

Rejection preserves the live UI and its consumption position. The raw buffer
already contains the rejected snapshot, so `getSnapshot()` can differ from what
is on screen. Its appended tail is not applied to the old live state. The
rejection is reported once: a later `push` neither repairs the rejected
replacement nor evaluates it again.

The renderer logs:

```text
[a2ui] Replacement rejected; keeping the previous rendering state. Correct the full snapshot with replace().
```

Inspect `message.error` in `<A2UI onMessage={...}>` for `code`, `message`, and,
when present, `surfaceId` / `path`. The warning itself is only a summary. Keep
forwarding other protocol events through your transport as needed.

Recover in one of two ways:

```ts
// Submit a corrected full snapshot, including surface creation.
store.replace(correctedFullMessages);

// Alternatively, discard the rejected buffer and continue the existing UI.
store.clear();
store.push(updatesForExistingSurfaces);
```

Choose one recovery path. `clear()` does not reset protocol state: repeating
`createSurface` for a retained surface is still invalid. Use `replace` for a
complete response.

`store.replace()` returns `void` and does not synchronously validate messages.
Direct `MessageProcessor.replaceMessages()` consumers receive `true` on success
and `false` on protocol rejection. All incoming data should still be validated
by the transport; these protocol checks are not a general malformed-JSON guard.

## RPC, empty states, and session lifetime

Replacement ignores `callRendererFunction` and `agentFunctionResponse` envelopes
so historical calls are not executed again. New RPC calls and responses must use
`push`, even if they arrive in the final transport frame. A response delivered
only through `replace` will not resolve its pending call.

| Situation                                                            | Rendered behavior                                                                                   |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A non-null store has no active render resource yet.                  | Calls `renderEmpty`; defaults to `null`. This includes waiting for the initial `root` component.    |
| `replace([])`, or an accepted replacement has no renderable surface. | Calls `renderEmpty`.                                                                                |
| `clear()` while content is visible.                                  | Keeps the current content and local state.                                                          |
| `push(deleteSurface)` deletes the active surface.                    | Renders blank, without revealing an older surface or calling `renderEmpty`.                         |
| `push` makes another surface renderable.                             | Switches through normal component reconciliation; it does not force a whole-subtree remount.        |
| `replace` changes the active surface.                                | Selects the last surface that became renderable in the replacement and resets the rendered subtree. |
| `messageStore={null}`.                                               | Renders nothing, without `renderEmpty`, and ends the mounted session.                               |

`renderEmpty` is a render function, not a one-time event. `renderFallback` is
different: it renders while an existing resource is pending.

Passing a non-null store after `null` starts a fresh session and consumes that
store's buffered messages. Directly swapping one non-null store for another does
not reset the session: the renderer reconciles to the new store's contents as
`replace` would, keeping unchanged components mounted and not replaying RPC
messages already in that store. For a new turn, use a fresh store with a
turn-specific `<A2UI key={turnId}>`, as described in the
[overview](./overview.md).
