---
'@lynx-js/genui': patch
---

Allow `A2UI` to receive `messageStore={null}` and render its empty state. Passing a store afterward starts a new rendering session and processes buffered and subsequent messages. Switching back to null unsubscribes from the store and clears the rendered surface.
