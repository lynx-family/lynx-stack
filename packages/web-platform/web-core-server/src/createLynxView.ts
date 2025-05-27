import {
  inShadowRootStyles,
  lynxUniqueIdAttribute,
  type StartMainThreadContextConfig,
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

interface LynxViewConfig extends
  Pick<
    StartMainThreadContextConfig,
    'browserConfig' | 'tagMap' | 'initData' | 'globalProps' | 'template'
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
    ssrID: this[_attributes].get(lynxUniqueIdAttribute)!,
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
  const { startMainThread } = prepareMainThreadAPIs(
    backgroundThreadRpc,
    offscreenDocument,
    offscreenDocument.createElement.bind(offscreenDocument),
    () => {
      firstPaintReady();
    },
    () => {
      // mark timing
    },
    () => {
      // report error
    },
  );
  const runtime = await startMainThread({
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
  });

  const elementTemplates = {
    ...builtinElementTemplates,
    ...overrideElementTemplates,
  };

  async function renderToString(): Promise<string> {
    await firstPaintReadyPromise;
    const ssrEncodeData = runtime?.ssrEncode?.();
    const buffer: string[] = [];
    buffer.push(
      '<lynx-view url="',
      hydrateUrl,
      '" ssr',
    );
    if (autoSize) {
      buffer.push(' height="auto" width="auto"');
    }
    if (lynxViewStyle) {
      buffer.push(' style="', lynxViewStyle, '"');
    }
    if (ssrEncodeData) {
      const encodeDataEncoded = ssrEncodeData ? encodeURI(ssrEncodeData) : ''; // to avoid XSS
      buffer.push(' ssr-encode-data="', encodeDataEncoded, '"');
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
      '</lynx-view>',
    );
    return buffer.join('');
  }
  return {
    renderToString,
  };
}
