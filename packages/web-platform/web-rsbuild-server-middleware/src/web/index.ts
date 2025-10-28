import '@lynx-js/web-core';
import '@lynx-js/web-elements/all';
import '@lynx-js/web-core/index.css';
import '@lynx-js/web-elements/index.css';
import './index.css';
import type { LynxView } from '@lynx-js/web-core';

const INIT_DATA_KEY = 'lynx-web-core-init-data';
const GLOBAL_PROPS_KEY = 'lynx-web-core-global-props';

const lynxView = document.createElement('lynx-view') as LynxView;
document.body.appendChild(lynxView);
const searchParams = new URLSearchParams(document.location.search);
const casename = searchParams.get('casename');

function start() {
  if (casename) {
    let initData = {};
    try {
      let initDataStr = localStorage.getItem(INIT_DATA_KEY);
      if (initDataStr) {
        initData = JSON.parse(initDataStr);
      }
    } catch {
      console.error(
        'Failed to parse initData from localStorage, use empty object instead.',
      );
    }
    let globalProps = {};
    try {
      let globalPropsStr = localStorage.getItem(GLOBAL_PROPS_KEY);
      if (globalPropsStr) {
        globalProps = JSON.parse(globalPropsStr);
      }
    } catch {
      console.error(
        'Failed to parse globalProps from localStorage, use empty object instead.',
      );
    }
    lynxView.globalProps = globalProps;
    lynxView.initData = initData;
    lynxView.url = casename;
  }
}

function setInitData(initData: unknown) {
  localStorage.setItem(INIT_DATA_KEY, JSON.stringify(initData));
  start();
}
setInitData.description =
  'Set the initData for lynx-view, which will be used when the page loads.';

function setGlobalProps(globalProps: unknown) {
  localStorage.setItem(GLOBAL_PROPS_KEY, JSON.stringify(globalProps));
  start();
}
setGlobalProps.description =
  'Set the globalProps for lynx-view, which will be used when the page loads.';

function help() {
  console.info(
    `  _  __     ___   ___   __ __          ________ ____    _____  _            _______ ______ ____  _____  __  __ 
 | | \\ \\   / / \\ | \\ \\ / / \\ \\        / /  ____|  _ \\  |  __ \\| |        /\\|__   __|  ____/ __ \\|  __ \\|  \\/  |
 | |  \\ \\_/ /|  \\| |\\ V /   \\ \\  /\\  / /| |__  | |_) | | |__) | |       /  \\  | |  | |__ | |  | | |__) | \\  / |
 | |   \\   / | . \\ | > <     \\ \\/  \\/ / |  __| |  _ <  |  ___/| |      / /\\ \\ | |  |  __|| |  | |  _  /| |\\/| |
 | |____| |  | |\\  |/ . \\     \\  /\\  /  | |____| |_) | | |    | |____ / ____ \\| |  | |   | |__| | | \\ \\| |  | |
 |______|_|  |_| \\_/_/ \\_\\     \\/  \\/   |______|____/  |_|    |______/_/    \\_\\_|  |_|    \\____/|_|  \\_\\_|  |_|`,
  );
  console.table(
    Object.entries(methods).map(([name, fn]) => ({
      Method: name + '()',
      Description: fn.description || 'No description available',
    }), ['Method', 'Description']),
  );
}
help.description = 'Print all available methods and their descriptions.';

const methods = {
  setInitData,
  setGlobalProps,
  help,
};

Object.assign(globalThis, methods);

help();
start();
