# `@lynx-js/lynx-runtime`

DSL-neutral Lynx host runtime primitives for main thread (`@lynx-js/lynx-runtime/mts`) and background thread (`@lynx-js/lynx-runtime/bts`).

## Subpath Exports

- `@lynx-js/lynx-runtime`: Shared TypeScript types only (`BTSPageRuntime`, `BTSEventHandler`, `CreatedPipelineOptions`, `CreatePipelineOptions`, `LynxSystemInfo`, `MTSFlushContext`, `MTSFlushOptions`, `MTSReloadOptions`, `MTSRenderOptions`, `MTSUpdateOptions`, `BTSUpdateOptions`, `BTSReloadOptions`, `PipelineOptions`, `Unsubscribe`). The package declares `"sideEffects": false`, and runtime entrypoints are imported from `/mts` or `/bts` with zero module-evaluation side effects so bundlers can tree-shake unused imports cleanly. In dual-thread shared files, import types from `@lynx-js/lynx-runtime` and guard runtime calls to `/mts` or `/bts` behind compile-time thread constants (such as `__LEPUS__` / `__JS__`) so dead-code elimination removes cross-thread references before module-graph resolution.
- `@lynx-js/lynx-runtime/mts`: Main-thread (Lepus) host lifecycle, data flow, single-owner hooks, peer communication, page-level flush and host services (`isDestroyed`, `getInitData`, `getGlobalProps`, `getSystemInfo`, `onRenderPage`, `onUpdateData`, `onReload`, `onGlobalPropsChanged`, `setDataProcessor`, `setPageDataGetter`, `sendMessage`, `onMessage`, `flushElementTree`, `createPipeline`, `markTiming`, `onDestroy`).
- `@lynx-js/lynx-runtime/bts`: Background-thread (JS) page binding entrypoint (`bindPage(): BTSPageRuntime`). All BTS page capabilities (`isDestroyed`, `getId`, `getInitData`, `getGlobalProps`, `getSystemInfo`, `onUpdateData`, `onGlobalPropsChanged`, `onReload`, `onConfigChanged`, `onEnterForeground`, `onEnterBackground`, `setEventHandler`, `sendMessage`, `onMessage`, `createPipeline`, `markTiming`, `onDestroy`) are accessed on the bound `BTSPageRuntime` handle, ensuring deterministic page ownership across synchronous and asynchronous work.

## MTS input ownership

Importing `@lynx-js/lynx-runtime/mts` has no module-evaluation side effects, and
MTS capabilities claim only their corresponding host channels so DSLs can adopt
primitives incrementally:

- **Pure queries, performance, flush, peer messages, and `onDestroy`**
  (`isDestroyed`, `getSystemInfo`, `createPipeline`, `markTiming`,
  `flushElementTree`, `sendMessage`, `onMessage`, `onDestroy`) only check or bind
  host liveness (`__DestroyLifetime`) and **never** overwrite DSL-owned
  `renderPage`, `updatePage`, `updateGlobalProps`, `processData`, or `getPageData`
  globals.
- **Page data lifecycle** (`onRenderPage`, `onUpdateData`, `onReload`,
  `getInitData`) claims `renderPage` and `updatePage` (plus Engine `__RenderPage` /
  `__UpdatePage` when available) for that host's lifetime.
- **`GlobalProps` channel** (`onGlobalPropsChanged`, `getGlobalProps`) claims
  `updateGlobalProps` (plus Engine `__UpdateGlobalProps` when available).
- **Single-owner hooks** (`setDataProcessor`, `setPageDataGetter`) claim only their
  own `processData` or `getPageData` global slot.

Register MTS lifecycle listeners or host hooks (or call `getInitData()` /
`getGlobalProps()`) synchronously during startup before the host delivers the
first input for that channel. Engine events are delivered directly to Runtime
subscribers; older hosts deliver the same notifications through the owned global
functions.

Migrate existing DSL handlers explicitly, and remove old Engine registrations
and global assignments for the adopted channel:

```ts
import {
  onReload,
  onRenderPage,
  onUpdateData,
} from '@lynx-js/lynx-runtime/mts';
import { reloadDSLPage, renderDSLPage, updateDSLPage } from './renderer.js';

const stopRender = onRenderPage(renderDSLPage);
const stopUpdate = onUpdateData(updateDSLPage);
const stopReload = onReload(reloadDSLPage);
```

