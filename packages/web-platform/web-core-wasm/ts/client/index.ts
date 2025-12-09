import(
  /* webpackChunkName: "web-core-main-chunk" */
  /* webpackFetchPriority: "high" */
  /* webpackPrefetch: true */
  /* webpackPreload: true */
  './mainthread/LynxView.js'
);
import(
  /* webpackChunkName: "web-core-wasm-file" */
  /* webpackFetchPriority: "high" */
  /* webpackPrefetch: true */
  /* webpackPreload: true */
  '../../binary/client/client_bg.wasm'
);
import '../../index.css';
