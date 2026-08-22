interface AppProps {
  multiplePages?: boolean;
  onTap?: () => void;
  pageId?: string;
  pageKey?: string;
  pageRef?: unknown;
  refMode?: 'direct' | 'spread';
  withPage?: boolean;
}

export function App({
  multiplePages = false,
  onTap,
  pageId = 'screen',
  pageKey = 'page',
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
  if (multiplePages) {
    return (
      <>
        <page key='first-page'>
          <view id='first-page-child' />
        </page>
        <page key='second-page'>
          <view id='second-page-child' />
        </page>
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
