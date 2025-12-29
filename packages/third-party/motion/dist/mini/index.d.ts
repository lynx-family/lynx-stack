import '../polyfill/shim.js';
import { spring as spring_ } from 'motion-dom';
import type { MainThreadRef } from '@lynx-js/react';
export declare function spring(...args: Parameters<typeof spring_>): ReturnType<typeof spring_>;
export interface MotionValue<T> {
    get(): T;
    set(v: T): void;
    getVelocity(): number;
    jump(v: T): void;
    onChange(callback: (v: T) => void): () => void;
    on(event: 'change', callback: (v: T) => void): () => void;
    /**
     * Internal method to update velocity, usually called by the animation loop.
     */
    updateVelocity(v: number): void;
    stop(): void;
}
export declare function createMotionValue<T>(initial: T): MotionValue<T>;
export interface MotionValueEventCallbacks<V> {
    change: (v: V) => void;
}
export type Easing = (t: number) => number;
export interface AnimationOptions {
    type?: 'spring' | 'keyframes' | 'decay';
    stiffness?: number;
    damping?: number;
    mass?: number;
    duration?: number;
    ease?: Easing;
    from?: number;
    to?: number;
    velocity?: number;
    onUpdate?: (v: number) => void;
    onComplete?: () => void;
}
export declare const linear: Easing;
export declare const easeIn: Easing;
export declare const easeOut: Easing;
export declare const easeInOut: Easing;
export declare const circIn: Easing;
export declare const circOut: Easing;
export declare const circInOut: Easing;
export declare const backIn: Easing;
export declare const backOut: Easing;
export declare const backInOut: Easing;
export declare const anticipate: Easing;
export declare function animate(value: MotionValue<number> | number | ((v: number) => void), target: number, options?: AnimationOptions): {
    stop: () => void;
    then: (cb: () => void) => Promise<void>;
    onFinish: () => void;
};
export declare function useMotionValueRef<T>(value: T): MainThreadRef<MotionValue<T>>;
export declare function useMotionValueRefEvent<V, EventName extends keyof MotionValueEventCallbacks<V>>(valueRef: MainThreadRef<MotionValue<V>>, event: 'change', callback: MotionValueEventCallbacks<V>[EventName]): void;
