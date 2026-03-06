import type { Connector } from '@lynx-js/devtool-connector';
import { CDPChannel } from './CDPChannel.js';
import type { NodeInfoInGetDocument } from './CDPChannel.js';
import { ElementNode } from './ElementNode.js';

const idToLynxView: Record<string, WeakRef<LynxView>> = {};

/**
 * Represents a Lynx page instance, similar to Puppeteer's `Page`.
 *
 * Provides methods for navigating to Lynx bundle URLs, querying the DOM,
 * and reading page content. Created via {@link Lynx.newPage}.
 */
export class LynxView {
  private static incId = 1;
  private _root?: ElementNode;
  _channel!: CDPChannel;
  readonly id: number;

  /**
   * Retrieve a previously created LynxView by its string ID.
   *
   * @param id - The string representation of the LynxView's numeric ID.
   * @returns The LynxView if still alive, or `undefined` if garbage-collected.
   */
  static getLynxViewById(id: string): LynxView | undefined {
    return idToLynxView[id]?.deref();
  }

  constructor(
    private _connector: Connector,
    private _clientId: string,
    private _client?: any,
  ) {
    this.id = LynxView.incId++;
    idToLynxView[this.id.toString()] = new WeakRef(this);
  }

  /**
   * Navigate to a Lynx bundle URL.
   *
   * Attaches to an existing CDP session, sends `Page.navigate`, then polls
   * for the session whose URL matches the target bundle. Re-attaches to
   * the matched session and refreshes the DOM tree.
   *
   * @param url - The Lynx bundle URL to navigate to.
   * @throws If no session can be attached or no session matches the URL.
   */
  async goto(url: string, _options?: unknown): Promise<void> {
    // Attach to any existing session first so we can send Page.navigate
    if (!this._channel) {
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          const sessions = await this._connector.sendListSessionMessage(
            this._clientId,
          );
          if (sessions.length > 0) {
            const sessionId = sessions[sessions.length - 1]!.session_id;
            await this.onAttachedToTarget(sessionId);
            break;
          }
        } catch {
          // Session listing or CDP enable failed — app may still be initializing
        }
        await new Promise(r => setTimeout(r, 500));
      }

      if (!this._channel) {
        throw new Error('Failed to attach to a session');
      }
    }

    // Navigate via CDP Page.navigate
    try {
      await this._channel.send('Page.navigate', { url });
    } catch {
      // ignore — not all Lynx versions support this
    }

    // Extract the bundle filename from the URL for matching
    const urlPath = url.split('/').pop() || url;

    // Poll for the session whose URL matches the navigated bundle
    let matchedSessionId: number | undefined;
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const sessions = await this._connector.sendListSessionMessage(
          this._clientId,
        );
        const matched = sessions.find(
          s => s.url === url || s.url === urlPath || url.endsWith(s.url),
        );
        if (matched) {
          matchedSessionId = matched.session_id;
          break;
        }
      } catch {
        // ignore and retry
      }
    }

    // Re-attach to the correct session if it differs from the current one
    if (matchedSessionId !== undefined) {
      this._channel = undefined as any;
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          await this.onAttachedToTarget(matchedSessionId);
          break;
        } catch {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    if (!this._channel) {
      throw new Error('Failed to attach to session for URL: ' + url);
    }

    // Refresh the DOM tree from the attached session
    const response = await this._channel.send('DOM.getDocument', {
      depth: -1,
    });
    const root = response.root.children[0]!;
    this._root = ElementNode.fromId(root.nodeId, this);
  }

  /**
   * Find the first element matching a CSS selector in the current page.
   *
   * @param selector - A CSS selector string (e.g. `'view'`, `'#my-id'`).
   * @returns The matched {@link ElementNode}, or `undefined` if not found.
   * @throws If no page has been loaded yet. Call {@link goto} first.
   */
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

  /**
   * Attach to a CDP session by session ID and enable required domains.
   *
   * Creates a {@link CDPChannel}, enables `Runtime`, `Page`, and `DOM` domains,
   * and fetches the initial document tree. Only sets `_channel` after all
   * operations succeed, making this method safely retryable.
   *
   * @param sessionId - The Lynx devtool session ID to attach to.
   * @internal
   */
  async onAttachedToTarget(sessionId: number) {
    if (!this._channel) {
      const channel = CDPChannel.from(
        sessionId,
        this._clientId,
        this._connector,
      );
      // Enable DOM and Page agents — may fail if devtool server isn't ready
      await Promise.all([
        channel.send('Runtime.enable' as any, {}),
        channel.send('Page.enable' as any, {}).catch(() => {}),
        channel.send('DOM.enable' as any, {}).catch(() => {}),
      ]);
      const response = await channel.send('DOM.getDocument', {
        depth: -1,
      });
      const root = response.root.children[0]!;
      this._root = ElementNode.fromId(root.nodeId, this);
      // Only set channel after everything succeeds
      this._channel = channel;
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

  /**
   * Serialize the current page's DOM tree to an HTML-like string.
   *
   * Fetches a fresh `DOM.getDocument` snapshot and recursively converts
   * all nodes to a string representation with tag names and attributes.
   *
   * @returns The serialized DOM content of the page.
   */
  async content(): Promise<string> {
    const document = await this._channel.send('DOM.getDocument', {
      depth: -1,
    });
    const buffer: string[] = [];
    this.#contentToStringImpl(buffer, document.root);
    return buffer.join('');
  }
}
