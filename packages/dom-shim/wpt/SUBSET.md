# WPT Subset for `@lynx-js/dom-shim`

> Cherry-picked from
> [web-platform-tests/wpt](https://github.com/web-platform-tests/wpt)
> at commit pinned in `subset.json` (`commitSha`). See `Shim_Design.md`
> §11 and `Shim_Implementation_PRD.md` US-461.

## Goals

- Verify the Shim's DOM surface against a subset of the official WPT
  spec tests.
- Drive the M7 conformance gate `WPT_SUBSET_70PCT_PASS` (≥70% of subset
  tests pass).
- Stay under 500 tests total so CI completes in <5 min.

## What's in scope

We include only test files whose category the Shim attempts to support.
The categories below correspond directly to Shim_Design §11 "Conformance
Goals (no engine work)":

### `dom/nodes/` (read-side)

Target pass-rate ceiling: ~90%.

Selected tests:

- `Node-tagName.html`
- `Node-nodeName.html`
- `Node-nodeType.html`
- `Node-nodeValue.html`
- `Node-parentNode.html`
- `Node-childNodes.html`
- `Node-firstChild.html`
- `Node-lastChild.html`
- `Node-nextSibling.html`
- `Node-previousSibling.html`
- `Node-hasChildNodes.html`
- `Node-isEqualNode.html`
- `Node-isSameNode.html`
- `Node-isConnected.html`
- `Node-contains.html`
- `Node-getRootNode.html`
- `Node-compareDocumentPosition.html`
- `Element-tagName.html`
- `Element-localName.html`
- `Element-id.html`
- `Element-children.html`
- `Element-firstElementChild.html`
- `Element-lastElementChild.html`
- `Element-childElementCount.html`
- `Element-nextElementSibling.html`
- `Element-previousElementSibling.html`

### `dom/nodes/` (write-side)

Target pass-rate ceiling: ~70%.

Selected tests:

- `Element-setAttribute.html`
- `Element-removeAttribute.html`
- `Element-toggleAttribute.html`
- `Element-classList.html`
- `Element-className.html`
- `Element-appendChild.html`
- `Element-removeChild.html`
- `Element-insertBefore.html`
- `Element-replaceChild.html`
- `Element-cloneNode.html`
- `ChildNode-remove.html`
- `ChildNode-replaceWith.html`
- `ChildNode-before.html`
- `ChildNode-after.html`
- `ParentNode-append.html`
- `ParentNode-prepend.html`

### `dom/events/`

Target pass-rate ceiling: ~50%.

Selected tests:

- `EventTarget-addEventListener.html`
- `EventTarget-removeEventListener.html`
- `Event-dispatchEvent.html`
- `Event-preventDefault.html`
- `Event-stopPropagation.html`
- `Event-stopImmediatePropagation.html`
- `Event-capture-bubble.html`
- `Event-target-currentTarget.html`
- `Event-once-option.html`
- `Event-signal-option.html`

### `dom/lists/` (DOMTokenList)

Target pass-rate ceiling: ~70%.

Selected tests:

- `DOMTokenList-add.html`
- `DOMTokenList-remove.html`
- `DOMTokenList-toggle.html`
- `DOMTokenList-replace.html`
- `DOMTokenList-contains.html`
- `DOMTokenList-iteration.html`
- `DOMTokenList-length-item.html`

### `dom/abort/`

Target pass-rate ceiling: ~80%.

Selected tests:

- `abort-signal-addEventListener.html`
- `abort-signal-once-listener.html`

### `html/dom/dynamic-markup-insertion/innerhtml/`

Target pass-rate ceiling: ~30%.

Selected tests:

- `Element-innerHTML-basic.html`
- `Element-innerHTML-getter.html`
- `Element-innerHTML-script-skip.html`
- `Element-outerHTML.html`
- `Element-insertAdjacentHTML.html`
- `Element-insertAdjacentText.html`

### `html/dom/elements/global-attributes/`

Target pass-rate ceiling: ~60%.

Selected tests:

- `dataset.html`
- `data-attribute-roundtrip.html`
- `class-attribute.html`
- `id-attribute.html`
- `style-attribute.html`

### `css/cssom/`

Target pass-rate ceiling: ~70% (setProperty/getPropertyValue);
~5% (getComputedStyle for non-inline).

Selected tests:

- `cssom-setProperty.html`
- `cssom-getPropertyValue.html`
- `cssom-removeProperty.html`
- `cssom-cssText.html`
- `cssom-cssText-set.html`
- `cssom-camelCase-accessor.html`
- `cssom-css-custom-property.html`

### `selectors/`

Target pass-rate ceiling: ~40% (depends on PAPI's selector engine).

Selected tests:

- `querySelector-id.html`
- `querySelector-class.html`
- `querySelector-tag.html`
- `querySelector-compound.html`
- `querySelectorAll-multiple.html`
- `matches-basic.html`
- `closest-walks-ancestors.html`

## What's excluded

Per Shim_Design §11, these directories are NOT in scope (would yield ~0%
pass without engine PAPI additions):

- `dom/ranges/` — Range API is L4.
- `dom/traversal/` — TreeWalker / NodeIterator are L4 v0.
- `pointerevents/`, `touch-events/`, `uievents/` (drag / keyboard) —
  Lynx doesn't expose comparable event types on all platforms.
- `webcomponents/` — Shadow DOM and customElements are L4.
- `streams/`, `fetch/`, `xhr/` — networking not in Shim scope.
- `html/semantics/forms/` — Form submission is L4.
- `wai-aria/` — Accessibility tree is beyond the Shim.

## Total

86 tests across the 9 categories. Well under the 500-test budget.

## How tests are run

US-462 implements `wpt/run.ts` which loads each test file (or
testharness emulation) and runs it against the Shim. Results are
written to `wpt/baseline.json` per US-463 and gate CI per US-464.
