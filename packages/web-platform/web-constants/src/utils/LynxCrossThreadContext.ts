import type { dispatchCoreContextOnBackgroundEndpoint, Rpc } from '../index.js';
import {
  DispatchEventResult,
  type LynxContextEventTarget,
} from '../types/LynxContextEventTarget.js';

export class LynxCrossThreadContext extends EventTarget
  implements LynxContextEventTarget
{
  constructor(
    private _config: {
      rpc: Rpc;
      receiveEventEndpoint: typeof dispatchCoreContextOnBackgroundEndpoint;
      sendEventEndpoint: typeof dispatchCoreContextOnBackgroundEndpoint;
    },
  ) {
    super();
  }
  postMessage(...args: any[]) {
    console.error('[lynx-web] postMessage not implemented, args:', ...args);
  }
  // @ts-expect-error
  override dispatchEvent(event: ContextCrossThreadEvent) {
    const { rpc, sendEventEndpoint } = this._config;
    rpc.invoke(sendEventEndpoint, [event]);
    return DispatchEventResult.CanceledBeforeDispatch;
  }
  __start() {
    const { rpc, receiveEventEndpoint } = this._config;
    rpc.registerHandler(receiveEventEndpoint, ({ type, data }) => {
      super.dispatchEvent(new MessageEvent(type, { data: data ?? {} }));
    });
  }
}
