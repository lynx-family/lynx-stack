/**
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import type { AttributeChangeHandler } from './registerAttributeHandler.js';
import type { StyleChangeHandler } from './registerStyleChangeHandler.js';
import { boostedQueueMicrotask } from './boostedQueueMicrotask.js';
import type { EventStatusChangeHandler } from './registerEventStatusChangedHandler.js';
export interface WebComponentClass {
  new(): HTMLElement & {
    cssPropertyChangedHandler?: never;
    connectedCallback?(): void;
    disconnectedCallback?(): void;
    adoptedCallback?(): void;
    attributeChangedCallback?(
      name: string,
      oldValue: null | string,
      newValue: null | string,
    ): void;
  };
  observedCSSProperties?: never;
  observedAttributes?: string[];
  /**
   * for attribute="false",
   * we will do removeAttribute by default;
   * set here for dont do this;
   */
  notToFilterFalseAttributes?: Set<string>;
  registerPlugin?: (
    reactiveClass: AttributeReactiveClass<WebComponentClass>,
  ) => void;
}

export type UseCSSCustomPropertyHandler = (
  newValue: string,
  propertyName: string,
) => void;

export interface AttributeReactiveClass<T extends typeof HTMLElement> {
  // static
  observedAttributes: readonly string[];
  observedCSSProperties?: readonly string[];
  new(dom: InstanceType<T>): any;
}

function convertStyleWithPriority(value: string, priority?: string) {
  if (priority) {
    return value + ' !important';
  } else {
    return value;
  }
}
export type AttributeReactiveObject = {
  attributeChangedHandler?: Record<
    string,
    { handler: AttributeChangeHandler; noDomMeasure: boolean }
  >;
  cssPropertyChangedHandler?: Record<string, StyleChangeHandler>;
  eventStatusChangedHandler?: Record<string, EventStatusChangeHandler>;
  dispose?(): void;
  connectedCallback?(): void;
};

