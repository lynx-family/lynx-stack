# @lynx-js/motion

A powerful animation library for Lynx, ported from [Motion for React (framer-motion)](https://motion.dev/). It brings declarative animations and gesture handling to the Lynx ecosystem.

## Installation

```bash
npm install @lynx-js/motion
```

## Usage

### Declarative animation

Use the built-in Motion components to animate Lynx elements from props. Motion
applies `initial` during the first render and animates whenever `animate`
changes.

```tsx
import { motion, useMotionValue } from '@lynx-js/motion';

export function Card({ selected }: { selected: boolean }) {
  const scale = useMotionValue(1);

  return (
    <motion.view
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: selected ? 100 : 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      style={{ scale }}
    />
  );
}
```

`motion.view`, `motion.text`, and `motion.image` are included. Use
`motion.create(Component)` for components that forward `style`, host props, and
`main-thread:ref` to a Lynx element.

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

### Motion values

`useMotionValue` creates an opaque background-thread handle that becomes a real
Motion `MotionValue` when captured by a main-thread function. Its methods must
only be called from the main thread.

```tsx
import { useMotionValue } from '@lynx-js/motion';

export function Counter() {
  const count = useMotionValue(0);

  function increment() {
    'main thread';
    count.set(count.get() + 1);
  }

  return <view main-thread:bindtap={increment} />;
}
```

For more comprehensive examples, please refer to the [examples/motion](https://github.com/lynx-family/lynx-stack/tree/main/examples/motion) directory in this repository.

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
| **Layout Animations** | Supported                                         | Not supported             |
| **Gesture Handlers**  | Full suite (drag, pan, hover, etc.)               | Not included              |

> **Note**: `MotionValue` in Mini primarily works with numbers.

### CLI Reference for Mini

#### `createMotionValue<T>(initial: T)`

Creates a `MotionValue` that tracks state and velocity.

```typescript
const mv = createMotionValue(0);
mv.set(100);
```

#### `animate(value, target, options)`

Animates a `MotionValue` or number.

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
