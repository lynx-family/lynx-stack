export function onTap(event) {
  boxRef.value.setStyle({ backgroundColor: colorRef.value });
  countRef.value++;
}
