/* global lynx, __MATH_BUNDLE_URL__ */
import { runOnMainThread, useEffect, useState } from '@lynx-js/react';

function addOnMainThread(bundleName) {
  'main thread';
  const stylesheet = globalThis.__LoadStyleSheet('math:CSS', bundleName);
  if (stylesheet === null) throw new Error('Missing math:CSS section');
  globalThis.__AdoptStyleSheet(stylesheet);
  const math = lynx.loadScript('math__main-thread', { bundleName });
  return math.add(6, 7);
}

async function loadResults() {
  'background only';
  const response = await lynx.fetchBundle(__MATH_BUNDLE_URL__, {});
  if (response.code !== 0) throw new Error(response.errorMsg);
  const math = lynx.loadScript('math', { bundleName: response.url });
  const product = math.multiply(6, 7);
  const sum = await runOnMainThread(addOnMainThread)(response.url);
  return { sum, product };
}

export function App() {
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    loadResults().then(setResults, reason => setError(String(reason)));
  }, []);

  return (
    <view className='results'>
      <text className='title'>External bundle results</text>
      {results
        ? (
          <>
            <text className='result positive'>
              Main thread: add(6, 7) = {results.sum}
            </text>
            <text className='result positive'>
              Background thread: multiply(6, 7) = {results.product}
            </text>
          </>
        )
        : <text className='result'>{error || 'Loading math bundle…'}</text>}
    </view>
  );
}
