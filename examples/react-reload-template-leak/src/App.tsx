import { useEffect, useInitData, useState } from '@lynx-js/react';

interface LynxTestModule {
  reloadTemplate(
    data: Record<string, unknown>,
    props: Record<string, unknown>,
  ): void;
}

function testModule(): LynxTestModule | undefined {
  return (NativeModules as unknown as { LynxTestModule?: LynxTestModule })
    .LynxTestModule;
}

export function App(): JSX.Element {
  const initData = useInitData() as { round?: number; target?: number };
  const round = Number(initData?.round ?? 0);
  const target = Number(initData?.target ?? 0);
  // Mounted after the first screen, so every reload tears it down and builds a
  // new one. `input` is used because it stands out by tag in a trace.
  const [late, setLate] = useState(false);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const mountLate = setTimeout(() => setLate(true), 300);
    return () => clearTimeout(mountLate);
  }, []);

  // A reload replaces the whole app, so an auto run rides `initData`: each
  // round schedules the next one until `round` reaches `target`.
  useEffect(() => {
    if (round >= target) {
      return;
    }
    setStatus(`auto reloading ${round} -> ${target}`);
    const next = setTimeout(() => {
      testModule()?.reloadTemplate({ round: round + 1, target }, {});
    }, 1200);
    return () => clearTimeout(next);
  }, [round, target]);

  const reload = (times: number) => {
    const module = testModule();
    if (!module) {
      setStatus('LynxTestModule missing');
      return;
    }
    module.reloadTemplate(
      { round: round + 1, target: times > 1 ? round + times : 0 },
      {},
    );
  };

  return (
    <view style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
      <text style={{ fontSize: '22px', fontWeight: 'bold' }}>
        reloadTemplate leak
      </text>
      <text style={{ marginTop: '8px', fontSize: '16px' }}>
        round: {round} / target: {target}
      </text>
      <text style={{ marginTop: '4px', fontSize: '12px', color: '#888' }}>
        {status}
      </text>

      <view
        bindtap={() =>
          reload(1)}
        style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#2d7ff9',
        }}
      >
        <text style={{ color: '#fff' }}>reload once</text>
      </view>
      <view
        bindtap={() => reload(20)}
        style={{
          marginTop: '8px',
          padding: '12px',
          backgroundColor: '#d93025',
        }}
      >
        <text style={{ color: '#fff' }}>auto reload x20</text>
      </view>

      {late
        ? (
          <input
            style={{
              marginTop: '16px',
              height: '40px',
              border: '1px solid #ccc',
            }}
            value={`round ${round}`}
          />
        )
        : null}
    </view>
  );
}
