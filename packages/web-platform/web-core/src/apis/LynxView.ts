// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  type LynxView as LynxViewInstance,
  createLynxView,
} from './createLynxView.js';
import {
  type Cloneable,
  lynxViewRootDomId,
  type NapiModulesCall,
  type NapiModulesMap,
  type NativeModulesCall,
  type NativeModulesMap,
  type UpdateDataType,
} from '@lynx-js/web-constants';
import { inShadowRootStyles } from './inShadowRootStyles.js';

/**
 * Based on our experiences, these elements are almost used in all lynx cards.
 */

/**
 * @param {string} url [required] The url of the entry of your Lynx card
 * @param {Cloneable} globalProps [optional] The globalProps value of this Lynx card
 * @param {Cloneable} initData [oprional] The initial data of this Lynx card
 * @param {Record<string,string>} overrideLynxTagToHTMLTagMap [optional] use this property/attribute to override the lynx tag -> html tag map
 * @param {NativeModulesMap} nativeModulesMap [optional] use to customize NativeModules. key is module-name, value is esm url.
 * @param {NativeModulesCall} onNativeModulesCall [optional] the NativeModules value handler. Arguments will be cached before this property is assigned.
 * @param {"auto" | null} height [optional] set it to "auto" for height auto-sizing
 * @param {"auto" | null} width [optional] set it to "auto" for width auto-sizing
 * @param {NapiModulesMap} napiModulesMap [optional] the napiModule which is called in lynx-core. key is module-name, value is esm url.
 * @param {NapiModulesCall} onNapiModulesCall [optional] the NapiModule value handler.
 * @param {"false" | "true" | null} injectHeadLinks [optional] @default true set it to "false" to disable injecting the <link href="" ref="stylesheet"> styles into shadowroot
 *
 * @event error lynx card fired an error
 *
 * @example
 * HTML Exmaple
 *
 * Note that you should declarae the size of lynx-view
 *
 * ```html
 * <lynx-view url="https://path/to/main-thread.js" rawData="{}" globalProps="{}" style="height:300px;width:300px">
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
    'globalProps',
    'initData',
    'overrideLynxTagToHTMLTagMap',
    'nativeModulesMap',
  ];
  private static attributeCamelCaseMap = Object.fromEntries(
    this.observedAttributeAsProperties.map((
      nm,
    ) => [nm.toLocaleLowerCase(), nm]),
  );
  /**
   * @private
   */
  static observedAttributes = LynxView.observedAttributeAsProperties.map(nm =>
    nm.toLowerCase()
  );
  #instance?: {
    lynxView: LynxViewInstance;
    rootDom: HTMLDivElement;
    resizeObserver?: ResizeObserver;
  };

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
  set onNapiModulesCall(handler: NapiModulesCall) {
    this.#onNapiModulesCall = handler;
  }

  #autoHeight = false;
  #autoWidth = false;
  #currentWidth = 0;
  #currentHeight = 0;
  /**
   * @public
   * "auto" for auto calculated height
   */
  get height() {
    return this.#autoHeight ? 'auto' : null;
  }
  /**
   * @public
   * "auto" for auto calculated width
   */
  get width() {
    return this.#autoWidth ? 'auto' : null;
  }
  set height(val: string | null) {
    this.#handleAutoSize();
    this.#autoHeight = val === 'auto' ? true : false;
  }
  set width(val: string | null) {
    this.#handleAutoSize();
    this.#autoWidth = val === 'auto' ? true : false;
  }
  #handleAutoSize() {
    if (this.#autoHeight || this.#autoWidth) {
      if (this.#instance && !this.#instance.resizeObserver) {
        this.#instance.resizeObserver = new ResizeObserver((sizes) => {
          const size = sizes[0];
          if (size) {
            const { width, height } = size.contentRect;
            if (this.#autoWidth) {
              if (this.#currentWidth !== width) {
                this.#currentWidth = width;
                this.style.setProperty('--lynx-view-width', `${width}px`);
              }
            }
            if (this.#autoHeight) {
              if (this.#currentHeight !== height) {
                this.#currentHeight = height;
                this.style.setProperty('--lynx-view-height', `${height}px`);
              }
            }
          }
        });
        this.#instance.resizeObserver.observe(this.#instance.rootDom);
      }
    } else {
      if (this.#instance?.resizeObserver) {
        this.#instance.resizeObserver.disconnect();
      }
    }
    if (this.#autoHeight) {
      this.setAttribute('height', 'auto');
    } else {
      this.removeAttribute('height');
    }
    if (this.#autoWidth) {
      this.setAttribute('width', 'auto');
    } else {
      this.removeAttribute('width');
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
    this.#instance?.lynxView.updateData(data, updateDataType, callback);
  }

  /**
   * @public
   * @method
   * send global events, which can be listened to using the GlobalEventEmitter
   */
  sendGlobalEvent(eventName: string, params: Cloneable[]) {
    this.#instance?.lynxView.sendGlobalEvent(eventName, params);
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
      name = LynxView.attributeCamelCaseMap[name] ?? name;
      if (name in this) {
        // @ts-expect-error
        this[name] = newValue;
      }
    }
  }

  /**
   * @private
   */
  disconnectedCallback() {
    this.cleanupResizeObserver();
    if (this.#instance) {
      this.#instance.lynxView.dispose();
      this.#instance.rootDom.remove();
    }
    this.#instance = undefined;
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }

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
          const rootDom = document.createElement('div');
          rootDom.id = lynxViewRootDomId;
          rootDom.setAttribute('part', lynxViewRootDomId);
          const tagMap = {
            'page': 'div',
            'view': 'x-view',
            'text': 'x-text',
            'image': 'x-image',
            'list': 'x-list',
            'svg': 'x-svg',
            ...this.overrideLynxTagToHTMLTagMap,
          };
          const lynxView = createLynxView({
            tagMap,
            rootDom,
            templateUrl: this.#url,
            globalProps: this.#globalProps,
            initData: this.#initData,
            nativeModulesMap: this.#nativeModulesMap,
            napiModulesMap: this.#napiModulesMap,
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
            },
          });
          this.#instance = {
            lynxView,
            rootDom,
          };
          this.#handleAutoSize();
          if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
          }
          const styleElement = document.createElement('style');
          this.shadowRoot!.append(styleElement);
          const styleSheet = styleElement.sheet!;
          styleSheet.insertRule(inShadowRootStyles);
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
          this.shadowRoot!.append(rootDom);
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

  private cleanupResizeObserver() {
    if (this.#instance?.resizeObserver) {
      this.#instance.resizeObserver.disconnect();
      this.#instance.resizeObserver = undefined;
    }
  }
}

if (customElements.get(LynxView.tag)) {
  console.warn(`[${LynxView.tag}] has already been defined`);
} else {
  customElements.define(LynxView.tag, LynxView);
}
