# Lynx Gesture Runtime

`@lynx-js/gesture-runtime` provides typed gesture primitives and simple composition utilities for Lynx.

## Install

- `pnpm add @lynx-js/gesture-runtime @lynx-js/react`

## Usage

```tsx
import { useGesture, PanGesture } from '@lynx-js/gesture-runtime';

export default function Example() {
  const pan = useGesture(PanGesture).onUpdate((event, stateManager) => {
    'main thread';
    stateManager.active();
  });
  return <view main-thread:gesture={pan}></view>;
}
```
