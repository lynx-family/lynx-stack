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
      timestamp?: number;
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
  /**
   * Retrieves or instantiates a stateless `CDPChannel` for a specific Lynx session.
   *
   * **Design pattern (For Agents):**
   * This testing library uses a **stateless** CDP architecture to avoid hanging Websocket connections
   * over unstable ADB links. Channels are cached per `sessionId` via `WeakRef` to reduce allocations.
   *
   * @param sessionId - The numeric Lynx devtool session ID assigned by the Lynx runtime.
   * @param clientId - The unique device-port identifier for the client app (e.g., `"emulator-5554:40121"`).
   * @param connector - The active `Connector` instance powering the ADB transport.
   * @returns A `CDPChannel` reference bound to the requested session.
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
  /**
   * Constructs a new CDP Channel strictly bound to a single Lynx session.
   *
   * **Note for Agents:**
   * Favor using `CDPChannel.from()` over manually newing up a channel, as `from()` handles
   * WeakRef caching to minimize memory footprint.
   *
   * @param _connector - Low-level ADB transport controller.
   * @param _clientId - Bound devtool target identification string.
   * @param _sessionId - Narrowly scoped Lynx view session ID.
   */
  constructor(
    private _connector: Connector,
    private _clientId: string,
    private _sessionId: number,
  ) {}

  /**
   * Dispatches a strongly-typed Chrome DevTools Protocol (CDP) method command and awaits its return block.
   *
   * **Agent Usage:**
   * This is the beating heart of all interactions in `kitten-lynx`. Instead of maintaining a socket,
   * every `send(...)` call constructs a self-contained ADB request and awaits the isolated response.
   *
   * **Typings:**
   * Notice that the generics strictly bind to the `Protocol` interface defined at the top of this file.
   * If you need to invoke a CDP command that TypeScript rejects, you must update the `Protocol` interface first!
   *
   * @typeParam T - The literal string name of the CDP method (e.g., `'DOM.getDocument'`, `'Page.navigate'`).
   * @param method - The command to send to the Lynx devtool server.
   * @param params - A strongly-typed payload object required by the CDP method.
   * @returns A promise resolving to a strongly-typed response object matching the expected return structure of the `method`.
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
