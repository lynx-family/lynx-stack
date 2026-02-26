import type { DebugRouterConnector } from '@lynx-js/debug-router-connector';
import { CDPChannel } from './CDPChannel.js';
import type { NodeInfoInGetDocument } from './CDPChannel.js';
import { ElementNode } from './ElementNode.js';

const idToLynxView: Record<string, WeakRef<LynxView>> = {};

export class LynxView {
  private static incId = 1;
  private _root?: ElementNode;
  _channel!: CDPChannel;
  readonly id: number;

  static getLynxViewById(id: string): LynxView | undefined {
    return idToLynxView[id]?.deref();
  }

  constructor(
    private _connector: DebugRouterConnector,
    private _clientId: number,
    private _client?: any,
  ) {
    this.id = LynxView.incId++;
    idToLynxView[this.id.toString()] = new WeakRef(this);
  }

  async goto(url: string, _options?: unknown): Promise<void> {
    if (!this._channel) {
      if (
        this._client && typeof this._client.sendClientMessage === 'function'
      ) {
        const { promise: newClientPromise, resolve: newClientResolve } = Promise
          .withResolvers<any>();
        const clientListener = (client: any) => newClientResolve(client);
        this._connector.on('client-connected', clientListener);

        this._client.sendClientMessage('App.openPage', { url });

        const newClientTimeout = setTimeout(() => {
          this._connector.off('client-connected', clientListener);
          newClientResolve(null);
        }, 10000);

        const newClient = await newClientPromise;
        clearTimeout(newClientTimeout);
        this._connector.off('client-connected', clientListener);

        if (newClient) {
          this._client = newClient;
          this._clientId = newClient.clientId();
        }
      }

      // Fetch initial session
      const { promise, resolve, reject } = Promise.withResolvers<number>();
      let isSettled = false;
      const listener = ({ message, id }: { message: string; id: number }) => {
        const parsed = JSON.parse(message);
        // Log all messages locally to find the session
        if (
          parsed.event === 'Customized' && parsed.data?.type === 'SessionList'
        ) {
          const sessions = parsed.data.data;
          if (sessions.length > 0) {
            isSettled = true;
            this._connector.off('usb-client-message', listener);
            resolve(sessions[sessions.length - 1].session_id);
          }
        }
      };
      this._connector.on('usb-client-message', listener);

      // Periodically ask for SessionList until settled or timeout
      const pollInterval = setInterval(() => {
        if (isSettled) {
          clearInterval(pollInterval);
          return;
        }
        this._connector.sendMessageToApp(
          this._clientId,
          JSON.stringify({
            event: 'Customized',
            data: {
              type: 'ListSession',
              data: [],
              sender: this._clientId,
            },
            from: this._clientId,
          }),
        );
      }, 500);

      setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          clearInterval(pollInterval);
          this._connector.off('usb-client-message', listener);
          reject(new Error('Timeout waiting for session'));
        }
      }, 15000);

      const sessionId = await promise;
      await this.onAttachedToTarget(sessionId);
    }

    const { promise: execPromise, resolve: execResolve } = Promise
      .withResolvers<void>();
    const off = this._channel.onEvent('DOM.childNodeInserted', () => {
      off();
      execResolve();
    });

    const fallbackTimeout = setTimeout(() => {
      off();
      execResolve();
    }, 5000);

    // Launch the URL via CDP Page.navigate message
    await this._channel.send('Page.navigate', { url });

    // Wait for the new page to establish its execution context instead of fixed timers
    await execPromise;
    clearTimeout(fallbackTimeout);

    // Refresh the DOM because navigation happened
    const response = await this._channel.send('DOM.getDocument', {
      depth: -1,
    });
    const root = response.root.children[0]!;
    this._root = ElementNode.fromId(root.nodeId, this);
  }

  async locator(selector: string): Promise<ElementNode | undefined> {
    if (!this._root) {
      throw new Error('Not connected to a document yet. Call goto() first.');
    }
    const { nodeId } = await this._channel.send('DOM.querySelector', {
      nodeId: this._root.nodeId,
      selector,
    });
    if (nodeId !== -1) {
      return ElementNode.fromId(nodeId, this);
    }
    return;
  }

  async onAttachedToTarget(sessionId: number) {
    if (!this._channel) {
      this._channel = CDPChannel.from(
        sessionId,
        this._clientId,
        this._connector,
      );
      // Enable DOM and Page agents
      await Promise.all([
        this._channel.send('Runtime.enable' as any, {}),
        this._channel.send('Page.enable' as any, {}).catch(() => {}),
        this._channel.send('DOM.enable' as any, {}).catch(() => {}),
      ]);
      const response = await this._channel.send('DOM.getDocument', {
        depth: -1,
      });
      const root = response.root.children[0]!;
      this._root = ElementNode.fromId(root.nodeId, this);
    }
  }

  #contentToStringImpl(buffer: string[], node: NodeInfoInGetDocument) {
    const tagName = node.nodeName.toLowerCase();
    buffer.push('<', tagName);
    for (let ii = 0; ii < node.attributes.length; ii += 2) {
      let key = node.attributes[ii]!.toLowerCase();
      const value = node.attributes[ii + 1]!;
      if (key === 'idselector') {
        key = 'id';
      }
      buffer.push(' ', key, '="', value, '"');
    }
    buffer.push('>');
    for (const child of node.children) {
      this.#contentToStringImpl(buffer, child);
    }
    buffer.push('</', tagName, '>');
  }

  async content(): Promise<string> {
    const document = await this._channel.send('DOM.getDocument', {
      depth: -1,
    });
    const buffer: string[] = [];
    this.#contentToStringImpl(buffer, document.root);
    return buffer.join('');
  }
}
