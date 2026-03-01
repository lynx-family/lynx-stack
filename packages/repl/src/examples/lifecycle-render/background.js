// The background thread drives data updates.
// In the web platform, updatePage is triggered via the updateData RPC endpoint.
// For this demo, we use cross-thread events to simulate the pattern.

let count = 0;
setInterval(() => {
  count++;
  lynx.getCoreContext().dispatchEvent({
    type: "updateData",
    data: { count },
  });
}, 1500);
