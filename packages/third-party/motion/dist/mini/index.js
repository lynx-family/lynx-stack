// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '../polyfill/shim.js';
import { spring as spring_ } from 'motion-dom';
import { runOnMainThread, useEffect, useMainThreadRef, useMemo, } from '@lynx-js/react';
import { runWorkletCtx } from '@lynx-js/react/worklet-runtime/bindings';
import { registerCallable } from '../utils/registeredFunction.js';
function noopMT() {
    'main thread';
}
let springHandle = 'springHandle';
if (__MAIN_THREAD__) {
    springHandle = registerCallable(spring_, 'springHandle');
}
else {
    console.log('ohmyoh bts');
}
export function spring(...args) {
    'main thread';
    // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
    return globalThis.runOnRegistered(springHandle)(...args);
}
export function createMotionValue(initial) {
    'main thread';
    class MotionValueImpl {
        v;
        velocity = 0;
        listeners = new Set();
        activeAnimations = new Set();
        lastUpdated = 0;
        constructor(initial) {
            this.v = initial;
        }
        get() {
            return this.v;
        }
        set(v) {
            const now = Date.now();
            if (typeof v === 'number' && typeof this.v === 'number') {
                const delta = v - this.v;
                const timeDelta = (now - this.lastUpdated) / 1000;
                if (timeDelta > 0) {
                    // Simple instantaneous velocity
                    this.velocity = delta / timeDelta;
                }
            }
            this.lastUpdated = now;
            this.v = v;
            this.notify();
        }
        updateVelocity(v) {
            this.velocity = v;
        }
        getVelocity() {
            return this.velocity;
        }
        jump(v) {
            this.v = v;
            this.velocity = 0;
            this.lastUpdated = Date.now();
            this.notify();
        }
        onChange(callback) {
            this.listeners.add(callback);
            return () => this.listeners.delete(callback);
        }
        on(event, callback) {
            if (event === 'change') {
                return this.onChange(callback);
            }
            return noopMT;
        }
        notify() {
            for (const cb of this.listeners) {
                cb(this.v);
            }
        }
        attach(cancel) {
            this.activeAnimations.add(cancel);
            return () => this.activeAnimations.delete(cancel);
        }
        stop() {
            for (const cancel of this.activeAnimations) {
                cancel();
            }
            this.activeAnimations.clear();
        }
        toJSON() {
            return String(this.v);
        }
    }
    return new MotionValueImpl(initial);
}
// --- Easings ---
export const linear = t => t;
export const easeIn = t => t * t;
export const easeOut = t => t * (2 - t);
export const easeInOut = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
export const circIn = t => 1 - Math.sin(Math.acos(t));
export const circOut = t => Math.sin(Math.acos(t - 1));
export const circInOut = t => t < 0.5
    ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
    : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2;
export const backIn = t => t * t * ((1.70158 + 1) * t - 1.70158);
export const backOut = t => --t * t * ((1.70158 + 1) * t + 1.70158) + 1;
export const backInOut = t => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (2 * t - 2) + c2) + 2) / 2;
};
export const anticipate = t => {
    const s = 1.70158 * 1.525;
    return (t *= 2) < 1
        ? 0.5 * (t * t * ((s + 1) * t - s))
        : 0.5 * ((t -= 2) * t * ((s + 1) * t + s) + 2);
};
// --- Animate ---
export function animate(value, target, options = {}) {
    'main thread';
    let currentV = 0;
    let startVelocity = options.velocity ?? 0;
    // Resolve start value
    if (typeof value === 'number') {
        currentV = value;
    }
    else if (typeof value === 'function') {
        // If passed a setter, we can't easily read, assume 0 or options.from
        currentV = options.from ?? 0;
    }
    else {
        currentV = value.get();
        startVelocity = startVelocity || value.getVelocity();
        if (value.stop) {
            value.stop();
        }
    }
    // If type is spring or no duration provided, default to spring.
    // Unless ease is provided, then tween.
    const isSpring = options.type === 'spring'
        || (!options.ease && !options.duration && options.type !== 'keyframes');
    const { from: _from, to: _to, ...springOptions } = options;
    // motion-dom spring() returns an animation generator with .next(t)
    const solver = isSpring
        ? spring({
            ...springOptions,
            keyframes: [currentV, target],
            velocity: startVelocity,
        })
        : null;
    const startTime = Date.now();
    let canceled = false;
    const controls = {
        stop: () => {
            canceled = true;
        },
        then: (cb) => {
            controls.onFinish = cb;
            return Promise.resolve(); // Mock promise return async/await usage
        },
        onFinish: () => { },
    };
    const duration = options.duration ?? 0.3;
    const ease = options.ease ?? easeOut;
    let detach;
    if (typeof value === 'object' && value && 'attach' in value
        && typeof value.attach === 'function') {
        detach = value.attach(controls.stop);
    }
    const tick = () => {
        if (canceled)
            return;
        const now = Date.now();
        const elapsed = (now - startTime) / 1000; // seconds
        const elapsedMs = now - startTime; // milliseconds
        let finished = false;
        let current = 0;
        if (isSpring && solver) {
            // motion-dom spring generator expects time in milliseconds usually
            const state = solver.next(elapsedMs);
            current = state.value;
            finished = state.done;
        }
        else {
            // Tween
            if (elapsed >= duration) {
                finished = true;
                current = target;
            }
            else {
                const p = elapsed / duration;
                const eased = ease(p);
                current = currentV + (target - currentV) * eased;
            }
        }
        // Determine how to update
        if (typeof value === 'function') {
            value(current);
        }
        else if (typeof value === 'object' && value.set) {
            value.set(current);
        }
        if (options.onUpdate) {
            options.onUpdate(current);
        }
        if (finished) {
            // Ensure final frame is exact for tween
            if (!isSpring) {
                if (typeof value === 'function') {
                    value(target);
                }
                else if (typeof value === 'object' && value.set) {
                    value.set(target);
                    value.updateVelocity(0);
                }
            }
            if (options.onComplete) {
                options.onComplete();
            }
            controls.onFinish();
            detach?.();
        }
        else {
            requestAnimationFrame(tick);
        }
    };
    requestAnimationFrame(tick);
    return controls;
}
export function useMotionValueRef(value) {
    // @ts-expect-error expected
    const motionValueRef = useMainThreadRef();
    useMemo(() => {
        function setMotionValue(value) {
            'main thread';
            if (!motionValueRef.current) {
                motionValueRef.current = createMotionValue(value);
            }
        }
        if (__BACKGROUND__) {
            void runOnMainThread(setMotionValue)(value);
        }
        else {
            runWorkletCtx(setMotionValue, [
                value,
            ]);
        }
    }, []);
    return motionValueRef;
}
export function useMotionValueRefEvent(valueRef, event, callback) {
    const unListenRef = useMainThreadRef();
    useEffect(() => {
        void runOnMainThread(() => {
            'main thread';
            unListenRef.current = valueRef.current.on(event, callback);
        })();
        return () => {
            void runOnMainThread(() => {
                'main thread';
                unListenRef.current?.();
            })();
        };
    }, [callback]);
}
//# sourceMappingURL=index.js.map