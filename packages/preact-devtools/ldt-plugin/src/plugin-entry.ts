import { setupInlineDevtools } from '../../src/shells/inline/index';
import { PreactLogoTextSvg } from './components/preact-logo-text-svg';
import { LynxBlackLogoSvg } from './components/lynx-black-logo-svg';
import { NotSupported } from './components/not-supported';
import setup from './setup';
import { options } from 'preact';

let minSdkVersion = '2.18.8';
const isSupported = ({
  info,
  compareVersions,
}: {
  info: typeof window.info;
  compareVersions: typeof window.compareVersions;
}) => {
  return compareVersions(info.sdkVersion, minSdkVersion) >= 0;
};
const { React } = window;

// Our "forked" preact requires `options.document` to be defined
options.document = document;

const PreactDevtoolsPanel: React.FC<
  typeof window.preactDevtoolsLDTCtx.devtoolsProps
> = ({
  isOSSLynxDevtool = false,
  addEventListener,
  postMessage,
  addOnScreenCastPanelUINodeIdSelectedListener,
  onPreactDevtoolsPanelUINodeIdSelected,
}) => {
  const supported = isOSSLynxDevtool
    || isSupported({
      info: window.info,
      compareVersions: window.compareVersions,
    });

  React.useEffect(() => {
    if (!supported) {
      return;
    }

    // @ts-expect-error
    window.preactDevtoolsLDTCtx = {};
    window.preactDevtoolsLDTCtx.devtoolsProps = {
      addEventListener,
      postMessage,
      isOSSLynxDevtool,
      addOnScreenCastPanelUINodeIdSelectedListener,
      onPreactDevtoolsPanelUINodeIdSelected,
    };

    setup();

    const container = document.getElementById('preact-devtools-container')!;
    setupInlineDevtools(container, window.preactDevtoolsLDTCtx);
  }, []);

  console.log('preact react', React);

  return React.createElement(
    'div',
    {
      id: 'preact-devtools-container',
      style: {
        height: '100%',
        fontSize: '14px',
        ...(supported
          ? {}
          : {
            overflow: 'scroll',
          }),
      },
    },
    supported
      ? null
      : [
        React.createElement(
          'div',
          {
            style: {
              margin: 'auto',
              maxWidth: '600px',
              padding: '48px',
              fontSize: '40px',
              backgroundColor: 'white',
              color: 'black',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            },
          },
          [
            React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                },
              },
              React.createElement(PreactLogoTextSvg, {}),
            ),
            '❤️',
            React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '16px',
                },
              },
              React.createElement(LynxBlackLogoSvg, {}),
            ),
          ],
        ),
        React.createElement(
          'div',
          {
            style: {
              width: '100%',
              fontSize: '32px',
              padding: '32px',
              backgroundColor: 'white',
              color: 'black',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
            },
          },
          React.createElement(
            'a',
            {
              href:
                'https://github.com/lynx-family/lynx-stack/tree/main/packages/preact-devtools',
              target: '_blank',
            },
            'Preact Devtools for ReactLynx',
          ),
        ),
        React.createElement(NotSupported, {
          minSdkVersion,
        }),
      ],
  );
};

export default PreactDevtoolsPanel;
