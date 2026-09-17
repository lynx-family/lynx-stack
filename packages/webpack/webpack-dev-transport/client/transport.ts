// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * Client is the interface that {@link https://github.com/webpack/webpack-dev-server/blob/48f56d57775dc4cf78bfcf51c3761adf852b0310/client-src/socket.js#L30 | `webpack-dev-server`} uses for a websocket client.
 *
 * @public
 */
export interface Client {
  /** Register a open callback */
  onOpen(callback: () => void): void;
  /** Register a close callback */
  onClose(callback: () => void): void;
  /** Register a message callback */
  onMessage(callback: (message: string) => void): void;
}

export type ClientClass = new(url: string) => Client;

/**
 * The ContextProxy of Lynx. Can listen messages from devtool and send message to devtool.
 */
interface ContextProxy {
  postMessage<T>(message: T): void;
  addEventListener(
    type: string,
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  removeEventListener(
    type: string,
    listener: <T>(event: MessageEvent<T>) => void,
  ): void;
}
declare const lynx: {
  getDevtool(): ContextProxy;
};

/**
 * LynxTransportClient is the client transport implementation for webpack-dev-server.
 * It can be used in the
 * {@link https://webpack.js.org/configuration/dev-server/#websockettransport | `devServer.client.webSocketTransport`}
 * configuration of webpack.
 *
 * @example
 * ```js
 * // webpack.config.js
 * import { createRequire } from 'node:module'
 *
 * const require = createRequire(import.meta.url)
 * export default {
 *   devServer: {
 *     client: {
 *       webSocketTransport: require.resolve('@lynx-js/webpack-dev-transport/client')
 *     },
 *   }
 * }
 * ```
 *
 * @public
 */
export class LynxTransportClient implements Client {
  /** @internal */
  static EventType = 'message';

  /** {@inheritdoc Client.onOpen} */
  onOpen(callback: () => void): void {
    callback();
  }

  /** {@inheritdoc Client.onClose} */

  onClose(_callback: () => void): void {
    // webpack-dev-server will retry in the `callback`
    // but `onOpen` in Lynx will never fail.
  }

  /** {@inheritdoc Client.onMessage} */
  onMessage(
    callback: (message: string) => void,
  ): void {
    lynx.getDevtool().addEventListener(
      LynxTransportClient.EventType,
      (event) => {
        const CDP = JSON.parse(
          (event.data as { type: string; message: string }).message,
        ) as {
          method: string;
          params: { data: string };
        };
        if (CDP.method === LynxTransportClient.EventType) {
          callback(CDP.params.data);
        }
      },
    );
  }
}
