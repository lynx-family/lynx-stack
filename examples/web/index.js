import '@lynx-js/web-core-wasm/client';
import '@lynx-js/web-core-wasm/index.css';

const lynxView = document.createElement('lynx-view');
lynxView.style.width = '100vw';
lynxView.style.height = '100vh';
// @ts-ignore
lynxView.setAttribute('url', 'http://10.91.84.156:3000/main.web.bundle');
document.body.appendChild(lynxView);
