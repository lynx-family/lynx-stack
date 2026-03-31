import { root, lazy, Suspense } from '@lynx-js/react';

const LazyComponent = lazy(
  () =>
    import(
      './lazy.jsx',
      {
        with: { type: 'component' },
      }
    ),
);

export default function App() {
  return (
    <view>
      <Suspense fallback={<text id='fallback'>Loading...</text>}>
        <LazyComponent />
      </Suspense>
    </view>
  );
}

root.render(<App></App>);
