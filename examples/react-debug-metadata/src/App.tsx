import { Suspense, lazy, useEffect } from '@lynx-js/react';

import { CrashDemo } from './CrashDemo.jsx';
import { createProducerBundleUrl } from './entry-url.js';

import './App.css';

const LazyComponent = lazy(() =>
  import(createProducerBundleUrl('LazyComponent.lynx.bundle'), {
    with: {
      type: 'component',
    },
  })
);

// ---- host (App.tsx, consumer main.lynx.bundle) inline crash sites ----
// These compile straight into the host main bundle (NOT a dynamic component),
// so a remapped stack should resolve here against the host's release.
function appDeepInner(): never {
  throw new Error('boom from App.tsx deep nested call (host, background)'); // App.tsx appDeepInner
}
function appDeepMid() {
  appDeepInner();
}
function appCrashNested() {
  appDeepMid();
}

function appCrashType() {
  const obj = {} as { missing?: () => void };
  // TypeError: obj.missing is not a function (host)
  return (obj.missing as () => void)();
}

function appCrashThrow() {
  throw new Error('explicit throw new Error (App.tsx host, background)'); // App.tsx appCrashThrow
}

function appCrashMainThread() {
  'main thread';
  throw new Error('boom from App.tsx main-thread (host)'); // App.tsx appCrashMainThread
}

export function App() {
  useEffect(() => {
    console.info('Hello, ReactLynx');
    void import(createProducerBundleUrl('add.lynx.bundle'), {
      with: {
        type: 'component',
      },
    }).then((res: typeof import('./utils/add.js')) => {
      console.info('dynamic import add', res.add(1, 2));
    });
    void import(createProducerBundleUrl('dynamic.lynx.bundle'), {
      with: {
        type: 'component',
      },
    }).then((res: typeof import('./utils/dynamic.js')) => {
      console.info('dynamic import dynamic');
      void res.dynamicAdd(1, 2).then((res) => {
        console.info('dynamic add', res);
      });
    });
  }, []);

  return (
    <scroll-view scroll-y className='App'>
      <view className='Banner'>
        <text className='Title'>Lazy Bundle + 反解 Demo</text>
        <text className='Subtitle'>动态组件加载 + 抛错反解验证</text>
      </view>
      <view className='Suspense'>
        <Suspense fallback={<text>Loading...</text>}>
          <LazyComponent />
        </Suspense>
      </view>

      <view className='crash-section'>
        <text className='crash-title'>Host (App.tsx) — tap to throw</text>
        <view className='crash-row' bindtap={() => appCrashThrow()}>
          <text>H1. throw new Error (host, background)</text>
        </view>
        <view className='crash-row' bindtap={() => appCrashType()}>
          <text>H2. TypeError (host, background)</text>
        </view>
        <view className='crash-row' bindtap={() => appCrashNested()}>
          <text>H3. nested deep stack (host, background)</text>
        </view>
        <view className='crash-row' main-thread:bindtap={appCrashMainThread}>
          <text>H4. main-thread error (host)</text>
        </view>
      </view>

      <CrashDemo />
    </scroll-view>
  );
}
