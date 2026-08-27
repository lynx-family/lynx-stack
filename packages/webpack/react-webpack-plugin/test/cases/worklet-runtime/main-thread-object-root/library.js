import {
  defineMainThreadObjectType as defineType,
  useMainThreadObject as useObject,
} from '@lynx-js/react';

export const counterType = defineType({
  type: '@test/counter',
  create(initialValue) {
    'main thread';
    return { value: initialValue };
  },
});

export function useCounter(initialValue) {
  return useObject(counterType, initialValue);
}
