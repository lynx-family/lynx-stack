import { Suspense, lazy, useEffect, useState } from '@lynx-js/react';

import './App.css';

const FIRST_SCREEN_BACKGROUND_UPDATE_MS = 8000;

interface FirstScreenMissResource {
  read: () => void;
  resolve: () => void;
}

const noop = () => undefined;

function createFirstScreenMissResource(): FirstScreenMissResource {
  let resolved = false;
  let resolvePromise = noop;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    read() {
      if (!resolved) {
        throw promise;
      }
    },
    resolve() {
      if (!resolved) {
        resolved = true;
        resolvePromise();
      }
    },
  };
}

function delayedImport<T>(
  loader: () => Promise<T>,
  delayMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      void loader().then(resolve, reject);
    }, delayMs);
  });
}

const BasicLazy = lazy(() =>
  delayedImport(() => import('./LazyComponent.js'), 80)
);
const FirstScreenLazy = lazy(() => import('./LazyFirstScreenContent.js'));
const NestedLazy = lazy(() =>
  delayedImport(() => import('./LazyNestedContent.js'), 160)
);
const ParallelLeftLazy = lazy(() =>
  delayedImport(() => import('./LazyParallelLeft.js'), 120)
);
const ParallelRightLazy = lazy(() =>
  delayedImport(() => import('./LazyParallelRight.js'), 220)
);
const RemountLazy = lazy(() =>
  delayedImport(() => import('./LazyRemountContent.js'), 140)
);

function FirstScreenMissGate({
  resource,
}: {
  resource: FirstScreenMissResource;
}) {
  resource.read();
  return <FirstScreenLazy />;
}

export function App() {
  const [dynamicStatus, setDynamicStatus] = useState('dynamic-pending');
  const [firstScreenMissResource] = useState(
    createFirstScreenMissResource,
  );
  const [showRemount, setShowRemount] = useState(true);
  const [remountCycle, setRemountCycle] = useState(0);

  useEffect(() => {
    console.info('Hello, ReactLynx');
    let disposed = false;

    void Promise.all([
      import('./utils/add.js'),
      import('./utils/minus.js'),
      import('./utils/dynamic.js'),
    ]).then(async ([addModule, minusModule, dynamicModule]) => {
      const add = addModule.add(1, 2);
      const minus = minusModule.minus(1, 2);
      console.info('dynamic import dynamic');
      const dynamicAdd = await dynamicModule.dynamicAdd(1, 2);
      console.info('dynamic import add', add);
      console.info('dynamic import minus', minus);
      console.info('dynamic add', dynamicAdd);
      if (!disposed) {
        setDynamicStatus(`dynamic:${minus}/${add}/${dynamicAdd}`);
      }
    });

    const firstScreenTimer = setTimeout(() => {
      firstScreenMissResource.resolve();
    }, FIRST_SCREEN_BACKGROUND_UPDATE_MS);
    const hideTimer = setTimeout(() => {
      setShowRemount(false);
    }, 900);
    const showTimer = setTimeout(() => {
      setRemountCycle(1);
      setShowRemount(true);
    }, 1400);

    return () => {
      disposed = true;
      clearTimeout(firstScreenTimer);
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
    };
  }, [firstScreenMissResource]);

  return (
    <view>
      <view className='Background' />
      <view className='App'>
        <view className='Banner'>
          <text className='Title'>ET lazy bundle</text>
          <text className='Subtitle'>{dynamicStatus}</text>
        </view>
        <view className='Cases'>
          <view className='Case'>
            <text className='CaseTitle'>first-screen miss</text>
            <Suspense
              fallback={<text className='Fallback'>first-screen-fallback</text>}
            >
              <FirstScreenMissGate resource={firstScreenMissResource} />
            </Suspense>
          </view>

          <view className='Case'>
            <text className='CaseTitle'>basic</text>
            <Suspense
              fallback={<text className='Fallback'>basic-loading</text>}
            >
              <BasicLazy marker='basic-ready' />
            </Suspense>
          </view>

          <view className='Case'>
            <text className='CaseTitle'>nested</text>
            <Suspense
              fallback={<text className='Fallback'>outer-loading</text>}
            >
              <view className='NestedHost'>
                <text className='InlineMarker'>outer-ready</text>
                <Suspense
                  fallback={<text className='Fallback'>inner-loading</text>}
                >
                  <NestedLazy />
                </Suspense>
              </view>
            </Suspense>
          </view>

          <view className='Case'>
            <text className='CaseTitle'>parallel</text>
            <view className='Parallel'>
              <Suspense
                fallback={<text className='Fallback'>left-loading</text>}
              >
                <ParallelLeftLazy />
              </Suspense>
              <Suspense
                fallback={<text className='Fallback'>right-loading</text>}
              >
                <ParallelRightLazy />
              </Suspense>
            </view>
          </view>

          <view className='Case'>
            <text className='CaseTitle'>remount</text>
            <Suspense
              fallback={<text className='Fallback'>remount-loading</text>}
            >
              {showRemount
                ? <RemountLazy cycle={remountCycle} />
                : <text className='InlineMarker'>remount-hidden</text>}
            </Suspense>
          </view>
        </view>
      </view>
    </view>
  );
}
