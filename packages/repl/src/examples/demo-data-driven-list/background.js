// Simulates a data source feeding items to the main thread
const fruits = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'];
let index = 0;

setInterval(() => {
  if (index < fruits.length) {
    lynx.getCoreContext().dispatchEvent({
      type: 'addItem',
      data: { name: fruits[index], count: index + 1 },
    });
    index++;
  }
}, 800);
