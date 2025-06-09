import {
  type StartMainThreadContextConfig,
  type RpcCallType,
  type updateDataEndpoint,
  type MainThreadGlobalThis,
  lynxUniqueIdAttribute,
  type WebFiberElementImpl,
  cssOGStyleContainerId,
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
      const cssOGStyleElement = shadowRoot.getElementById(
        cssOGStyleContainerId,
      ) as HTMLStyleElement | null;
      const cssOGStyleSheet = cssOGStyleElement?.sheet;
      const lynxUniqueIdToStyleRulesIndex: number[] = [];
      const cssRulesLength = cssOGStyleSheet?.cssRules.length ?? 0;
      for (let ii = 0; ii < cssRulesLength; ii++) {
        const cssRule = cssOGStyleSheet?.cssRules[ii] as CSSStyleRule | null;
        if (cssRule) {
          const lynxUniqueId = parseFloat(
            (cssRule as CSSStyleRule).selectorText.substring(
              lynxUniqueIdAttribute.length + 3, // skip `[`, `="`
            ),
          );
          if (lynxUniqueId !== undefined) {
            lynxUniqueIdToStyleRulesIndex[lynxUniqueId] = ii;
          }
        }
      }

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
        lynxUniqueIdToStyleRulesIndex,
        cssOGStyleElement,
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
