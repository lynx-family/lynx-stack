import { Suspense, lazy } from '@lynx-js/react';

const Lazy = lazy(() => import('./lazy.jsx'));

export default function App() {
  return (
    <Suspense fallback={null}>
      <Lazy />
    </Suspense>
  );
}
