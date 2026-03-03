// The background thread drives data updates and observes lifecycle signals.
//
// __OnLifecycleEvent on the main thread routes back to
// lynxCoreInject.tt.OnLifecycleEvent on the background thread.
// Override it here to observe the round-trip.

const _orig = lynxCoreInject.tt.OnLifecycleEvent;
lynxCoreInject.tt.OnLifecycleEvent = function(...args) {
  // biome-ignore lint/suspicious/noConsoleLog: intentional debug output in example
  console.log('OnLifecycleEvent:', JSON.stringify(args[0]));
  return _orig?.apply(this, args);
};

// Drive periodic data updates to the main thread.
let count = 0;
setInterval(() => {
  count++;
  lynx.getCoreContext().dispatchEvent({
    type: 'updateData',
    data: { count },
  });
}, 1500);
