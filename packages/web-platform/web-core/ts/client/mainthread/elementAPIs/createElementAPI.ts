import { wasmInstance } from '../../wasm.js';
import { setElementPropertyOrAttribute } from '../utils/setElementPropertyOrAttribute.js';

import {
  AnimationOperation,
  cssIdAttribute,
  LYNX_TAG_TO_HTML_TAG_MAP,
  LYNX_TIMING_FLAG_ATTRIBUTE,
  lynxDefaultDisplayLinearAttribute,
  lynxDefaultOverflowVisibleAttribute,
  lynxDisposedAttribute,
  lynxElementTemplateMarkerAttribute,
  lynxEntryNameAttribute,
  uniqueIdSymbol,
} from '../../../constants.js';
import {
  __SwapElement,
  __AppendElement,
  __ElementIsEqual,
  __FirstElement,
  __GetChildren,
  __GetParent,
  __InsertElementBefore,
  __LastElement,
  __NextElement,
  __RemoveElement,
  __ReplaceElement,
  __ReplaceElements,
  __GetAttributes,
  __GetAttributeByName,
  __GetID,
  __SetID,
  __GetTag,
  __GetClasses,
  __SetClasses,
  __AddClass,
  __MarkTemplateElement,
  __MarkPartElement,
  __GetElementUniqueID,
  __GetTemplateParts,
  __UpdateListCallbacks,
  __QuerySelector,
  __QuerySelectorAll,
} from './pureElementPAPIs.js';
import { elementTemplateSlotAnchorPrefix } from '../registerElementTemplates.js';
import type {
  AddEventPAPI,
  DecoratedHTMLElement,
  DecodedTemplate,
  ElementPAPIs,
  SerializedElementTemplateNode,
  SetCSSIdPAPI,
  UpdateListInfoAttributeValue,
} from '../../../types/index.js';
import type { WASMJSBinding } from './WASMJSBinding.js';
import { requestIdleCallbackImpl } from '../utils/requestIdleCallback.js';

const {
  MainThreadWasmContext,
  add_inline_style_raw_string_key,
  set_inline_styles_number_key,
} = wasmInstance;

type ElementTemplateRuntimeState =
  & {
    uid: unknown;
    elementSlots: Map<number, number[]>;
  }
  & (
    | {
      kind: 'compiled';
      templateKey: string;
      bundleUrl: string | null | undefined;
      attributeSlots: unknown[];
    }
    | {
      kind: 'typed';
      tag: string;
      attributes: Record<string, unknown>;
      options: unknown;
    }
  );

