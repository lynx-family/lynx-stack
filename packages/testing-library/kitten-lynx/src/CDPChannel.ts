import type { Connector } from '@lynx-js/devtool-connector';

const sessionIdToChannel: Record<string, WeakRef<CDPChannel>> = {};
type Quad = [number, number, number, number, number, number, number, number];
/**
 * Represents a node in the DOM tree returned by `DOM.getDocument`.
 */
export interface NodeInfoInGetDocument {
  /** Unique DOM node identifier. */
  nodeId: number;
  /** Child nodes of this node. */
  children: NodeInfoInGetDocument[];
  /** Flat array of alternating attribute name/value pairs. */
  attributes: string[];
  /** The node's tag name (e.g. `'view'`, `'text'`). */
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

/**
 * A stateless CDP (Chrome DevTools Protocol) channel for sending commands
 * to a specific Lynx session.
 *
 * Each `send()` call is a short-lived request/response via the `Connector`.
 * Channels are cached per session ID using `WeakRef` to allow reuse.
 */
export class CDPChannel {
  private _id = 0;
  /**
   * Get or create a CDPChannel for the given session.
   *
   * Channels are cached per `sessionId` using `WeakRef`. If a previously
   * created channel for the same session is still alive, it is reused.
   *
   * @param sessionId - The Lynx devtool session ID.
   * @param clientId - The client identifier (format: `"deviceId:port"`).
   * @param connector - The `Connector` instance for sending messages.
   * @returns A `CDPChannel` bound to the specified session.
   */
  static from(
    sessionId: number,
    clientId: string,
    connector: Connector,
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
    private _connector: Connector,
    private _clientId: string,
    private _sessionId: number,
  ) {}

  /**
   * Send a CDP command and return the result.
   *
   * @param method - The CDP method name (e.g. `'DOM.getDocument'`, `'Page.navigate'`).
   * @param params - The parameters for the CDP method.
   * @returns The CDP response for the given method.
   */
  async send<T extends keyof Protocol>(
    method: T,
    params: Protocol[T]['params'],
  ): Promise<Protocol[T]['return']> {
    return await this._connector.sendCDPMessage<Protocol[T]['return']>(
      this._clientId,
      this._sessionId,
      method,
      params as any,
    );
  }
}
