import '@lynx-js/web-core';
import '@lynx-js/web-elements/all';
import '@lynx-js/web-core/index.css';
import '@lynx-js/web-elements/index.css';
import './index.css';
import type { LynxView } from '@lynx-js/web-core';

const lynxView = document.createElement('lynx-view');
document.body.appendChild(lynxView) as LynxView;
const searchParams = new URLSearchParams(document.location.search);
const casename = searchParams.get('casename');
if (casename) {
  lynxView.setAttribute('url', casename);
}
