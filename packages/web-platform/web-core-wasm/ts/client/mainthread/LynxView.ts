// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  Cloneable,
  I18nResourceTranslationOptions,
  InitI18nResources,
  NapiModulesCall,
  NapiModulesMap,
  NativeModulesCall,
  NativeModulesMap,
} from '../../types/index.js';
import { lynxDisposedAttribute } from '../../constants.js';
import { createIFrameRealm } from './createIFrameRealm.js';
import type { LynxViewInstance } from './LynxViewInstance.js';
import { templateManager } from './TemplateManager.js';
import(
  /* webpackChunkName: "web-core-main-chunk" */
  /* webpackFetchPriority: "high" */
  './LynxViewInstance.js'
);
export type INapiModulesCall = (
  name: string,
  data: any,
  moduleName: string,
  lynxView: LynxViewElement,
  dispatchNapiModules: (data: Cloneable) => void,
) =>
  | Promise<{ data: unknown; transfer?: Transferable[] } | undefined>
  | {
    data: unknown;
    transfer?: Transferable[];
  }
  | undefined
  | Promise<undefined>;

/**
 * Based on our experiences, these elements are almost used in all lynx cards.
 */

/**
 * @property {string} url [required] (attribute: "url") The url of the entry of your Lynx card
 * @property {Cloneable} globalProps [optional] (attribute: "global-props") The globalProps value of this Lynx card
 * @property {Cloneable} initData [optional] (attribute: "init-data") The initial data of this Lynx card
 * @property {Record<string,string>} overrideLynxTagToHTMLTagMap [optional] use this property/attribute to override the lynx tag -> html tag map
 * @property {NativeModulesMap} nativeModulesMap [optional] use to customize NativeModules. key is module-name, value is esm url.
 * @property {NativeModulesCall} onNativeModulesCall [optional] the NativeModules value handler. Arguments will be cached before this property is assigned.
 * @property {"auto" | null} height [optional] (attribute: "height") set it to "auto" for height auto-sizing
 * @property {"auto" | null} width [optional] (attribute: "width") set it to "auto" for width auto-sizing
 * @property {NapiModulesMap} napiModulesMap [optional] the napiModule which is called in lynx-core. key is module-name, value is esm url.
 * @property {INapiModulesCall} onNapiModulesCall [optional] the NapiModule value handler.
 * @property {string[]} injectStyleRules [optional] the css rules which will be injected into shadowroot. Each items will be inserted by `insertRule` method. @see https://developer.mozilla.org/docs/Web/API/CSSStyleSheet/insertRule
 * @property {number} lynxGroupId [optional] (attribute: "lynx-group-id") the background shared context id, which is used to share webworker between different lynx cards
 * @property {(string)=>Promise<LynxTemplate>} customTemplateLoader [optional] the custom template loader, which is used to load the template
 * @property {InitI18nResources} initI18nResources [optional] (attribute: "init-i18n-resources") the complete set of i18nResources that on the container side, which can be obtained synchronously by _I18nResourceTranslation
 *
 * @event error lynx card fired an error
 * @event i18nResourceMissed i18n resource cache miss
 *
 * @example
 * HTML Example
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
 * </lynx-view>
 * ```
 */
export class LynxViewElement extends HTMLElement {
  static lynxViewCount = 0;
  static tag = 'lynx-view' as const;
  static observedAttributeAsProperties = [
    'url',
    'global-props',
    'init-data',
  ];
  /**
   * @private
   */
  static observedAttributes = LynxViewElement.observedAttributeAsProperties.map(
    nm => nm.toLowerCase(),
  );
  #instance?: LynxViewInstance;

  #connected = false;
  #url?: string;

  /**
   * @public
   * @property nativeModulesMap
   * @default {}
   */
  nativeModulesMap: NativeModulesMap | undefined;

  /**
   * @param
   * @property napiModulesMap
   * @default {}
   */
  napiModulesMap: NapiModulesMap | undefined;

  /**
   * @param
   * @property
   */
  onNapiModulesCall: NapiModulesCall | undefined;

