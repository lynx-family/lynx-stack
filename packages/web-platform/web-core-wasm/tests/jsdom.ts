import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { vi } from 'vitest';

const { window } = new JSDOM(undefined, { url: 'http://localhost/' });
const document = window.document;

// Mock fetch for WASM loading
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = input.toString();
  if (urlStr.endsWith('.wasm')) {
    try {
      let filePath: string;
      if (urlStr.startsWith('file://')) {
        filePath = fileURLToPath(urlStr);
      } else {
        filePath = urlStr;
      }
      const buffer = fs.readFileSync(filePath);
      return new Response(buffer, {
        headers: { 'Content-Type': 'application/wasm' },
      });
    } catch (e) {
      console.error(`Failed to load WASM: ${urlStr}`, e);
      throw e;
    }
  }
  throw new Error(`Fetch not implemented for ${urlStr}`);
};

// --- Worker Mocking Infrastructure ---
const { port1: mainThreadPort, port2: workerThreadPort } = new MessageChannel();

// Mock the environment for the worker script
// 1. Intercept 'self.onmessage' assignment
Object.defineProperty(globalThis, 'onmessage', {
  set: (handler) => {
    // When the worker script sets onmessage, bind it to workerThreadPort
    workerThreadPort.onmessage = (event) => {
      // The worker handler expects a MessageEvent with 'data'
      handler({ data: event.data } as MessageEvent);
    };
    workerThreadPort.start();
  },
  configurable: true,
});

// 2. Mock global 'postMessage' used by the worker script
globalThis.postMessage = (message: any) => {
  // Worker sends message back to main thread (via workerThreadPort -> mainThreadPort)
  workerThreadPort.postMessage(message);
};

// 3. Mock 'self' to be globalThis (if not already)
if (!globalThis.self) {
  // @ts-ignore
  globalThis.self = globalThis;
} // Mock the Worker class available to the main thread
class MockWorker {
  private _onmessage: ((event: MessageEvent) => void) | null = null;
  private _queue: MessageEvent[] = [];

  get onmessage() {
    return this._onmessage;
  }

  set onmessage(handler: ((event: MessageEvent) => void) | null) {
    this._onmessage = handler;
    if (handler && this._queue.length > 0) {
      this._queue.forEach((event) =>
        handler({ data: event.data } as MessageEvent)
      );
      this._queue = [];
    }
  }

  constructor() {
    // Listen for messages from the worker (via mainThreadPort)
    mainThreadPort.onmessage = (event) => {
      if (this._onmessage) {
        this._onmessage({ data: event.data } as MessageEvent);
      } else {
        this._queue.push(event);
      }
    };
    mainThreadPort.start();
  }

  postMessage(message: any, transfer: Transferable[]) {
    // Send message to the worker (via mainThreadPort -> workerThreadPort)
    mainThreadPort.postMessage(message, transfer);
  }

  terminate() {
    mainThreadPort.close();
  }
}
Object.assign(globalThis, {
  document,
  window,
  Window: window.Window,
  CustomEvent: window.CustomEvent,
  HTMLElement: window.HTMLElement,
  customElements: window.customElements,
  requestAnimationFrame: (cb: any) => setTimeout(cb, 0),
  Worker: MockWorker,
  location: window.location,
  CSS: vi.mockObject({
    supports: vi.fn().mockReturnValue(true),
  }),
});
