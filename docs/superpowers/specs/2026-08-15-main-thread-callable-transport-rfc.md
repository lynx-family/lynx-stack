# RFC: MainThreadCallable — lifecycle-managed callable transport for consumer main-thread functions

## Summary

Introduce a generic, lifecycle-safe way to hand an **arbitrary consumer-authored main-thread function** — including functions nested inside plain objects and arrays — to long-lived main-thread consumers, with:

- a stable, serializable background-thread handle per component instance;
- captured values that are **re-synchronized on every rerender**;
- deterministic **release on unmount** (plus a GC fallback);
- a **stable realized function identity** on the main thread, so main-thread code that retained the callable keeps observing the latest implementation.

The proposed primitive is `MainThreadCallable`, created with `useMainThreadCallable(fn)` for a single function and `useMainThreadCallables(value)` for values with nested functions (e.g. a Motion `transition` object containing an easing function array).

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
         (progress) => { 'main thread'; return progress },
         (progress) => { 'main thread'; return progress * progress },
       ],
     }}
   />
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
   />
   ```

   The callback must be callable from the main-thread style update path, receive fresh captured values after rerenders, and be released on unmount.

### Why every existing mechanism falls short

| Mechanism | Why it is not enough |
| --- | --- |
| Package-owned callable registry (`packages/motion/src/utils/registeredFunction.ts`, used by `mini/core/easings.ts`) | Registers a **fixed set of package functions at bundle init** under string handles. Consumer closures, captured values, per-instance identity, and unmount release are all unsupported. This is the workaround the Motion mini easings use today, and it caps the API surface at a hardcoded easing list. |
| Nested worklet capture (`transformWorkletInner` already binds nested `_wkltId` descriptors) | Works only for a ctx that travels whole through one serialization. A long-lived main-thread consumer (an animation loop, a style effect) retains the ctx **from the render that delivered it**; later rerenders never refresh its captured values. There is no unmount release, and nested/cross-module descriptors have hydrated as non-callable plain objects on Lynx for Web. |
| Plain (non-directive) functions in captures | `JSON.stringify` silently drops function-valued properties from `_c`; the main thread sees `undefined` with no diagnostic. The DEV report in `workletEvent.ts` only covers the top-level prop position. |
| `runOnBackground` handles (`_jsFn`) | Asynchronous by design. Easing and transform composition are synchronous per-frame calls. |
| `MainThreadObject` (#3446 / #3477) | Payload is a **one-shot initialization** realized into one stable object. A callable needs the opposite: per-render re-capture behind a stable identity. |
| `MainThreadRef` | A mutable cell whose contents are written **by main-thread code**. Here the source of truth (the closure and its captures) lives on the background thread and must be pushed down. |

### Position in the MainThreadObject algebra

#3446 separates representation, ownership, and stability. `MainThreadCallable` fills the row that was missing:

| Example | Representation | Lifecycle authority | Binding |
| --- | --- | --- | --- |
| MotionValue (MainThreadObject) | pure JS object | factory / handle runtime | stable object, one-shot payload |
| MutableCell (MainThreadRef) | pure JS cell | worklet runtime | mutable contents, MTS-written |
| MainThread.Element | native-backed wrapper | renderer / native tree | stable wrapper |
| **MainThreadCallable** | **pure JS function** | **React runtime (hook)** | **stable identity, BTS-rebindable implementation** |

A callable is conceptually "a MainThreadObject whose realized object is a function", but its defining property is the **rebinding**: the realized function's identity is stable while the worklet ctx behind it is replaced on every committed render. That is `MainThreadBinding` semantics applied to code instead of data, with the binding written from the background thread.

## Proposed model

### 1. MainThreadCallable

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
function useMainThreadCallable<F extends (...args: any[]) => any>(
  fn: F | null | undefined,
): MainThreadCallable<F> | null;

/** Deep transport: every main-thread function nested in `value` becomes a handle. */
function useMainThreadCallables<T>(value: T): MainThreadCallableTree<T>;
```

- `fn` and nested functions must be main-thread functions (`'main thread'` directive). In DEV, a plain function produces a diagnostic naming the offending path (mirroring `reportInvalidWorkletValue`); in production it is passed through untouched.
- `useMainThreadCallables` walks plain objects and arrays, keys each discovered function **by its structural path** (`ease.0`, `ease.1`, …), and reuses the same handle id for the same path across rerenders. Slots that disappear are released on commit; unmount releases all slots. The returned value is a structural clone with functions replaced by handles; everything else (including `MainThreadRef`s and already-wrapped handles) passes through.

Adapter usage for the two blockers:

```ts
// #37 — easing arrays: forward the whole transition unchanged.
const transition = useMainThreadCallables(props.transition);
runOnMainThread(updateMotionStyles)(target, transition /* , ... */);
// on the main thread, transition.ease[0] is a real function

// #55 — transformTemplate: a single lifecycle-managed callable.
const transformTemplate = useMainThreadCallable(props.transformTemplate);
// captured by the style-update worklet; hydrates to a stable function
```

### 3. Lifecycle

```text
render:   hook allocates id (once) ── stages [id, ctx] into the callable patch pool
commit:   pool flushed with the ref-init-value flush (callLepusMethod) → MTS registry updated
rerender: fresh ctx (fresh captures) staged; last write per id wins within a commit
unmount:  effect cleanup stages [id, null]; flushed in the same ordered channel
GC:       destruction observer dispatches releaseMainThreadCallable (fallback for
          handles that never reached a cleanup, mirroring MainThreadRef)
```

