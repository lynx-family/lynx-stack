import(
  /* webpackChunkName: "web-core-main-chunk" */
  /* webpackFetchPriority: "high" */
  /* webpackPrefetch: true */
  /* webpackPreload: true */
  './mainthread/LynxView.js'
);
import(
  /* webpackMode: "eager" */
  /* webpackFetchPriority: "high" */
  /* webpackPrefetch: true */
  /* webpackPreload: true */
  // @ts-ignore
  '../../binary/client/client.js'
);
import '../../css/index.css';
export type { LynxViewElement } from './mainthread/LynxView.js';
