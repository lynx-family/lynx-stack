import type {
  StartMainThreadContextConfig,
  RpcCallType,
  updateDataEndpoint,
} from '@lynx-js/web-constants';
import type { MainThreadRuntime } from '@lynx-js/web-mainthread-apis';
import { Rpc } from '@lynx-js/web-worker-rpc';

const {
  prepareMainThreadAPIs,
} = await import('@lynx-js/web-mainthread-apis');

export function createRenderAllOnUI(
  mainToBackgroundRpc: Rpc,
  shadowRoot: ShadowRoot,
  markTimingInternal: (
    timingKey: string,
    pipelineId?: string,
    timeStamp?: number,
  ) => void,
  callbacks: {
    onError?: () => void;
  },
) {
  if (!globalThis.module) {
    Object.assign(globalThis, { module: {} });
  }
  const { startMainThread } = prepareMainThreadAPIs(
    mainToBackgroundRpc,
    shadowRoot,
    document.createElement.bind(document),
    () => {},
    markTimingInternal,
    () => {
      callbacks.onError?.();
    },
  );
  let runtime!: MainThreadRuntime;
  const start = async (configs: StartMainThreadContextConfig) => {
    const mainThreadRuntime = startMainThread(configs);
    runtime = await mainThreadRuntime;
  };
  const updateDataMainThread: RpcCallType<typeof updateDataEndpoint> = async (
    ...args
  ) => {
    runtime.updatePage?.(...args);
  };
  return {
    start,
    updateDataMainThread,
  };
}
