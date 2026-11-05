import { Suspense, lazy } from '@lynx-js/react';

import './App.css';

const PageA = lazy(() => import('./PageA.js'));
const PageB = lazy(() => import('./PageB.js'));

export function App() {
  return (
    <scroll-view className='screen' scroll-orientation='vertical'>
      <view className='content'>
        <view className='eyebrow'>
          <view className='status-dot' />
          <text className='eyebrow-text'>REACT LYNX / LAZY BUNDLES</text>
        </view>
        <text className='title'>Two pages.{'\n'}One shared module.</text>
        <text className='subtitle'>
          Two independently loaded pages share one module. See how they work
          together.
        </text>

        <view className='section-heading'>
          <text className='section-title'>Lazy pages</text>
          <text className='section-caption'>01 — 02</text>
        </view>
        <Suspense fallback={<LoadingPage name='Page A' />}>
          <PageA />
        </Suspense>
        <Suspense fallback={<LoadingPage name='Page B' />}>
          <PageB />
        </Suspense>

        <view className='note'>
          <text className='note-title'>Try tapping a card</text>
          <text className='note-body'>
            Tapping calls shared.ts on the main thread and logs the result to
            the console. Both cards use styles from shared.css.
          </text>
        </view>
        <text className='footer'>LYNX STACK · SHARED CHUNK DEMO</text>
      </view>
    </scroll-view>
  );
}

function LoadingPage({ name }: { name: string }) {
  return (
    <view className='loading-card'>
      <text className='loading-title'>{name}</text>
      <text className='loading-description'>Loading lazy bundle…</text>
    </view>
  );
}
