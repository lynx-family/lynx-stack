// Console output from background thread
console.log('Hello from background thread!');
console.info(
  'Background info:',
  JSON.stringify({ thread: 'background', time: Date.now() }),
);
console.warn('Warning from background');

let count = 0;
setInterval(() => {
  count++;
  console.log('Background tick #' + count);
}, 3000);
