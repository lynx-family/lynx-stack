import { Rpc } from '@lynx-js/web-worker-rpc';
export class BTSRpc {
  readonly #rpc: Rpc;
  constructor(
    messagePort: MessagePort,
  ) {
    this.#rpc = new Rpc(messagePort, 'bts-rpc');
  }
}
