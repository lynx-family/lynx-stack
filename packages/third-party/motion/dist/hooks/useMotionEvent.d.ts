import type { MotionValue, MotionValueEventCallbacks } from 'motion-dom';
import type { MainThreadRef } from '@lynx-js/react';
export declare function useMotionValueRefEvent<V, EventName extends keyof MotionValueEventCallbacks<V>>(valueRef: MainThreadRef<MotionValue<V>>, event: 'change', callback: MotionValueEventCallbacks<V>[EventName]): void;