Runtime captures first-screen and reload inputs before notifying subscribers,
even if no subscriber exists or all subscribers have unsubscribed. `getInitData()`
returns a recursively detached copy of that round's initial baseline, independently
of later DSL state changes (unlike ReactLynx's internal `lynx.__initData`, which
shallow-merges reload data onto prior runtime state via `Object.assign`, Runtime's
`getInitData()` replaces prior dynamic keys on `onReload`):

- **MTS `getInitData()`**: reflects the processed `TemplateData` delivered to
  `renderPage` (first screen) or `updatePage(..., { reloadTemplate: true })`
  (`onReload`).
- **BTS `page.getInitData()`**: overlays the current round's processed initial or
  `onReload` `TemplateData` onto the template's static `_params.initData`
  (`encoded_data` synced via `__SetLepusInitData`, or `{}` when unused), keeping
  static template keys intact across `onReload` while replacing prior dynamic keys.

The copied records and arrays can be mutated without modifying Runtime snapshots;
opaque objects retain their identity. Unsubscribing removes the consumer's listener
while keeping host input capture active until destruction. Activating Runtime after
inputs have already been delivered cannot recover those earlier inputs.

MTS destruction uses Native `lynx.getNative()` (**Lynx SDK 3.4+**) and Web
`lynx.getEngine()` (**`@lynx-js/web-core` 0.24.0+**) for host destruction
notifications. Runtime releases its input subscriptions and single-owner hooks; the
DSL retains ownership of its resource cleanup. On **Lynx SDK 2.14–3.3** or earlier
**`@lynx-js/web-core`** where the host does not emit an MTS destroy event,
`mts.onDestroy()` safely degrades to an idempotent no-op disposer and relies on
whole-page context teardown (whereas BTS `page.onDestroy()` is supported across
**Lynx SDK 2.14+** and Web).

## BTS capability ownership

`bindPage()` captures initial data and tracks reload and destruction. Call
`bindPage()` synchronously during page bootstrap and retain the returned
`BTSPageRuntime` handle for all subsequent asynchronous work on that page.

`bindPage()` does not eagerly claim `GlobalProps`. The first `page.getGlobalProps()`
or `page.onGlobalPropsChanged()` call activates `GlobalProps` capture while
preserving an existing host handler; read or subscribe during synchronous startup
so subsequent notifications are captured. Other BTS notifications are installed
lazily when subscribed, allowing incremental adoption alongside existing code.

The bound handle remains readable throughout any pre-existing host destroy handler
and all Runtime `onDestroy` callbacks, even after the host detaches the page.
Runtime disables raw event handlers when destruction starts and releases its
lifecycle hooks after all destroy callbacks finish.

## `GlobalProps` across MTS and BTS

Both threads expose `getGlobalProps<T>(): Readonly<T>` (defaulting to `{}` when
unset) and `onGlobalPropsChanged<T>()`, with thread-appropriate backing storage:

- **MTS (single-page context)**: `getGlobalProps()` and `onGlobalPropsChanged()`
  borrow the live host `lynx.__globalProps` object directly without per-read
  copying (capturing a final snapshot once destruction starts). `onGlobalPropsChanged`
  also forwards optional `MTSFlushContext` (`options`) when provided by the host.
- **BTS (multi-page shared context)**: `page.getGlobalProps()` and
  `page.onGlobalPropsChanged()` expose a page-scoped snapshot copied when capture
  activates and on each `updateGlobalProps` notification, isolating each page from
  peer pages and legacy `lynx.__globalProps` mutations. Inside
  `page.onGlobalPropsChanged(props => ...)`, `props === page.getGlobalProps()`
  always holds.

Treat the entire `GlobalProps` value—including nested objects—as read-only on both
threads (`Readonly<T>` is a compile-time marker and does not freeze objects). If a
DSL mutates its own root `GlobalProps` object in place (for example via
`Object.assign`), shallow-copy `{ ...getGlobalProps() }` or
`{ ...page.getGlobalProps() }` at startup so in-place root mutations do not write
back into the borrowed runtime snapshot.

## Raw BTS events

`page.setEventHandler(handler)` takes single-owner control of both page and
component event entries on `bindPage()`:

```ts
const stop = bindPage().setEventHandler((handlerName, data, componentId) => {
  if (componentId !== undefined) {
    return components.get(componentId)?.dispatch(handlerName, data);
  }
  return pageHandlers.get(handlerName)?.(data);
});
```

- Page events pass `componentId` as `undefined`; component events preserve the
  host `componentId` string (including `""`).
