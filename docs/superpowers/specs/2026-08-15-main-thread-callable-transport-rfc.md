# RFC: useMainThreadEvent — main-thread event functions over a lifecycle-safe callable transport

## Summary

Introduce a generic, lifecycle-safe way to hand an **arbitrary consumer-authored main-thread function** — including functions nested inside plain objects and arrays — to long-lived main-thread consumers, with:

- a stable, serializable background-thread handle per component instance;
- captured values that are **re-synchronized on every rerender**;
- deterministic **release on unmount** (plus a GC fallback);
- a **stable realized function identity** on the main thread, so main-thread code that retained the function keeps observing the latest implementation.

The proposal has two layers with deliberately different names:

- **Mechanism** (internal): the *callable transport* — a `_wcid`-branded handle, a main-thread registry of identity-stable wrapper functions, and an ordered per-commit ctx patch channel.
- **Public API** (for library authors): *main-thread event functions* — `useMainThreadEvent(fn)` for a single function and `useMainThreadEvents(value)` for values with nested functions (e.g. a Motion `transition` object containing an easing function array), in the direct lineage of React's `useEvent`/`useEffectEvent` (see "Naming" below).

This RFC follows the model laid out by the MainThreadObject RFC (#3446): it names the background representation an opaque handle, keeps wire fields internal, and separates identity, transport, and lifecycle. It does not depend on the MainThreadObject implementation (#3477) and composes with it.

## Motivation

### The concrete blockers

Two Motion conformance gaps are hard-blocked on this capability (both are adapter blockers, not Lynx engine gaps):

1. **Easing callbacks** (Huxpro/motion#37): upstream Motion accepts easing function arrays per keyframe segment:

   ```tsx
   <motion.view
     animate={{ x: [-42, 0, 42] }}
     transition={{
       duration: 0.8,
       ease: [
         (progress) => {
           'main thread';
           return progress;
         },
         (progress) => {
           'main thread';
           return progress * progress;
         },
       ],
     }}
   />;
   ```

   The declarative adapter resolves transitions on the background thread and forwards them to the main-thread animation engine. Scalars, arrays and objects arrive; the nested functions do not arrive as callable main-thread functions. Easing must be invoked **synchronously per frame**, so `runOnBackground`-style RPC is not an option.

2. **`transformTemplate`** (Huxpro/motion#55): a consumer callback composes custom transform text around Motion's generated transform every frame:

   ```tsx
   <motion.view
     animate={{ x: 30 }}
     transformTemplate={({ x }, generated) => {
       'main thread';
       return `translateY(${x}) ${generated}`;
     }}
   />;
   ```

   The callback must be callable from the main-thread style update path, receive fresh captured values after rerenders, and be released on unmount.

### Why every existing mechanism falls short

| Mechanism | Why it is not enough |
| --- | --- |
| Package-owned callable registry (`packages/motion/src/utils/registeredFunction.ts`, used by `mini/core/easings.ts`) | Registers a **fixed set of package functions at bundle init** under string handles. Consumer closures, captured values, per-instance identity, and unmount release are all unsupported. This is the workaround the Motion mini easings use today, and it caps the API surface at a hardcoded easing list. |
| Nested worklet capture (`transformWorkletInner` already binds nested `_wkltId` descriptors) | Works only for a ctx that travels whole through one serialization. A long-lived main-thread consumer (an animation loop, a style effect) retains the ctx **from the render that delivered it**; later rerenders never refresh its captured values. There is no unmount release, and nested/cross-module descriptors have hydrated as non-callable plain objects on Lynx for Web. |
| Plain (non-directive) functions in captures | `JSON.stringify` silently drops function-valued properties from `_c`; the main thread sees `undefined` with no diagnostic. The DEV report in `workletEvent.ts` only covers the top-level prop position. |
| `runOnBackground` handles (`_jsFn`) | Asynchronous by design. Easing and transform composition are synchronous per-frame calls. |
| `MainThreadObject` (#3446 / #3477) | Payload is a **one-shot initialization** realized into one stable object. An event function needs the opposite: per-render re-capture behind a stable identity. |
| `MainThreadRef` | A mutable cell whose contents are written **by main-thread code**. Here the source of truth (the closure and its captures) lives on the background thread and must be pushed down. |

### Position in the MainThreadObject algebra

#3446 separates realization (payload → stable realized value) from binding (a stable slot whose target changes over time). `main-thread:ref` already decomposes into both: a renderer-written binding (`MutableCell`) over native-backed realized objects (`MainThread.Element`). Placing the event function in the same decomposition exposes the axes that were previously implicit:

| Concept | Binding | Binding writer | Exposure | Target ownership |
| --- | --- | --- | --- | --- |
| MainThreadObject | none (one-shot) | — | handle → object | owned by the transport (`dispose`) |
| `main-thread:ref` | yes | MTS renderer | exposed cell (`.current`) | borrowed (Elements belong to the renderer) |
| **MainThreadEvent** | **yes** | **BTS commits** | **hidden (auto-deref function)** | **owned (replaced ctxs are released)** |

An event function is a *binding whose successive targets are function realizations of fresh ctxs*, exposed behind a stable function identity: the wrapper is `Binding<Fn>` plus auto-dereference, because upstream consumers (Motion) expect a plain function, not a cell. The two properties that no existing primitive combines are the **binding writer** (the background thread, at commit cadence — `main-thread:ref` is written from the other side) and the **hidden exposure** (consumers cannot observe rebinds; calling always dereferences to the latest committed implementation).

## Naming: the useEvent lineage

`useMainThreadEvent` is the main-thread counterpart of React's `useEvent`/`useEffectEvent`, and the correspondence is an isomorphism, not an analogy. `useEffectEvent`'s three-line polyfill maps piecewise onto this design:

| React (`useEffectEvent` polyfill) | Lynx (`useMainThreadEvent`) |
| --- | --- |
| a `useRef` cell holding the latest closure | the `_wcid` registry slot on the main thread (the cell moved across heaps) |
| `useInsertionEffect(() => { ref.current = fn })` | the per-commit ctx patch (same commit timing, serialized) |
| stable `(...a) => ref.current(...a)` wrapper | the registry-cached wrapper: `(...a) => runWorklet(registry[id], a)` |

Every documented constraint transfers:

- *stable identity, never a dependency* → the handle is stable; effects that ship it can use `[]` deps; change detection must use content, not identity (as the Motion adapter's `animationKey` already does);
- *not callable during render* → structurally enforced: on the background thread the handle is inert (not a function at all), and the main thread has no user-facing render phase — every call site is post-commit by construction;
- *reads the latest **committed** values* → here "committed" additionally means "committed and delivered";
- *callable from an unmounting Effect's cleanup* → the transport flushes ctx **updates before** the commit's patch and **releases after** it, so an unmounting commit's main-thread tasks (e.g. Motion stopping an animation, which samples one final frame through the consumer easing) still resolve the function. This ordering was discovered independently through the declarative Motion conformance run — convergent evolution on the same semantic point.

React narrowed the original `useEvent` into `useEffectEvent` (only callable inside Effects, never passed to other components) because in a single heap those rules are the only way to police call sites and to prevent a never-changing identity from leaking into reactive data. Across the thread boundary both hazards vanish structurally: the callable form of the function only exists on the main thread, where there is no reactivity to confuse it with — passing it to a foreign consumer is not a hazard but the entire point. Under the reading that *the main thread is the external system that Effects synchronize with*, calling the event from main-thread code **is** calling it from within the Effect — the boundary React enforces by convention is physical here. Reanimated reached the same conclusion and ships its cross-runtime equivalent as `useEvent`.

Terminology in this document: the **mechanism** keeps the name *callable transport* (registry, `_wcid`, ctx patches); the **public API** adopts the event-function lineage.

## Proposed model

### 1. The handle and the transport

An opaque, serializable background-thread handle for one consumer-authored main-thread function slot.

```text
background runtime                        main-thread runtime

fn (worklet ctx, fresh per render)          stable wrapper fn
        │                                        │ call
handle { _wcid } ── commit patch [id, ctx] ──► registry: id → latest ctx
        │                                        │ runWorklet(ctx, args)
        └── unmount → patch [id, null] ────────► entry removed
```

- The handle serializes as `{ _wcid }` — a sibling discriminant to `_wvid` (MainThreadRef), `_wkltId` (worklet), `_jsFnId` (background function) and `elementRefptr` (element) in the main-thread value transform.
- Wherever a worklet capture or parameter contains the handle (at any nesting depth), hydration replaces it with the realized function.
- The realized function is **identity-stable per id**: main-thread code may retain it across frames and rerenders; each call resolves the latest registered ctx.
- Calls are **synchronous local calls** on the main thread. This is not RPC.

### 2. Hooks

```ts
/** Single function. */
function useMainThreadEvent<F extends (...args: any[]) => any>(
  fn: F | null | undefined,
): MainThreadEvent<F> | null;

/** Deep transport: every main-thread function nested in `value` becomes a handle. */
function useMainThreadEvents<T>(value: T): T; // handles hydrate back to functions on the main thread
```

- `fn` and nested functions must be main-thread functions (`'main thread'` directive). In DEV, a plain function produces a diagnostic naming the offending hook (mirroring `reportInvalidWorkletValue`); in production it is passed through untouched.
- `useMainThreadEvents` walks plain objects and arrays, keys each discovered function **by its structural path** (`ease.0`, `ease.1`, …), and reuses the same handle id for the same path across rerenders. Slots that disappear are released on commit; unmount releases all slots. The returned value is a structural clone with functions replaced by handles; everything else (including `MainThreadRef`s and already-wrapped handles) passes through.

Adapter usage for the two blockers:

```ts
// #37 — easing arrays: forward the whole transition unchanged.
const transition = useMainThreadEvents(props.transition);
runOnMainThread(updateMotionStyles)(target, transition /* , ... */);
// on the main thread, transition.ease[0] is a real function

// #55 — transformTemplate: a single lifecycle-managed event function.
const transformTemplate = useMainThreadEvent(props.transformTemplate);
// captured by the style-update worklet; hydrates to a stable function
```

### 3. Lifecycle

```text
render:   hook allocates id (once) ── stages [id, ctx] into the callable patch pool
commit:   pool flushed with the ref-init-value flush (callLepusMethod) → MTS registry updated
rerender: fresh ctx (fresh captures) staged; last write per id wins within a commit
unmount:  effect cleanup stages [id, null]; flushed after the commit's patch update
GC:       destruction observer dispatches releaseMainThreadCallable (fallback for
          handles that never reached a cleanup, mirroring MainThreadRef)
```

- Updates and releases travel in **one ordered channel** (a new `LifecycleConstant.updateMTCallableCtx`), but at different points of the commit: **updates flush before the commit's patch update** so main-thread tasks scheduled by the same commit observe fresh ctxs, while **releases flush after it** so those same tasks can still call the function. This split is load-bearing: an unmounting Motion component stops its animations through a `runOnMainThread` task in the unmounting commit, and stopping an animation samples one final frame through the consumer easing — releasing before the patch would tear the easing out from under that final sample.
- Every staged ctx passes through `onPostWorkletCtx` first, so nested `runOnBackground` handles get their `_execId` and background-function lifecycle exactly like event ctxs. The main-thread registry retains each installed ctx with the `JsFunctionLifecycleManager`, so replaced ctxs release their background exec contexts through the existing `FinalizationRegistry` batching.
- Redundant pushes are skipped when the serialized ctx is unchanged **and** the ctx carries no `_jsFn` handles (background function identities are not observable in JSON, so ctxs with `_jsFn` always re-push).

### 4. First screen

Mirrors first-screen `MainThreadRef` behavior: a hook running during main-thread first-screen rendering allocates a **negative id** and registers the ctx directly into a first-screen registry (the worklet runtime is already loaded by the function's own module registration). Events fired before hydration resolve through it. Background hydration re-renders with positive ids and pushes real ctx patches; the first-screen registry is cleared when hydration finishes, alongside `clearFirstScreenWorkletRefMap`.

### 5. Errors

- Calling a released or never-registered event function throws a descriptive error in DEV and is a no-op returning `undefined` in production.
- Creating handles when MTS is unavailable (SDK < 2.14) reports the same error as `onPostWorkletCtx`.
- Handles are inert on the background thread: they expose no callable surface there, like `MainThreadRef.current` access guards.

## Runtime requirements

- One new discriminant branch (`'_wcid' in value`) in `transformWorkletInner`, dispatched after the existing `_wvid` / `_wkltId` / `_jsFnId` / `elementRefptr` branches (hot paths pay nothing for it).
- A `_callableImpl` registry on `lynxWorkletImpl` with: `updateCallableCtxChanges(patch)`, `getFromCallableMap(handle)`, `removeCallable(id)`, first-screen map + `clearFirstScreenCallableCtxMap()`.
- A new `WorkletEvents.releaseMainThreadCallable` event (callable ids and ref ids are separate counters; the release channels must not collide).
- Background side: a patch pool (`Map<id, ctx | null>`, last write wins), flushed at the existing ref-init-value flush points; hook implementations on `useRef` + effect cleanup; destruction-observer fallback.
- Lazy-runtime export shims (`runtime/lazy/*.js`) and api-extractor report updates for the new public surface.
- No compiler changes for v1: handles ride inside plain objects/params, and `toJSON` produces the wire form. (See open questions for the capture-narrowing interaction.)

## Non-goals

- Transporting **non-directive** plain closures: code does not cross threads; only main-thread functions (compiled into the main-thread bundle) are addressable. Compiler-assisted directive inference for designated props is future work (see Convergence).
- RPC, promises, or async invocation — an event-function call is a synchronous local call.
- Making call results or captured mutations observable from background React.
- Replacing `main-thread:bind*` event props, `MainThreadRef`, or `MainThreadObject`.
- Cross-thread state coherence beyond "latest committed captures win".

## Convergence: where this family should end up

This RFC adds one more `useMainThread*` API to an already multi-membered family. Three observations bound the terminal state:

1. **The family is the set of distributed images of React primitives.** `useMainThreadRef` ≈ distributed `useRef`; `useMainThreadObject` ≈ distributed `useMemo(() => create(x), [])` with disposal; `useMainThreadEvent` ≈ distributed `useEffectEvent`; `runOnMainThread`/`runOnBackground` ≈ distributed dispatch. The image of `useState` is deliberately absent — making main-thread mutations re-render background React is a rejected non-goal here and in Reanimated alike.
2. **For end users the terminal state is zero new syntax.** With compiler-assisted directive inference for props typed as main-thread functions (Reanimated's auto-workletization precedent), upstream Motion example code runs unchanged; the hooks remain a library-author surface only.
3. **For library authors the terminal state is one type-directed transport.** `useMainThreadEvents` already deep-walks a value and transports one kind of leaf. The natural generalization is a single `useMainThread(value)` whose per-leaf policy is chosen by type — plain data re-pushed per commit, main-thread functions as event handles, `MainThreadRef`/`MainThreadObject` by handle — turning today's separate hooks into cases of one traversal.

Beneath both, the implementation substrate is shared and should eventually be extracted: identity allocation (already shared via `workletValueId` on the #3477 branch), wire-brand dispatch in `transformWorkletInner`, commit-boundary patch pools, GC observers, first-screen maps, and release events differ across ref/object/event only in **payload cadence** (once vs per-commit vs MTS-written) and **realization** (cell vs object vs function). Extracting that common slot mechanism is a follow-up refactor, gated on all three products having landed with tests; the public concepts stay as typed façades.

## Verification (Motion unblock)

1. Runtime unit tests: registry update/release, stable wrapper identity across ctx updates, first-screen negative ids, nested-handle hydration in captures and params, `_jsFn` lifecycle through replaced ctxs, release-after-patch ordering.
2. Integration tests through `@lynx-js/react/testing-library` (dual-runtime, real compiler transform): rerender re-captures, unmount release, deep transport of a transition-shaped object with a nested function array.
3. Motion-shaped verification in `packages/motion`:
   - an easing test where a consumer easing with captured values drives `mini`'s `animate` per frame (issue #37's acceptance shape);
   - a `transformTemplate` test producing `translateY(30px) translateX(30px)` from a real main-thread animation loop (issue #55's acceptance string).
4. Declarative adapter proof on the #3509 stack: forward `transition` through `useMainThreadEvents` and expose `transformTemplate` via `useMainThreadEvent` (composing with upstream `buildTransform` / `transformValue` from `motion-dom`), running the conformance cases from Huxpro/motion#37 / #55:
   - `transitions/easing-function-array`: both segment callbacks execute, and the element settles at `translateX(42px)`;
   - `targets/transform-template`: the element renders `translateY(30px) translateX(30px)`.

   Both pass on a branch merging this implementation with #3509 plus an ~50-line adapter wiring (three `useMainThreadEvents` wraps, one `useMainThreadEvent`, and a template-composed `transform` derived value in the style effect). All 122 existing motion tests on that stack stay green.

## Open questions

1. Should `useMainThreadEvents` be the only deep API, or should the runtime hydrate nested raw worklet descriptors generically (registry-less) as well? (This RFC keeps generic hydration out of scope: without a registry there is no rerender update or release story.)
2. Capture narrowing: when a handle-bearing object is captured via a deep member expression (e.g. `transition.ease.map`), the transform's compact-fallback narrowing can drop the array. #3477 introduces `captureMainThreadObject(x) ?? fallback`; the event-handle brand should join the same guard rather than adding a second one. (Passing the value as a worklet parameter — the adapter pattern — is unaffected.)
3. Protocol pairing between transform output, `@lynx-js/react` runtime, and lazy bundles — same boundary as #3446 open question 5; v1 assumes same-version pairing.
4. Should the realized wrapper identity survive release-and-recreate of the same slot (currently: no; a new id means a new wrapper)?
5. Directive inference: should the compiler treat functions in designated prop positions (e.g. a library-declared `transition` shape) as implicit main-thread functions so upstream-Motion example code runs unchanged? (See Convergence — the user-facing half of the terminal state.)
6. Should the family converge on a single type-directed `useMainThread(value)` transport, with ref/object/event as value kinds rather than separate hooks? (See Convergence — the library-author half.)
