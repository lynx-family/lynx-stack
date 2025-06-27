const { React } = window;

export const PreactLogoTextSvg: React.FC = () => {
  return React.createElement(
    'svg',
    {
      width: '100%',
      height: '100%',
      viewBox: '-256 -256 1900 512',
      version: '1.1',
      xmlns: 'http://www.w3.org/2000/svg',
      xmlnsXlink: 'http://www.w3.org/1999/xlink',
      xmlSpace: 'preserve',
    },
    React.createElement('path', {
      d: 'M0,-256 221.7025033688164,-128 221.7025033688164,128 0,256 -221.7025033688164,128 -221.7025033688164,-128z',
      fill: '#673ab8',
    }),
    React.createElement('ellipse', {
      cx: '0',
      cy: '0',
      strokeWidth: '16px',
      rx: '75px',
      ry: '196px',
      fill: 'none',
      stroke: 'white',
      transform: 'rotate(52.5)',
    }),
    React.createElement('ellipse', {
      cx: '0',
      cy: '0',
      strokeWidth: '16px',
      rx: '75px',
      ry: '196px',
      fill: 'none',
      stroke: 'white',
      transform: 'rotate(-52.5)',
    }),
    React.createElement('circle', {
      cx: '0',
      cy: '0',
      r: '34',
      fill: 'white',
    }),
    React.createElement('text', {
      x: '250',
      y: '128',
      fontSize: '350',
      fontFamily: 'Helvetica Neue, helvetica, arial',
      fontWeight: '300',
      fill: '#673ab8',
      children: 'PREACT',
    }),
  );
};
