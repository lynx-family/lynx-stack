import {
  flushElementTreeEndpoint,
  mainThreadStartEndpoint,
  type MainThreadStartConfigs,
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';
import { startMainThread } from '@lynx-js/web-worker-runtime';
import { loadTemplate } from './utils/loadTemplate.js';

interface LynxViewConfig extends
  Pick<
    MainThreadStartConfigs,
    'browserConfig' | 'tagMap' | 'initData' | 'globalProps' | 'template'
  >
{
}

export function createLynxView(
  config: LynxViewConfig,
) {
  const {
    template: rawTemplate,
    browserConfig,
    tagMap,
    initData,
    globalProps,
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
  const template = loadTemplate(rawTemplate);
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

  async function renderToString(): Promise<string> {
    await firstPaintReadyPromise;
    return offscreenDocument.innerHTML;
  }
  return {
    renderToString,
  };
}
