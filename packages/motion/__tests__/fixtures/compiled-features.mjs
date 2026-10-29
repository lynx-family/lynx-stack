// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Import the published JS directly, outside Vitest and ReactLynx's mock loader.
const names = [
  'window',
  'document',
  'Element',
  'HTMLElement',
  'SVGElement',
  'NodeList',
  'EventTarget',
  'getComputedStyle',
  'queueMicrotask',
  'performance',
];
for (const name of names) {
  const value = process.env.MOTION_TEST_HOST === 'browser'
    ? (globalThis[name] ?? Object.freeze(function BrowserAPI() {}))
    : undefined;
  Object.defineProperty(globalThis, name, {
    value,
    writable: false,
    configurable: true,
  });
}
const descriptors = names.map(name =>
  Object.getOwnPropertyDescriptor(globalThis, name)
);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let now = () => Date.now();
const frames = new Set();
globalThis.requestAnimationFrame = callback => {
  const frame = setTimeout(() => {
    frames.delete(frame);
    callback(now());
  }, 4);
  frames.add(frame);
  return frame;
};
globalThis.cancelAnimationFrame = frame => {
  frames.delete(frame);
  clearTimeout(frame);
};
globalThis.__MAIN_THREAD__ = true;
const elements = new Map();
globalThis.__GetComputedStyleByKey = (id, key) =>
  elements.get(id)?.styles[key] ?? '';
let microtasks = 0;
globalThis.lynx = {
  querySelector: selector =>
    [...elements.values()].find(el => el.selector === selector),
  querySelectorAll: selector =>
    [...elements.values()].filter(el => el.selector === selector),
  queueMicrotask(callback) {
    assert.equal(
      this,
      globalThis.lynx,
      'native scheduling must retain its receiver',
    );
    microtasks++;
    Promise.resolve().then(callback);
  },
};
const dist = new URL(
  process.env.MOTION_TEST_DIST ?? '../../dist/',
  import.meta.url,
);
const motion = await import(new URL('upstream/full.js', dist));
const runtime = await import(new URL('polyfill/runtime.js', dist));
now = () => runtime.performance.now();
const mini = {
  ...await import(new URL('mini/core/animate.js', dist)),
  ...await import(new URL('mini/core/MotionValue.js', dist)),
  ...await import(new URL('mini/core/spring.js', dist)),
};
function element(selector, styles = {}) {
  const native = {
    element: elements.size + 1,
    selector,
    styles: { opacity: '0', transform: 'none', width: '100px', ...styles },
    setStyleProperty(name, value) {
      this.styles[name] = String(value);
    },
  };
  elements.set(native.element, native);
  return { native, dom: new runtime.Element(native) };
}
function near(actual, expected, tolerance = 0.01) {
  assert.ok(
    Math.abs(Number.parseFloat(actual) - expected) <= tolerance,
    `${actual} != ${expected}`,
  );
}
async function until(predicate, timeout = 2000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    assert.ok(
      Date.now() < deadline,
      'feature did not converge before deadline',
    );
    await wait(8);
  }
}

