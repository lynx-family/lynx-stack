import {
  inShadowRootStyles,
  type MainThreadStartConfigs,
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';
import { loadMainThread } from '@lynx-js/web-mainthread-apis';
import { loadTemplate } from './utils/loadTemplate.js';
import {
  dumpHTMLString,
  OffscreenDocument,
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

interface LynxViewConfig extends
  Pick<
    MainThreadStartConfigs,
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
  const { startMainThread } = loadMainThread(
    backgroundThreadRpc,
    offscreenDocument,
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

  async function renderToString(): Promise<string> {
    await firstPaintReadyPromise;
    const innerShadowRootHTML = dumpHTMLString(
      offscreenDocument,
      elementTemplates,
    );
    const ssrEncodeData = runtime?.ssrEncode?.();
    const encodeDataEncoded = ssrEncodeData ? encodeURI(ssrEncodeData) : ''; // to avoid XSS
    return `
    <lynx-view url="${hydrateUrl}" ssr ${
      autoSize ? 'height="auto" width="auto"' : ''
    } ${lynxViewStyle ? `style="${lynxViewStyle}"` : ''} ${
      encodeDataEncoded ? `ssr-encode-data="${encodeDataEncoded}"` : ''
    }>
      <template shadowrootmode="open">
        <style>${injectStyles}\n${inShadowRootStyles.join('\n')}</style>
        ${innerShadowRootHTML}
      </template>
    </lynx-view>`;
  }
  return {
    renderToString,
  };
}
