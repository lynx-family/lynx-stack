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
  overrideElemenTemplates?: Record<
    string,
    ((attributes: Record<string, string>) => string) | string
  >;
  autoSize?: boolean;
  lynxViewStyle?: string;
  /** 1MB by default */
  bufferSize?: number;
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
    overrideElemenTemplates = {},
    hydrateUrl,
    autoSize,
    injectStyles,
    lynxViewStyle,
    bufferSize = 1024 * 1024, // 1MB by default
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
    ...overrideElemenTemplates,
  };

  async function renderToString(): Promise<ArrayBuffer> {
    await firstPaintReadyPromise;
    const ssrEncodeData = runtime?.ssrEncode?.();
    let offset = 0;
    const buf = new ArrayBuffer(bufferSize);
    const buffer = new Uint16Array(buf);
    offset += write(buffer, '<lynx-view ssr url="', offset);
    offset += write(buffer, hydrateUrl, offset);
    offset += write(buffer, '"', offset);
    if (autoSize) {
      offset += write(buffer, ' height="auto" width="auto"', offset);
    }
    if (lynxViewStyle) {
      offset += write(buffer, ' style="', offset);
      offset += write(buffer, lynxViewStyle, offset);
      offset += write(buffer, '"', offset);
    }
    if (ssrEncodeData) {
      const encodeDataEncoded = ssrEncodeData ? encodeURI(ssrEncodeData) : ''; // to avoid XSS
      offset += write(buffer, ' ssr-encode-data="', offset);
      offset += write(buffer, encodeDataEncoded, offset);
      offset += write(buffer, '"', offset);
    }
    offset += write(buffer, '><template shadowrootmode="open">', offset);
    offset += write(buffer, '<style>', offset);
    offset += write(buffer, injectStyles, offset);
    offset += write(buffer, '\n', offset);
    for (const style of inShadowRootStyles) {
      offset += write(buffer, style, offset);
      offset += write(buffer, '\n', offset);
    }
    offset += write(buffer, '</style>', offset);

    offset = dumpHTMLString(
      buffer,
      offset,
      offscreenDocument,
      elementTemplates,
    );
    offset += write(buffer, '</template></lynx-view>', offset);
    return buf.slice(0, offset * 2);
  }
  return {
    renderToString,
  };
}

export function write(
  buffer: Uint16Array,
  data: string,
  offset: number,
  maxLength: number = buffer.length - offset,
): number {
  const maxWrite = maxLength < data.length
    ? maxLength
    : data.length;
  for (let i = 0; i < maxWrite; i++) {
    buffer[offset + i] = data.charCodeAt(i);
  }
  return maxWrite;
}
