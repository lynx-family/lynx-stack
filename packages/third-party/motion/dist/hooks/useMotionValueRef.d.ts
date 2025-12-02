import type { MotionValue } from 'motion-dom';
import type { MainThreadRef } from '@lynx-js/react';
export declare function useMotionValueRef<T>(value: T): MainThreadRef<MotionValue<T>>;
