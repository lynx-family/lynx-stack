import '@lynx-js/web-elements/index.css';
import '@lynx-js/web-core/client';

const view = document.createElement('lynx-view');
view.setAttribute('url', '/main.web.bundle');
view.style.cssText = 'display:block;width:100vw;height:100vh';
document.body.append(view);
