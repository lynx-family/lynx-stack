# @lynx-js/motion

A powerful animation library for Lynx, ported from [Motion for React (framer-motion)](https://motion.dev/). It brings declarative animations and gesture handling to the Lynx ecosystem.

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

For more comprehensive examples, please refer to the [examples/motion](../../examples/motion) directory in this repository.

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
