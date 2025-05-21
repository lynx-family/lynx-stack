import {
  flushElementTreeEndpoint,
  inShadowRootStyles,
  mainThreadStartEndpoint,
  type MainThreadStartConfigs,
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';
import { startMainThread } from '@lynx-js/web-worker-runtime';
import { loadTemplate } from './utils/loadTemplate.js';
import { dumpHTMLString } from '@lynx-js/offscreen-document/webworker';
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
  overrideTagTransformMap?: Record<string, string>;
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
    overrideTagTransformMap = {},
    hydrateUrl,
    autoSize,
    injectStyles,
    lynxViewStyle,
  } = config;

  const mainToUIChannel = new MessageChannel();
  const mainWithBackgroundChannel = new MessageChannel();
  const mainToUIMessagePort = mainToUIChannel.port2;
  const uiToMainRpc = new Rpc(mainToUIChannel.port1, 'main-to-ui');
  const { docu: offscreenDocument } = startMainThread(
    mainToUIMessagePort,
    mainWithBackgroundChannel.port2,
  );
  const { promise: firstPaintReadyPromise, resolve: firstPaintReady } = Promise
    .withResolvers<void>();
  const template = await loadTemplate(rawTemplate, config.templateName);
  const mainThreadStart = uiToMainRpc.createCall(mainThreadStartEndpoint);
  mainThreadStart({
    template,
    initData,
    globalProps,
    browserConfig,
    nativeModulesMap: {}, // the bts won't start
    napiModulesMap: {}, // the bts won't start
    tagMap,
  });
  uiToMainRpc.registerHandler(
    flushElementTreeEndpoint,
    () => {
      firstPaintReady();
    },
  );

  const elementTemplates = {
    ...builtinElementTemplates,
    ...overrideElemenTemplates,
  };
  const tagTransformMap = {
    ...builtinTagTransformMap,
    ...overrideTagTransformMap,
  };

  async function renderToString(): Promise<string> {
    await firstPaintReadyPromise;
    const innerShadowRootHTML = dumpHTMLString(
      offscreenDocument,
      elementTemplates,
      tagTransformMap,
    );
    return `
    <lynx-view url="${hydrateUrl}" ssr ${
      autoSize ? 'height="auto" width="auto"' : ''
    } ${lynxViewStyle ? `style="${lynxViewStyle}"` : ''}>
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
