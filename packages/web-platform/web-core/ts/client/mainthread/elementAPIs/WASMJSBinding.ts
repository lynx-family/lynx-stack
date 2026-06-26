import { createCrossThreadEvent } from './createCrossThreadEvent.js';
import type {
  InvokeUIMethodPAPI,
  LynxCrossThreadEvent,
  LynxCrossThreadEventTarget,
  DecoratedHTMLElement,
  RustMainthreadContextBinding,
  CloneableObject,
  MainThreadGlobalThis,
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
  mainThreadGlobalThis: MainThreadGlobalThis;
  readonly invokeUIMethod: InvokeUIMethodPAPI;
  readonly lynxViewClientLeft: number;
  readonly lynxViewClientTop: number;
};

const DOCUMENT_LEVEL_EVENTS = new Set(['keydown', 'keyup']);

export class WASMJSBinding implements RustMainthreadContextBinding {
  wasmContext: InstanceType<MainThreadWasmContext> | undefined;
  disposeWasmContext?: () => void;
  #addedEventListeners: Set<string> = new Set();
  #documentEventListeners: Set<string> = new Set();
  toBeEnabledElement: Set<HTMLElement> = new Set();
  toBeDisabledElement: Set<HTMLElement> = new Set();

  constructor(
    public readonly lynxViewInstance: WASMJSBindingInjectedHandler,
  ) {
  }
  markExposureRelatedElementByUniqueId(
    element: HTMLElement,
    toEnable: boolean,
  ): void {
    if (element) {
      if (toEnable) {
        this.toBeDisabledElement.delete(element);
        this.toBeEnabledElement.add(element);
      } else {
        this.toBeEnabledElement.delete(element);
        this.toBeDisabledElement.add(element);
      }
    }
  }

  generateTargetObject(
    element: DecoratedHTMLElement,
    dataset: CloneableObject,
  ): LynxCrossThreadEventTarget {
    const uniqueId = element[uniqueIdSymbol];
    return {
      dataset: Object.assign(Object.create(null), dataset),
      id: element.id || null,
      uid: uniqueId,
    };
  }

  getClassList(
    elementRef: WeakRef<HTMLElement>,
  ): string[] {
    const element = elementRef.deref();
    if (element) {
      return [...(element.classList as unknown as string[])];
    }
    return [];
  }

  getElementByUniqueId(uniqueId: number): HTMLElement | undefined {
    return this.wasmContext?.get_dom_by_unique_id(uniqueId)?.deref() as
      | HTMLElement
      | undefined;
  }

  getElementByComponentId(
    componentId: string,
  ): HTMLElement | undefined {
    const uniqueId = this.wasmContext?.get_unique_id_by_component_id(
      componentId,
    );
    if (uniqueId != undefined) {
      return this.getElementByUniqueId(uniqueId);
    }
    return undefined;
  }

  setElementUniqueId(element: DecoratedHTMLElement, uniqueId: number): void {
    element[uniqueIdSymbol] = uniqueId;
  }

  runWorklet(
    handler: { value: unknown },
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
    const resolvedTarget = (target ?? currentTarget) as
      | DecoratedHTMLElement
      | undefined;
    if (!resolvedTarget) return;
    const resolvedTargetDataset = target ? targetDataset : currentTargetDataset;
    eventObject.target = this.generateTargetObject(
      resolvedTarget,
      resolvedTargetDataset,
    );
    eventObject.currentTarget = this.generateTargetObject(
      currentTarget as DecoratedHTMLElement,
      currentTargetDataset,
    );
    // @ts-expect-error
    eventObject.target.elementRefptr = resolvedTarget;
    // @ts-expect-error
    eventObject.currentTarget.elementRefptr = currentTarget;
    this.lynxViewInstance.mainThreadGlobalThis.runWorklet?.(handler.value, [
      eventObject,
    ]);
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
    const currentTarget = this.getElementByUniqueId(currentTargetUniqueId);
    // The Rust dispatcher only reaches this code with target_unique_id == 0
    // on the global-bindevent path (regular bind/catch handlers early-return
    // when the bubble path has no element). For that case the DOM event
    // originated outside the Lynx element tree, so fall back to currentTarget
    // (the element that registered the global handler).
    const resolvedTarget = (target ?? currentTarget) as
      | DecoratedHTMLElement
      | undefined;
    if (!resolvedTarget) return;
    const resolvedTargetDataset = target ? targetDataset : currentTargetDataset;
    eventObject.target = this.generateTargetObject(
      resolvedTarget,
      resolvedTargetDataset,
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

  #commonEventHandler = (event: Event) => {
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
      if (uniqueId !== -1) {
        bubblePath[bubblePathLength++] = uniqueId;
        if (bubblePathLength >= bubblePath.length) {
          const newBubblePath = new Uint32Array(bubblePath.length * 2);
          newBubblePath.set(bubblePath);
          bubblePath = newBubblePath;
        }
      }
      currentTarget = currentTarget.parentElement as
        | DecoratedHTMLElement
        | null;
    }
    const eventObject = createCrossThreadEvent(
      event,
      this.lynxViewInstance.lynxViewClientLeft,
      this.lynxViewInstance.lynxViewClientTop,
    );
    this.wasmContext?.common_event_handler(
      eventObject,
      bubblePath.slice(0, bubblePathLength),
      eventObject.type,
      event.bubbles,
    );
  };

