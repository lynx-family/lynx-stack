// lynx.getCoreContext().dispatchEvent — send event to main thread
//
// The background thread runs in a Web Worker.
// Use dispatchEvent to send data to the main thread.

setTimeout(() => {
  lynx.getCoreContext().dispatchEvent({
    type: 'greeting',
    data: { message: 'Hello from Background Thread!' },
  });
}, 500);

// Send periodic updates
let count = 0;
setInterval(() => {
  count++;
  lynx.getCoreContext().dispatchEvent({
    type: 'greeting',
    data: { message: 'Update #' + count + ' from background' },
  });
}, 2000);
