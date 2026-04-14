import { Suspense, lazy, useState } from '@lynx-js/react';

import './App.css';

const LazyPanel = lazy(() => import('./LazyPanel.js'));

export function App() {
  const [showLazyPanel, setShowLazyPanel] = useState(false);

  return (
    <view className='Screen'>
      <view className='Hero'>
        <text className='Eyebrow'>ReactLynx UI Source Map</text>
        <text className='Title'>Emit debugMetadataUrl from beforeEncode</text>
        <text className='Description'>
          This example turns on UI source map emission explicitly and injects a
          mocked uploaded URL into tasm encode data.
        </text>
      </view>

      <view
        className='Button'
        bindtap={() => {
          setShowLazyPanel(value => !value);
        }}
      >
        <text className='ButtonLabel'>
          {showLazyPanel ? 'Hide lazy panel' : 'Load lazy panel'}
        </text>
      </view>

      <Suspense
        fallback={
          <text className='Hint'>
            Uploading debug metadata and loading chunk...
          </text>
        }
      >
        {showLazyPanel
          ? <LazyPanel />
          : (
            <text className='Hint'>
              Tap the button to load a lazy component and generate a second
              debug metadata URL.
            </text>
          )}
      </Suspense>
    </view>
  );
}
