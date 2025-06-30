const { React } = window;

export const NotSupported: React.FC<{
  minSdkVersion: string;
}> = ({
  minSdkVersion,
}) => {
  return React.createElement(
    'div',
    {
      style: {
        margin: 'auto',
        maxWidth: '600px',
        fontSize: '20px',
        padding: '32px',
        backgroundColor: 'white',
        color: 'black',
      },
    },
    [
      `The current version of LynxSDK`,
      React.createElement(
        'span',
        {
          style: {
            fontWeight: 600,
          },
        },
        ` ${window.info.sdkVersion} `,
      ),
      `is not supported by Preact Devtools. The minimum required LynxSDK version of ${window.info.App} is ${minSdkVersion}. Please upgrade to the latest version.`,
    ],
  );
};
