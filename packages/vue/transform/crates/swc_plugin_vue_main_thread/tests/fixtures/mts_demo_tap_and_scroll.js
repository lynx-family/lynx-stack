export function onTap(event) {
  boxRef.value.setStyle({ backgroundColor: 'red' });
}
export function onScroll(event) {
  scrollRef.value.setStyle({ top: event.detail.scrollTop + 'px' });
}
