import {
  LynxElement,
  MainThreadGlobalThis,
  // TemplateManager,
} from '../dist/debug.js';
import { systemInfo } from './constants.js';
import { createIFrameRealm } from './mtsRealm.js';
import { MainThreadJSBinding } from './mtsBinding.js';
import { BTSRpc } from './btsRpc.js';
import { createMtsGlobalThis, templateManager } from './createMtsGlobalThis.js';

async function fetchTemplate(
  templateUrl: string,
  custom_template_loader?: (url: string) => Promise<Uint8Array>,
): Promise<void> {
  const loader = custom_template_loader || ((url) =>
    fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    }).then(response => {
      if (!response.ok) {
        throw new Error(
          `Failed to load template from ${url}: ${response.statusText}`,
        );
      }
      return response.arrayBuffer().then(buffer => new Uint8Array(buffer));
    }));
  if (!templateManager.has_template_in_cache(templateUrl)) {
    const buffer = await loader(templateUrl);
    templateManager.push_template_to_cache(templateUrl, buffer);
  }
}

export async function StartMainThread(
  templateUrl: string,
  document: Document,
  rootDom: ShadowRoot,
  crossThreadMessagePort: MessagePort,
  custom_template_loader?: (url: string) => Promise<Uint8Array>,
) {
  // fetch
  const [_, mtsRealm] = await Promise.all([
    fetchTemplate(templateUrl, custom_template_loader),
    createIFrameRealm(rootDom),
  ]);
  const mtsBinding = new MainThreadJSBinding(
    mtsRealm,
    rootDom,
  );

  const mtsGlobalThis = createMtsGlobalThis(
    rootDom,
    mtsRealm,
    mtsBinding,
    new BTSRpc(crossThreadMessagePort),
  );
  Object.assign(
    globalThisObj,
  );
  return mtsGlobalThis;
}

export function scheduleGC(mtsGlobalThis: MainThreadGlobalThis) {
  requestIdleCallback(() => {
    mtsGlobalThis.__wasm_GC();
  });
}
