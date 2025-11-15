export type JSRealm = {
  globalWindow: typeof globalThis;
  loadScript: (url: string) => Promise<unknown>;
  loadScriptSync: (url: string) => unknown;
};

/**
 * Creates a isolated JavaScript context for executing mts code.
 * This context has its own global variables and functions.
 */
export async function createIFrameRealm(parent: Node): Promise<JSRealm> {
  const iframe = document.createElement('iframe');
  const iframeReadyPromise = new Promise<void>((resolve) => {
    const listener = (event: MessageEvent) => {
      if (
        event.data === 'lynx:mtsready' && event.source === iframe.contentWindow
      ) {
        resolve();
        globalThis.removeEventListener('message', listener);
      }
    };
    globalThis.addEventListener('message', listener);
  });
  iframe.style.display = 'none';
  iframe.srcdoc =
    '<!DOCTYPE html><html><head><script>parent.postMessage("lynx:mtsready","*")</script></head><body style="display:none"></body></html>';
  iframe.sandbox = 'allow-same-origin allow-scripts'; // Restrict capabilities for security
  iframe.loading = 'eager';
  parent.appendChild(iframe);
  await iframeReadyPromise;
  const iframeWindow = iframe.contentWindow! as unknown as typeof globalThis;
  const loadScript: (url: string) => Promise<unknown> = async (url) => {
    const script = iframe.contentDocument!.createElement('script');
    script.fetchPriority = 'high';
    script.defer = true;
    script.async = false;
    iframe.contentDocument!.head.appendChild(script);
    return new Promise(async (resolve, reject) => {
      script.onload = () => {
        const ret = iframeWindow?.module?.exports;
        // @ts-expect-error
        iframeWindow.module = { exports: undefined };
        resolve(ret);
      };
      script.onerror = (err) =>
        reject(new Error(`Failed to load script: ${url}`, { cause: err }));
      // @ts-expect-error
      iframeWindow.module = { exports: undefined };
      script.src = url;
    });
  };
  const loadScriptSync: (url: string) => unknown = (url) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false); // Synchronous request
    xhr.send(null);
    if (xhr.status === 200) {
      const script = iframe.contentDocument!.createElement('script');
      script.textContent = xhr.responseText;
      // @ts-expect-error
      iframeWindow.module = { exports: undefined };
      iframe.contentDocument!.head.appendChild(script);
      const ret = iframeWindow?.module?.exports;
      // @ts-expect-error
      iframeWindow.module = { exports: undefined };
      return ret;
    } else {
      throw new Error(`Failed to load script: ${url}`, { cause: xhr });
    }
  };
  return { globalWindow: iframeWindow, loadScript, loadScriptSync };
}
