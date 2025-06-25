<h2 align="center">@lynx-js/webpack-dev-transport</h2>

A webpack devServer transport implementation for Lynx.

### Client

The client transport can be used in the
[`devServer.client.webSocketTransport`](https://webpack.js.org/configuration/dev-server/#websockettransport)
configuration of `webpack.config.js`.

```js
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export default {
  devServer: {
    client: {
      webSocketTransport: require.resolve(
        '@lynx-js/webpack-dev-transport/client',
      ),
    },
  },
};
```

### Server

The server transport can be used in the
[`devServer.webSocketServer`](https://webpack.js.org/configuration/dev-server/#devserverwebsocketserver)
configuration of `webpack.config.js`.

```js
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { LynxTransportServer } from '@lynx-js/webpack-dev-transport';

export default {
  devServer: {
    allowedHosts: 'all', // disable host checks, which Lynx does not support
    webSocketServer: LynxTransportServer,
  },
};
```
