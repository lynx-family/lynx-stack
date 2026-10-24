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
this adapter. An internal Rslib plugin replaces browser globals with imports of
private Lynx implementations, including `queueMicrotask`, `performance`, DOM
constructors, selector queries, and computed styles. It also handles static
`globalThis` property accesses. Importing Motion does not install these polyfills
on the host globals or replace the browser's DOM constructors.

No consumer Babel or Rspeedy plugin is required. The main-thread adapter and its
shared import boundaries are preserved, and Mini includes only its own upstream
spring and easing dependencies. The private runtime covers the APIs used by this
adapter; adding another upstream browser feature requires a corresponding Lynx
implementation. Mini's existing callable registry for main-thread closures is
separate from these polyfills.

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

The Motion example includes independent full and Mini feature pages. Each page
runs assertions against the public APIs in real main-thread worklets and displays
individual results. Build them separately from the repository root:

```sh
MOTION_FEATURE_VARIANT=full pnpm turbo build --env-mode=loose --filter @lynx-js/motion-examples --only --force -- --config rsbuild.features.config.js
MOTION_FEATURE_VARIANT=mini pnpm turbo build --env-mode=loose --filter @lynx-js/motion-examples --only --force -- --config rsbuild.features.config.js
```

After the required full repository build, open `features.lynx.bundle` or
`features.web.bundle` from `examples/motion/dist/features-full` or
`examples/motion/dist/features-mini`, then select **Run full cases** or
**Run mini cases**. The full suite covers keyframes, colors, element refs,
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
outside this build-format change.