await test('full: numeric and color value animations deliver callbacks and completion', async () => {
  let updates = 0;
  let completed = 0;
  let color;
  const value = motion.motionValue(0);
  await motion.animate(value, [0, 20, 40], {
    duration: 0.04,
    ease: 'linear',
    onUpdate: () => updates++,
    onComplete: () => completed++,
  });
  near(value.get(), 40);
  assert.ok(updates > 1);
  assert.equal(completed, 1);
  await motion.animate('#000000', '#ffffff', {
    duration: 0.02,
    onUpdate: v => color = v,
  });
  assert.match(color, /#ffffff|255.*255.*255/ig);
});

await test('full: object animation and relative sequence segments reach their final values', async () => {
  const object = { x: 0, opacity: 0 };
  await motion.animate([
    [object, { x: [0, 20] }, { duration: 0.02 }],
    [object, { x: 40, opacity: 1 }, { at: '+0.01', duration: 0.02 }],
  ]);
  near(object.x, 40);
  near(object.opacity, 1);
});

await test('full: element transforms, percentage dimensions, and colors use private DOM bindings', async () => {
  const { native, dom } = element('.styled', { backgroundColor: '#000000' });
  await motion.animate(dom, {
    x: 40,
    scale: 1.2,
    width: '50%',
    backgroundColor: '#ffffff',
  }, { duration: 0.04 });
  assert.match(native.styles.transform, /translateX\(40px\).*scale\(1.2\)/);
  assert.equal(native.styles.width, '50%');
  assert.match(native.styles.backgroundColor, /#ffffff|255.*255.*255/ig);
});

await test('full: selectors and stagger animate every matched element', async () => {
  const first = element('.group');
  const second = element('.group');
  await motion.animate('.group', { opacity: 1 }, {
    duration: 0.02,
    delay: motion.stagger(0.01),
  });
  near(first.native.styles.opacity, 1);
  near(second.native.styles.opacity, 1);
});

await test('full: pause/play and complete control the animation lifecycle', async () => {
  const value = motion.motionValue(0);
  const controls = motion.animate(value, 100, {
    duration: 0.2,
    ease: 'linear',
  });
  await until(() => value.get() > 0);
  controls.pause();
  await wait(12);
  const paused = value.get();
  await wait(30);
  near(value.get(), paused);
  controls.play();
  await until(() => value.get() > paused);
  controls.complete();
  await controls;
  near(value.get(), 100);
});

await test('full: stop prevents future updates and replacement converges to its new target', async () => {
  const value = motion.motionValue(0);
  const controls = motion.animate(value, 100, { duration: 0.2 });
  await until(() => value.get() > 0);
  controls.stop();
  const stopped = value.get();
  await wait(35);
  near(value.get(), stopped);
  const previous = motion.animate(value, 200, { duration: 0.2 });
  await motion.animate(value, 20, { duration: 0.02 });
  await wait(30);
  near(value.get(), 20);
  previous.stop();
});

await test('full: repeat reverse returns to the initial value', async () => {
  const value = motion.motionValue(0);
  await motion.animate(value, 10, {
    duration: 0.02,
    repeat: 1,
    repeatType: 'reverse',
  });
  near(value.get(), 0);
});

await test('full: mapped and derived values drive styleEffect and cleanup detaches it', async () => {
  const { native } = element('.effect');
  const input = motion.motionValue(0);
  const mapped = motion.mapValue(input, [0, 1], [0, 100]);
  const derived = motion.transformValue(() => input.get() * 2);
  const cleanup = motion.styleEffect('.effect', {
    opacity: derived,
    x: mapped,
  });
  input.set(0.5);
  await until(() => Number(native.styles.opacity) === 1);
  near(mapped.get(), 50);
  assert.match(native.styles.transform, /translateX\(50px\)/);
  cleanup();
  input.set(1);
  await wait(35);
  near(native.styles.opacity, 1);
  mapped.destroy();
  derived.destroy();
  input.destroy();
});

await test('full: springValue follows its source and listener cleanup stops notifications', async () => {
  const source = motion.motionValue(0);
  const value = motion.springValue(source, { stiffness: 500, damping: 40 });
  let changes = 0;
  const unsubscribe = value.on('change', () => changes++);
  source.set(1);
  await until(() => Math.abs(value.get() - 1) < 0.001);
  assert.ok(changes > 0);
  unsubscribe();
  const before = changes;
  value.jump(2);
  assert.equal(changes, before);
  value.destroy();
  source.destroy();
});

await test('full: interpolation helpers and spring generator remain usable', () => {
  near(motion.clamp(0, 1, 3), 1);
  near(motion.progress(10, 20, 15), 0.5);
  near(motion.mix(0, 100, 0.25), 25);
  near(motion.mix([0, 20], [20, 40])(0.5)[1], 30);
  const generator = motion.spring({
    keyframes: [0, 1],
    stiffness: 300,
    damping: 30,
  });
  assert.equal(generator.next(5000).done, true);
  near(generator.next(5000).value, 1);
});

await test('mini: all eleven easing exports have finite interior values and correct endpoints', () => {
  for (
    const name of [
      'linear',
      'anticipate',
      'backIn',
      'backInOut',
      'backOut',
      'circIn',
      'circInOut',
      'circOut',
      'easeIn',
      'easeInOut',
      'easeOut',
    ]
  ) {
    near(mini[name](0), 0);
    near(mini[name](1), 1);
    assert.ok(Number.isFinite(mini[name](0.37)), name);
  }
});

await test('mini: tween updates a real MotionValue and calls completion once', async () => {
  const value = mini.createMotionValue(0);
  let updates = 0;
  let completed = 0;
  const unsubscribe = value.onChange(() => updates++);
  await mini.animate(value, 50, {
    duration: 0.03,
    ease: mini.easeInOut,
    onComplete: () => completed++,
  });
  near(value.get(), 50);
  near(value.getVelocity(), 0);
  assert.ok(updates > 1);
  assert.equal(completed, 1);
  assert.equal(value.isAnimating(), false);
  unsubscribe();
  value.destroy();
});

await test('mini: setter and numeric inputs deliver exact final values', async () => {
  let setter;
  let numeric;
  await mini.animate(v => setter = v, 40, { from: 10, duration: 0.02 });
  await mini.animate(10, 30, { duration: 0.02, onUpdate: v => numeric = v });
  near(setter, 40);
  near(numeric, 30);
});

await test('mini: real upstream spring converges and reports its settled state', async () => {
  const value = mini.createMotionValue(0);
  await mini.animate(value, 1, { type: 'spring', stiffness: 500, damping: 40 });
  near(value.get(), 1);
  assert.equal(value.isAnimating(), false);
  const generator = mini.spring({
    keyframes: [0, 1],
    stiffness: 500,
    damping: 40,
  });
  assert.equal(generator.next(5000).done, true);
});

await test('mini: stop settles controls and prevents subsequent writes', async () => {
  const value = mini.createMotionValue(0);
  const controls = mini.animate(value, 100, { duration: 0.2 });
  await until(() => value.get() > 0);
  controls.stop();
  const stopped = value.get();
  await controls;
  await wait(35);
  near(value.get(), stopped);
  assert.equal(value.isAnimating(), false);
});

await test('mini: replacement cancels the old animation and reaches the replacement target', async () => {
  const value = mini.createMotionValue(0);
  const first = mini.animate(value, 100, { duration: 0.2 });
  await until(() => value.get() > 0);
  await mini.animate(value, 20, { duration: 0.02 });
  await first;
  await wait(35);
  near(value.get(), 20);
  assert.equal(value.isAnimating(), false);
});

await test('mini: destroy cancels running animation and removes listeners', async () => {
  const value = mini.createMotionValue(0);
  let changes = 0;
  value.on('change', () => changes++);
  const controls = mini.animate(value, 100, { duration: 0.2 });
  await until(() => value.get() > 0);
  value.destroy();
  const before = changes;
  await controls;
  value.set(20);
  await wait(30);
  assert.equal(changes, before);
  assert.equal(value.isAnimating(), false);
});

await test('mini: subscriptions, jump, clearListeners and serialization preserve value semantics', () => {
  const value = mini.createMotionValue(0);
  let changes = 0;
  const unsubscribe = value.on('change', () => changes++);
  value.set(1);
  unsubscribe();
  value.set(2);
  value.onChange(() => changes++);
  value.clearListeners();
  value.jump(3);
  near(value.getVelocity(), 0);
  assert.equal(changes, 1);
  assert.equal(JSON.stringify(value), '"3"');
});

await test('mini: unsupported animation types fail explicitly', () => {
  for (const type of ['decay', 'keyframes']) {
    assert.throws(() => mini.animate(0, 1, { type }), /does not support/);
  }
});

if (process.env.MOTION_TEST_LATEST === 'true') {
  await test('latest: grid, edge and random stagger options', () => {
    const grid = motion.stagger(0.1, { grid: [3, 3], from: 'center' });
    near(grid(4, 9), 0);
    near(grid(0, 9), Math.sqrt(2) * 0.1);
    const edges = motion.stagger(0.1, { grid: [3, 3], from: 'edges' });
    near(edges(0, 9), 0);
    near(edges(4, 9), 0.1);
    const random = motion.stagger(0.1, { from: 'random' });
    const delays = Array.from({ length: 5 }, (_, index) => random(index, 5));
    assert.equal(new Set(delays).size, 5);
    delays.sort((a, b) => a - b).forEach((value, index) =>
      near(value, index * 0.1)
    );
  });

  await test('latest: negative bounce creates a settling overdamped spring', () => {
    const generator = motion.spring({
      keyframes: [0, 1],
      duration: 500,
      bounce: -0.5,
    });
    let previous = 0;
    for (let time = 0; time <= 500; time += 10) {
      const sample = generator.next(time);
      assert.ok(Number.isFinite(sample.value));
      assert.ok(sample.value >= previous - 0.00001 && sample.value <= 1.00001);
      previous = sample.value;
    }
    near(generator.next(10000).value, 1);
    assert.equal(generator.next(10000).done, true);
  });

  await test('latest: cleanup of a replaced styleEffect retains the new binding', async () => {
    const { native } = element('.latest-rebind');
    const first = motion.motionValue(0);
    const second = motion.motionValue(0.2);
    const cleanupFirst = motion.styleEffect('.latest-rebind', {
      opacity: first,
    });
    const cleanupSecond = motion.styleEffect('.latest-rebind', {
      opacity: second,
    });
    cleanupFirst();
    second.set(0.8);
    await until(() => Number(native.styles.opacity) === 0.8);
    cleanupSecond();
    second.set(0.3);
    await wait(35);
    near(native.styles.opacity, 0.8);
    first.destroy();
    second.destroy();
  });
}

await test('full and mini leave host globals untouched after exercising features', async () => {
  const { queueMicrotask } = await import(
    new URL('polyfill/microtask.js', dist)
  );
  const before = microtasks;
  await new Promise(resolve => queueMicrotask(resolve));
  assert.ok(microtasks > before, 'queueMicrotask must use lynx.queueMicrotask');
  assert.deepEqual(
    names.map(name => Object.getOwnPropertyDescriptor(globalThis, name)),
    descriptors,
  );
});

for (const frame of frames) clearTimeout(frame);
