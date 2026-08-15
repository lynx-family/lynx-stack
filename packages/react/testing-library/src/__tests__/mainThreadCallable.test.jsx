import { expect, it, vi } from 'vitest';

import { useMainThreadCallable, useMainThreadCallables } from '@lynx-js/react';

import { fireEvent, render, waitSchedule } from '..';

it('easing function arrays nested in a transition object should arrive as callable main-thread functions', async () => {
  // Mirrors Huxpro/motion#37: a distinct easing callback per keyframe segment,
  // nested inside a transition object, must be invocable on the main thread.
  let offset = 1;
  const Comp = () => {
    const transition = useMainThreadCallables({
      duration: 0.8,
      ease: [
        (progress) => {
          'main thread';
          return progress + offset;
        },
        (progress) => {
          'main thread';
          return progress * 2;
        },
      ],
    });
    return (
      <view
        main-thread:bindtap={() => {
          'main thread';
          // Capture `transition` whole (like passing it as a worklet
          // parameter would); member-expression narrowing of deep paths is
          // tracked as an RFC open question.
          const { duration, ease } = transition;
          globalThis.easingResults = {
            duration,
            values: ease.map((easing) => easing(0.5)),
          };
        }}
      />
    );
  };

  const { container, rerender } = render(<Comp />, {
    enableMainThread: true,
    enableBackgroundThread: true,
  });
  await waitSchedule();

  fireEvent.tap(container.firstChild);
  expect(globalThis.easingResults).toEqual({
    duration: 0.8,
    values: [1.5, 1],
  });

  // A rerender updates the captured values of the transported easings.
  offset = 41.5;
  rerender(<Comp />);
  await waitSchedule();

  fireEvent.tap(container.firstChild);
  expect(globalThis.easingResults).toEqual({
    duration: 0.8,
    values: [42, 1],
  });
});

it('transformTemplate should be a lifecycle-managed main-thread callable', async () => {
  // Mirrors Huxpro/motion#55: a consumer callback composes custom transform
  // text around the generated transform on the main thread.
  const Comp = ({ y }) => {
    const transformTemplate = useMainThreadCallable(({ x }, generated) => {
      'main thread';
      return `translateY(${y}px) ${generated}`.replace('_X_', String(x));
    });
    return (
      <view
        main-thread:bindtap={() => {
          'main thread';
          globalThis.transformResult = transformTemplate(
            { x: 30 },
            'translateX(_X_px)',
          );
        }}
      />
    );
  };

  const { container, rerender } = render(<Comp y={30} />, {
    enableMainThread: true,
    enableBackgroundThread: true,
  });
  await waitSchedule();

  fireEvent.tap(container.firstChild);
  expect(globalThis.transformResult).toBe('translateY(30px) translateX(30px)');

  rerender(<Comp y={60} />);
  await waitSchedule();

  fireEvent.tap(container.firstChild);
  expect(globalThis.transformResult).toBe('translateY(60px) translateX(30px)');
});

it('a retained main-thread callable should stay stable while observing fresh captured values', async () => {
  // A long-lived main-thread consumer (e.g. an animation loop) retains the
  // realized function once; later renders must update what it computes.
  let scale = 2;
  const Comp = () => {
    const ease = useMainThreadCallable((progress) => {
      'main thread';
      return progress * scale;
    });
    return (
      <view
        main-thread:bindtap={() => {
          'main thread';
          // Retain on first tap, reuse on later taps.
          globalThis.retainedEase ??= ease;
          globalThis.retainedResults = [
            globalThis.retainedEase(1),
            globalThis.retainedEase === ease,
          ];
        }}
      />
    );
  };

  const { container, rerender } = render(<Comp />, {
    enableMainThread: true,
    enableBackgroundThread: true,
  });
  await waitSchedule();

  fireEvent.tap(container.firstChild);
  expect(globalThis.retainedResults).toEqual([2, true]);

  scale = 10;
  rerender(<Comp />);
  await waitSchedule();

  fireEvent.tap(container.firstChild);
  expect(globalThis.retainedResults).toEqual([10, true]);
  delete globalThis.retainedEase;
});

it('callables should be released on unmount', async () => {
  const Child = () => {
    const ease = useMainThreadCallables({
      ease: [(progress) => {
        'main thread';
        return progress;
      }],
    });
    return (
      <view
        main-thread:bindtap={() => {
          'main thread';
          globalThis.unmountEase = ease.ease[0];
          globalThis.unmountEaseResult = ease.ease[0](1);
        }}
      />
    );
  };
  const Comp = ({ show }) => {
    return show ? <Child /> : <view />;
  };

  const { container, rerender } = render(<Comp show={true} />, {
    enableMainThread: true,
    enableBackgroundThread: true,
  });
  await waitSchedule();

  const getCallableCtxMap = () => {
    lynxTestingEnv.switchToMainThread();
    const map = globalThis.lynxWorkletImpl._callableImpl._callableCtxMap;
    lynxTestingEnv.switchToBackgroundThread();
    return map;
  };
  fireEvent.tap(container.firstChild);
  expect(globalThis.unmountEaseResult).toBe(1);
  expect(Object.keys(getCallableCtxMap()).length).toBe(1);

  rerender(<Comp show={false} />);
  await waitSchedule();

  expect(Object.keys(getCallableCtxMap()).length).toBe(0);
  // Calling a released callable is a no-op returning undefined in production
  // and throws in development.
  lynxTestingEnv.switchToMainThread();
  expect(() => globalThis.unmountEase(1)).toThrowError(
    /MainThreadCallable: callable \d+ is not registered/,
  );
  lynxTestingEnv.switchToBackgroundThread();
  delete globalThis.unmountEase;
});
