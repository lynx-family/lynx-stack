---
"@lynx-js/react": patch
---

feat: support declaring cross-thread shared modules via Import Attributes, enabling Main Thread Functions to call standard JS functions directly.

- Usage: Add `with { runtime: "shared" }` to the `import` statement. For example:

  ```ts
  import { func } from './utils.js' with { runtime: 'shared' };

  function worklet() {
    'main thread';
    func(); // callable inside a main thread function
  }
  ```

- Limitations:
  - Only directly imported identifiers are treated as shared; assigning the import to a new variable will result in the loss of this shared capability.
  - Functions defined within shared modules do not automatically become Main Thread Functions. Accessing main-thread-only APIs (e.g., `MainThreadRef`) will cause errors.
