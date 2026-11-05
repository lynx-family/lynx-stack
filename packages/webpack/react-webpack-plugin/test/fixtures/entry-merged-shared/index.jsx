import { Suspense, lazy } from '@lynx-js/react';

const Page = lazy(() => import('./page.jsx'));

export default function App() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
