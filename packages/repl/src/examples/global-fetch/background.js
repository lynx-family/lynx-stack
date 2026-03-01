// Demonstrates: fetch in the background thread (Web Worker)
//
// The standard Fetch API is available in the background thread.
// Use it for network requests, then dispatch results to the
// main thread for rendering.

fetch("https://jsonplaceholder.typicode.com/todos/1")
  .then((response) => response.json())
  .then((data) => {
    lynx.getCoreContext().dispatchEvent({
      type: "fetchResult",
      data: { success: true, payload: data },
    });
  })
  .catch((error) => {
    lynx.getCoreContext().dispatchEvent({
      type: "fetchResult",
      data: { success: false, error: error.message },
    });
  });
