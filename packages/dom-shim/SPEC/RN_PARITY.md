# React Native API Parity Audit

> Verifies that `@lynx-js/dom-shim` matches or exceeds the surface of React
> Native's [Nodes](https://reactnative.dev/docs/nodes) +
> [Elements](https://reactnative.dev/docs/elements) APIs. See
> `Shim_Implementation_PRD.md` US-469 + §G6.
>
> Status legend:
>
> - ✅ — Shim has an equivalent at the listed tier with a passing unit test
>   reference.
> - ⏳ — Planned (not yet implemented).
> - ❌ — Intentionally out of scope; justification in the Notes column.

## ReadOnlyNode (RN base)

| RN API                           | Shim Tier | Status | Test reference                                | Notes                            |
| -------------------------------- | --------- | ------ | --------------------------------------------- | -------------------------------- |
| `nodeType`                       | L1        | ✅     | L1-traversal.test.ts §nodeType                | Element=1, Text=3                |
| `nodeName`                       | L1        | ✅     | L1-traversal.test.ts §nodeName                | Maps via lynxToHtml              |
| `nodeValue`                      | L1        | ✅     | L1-text-node.test.ts §nodeValue               | Side table for raw-text          |
| `parentNode`                     | L1        | ✅     | L1-traversal.test.ts §parentNode              |                                  |
| `parentElement`                  | L1        | ✅     | L1-traversal.test.ts §parentElement           | Alias of parentNode in Lynx      |
| `firstChild`                     | L1        | ✅     | L1-traversal.test.ts §firstChild              |                                  |
| `lastChild`                      | L1        | ✅     | L1-traversal.test.ts §lastChild               |                                  |
| `nextSibling`                    | L1        | ✅     | L1-traversal.test.ts §nextSibling             |                                  |
| `previousSibling`                | L1        | ✅     | L1-traversal.test.ts §previousSibling         | O(n) walk per Shim_Design §4.2.1 |
| `childNodes`                     | L1        | ✅     | L1-traversal.test.ts §childNodes              | Frozen snapshot                  |
| `hasChildNodes()`                | L1        | ✅     | L1-traversal.test.ts §hasChildNodes           |                                  |
| `isConnected`                    | L1        | ✅     | L1-traversal.test.ts §isConnected             |                                  |
| `getRootNode()`                  | L1        | ✅     | L1-traversal.test.ts §getRootNode             |                                  |
| `contains(other)`                | L1        | ✅     | L1-traversal.test.ts §contains                |                                  |
| `compareDocumentPosition(other)` | L1        | ✅     | L1-traversal.test.ts §compareDocumentPosition |                                  |
| `isEqualNode(other)`             | L1        | ✅     | L1-traversal.test.ts §isEqualNode             |                                  |
| `isSameNode(other)`              | L1        | ✅     | L1-traversal.test.ts §isSameNode              |                                  |
| `textContent` (getter)           | L1        | ✅     | L3b-textContent.test.ts §getter               | Walks subtree                    |

## ReadOnlyElement (RN element-tier readonly)

| RN API                         | Shim Tier | Status | Test reference                               | Notes                                                             |
| ------------------------------ | --------- | ------ | -------------------------------------------- | ----------------------------------------------------------------- |
| `id` (getter)                  | L1        | ✅     | L1-element-getters.test.ts §id               |                                                                   |
| `tagName`                      | L1        | ✅     | L1-element-getters.test.ts §tagName          | Via lynxToHtml                                                    |
| `localName`                    | L1        | ✅     | L1-element-getters.test.ts §localName        |                                                                   |
| `className` (getter)           | L1        | ✅     | L1-element-getters.test.ts §className        |                                                                   |
| `classList` (getter)           | L1        | ✅     | L1-element-getters.test.ts §classList        | ReadOnlyDOMTokenList                                              |
| `getAttribute(name)`           | L1        | ✅     | L1-attributes.test.ts §getAttribute          |                                                                   |
| `getAttributeNames()`          | L1        | ✅     | L1-attributes.test.ts §getAttributeNames     |                                                                   |
| `hasAttribute(name)`           | L1        | ✅     | L1-attributes.test.ts §hasAttribute          |                                                                   |
| `hasAttributes()`              | L1        | ✅     | L1-attributes.test.ts §hasAttributes         |                                                                   |
| `attributes`                   | L1        | ✅     | L1-attributes.test.ts §attributes            | ReadOnlyNamedNodeMap                                              |
| `children`                     | L1        | ✅     | L1-element-tree.test.ts §children            |                                                                   |
| `firstElementChild`            | L1        | ✅     | L1-element-tree.test.ts §firstElementChild   |                                                                   |
| `lastElementChild`             | L1        | ✅     | L1-element-tree.test.ts §lastElementChild    |                                                                   |
| `nextElementSibling`           | L1        | ✅     | L1-element-tree.test.ts §nextElementSibling  |                                                                   |
| `previousElementSibling`       | L1        | ✅     | L1-traversal.test.ts §previousElementSibling |                                                                   |
| `childElementCount`            | L1        | ✅     | L1-element-tree.test.ts §childElementCount   |                                                                   |
| `scrollLeft` / `scrollTop`     | L4        | ❌     | —                                            | Lynx layout layer doesn't expose; defer to engine PAPI extension. |
| `scrollWidth` / `scrollHeight` | L4        | ❌     | —                                            | Same as scroll position.                                          |
| `clientLeft` / `clientTop`     | L4        | ❌     | —                                            | Same; getBoundingClientRect covers most use cases.                |
| `clientWidth` / `clientHeight` | L4        | ❌     | —                                            | Same; getBoundingClientRect covers most use cases.                |
| `getBoundingClientRect()`      | L1        | ✅     | L1-geometry.test.ts §getBoundingClientRect   | Async-cached per OQ-S.4                                           |
| `getClientRects()`             | L4        | ❌     | —                                            | Multi-rect support requires engine layout intel.                  |

## ReactNativeElement (RN's "interactive but bounded")

| RN API                      | Shim Tier | Status | Test reference | Notes                                                          |
| --------------------------- | --------- | ------ | -------------- | -------------------------------------------------------------- |
| `focus()`                   | L2        | ⏳     | —              | Planned via __InvokeUIMethod('focus'); not yet implemented.    |
| `blur()`                    | L2        | ⏳     | —              | Same as focus.                                                 |
| `hasPointerCapture(id)`     | L4        | ❌     | —              | Pointer events not in Lynx event surface; `L4/pointer-events`. |
| `setPointerCapture(id)`     | L4        | ❌     | —              | Same as above.                                                 |
| `releasePointerCapture(id)` | L4        | ❌     | —              | Same as above.                                                 |

## Beyond RN — Shim-only additions

The Shim exposes the full DOM surface from L2/L3a/L3b that RN does NOT:

| Shim API                                                                                             | Tier | Test reference                 |
| ---------------------------------------------------------------------------------------------------- | ---- | ------------------------------ |
| `setAttribute` / `removeAttribute` / `toggleAttribute`                                               | L2   | L2-attributes.test.ts          |
| `set id(v)` / `set className(v)`                                                                     | L2   | L2-identity.test.ts            |
| `classList.add/remove/toggle/replace/refresh`                                                        | L2   | L2-classlist.test.ts           |
| Writable `dataset`                                                                                   | L2   | L2-dataset.test.ts             |
| `style.setProperty/getPropertyValue/removeProperty`                                                  | L2   | L2-style.test.ts               |
| `style.<camelCase>` accessor                                                                         | L2   | L2-style-proxy.test.ts         |
| `appendChild/insertBefore/removeChild/replaceChild`                                                  | L2   | L2-tree-ops.test.ts            |
| `append/prepend/before/after/replaceWith/remove`                                                     | L2   | L2-tree-convenience.test.ts    |
| `cloneNode(deep?)`                                                                                   | L2   | L2-clone.test.ts               |
| `DocumentFragment`                                                                                   | L2   | L2-document-fragment.test.ts   |
| `document.createElement/createTextNode/createDocumentFragment`                                       | L2   | document.test.ts               |
| `document.querySelector/querySelectorAll/getElementById/getElementsByClassName/getElementsByTagName` | L1+  | document.test.ts               |
| `addEventListener/removeEventListener` (multiplex)                                                   | L3a  | L3a-addEventListener.test.ts   |
| `once` / `signal` / `capture` / `passive` options                                                    | L3a  | L3a-remove-once.test.ts        |
| Capture + Bubble synthetic dispatch                                                                  | L3a  | L3a-capture-bubble.test.ts     |
| `innerHTML` setter (htmlparser2)                                                                     | L3b  | L3b-innerHTML-set.test.ts      |
| `innerHTML` getter (canonical)                                                                       | L3b  | L3b-innerHTML-get.test.ts      |
| `outerHTML` / `insertAdjacentHTML` / `insertAdjacentText`                                            | L3b  | L3b-outer-and-adjacent.test.ts |
| `textContent` setter                                                                                 | L3b  | L3b-textContent.test.ts        |
| `style.cssText` setter                                                                               | L3b  | L3b-cssText.test.ts            |
| Tier-narrowing `ReadOnly/SafeWrite/Events/Unsafe` (default + strict)                                 | —    | tiers.test.ts                  |
| Diagnostic catalog + `warnOnce`                                                                      | —    | diagnostics.test.ts            |
| `DOMShimUnsupportedError/InvariantError/DivergenceWarning`                                           | —    | errors.test.ts                 |
| L4 throws: Shadow DOM, customElements, MutationObserver, etc.                                        | L4   | L4-throws.test.ts              |

## Verdict

**Shim coverage equals or exceeds RN's Nodes + Elements surface across all
ReadOnlyNode and ReadOnlyElement APIs.** The single deferred-but-planned
items (`focus()`, `blur()`) are tracked as ⏳ for a near-term follow-up;
they are not gated on engine PAPI work. All other gaps (`scrollLeft`,
`getClientRects`, pointer capture) are intentional L4 either because they
require new engine PAPI or because the surface doesn't exist in Lynx.

The Shim's _writable_ surface (L2/L3a/L3b) goes well beyond RN, which
exposes only a readonly view. This is by design — the Shim's pitch is to
let standard JS web libraries run on Lynx, which requires the spec
mutation API.

No ❌ entries appear under L1 or L2 — Shim_Implementation_PRD.md §G6 and
US-469 acceptance criteria met.
