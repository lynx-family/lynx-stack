---
'@lynx-js/genui': patch
---

Allow `A2UI` to receive `messageStore={null}` and render nothing without calling `renderEmpty`. Passing a store afterward starts a new rendering session and processes buffered and subsequent messages. Switching back to null unsubscribes from the store and clears the rendered surface. `renderEmpty` applies only to a non-null store with no surface ready yet.