- On MTS, elements must bind string handler names via `__AddEvent` or `__SetEvents`
  to route events to BTS `setEventHandler`; `__AddEventListener` only accepts
  MTS-local closures and does not forward string handler names to BTS.
- First registration claims both host event slots; a newer registration replaces
  the previous one, and stale disposers are no-ops. Disposal or page destruction
  resets both entries to return `undefined` without restoring prior handlers.
- Synchronous return values and thrown exceptions propagate directly to the host;
  `false` is treated as ordinary data, and `Promise`/thenable return values are
  not awaited.

## Registration lifetime

Host notifications deduplicate the same callback per page and notification.
Repeated `bindPage()` calls for the same page return the same `BTSPageRuntime`
handle and share registrations; a new registration after disposal cannot be
removed by old disposers. Because in-place page reloads (`onReload`:
`ReloadTemplate` / `ReloadFromJS`) do not trigger host `__DestroyLifetime`
(`onDestroy`), runtime managers that are recreated across reloads or entry
re-evaluations must invoke the returned `Unsubscribe` disposer when retiring an
older instance.

Once destruction begins, `isDestroyed()` (on MTS and `BTSPageRuntime`) immediately
returns `true` before any DSL `onDestroy` callback runs, while new listeners,
owners, messages, flushes, and capability activations throw. Existing disposers
stay safe and idempotent. Removing a listener during dispatch takes effect
immediately; additions wait until the next dispatch. MTS stops messages first,
invokes user `onDestroy` callbacks, and restores input channels and single-owner
slots (`processData` to passthrough, `getPageData` to `null`) in `finally`.

## Peer messages

MTS and `BTSPageRuntime` expose symmetric `sendMessage` and
`onMessage<T = unknown>(type, listener)`. When an explicit non-optional payload
type `T` is provided (`sendMessage<Payload>(type, data)`), `data` is required at
compile time. Messages target the peer thread of the same page (`lynx.getJSContext()`
on MTS, `lynx.getCoreContext()` on BTS).

```ts
// MTS
import { onMessage, sendMessage } from '@lynx-js/lynx-runtime/mts';
const stop = onMessage<{ text: string }>('example:input', data => {
  render(data.text);
  sendMessage('example:rendered', { text: data.text });
});
```

```ts
// BTS
import { bindPage } from '@lynx-js/lynx-runtime/bts';
const page = bindPage();
page.onMessage<{ text: string }>('example:rendered', data => record(data.text));
page.sendMessage('example:input', { text: 'hello' });
```

- Messages pass `{ type, data }` directly through `ContextProxy.dispatchEvent`
  without envelopes, prefixes, startup queues, acknowledgements, or `Promise` RPC,
  and do not wrap legacy named-global `callLepusMethod` bridges.
- Listeners receive `event.data` with `undefined` `this`. Web normalizes top-level
  `null` and `undefined` payloads to `{}`; prefer plain objects or non-nullish
  values across platforms.
- Subscriptions share one host listener per message `type` and deduplicate identical
  callbacks. Missing peer context proxies fail explicitly.

## Page-level flush (`flushElementTree`)

MTS exposes `flushElementTree(options?: Readonly<MTSFlushOptions>): void` to submit
page-level element tree updates after `onUpdateData`, `onReload`,
`onGlobalPropsChanged`, or `onMessage` (first-screen `onRenderPage` is flushed
implicitly by the host when the callback returns):

```ts
import {
  flushElementTree,
  onGlobalPropsChanged,
  onReload,
  onUpdateData,
} from '@lynx-js/lynx-runtime/mts';

onUpdateData((data, options) => {
  applyData(data, options);
  flushElementTree(options);
});

onReload((data, options) => {
  reloadPage(data, options);
  flushElementTree(options);
});

onGlobalPropsChanged((_props, options) => {
  flushElementTree(options);
});
```

- **Host update flush contract**: Every MTS `onUpdateData`, `onReload`, and
  `onGlobalPropsChanged` handler that owns page updates must submit a corresponding
  `flushElementTree(options)` call with the originating `options`—even when no
  element attributes changed in that update—so the host's `nativeUpdateDataOrder`
  queue and pipeline lifecycle remain aligned. Deferred flushes must retain and
  forward the originating `options`.
- Calling `flushElementTree()` (or `flushElementTree(undefined)`) invokes
  `__FlushElementTree()` with 0 arguments; calling `flushElementTree(options)`
  validates that `options` is a plain object and invokes
  `__FlushElementTree(undefined, options)` at the page root.
