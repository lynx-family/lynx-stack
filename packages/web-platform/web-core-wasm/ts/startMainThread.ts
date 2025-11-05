import { MainThreadManager } from '../dist/standard.js';
import { createIFrameRealm } from './mtsRealm.js';

const mainThreadManager = new MainThreadManager();
export async function startMainThread(
  shadowRoot: ShadowRoot,
  templateUrl: string,
  initData: Record<string, unknown>,
  globalProps: Record<string, unknown>,
  customTemplateLoader?: (url: string) => Promise<Uint8Array>,
) {
  const mtsRealm = await createIFrameRealm(shadowRoot);
  mainThreadManager;
}
