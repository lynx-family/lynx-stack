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
import { LynxViewInstance } from './LynxViewInstance.js';
import { createIFrameRealm } from './createIFrameRealm.js';
// @ts-expect-error
import INSHARDOWCSS from '../../../css/in_shadow.css?inline';

let CompatCSS: string | undefined;
try {
  // @ts-expect-error
  CompatCSS = (await import(
    '@lynx-js/web-elements-compat/LinearContainer/linear-compat.css?inline'
  )).default;
} catch {}
const IN_SHADOW_CSS = URL.createObjectURL(
  new Blob([INSHARDOWCSS, CompatCSS], { type: 'text/css' }),
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
  private static observedAttributeAsProperties = [
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
  private _instance?: LynxViewInstance;

  private _connected = false;
  private _url?: string;
  /**
   * @public
   * @property the url of lynx view output entry file
   */
  get url(): string | undefined {
    return this._url;
  }
  set url(val: string) {
    this._url = val;
    this._render();
  }

  private _globalProps: Cloneable = {};
  /**
   * @public
   * @property globalProps
   * @default {}
   */
  get globalProps(): Cloneable {
    return this._globalProps;
  }
  set globalProps(val: string | Cloneable) {
    if (typeof val === 'string') {
      this._globalProps = JSON.parse(val);
    } else {
      this._globalProps = val;
    }
  }

  private _initData: Cloneable = {};
  /**
   * @public
   * @property initData
   * @default {}
   */
  get initData(): Cloneable {
    return this._initData;
  }
  set initData(val: string | Cloneable) {
    if (typeof val === 'string') {
      this._initData = JSON.parse(val);
    } else {
      this._initData = val;
    }
  }

  private _initI18nResources: InitI18nResources = [];
  /**
   * @public
   * @property initI18nResources
   * @default {}
   */
  get initI18nResources(): InitI18nResources {
    return this._initI18nResources;
  }
  set initI18nResources(val: string | InitI18nResources) {
    if (typeof val === 'string') {
      this._initI18nResources = JSON.parse(val);
    } else {
      this._initI18nResources = val;
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
    this._instance?.i18nManager.updateData(data, options);
  }

  private _overrideLynxTagToHTMLTagMap: Record<string, string> = {
    'page': 'div',
  };
  /**
   * @public
   * @property
   * @default {page: 'div'}
   */
  get overrideLynxTagToHTMLTagMap(): Record<string, string> {
    return this._overrideLynxTagToHTMLTagMap;
  }
  set overrideLynxTagToHTMLTagMap(val: string | Record<string, string>) {
    if (typeof val === 'string') {
      this._overrideLynxTagToHTMLTagMap = JSON.parse(val);
    } else {
      this._overrideLynxTagToHTMLTagMap = val;
    }
  }

  private _cachedNativeModulesCall: Array<
    {
      args: [name: string, data: any, moduleName: string];
      resolve: (ret: unknown) => void;
    }
  > = [];
  private _onNativeModulesCall?: NativeModulesCall;
  /**
   * @param
   * @property
   */
  get onNativeModulesCall(): NativeModulesCall | undefined {
    return this._onNativeModulesCall;
  }
  set onNativeModulesCall(handler: NativeModulesCall) {
    this._onNativeModulesCall = handler;
    for (const callInfo of this._cachedNativeModulesCall) {
      callInfo.resolve(handler.apply(undefined, callInfo.args));
    }
    this._cachedNativeModulesCall = [];
  }

  private _nativeModulesMap: NativeModulesMap = {};
  /**
   * @public
   * @property nativeModulesMap
   * @default {}
   */
  get nativeModulesMap(): NativeModulesMap | undefined {
    return this._nativeModulesMap;
  }
  set nativeModulesMap(map: NativeModulesMap) {
    this._nativeModulesMap = map;
  }

  private _napiModulesMap: NapiModulesMap = {};
  /**
   * @param
   * @property napiModulesMap
   * @default {}
   */
  get napiModulesMap(): NapiModulesMap | undefined {
    return this._napiModulesMap;
  }
  set napiModulesMap(map: NapiModulesMap) {
    this._napiModulesMap = map;
  }

  private _onNapiModulesCall?: NapiModulesCall;
  /**
   * @param
   * @property
   */
  get onNapiModulesCall(): NapiModulesCall | undefined {
    return this._onNapiModulesCall;
  }
  set onNapiModulesCall(handler: INapiModulesCall) {
    this._onNapiModulesCall = (name, data, moduleName, dispatchNapiModules) => {
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
    processorName?: string,
    callback?: () => void,
  ) {
    this._instance?.updateData(data, processorName).then(() => {
      callback?.();
    });
  }

  /**
   * @public
   * @method
   * update the `__globalProps`
   */
  updateGlobalProps(data: Cloneable) {
    this._instance?.updateGlobalProps(data);
    this.globalProps = data;
  }

  /**
   * @public
   * @method
   * send global events, which can be listened to using the GlobalEventEmitter
   */
  sendGlobalEvent(eventName: string, params: Cloneable[]) {
    this._instance?.backgroundThread.sendGlobalEvent(eventName, params);
  }

  /**
   * @public
   * @method
   * reload the current page
   */
  reload() {
    this.removeAttribute('ssr');
    this._render();
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
          this._url = newValue;
          break;
        case 'global-props':
          this._globalProps = JSON.parse(newValue);
          break;
        case 'init-data':
          this._initData = JSON.parse(newValue);
          break;
      }
    }
  }

  public injectStyleRules: string[] = [];

  /**
   * @private
   */
  disconnectedCallback() {
    this._instance?.[Symbol.asyncDispose]();
    this._instance = undefined;
    // under the all-on-ui strategy, when reload() triggers dsl flush, the previously removed pageElement will be used in __FlushElementTree.
    // This attribute is added to filter this issue.
    this.shadowRoot?.querySelector('[part="page"]')
      ?.setAttribute(
        lynxDisposedAttribute,
        '',
      );
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }

  /**
   * @private the flag to group all changes into one render operation
   */
  private _rendering = false;

  /**
   * @private
   */
  private _render() {
    if (!this._rendering && this._connected) {
      this._rendering = true;
      this.attachShadow({ mode: 'open' });
      const mtsRealmPromise = createIFrameRealm(this.shadowRoot!);
      queueMicrotask(async () => {
        this._rendering = false;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = IN_SHADOW_CSS;
        this.shadowRoot!.appendChild(link);
        const mtsRealm = await mtsRealmPromise;
        if (this._instance) {
          this.disconnectedCallback();
        }
        if (this._url) {
          const lynxGroupId = this.lynxGroupId;
          this._instance = new LynxViewInstance(
            this,
            this.initData,
            this.globalProps,
            this._url,
            this.shadowRoot!,
            mtsRealm,
            lynxGroupId,
            this._nativeModulesMap,
            this._napiModulesMap,
            this._initI18nResources,
          );
        }
      });
    }
  }
  /**
   * @private
   */
  connectedCallback() {
    // @ts-expect-error
    if (super.url) {
      // @ts-expect-error
      this._url = super.url;
    }
    this._connected = true;
    this._render();
  }
}

if (customElements.get(LynxViewElement.tag)) {
  console.error(`[${LynxViewElement.tag}] has already been defined`);
} else {
  customElements.define(LynxViewElement.tag, LynxViewElement);
}
