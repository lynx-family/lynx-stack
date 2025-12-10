import { createCrossThreadEvent } from './createCrossThreadEvent.js';
import type {
  LynxCrossThreadEvent,
  LynxCrossThreadEventTarget,
  DecoratedHTMLElement,
  RustMainthreadContextBinding,
  CloneableObject,
} from '../../../types/index.js';
import {
  LynxEventNameToW3cCommon,
  uniqueIdSymbol,
} from '../../../constants.js';
import type { MainThreadWasmContext } from '../../wasm.js';
import { __GetElementUniqueID } from './pureElementPAPIs.js';
import type { BackgroundThread } from '../Background.js';
import type { ExposureServices } from '../ExposureServices.js';

export type WASMJSBindingInjectedHandler = {
  rootDom: ShadowRoot;
  backgroundThread: BackgroundThread;
  exposureServices: ExposureServices;
  loadWebElement: (elementId: number) => void;
  loadUnknownElement: (tagName: string) => void;
};

export class WASMJSBinding implements RustMainthreadContextBinding {
  wasmContext: InstanceType<typeof MainThreadWasmContext> | undefined;
  uniqueIdToElement: (WeakRef<HTMLElement> | null)[] = [null];
  toBeEnabledElement: Set<HTMLElement> = new Set();

  constructor(
    private readonly lynxViewInstance: WASMJSBindingInjectedHandler,
  ) {
    this.loadInternalWebElement = this.lynxViewInstance.loadWebElement.bind(
      this.lynxViewInstance,
    );
    this.loadUnknownElement = this.lynxViewInstance.loadUnknownElement.bind(
      this.lynxViewInstance,
    );
  }
  markExposureRelatedElementByUniqueId(
    uniqueId: number,
    toEnable: boolean,
  ): void {
    const dom = this.uniqueIdToElement[uniqueId]?.deref();
    if (dom) {
      if (toEnable) {
        this.toBeEnabledElement.add(dom);
      } else {
        this.toBeEnabledElement.delete(dom);
      }
    }
  }

  loadInternalWebElement: (elementId: number) => void;

  loadUnknownElement: (tagName: string) => void;

  generateTargetObject(
    element: DecoratedHTMLElement,
    dataset: CloneableObject,
  ): LynxCrossThreadEventTarget {
    const uniqueId = element[uniqueIdSymbol];
    return {
      dataset: Object.assign(Object.create(null), dataset),
      id: element.id || null,
      uniqueId,
    };
  }

  getElementByUniqueId(uniqueId: number): HTMLElement | undefined {
    const ref = this.uniqueIdToElement[uniqueId];
    if (ref) {
      const element = ref.deref();
      if (element) {
        return element;
      }
    }
    return undefined;
  }

  getElementByComponentId(
    componentId: string,
  ): HTMLElement | undefined {
    const uniqueId = this.wasmContext?.__wasm_get_unique_id_by_component_id(
      componentId,
    );
    if (uniqueId != undefined) {
      return this.getElementByUniqueId(uniqueId);
    }
    return undefined;
  }

  runWorklet(
    handler: unknown,
    eventObject: LynxCrossThreadEvent,
    targetUniqueId: number,
    targetDataset: Record<string, string>,
    currentTargetUniqueId: number,
    currentTargetDataset: Record<string, string>,
  ) {
    const target = this.getElementByUniqueId(targetUniqueId);
    const currentTarget = this.getElementByUniqueId(
      currentTargetUniqueId,
    );
    eventObject.target = this.generateTargetObject(
      target as DecoratedHTMLElement,
      targetDataset,
    );
    eventObject.currentTarget = this.generateTargetObject(
      currentTarget as DecoratedHTMLElement,
      currentTargetDataset,
    );
    // @ts-expect-error
    eventObject.target.elementRefptr = target;
    // @ts-expect-error
    eventObject.currentTarget.elementRefptr = currentTarget;
    // @ts-expect-error
    this.mtsRealm.globalWindow.runWorklet?.(handler, [eventObject]);
  }

  publishEvent(
    handlerName: string,
    parentComponentId: string | undefined,
    eventObject: LynxCrossThreadEvent,
    targetUniqueId: number,
    targetDataset: CloneableObject,
    currentTargetUniqueId: number,
    currentTargetDataset: CloneableObject,
  ) {
    const target = this.getElementByUniqueId(targetUniqueId);
    const currentTarget = this.getElementByUniqueId(
      currentTargetUniqueId,
    );
    eventObject.target = this.generateTargetObject(
      target as DecoratedHTMLElement,
      targetDataset,
    );
    eventObject.currentTarget = this.generateTargetObject(
      currentTarget as DecoratedHTMLElement,
      currentTargetDataset,
    );
    if (parentComponentId) {
      this.lynxViewInstance?.backgroundThread.publicComponentEvent(
        parentComponentId,
        handlerName,
        eventObject,
      );
    } else {
      this.lynxViewInstance.backgroundThread.publishEvent(
        handlerName,
        eventObject,
      );
    }
  }

  private commonEventHandler = (event: Event) => {
    const target = event.target as HTMLElement;
    let bubblePath: Uint32Array = new Uint32Array(32);
    let bubblePathLength = 0;
    bubblePath;
    let currentTarget = target as
      | DecoratedHTMLElement
      | ShadowRoot
      | null;
    while (currentTarget) {
      if (currentTarget === this.lynxViewInstance.rootDom) {
        break;
      }
      const uniqueId = __GetElementUniqueID(currentTarget as HTMLElement);
      bubblePath[bubblePathLength++] = uniqueId;
      if (bubblePathLength >= bubblePath.length) {
        const newBubblePath = new Uint32Array(bubblePath.length * 2);
        newBubblePath.set(bubblePath);
        bubblePath = newBubblePath;
      }
      currentTarget = currentTarget.parentElement as
        | DecoratedHTMLElement
        | null;
    }
    const eventObject = createCrossThreadEvent(event);
    this.wasmContext?.__wasm_commonEventHandler(
      eventObject,
      bubblePath.slice(0, bubblePathLength),
      eventObject.type,
    );
  };

  addEventListener(eventName: string) {
    this.lynxViewInstance.rootDom.addEventListener(
      LynxEventNameToW3cCommon[eventName] ?? eventName,
      this.commonEventHandler,
      {
        passive: true,
        capture: true,
      },
    );
  }

  postTimingFlags(flags: string[], pipelineId?: string) {
    this.lynxViewInstance.backgroundThread.postTimingFlags(flags, pipelineId);
  }

  updateExposureStatus(
    enabledExposureElements: HTMLElement[],
  ) {
    this.lynxViewInstance.exposureServices.updateExposureStatus(
      enabledExposureElements,
    );
  }
}
