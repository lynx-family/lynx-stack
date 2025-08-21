'main thread';

import { useRef } from '@lynx-js/react';
import {
  batch,
  signal,
  computed,
  effect,
  useSignal,
  useComputed,
  useSignalEffect,
} from '@lynx-js/react/signals';
import { MainThread } from '@lynx-js/types';

const todos = signal([
  { text: 'MTC RFC', completed: true },
  { text: 'MTC Production', completed: false },
]);

const color = signal('blue');

const showA = signal(true)

const completed = computed(() => {
  return todos.value.filter(todo => todo.completed).length;
});

export function MTC(props: any) {
  // const todos = useSignal([
  //   { text: 'MTC RFC', completed: true },
  //   { text: 'MTC Production', completed: false },
  // ]);
  // const completed = useComputed(() => {
  //   return todos.value.filter(todo => todo.completed).length;
  // });
  // useSignalEffect(() => {
  //   console.log(completed.value);
  // });
  // const color = useSignal('blue');
  const ref = useRef(null);
  return (
    <view
      bindtap={(e: MainThread.TouchEvent) => {
        console.log('click');
        // ref.current.setStyleProperties({
        //   'background-color': color.value,
        // });
        // color.value = 'red';

        batch(() => {
          color.value = 'red';

          todos.value[1]!.completed = true;
          todos.value = [...todos.value];

          showA.value = false;
        });
      }}
    >
      {todos.value.map((todo) => {
        return <text ref={ref}>{todo.text}</text>;
      })}

      <text>{completed}</text>
      <text>{color}</text>
      {showA.value && props.btc1 }
      {!showA.value && props.btc2}
    </view>
  );
}
