---
"@lynx-js/genui": minor
---

Apply every `MessageStore` mutation in the order it was made, and stop repeating work that changes nothing.

- `push` no longer copies the buffer; `getSnapshot()` builds its frozen array on demand. `<A2UI>` applies messages when the store reports them instead of re-rendering its shell for every push.
- A rejected `replace` is reported once. Its appended tail is still ignored until a corrected `replace` or a `clear`, but later pushes no longer re-evaluate the rejected snapshot or resend its errors.
- Swapping `messageStore` for another non-null store reconciles to the new store's contents, as `replace` does, instead of skipping its first messages.
- A component definition or data value identical to the current one is a no-op. Template instances are rebuilt only when their items or their template change, and instances whose item is gone are released.
- Components may arrive in any order across messages: a parent renders a child once both exist. Nested templates expand against each item.
- A `@call` returning a new non-JSON object on every call no longer causes a render loop, and a failing expression is reported once per agent update instead of on every evaluation.
- A surface that names no catalog uses the catalog passed to `<A2UI>`; a surface that names an unregistered catalog reports `VALIDATION_FAILED` once.
- A malformed message is reported and skipped without discarding the messages after it.

`MessageProcessor.registerCatalog` accepts `{ default: true }`, and `NodeRendererProps` is exported.
