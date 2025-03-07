import '@lynx-js/web-core';
import type { LynxView } from '@lynx-js/web-core';
import '@lynx-js/web-core/index.css';
import '@lynx-js/web-elements/index.css';
import '@lynx-js/web-elements/all';

import QrScanner from 'qr-scanner';

const video = document.getElementById('qr-scanner') as HTMLVideoElement;
const lynxView = document.getElementById('lynx-view') as LynxView;
const backButton = document.getElementById('back-button') as HTMLDivElement;
const nav = document.getElementById('nav') as HTMLDivElement;

const homepage = 'preinstalled/homepage.json';

backButton.addEventListener('click', () => {
  setLynxViewUrl(homepage);
});

const theme = window.matchMedia('(prefers-color-scheme: dark)').matches
  ? 'Dark'
  : 'Light';

const qrScanner = new QrScanner(video, (result) => {
  console.log('qr', result);
  lynxView.style.visibility = 'visible';
  qrScanner.stop();
  const data = result.data;
  setLynxViewUrl(data);
}, {
  highlightScanRegion: true,
  highlightCodeOutline: true,
});

const nativeModulesUrl = URL.createObjectURL(
  new Blob(
    [`
export default {
  ExplorerModule:{
    openSchema(value) {
      this.nativeModulesCall('openSchema', value)
    },
    openScan() {
      this.nativeModulesCall('openScan')
    }
  }
}
      `],
    { type: 'text/javascript' },
  ),
);

lynxView.onNativeModulesCall = (nm, data) => {
  if (nm === 'openScan') {
    lynxView.style.visibility = 'hidden';
    qrScanner.start();
  } else if (nm === 'openSchema') {
    setLynxViewUrl(data);
  }
};
lynxView.nativeModulesUrl = nativeModulesUrl;
lynxView.globalProps = { theme };
setLynxViewUrl(homepage);
window.addEventListener('message', (ev) => {
  if (ev.data && ev.data.method === 'setLynxViewUrl' && ev.data.url) {
    setLynxViewUrl(ev.data.url);
  }
});
window.parent?.postMessage('webExplorerReady');

function setLynxViewUrl(url: string) {
  if (url === homepage) {
    nav.style.display = 'none';
    lynxView.url = url;
    nav.style.setProperty('--bar-color', null);
  } else {
    const { searchParams } = new URL(url);
    if (searchParams.has('bar_color')) {
      nav.style.setProperty('--bar-color', `#${searchParams.get('bar_color')}`);
    }
    if (
      searchParams.has('fullscreen')
      && searchParams.get('fullscreen') === 'true'
    ) {
      nav.style.display = 'none';
    } else {
      nav.style.display = 'flex';
    }
    lynxView.url = url;
  }
}
