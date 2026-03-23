export function onTap(event) {
  console.log(Math.random());
  JSON.stringify({ a: 1 });
  setTimeout(() => {}, 0);
  __AddEvent(null, 'tap', 'x', {});
}
