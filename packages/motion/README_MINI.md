# Motion Mini

Motion Mini is a lightweight, main-thread-optimized version of the Motion library for Lynx. It provides a core subset of animation capabilities designed for high performance and low bundle size.

## Features

- **Main Thread Animation**: All animations run directly on the main thread, bypassing the JS thread for smoother performance.
- **Small Bundle Size**: Includes only essential animation logic (Spring, Tween, MotionValues).
- **Core API Compatibility**: API is similar to the standard `motion` package, making it easy to learn.

## Limits & Differences

| Feature               | Standard Motion                                   | Motion Mini               |
| :-------------------- | :------------------------------------------------ | :------------------------ |
| **Animation Targets** | Numbers, Strings (colors, units), Objects, Arrays | **Numbers only** (mostly) |
| **Keyframes**         | Full support                                      | Limited support           |
| **Layout Animations** | Supported                                         | Not supported             |
| **Gesture Handlers**  | Full suite (drag, pan, hover, etc.)               | Not included              |

> **Note**: `MotionValue` in Mini primarily works with numbers. If you need to animate complex strings or colors, consider using the full `motion` package or handle interpolation manually.

## API Reference

### `createMotionValue<T>(initial: T)`

Creates a `MotionValue` that tracks the state and velocity of a value.

```typescript
const mv = createMotionValue(0);
mv.set(100);
console.log(mv.get()); // 100
```

### `animate(value, target, options)`

Animates a `MotionValue` or a number to a target value.

- **value**: `MotionValue` or `number` or `(v) => void` setter.
- **target**: Target value (number).
- **options**: Animation configuration (`duration`, `ease`, `type`, `stiffness`, etc.).

```typescript
animate(mv, 100, {
  type: 'spring',
  stiffness: 300,
  damping: 30,
});
```

### `useMotionValueRef(initial)`

React hook to create a `MotionValue` that persists across renders and is safe to use on the main thread.

```typescript
const mvRef = useMotionValueRef(0);
```

### `spring(options)`

Low-level spring animation generator compatible with `motion-dom`.

### Easings

Includes standard easings: `linear`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `circInOut`, `backIn`, `backOut`, `backInOut`, `anticipate`.
