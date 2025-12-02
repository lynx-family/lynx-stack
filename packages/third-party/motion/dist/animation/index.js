// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '../polyfill/shim.js';
// import {
//   animate as animateOrig,
//   clamp as clampOrig,
//   progress as progressOrig,
//   stagger as staggerOrig,
// } from 'framer-motion/dom';
// import type {
//   AnimationSequence,
//   ObjectTarget,
//   SequenceOptions,
// } from 'framer-motion/dom';
// import {
//   mapValue as mapValueOrig,
//   mix as mixOrig,
//   spring as springOrig,
//   springValue as springValueOrig,
//   styleEffect as styleEffectOrig,
//   transformValue as transformValueOrig,
// } from 'motion-dom';
import { animate as animateOrig, clamp as clampOrig, progress as progressOrig, stagger as staggerOrig, } from 'framer-motion/dom' with { runtime: 'shared' };
import { mapValue as mapValueOrig, mix as mixOrig, spring as springOrig, springValue as springValueOrig, styleEffect as styleEffectOrig, transformValue as transformValueOrig, } from 'motion-dom' with { runtime: 'shared' };
import { useMotionValueRefEvent } from '../hooks/useMotionEvent.js';
import { motionValue as motionValueOrig } from '../polyfill/MotionValue.js';
import { elementOrSelector2Dom } from '../utils/elementHelper.js';
import { isMainThreadElement, isMainThreadElementArray, } from '../utils/isMainThreadElement.js';
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
    return animateOrig(
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
    return staggerOrig(...args);
}
function motionValue(init, options) {
    'main thread';
    // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
    return motionValueOrig(init, options);
}
function spring(...args) {
    'main thread';
    // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
    return springOrig(...args);
}
function springValue(source, options) {
    'main thread';
    // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
    return springValueOrig(source, options);
}
function mix(from, to, p) {
    'main thread';
    // @TODO: Remove the globalThis trick when MTS can treat a module as MTS module
    return mixOrig(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    from, 
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    to, 
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    p);
}
function progress(from, to, value) {
    'main thread';
    return progressOrig(from, to, value);
}
function clamp(min, max, v) {
    'main thread';
    return clampOrig(min, max, v);
}
function mapValue(inputValue, inputRange, outputRange, options) {
    'main thread';
    return mapValueOrig(inputValue, inputRange, outputRange, options);
}
function transformValue(transform) {
    'main thread';
    return transformValueOrig(transform);
}
function styleEffect(subject, values) {
    'main thread';
    const elements = elementOrSelector2Dom(subject);
    if (!elements) {
        return () => { };
    }
    return styleEffectOrig(elements, values);
}
export const noop = () => { };
export { animate, stagger, motionValue, spring, springValue, mix, progress, mapValue, clamp, transformValue, styleEffect, };
export { useMotionValueRefEvent };
//# sourceMappingURL=index.js.map