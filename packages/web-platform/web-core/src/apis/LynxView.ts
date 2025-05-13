// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  type LynxView as LynxViewInstance,
  createLynxView,
} from './createLynxView.js';
import {
  inShadowRootStyles,
  type Cloneable,
  type LynxTemplate,
  type NapiModulesCall,
  type NapiModulesMap,
  type NativeModulesCall,
  type NativeModulesMap,
  type UpdateDataType,
} from '@lynx-js/web-constants';

export type INapiModulesCall = (
  name: string,
  data: any,
  moduleName: string,
  lynxView: LynxView,
  dispatchNapiModules: (data: Cloneable) => void,
) => Promise<{ data: unknown; transfer?: Transferable[] }> | {
  data: unknown;
  transfer?: Transferable[];
} | undefined;

/**
 * Based on our experiences, these elements are almost used in all lynx cards.
 */

/**
 * @property {string} url [required] (attribute: "url") The url of the entry of your Lynx card
 * @property {Cloneable} globalProps [optional] (attribute: "global-props") The globalProps value of this Lynx card
 * @property {Cloneable} initData [oprional] (attribute: "init-data") The initial data of this Lynx card
 * @property {Record<string,string>} overrideLynxTagToHTMLTagMap [optional] use this property/attribute to override the lynx tag -> html tag map
 * @property {NativeModulesMap} nativeModulesMap [optional] use to customize NativeModules. key is module-name, value is esm url.
 * @property {NativeModulesCall} onNativeModulesCall [optional] the NativeModules value handler. Arguments will be cached before this property is assigned.
 * @property {"auto" | null} height [optional] (attribute: "height") set it to "auto" for height auto-sizing
 * @property {"auto" | null} width [optional] (attribute: "width") set it to "auto" for width auto-sizing
 * @property {NapiModulesMap} napiModulesMap [optional] the napiModule which is called in lynx-core. key is module-name, value is esm url.
 * @property {INapiModulesCall} onNapiModulesCall [optional] the NapiModule value handler.
 * @property {"false" | "true" | null} injectHeadLinks [optional] (attribute: "inject-head-links") @default true set it to "false" to disable injecting the <link href="" ref="stylesheet"> styles into shadowroot
 * @property {string[]} injectStyleRules [optional] the css rules which will be injected into shadowroot. Each items will be inserted by `insertRule` method. @see https://developer.mozilla.org/docs/Web/API/CSSStyleSheet/insertRule
 * @property {number} lynxGroupId [optional] (attribute: "lynx-group-id") the background shared context id, which is used to share webworker between different lynx cards
 * @property {"all-on-ui" | "multi-thread"} threadStrategy [optional] @default "multi-thread" (attribute: "thread-strategy") controls the thread strategy for current lynx view
 * @property {(string)=>Promise<LynxTemplate>} customTemplateLoader [optional] the custom template loader, which is used to load the template
 *
 * @event error lynx card fired an error
 *
 * @example
 * HTML Exmaple
 *
 * Note that you should declarae the size of lynx-view
 *
 * ```html
 * <lynx-view url="https://path/to/main-thread.js" raw-data="{}" global-props="{}" style="height:300px;width:300px">
 * </lynx-view>
 * ```
 *
 * React 19 Example
 * ```jsx
 * <lynx-view url={myLynxCardUrl} rawData={{}} globalProps={{}} style={{height:'300px', width:'300px'}}>
 * </lynx-vew>
 * ```
 */
export class LynxView extends HTMLElement {
  static lynxViewCount = 0;
  static tag = 'lynx-view' as const;
  private static observedAttributeAsProperties = [
    'url',
    'global-props',
    'init-data',
  ];
  /**
   * @private
   */
  static observedAttributes = LynxView.observedAttributeAsProperties.map(nm =>
    nm.toLowerCase()
  );
  #instance?: LynxViewInstance;

  #url?: string;
  /**
   * @public
   * @property the url of lynx view output entry file
   */
  get url(): string | undefined {
    return this.#url;
  }
  set url(val: string) {
    this.#url = val;
    this.#render();
  }

