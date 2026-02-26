import type { DebugRouterConnector } from '@lynx-js/debug-router-connector';

const sessionIdToChannel: Record<string, WeakRef<CDPChannel>> = {};
type Quad = [number, number, number, number, number, number, number, number];
export interface NodeInfoInGetDocument {
  nodeId: number;
  children: NodeInfoInGetDocument[];
  attributes: string[];
  nodeName: string;
}
interface Protocol {
  'DOM.getDocument': {
    params: {
      depth: number;
      pierce?: boolean;
    };
    return: {
      root: NodeInfoInGetDocument;
    };
  };
  'DOM.querySelector': {
    params: {
      nodeId: number;
      selector: string;
    };
    return: {
      nodeId: number;
    };
  };
  'DOM.getAttributes': {
    params: {
      nodeId: number;
    };
    return: {
      attributes: string[];
    };
  };
  'DOM.getBoxModel': {
    params: {
      nodeId: number;
    };
    return: {
      model: {
        content: Quad;
        padding: Quad;
        border: Quad;
        margin: Quad;
        width: number;
        height: number;
      };
    };
  };
  'CSS.getComputedStyleForNode': {
    params: {
      nodeId: number;
    };
    return: {
      computedStyle: { name: string; value: string }[];
    };
  };
  'Page.navigate': {
    params: {
      url: string;
    };
    return: unknown;
  };
  'Input.emulateTouchFromMouseEvent': {
    params: {
      type: 'mousePressed' | 'mouseReleased' | 'mouseMoved';
      x: number;
      y: number;
      timestamp: number;
      button: 'left' | 'middle' | 'right';
      deltaX?: number;
      deltaY?: number;
    };
    return: unknown;
  };
}

export class CDPChannel {
  private _id = 0;
  static from(
    sessionId: number,
    clientId: number,
    connector: DebugRouterConnector,
  ): CDPChannel {
    const maybeChannel = sessionIdToChannel[sessionId]?.deref();
    if (maybeChannel) return maybeChannel;
    else {
      const channel = new CDPChannel(connector, clientId, sessionId);
      sessionIdToChannel[sessionId] = new WeakRef(channel);
      return channel;
    }
  }
  constructor(
    private _connector: DebugRouterConnector,
    private _clientId: number,
    private _sessionId: number,
  ) {}

  async send<T extends keyof Protocol>(
    method: T,
    params: Protocol[T]['params'],
  ): Promise<Protocol[T]['return']> {
    const id = ++this._id;

    const { promise, resolve, reject } = Promise.withResolvers<
      Protocol[T]['return']
    >();

    const msgId = `CDP-${id}`;
    const listener = (
      { message, id: sourceId }: { message: string; id: number },
    ) => {
      const parsed = JSON.parse(message);
      if (parsed.event !== 'Customized' || parsed.data?.type !== 'CDP') {
        return;
      }

      const cdpData = parsed.data.data;
      if (cdpData.session_id !== this._sessionId) return;

      const cdpMessage = typeof cdpData.message === 'string'
        ? JSON.parse(cdpData.message)
        : cdpData.message;
      if (cdpMessage.id !== id) return;

      this._connector.off('usb-client-message', listener);

      if (cdpMessage.error) {
        reject(new Error(cdpMessage.error.message));
      } else {
        resolve(cdpMessage.result);
      }
    };

    this._connector.on('usb-client-message', listener);

    this._connector.sendMessageToApp(
      this._clientId,
      JSON.stringify({
        event: 'Customized',
        data: {
          type: 'CDP',
          data: {
            client_id: this._clientId,
            session_id: this._sessionId,
            message: {
              method,
              id,
              params,
            },
          },
          sender: this._clientId,
        },
        from: this._clientId,
      }),
    );

    // Add simple timeout
    setTimeout(() => {
      this._connector.off('usb-client-message', listener);
      reject(new Error(`Timeout waiting for CDP method: ${method}`));
    }, 5000);

    return promise;
  }

  onEvent(method: string, listener: (params: any) => void): () => void {
    const handler = (
      { message, id: sourceId }: { message: string; id: number },
    ) => {
      const parsed = JSON.parse(message);
      if (parsed.event !== 'Customized' || parsed.data?.type !== 'CDP') {
        return;
      }

      const cdpData = parsed.data.data;
      if (cdpData.session_id !== this._sessionId) return;

      const cdpMessage = typeof cdpData.message === 'string'
        ? JSON.parse(cdpData.message)
        : cdpData.message;

      if (cdpMessage.method === method) {
        listener(cdpMessage.params);
      }
    };

    this._connector.on('usb-client-message', handler);
    return () => this._connector.off('usb-client-message', handler);
  }
}
