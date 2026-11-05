# @lynx-js/motion

A powerful animation library for Lynx, ported from [Motion for React (framer-motion)](https://motion.dev/). It brings imperative animations, motion values to the Lynx ecosystem.

## Installation

```bash
npm install @lynx-js/motion
```

## Usage

### Basic Animation

Currently, `@lynx-js/motion` supports imperative animations using the `animate` function on the main thread.

```tsx
import { animate } from '@lynx-js/motion';
import { useMainThreadRef, runOnMainThread, useEffect } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

export function MyComponent() {
  const elementRef = useMainThreadRef<MainThread.Element>(null);

  useEffect(() => {
    runOnMainThread(() => {
      'main thread';
      if (elementRef.current) {
        animate(
          elementRef.current,
          { opacity: 1, x: 100 },
          { duration: 1 },
        );
      }
    })();
  }, []);

  return (
    <view
      main-thread:ref={elementRef}
      style={{ opacity: 0, width: 100, height: 100, backgroundColor: 'blue' }}
    />
  );
}
```

For more comprehensive examples, please refer to the [examples/motion](https://github.com/lynx-family/lynx-stack/tree/main/examples/motion) directory in this repository.

## Runtime compatibility

The published ESM includes a compiled copy of the upstream Motion APIs used by
this adapter. A native Rslib plugin uses Rspack's `ProvidePlugin` to import
private Lynx implementations, including `queueMicrotask`, `performance`, DOM
constructors, selector queries, and computed styles. It also handles static
`globalThis` property accesses and uses `DefinePlugin` for matching `typeof`
guards. Importing Motion does not install these polyfills
on the host globals or replace the browser's DOM constructors.

No consumer Babel or Rspeedy plugin is required. The main-thread adapter and its
shared import boundaries are preserved, and Mini includes only its own upstream
spring and easing dependencies. The private runtime covers the APIs used by this
adapter; adding another upstream browser feature requires a corresponding Lynx
implementation. Mini's existing callable registry for main-thread closures is
separate from these polyfills.

The upstream JavaScript and public type declarations are bundled into this
package. `motion`, `motion-dom`, and `motion-utils` are build-time development
dependencies; consumers do not need to install them. The build uses Rslib/Rspack
directly and has no Babel dependency.

The zero-configuration plugin uses a predefined Lynx runtime preset. It injects
only APIs referenced by the bundled code; timing-only code does not import the
DOM adapter, and typeof-only checks can be folded without an import. The preset
also includes requestAnimationFrame/cancelAnimationFrame with a paired timer
fallback. See [upstream compatibility](https://github.com/lynx-family/lynx-stack/blob/main/packages/motion/UPSTREAM_COMPATIBILITY.md)
for the supported preset, selection checks, version differences, and the isolated
Motion 14.6.0 probe. The production upstream versions remain pinned.

## Motion Mini (`@lynx-js/motion/mini`)

Motion Mini is a lightweight, **main-thread-optimized** version of the library. It provides a core subset of animation capabilities designed for high performance and low bundle size.

To use it, import from `@lynx-js/motion/mini`:

```tsx
import { animate, createMotionValue } from '@lynx-js/motion/mini';
```

### Key Features

- **Main Thread Animation**: Runs directly on the main thread, bypassing the JS thread for smoother performance.
- **Small Bundle Size**: Includes only essential animation logic.
- **Optimized for Numbers**: Primarily designed for animating numeric values.

### Differences from Standard Motion

| Feature               | Standard Motion                                   | Motion Mini               |
| :-------------------- | :------------------------------------------------ | :------------------------ |
| **Animation Targets** | Numbers, Strings (colors, units), Objects, Arrays | **Numbers only** (mostly) |
| **Keyframes**         | Full support                                      | Limited support           |

> **Note**: `MotionValue` in Mini primarily works with numbers.

### API Reference for Mini

#### `createMotionValue<T>(initial: T)`

Creates a `MotionValue` that tracks state and velocity.

```typescript
const mv = createMotionValue(0);
mv.set(100);
```

#### `animate(value, target, options)`

Animates a `MotionValue`, a starting number, or a setter callback `(v: number) => void` to a numeric `target`.

```typescript
animate(mv, 100, {
  type: 'spring',
  stiffness: 300,
  damping: 30,
});
```

## License & Attribution

This package is licensed under the Apache-2.0 License.

It adapts code from [Motion for React (framer-motion)](https://motion.dev/), [motion-dom](https://github.com/motiondivision/motion/tree/main/packages/motion-dom), and [motion-utils](https://github.com/motiondivision/motion/tree/main/packages/motion-utils) which are licensed under the MIT License.

See [LICENSE](./LICENSE), [NOTICE](./NOTICE) for details.

## Feature validation

The Motion example has three entries in its normal build configuration:

- `main`: demonstration cases.
- `mini`: a standalone Mini demonstration.
- `features`: verification suites with assertions and individual results.

Build them with the rest of the repository:

```sh
pnpm turbo build
```

Open `features.lynx.bundle` or `features.web.bundle` from `examples/motion/dist`, select
**Full features** or **Mini features**, then select **Run full cases** or
**Run mini cases**. The standalone `mini` entry remains available for checking a
Mini-only consumer. The full suite covers keyframes, colors, element refs,
selectors, element arrays, stagger, sequences, playback controls, replacement,
repeat, derived values, style-effect cleanup, springs, and React hooks. Mini
covers every exported easing, tween and spring animation, callback and numeric
inputs, cancellation, replacement, destruction, subscriptions, serialization,
unsupported options, and hook-driven element updates.

`runtime-build.test.ts` additionally runs the compiled full and Mini JavaScript
in separate Node processes with absent or read-only host globals. These tests
supply a minimal simulated Lynx host while exercising the real compiled
animation code, callable registry, spring/easing implementations, and DOM adapter. They complement the native/Web pages;
they do not replace runtime validation.

Keep imports of Motion's exported worklet functions as ordinary imports. The
`runtime: 'shared'` attribute is appropriate for ordinary shared runtime helpers,
not for bypassing the hydration of worklet descriptors. The pre-existing compiler
limitation for a module referenced only through background-created worklets is
tracked separately in [#4244](https://github.com/lynx-family/lynx-stack/issues/4244).

The **Motion values** verification case starts a `springValue`/`mix` animation from an
effect. Until that compiler issue is fixed, it deliberately keeps the Motion
implementation module reachable during main-thread rendering with
`useMemo(() => springValue, [])`. This is a temporary example-only reference; it
does not call the worklet descriptor during render or add a dummy public export.
Select **Motion values** in the `features` entry; the box should grow from 100px
to 200px. The verification suites share an entry, so they do not independently
reproduce the compiler limitation in #4244 or establish Mini-only bundle size.