  #globalProps: Cloneable = {};
  /**
   * @public
   * @property globalProps
   * @default {}
   */
  get globalProps(): Cloneable {
    return this.#globalProps;
  }
  set globalProps(val: string | Cloneable) {
    if (typeof val === 'string') {
      this.#globalProps = JSON.parse(val);
    } else {
      this.#globalProps = val;
    }
  }

  #initData: Cloneable = {};
  /**
   * @public
   * @property initData
   * @default {}
   */
  get initData(): Cloneable {
    return this.#initData;
  }
  set initData(val: string | Cloneable) {
    if (typeof val === 'string') {
      this.#initData = JSON.parse(val);
    } else {
      this.#initData = val;
    }
  }

  #overrideLynxTagToHTMLTagMap: Record<string, string> = { 'page': 'div' };
  /**
   * @public
   * @property
   * @default {page: 'div'}
   */
  get overrideLynxTagToHTMLTagMap(): Record<string, string> {
    return this.#overrideLynxTagToHTMLTagMap;
  }
  set overrideLynxTagToHTMLTagMap(val: string | Record<string, string>) {
    if (typeof val === 'string') {
      this.#overrideLynxTagToHTMLTagMap = JSON.parse(val);
    } else {
      this.#overrideLynxTagToHTMLTagMap = val;
    }
  }

  #cachedNativeModulesCall?: Parameters<NativeModulesCall>[] = [];
  #onNativeModulesCall?: NativeModulesCall;
  /**
   * @param
   * @property
   */
  get onNativeModulesCall(): NativeModulesCall | undefined {
    return this.#onNativeModulesCall;
  }
  set onNativeModulesCall(handler: NativeModulesCall) {
    this.#onNativeModulesCall = handler;
    if (this.#cachedNativeModulesCall) {
      for (const callInfo of this.#cachedNativeModulesCall) {
        handler.apply(undefined, callInfo);
      }
    }
  }

  #nativeModulesMap: NativeModulesMap = {};
  /**
   * @public
   * @property nativeModulesMap
   * @default {}
   */
  get nativeModulesMap(): NativeModulesMap | undefined {
    return this.#nativeModulesMap;
  }
  set nativeModulesMap(map: NativeModulesMap) {
    this.#nativeModulesMap = map;
  }

  #napiModulesMap: NapiModulesMap = {};
  /**
   * @param
   * @property napiModulesMap
   * @default {}
   */
  get napiModulesMap(): NapiModulesMap | undefined {
    return this.#napiModulesMap;
  }
  set napiModulesMap(map: NapiModulesMap) {
    this.#napiModulesMap = map;
  }