function dispatchLynxViewLoadEvent(host: HTMLElement & { url?: string }) {
  host.dispatchEvent(
    new CustomEvent('load', {
      detail: {
        statusCode: 0,
        statusMessage: 'success',
        url: host.url ?? '',
      },
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );
}

export function createElementAPI(
  rootDom: ShadowRoot,
  mtsBinding: WASMJSBinding,
  config_enable_css_selector: boolean,
  config_default_display_linear: boolean,
  config_default_overflow_visible: boolean,
  transform_vw: boolean,
  transform_vh: boolean,
  transform_rem: boolean,
  resolveElementTemplateBundle?: (
    bundleUrl?: string | null,
  ) => DecodedTemplate | undefined,
): ElementPAPIs {
  let wasmContext = new MainThreadWasmContext(
    rootDom,
    mtsBinding,
    config_enable_css_selector,
    transform_vw,
    transform_vh,
    transform_rem,
  );
  let page: DecoratedHTMLElement | undefined = undefined;
  const timingFlags: string[] = [];
  let disposed = false;

  mtsBinding.wasmContext = wasmContext;
  mtsBinding.disposeWasmContext = () => {
    if (disposed) return;
    disposed = true;
    if (wasmContext) {
      wasmContext.free();
      // @ts-expect-error It's better to throw an Error than triggering an use-after-free of rust struct
      wasmContext = null;
    }
    page = undefined;
    timingFlags.length = 0;
  };

  const __SetCSSId: SetCSSIdPAPI = (elements, cssId, entryName) => {
    const uniqueIds = elements.map(
      (element) => {
        return (element as DecoratedHTMLElement)[uniqueIdSymbol];
      },
    );
    return wasmContext.set_css_id(
      new Uint32Array(uniqueIds),
      cssId ?? 0,
      entryName,
    );
  };
  const __AddEvent: AddEventPAPI = (
    element,
    eventType,
    eventName,
    frameworkCrossThreadIdentifier,
  ) => {
    const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
    if (typeof frameworkCrossThreadIdentifier === 'string') {
      wasmContext.add_cross_thread_event(
        uniqueId,
        eventType,
        eventName,
        frameworkCrossThreadIdentifier,
      );
    } else if (frameworkCrossThreadIdentifier == null) {
      wasmContext.add_cross_thread_event(
        uniqueId,
        eventType,
        eventName,
        undefined,
      );
      wasmContext.add_run_worklet_event(
        uniqueId,
        eventType,
        eventName,
        undefined,
      );
    } else if (typeof frameworkCrossThreadIdentifier === 'object') {
      wasmContext.add_run_worklet_event(
        uniqueId,
        eventType,
        eventName,
        frameworkCrossThreadIdentifier,
      );
    }
    if (eventName === 'uiappear' || eventName === 'uidisappear') {
      const element = wasmContext.get_dom_by_unique_id(uniqueId)?.deref() as
        | HTMLElement
        | undefined;
      if (element) {
        mtsBinding.markExposureRelatedElementByUniqueId(
          element,
          frameworkCrossThreadIdentifier != null,
        );
      }
    }
  };
  const elementTemplateSlotAnchors = new WeakMap<
    HTMLElement,
    Map<number, Node>
  >();
  const elementTemplateStates = new WeakMap<
    HTMLElement,
    ElementTemplateRuntimeState
  >();
  const elementTemplateStatesById = new Map<
    number,
    ElementTemplateRuntimeState
  >();
  const elementTemplateRootsById = new Map<number, HTMLElement>();
  const elementTemplateOwners = new Map<
    number,
    { ownerUniqueId: number; slotIndex: number }
  >();
  const serializeElementTemplateById = (
    uniqueId: number,
  ): SerializedElementTemplateNode => {
    const state = elementTemplateStatesById.get(uniqueId);
    if (!state) {
      throw new Error('Element template instance not found');
    }
    const uid = (state.uid == null ? uniqueId : state.uid) as string | number;
    const serialized: SerializedElementTemplateNode = state.kind === 'compiled'
      ? {
        uid,
        templateKey: state.templateKey,
        attributeSlots: state.attributeSlots as any[],
      }
      : {
        uid,
        tag: state.tag,
        attributes: state.attributes as any,
      };

    if (state.kind === 'compiled' && state.bundleUrl) {
      serialized.bundleUrl = state.bundleUrl;
    }

    const serializeOptionValue = (value: unknown): unknown => {
      if (value instanceof HTMLElement) {
        const valueUniqueId = __GetElementUniqueID(value);
        if (elementTemplateStatesById.has(valueUniqueId)) {
          return serializeElementTemplateById(valueUniqueId);
        }
      }
      if (Array.isArray(value)) {
        return value.map(item => serializeOptionValue(item) ?? null);
      }
      if (value && typeof value === 'object') {
        const output: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value)) {
          const serializedItem = serializeOptionValue(item);
          if (serializedItem !== undefined) {
            output[key] = serializedItem;
          }
        }
        return output;
      }
      return value;
    };

    if (state.kind === 'typed') {
      const options = serializeOptionValue(state.options);
      if (options && typeof options === 'object' && !Array.isArray(options)) {
        serialized.options = options as any;
      }
    }

    if (state.elementSlots.size > 0) {
      const slots: SerializedElementTemplateNode[][] = [];
      const slotIndexes = Array.from(state.elementSlots.keys()).sort((a, b) =>
        a - b
      );
      for (const slotIndex of slotIndexes) {
        slots[slotIndex] = (state.elementSlots.get(slotIndex) ?? [])
          .map(serializeElementTemplateById);
      }
      serialized.elementSlots = slots;
    }
    return serialized;
  };
  const detachElementTemplateChildReference = (childUniqueId: number) => {
    const owner = elementTemplateOwners.get(childUniqueId);
    if (!owner) return;
    const ownerState = elementTemplateStatesById.get(owner.ownerUniqueId);
    const children = ownerState?.elementSlots.get(owner.slotIndex);
    if (children) {
      const position = children.indexOf(childUniqueId);
      if (position >= 0) {
        children.splice(position, 1);
      }
      if (children.length === 0) {
        ownerState!.elementSlots.delete(owner.slotIndex);
      }
    }
    elementTemplateOwners.delete(childUniqueId);
  };
  const recordElementTemplateSlotChild = (
    rootUniqueId: number,
    slotIndex: number,
    childUniqueId: number,
    referenceUniqueId?: number,
  ) => {
    detachElementTemplateChildReference(childUniqueId);
    const state = elementTemplateStatesById.get(rootUniqueId);
    if (!state) return;
    const children = state.elementSlots.get(slotIndex) ?? [];
    if (referenceUniqueId != null) {
      const position = children.indexOf(referenceUniqueId);
      if (position >= 0) {
        children.splice(position, 0, childUniqueId);
      } else {
        children.push(childUniqueId);
      }
    } else {
      children.push(childUniqueId);
    }
    state.elementSlots.set(slotIndex, children);
    elementTemplateOwners.set(childUniqueId, {
      ownerUniqueId: rootUniqueId,
      slotIndex,
    });
  };
  const removeElementTemplateState = (uniqueId: number) => {
    const state = elementTemplateStatesById.get(uniqueId);
    if (!state) return;
    const childUniqueIds = Array.from(state.elementSlots.values()).flat();
    for (const childUniqueId of childUniqueIds) {
      removeElementTemplateState(childUniqueId);
    }
    detachElementTemplateChildReference(uniqueId);
    const root = elementTemplateRootsById.get(uniqueId);
    if (root) {
      elementTemplateStates.delete(root);
      elementTemplateSlotAnchors.delete(root);
      elementTemplateRootsById.delete(uniqueId);
    }
    elementTemplateStatesById.delete(uniqueId);
  };
  const setCompiledElementTemplateAttributeSlot = (
    rootUniqueId: number,
    attributeSlotIndex: number,
    value: unknown,
  ) => {
    const state = elementTemplateStatesById.get(rootUniqueId);
    if (state?.kind === 'compiled') {
      while (state.attributeSlots.length <= attributeSlotIndex) {
        state.attributeSlots.push(null);
      }
      state.attributeSlots[attributeSlotIndex] = value;
    }
    wasmContext.set_attribute_of_element_template_by_id(
      rootUniqueId,
      attributeSlotIndex,
      value,
    );
  };
  const updateTypedElementTemplateAttributes = (
    rootUniqueId: number,
    nextAttributesValue: unknown,
  ) => {
    const state = elementTemplateStatesById.get(rootUniqueId);
    if (state?.kind !== 'typed') return;
    const nextAttributes = !nextAttributesValue
        || typeof nextAttributesValue !== 'object'
        || Array.isArray(nextAttributesValue)
      ? {}
      : { ...(nextAttributesValue as Record<string, unknown>) };
    for (const key of Object.keys(state.attributes)) {
      if (!(key in nextAttributes)) {
        wasmContext.set_typed_element_template_attribute(
          rootUniqueId,
          key,
          null,
        );
      }
    }
    for (const [key, value] of Object.entries(nextAttributes)) {
      wasmContext.set_typed_element_template_attribute(
        rootUniqueId,
        key,
        value,
      );
    }
    state.attributes = nextAttributes;
  };
  const insertInitialElementTemplateSlots = (
    host: HTMLElement,
    rootUniqueId: number,
    slotAnchors: Map<number, Node>,
    elementSlots: unknown,
    recordState: boolean,
  ) => {
    if (!elementSlots || typeof elementSlots !== 'object') return;
    for (const key of Object.keys(elementSlots)) {
      const slotIndex = Number(key);
      if (!Number.isInteger(slotIndex)) continue;
      const slotValue = (elementSlots as Record<string, unknown>)[key];
      const children = slotValue == null
        ? []
        : Array.isArray(slotValue)
        ? slotValue
        : [slotValue];
      for (const child of children) {
        if (!(child instanceof HTMLElement)) continue;
        const childUniqueId = __GetElementUniqueID(child);
        if (childUniqueId < 0) {
          throw new Error('Element template child missing unique id');
        }
        const anchor = slotAnchors.get(slotIndex);
        if (anchor?.parentNode) {
          anchor.parentNode.insertBefore(child, anchor);
        } else {
          host.appendChild(child);
        }
        if (recordState) {
          wasmContext.insert_element_template_slot_child(
            rootUniqueId,
            slotIndex,
            childUniqueId,
            undefined,
          );
          recordElementTemplateSlotChild(
            rootUniqueId,
            slotIndex,
            childUniqueId,
          );
        }
      }
    }
  };
  const elementPAPIs: ElementPAPIs = {
    __CreateView(parentComponentUniqueId: number) {
      const dom = document.createElement('x-view') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.create_element(
        parentComponentUniqueId,
        dom,
        new WeakRef(dom),
      );
      return dom;
    },
    __CreateText(parentComponentUniqueId) {
      const dom = document.createElement('x-text') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.create_element(
        parentComponentUniqueId,
        dom,
        new WeakRef(dom),
      );
      return dom;
    },
    __CreateImage(parentComponentUniqueId) {
      const dom = document.createElement('x-image') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.create_element(
        parentComponentUniqueId,
        dom,
        new WeakRef(dom),
      );
      return dom;
    },
    __CreateFrame(parentComponentUniqueId) {
      const dom = document.createElement(
        LYNX_TAG_TO_HTML_TAG_MAP['frame']!,
      ) as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.create_element(
        parentComponentUniqueId,
        dom,
        new WeakRef(dom),
      );
      return dom;
    },
    __CreateRawText(text) {
      const dom = document.createElement('raw-text') as DecoratedHTMLElement;
      dom.setAttribute('text', text);
      dom[uniqueIdSymbol] = wasmContext.create_element(
        -1,
        dom,
        new WeakRef(dom),
      );
      return dom;
    },
    __CreateScrollView(parentComponentUniqueId) {
      const dom = document.createElement('scroll-view') as DecoratedHTMLElement;

      dom[uniqueIdSymbol] = wasmContext.create_element(
        parentComponentUniqueId,
        dom,
        new WeakRef(dom),
      );
      return dom;
    },
    __CreateElement(tagName, parentComponentUniqueId) {
      const dom = document.createElement(
        LYNX_TAG_TO_HTML_TAG_MAP[tagName] ?? tagName,
      ) as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.create_element(
        parentComponentUniqueId,
        dom,
        new WeakRef(dom),
      );
      return dom;
    },
    __CreateComponent(
      parentComponentUniqueId,
      componentID,
      componentCSSID,
      entryName,
      name,
    ) {
      const dom = document.createElement('x-view') as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.create_element(
        parentComponentUniqueId,
        dom,
        new WeakRef(dom),
        undefined,
        componentCSSID,
        componentID,
      );
      if (entryName && entryName !== '__Card__') {
        dom.setAttribute(lynxEntryNameAttribute, entryName);
      }
      if (name) {
        dom.setAttribute('name', name);
      }
      return dom;
    },
    __CreateWrapperElement(parentComponentUniqueId) {
      const dom = document.createElement(
        'lynx-wrapper',
      ) as DecoratedHTMLElement;
      dom[uniqueIdSymbol] = wasmContext.create_element(
        parentComponentUniqueId,
        dom,
        new WeakRef(dom),
      );
      return dom;
    },
    __CreateList(parentComponentUniqueId, componentAtIndex, enqueueComponent) {
      const dom = document.createElement('x-list') as DecoratedHTMLElement;
      dom.componentAtIndex = componentAtIndex;
      dom.enqueueComponent = enqueueComponent;
      dom[uniqueIdSymbol] = wasmContext.create_element(
        parentComponentUniqueId,
        dom,
        new WeakRef(dom),
      );
      return dom;
    },
    __CreateElementTemplate(
      templateKey,
      bundleUrl,
      attributeSlots,
      elementSlots,
      uid,
    ) {
      const registered = resolveElementTemplateBundle?.(bundleUrl)
        ?.elementTemplateDefinitions?.get(templateKey);
      if (!registered) {
        throw new Error(`Element template not found: ${templateKey}`);
      }
      const fragment = registered.template.content.cloneNode(
        true,
      ) as DocumentFragment;
      const root = fragment.firstChild as DecoratedHTMLElement | null;
      if (!root || root.nodeType !== 1) {
        throw new Error('Element template root missing');
      }

      // Traverse the cloned template once to register elements in clone order
      // and retain invisible element-slot anchors for later insertion.
      const elements: HTMLElement[] = [];
      const slotAnchors = new Map<number, Node>();
      const stack: Node[] = [root];
      while (stack.length > 0) {
        const node = stack.pop()!;
        if (node.nodeType === 1) {
          elements.push(node as HTMLElement);
        } else if (node.nodeType === 8) {
          const value = node.nodeValue;
          if (value?.startsWith(elementTemplateSlotAnchorPrefix)) {
            const slotIndex = Number(
              value.slice(elementTemplateSlotAnchorPrefix.length),
            );
            if (Number.isInteger(slotIndex)) {
              slotAnchors.set(slotIndex, node);
            }
          }
        }

        const childNodes = Array.from(node.childNodes);
        for (let index = childNodes.length - 1; index >= 0; index--) {
          stack.push(childNodes[index]!);
        }
      }

      const uniqueIdsByIndex: number[] = [];
      for (const element of elements) {
        const cssId = Number(element.getAttribute(cssIdAttribute) ?? 0) || 0;
        const uniqueId = wasmContext.create_element(
          0,
          element,
          new WeakRef(element),
          cssId,
          undefined,
          undefined,
        );
        (element as DecoratedHTMLElement)[uniqueIdSymbol] = uniqueId;
        uniqueIdsByIndex.push(uniqueId);
        if (!config_enable_css_selector) {
          wasmContext.update_css_og_style(
            uniqueId,
            element.getAttribute(lynxEntryNameAttribute),
          );
        }
      }
      const rootUniqueId = uniqueIdsByIndex[0];
      if (rootUniqueId == null) {
        throw new Error('Element template root not registered');
      }
      root.setAttribute(
        lynxElementTemplateMarkerAttribute,
        String(rootUniqueId),
      );
      elementTemplateSlotAnchors.set(root, slotAnchors);
      const providedAttributeSlots = Array.isArray(attributeSlots)
        ? Array.from(attributeSlots)
        : [];
      const attributeSlotValues = [...providedAttributeSlots];
      while (attributeSlotValues.length <= registered.maxAttributeSlotIndex) {
        attributeSlotValues.push(null);
      }
      const state: ElementTemplateRuntimeState = {
        kind: 'compiled',
        uid,
        templateKey,
        bundleUrl,
        attributeSlots: attributeSlotValues,
        elementSlots: new Map(),
      };
      elementTemplateStates.set(root, state);
      elementTemplateStatesById.set(rootUniqueId, state);
      elementTemplateRootsById.set(rootUniqueId, root);
      wasmContext.create_element_template_instance(rootUniqueId);
      for (let index = 0; index < uniqueIdsByIndex.length; index++) {
        wasmContext.add_element_template_instance_element(
          rootUniqueId,
          index,
          uniqueIdsByIndex[index]!,
        );
      }
      wasmContext.finish_element_template_instance(
        registered.definition,
        rootUniqueId,
      );
      for (let index = 0; index < providedAttributeSlots.length; index++) {
        setCompiledElementTemplateAttributeSlot(
          rootUniqueId,
          index,
          providedAttributeSlots[index],
        );
      }
      insertInitialElementTemplateSlots(
        root,
        rootUniqueId,
        slotAnchors,
        elementSlots,
        true,
      );
      return root;
    },
    __CreateTypedElementTemplate(
      tag,
      attributes,
      elementSlots,
      uid,
      options,
    ) {
      if (tag === 'page') {
        const dom = elementPAPIs.__CreatePage(String(uid ?? '0'), 0);
        const rootUniqueId = __GetElementUniqueID(dom);
        dom.setAttribute(
          lynxElementTemplateMarkerAttribute,
          String(rootUniqueId),
        );
        insertInitialElementTemplateSlots(
          dom,
          rootUniqueId,
          new Map(),
          elementSlots
            ?? (options && typeof options === 'object'
              ? (options as { listChildren?: unknown }).listChildren
              : undefined),
          false,
        );
        return dom;
      }

      const dom = document.createElement(
        LYNX_TAG_TO_HTML_TAG_MAP[tag] ?? tag,
      ) as DecoratedHTMLElement;
      const uniqueId = wasmContext.create_element(
        0,
        dom,
        new WeakRef(dom),
        0,
        undefined,
        undefined,
      );
      dom[uniqueIdSymbol] = uniqueId;
      dom.setAttribute(lynxElementTemplateMarkerAttribute, String(uniqueId));
      const state: ElementTemplateRuntimeState = {
        kind: 'typed',
        uid,
        tag,
        attributes: {},
        options,
        elementSlots: new Map(),
      };
      elementTemplateStates.set(dom, state);
      elementTemplateStatesById.set(uniqueId, state);
      elementTemplateRootsById.set(uniqueId, dom);
      wasmContext.create_typed_element_template_instance(uniqueId);
      updateTypedElementTemplateAttributes(uniqueId, attributes);
      insertInitialElementTemplateSlots(
        dom,
        uniqueId,
        new Map(),
        elementSlots
          ?? (options && typeof options === 'object'
            ? (options as { listChildren?: unknown }).listChildren
            : undefined),
        true,
      );
      return dom;
    },
    __SetAttributeOfElementTemplate(
      element,
      attributeSlotIndex,
      value,
      _options,
    ) {
      const rootUniqueId = __GetElementUniqueID(element);
      const state = elementTemplateStates.get(element);
      if (state?.kind === 'typed') {
        updateTypedElementTemplateAttributes(rootUniqueId, value);
        return;
      }
      setCompiledElementTemplateAttributeSlot(
        rootUniqueId,
        attributeSlotIndex,
        value,
      );
    },
    __InsertNodeToElementTemplate(element, slotIndex, child, reference) {
      const rootUniqueId = __GetElementUniqueID(element);
      const childUniqueId = __GetElementUniqueID(child);
      if (childUniqueId < 0) {
        throw new Error('Element template child missing unique id');
      }
      if (reference) {
        reference.parentNode?.insertBefore(child, reference);
      } else {
        const anchor = elementTemplateSlotAnchors.get(element)?.get(slotIndex);
        if (anchor?.parentNode) {
          anchor.parentNode.insertBefore(child, anchor);
        } else {
          element.appendChild(child);
        }
      }
      if (element !== page) {
        const referenceUniqueId = reference
          ? __GetElementUniqueID(reference)
          : undefined;
        wasmContext.insert_element_template_slot_child(
          rootUniqueId,
          slotIndex,
          childUniqueId,
          referenceUniqueId,
        );
        recordElementTemplateSlotChild(
          rootUniqueId,
          slotIndex,
          childUniqueId,
          referenceUniqueId,
        );
      }
    },
    __RemoveNodeFromElementTemplate(_element, _slotIndex, child) {
      child.parentNode?.removeChild(child);
      const uniqueIds: number[] = [];
      const rootUniqueId = __GetElementUniqueID(child);
      if (rootUniqueId >= 0) {
        uniqueIds.push(rootUniqueId);
      }
      const stack = Array.from(child.childNodes);
      while (stack.length > 0) {
        const node = stack.pop()!;
        if (node.nodeType === 1) {
          const current = node as HTMLElement;
          const templateUniqueId = current.getAttribute(
            lynxElementTemplateMarkerAttribute,
          );
          if (templateUniqueId != null) {
            const uniqueId = Number(templateUniqueId);
            if (Number.isInteger(uniqueId)) {
              uniqueIds.push(uniqueId);
            }
          }
        }
        stack.push(...Array.from(node.childNodes));
      }
      for (const uniqueId of uniqueIds) {
        wasmContext.remove_element_template_instance_by_id(uniqueId);
        removeElementTemplateState(uniqueId);
      }
    },
    __SerializeElementTemplate(element) {
      return serializeElementTemplateById(__GetElementUniqueID(element));
    },
    __CreatePage(componentID, componentCSSID) {
      if (page) return page;
      const dom = document.createElement(
        'div',
      ) as HTMLElement as DecoratedHTMLElement;
      const uniqueId = wasmContext.create_element(
        0,
        dom,
        new WeakRef(dom),
        undefined,
        componentCSSID,
        componentID,
      );
      dom[uniqueIdSymbol] = uniqueId;
      wasmContext.set_page_element_unique_id(uniqueId);
      if (config_default_overflow_visible) {
        dom.setAttribute(lynxDefaultOverflowVisibleAttribute, 'true');
      }
      if (!config_default_display_linear) {
        dom.setAttribute(lynxDefaultDisplayLinearAttribute, 'false');
      }
      dom.setAttribute('part', 'page');
      page = dom;
      return dom;
    },
    __SetClasses: config_enable_css_selector
      ? __SetClasses
      : ((element, classname) => {
        __SetClasses(element, classname);
        const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
        wasmContext.update_css_og_style(
          uniqueId,
          element.getAttribute(lynxEntryNameAttribute),
        );
      }),
    __SetCSSId,
    __AddInlineStyle: (
      element,
      key,
      value,
    ) => {
      let valStr: string | null = null;
      if (value != null) {
        valStr = value.toString();
      }
      if (typeof key === 'number') {
        return set_inline_styles_number_key(
          element,
          key,
          valStr,
        );
      } else {
        return add_inline_style_raw_string_key(
          element,
          key.toString(),
          valStr,
        );
      }
    },
    __SetInlineStyles: (
      element,
      value,
    ) => {
      if (!value) {
        element.removeAttribute('style');
      } else {
        if (typeof value === 'string') {
          if (
            !wasmContext.set_inline_styles_in_str(
              element,
              value,
            )
          ) {
            element.setAttribute('style', value);
          }
        } else if (!value) {
          element.removeAttribute('style');
        } else {
          const vec: string[] = [];
          for (const [k, v] of Object.entries(value)) {
            if (v != null) {
              vec.push(k, v.toString());
            }
          }
          wasmContext.set_inline_styles_in_key_value_vec(
            element,
            vec,
          );
        }
      }
    },
    __AddConfig: (element, type, value) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      const config = wasmContext.get_config(uniqueId);
      // @ts-ignore
      config[type] = value;
    },
    __UpdateComponentInfo: (element, componentInfo) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      const { componentID, cssID, entry, name } = componentInfo;
      if (name) {
        element.setAttribute('name', name);
      } else {
        element.removeAttribute('name');
      }
      wasmContext.update_component_id(
        uniqueId,
        componentID,
      );
      if (cssID !== undefined) {
        wasmContext.update_component_css_id(uniqueId, cssID);
        if (entry) {
          element.setAttribute(lynxEntryNameAttribute, entry);
        }
      }
    },
    __UpdateComponentID: (element, componentID) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      wasmContext.update_component_id(uniqueId, componentID);
    },
    __GetConfig: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.get_config(uniqueId) as any;
    },
    __SetConfig: (element, config) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      wasmContext.set_config(uniqueId, config);
    },
    __GetElementConfig: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.get_element_config(uniqueId) as any;
    },
    __GetComponentID: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.get_component_id(uniqueId);
    },
    __SetDataset: (element, dataset) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      wasmContext.set_dataset(uniqueId, element, dataset);
    },
    __AddDataset: (element, key, value) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      if (value) {
        element.setAttribute(
          `data-${key}`,
          typeof value === 'object' ? JSON.stringify(value) : value.toString(),
        );
      } else {
        element.removeAttribute(`data-${key}`);
      }
      wasmContext.add_dataset(uniqueId, key, value);
    },
    __GetDataset: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return Object.assign(
        Object.create(null),
        wasmContext.get_dataset(uniqueId) as any,
      );
    },
    __GetDataByKey: (element, key) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.get_data_by_key(uniqueId, key);
    },
    __SetAttribute(element, name, value) {
      if (name === 'update-list-info') {
        const { insertAction, removeAction } =
          value as UpdateListInfoAttributeValue;
        queueMicrotask(() => {
          const componentAtIndex =
            (element as DecoratedHTMLElement).componentAtIndex;
          const enqueueComponent =
            (element as DecoratedHTMLElement).enqueueComponent;
          const uniqueId = __GetElementUniqueID(element);

          removeAction.forEach((position, i) => {
            const removedEle = element.children[position - i] as HTMLElement;
            if (removedEle) {
              const sign = __GetElementUniqueID(removedEle);
              enqueueComponent?.(element, uniqueId, sign);
              element.removeChild(removedEle);
            }
          });
          for (const action of insertAction) {
            const childSign = componentAtIndex?.(
              element,
              uniqueId,
              action.position,
              0,
              false,
            ) as number | undefined;
            if (typeof childSign === 'number') {
              const childElement = wasmContext.get_dom_by_unique_id(childSign)
                ?.deref() as HTMLElement | undefined;
              if (childElement) {
                const referenceNode = element.children[action.position];
                if (referenceNode !== childElement) {
                  element.insertBefore(childElement, referenceNode || null);
                }
              }
            }
          }
        });
      } else {
        setElementPropertyOrAttribute(element, name, value);
        if (name === 'exposure-id') {
          if (value != null) {
            mtsBinding.markExposureRelatedElementByUniqueId(
              element as HTMLElement,
              true,
            );
          } else {
            mtsBinding.markExposureRelatedElementByUniqueId(
              element as HTMLElement,
              false,
            );
          }
        } else if (name === LYNX_TIMING_FLAG_ATTRIBUTE) {
          timingFlags.push(String(value));
        }
      }
    },
    __AddEvent,
    __GetEvent: (element, eventType, eventName) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.get_event(uniqueId, eventType, eventName);
    },
    __GetEvents: (element) => {
      const uniqueId = (element as DecoratedHTMLElement)[uniqueIdSymbol];
      return wasmContext.get_events(uniqueId) as any;
    },
    __SetEvents: (element, events) => {
      for (const event of events) {
        __AddEvent(
          element,
          event.type,
          event.name,
          event.function,
        );
      }
    },
    __GetPageElement: () => page,
    __AppendElement,
    __ElementIsEqual,
    __FirstElement,
    __GetChildren,
    __GetParent,
    __InsertElementBefore,
    __LastElement,
    __NextElement,
    __RemoveElement,
    __ReplaceElement,
    __GetAttributes,
    __GetAttributeByName,
    __ReplaceElements,
    __GetID,
    __SetID,
    __GetTag,
    __AddClass: config_enable_css_selector
      ? __AddClass
      : ((element, className) => {
        __AddClass(element, className);
        const uniqueId = __GetElementUniqueID(element);
        const entryName = element.getAttribute(lynxEntryNameAttribute);
        wasmContext.update_css_og_style(uniqueId, entryName);
      }),
    __GetClasses,
    __MarkTemplateElement,
    __MarkPartElement,
    __GetTemplateParts,
    __GetElementUniqueID,
    __UpdateListCallbacks,
    __SwapElement,
    __ElementAnimate: (() => {
      const animationMap = new Map<string, Animation>();
      const mapTimingOptions = (
        options?: Record<string, string | number>,
      ): KeyframeAnimationOptions | undefined => {
        if (!options) return undefined;
        const result: KeyframeAnimationOptions = {};
        if ('duration' in options) {
          result.duration = Number(options['duration']);
        }
        if ('delay' in options) result.delay = Number(options['delay']);
        if ('direction' in options) {
          result.direction = options['direction'] as PlaybackDirection;
        }
        if ('iterationCount' in options) {
          result.iterations = options['iterationCount'] === 'infinite'
            ? Infinity
            : Number(options['iterationCount']);
        }
        if ('fillMode' in options) {
          result.fill = options['fillMode'] as FillMode;
        }
        if ('timingFunction' in options) {
          result.easing = options['timingFunction'] as string;
        }
        return result;
      };
      return (element: HTMLElement, args: any) => {
        const [operation, name] = args;
        switch (operation) {
          case AnimationOperation.START: {
            const keyframes = args[2];
            const options = args[3];
            animationMap.get(name)?.cancel();
            const animation = element.animate(
              keyframes as Keyframe[],
              mapTimingOptions(options),
            );
            animation.oncancel = animation.onfinish = () => {
              if (animationMap.get(name) === animation) {
                animationMap.delete(name);
              }
            };
            animationMap.set(name, animation);
            break;
          }
          case AnimationOperation.PLAY:
            animationMap.get(name)?.play();
            break;
          case AnimationOperation.PAUSE:
            animationMap.get(name)?.pause();
            break;
          case AnimationOperation.CANCEL:
            animationMap.get(name)?.cancel();
            animationMap.delete(name);
            break;
          case AnimationOperation.FINISH:
            animationMap.get(name)?.finish();
            break;
        }
      };
    })(),
    __InvokeUIMethod: mtsBinding.lynxViewInstance.invokeUIMethod,
    __QuerySelector,
    __QuerySelectorAll,
    __FlushElementTree: (_, options) => {
      const pipelineId = options?.pipelineOptions?.pipelineID;
      const backgroundThread = mtsBinding.lynxViewInstance.backgroundThread;
      if (
        page && !page.parentNode
        && page.getAttribute(lynxDisposedAttribute) !== ''
      ) {
        backgroundThread.markTiming('dispatch_start', pipelineId);
        backgroundThread.jsContext.dispatchEvent({
          type: '__OnNativeAppReady',
          data: undefined,
        });
        backgroundThread.markTiming('layout_start', pipelineId);
        backgroundThread.markTiming('ui_operation_flush_start', pipelineId);
        rootDom.appendChild(page);
        (rootDom.host as HTMLElement).style.display = 'flex';
        dispatchLynxViewLoadEvent(
          rootDom.host as HTMLElement & { url?: string },
        );
        backgroundThread.markTiming('ui_operation_flush_end', pipelineId);
        backgroundThread.markTiming('layout_end', pipelineId);
        backgroundThread.markTiming('dispatch_end', pipelineId);
        backgroundThread.flushTimingInfo();
      }
      let timingFlagsAll = timingFlags.concat(
        wasmContext.take_timing_flags(),
      );
      requestIdleCallbackImpl(() => {
        if (disposed) return;
        mtsBinding.postTimingFlags(
          timingFlagsAll,
          pipelineId,
        );
        wasmContext.gc();
      });
      timingFlags.length = 0;
      const enabledExposureElements = [
        ...mtsBinding.toBeEnabledElement,
      ];
      mtsBinding.toBeEnabledElement.clear();
      const disabledExposureElements = [
        ...mtsBinding.toBeDisabledElement,
      ];
      mtsBinding.toBeDisabledElement.clear();
      mtsBinding?.updateExposureStatus(
        enabledExposureElements,
        disabledExposureElements,
      );
    },
  };
  return elementPAPIs;
}
