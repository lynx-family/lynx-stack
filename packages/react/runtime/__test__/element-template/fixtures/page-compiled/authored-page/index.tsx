import { useEffect } from '@lynx-js/react';

interface AppProps {
  onCleanup?: () => void;
  onTap?: () => void;
  pageId?: string;
  pageKey?: string;
  pageKeys?: string[];
  pageRef?: unknown;
  refMode?: 'direct' | 'spread';
  withPage?: boolean;
}

export function App({
  onTap,
  pageId = 'screen',
  pageKey = 'page',
  pageKeys,
  pageRef,
  refMode = 'spread',
  withPage = true,
}: AppProps) {
  const child = (
    <view id='child'>
      <text>child</text>
    </view>
  );
  if (!withPage) {
    return (
      <view id='without-page'>
        <text>without page</text>
      </view>
    );
  }
  if (pageKeys) {
    return (
      <>
        {pageKeys.map(pageKey => (
          <page key={pageKey}>
            <view id={`${pageKey}-child`} />
          </page>
        ))}
      </>
    );
  }
  const pageProps = {
    id: pageId,
    className: 'screen',
    bindtap: onTap,
    ref: pageRef,
  };
  if (refMode === 'direct') {
    return (
      <page
        key={pageKey}
        id={pageId}
        className='screen'
        bindtap={onTap}
        ref={pageRef}
      >
        {child}
      </page>
    );
  }
  return (
    <page key={pageKey} {...pageProps}>
      {child}
    </page>
  );
}

export function AppWithCleanup(props: AppProps) {
  useEffect(() => props.onCleanup, [props.onCleanup]);
  return <App {...props} />;
}
