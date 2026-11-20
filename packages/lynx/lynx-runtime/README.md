# `@lynx-js/lynx-runtime`

DSL-neutral Lynx host runtime primitives for main thread (`@lynx-js/lynx-runtime/mts`) and background thread (`@lynx-js/lynx-runtime/bts`).

> [!WARNING]
> **Preview (`0.0.x`):** `@lynx-js/lynx-runtime` is currently released as an early preview ahead of formal RFC stabilization. Public APIs and behavior are not yet guaranteed to be stable and may change in `0.0.x` / `0.x` releases.

## Find a starting point

Use this package when implementing a DSL's page/host integration. The DSL still
owns rendering, mutable application state, entry replacement, and message protocols.

| Task                                                 | Start here                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Register MTS inputs and submit updates               | [MTS input ownership](#mts-input-ownership), [flush](#page-level-flush-flushelementtree)         |
| Keep BTS asynchronous work bound to a page           | [BTS capability ownership](#bts-capability-ownership)                                            |
| Send a message and observe a reply                   | [Peer messages](#peer-messages)                                                                  |
| Retire an entry without destroying the page          | [Registration lifetime](#registration-lifetime)                                                  |
| Read initial data or GlobalProps                     | [Input baseline](#mts-input-ownership), [GlobalProps ownership](#globalprops-across-mts-and-bts) |
| Install synchronous data hooks or raw event handling | [Data hooks](#native-data-processing--host-updates), [raw BTS events](#raw-bts-events)           |
| Inline into a build-free `.lynxml` document          | [Build-free `.lynxml` usage (IIFE)](#build-free-lynxml-usage-iife)                               |

For a runnable Element PAPI example built with `@lynx-js/lynx-runtime/mts` and
`@lynx-js/lynx-runtime/bts`, see `examples/vanilla` in the `lynx-stack` repository.

## Contract at a glance

| API                                                               | When and where                                                                             | Ownership and return meaning                                                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bindPage()`                                                      | BTS synchronous bootstrap                                                                  | Captures the current App instance; reuse the handle in asynchronous work. Rebinding the same App does not create a fresh lifetime.                       |
| `getInitData()`                                                   | Initialize MTS during bootstrap before the first input; BTS capture starts at `bindPage()` | Copies plain records/arrays from the initial or reload baseline; incremental updates do not accumulate here. Opaque values remain shared.                |
| `getGlobalProps()`                                                | MTS or BTS bound handle (`bindPage()` tracks updates from bootstrap)                       | Borrows the host or bound page's current `GlobalProps` without copying (defaults to `{}`). Neither may be mutated, including nested values.              |
| `onRenderPage` / `onUpdateData` / `onReload`                      | MTS listeners register before the first input; BTS uses the bound handle for update/reload | Read-only notifications, not a state store. No replay of inputs missed before registration.                                                              |
| `page.onGlobalEvent(name, listener)`                              | BTS bound handle, while page and `GlobalEventEmitter` are available                        | Subscribes to the bound page's `GlobalEventEmitter` (`sendGlobalEvent` / exposure / keyboard), sharing one host listener per event name until teardown.  |
| `sendMessage` / `onMessage`                                       | Same-page peer thread; receiver must already be installed                                  | Sending returns `void`, not a receipt. No startup buffer, RPC, or cross-type ordering guarantee. The DSL owns payload validation and completion replies. |
| `flushElementTree(options?)`                                      | MTS, after applying an update                                                              | Submits the page root, not a List subtree. Preserve the input's options even for an empty update. Returning is not layout/paint completion.              |
| `setDataProcessor` / `setPageDataGetter` / `page.setEventHandler` | Install on the owning thread while alive                                                   | Single owner, latest registration wins. Disposing the current owner restores the default, not the previous owner. Host calls are synchronous.            |
| `onDestroy` / `isDestroyed`                                       | Host page lifetime                                                                         | Does not replace entry/component cleanup. Disposers are idempotent. On older MTS hosts, `false` means destruction has not been observed.                 |

After observed destruction begins, registration, sending, and flushing throw;
captured initial data/GlobalProps remain readable and disposers remain callable.
See the linked sections below for per-API activation and compatibility details.

## Package and host versions

Match this README and the exported declarations to the installed
`@lynx-js/lynx-runtime` version. Also check the actual Native SDK or
`@lynx-js/web-core` version: updating the JavaScript package does not add host
capabilities. The compatibility boundary is:

| Host capability                      | Native                                                                          | Web                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------- |
| BTS page destruction                 | Lynx SDK 2.14+                                                                  | Supported by the BTS host                             |
| MTS destruction & live `GlobalProps` | Lynx SDK 3.4+ (`onDestroy`); SDK 2.14+ (`GlobalProps`)                          | `@lynx-js/web-core` 0.26.9+ (`lynx.getNative()`)      |
| MTS without `lynx.getNative()`       | SDK 2.14–3.3: `onDestroy` returns a no-op disposer; `isDestroyed()` stays false | Earlier hosts without `getNative()` use same fallback |

These boundaries describe supported paths and fallbacks, not a device-validation
matrix. Peer messaging still requires the corresponding host ContextProxy.

## Subpath Exports

- `@lynx-js/lynx-runtime`: Shared TypeScript types only (`BTSPageRuntime`, `BTSEventHandler`, `CreatedPipelineOptions`, `CreatePipelineOptions`, `LynxSystemInfo`, `MTSFlushContext`, `MTSFlushOptions`, `MTSReloadOptions`, `MTSRenderOptions`, `MTSUpdateOptions`, `BTSUpdateOptions`, `BTSReloadOptions`, `PipelineOptions`, `Unsubscribe`). The package declares `"sideEffects": false`, and runtime entrypoints are imported from `/mts` or `/bts` with zero module-evaluation side effects so bundlers can tree-shake unused imports cleanly. In dual-thread shared files, import types from `@lynx-js/lynx-runtime` and guard runtime calls to `/mts` or `/bts` behind compile-time thread constants (such as `__LEPUS__` / `__JS__`) so dead-code elimination removes cross-thread references before module-graph resolution.
- `@lynx-js/lynx-runtime/mts`: Main-thread (Lepus) host lifecycle, data flow, single-owner hooks, peer communication, page-level flush and host services (`isDestroyed`, `getInitData`, `getGlobalProps`, `getSystemInfo`, `onRenderPage`, `onUpdateData`, `onReload`, `onGlobalPropsChanged`, `setDataProcessor`, `setPageDataGetter`, `sendMessage`, `onMessage`, `flushElementTree`, `createPipeline`, `markTiming`, `onDestroy`).
- `@lynx-js/lynx-runtime/bts`: Background-thread (JS) page binding entrypoint (`bindPage(): BTSPageRuntime`). All BTS page capabilities (`isDestroyed`, `getId`, `getInitData`, `getGlobalProps`, `getSystemInfo`, `onUpdateData`, `onGlobalPropsChanged`, `onReload`, `onConfigChanged`, `onEnterForeground`, `onEnterBackground`, `onGlobalEvent`, `setEventHandler`, `sendMessage`, `onMessage`, `createPipeline`, `markTiming`, `onDestroy`) are accessed on the bound `BTSPageRuntime` handle, ensuring deterministic page ownership across synchronous and asynchronous work.
- `@lynx-js/lynx-runtime/iife/mts` & `@lynx-js/lynx-runtime/iife/bts`: Prebuilt, minified, self-contained ES2017 (matching Rspeedy's default syntax target) classic IIFE scripts for build-free `.lynxml` documents. Inline `/iife/mts` at the top of `<script thread="main">` and `/iife/bts` at the top of `<script thread="background">`; each declares a script-scoped `var LynxRuntime` binding with the corresponding thread's exports without triggering CommonJS module wrapper detection (`module`/`exports`) or leaking across cards in shared BTS contexts.
- `@lynx-js/lynx-runtime/skill`: Version-matched agent skill (`skills/lynx-runtime/SKILL.md`) covering ESM and `.lynxml` usage patterns, classic-script pitfalls, `node:vm` testing notes, and the `skills/lynx-runtime/scripts/sync-lynxml.mjs` inline sync/check helper.

## Build-free `.lynxml` usage (IIFE)

Build-free `.lynxml` documents have no bundler, ESM `import`, or `<script src>`. Inline the prebuilt ES2017 IIFE scripts instead of loading `@lynx-js/lynx-runtime` via blocking `lynx.fetchBundle(...).wait(...)`:

```bash
# Insert or update marked inline blocks matching the installed version:
node node_modules/@lynx-js/lynx-runtime/skills/lynx-runtime/scripts/sync-lynxml.mjs path/to/page.lynxml

# Verify inline IIFE parity, block placement, LynxRuntime conflicts, and MTS global hook collisions:
node node_modules/@lynx-js/lynx-runtime/skills/lynx-runtime/scripts/sync-lynxml.mjs --check path/to/page.lynxml
```

For quick-start `.lynxml` usage patterns, classic-script naming notes, and `node:vm` testing setup, see `skills/lynx-runtime/SKILL.md` (`@lynx-js/lynx-runtime/skill`).

## MTS input ownership

Importing `@lynx-js/lynx-runtime/mts` has no module-evaluation side effects, and
pure query/performance helpers (`isDestroyed`, `getSystemInfo`, `createPipeline`,
`markTiming`) do not install host input bindings.

Calling any MTS page capability (`onRenderPage`, `onUpdateData`, `onReload`,
`onGlobalPropsChanged`, `getInitData`, `getGlobalProps`, `setDataProcessor`,
`setPageDataGetter`, `flushElementTree`, `sendMessage`, `onMessage`, `onDestroy`)
initializes the MTS host bindings once for that context:

- Installs Engine listeners (`__RenderPage`, `__UpdatePage`, `__UpdateGlobalProps`)
  when `lynx.getEngine()` is available, plus `globalThis` input handlers and safe
  defaults (`renderPage`, `updatePage`, `updateGlobalProps`, `processData`,
  `getPageData`, `removeComponents`) so C++ `GetAndCall` (`try_call = false`)
  entrypoints never fail on unused channels (for example when the client updates
  `GlobalProps` on a page that has no `onGlobalPropsChanged` subscriber).
- Binds MTS destruction (`__DestroyLifetime`) when available, and claims
  `processData` / `getPageData` as single-owner slots via `setDataProcessor` /
  `setPageDataGetter`.

Initialize MTS capabilities synchronously during startup before the host delivers
its first input, and do not mix raw `globalThis.renderPage` / `updatePage` /
`updateGlobalProps` assignments with `@lynx-js/lynx-runtime/mts` on the same page.

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

MTS destruction uses `lynx.getNative()` (**Lynx SDK 3.4+** on Native and Web) for
host destruction notifications (`__DestroyLifetime`). Runtime clears its input
subscribers and resets single-owner hooks while ignoring any late host inputs; the
DSL retains ownership of its resource cleanup. On **Lynx SDK 2.14–3.3** or earlier
`web-core` without `lynx.getNative()`, `mts.onDestroy()` safely degrades to an
idempotent no-op disposer and relies on whole-page context teardown (whereas BTS
`page.onDestroy()` is supported across **Lynx SDK 2.14+** and Web).

## BTS capability ownership

`bindPage()` captures initial data and `GlobalProps`, and tracks reload,
`GlobalProps` updates, and destruction on the current `App` instance. Call
`bindPage()` synchronously during page bootstrap and retain the returned
`BTSPageRuntime` handle for all subsequent asynchronous work on that page.

Other BTS notifications (`onUpdateData`, `onConfigChanged`, `onEnterForeground`,
`onEnterBackground`), `onGlobalEvent`, `onMessage`, and `setEventHandler` attach
lazily on first use.

The bound handle remains readable throughout any pre-existing host destroy handler
and all Runtime `onDestroy` callbacks, even after the host detaches the page.
Runtime disables raw event handlers and detaches `GlobalEventEmitter` /
`CoreContext` listeners when destruction starts, and clears all lifecycle
listeners in `finally`.

## `GlobalProps` across MTS and BTS

Both threads expose `getGlobalProps<T>(): Readonly<T>` (defaulting to `{}` when
unset) and `onGlobalPropsChanged<T>()`, borrowing the current `GlobalProps`
reference without deep-copying:

- **MTS (single-page context)**: `getGlobalProps()` and `onGlobalPropsChanged()`
  borrow the live host `lynx.__globalProps` object directly (updated by the host
  before dispatching `__UpdateGlobalProps` / `updateGlobalProps`, and capturing the
  final reference once destruction starts). `onGlobalPropsChanged` also forwards
  optional `MTSFlushContext` (`options`) when provided by the host.
- **BTS (multi-page shared context)**: `page.getGlobalProps()` and
  `page.onGlobalPropsChanged()` borrow the bound page's current `GlobalProps`
  reference without deep-copying (captured at `bindPage()` and updated on each
  `updateGlobalProps` notification, defaulting to `{}` when unset), isolating
  each page in `LynxGroup` from peer pages. Inside
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
component event entries on its first registration; `bindPage()` alone does not
claim them. In this dispatcher fragment, `components` and `pageHandlers` are
registries owned by the DSL:

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
- Synchronous return values and thrown exceptions propagate directly to the host
  (consumed by Native callbacks that inspect event results; Web event RPC is
  one-way); `false` is treated as ordinary data, and `Promise`/thenable return
  values are not awaited.

## BTS host global events (`page.onGlobalEvent`)

`page.onGlobalEvent<Args extends unknown[] = unknown[]>(name, listener)` subscribes
to host/client global events delivered to this page's `GlobalEventEmitter` (such as
client `sendGlobalEvent`, `exposure` / `disexposure`, and `keyboardstatuschanged`):

- Resolves `GlobalEventEmitter` from the bound page (`app.getJSModule('GlobalEventEmitter')`
  / `app.GlobalEventEmitter` before falling back to a page-bound `lynx.getJSModule('GlobalEventEmitter')`),
  so asynchronous subscriptions in a shared `LynxGroup` context stay isolated from
  peer pages. Missing `GlobalEventEmitter` fails explicitly.
- Lazily attaches one shared host listener per event `name` on that page and
  deduplicates identical `(name, listener)` pairs. Host `removeListener` is invoked
  only when the last Runtime subscriber for `name` unsubscribes or when page
  destruction begins, avoiding premature host capability teardown across Runtime
  subscribers (such as disabling `keyboardstatuschanged` detection while another
  `page.onGlobalEvent` subscriber on the same page remains active) and in-place
  listener-array mutation hazards during dispatch. Route all global-event
  listeners on the page through `page.onGlobalEvent` rather than mixing raw
  `GlobalEventEmitter` calls.
- Forwards all positional arguments emitted by the host with `undefined` `this`.
  Does not replay events emitted before registration, and removes all listeners
  before DSL `onDestroy` callbacks run.

## Registration lifetime

Load a single `@lynx-js/lynx-runtime` module instance per thread context so
subscriptions and single-owner slots share one per-host/per-page registry.
Host notifications deduplicate the same callback per page and notification.
Repeated `bindPage()` calls for the same page return the same `BTSPageRuntime`
handle and share registrations; a new registration after disposal cannot be
removed by old disposers. Because in-place page reloads (`onReload`:
`ReloadTemplate` / `ReloadFromJS`) do not trigger host `__DestroyLifetime`
(`onDestroy`), runtime managers that are recreated across reloads or entry
re-evaluations must invoke the returned `Unsubscribe` disposer when retiring an
older instance.

Unsubscribing prevents callbacks that have not yet started, including those in
the current dispatch. It does not interrupt a callback already running.
Registrations added during dispatch start with the next notification; they do not
receive the current input.

Once destruction begins, `isDestroyed()` (on MTS and `BTSPageRuntime`) immediately
returns `true` before any DSL `onDestroy` callback runs, while new listeners,
owners, messages, flushes, and capability activations throw. Existing disposers
stay safe and idempotent. MTS stops messages first,
invokes user `onDestroy` callbacks, and clears input listeners and resets
single-owner slots (`processData` to passthrough, `getPageData` to `null`) in
`finally`.

## Peer messages

MTS and `BTSPageRuntime` expose symmetric `sendMessage` and
`onMessage<T = unknown>(type, listener)`. When an explicit non-optional payload
type `T` is provided (`sendMessage<Payload>(type, data)`), `data` is required at
compile time. Messages target the peer thread of the same page (`lynx.getJSContext()`
on MTS, `lynx.getCoreContext()` on BTS). Install both receivers before sending.

- Messages pass `{ type, data }` directly through `ContextProxy.dispatchEvent`
  without envelopes, prefixes, startup queues, acknowledgements, or `Promise` RPC,
  and do not wrap legacy named-global `callLepusMethod` bridges.
- Listeners receive `event.data` verbatim (including `undefined` and `null`) with
  `undefined` `this`.
- Subscriptions share one host listener per message `type` and deduplicate identical
  callbacks. Missing peer context proxies fail explicitly.
- `T` is a caller-supplied TypeScript contract, not runtime payload validation.
  `await sendMessage(...)` does not wait for the receiver. If completion matters,
  define a reply and its meaning in the DSL protocol; timeout alone cannot prove
  that the peer did not apply an operation.

## Page-level flush (`flushElementTree`)

MTS exposes `flushElementTree(options?: Readonly<MTSFlushOptions>): void` to submit
page-level element tree updates after `onUpdateData`, `onReload`,
`onGlobalPropsChanged`, or `onMessage` (first-screen `onRenderPage` is flushed
implicitly by the host when the callback returns).

- **Host update flush contract**: Every MTS `onUpdateData`, `onReload`, and
  `onGlobalPropsChanged` handler that owns page updates must submit a corresponding
  `flushElementTree(options)` call with the originating `options`—even when no
  element attributes changed in that update—so the host's `nativeUpdateDataOrder`
  queue and pipeline lifecycle remain aligned. Deferred flushes must retain and
  forward the originating `options`.
- **Retirement and failure**: If rendering returns normally while the host remains
  alive, retiring the entry during that render does not cancel the current update's
  submission. If rendering throws, the DSL owns recovery and decides whether the
  resulting tree can be submitted. Host destruction prevents further flushes.
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
queue (requires `REACT_NODIFF` bundle DSL on Native, used by Rspeedy/ReactLynx,
`@lynx-js/rspeedy` Vanilla, and `.lynxml` on hosts that build LynxML bundles as
`REACT_NODIFF`; legacy `REACT` bundles skip BTS `updateCardData`).

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
