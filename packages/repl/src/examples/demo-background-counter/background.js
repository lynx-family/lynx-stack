// Drives a counter via cross-thread events
let count = 0;

setInterval(() => {
  count++;
  lynx.getCoreContext().dispatchEvent({
    type: 'tick',
    data: { count },
  });
}, 1000);
