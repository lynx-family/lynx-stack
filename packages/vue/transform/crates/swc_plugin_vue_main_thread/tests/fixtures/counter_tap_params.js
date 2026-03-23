export function onTap(event, extra) {
  console.log(event.target, extra);
  outsideRef.value.doSomething();
}
