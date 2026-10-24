import {
  root,
  runOnBackground,
  useCallback,
  useInitData,
  useState,
} from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

export function StaleBackgroundCallbackProbe() {
  const { generation = 0 } = useInitData() as { generation?: number };
  const [lastCall, setLastCall] = useState('No unmount call received');
  const receiveUnmount = useCallback((sender: number) => {
    'background-only';
    const result = `sender=${sender}, receiver=${generation}, stale=${
      sender !== generation
    }`;
    console.info(`[stale-background-probe] ${result}`);
    if (sender !== generation) setLastCall(result);
  }, [generation]);
  const ref = useCallback((element: MainThread.Element | null) => {
    'main thread';
    console.info(
      `[stale-background-probe] ref ${
        element ? 'mount' : 'unmount'
      } generation=${generation}`,
    );
    if (!element) {
      void runOnBackground(receiveUnmount)(generation);
    }
  }, [generation, receiveUnmount]);

  return (
    <view style={{ padding: '28px', backgroundColor: '#ffffff' }}>
      <text style={{ fontSize: '24px', color: '#111111' }}>
        Stale background callback probe
      </text>
      <text style={{ marginTop: '20px', color: '#111111' }}>
        Generation: {generation}
      </text>
      <text
        main-thread:ref={ref}
        style={{ marginTop: '20px', color: '#111111' }}
      >
        Unmount sends a background call
      </text>
      <text style={{ marginTop: '20px', color: '#c00000' }}>{lastCall}</text>
      <view
        style={{
          marginTop: '28px',
          padding: '20px',
          backgroundColor: '#1769ff',
        }}
        bindtap={() => {
          (NativeModules as unknown as {
            LynxTestModule: {
              reloadTemplate(data: object, props: object): void;
            };
          }).LynxTestModule.reloadTemplate({ generation: generation + 1 }, {});
        }}
      >
        <text style={{ color: '#ffffff' }}>
          Reload to generation {generation + 1}
        </text>
      </view>
    </view>
  );
}

root.render(<StaleBackgroundCallbackProbe />);
