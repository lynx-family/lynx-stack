import {
  defineMainThreadObjectType,
  root,
  runOnMainThread,
  useCallback,
  useMainThreadObject,
  useState,
} from '@lynx-js/react';

import {
  createProbe,
  getGeneration,
} from './main-thread-object-generation.js' with { runtime: 'shared' };

const objectType = defineMainThreadObjectType({
  type: '@reload-lab/factory-generation',
  create: (initial: number) => {
    'main thread';
    return createProbe(initial);
  },
});

export function App() {
  const probe = useMainThreadObject(objectType, 42);
  const [result, setResult] = useState('Not read');
  const read = useCallback(() => {
    void runOnMainThread(() => {
      'main thread';
      return JSON.stringify({
        entryGeneration: getGeneration(),
        objectGeneration: probe.generation,
        factoryCreateCount: probe.created,
        initial: probe.initial,
      });
    })().then(value => {
      console.info('[mto-reload-probe]', value);
      setResult(value);
    }).catch(error => setResult(String(error)));
  }, [probe]);
  const reload = useCallback(() => {
    (NativeModules as unknown as {
      LynxTestModule: { reloadTemplate(data: object, props: object): void };
    })
      .LynxTestModule.reloadTemplate({}, {});
  }, []);
  return (
    <view
      style={{ padding: '24px', backgroundColor: '#ffffff', height: '100%' }}
    >
      <text style={{ fontSize: '22px', color: '#111111' }}>
        MainThreadObject factory reload
      </text>
      <text style={{ fontSize: '16px', color: '#111111', marginTop: '20px' }}>
        {result}
      </text>
      <view
        bindtap={read}
        style={{
          padding: '24px',
          marginTop: '24px',
          backgroundColor: '#66ddcc',
        }}
      >
        <text>READ GENERATIONS</text>
      </view>
      <view
        bindtap={reload}
        style={{
          padding: '24px',
          marginTop: '24px',
          backgroundColor: '#6699ff',
        }}
      >
        <text>RELOAD</text>
      </view>
    </view>
  );
}
root.render(<App />);
