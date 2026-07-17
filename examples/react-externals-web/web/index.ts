import '@lynx-js/web-elements/index.css';
import '@lynx-js/web-core/client';
import '@lynx-js/preact-devtools/web-host';

const view = document.createElement('lynx-view');
view.setAttribute('url', '/main.web.bundle');

if (process.env['NODE_ENV'] === 'development') {
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  const devtoolsChannelName = `preact-devtools-${crypto.randomUUID()}`;
  view.setAttribute(
    'global-props',
    JSON.stringify({ preactDevtoolsChannel: devtoolsChannelName }),
  );
}

view.style.cssText = 'display:block;width:100vw;height:100vh';
document.body.append(view);