  #onNapiModulesCall?: NapiModulesCall;
  /**
   * @param
   * @property
   */
  get onNapiModulesCall(): NapiModulesCall | undefined {
    return this.#onNapiModulesCall;
  }
  set onNapiModulesCall(handler: INapiModulesCall) {
    this.#onNapiModulesCall = (name, data, moduleName, dispatchNapiModules) => {
      return handler(name, data, moduleName, this, dispatchNapiModules);
    };
  }

  /**
   * @param
   * @property
   */
  get lynxGroupId(): number | undefined {
    return this.getAttribute('lynx-group-id')
      ? Number(this.getAttribute('lynx-group-id')!)
      : undefined;
  }
  set lynxGroupId(val: number | undefined) {
    if (val) {
      this.setAttribute('lynx-group-id', val.toString());
    } else {
      this.removeAttribute('lynx-group-id');
    }
  }

  /**
   * @public
   * @method
   * update the `__initData` and trigger essential flow
   */
  updateData(
    data: Cloneable,
    updateDataType: UpdateDataType,
    callback?: () => void,
  ) {
    this.#instance?.updateData(data, updateDataType, callback);
  }

  /**
   * @public
   * @method
   * send global events, which can be listened to using the GlobalEventEmitter
   */
  sendGlobalEvent(eventName: string, params: Cloneable[]) {
    this.#instance?.sendGlobalEvent(eventName, params);
  }

  /**
   * @public
   * @method
   * reload the current page
   */
  reload() {
    this.#render();
  }

  /**
   * @override
   * "false" value will be omitted
   *
   * {@inheritdoc HTMLElement.setAttribute}
   */
  override setAttribute(qualifiedName: string, value: string): void {
    if (value === 'false') {
      this.removeAttribute(qualifiedName);
    } else {
      super.setAttribute(qualifiedName, value);
    }
  }

  /**
   * @private
   */
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      switch (name) {
        case 'url':
          this.#url = newValue;
          break;
        case 'global-props':
          this.#globalProps = JSON.parse(newValue);
          break;
        case 'init-data':
          this.#initData = JSON.parse(newValue);
          break;
      }
    }
  }

  /**
   * @param
   * @property
   */
  get threadStrategy(): 'all-on-ui' | 'multi-thread' {
    // @ts-expect-error
    return this.getAttribute('thread-strategy');
  }
  set threadStrategy(val: 'all-on-ui' | 'multi-thread') {
    if (val) {
      this.setAttribute('thread-strategy', val);
    } else {
      this.removeAttribute('thread-strategy');
    }
  }

  get injectHeadLinks(): boolean {
    return this.getAttribute('inject-head-links') !== 'false';
  }
  set injectHeadLinks(val: boolean) {
    if (val) {
      this.setAttribute('inject-head-links', 'true');
    } else {
      this.removeAttribute('inject-head-links');
    }
  }

  public injectStyleRules: string[] = [];

  /**
   * @private
   */
  disconnectedCallback() {
    this.#instance?.dispose();
    this.#instance = undefined;
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }

  /**
   * @public
   * allow user to customize the template loader
   * @param url the url of the template
   */
  customTemplateLoader?: (url: string) => Promise<LynxTemplate>;

  /**
   * @private the flag to group all changes into one render operation
   */
  #rendering = false;

  /**
   * @private
   */
  #render() {
    if (!this.#rendering) {
      this.#rendering = true;
      queueMicrotask(() => {
        this.#rendering = false;
        if (this.#instance) {
          this.disconnectedCallback();
        }
        if (this.#url) {
          const tagMap = {
            'page': 'div',
            'view': 'x-view',
            'text': 'x-text',
            'image': 'x-image',
            'list': 'x-list',
            'svg': 'x-svg',
            ...this.overrideLynxTagToHTMLTagMap,
          };
          if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
          }
          const lynxGroupId = this.lynxGroupId;
          const threadStrategy = (this.threadStrategy ?? 'multi-thread') as
            | 'all-on-ui'
            | 'multi-thread';
          const lynxView = createLynxView({
            threadStrategy,
            tagMap,
            shadowRoot: this.shadowRoot!,
            templateUrl: this.#url,
            globalProps: this.#globalProps,
            initData: this.#initData,
            nativeModulesMap: this.#nativeModulesMap,
            napiModulesMap: this.#napiModulesMap,
            lynxGroupId,
            callbacks: {
              nativeModulesCall: (
                ...args: [name: string, data: any, moduleName: string]
              ) => {
                if (this.#onNativeModulesCall) {
                  return this.#onNativeModulesCall(...args);
                } else if (this.#cachedNativeModulesCall) {
                  this.#cachedNativeModulesCall.push(args);
                } else {
                  this.#cachedNativeModulesCall = [args];
                }
              },
              napiModulesCall: (...args) => {
                return this.#onNapiModulesCall?.(...args);
              },
              onError: () => {
                this.dispatchEvent(
                  new CustomEvent('error', {}),
                );
              },
              customTemplateLoader: this.customTemplateLoader,
            },
          });
          this.#instance = lynxView;
          const styleElement = document.createElement('style');
          this.shadowRoot!.append(styleElement);
          const styleSheet = styleElement.sheet!;
          for (const rule of inShadowRootStyles) {
            styleSheet.insertRule(rule);
          }
          for (const rule of this.injectStyleRules) {
            styleSheet.insertRule(rule);
          }
          const injectHeadLinks =
            this.getAttribute('inject-head-links') !== 'false';
          if (injectHeadLinks) {
            document.head.querySelectorAll('link[rel="stylesheet"]').forEach(
              (linkElement) => {
                const href = (linkElement as HTMLLinkElement).href;
                styleSheet.insertRule(`@import url("${href}");`);
              },
            );
          }
        }
      });
    }
  }
  /**
   * @private
   */
  connectedCallback() {
    this.#render();
  }
}

if (customElements.get(LynxView.tag)) {
  console.warn(`[${LynxView.tag}] has already been defined`);
} else {
  customElements.define(LynxView.tag, LynxView);
}
