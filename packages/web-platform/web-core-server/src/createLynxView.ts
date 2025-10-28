import {
  I18nResources,
  inShadowRootStyles,
  lynxPartIdAttribute,
  lynxUniqueIdAttribute,
  type InitI18nResources,
  type StartMainThreadContextConfig,
  type SSREventReplayInfo,
  type SSRDumpInfo,
  type MainThreadGlobalThis,
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';
import { prepareMainThreadAPIs } from '@lynx-js/web-mainthread-apis';
import { loadTemplate } from './utils/loadTemplate.js';
import {
  _attributes,
  OffscreenDocument,
  OffscreenElement,
} from '@lynx-js/offscreen-document/webworker';
import {
  templateScrollView,
  templateXAudioTT,
  templateXImage,
  templateFilterImage,
  templateXInput,
  templateXList,
  templateXOverlayNg,
  templateXRefreshView,
  templateXSwiper,
  templateXText,
  templateInlineImage,
  templateXTextarea,
  templateXViewpageNg,
} from '@lynx-js/web-elements-template';
import { dumpHTMLString } from './dumpHTMLString.js';
import vm from 'node:vm';
import fs from 'node:fs';

interface LynxViewConfig extends
  Pick<
    StartMainThreadContextConfig,
    | 'browserConfig'
    | 'tagMap'
    | 'initData'
    | 'globalProps'
    | 'template'
    | 'initI18nResources'
  >
{
  templateName?: string;
  hydrateUrl: string;
  injectStyles: string;
  overrideElementTemplates?: Record<
    string,
    ((attributes: Record<string, string>) => string) | string
  >;
  autoSize?: boolean;
  lynxViewStyle?: string;
  threadStrategy?: 'all-on-ui';
}

const builtinElementTemplates = {
  'scroll-view': templateScrollView,
  'x-audio-tt': templateXAudioTT,
  'x-image': templateXImage,
  'filter-image': templateFilterImage,
  'x-input': templateXInput,
  'x-list': templateXList,
  'x-overlay-ng': templateXOverlayNg,
  'x-refresh-view': templateXRefreshView,
  'x-swiper': templateXSwiper,
  'x-text': templateXText,
  'inline-image': templateInlineImage,
  'x-textarea': templateXTextarea,
  'x-viewpage-ng': templateXViewpageNg,
};
const builtinTagTransformMap = {
  'page': 'div',
  'view': 'x-view',
  'text': 'x-text',
  'image': 'x-image',
  'list': 'x-list',
  'svg': 'x-svg',
};

// @ts-expect-error
OffscreenElement.prototype.toJSON = function toJSON(this: OffscreenElement) {
  return {
    ssrID: this[_attributes].get(lynxPartIdAttribute)
      ?? this[_attributes].get(lynxUniqueIdAttribute)!,
  };
};

export async function createLynxView(
  config: LynxViewConfig,
) {
  const {
    template: rawTemplate,
    browserConfig,
    tagMap,
    initData,
    globalProps,
    overrideElementTemplates = {},
    hydrateUrl,
    autoSize,
    injectStyles,
    lynxViewStyle,
    threadStrategy = 'all-on-ui',
    initI18nResources,
  } = config;
  const template = await loadTemplate(rawTemplate, config.templateName);
  const { promise: firstPaintReadyPromise, resolve: firstPaintReady } = Promise
    .withResolvers<void>();
  const mainWithBackgroundChannel = new MessageChannel();
  const backgroundThreadRpc = new Rpc(
    mainWithBackgroundChannel.port1,
    'background-thread',
  );
  const offscreenDocument = new OffscreenDocument({
    onCommit: () => {
    },
  });
  const i18nResources = new I18nResources();
  const events: SSREventReplayInfo[] = [];
  const mtsVMContext = vm.createContext(vm.constants.DONT_CONTEXTIFY);
  Object.assign(mtsVMContext, {
    document: offscreenDocument,
    module: { exports: null },
  });
  const loadScriptSync = (url: string) => {
    const scriptContent = fs.readFileSync(url);
    const script = new vm.Script(scriptContent.toString(), { filename: url });
    // @ts-expect-error
    mtsVMContext.module = { exports: null };
    script.runInContext(mtsVMContext);
    // @ts-expect-error
    const ret = mtsVMContext.module.exports;
    // @ts-expect-error
    mtsVMContext.module = { exports: null };
    return ret;
  };
  const loadScript = async (url: string) => {
    return new Promise((resolve, reject) => {
      fs.readFile(url, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          const script = new vm.Script(data.toString(), { filename: url });
          // @ts-expect-error
          mtsVMContext.module = { exports: null };
          script.runInContext(mtsVMContext);
          // @ts-expect-error
          const ret = mtsVMContext.module.exports;
          // @ts-expect-error
          mtsVMContext.module = { exports: null };
          resolve(ret);
        } catch (e) {
          reject(e);
        }
      });
    });
  };
  const { startMainThread } = prepareMainThreadAPIs(
    backgroundThreadRpc,
    offscreenDocument,
    offscreenDocument,
    {
      globalWindow: mtsVMContext as typeof globalThis,
      loadScript,
      loadScriptSync,
    },
    () => {
      firstPaintReady();
    },
    () => {
      // mark timing
    },
    () => {
      // flush mark timing
    },
    () => {
      // report error
    },
    () => {
      // trigger i18n resource fallback
    },
    (initI18nResources: InitI18nResources) => {
      i18nResources.setData(initI18nResources);
      return i18nResources;
    },
    (() => {}) as any,
    {
      __AddEvent(element, eventName, eventData, eventOptions) {
        events.push([
          Number(element.getAttribute(lynxUniqueIdAttribute)!),
          eventName,
          eventData,
          eventOptions,
        ]);
      },
    },
  );
  await startMainThread({
    template,
    initData,
    globalProps,
    browserConfig,
    nativeModulesMap: {}, // the bts won't start
    napiModulesMap: {}, // the bts won't start
    tagMap: {
      ...builtinTagTransformMap,
      ...tagMap,
    },
    initI18nResources,
  });

  const elementTemplates = {
    ...builtinElementTemplates,
    ...overrideElementTemplates,
  };

  async function renderToString(): Promise<string> {
    await firstPaintReadyPromise;
    const ssrEncodeData = (mtsVMContext as MainThreadGlobalThis)?.ssrEncode?.();
    const ssrDumpInfo: SSRDumpInfo = {
      ssrEncodeData,
      events,
    };
    const buffer: string[] = [];
    buffer.push(
      '<lynx-view url="',
      hydrateUrl,
      '" ssr ="',
      encodeURI(JSON.stringify(ssrDumpInfo)),
      '" ',
      'thread-strategy="',
      threadStrategy,
      '"',
    );
    if (autoSize) {
      buffer.push(' height="auto" width="auto"');
    }
    if (lynxViewStyle) {
      buffer.push(' style="', lynxViewStyle, '"');
    }
    buffer.push(
      '><template shadowrootmode="open">',
      '<style>',
      injectStyles,
      '\n',
      inShadowRootStyles.join('\n'),
      '</style>',
    );
    dumpHTMLString(
      buffer,
      offscreenDocument,
      elementTemplates,
    );
    buffer.push(
      '</template>',
    );
    buffer.push('</lynx-view>');
    return buffer.join('');
  }
  return {
    renderToString,
  };
}
