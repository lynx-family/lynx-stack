import {
  type StartMainThreadContextConfig,
  type RpcCallType,
  type updateDataEndpoint,
  type MainThreadGlobalThis,
  lynxUniqueIdAttribute,
  type WebFiberElementImpl,
} from '@lynx-js/web-constants';
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
  ssr?: {
    ssrHydrateData: string | null;
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
  let mtsGlobalThis!: MainThreadGlobalThis;
  const start = async (configs: StartMainThreadContextConfig) => {
    if (ssr) {
      // the node 1 is the root element <page>, therefore the 0 is just a placeholder
      const lynxUniqueIdToElement: WeakRef<HTMLElement>[] = [
        new WeakRef<HTMLElement>(shadowRoot.firstElementChild as HTMLElement),
      ];
      const allLynxElements = shadowRoot.querySelectorAll<HTMLElement>(
        `[${lynxUniqueIdAttribute}]`,
      );
      const length = allLynxElements.length;
      const ssrPartsMap: Record<string, HTMLElement> = {};
      for (let ii = 0; ii < length; ii++) {
        const element = allLynxElements[ii]! as HTMLElement;
        const lynxUniqueId = Number(
          element.getAttribute(lynxUniqueIdAttribute)!,
        );
        lynxUniqueIdToElement[lynxUniqueId] = new WeakRef<HTMLElement>(element);
        ssrPartsMap[lynxUniqueId] = element;
      }
      const pageElement = lynxUniqueIdToElement[1]!.deref()!;

      mtsGlobalThis = await startMainThread(configs, {
        lynxUniqueIdToElement: lynxUniqueIdToElement as unknown as WeakRef<
          WebFiberElementImpl
        >[],
        ssrHydrateData: ssr.ssrHydrateData,
        templatePartsMap: new WeakMap<
          WebFiberElementImpl,
          Record<string, WebFiberElementImpl>
        >(
          [[
            pageElement as unknown as WebFiberElementImpl,
            ssrPartsMap as unknown as Record<string, WebFiberElementImpl>,
          ]],
        ),
      });
    } else {
      mtsGlobalThis = await startMainThread(configs);
    }
  };
  const updateDataMainThread: RpcCallType<typeof updateDataEndpoint> = async (
    ...args
  ) => {
    mtsGlobalThis.updatePage?.(...args);
  };
  return {
    start,
    updateDataMainThread,
  };
}
