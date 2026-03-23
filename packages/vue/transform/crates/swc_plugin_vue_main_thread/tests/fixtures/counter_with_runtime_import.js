import { someHelper } from '@lynx-js/vue-runtime';
export function onTap(event) {
  someHelper();
  boxRef.value.setStyle({ backgroundColor: 'red' });
}