export function Component<T extends WebComponentClass>(
  tag: string,
  attributeReactiveClasses: AttributeReactiveClass<T>[],
  template?: string,
): (target: T, context: ClassDecoratorContext<T>) => T {
  let templateElement: HTMLTemplateElement | undefined;
  return (target: T, { addInitializer }): T => {
    const observedStyleProperties = new Set([
      ...attributeReactiveClasses
        .filter((e) => e.observedCSSProperties)
        .map((e) => e.observedCSSProperties!)
        .reduce((p, r) => p.concat(r), []),
    ]);
    // @ts-ignore
    class CustomElement extends target {
      static override registerPlugin(reactiveClass: AttributeReactiveClass<T>) {
        CustomElement.observedAttributes.push(
          ...reactiveClass.observedAttributes,
        );
        if (reactiveClass.observedCSSProperties) {
          for (const property of reactiveClass.observedCSSProperties) {
            observedStyleProperties.add(property);
          }
        }
        attributeReactiveClasses.push(reactiveClass);
      }
      static override observedAttributes = [
        ...(target.observedAttributes ?? []),
        ...attributeReactiveClasses
          .map((e) => e.observedAttributes)
          .reduce((p, r) => p.concat(r), []),
        'class',
      ];
      __attributeReactives: AttributeReactiveObject[] = [];
      constructor() {
        super();
        if (template && !templateElement) {
          templateElement = document.createElement('template');
          templateElement.innerHTML = template;
          document.body.appendChild(templateElement);
        }
        if (templateElement) {
          this.attachShadow({ mode: 'open', delegatesFocus: true });
          const template = templateElement.content.cloneNode(true);
          this.shadowRoot?.append(template);
        }
        this.__attributeReactives = attributeReactiveClasses.map((oneClass) => {
          const oneAttributeReactive = new oneClass(this as InstanceType<T>);
          return oneAttributeReactive;
        });
        this.__cleanFalseAttributes();
      }

      /** handle observing styles */
      __checking = false;
      __previousStyle: Map<string, string> = new Map();

      __responseStyleChange() {
        if (!this.__checking && observedStyleProperties.size) {
          this.__checking = true;
          boostedQueueMicrotask(this.__invokeStyleHandler, this);
        }
      }

      __invokeStyleHandler() {
        const computedStyle = getComputedStyle(this);
        for (const propertyName of observedStyleProperties) {
          const value = computedStyle.getPropertyValue(propertyName);
          const priority = computedStyle.getPropertyPriority(propertyName);
          const propertyValue = convertStyleWithPriority(
            value.trim(),
            priority,
          );
          if (this.__previousStyle.get(propertyName) !== propertyValue) {
            for (const oneReactive of this.__attributeReactives) {
              oneReactive.cssPropertyChangedHandler?.[propertyName]?.call(
                oneReactive,
                propertyValue,
                propertyName,
              );
            }
          }
        }
        this.__checking = false;
      }

      /** handle attribute='false' */
      override setAttribute(qualifiedName: string, value: string): void {
        if (
          value.toString() === 'false'
          && !target.notToFilterFalseAttributes?.has(qualifiedName)
          && !qualifiedName.startsWith('data-')
        ) {
          this.removeAttribute(qualifiedName);
          return;
        }
        super.setAttribute(qualifiedName, value);
      }

      __cleanFalseAttributes() {
        const attributes = this.attributes;
        for (
          let index = 0, attr: Attr | null;
          (attr = attributes.item(index));
          index++
        ) {
          if (
            attr.value === 'false'
            && !target.notToFilterFalseAttributes?.has(attr.name)
            && !attr.name.startsWith('data-')
          ) {
            this.removeAttributeNode(attr);
          }
        }
      }

      __connected = false;
      /** handel custom element life-cycles */
      override attributeChangedCallback(
        name: string,
        oldValue: null | string,
        newValue: null | string,
      ) {
        super.attributeChangedCallback
          && super.attributeChangedCallback(name, oldValue, newValue);
        if (
          !target.notToFilterFalseAttributes?.has(name)
          && !name.startsWith('data-')
        ) {
          if (oldValue === 'false') oldValue = null;
          if (newValue === 'false') {
            newValue = null;
            this.removeAttribute(name);
          }
        }
        if (oldValue !== newValue) {
          if (this.__connected && (name === 'class' || name === 'style')) {
            this.__responseStyleChange();
          }
          for (const oneReactive of this.__attributeReactives) {
            if (oneReactive.attributeChangedHandler?.[name]) {
              const { handler, noDomMeasure } =
                oneReactive.attributeChangedHandler![name];
              if (noDomMeasure) {
                handler.call(oneReactive, newValue, oldValue, name);
              } else if (this.__connected) {
                boostedQueueMicrotask(() =>
                  handler.call(oneReactive, newValue, oldValue, name)
                );
              }
            }
          }
        }
      }

      __invokeAfterConnectedAttributeChangedHandler() {
        this.getAttributeNames().forEach((attributeName) => {
          for (const oneReactive of this.__attributeReactives) {
            if (oneReactive.attributeChangedHandler?.[attributeName]) {
              const { handler, noDomMeasure } =
                oneReactive.attributeChangedHandler![attributeName];
              if (!noDomMeasure) {
                boostedQueueMicrotask(() =>
                  handler.call(
                    oneReactive,
                    this.getAttribute(attributeName),
                    null,
                    attributeName,
                  )
                );
              }
            }
          }
        });
      }

      override connectedCallback() {
        super.connectedCallback?.();
        this.__attributeReactives.forEach((oneAttributeReactive) => {
          oneAttributeReactive.connectedCallback?.();
        });
        this.__responseStyleChange();
        boostedQueueMicrotask(
          this.__invokeAfterConnectedAttributeChangedHandler,
          this,
        );
        this.__connected = true;
      }
      override disconnectedCallback() {
        super.disconnectedCallback?.();
        this.__attributeReactives.forEach((oneAttributeReactive) => {
          oneAttributeReactive.dispose?.();
        });
      }

      __eventListenerMap: Record<
        string,
        {
          count: number;
          listenerCount: WeakMap<EventListener, number>;
          captureListenerCount: WeakMap<EventListener, number>;
        }
      > = {};

      override addEventListener(
        type: string,
        listener: EventListener,
        options?: AddEventListenerOptions | boolean,
      ): void {
        super.addEventListener(type, listener, options);
        this.__eventListenerMap[type] ??= {
          count: 0,
          listenerCount: new WeakMap(),
          captureListenerCount: new WeakMap(),
        };
        const targetEventInfo = this.__eventListenerMap[type];
        const capture = typeof options === 'object' ? options.capture : options;
        const targetMap = capture
          ? targetEventInfo.captureListenerCount
          : targetEventInfo.listenerCount;
        const currentListenerCount = targetMap.get(listener) ?? 0;
        targetMap.set(listener, currentListenerCount + 1);
        if (targetEventInfo.count === 0) {
          // trigger eventStatusChangeHandler
          for (const oneReactive of this.__attributeReactives) {
            const handler = oneReactive.eventStatusChangedHandler?.[type];
            if (handler) {
              handler.call(oneReactive, true, type);
            }
          }
        }
        targetEventInfo.count++;
      }

      override removeEventListener(
        type: string,
        listener: EventListener,
        options?: AddEventListenerOptions | boolean,
      ): void {
        super.removeEventListener(type, listener, options);
        const capture = typeof options === 'object' ? options.capture : options;
        const targetEventInfo = this.__eventListenerMap[type];
        if (targetEventInfo && targetEventInfo.count > 0) {
          const targetMap = capture
            ? targetEventInfo?.captureListenerCount
            : targetEventInfo?.listenerCount;
          const currentListenerCount = targetMap.get(listener);
          if (currentListenerCount === 1) {
            targetEventInfo.listenerCount.delete(listener);
            targetEventInfo.count--;
            if (targetEventInfo.count === 0) {
              // trigger eventStatusChangeHandler
              for (const oneReactive of this.__attributeReactives) {
                const handler = oneReactive.eventStatusChangedHandler?.[type];
                if (handler) {
                  handler.call(oneReactive, false, type);
                }
              }
            }
          }
        }
      }
    }
    addInitializer(() => {
      customElements.define(tag, CustomElement);
    });
    return CustomElement;
  };
}
