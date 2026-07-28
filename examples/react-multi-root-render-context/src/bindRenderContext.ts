import { root } from '@lynx-js/react';

// Binds a fresh render context to this page's own bridge objects, so several
// pages sharing one JS context keep their trees, state and patch streams
// isolated. No-op on runtimes built without `__MULTI_ROOT_RENDER_CONTEXT__`.
export function bindRenderContext(): void {
  if (__BACKGROUND__) {
    (root as {
      __experimentalBindRenderContext?: (
        options: { lynx: unknown; lynxCoreInject: unknown },
      ) => void;
    }).__experimentalBindRenderContext?.({ lynx, lynxCoreInject });
  }
}
