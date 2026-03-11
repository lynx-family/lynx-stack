import type { Connector } from '@lynx-js/devtool-connector';
import { CDPChannel } from './CDPChannel.js';
import type { NodeInfoInGetDocument } from './CDPChannel.js';
import { ElementNode } from './ElementNode.js';
import { setTimeout } from 'node:timers/promises';

const idToKittenLynxView: Record<string, WeakRef<KittenLynxView>> = {};

/**
 * Represents a Lynx page instance, similar to Puppeteer's `Page`.
 *
 * Provides methods for navigating to Lynx bundle URLs, querying the DOM,
 * and reading page content. Created via {@link Lynx.newPage}.
 */
export class KittenLynxView {
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
  static getKittenLynxViewById(id: string): KittenLynxView | undefined {
    return idToKittenLynxView[id]?.deref();
  }

  constructor(
    private _connector: Connector,
    private _clientId: string,
    private _client?: any,
  ) {
    this.id = KittenLynxView.incId++;
    idToKittenLynxView[this.id.toString()] = new WeakRef(this);
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
    const urlPath = url.split('/').pop() || url;

    // Wait until the Lynx app has booted and registered its devtool server.
    // We confirm this by waiting until at least one session is reported.
    if (!this._channel) {
      console.log(`[goto] Waiting for devtool to boot...`);
      const startTime = Date.now();
      let ready = false;
      let bootLoops = 0;
      while (Date.now() - startTime < 60000) {
        bootLoops++;
        try {
          const sessions = await this._connector.sendListSessionMessage(
            this._clientId,
          );
          if (bootLoops % 10 === 0) {
            console.log(
              `[goto] list sessions returned ${sessions.length} sessions (loop ${bootLoops})`,
            );
          }
          if (sessions.length > 0) {
            console.log(
              `[goto] Devtool booted in ${Date.now() - startTime}ms. Sessions:`,
              JSON.stringify(sessions),
            );
            ready = true;
            break;
          }
        } catch (error: any) {
          if (bootLoops % 10 === 0) {
            console.error(
              `[goto] list sessions error (loop ${bootLoops}):`,
              error.message || error,
            );
          }
        }
        await setTimeout(500);
      }
      if (!ready) {
        throw new Error(
          'Timeout waiting for Lynx App devtool to boot completely before navigation',
        );
      }
    }

    console.log(`[goto] Sending App.openPage to URL: ${url}`);
    try {
      const msg = await this._connector.sendAppMessage(
        this._clientId,
        'App.openPage',
        {
          url,
        },
      );
      console.log(`[goto] App.openPage succeeded:`, msg);
    } catch (e: any) {
      console.log(
        `[goto] App.openPage failed, falling back to Customized OpenCard. Error:`,
        e.message,
      );
      try {
        const msg = await this._connector.sendMessage(this._clientId, {
          event: 'Customized',
          data: {
            type: 'OpenCard',
            data: {
              type: 'url',
              url,
            },
            sender: -1,
          },
          from: -1,
        });
        console.log(`[goto] Customized OpenCard succeeded:`, msg);
      } catch (fallbackErr: any) {
        console.error(
          `[goto] Customized OpenCard failed:`,
          fallbackErr.message,
        );
      }
    }

    // Poll for the session whose URL matches the navigated bundle
    console.log(`[goto] Polling for session matching URL: ${url}`);
    let matchedSessionId: number | undefined;
    const navStartTime = Date.now();
    let pollLoops = 0;
    while (Date.now() - navStartTime < 30000) {
      pollLoops++;
      await setTimeout(500);
      try {
        const sessions = await this._connector.sendListSessionMessage(
          this._clientId,
        );

        if (pollLoops % 10 === 0) {
          console.log(
            `[goto] (Loop ${pollLoops}) Available sessions:`,
            JSON.stringify(sessions.map(s => s.url)),
          );
        }

        const matched = sessions.find(
          s =>
            s.url === url || s.url === urlPath || url.endsWith(s.url)
            || s.url.endsWith(urlPath),
        );
        if (matched) {
          console.log(
            `[goto] Found matched session after ${
              Date.now() - navStartTime
            }ms: id=${matched.session_id}, url=${matched.url}`,
          );
          matchedSessionId = matched.session_id;
          break;
        }
      } catch (error: any) {
        if (pollLoops % 10 === 0) {
          console.error(
            `[goto] list sessions error in polling (loop ${pollLoops}):`,
            error.message || error,
          );
        }
      }
    }

    if (matchedSessionId === undefined) {
      console.error(
        `[goto] Failed to find session for URL after 30000ms: ${url}`,
      );
    } else {
      console.log('matchedSessionId', matchedSessionId);
    }
    if (matchedSessionId === undefined) {
      throw new Error('cannot find session for URL: ' + url);
    }
    await this.onAttachedToTarget(matchedSessionId);

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

      const response = await channel.send('DOM.getDocument', {
        depth: -1,
      });
      const root = response.root.children[0]!;
      this._root = ElementNode.fromId(root.nodeId, this);
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
