# Lynx DOM Shim — Diagnostic Code Catalog

> Stable codes the runtime emits via `console.warn` (divergences) or
> `throw new DOMShim*Error` (invariant violations and L4 throws).
>
> The LLM agent loop (US-461..US-468) parses these codes to repair its
> output between rounds. New codes MUST be added here at the same time
> they're added to the runtime.

## Envelope

```json
{
  "code": "shim:L3b/script-skipped",
  "tier": 3,
  "subTier": "b",
  "surface": "Element.innerHTML",
  "message": "<script> tags are skipped (no execution).",
  "suggestion": "Use Lynx's module loader to load JS dynamically.",
  "position": { "file": "user-code.ts", "line": 42, "column": 12 },
  "elementUid": 7,
  "elementTag": "view"
}
```

`position` is best-effort (parsed from `Error().stack`).
`elementUid` / `elementTag` are present when the diagnostic is bound to
an element.

## L1 (ReadOnly tier)

| Code                            | Surface                         | Notes                                                                                                                                                  |
| ------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shim:L1/geometry-cached-stale` | `Element.getBoundingClientRect` | First call returns zero rect, scheduled async measurement fills the cache; subsequent calls hit cache until a mutation invalidates. OQ-S.4 resolution. |
| `shim:L1/dataset-readonly`      | `Element.dataset.set/delete`    | L1 view's dataset proxy throws on write/delete. Use L2 dataset surface.                                                                                |

## L2 (SafeWrite tier)

| Code                                       | Surface                          | Notes                                                                                                                                                        |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shim:L2/attribute-removal-jsside-only`    | `Element.removeAttribute`        | Engine has no `__RemoveAttribute`; Shim calls `__SetAttribute(name, undefined)` + sentinel in cache. JS-visible "absent"; engine may keep an undefined slot. |
| `shim:L2/classlist-jsside-cache`           | `Element.classList.*`            | Cache is the source of truth for classList read-back. External mutations are NOT observed until `classList.refresh()`.                                       |
| `shim:L2/style-jsside-cache-authoritative` | `Element.style.getPropertyValue` | Lynx PAPI's `__GetInlineStyle` requires a numeric propertyId; the Shim cache is authoritative for string-keyed read-back.                                    |
| `shim:L2/no-important-propagation`         | `Element.style.setProperty`      | `!important` priority is recorded in `cache.stylePriorities` but NOT propagated to PAPI. OQ-S.3 resolution.                                                  |

## L3a (Events tier)

| Code                             | Surface                        | Notes                                                                                                                                      |
| -------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `shim:L3a/capture-synthetic`     | `EventTarget.addEventListener` | Capture phase is JS-simulated. Engine-native capture events that bypass the Shim trampoline are not dispatched at capture.                 |
| `shim:L3a/passive-unenforced`    | `EventTarget.addEventListener` | `passive: true` is honored at the JS layer (preventDefault is a no-op) but not communicated to the engine.                                 |
| `shim:L3a/event-payload-mapping` | `EventTarget.addEventListener` | Lynx event payload fields map to DOM Event fields via a static table; unmapped fields appear under `event.detail.lynxRaw`.                 |
| `shim:L3a/dual-thread-affinity`  | `EventTarget.addEventListener` | In dual-thread Lynx, handler thread affinity is implicit. Crossing threads requires Lynx `'main thread'` / `'background only'` directives. |
| `shim:L3a/listener-threw`        | `EventTarget.dispatch`         | A user listener threw — captured and console.warn'd; dispatch continues for remaining listeners.                                           |

## L3b (UnsafeWrite tier)

| Code                                  | Surface                      | Notes                                                                                                                          |
| ------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `shim:L3b/script-skipped`             | `Element.innerHTML`          | `<script>` elements parsed but never executed.                                                                                 |
| `shim:L3b/inline-event-attrs-ignored` | `Element.innerHTML`          | `on*` attributes silently dropped for security. Use `addEventListener`.                                                        |
| `shim:L3b/img-no-load-event`          | `Element.innerHTML`          | `<img src>` set; no `load` / `error` event fires through the Shim.                                                             |
| `shim:L3b/listeners-lost`             | `Element.innerHTML`          | Pre-existing listeners on the cleared subtree are silently dropped.                                                            |
| `shim:L3b/css-style-tag-dropped`      | `Element.innerHTML`          | `<style>` content discarded. Inline `style="..."` honored.                                                                     |
| `shim:L3b/external-css-skipped`       | `Element.innerHTML`          | `<link rel="stylesheet">` skipped.                                                                                             |
| `shim:L3b/serialization-canonical`    | `Element.innerHTML getter`   | Output is canonical (sorted attrs, double-quoted, void-element self-close). Input ≠ output after round-trip.                   |
| `shim:L3b/text-emulated`              | `Element.textContent setter` | Spec Text-node semantics emulated via Lynx `__CreateRawText`. Auto-wrapping under non-text-host elements may differ from spec. |
| `shim:L3b/cssText-reorder`            | `style.cssText setter`       | Declarations are parsed and re-applied; the resulting order is the parser's, not the input's.                                  |

## Document-level

| Code                   | Surface                | Notes                                                                                                    |
| ---------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `shim:doc/body-choice` | `document.body getter` | Logs the resolution choice (first child of page vs page itself) on first access. Pin via `setBody(ref)`. |

## L4 (Unsupported tier — throws, never warns)

These are NEVER warnings; they throw `DOMShimUnsupportedError`.

| Code                           | Surface                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| `L4/shadow-dom`                | `Element.attachShadow`                                                     |
| `L4/custom-elements`           | `customElements.define`                                                    |
| `L4/cookies`                   | `document.cookie`                                                          |
| `L4/web-storage`               | `localStorage`, `sessionStorage`                                           |
| `L4/location-navigation`       | `location.assign`, `location.href =`                                       |
| `L4/history`                   | `history.pushState`, `history.replaceState`                                |
| `L4/mutation-observer`         | `new MutationObserver`                                                     |
| `L4/intersection-observer`     | `new IntersectionObserver`                                                 |
| `L4/resize-observer`           | `new ResizeObserver`                                                       |
| `L4/computed-style-non-inline` | `getComputedStyle().getPropertyValue` for non-inline props                 |
| `L4/cssom-construct`           | `new CSSStyleSheet`                                                        |
| `L4/cssom-collection`          | `document.styleSheets`                                                     |
| `L4/range-selection`           | `new Range`, `Selection`, `getSelection`                                   |
| `L4/blocking-ui`               | `window.open`, `alert`, `confirm`, `prompt`                                |
| `L4/xhr`                       | `XMLHttpRequest`                                                           |
| `L4/innerText-layout`          | `Element.innerText`                                                        |
| `L4/synthetic-dispatch`        | `EventTarget.dispatchEvent` on synthetic events                            |
| `L4/fullscreen`                | `Element.requestFullscreen`                                                |
| `L4/pointer-lock`              | `Element.requestPointerLock`                                               |
| `L4/pointer-events`            | `addEventListener('pointerdown'`, etc) on platforms without pointer events |
| `L4/drag-events`               | Drag event types                                                           |
| `L4/tier-violation`            | Tier-narrowed access of higher-tier method (US-448 strict variant)         |

## Invariant violations (DOMShimInvariantError)

| Code            | Surface                                       |
| --------------- | --------------------------------------------- |
| `NotFoundError` | `Element.removeChild`, `Element.replaceChild` |