  constructor() {
    super();
    if (!this.onNativeModulesCall) {
      this.onNativeModulesCall = (name, data, moduleName) => {
        return new Promise((resolve) => {
          this.#cachedNativeModulesCall.push({
            args: [name, data, moduleName],
            resolve,
          });
        });
      };
    }
  }

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

  #initI18nResources: InitI18nResources = [];
  /**
   * @public
   * @property initI18nResources
   * @default {}
   */
  get initI18nResources(): InitI18nResources {
    return this.#initI18nResources;
  }
  set initI18nResources(val: string | InitI18nResources) {
    if (typeof val === 'string') {
      this.#initI18nResources = JSON.parse(val);
    } else {
      this.#initI18nResources = val;
    }
  }

  /**
   * @public
   * @method
   * update the `__initData` and trigger essential flow
   */
  updateI18nResources(
    data: InitI18nResources,
    options: I18nResourceTranslationOptions,
  ) {
    this.#instance?.i18nManager.updateData(data, options);
  }

  #overrideLynxTagToHTMLTagMap: Record<string, string> = {
    'page': 'div',
  };
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

  #cachedNativeModulesCall: Array<
    {
      args: [name: string, data: any, moduleName: string];
      resolve: (ret: unknown) => void;
    }
  > = [];
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
    for (const callInfo of this.#cachedNativeModulesCall) {
      callInfo.resolve(handler.apply(undefined, callInfo.args));
    }
    this.#cachedNativeModulesCall = [];
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
    processorName?: string,
    callback?: () => void,
  ) {
    this.#instance?.updateData(data, processorName).then(() => {
      callback?.();
    });
  }

  /**
   * @public
   * @method
   * update the `__globalProps`
   */
  updateGlobalProps(data: Cloneable) {
    this.#instance?.updateGlobalProps(data);
    this.globalProps = data;
  }

  /**
   * @public
   * @method
   * send global events, which can be listened to using the GlobalEventEmitter
   */
  sendGlobalEvent(eventName: string, params: Cloneable[]) {
    this.#instance?.backgroundThread.sendGlobalEvent(eventName, params);
  }

  /**
   * @public
   * @method
   * reload the current page
   */
  reload() {
    this.removeAttribute('ssr');
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

  public injectStyleRules?: string[];

  /**
   * @private
   */
  disconnectedCallback() {
    // under the all-on-ui strategy, when reload() triggers dsl flush, the previously removed pageElement will be used in __FlushElementTree.
    // This attribute is added to filter this issue.
    this.shadowRoot?.querySelector('[part="page"]')
      ?.setAttribute(
        lynxDisposedAttribute,
        '',
      );
    this.#instance?.[Symbol.asyncDispose]();
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
    this.#instance = undefined;
  }

  /**
   * @#the flag to group all changes into one render operation
   */
  #rendering = false;

  /**
   * @private
   */
  #render() {
    if (!this.#rendering && this.#connected) {
      this.#rendering = true;
      if (!this.shadowRoot) {
        this.attachShadow({ mode: 'open' });
      }
      if (this.#instance) {
        this.disconnectedCallback();
      }
      const mtsRealmPromise = createIFrameRealm(this.shadowRoot!);
      queueMicrotask(async () => {
        if (this.injectStyleRules && this.injectStyleRules.length > 0) {
          const styleSheet = new CSSStyleSheet();
          for (const rule of this.injectStyleRules) {
            styleSheet.insertRule(rule);
          }
          this.shadowRoot!.adoptedStyleSheets = this.shadowRoot!
            .adoptedStyleSheets.concat(styleSheet);
        }
        const mtsRealm = await mtsRealmPromise;
        if (this.#url) {
          const lynxViewInstance = import(
            /* webpackChunkName: "web-core-main-chunk" */
            /* webpackFetchPriority: "high" */
            './LynxViewInstance.js'
          ).then(({ LynxViewInstance }) => {
            return new LynxViewInstance(
              this,
              this.initData,
              this.globalProps,
              this.#url!,
              this.shadowRoot!,
              mtsRealm,
              lynxGroupId,
              this.nativeModulesMap,
              this.napiModulesMap,
              this.#initI18nResources,
            );
          });
          templateManager.fetchBundle(this.#url, lynxViewInstance);

          const lynxGroupId = this.lynxGroupId;
          this.#instance = await lynxViewInstance;
          this.#rendering = false;
        }
      });
    }
  }
  /**
   * @private
   */
  connectedCallback() {
    if (this.url) {
      this.#url = this.url;
    }
    this.#connected = true;
    this.#render();
  }
}

if (customElements.get(LynxViewElement.tag)) {
  console.error(`[${LynxViewElement.tag}] has already been defined`);
} else {
  customElements.define(LynxViewElement.tag, LynxViewElement);
}
