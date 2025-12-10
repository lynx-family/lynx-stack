import '@lynx-js/web-core';
import '@lynx-js/web-core/index.css';
import '@lynx-js/web-elements/all';
import '@lynx-js/web-elements/index.css';

const lynxView = document.createElement('lynx-view');
lynxView.style.width = '100vw';
lynxView.style.height = '100vh';
document.body.appendChild(lynxView);
// @ts-ignore
lynxView.setAttribute('url', 'http://10.91.84.156:3000/main.web.bundle2');
