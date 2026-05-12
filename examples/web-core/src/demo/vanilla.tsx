import '@lynx-js/web-core/client';

interface VanillaLynxViewProps {
  bundleRoot?: string;
  entry: string;
}

export function VanillaLynxView(props: VanillaLynxViewProps) {
  const { bundleRoot = '/', entry } = props;

  return (
    <div className='vanilla-ynx-view'>
      {/* @ts-expect-error lynx-view is a custom element not recognized by TypeScript */}
      <lynx-view
        url={bundleRoot + entry + '.web.bundle'}
        style={{
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
          containerType: 'size',
          '--rpx-unit': 'calc(100cqw / 750)',
          '--vh-unit': '1cqh',
          '--vw-unit': '1cqw',
        }}
      />
    </div>
  );
}
