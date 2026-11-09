# Page integration examples

These examples use only the package's public exports. Install them from your DSL's
thread-specific entry points after the host exists. Supply the renderer or state
consumer callbacks; Runtime does not create elements or provide a UI framework.
Functions exported by these files are example integration code, not Runtime APIs.

## Start a main-thread page

Call `startMainThread` from [mts-page.ts](mts-page.ts) synchronously before the first
host input. Its `render(data, props)` callback must update your element tree
synchronously without submitting it: the example owns subsequent flushes and the
host submits the first screen. Remove existing handlers for the adopted input
channels so the old and new implementations do not both process the same input.

The example chooses a simple state policy: merge incremental updates, replace on
reset, and use `getInitData()` for each reload baseline. Its data contains only an
optional numeric `count`; GlobalProps contains an optional string `accent` and is
borrowed read-only. Adapt the state policy to your DSL rather than treating it as
a Runtime-provided store.

It forwards update/reload/GlobalProps options into `flushElementTree`, including
updates that do not change the tree. See the [input ownership contract](../README.md#mts-input-ownership)
and [flush contract](../README.md#page-level-flush-flushelementtree).

## Bind a background page

Call `startBackground` from [bts-page.ts](bts-page.ts) synchronously during BTS
bootstrap. `showData` consumes the example's state; `showResult` consumes the result
of an asynchronous read. Neither callback is a Native rendering primitive.

`readLater` retains the page handle captured at bootstrap. It checks both entry
retirement and page destruction before starting work and after awaiting it.
Retiring an entry suppresses late results but does not cancel the underlying read;
a rejected read still rejects the returned Promise. The caller owns error handling
and cancellation when its data source supports it. Overlapping reads are not
ordered by this example.

Native `.lynxml` pages currently do not deliver BTS incremental updates. Do not
use this example to infer otherwise: see [the host limitation](../README.md#native-data-processing--host-updates).

## Exchange messages

Install `startMessageReceiver` from [messages-mts.ts](messages-mts.ts) on MTS and
`startMessageSender` from [messages-bts.ts](messages-bts.ts) on BTS. Your bootstrap
must ensure both listeners are installed before calling the sender's `send(text)`.
There is no startup queue or readiness handshake in these examples.

The MTS callback `applyText` synchronously changes your element tree. The example
then submits it and replies with `example:submitted`. BTS `recordSubmission`
observes that reply. It confirms handler execution and submission only, not
layout, paint, or presentation to the user. `send` returns `void`.

Both endpoints use an object payload `{ text: string }`. This shared TypeScript
assumption is appropriate for the paired example; the generic type parameter
does not validate incoming data. Validate payloads at an untrusted producer
boundary. This example does not implement correlation, deadlines, retries,
duplicate suppression, or entry-generation filtering. If you need those semantics,
define them in your DSL protocol, including how to reject replies from a retired
entry. A timeout alone does not prove that an operation was not applied.

## Retire an entry

Each installer returns a disposer or an object with `dispose()`. Call it before
replacing that entry, even while the host page remains alive. The examples also
register it with `onDestroy` as a page-lifetime fallback. Disposal unsubscribes the
destroy callback itself, so replacing entries does not accumulate callbacks until
page teardown. The DSL remains responsible for destroying its renderer and other
resources it creates outside these examples.

For callbacks already running at retirement, see [registration lifetime](../README.md#registration-lifetime)
and the [flush contract](../README.md#page-level-flush-flushelementtree).

Disposal does not restore previously claimed MTS input handlers or reset Runtime's
page scope. A replacement entry registers new consumers on the existing live
scope. If the host instead creates a new BTS App, bind the replacement entry to
that new App. MTS hosts without destruction notifications still require explicit
entry cleanup; see [version boundaries](../README.md#package-and-host-versions).

## Check the public imports

From the repository root, build the package through Turbo and type-check these
files against its generated declarations:

```sh
pnpm turbo build --filter @lynx-js/lynx-runtime
pnpm --filter @lynx-js/lynx-runtime test:type
```

The examples and their standalone TypeScript configuration are included in the
package. Type checking verifies public imports and call signatures; it does not
verify host delivery, rendering, or device behavior. Run the integration in your
target host to verify those effects. In a dual-thread shared source file, apply
your compiler's thread guards as described in [subpath exports](../README.md#subpath-exports);
these examples instead use separate MTS and BTS files.
