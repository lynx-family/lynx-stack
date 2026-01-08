import '@lynx-js/web-core';
import type { LynxView } from '@lynx-js/web-core';
import '@lynx-js/web-core/index.css';
import '@lynx-js/web-elements/index.css';
import '@lynx-js/web-elements/all';

const video = document.getElementById('qr-scanner') as HTMLVideoElement;
let lynxView = document.getElementById('lynx-view') as LynxView;
const backButton = document.getElementById('back-button') as HTMLDivElement;
const nav = document.getElementById('nav') as HTMLDivElement;

const homepage = 'preinstalled/homepage.json';

backButton.addEventListener('click', () => {
  setLynxViewUrl(homepage);
});

const toast = document.getElementById('toast-container') as HTMLDivElement;
function showToast(msg: string, duration = 2000) {
  toast.innerHTML = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

const ERROR_MSG =
  'The scanned product format is incorrect.<br/>Please select a <b style="color:red">Web Bundle</b> for scanning.';

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  let msg = '';
  if (reason instanceof Error) {
    msg = reason.message;
  } else {
    msg = String(reason);
  }

  if (
    msg.includes('SyntaxError')
    || msg.includes('is not valid JSON')
    || msg.includes('JSON')
  ) {
    event.preventDefault();
    showToast(ERROR_MSG);
  }
});

window.addEventListener('error', (event) => {
  console.log('global error', event.message);
  const msg = event.message || '';
  if (
    msg.includes('SyntaxError')
    || msg.includes('is not valid JSON')
    || msg.includes('JSON')
  ) {
    showToast(ERROR_MSG);
  }
});

// @ts-expect-error
const qrScanner = new QrScanner(video, async (result) => {
  console.log('qr', result);
  const data = result.data;
  qrScanner.stop();
  lynxView.style.visibility = 'visible';
  setLynxViewUrl(data);
}, {
  highlightScanRegion: true,
  highlightCodeOutline: true,
});

setLynxViewUrl(homepage);
window.addEventListener('message', (ev) => {
  if (ev.data && ev.data.method === 'setLynxViewUrl' && ev.data.url) {
    const parent = lynxView.parentElement!;
    lynxView.remove();
    lynxView = document.createElement('lynx-view') as LynxView;
    lynxView.setAttribute(
      'style',
      'flex: 0 1 100vh; height:100vh;width:100vw;',
    );
    parent.append(lynxView);
    setLynxViewUrl(ev.data.url);
  }
});

async function setLynxViewUrl(url: string) {
  if (url !== homepage) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      JSON.parse(text);
    } catch (e) {
      console.error('Check url failed', e);
      showToast(ERROR_MSG);
      return;
    }
  }

  const theme = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'Dark'
    : 'Light';
  lynxView.onNativeModulesCall = (nm, data) => {
    if (nm === 'openScan') {
      lynxView.style.visibility = 'hidden';
      qrScanner.start();
    } else if (nm === 'openSchema') {
      setLynxViewUrl(data);
    }
  };
  lynxView.globalProps = { theme };
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
