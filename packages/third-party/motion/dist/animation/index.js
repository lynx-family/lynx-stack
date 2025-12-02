// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '../polyfill/shim.js';
import { animate as animateOriginal, clamp as clampOrig, progress as progressOrig, stagger as staggerOriginal, } from 'framer-motion/dom';
import { mapValue as mapValueOrig, mix as mixOrig, spring as springOrig, springValue as springValueOrig, styleEffect as styleEffectOrig, transformValue as transformValueOrig, } from 'motion-dom';
import { useMotionValueRefEvent } from '../hooks/useMotionEvent.js';
import { motionValue as motionValueOrig } from '../polyfill/MotionValue.js';
import { elementOrSelector2Dom } from '../utils/elementHelper.js';
import { isMainThreadElement, isMainThreadElementArray, } from '../utils/isMainThreadElement.js';
import { registerCallable } from '../utils/registeredFunction.js';
let animateHandle;
let staggerHandle;
let motionValueHandle;
let springHandle;
let springValueHandle;
let mixHandle;
let progressHandle;
let clampHandle;
let mapValueHandle;
let transformValueHandle;
let styleEffectHandle;
if (__MAIN_THREAD__) {
    animateHandle = registerCallable(animateOriginal, 'animate');
    staggerHandle = registerCallable(staggerOriginal, 'stagger');
    motionValueHandle = registerCallable(motionValueOrig, 'motionValue');
    springHandle = registerCallable(springOrig, 'spring');
    springValueHandle = registerCallable(springValueOrig, 'springValue');
    mixHandle = registerCallable(mixOrig, 'mix');
    progressHandle = registerCallable(progressOrig, 'progress');
    clampHandle = registerCallable(clampOrig, 'clamp');
    mapValueHandle = registerCallable(mapValueOrig, 'mapValue');
    transformValueHandle = registerCallable(transformValueOrig, 'transformValue');
    styleEffectHandle = registerCallable(styleEffectOrig, 'styleEffect');
}
else {
    animateHandle = 'animate';
    staggerHandle = 'stagger';
    motionValueHandle = 'motionValue';
    springHandle = 'spring';
    springValueHandle = 'springValue';
    mixHandle = 'mix';
    progressHandle = 'progress';
    clampHandle = 'clamp';
    mapValueHandle = 'mapValue';
    transformValueHandle = 'transformValue';
    styleEffectHandle = 'styleEffect';
}
function animate(subjectOrSequence, optionsOrKeyframes, options) {
    'main thread';
    let realSubjectOrSequence;
    if (typeof subjectOrSequence === 'string'
        || isMainThreadElement(subjectOrSequence)
        || isMainThreadElementArray(subjectOrSequence)) {
        let elementNodes;
        if (typeof subjectOrSequence === 'string') {
            elementNodes = lynx.querySelectorAll(subjectOrSequence);
        }
        else {
            elementNodes = subjectOrSequence;
        }
        realSubjectOrSequence = (Array.isArray(elementNodes)
            ? elementNodes.map(el => new globalThis.ElementCompt(el))
            : new globalThis.ElementCompt(elementNodes));
    }
    else {
        realSubjectOrSequence = subjectOrSequence;
    }
    // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
    return globalThis.runOnRegistered(animateHandle)(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    realSubjectOrSequence, 
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    optionsOrKeyframes, 
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    options);
}
function stagger(...args) {
    'main thread';
    // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
    return globalThis.runOnRegistered(staggerHandle)(...args);
}
function motionValue(init, options) {
    'main thread';
    // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
    return globalThis.runOnRegistered(motionValueHandle)(init, options);
}
function spring(...args) {
    'main thread';
    // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
    return globalThis.runOnRegistered(springHandle)(...args);
}
function springValue(source, options) {
    'main thread';
    // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
    return globalThis.runOnRegistered(springValueHandle)(source, options);
}
function mix(from, to, p) {
    'main thread';
    // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
    return globalThis.runOnRegistered(mixHandle)(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    from, 
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    to, 
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    p);
}
function progress(from, to, value) {
    'main thread';
    return globalThis.runOnRegistered(progressHandle)(from, to, value);
}
function clamp(min, max, v) {
    'main thread';
    return globalThis.runOnRegistered(clampHandle)(min, max, v);
}
function mapValue(inputValue, inputRange, outputRange, options) {
    'main thread';
    return globalThis.runOnRegistered(mapValueHandle)(inputValue, inputRange, outputRange, options);
}
function transformValue(transform) {
    'main thread';
    return globalThis.runOnRegistered(transformValueHandle)(transform);
}
function styleEffect(subject, values) {
    'main thread';
    const elements = elementOrSelector2Dom(subject);
    if (!elements) {
        return () => { };
    }
    return globalThis.runOnRegistered(styleEffectHandle)(elements, values);
}
export const noop = () => { };
export { animate, stagger, motionValue, spring, springValue, mix, progress, mapValue, clamp, transformValue, styleEffect, };
export { useMotionValueRefEvent };
//# sourceMappingURL=index.js.map