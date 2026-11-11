---
title: Import attributes
group: Documents
---

# Import Attributes

## `runtime: 'shared'`

Explicitly declare that certain modules can be shared between the main thread and the background thread via **Import Attributes**.

This is strictly for use with **[Main Thread Functions](https://lynxjs.org/react/main-thread-script)**. For details, please refer to [Cross-thread Shared Modules](https://lynxjs.org/react/main-thread-script#cross-thread-shared-modules).

The `runtime` attribute in the `with` clause of an `import` statement specifies the runtime behavior of the imported module. When set to `'shared'`, the module is marked as shared across threads.

### Syntax

```javascript
import { ... } from "module-name" with { runtime: 'shared' };
import "module-name" with { runtime: 'shared' };
```

### Parameters

- `runtime`: `'shared'`

### Examples

```javascript
import { func } from './utils.js' with { runtime: 'shared' };

function mainThreadFunction() {
  'main thread';
  func(); // Can be called within a main thread function
}
```

### Precautions

1. **Static Analysis**: This feature relies on compile-time static analysis. Only identifiers imported directly via `import ... with { runtime: 'shared' }` are recognized as shared.
2. **Identifier Passing**: If a shared imported function is assigned to another variable, the new variable loses the shared characteristic and cannot be called directly in a main thread function (unless wrapped again as a main thread function).
3. **Main Thread Limitations**: Although code in shared modules can run on the main thread, it does not automatically gain the main thread context (e.g., cannot directly use `MainThreadRef`) unless explicitly marked with `'main thread'`.
4. **State Isolation**: Variables and states in a Shared Module are **completely isolated** between the two threads, each possessing independent instances. Modifying state in one thread does not affect the other.
