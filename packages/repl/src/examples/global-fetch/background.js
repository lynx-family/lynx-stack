// Demonstrates: fetch in the background thread
//
// In Lynx, use globalThis.fetch() to make network requests
// from the background thread, then dispatch results to the
// main thread for rendering via cross-thread events.

globalThis.fetch('https://jsonplaceholder.typicode.com/todos/1')
  .then((response) => response.json())
  .then((data) => {
    lynx.getCoreContext().dispatchEvent({
      type: 'fetchResult',
      data: { success: true, payload: data },
    });
  })
  .catch((error) => {
    lynx.getCoreContext().dispatchEvent({
      type: 'fetchResult',
      data: { success: false, error: String(error) },
    });
  });
