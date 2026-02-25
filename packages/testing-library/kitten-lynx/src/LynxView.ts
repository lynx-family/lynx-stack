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
  ) {
    this.id = LynxView.incId++;
    idToLynxView[this.id.toString()] = new WeakRef(this);
  }

  async goto(url: string, _options?: unknown): Promise<void> {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    // Launch the URL through adb using the custom launcher intent
    await execAsync(
      `adb shell am start -n com.lynx.explorer/.LynxViewShellActivity -d "${url}"`,
    );

    // Wait for the page to attach to CDP
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { promise, resolve, reject } = Promise.withResolvers<number>();
    let isSettled = false;
    const listener = ({ message, id }: { message: string; id: number }) => {
      if (id !== this._clientId) return;
      const parsed = JSON.parse(message);
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
    }, 5000);

    const sessionId = await promise;
    await this.onAttachedToTarget(sessionId);
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
      // Enable DOM agent
      await this._channel.send('Runtime.enable' as any, {}); // Enable Runtime to get events
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
