import { BackgroundSnapshotInstance } from '@lynx-js/react/runtime/lib/backgroundSnapshot';
import type { UnsafeLynx } from '@lynx-js/types';

interface FiberElement {}

declare global {
  declare module '*.css' {
    const styles: Record<string, string>;
    export default styles;
  }

  declare const __DEBUG__: boolean;
  /**
   * The global context of preact-devtools will be injected to ReactLynx App
   */
  interface PreactDevtoolsCtx {
    __DEBUG__?: boolean;
    lynx?: UnsafeLynx;
    __page?: FiberElement;
    __root?: BackgroundSnapshotInstance & {
      __jsx?: React.ReactNode;
    };
    lynxCoreInject?: {
      tt: any;
    };
    addEventListener: (
      type: string,
      listener: (e: { source: any; data: any }) => void,
    ) => void;
    postMessage: (message: any, targetOrigin: string) => void;
    localStorage: Storage;
    performance: Performance;
    Node: typeof BackgroundSnapshotInstance;
    document: {
      body: BackgroundSnapshotInstance;
    };
    Blob: typeof Blob;
  }
  var preactDevtoolsCtx: PreactDevtoolsCtx;

  /**
   * The global context of preact-devtools will be injected to LynxDevtool
   */
  interface PreactDevtoolsLDTCtx {
    devtoolsProps: {
      addEventListener: (type: string, cb: (msg: string) => void) => void;
      postMessage: (type: string, msg: string | Record<string, any>) => void;
      isOSSLynxDevtool: boolean;
      addOnScreenCastPanelUINodeIdSelectedListener: (
        cb: (UINodeId: number) => void,
      ) => void;
      onPreactDevtoolsPanelUINodeIdSelected: (UINodeId: number) => void;
    };
    addEventListener: (
      type: string,
      listener: (e: MessageEvent) => void,
    ) => void;
    removeEventListener: (
      type: string,
      listener: (e: MessageEvent) => void,
    ) => void;
    postMessage: (message: any, targetOrigin: string) => void;
    highlightUniqueId?: number;
  }
  var preactDevtoolsLDTCtx: PreactDevtoolsLDTCtx;
}
