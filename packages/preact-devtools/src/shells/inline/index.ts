import { createStore } from '../../view/store';
export { createStore } from '../../view/store';
import { render, h } from 'preact';
import { DevTools } from '../../view/components/Devtools';
import { applyEvent } from '../../adapter/protocol/events';
import { PageHookName, DevtoolsToClient } from '../../constants';

export function setupFrontendStore(ctx: PreactDevtoolsLDTCtx) {
  const store = createStore();

  function handleClientEvents(e: MessageEvent) {
    if (
      e.data
      && (e.data.source === PageHookName || e.data.source === DevtoolsToClient)
    ) {
      const data = e.data;
      applyEvent(store, data.type, data.data);
    }
  }
  ctx.addEventListener('message', handleClientEvents);

  const unsubscribe = store.subscribe((name, data) => {
    ctx.postMessage(
      {
        type: name,
        data,
        source: DevtoolsToClient,
      },
      '*',
    );
  });

  return {
    store,
    destroy: () => {
      ctx.removeEventListener('message', handleClientEvents);
      unsubscribe();
    },
  };
}

export function setupInlineDevtools(
  container: HTMLElement,
  ctx: PreactDevtoolsLDTCtx,
) {
  const { store } = setupFrontendStore(ctx);
  render(h(DevTools, { store, ctx }), container);
  return store;
}