  addEventListener(eventName: string) {
    const w3cEventName = LynxEventNameToW3cCommon[eventName] ?? eventName;
    if (this.#addedEventListeners.has(w3cEventName)) return;
    this.#addedEventListeners.add(w3cEventName);
    const isDocumentLevel = DOCUMENT_LEVEL_EVENTS.has(w3cEventName);
    if (isDocumentLevel) {
      this.#documentEventListeners.add(w3cEventName);
      document.addEventListener(w3cEventName, this.#commonEventHandler, {
        passive: true,
        capture: true,
      });
    } else {
      this.lynxViewInstance.rootDom.addEventListener(
        w3cEventName,
        this.#commonEventHandler,
        {
          passive: true,
          capture: true,
        },
      );
    }
  }

  // Synchronously detach all DOM listeners. Safe to call multiple times.
  // Document-level listeners must be removed before this binding is GC'd or
  // before another LynxView instance mounts, otherwise stale handlers stay
  // attached to `document` and fire against a torn-down wasmContext.
  disposeEventListeners() {
    for (const eventName of this.#addedEventListeners) {
      if (this.#documentEventListeners.has(eventName)) {
        document.removeEventListener(eventName, this.#commonEventHandler, true);
      } else {
        this.lynxViewInstance.rootDom.removeEventListener(
          eventName,
          this.#commonEventHandler,
          true,
        );
      }
    }
    this.#addedEventListeners.clear();
    this.#documentEventListeners.clear();
  }

  dispose() {
    this.disposeEventListeners();

    this.toBeEnabledElement.clear();
    this.toBeDisabledElement.clear();

    this.disposeWasmContext?.();
    this.wasmContext = undefined;
  }

  postTimingFlags(flags: string[], pipelineId?: string) {
    this.lynxViewInstance.backgroundThread.postTimingFlags(flags, pipelineId);
  }

  updateExposureStatus(
    enabledExposureElements: HTMLElement[],
    disabledExposureElements: HTMLElement[],
  ) {
    this.lynxViewInstance.exposureServices.updateExposureStatus(
      enabledExposureElements,
      disabledExposureElements,
    );
  }

  enableElementEvent(elementRef: WeakRef<HTMLElement>, eventName: string) {
    const element = elementRef.deref();
    if (element) {
      // @ts-expect-error
      element.enableEvent?.(LynxEventNameToW3cCommon[eventName] ?? eventName);
    }
  }

  disableElementEvent(elementRef: WeakRef<HTMLElement>, eventName: string) {
    const element = elementRef.deref();
    if (element) {
      // @ts-expect-error
      element.disableEvent?.(LynxEventNameToW3cCommon[eventName] ?? eventName);
    }
  }

  setAttribute(elementRef: WeakRef<HTMLElement>, name: string, value: string) {
    const element = elementRef.deref();
    if (element) {
      element.setAttribute(name, value);
    }
  }

  removeAttribute(elementRef: WeakRef<HTMLElement>, name: string) {
    const element = elementRef.deref();
    if (element) {
      element.removeAttribute(name);
    }
  }
}
