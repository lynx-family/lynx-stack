import { root } from '@lynx-js/react';

import { lazy, Suspense, LazyBundleResponseListener } from '@lynx-js/react';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const App = lazy(() => sleep(1000).then(() => import('./App.jsx')));

root.render(
  <Suspense>
    <LazyBundleResponseListener onResponse={console.log}>
      <App />
    </LazyBundleResponseListener>
  </Suspense>,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