- If `options.timingFlag` is provided without `__lynx_timing_flag`, Runtime maps it
  to `__lynx_timing_flag` on a shallow copy without mutating the caller's object;
  otherwise `options` is passed through by reference.
- `MTSFlushOptions` extends `MTSFlushContext` (`reloadTemplate`,
  `nativeUpdateDataOrder`, `pipelineOptions`) and adds page-level flush controls
  (`timingFlag`, `triggerLayout`, `triggerDataUpdated`, `emptyPatch`). List subtree
  flush options and `onLayoutReady` are excluded.
- `flushElementTree` returning only indicates that the flush request was submitted
  to the host, not that layout or UI painting has completed.

## Native data processing & host updates

Register synchronous MTS hooks before the first host input when needed:

- `setDataProcessor(processor)`: Single-owner MTS `processData` hook. Normalizes
  absent host data (`undefined` / `null`) to `{}` and empty default `processorName`
  (`""`) to `undefined` across Native and Web. Data processors run synchronously on
  MTS only; `PromiseLike` return types are rejected at compile time.
- `setPageDataGetter(getter)`: Single-owner MTS `getPageData` hook for host
  page-data queries (`PromiseLike` return types rejected).

On first screen, `page.getInitData()` combines static template `initData` with the
initial `updateData` already processed by the host (while MTS `getInitData()`
captures the initial `renderPage` payload). On `onReload`, MTS `getInitData()`
replaces its baseline with a detached copy of that reload's payload, while BTS
`page.getInitData()` overlays that reload's payload onto the template's static
`_params.initData`. `page.onUpdateData()` subscribes directly to `tt.updateCardData`
(normalizing `resetPageData` and `processorName`) without an MTS-to-BTS forwarding
queue.

> **Caveat (Native `.lynxml` bundles):** On current Native hosts, `.lynxml` bundles
> use a legacy card type that skips delivering incremental updates to BTS, so
> `page.onUpdateData()` is not invoked on Native `.lynxml` pages (Web is unaffected,
> and `page.getInitData()` / `page.onReload()` remain available; dual-thread
> `.lynxml` pages can forward incremental updates from MTS `onUpdateData` via
> `sendMessage` until Native aligns `.lynxml` update delivery).

## Host services (`getSystemInfo`, `createPipeline`, `markTiming`)

- `getSystemInfo(): Readonly<LynxSystemInfo>`:
  - Returns live host `SystemInfo` across MTS (`lynx.SystemInfo`, keeping
    `globalThis.SystemInfo` aliased for live `pixelRatio` updates when unset) and
    BTS (`lynx.SystemInfo ?? globalThis.SystemInfo`), falling back to `{}`.
- `createPipeline(options?: CreatePipelineOptions): CreatedPipelineOptions | undefined`:
  - Wraps host pipeline generation, `_onPipelineStart` signature differences across
    MTS/BTS and SDK versions, and `timingFlag` binding (`ID` vs `Id`).
  - Returns `undefined` when the host/page is destroying or destroyed, or when
    pipeline generation is unavailable.
- `markTiming(pipeline: string | PipelineOptions | undefined, timingKey: string): void`:
  - Accepts either a `pipelineID` string or a `PipelineOptions` object and records
    `timingKey`, safely no-oping when unavailable or after destruction starts.
- Direct-reuse host globals (used directly without Runtime wrappers):
  - `lynx.performance.profileStart` / `profileEnd` / `profileMark` /
    `profileFlowId` / `isProfileRecording`, and `lynx.performance.createObserver`
    on BTS (avoid calling `observe()` again after `disconnect()` on the same
    observer instance);
  - `lynx.fetchBundle` (`ResponseHandler.then` is callback-only, not a `Promise`),
    `lynx.loadScript` (pass an explicit options object `lynx.loadScript(key, {})`
    on BTS), and `lynx.getCustomSectionSync`;
  - Standard timers (`setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`,
    `requestAnimationFrame`, `cancelAnimationFrame`) and `lynx.reportError`.

## Data ownership summary

- `getInitData()` returns detached copies of plain records and arrays for mutable
  DSL state; opaque objects (`Date`, typed arrays, class instances) remain shared by
  reference.
- `getGlobalProps()`, `getSystemInfo()`, and all notification payloads
  (`onRenderPage`, `onUpdateData`, `onReload`, `onGlobalPropsChanged`,
  `onConfigChanged`) are typed as `Readonly<...>` and must not be mutated in place.
- `page.getId()` returns the host identifier captured at binding (`appGUID`, then
  `nativeAppId`, or `""` when absent).
