import { expect, it, vi } from 'vitest';

import { useMainThreadEffect, useMainThreadInstance } from '@lynx-js/react';

import { fireEvent, render, waitSchedule } from '..';

it('an instance should realize once on the main thread and keep its identity', async () => {
  // The main-thread counterpart of the create-once instance idiom: the
  // realized object is created by main-thread code, stays identity-stable
  // across taps and rerenders, and its captured values are frozen.
  let init = 5;
  const Comp = () => {
    const store = useMainThreadInstance(() => {
      'main thread';
      return { current: init, reads: 0 };
    });
    return (
      <view
        main-thread:bindtap={() => {
          'main thread';
          store.reads += 1;
          globalThis.instanceResults = {
            current: store.current,
            reads: store.reads,
            same: globalThis.retainedStore === undefined || globalThis.retainedStore === store,
          };
          globalThis.retainedStore = store;
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
  expect(globalThis.instanceResults).toEqual({ current: 5, reads: 1, same: true });

  // Rerender with a changed captured value: the instance is frozen at first
  // commit — the realized object neither re-creates nor observes the change,
  // and main-thread mutations (`reads`) survive.
  init = 99;
  rerender(<Comp />);
  await waitSchedule();

  fireEvent.tap(container.firstChild);
  expect(globalThis.instanceResults).toEqual({ current: 5, reads: 2, same: true });
  delete globalThis.retainedStore;
  delete globalThis.instanceResults;
});

it('an instance should be disposed on unmount, with the realized object', async () => {
  const Child = () => {
    const controls = useMainThreadInstance(
      () => {
        'main thread';
        return { stopped: false };
      },
      (obj) => {
        'main thread';
        obj.stopped = true;
        globalThis.disposedObject = obj;
      },
    );
    return (
      <view
        main-thread:bindtap={() => {
          'main thread';
          globalThis.retainedControls = controls;
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

  fireEvent.tap(container.firstChild);
  expect(globalThis.retainedControls.stopped).toBe(false);

  rerender(<Comp show={false} />);
  await waitSchedule();

  // Dispose ran with the exact realized object.
  expect(globalThis.disposedObject).toBe(globalThis.retainedControls);
  expect(globalThis.retainedControls.stopped).toBe(true);
  delete globalThis.retainedControls;
  delete globalThis.disposedObject;
});

it('an effect should run on the main thread per deps change with a cleanup cycle', async () => {
  globalThis.effectLog = [];
  const Comp = ({ target }) => {
    useMainThreadEffect(() => {
      'main thread';
      globalThis.effectLog.push(['run', target]);
      return () => {
        globalThis.effectLog.push(['cleanup', target]);
      };
    }, [target]);
    return <view />;
  };

  const { rerender, unmount } = render(<Comp target={1} />, {
    enableMainThread: true,
    enableBackgroundThread: true,
  });
  await waitSchedule();
  expect(globalThis.effectLog).toEqual([['run', 1]]);

  // Unchanged deps: no re-run.
  rerender(<Comp target={1} />);
  await waitSchedule();
  expect(globalThis.effectLog).toEqual([['run', 1]]);

  // Changed deps: the previous run's cleanup runs first, observing its own
  // snapshot of the captured values; the new run observes the fresh ones.
  rerender(<Comp target={2} />);
  await waitSchedule();
  expect(globalThis.effectLog).toEqual([['run', 1], ['cleanup', 1], ['run', 2]]);

  // Unmount: the pending cleanup runs on the main thread.
  unmount();
  await waitSchedule();
  expect(globalThis.effectLog).toEqual([['run', 1], ['cleanup', 1], ['run', 2], ['cleanup', 2]]);
  delete globalThis.effectLog;
});

it('an effect cleanup should run on unmount and may use instances of the same commit', async () => {
  globalThis.teardownLog = [];
  const Child = () => {
    const controls = useMainThreadInstance(
      () => {
        'main thread';
        return { name: 'controls' };
      },
      (obj) => {
        'main thread';
        globalThis.teardownLog.push(['dispose', obj.name]);
      },
    );
    useMainThreadEffect(() => {
      'main thread';
      return () => {
        // The unmounting commit's cleanup may still use the instance: releases
        // tear down LIFO, so the instance's dispose (declared above) is
        // ordered after this cleanup. Capture `controls` whole (destructure);
        // member-expression narrowing of handle captures is tracked as an RFC
        // open question.
        const { name } = controls;
        globalThis.teardownLog.push(['cleanup', name]);
      };
    }, []);
    return <view />;
  };
  const Comp = ({ show }) => {
    return show ? <Child /> : <view />;
  };

  const { rerender } = render(<Comp show={true} />, {
    enableMainThread: true,
    enableBackgroundThread: true,
  });
  await waitSchedule();

  rerender(<Comp show={false} />);
  await waitSchedule();

  expect(globalThis.teardownLog).toEqual([
    ['cleanup', 'controls'],
    ['dispose', 'controls'],
  ]);
  delete globalThis.teardownLog;
});
