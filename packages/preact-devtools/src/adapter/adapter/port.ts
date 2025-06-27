import { DevtoolEvents } from '../hook';
import { DevtoolsToClient, PageHookName } from '../../constants';

export interface BaseEvent<K extends string, T> {
  type: K;
  data: T;
}

export function listenToDevtools<
  K extends keyof DevtoolEvents,
  T extends DevtoolEvents[K],
>(ctx: PreactDevtoolsCtx, type: K, callback: (message: T) => void) {
  ctx.addEventListener('message', e => {
    if (e.source === ctx && e.data.source === DevtoolsToClient) {
      const data = e.data;
      if (data.type === type) callback(data.data);
    }
  });
}

export function listenToPageHook<
  K extends keyof DevtoolEvents,
  T extends DevtoolEvents[K],
>(ctx: PreactDevtoolsCtx, type: K, callback: (message: T) => void) {
  ctx.addEventListener('message', e => {
    if (e.source === ctx && e.data.source === PageHookName) {
      const data = e.data;
      if (data.type === type) callback(data.data);
    }
  });
}

export function sendToDevtools<K extends keyof DevtoolEvents>(
  ctx: PreactDevtoolsCtx,
  type: K,
  data: DevtoolEvents[K],
) {
  ctx.postMessage(
    {
      source: PageHookName,
      type,
      data,
    },
    '*',
  );
}

/**
 * A port listens to messages from the devtools and can
 * send messages from the client to the devtools
 */
export interface PortPageHook {
  send: <K extends keyof DevtoolEvents, T extends DevtoolEvents[K]>(
    type: K,
    message: T,
  ) => void;
  listen: <K extends keyof DevtoolEvents, T extends DevtoolEvents[K]>(
    type: K,
    callback: (data: T) => void,
  ) => void;
  listenToPage: <K extends keyof DevtoolEvents, T extends DevtoolEvents[K]>(
    type: K,
    callback: (data: T) => void,
  ) => void;
}

export function createPortForHook(ctx: PreactDevtoolsCtx): PortPageHook {
  return {
    send: (type, message) => sendToDevtools(ctx, type, message),
    listen: (type, callback) => listenToDevtools(ctx, type, callback),
    listenToPage: (type, callback) => listenToPageHook(ctx, type, callback),
  };
}
