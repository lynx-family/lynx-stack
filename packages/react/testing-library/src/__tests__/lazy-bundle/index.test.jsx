import '@testing-library/jest-dom';
import { expect, it } from 'vitest';
import { render, screen, waitForElementToBeRemoved } from '@lynx-js/react/testing-library';
import { Suspense, lazy } from '@lynx-js/react';
import { createRequire } from 'node:module';
import { describe } from 'node:test';

const require = createRequire(import.meta.url);

function LazyComponentLoader({ url }) {
  const ExternalComponent = lazy(() => import(url));
  const InternalComponent = lazy(() => import('./LazyComponent'));

  return (
    <Suspense fallback={<text>loading...</text>}>
      <InternalComponent />
      <ExternalComponent />
    </Suspense>
  );
}

export function App({ url }) {
  return (
    <view>
      <LazyComponentLoader url={url}></LazyComponentLoader>
    </view>
  );
}

describe('lazy bundle', () => {
  it('should render lazy component', async () => {
    const { container } = render(
      <App url={require.resolve('./LazyComponent.jsx')} />,
    );

    expect(container.firstChild).toMatchInlineSnapshot(`
    <view>
      <text>
        loading...
      </text>
    </view>
  `);

    await waitForElementToBeRemoved(() => screen.getByText('loading...'));

    expect(container.firstChild).toMatchInlineSnapshot(`
      <view>
        <text>
          Hello from LazyComponent
        </text>
        <text>
          Hello from LazyComponent
        </text>
      </view>
    `);
  });
});
