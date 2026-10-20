import {
  root,
  runOnBackground,
  runOnMainThread,
  useCallback,
  useInitData,
  useState,
} from '@lynx-js/react';

// Delay only a real old return message, without changing its payload or IDs.
// Deliver it when the next runtime's real call returns.
if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__) {
  const key = Symbol.for('__RELOAD_LAB_RETURN_GATE__');
  const shared = lynx as unknown as Record<symbol, boolean>;
  if (!shared[key]) {
    shared[key] = true;
    const context = lynx.getJSContext();
    const dispatch = context.dispatchEvent.bind(context);
    let pending: Parameters<typeof context.dispatchEvent>[0] | undefined;
    context.dispatchEvent = event => {
      if (
        event.type === 'Lynx.Worklet.FunctionCallRet'
        && typeof event.data === 'string'
      ) {
        const data = JSON.parse(event.data) as {
          returnValue?: unknown;
          resolveId: number;
        };
        if (
          typeof data.returnValue === 'string'
          && data.returnValue.startsWith('old:')
        ) {
          console.info(
            `[stale-main-return] held resolveId=${data.resolveId} value=${data.returnValue}`,
          );
          pending = event;
          return 0;
        }
        if (
          typeof data.returnValue === 'string'
          && data.returnValue.startsWith('fresh:') && pending
        ) {
          console.info(
            `[stale-main-return] flushing old return before resolveId=${data.resolveId} value=${data.returnValue}`,
          );
          dispatch(pending);
          pending = undefined;
        }
      }
      return dispatch(event);
    };
  }
}

export function StaleMainThreadReturnProbe() {
  const { generation = 0 } = useInitData() as { generation?: number };
  const [result, setResult] = useState('Ready');
  const reload = useCallback((next: number) => {
    'background-only';
    (NativeModules as unknown as {
      LynxTestModule: { reloadTemplate(data: object, props: object): void };
    })
      .LynxTestModule.reloadTemplate({ generation: next }, {});
  }, []);

  const readFresh = useCallback(() => {
    if (!generation) return;
    void runOnMainThread((value: number) => {
      'main thread';
      return `fresh:${value}`;
    })(generation).then(value => {
      const message = `expected=fresh:${generation}, received=${
        String(value)
      }, stale=${value !== `fresh:${generation}`}`;
      console.info(`[stale-main-return] ${message}`);
      setResult(message);
    });
  }, [generation]);

  return (
    <view style={{ padding: '28px', backgroundColor: '#ffffff' }}>
      <text style={{ fontSize: '24px', color: '#111111' }}>
        Stale main-thread return probe
      </text>
      <text style={{ marginTop: '20px', color: '#111111' }}>
        Generation: {generation}
      </text>
      <text style={{ marginTop: '20px', color: '#111111' }}>
        A real old reply is held until the next call returns.
      </text>
      <text style={{ marginTop: '20px', color: '#c00000' }}>{result}</text>
      <view
        style={{
          marginTop: '28px',
          padding: '20px',
          backgroundColor: '#1769ff',
        }}
        bindtap={() => {
          void runOnMainThread((value: number) => {
            'main thread';
            void runOnBackground(reload)(value + 1);
            return `old:${value}`;
          })(generation);
        }}
      >
        <text style={{ color: '#ffffff' }}>Start call and reload</text>
      </view>
      <view
        bindtap={readFresh}
        style={{
          marginTop: '20px',
          padding: '20px',
          backgroundColor: '#1769ff',
        }}
      >
        <text style={{ color: '#ffffff' }}>Read fresh result after reload</text>
      </view>
    </view>
  );
}

root.render(<StaleMainThreadReturnProbe />);
