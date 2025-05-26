import {
  inShadowRootStyles,
  lynxUniqueIdAttribute,
  type StartMainThreadContextConfig,
} from '@lynx-js/web-constants';
import { Buffer } from 'node:buffer';
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

  async function renderToString(): Promise<Buffer> {
    await firstPaintReadyPromise;
    const ssrEncodeData = runtime?.ssrEncode?.();
    let offset = 0;
    const buffer = Buffer.alloc(bufferSize); // 1MB
    offset += buffer.write('<lynx-view ssr url="', offset, 'utf-8');
    offset += buffer.write(hydrateUrl, offset, 'utf-8');
    offset += buffer.write('"', offset, 'utf-8');
    if (autoSize) {
      offset += buffer.write(' height="auto" width="auto"', offset, 'utf-8');
    }
    if (lynxViewStyle) {
      offset += buffer.write(' style="', offset, 'utf-8');
      offset += buffer.write(lynxViewStyle, offset, 'utf-8');
      offset += buffer.write('"', offset, 'utf-8');
    }
    if (ssrEncodeData) {
      const encodeDataEncoded = ssrEncodeData ? encodeURI(ssrEncodeData) : ''; // to avoid XSS
      offset += buffer.write(' ssr-encode-data="', offset, 'utf-8');
      offset += buffer.write(encodeDataEncoded, offset, 'utf-8');
      offset += buffer.write('"', offset, 'utf-8');
    }
    offset += buffer.write(
      '><template shadowrootmode="open">',
      offset,
      'utf-8',
    );
    offset += buffer.write('<style>', offset, 'utf-8');
    offset += buffer.write(injectStyles, offset, 'utf-8');
    offset += buffer.write('\n', offset, 'utf-8');
    for (const style of inShadowRootStyles) {
      offset += buffer.write(style, offset, 'utf-8');
      offset += buffer.write('\n', offset, 'utf-8');
    }
    offset += buffer.write('</style>', offset, 'utf-8');

    offset = dumpHTMLString(
      buffer,
      offset,
      offscreenDocument,
      elementTemplates,
    );
    offset += buffer.write('</template></lynx-view>', offset, 'utf-8');
    return buffer.subarray(0, offset);
  }
  return {
    renderToString,
  };
}