- Updates and releases travel in **one ordered channel** (a new `LifecycleConstant.updateMTCallableCtx`), but at different points of the commit: **updates flush before the commit's patch update** so main-thread tasks scheduled by the same commit observe fresh ctxs, while **releases flush after it** so those same tasks can still call the callable. This split is load-bearing: an unmounting Motion component stops its animations through a `runOnMainThread` task in the unmounting commit, and stopping an animation samples one final frame through the consumer easing — releasing before the patch would tear the easing out from under that final sample.
- Every staged ctx passes through `onPostWorkletCtx` first, so nested `runOnBackground` handles get their `_execId` and background-function lifecycle exactly like event ctxs. The main-thread registry retains each installed ctx with the `JsFunctionLifecycleManager`, so replaced ctxs release their background exec contexts through the existing `FinalizationRegistry` batching.
- Redundant pushes are skipped when the serialized ctx is unchanged **and** the ctx carries no `_jsFn` handles (background function identities are not observable in JSON, so ctxs with `_jsFn` always re-push).

### 4. First screen

Mirrors first-screen `MainThreadRef` behavior: a hook running during main-thread first-screen rendering allocates a **negative id** and registers the ctx directly into a first-screen registry (the worklet runtime is already loaded by the function's own module registration). Events fired before hydration resolve through it. Background hydration re-renders with positive ids and pushes real ctx patches; the first-screen registry is cleared when hydration finishes, alongside `clearFirstScreenWorkletRefMap`.

### 5. Errors

- Calling a released or never-registered callable throws a descriptive error in DEV and is a no-op returning `undefined` in production.
- Creating handles when MTS is unavailable (SDK < 2.14) reports the same error as `onPostWorkletCtx`.
- Handles are inert on the background thread: they expose no callable surface there, like `MainThreadRef.current` access guards.

## Runtime requirements

- One new discriminant branch (`'_wcid' in value`) in `transformWorkletInner`, dispatched **before** the generic recursion continues, alongside the existing `_wvid` / `_wkltId` / `_jsFnId` / `elementRefptr` branches.
- A `_callableImpl` registry on `lynxWorkletImpl` with: `updateCallableCtxChanges(patch)`, `getFromCallableMap(handle)`, `removeCallable(id)`, first-screen map + `clearFirstScreenCallableMap()`.
- A new `WorkletEvents.releaseMainThreadCallable` event (callable ids and ref ids are separate counters; the release channels must not collide).
- Background side: a patch pool (`Map<id, ctx | null>`, last write wins), flushed at the existing ref-init-value flush points; hook implementations on `useMemo` + effect cleanup; destruction-observer fallback.
- Lazy-runtime export shims (`runtime/lazy/*.js`) and api-extractor report updates for the new public surface.
- No compiler changes for v1: handles ride inside plain objects/params, and `toJSON` produces the wire form. (See open questions for the capture-narrowing interaction.)

## Non-goals

- Transporting **non-directive** plain closures: code does not cross threads; only main-thread functions (compiled into the main-thread bundle) are addressable. Compiler-assisted directive inference for designated props is future work.
- RPC, promises, or async invocation — a callable call is a synchronous local call.
- Making callable results or captured mutations observable from background React.
- Replacing `main-thread:bind*` event props, `MainThreadRef`, or `MainThreadObject`.
- Cross-thread state coherence beyond "latest committed captures win".

## Verification plan (Motion unblock)

1. Runtime unit tests: registry update/release, stable wrapper identity across ctx updates, first-screen negative ids, nested-handle hydration in captures and params, `_jsFn` lifecycle through replaced ctxs.
2. Integration tests through `@lynx-js/react/testing-library` (dual-runtime): rerender re-captures, unmount release, deep transport of a transition-shaped object with a nested function array.
3. Motion-shaped verification in `packages/motion`:
   - an easing-array test where two consumer easings with captured values drive `mini`'s `animate` per segment (issue #37's acceptance shape);
   - a `transformTemplate` test producing `translateY(30px) translateX(30px)` from the main-thread style path (issue #55's acceptance string), across rerender (fresh captures) and unmount (release).
4. Declarative adapter proof on the #3509 stack: forward `transition` through `useMainThreadCallables` and expose `transformTemplate` via `useMainThreadCallable` (composing with upstream `buildTransform` / `transformValue` from `motion-dom`), running the conformance cases from Huxpro/motion#37 / #55:
   - `transitions/easing-function-array`: both segment callbacks execute, and the element settles at `translateX(42px)`;
   - `targets/transform-template`: the element renders `translateY(30px) translateX(30px)`.

   Both pass on a branch merging this implementation with #3509 plus an ~50-line adapter wiring (three `useMainThreadCallables` wraps, one `useMainThreadCallable`, and a template-composed `transform` derived value in the style effect).

## Open questions

1. Should `useMainThreadCallables` be the only deep API, or should the runtime hydrate nested raw worklet descriptors generically (registry-less) as well? (This RFC keeps generic hydration out of scope: without a registry there is no rerender update or release story.)
2. Capture narrowing: when a handle is captured via a member expression, the transform's compact-fallback narrowing must preserve it. #3477 introduces `captureMainThreadObject(x) ?? fallback`; the callable brand should join the same guard rather than adding a second one.
3. Protocol pairing between transform output, `@lynx-js/react` runtime, and lazy bundles — same boundary as #3446 open question 5; v1 assumes same-version pairing.
4. Should the realized wrapper identity survive release-and-recreate of the same slot (currently: no; a new id means a new wrapper)?
5. Directive inference: should the compiler treat functions in designated prop positions (e.g. a library-declared `transition` shape) as implicit main-thread functions so upstream-Motion example code runs unchanged?
