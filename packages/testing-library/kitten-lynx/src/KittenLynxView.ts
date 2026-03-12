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
   * Retrieves a previously created `KittenLynxView` instance using its stringified numeric ID.
   *
   * **Why this is useful for Agents:**
   * This is primarily used for cross-referencing or finding an existing view without passing the object reference around.
   *
   * @param id - The string representation of the LynxView's numeric ID (e.g., `'1'`, `'2'`).
   * @returns The `KittenLynxView` instance if it is still alive in memory, or `undefined` if it has been garbage-collected.
   */
  static getKittenLynxViewById(id: string): KittenLynxView | undefined {
    return idToKittenLynxView[id]?.deref();
  }

  /**
   * Initializes a new `KittenLynxView` instance.
   *
   * **Note for Agents:**
   * You generally should avoid calling this constructor directly. Instead, use `Lynx.newPage()` to properly
   * initialize a `KittenLynxView` instance bound to the active ADB connection and client.
   *
   * @param _connector - The low-level `Connector` instance used to dispatch CDP messages over ADB/USB.
   * @param _clientId - The unique client identifier (typically `<deviceId>:<port>`).
   * @param _client - Optional client metadata object containing internal app states.
   */
  constructor(
    private _connector: Connector,
    private _clientId: string,
    private _client?: any,
  ) {
    this.id = KittenLynxView.incId++;
    idToKittenLynxView[this.id.toString()] = new WeakRef(this);
  }

  /**
   * Navigates the Lynx App to a specific Lynx bundle URL and attaches to the corresponding CDP session.
   *
   * **How it works (Crucial for Agents to understand):**
   * Unlike standard web browsers, calling `Page.navigate` in Lynx creates a **new** debugging session
   * instead of reusing the current one. This method abstracts away that complexity by:
   * 1. Waiting for the devtool server to boot.
   * 2. Sending an `App.openPage` (or a fallback message) to trigger the navigation.
   * 3. **Polling the session list** over ADB to find a new session whose URL matches the target bundle URL.
   * 4. Automatically re-attaching to the matched session and fetching the initial DOM tree (`DOM.getDocument`).
   *
   * @param url - The absolute URL of the Lynx bundle to navigate to (e.g., `'http://localhost:8080/dist/main.lynx.bundle'`).
   * @param _options - Currently unused. Reserved for future navigation options.
   * @throws An error if it times out waiting for the devtool server to boot (60s limit).
   * @throws An error if the specific session for the URL cannot be found (30s limit) or cannot be attached.
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
          if (Array.isArray(sessions)) {
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
   * Locates the first DOM element matching the provided CSS selector in the current page.
   *
   * **Agent Usage:**
   * This operates identically to `document.querySelector` or Playwright's `page.locator()`.
   * It relies on the `DOM` CDP domain. Always ensure that `goto()` has completed successfully before calling this,
   * otherwise the DOM tree will not exist.
   *
   * @param selector - A valid CSS selector string targeting the desired element (e.g., `'view'`, `'#submit-btn'`, `'.container > text'`).
   * @returns A promise resolving to an `ElementNode` containing methods to interact with the element, or `undefined` if no node matched.
   * @throws Error if the method is called before a page is loaded via `goto()`.
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
   * Attaches the LynxView to a specific Lynx devtool session and initializes the CDP channel.
   *
   * **Internal Mechanics:**
   * This method creates a `CDPChannel` for the specific `sessionId` and immediately fires
   * a `DOM.getDocument` request to cache the root document node. This must succeed for the page to be interactable.
   *
   * **Note for Agents:**
   * This is generally marked as internal, but it is not `private`. You normally do not need to call this manually,
   * as `goto()` handles session attachment automatically.
   *
   * @param sessionId - The numeric Lynx devtool session ID to attach to, discovered via `sendListSessionMessage`.
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
   * Serializes the current page's entire DOM tree into an HTML-like string format.
   *
   * **Agent Usage:**
   * This is highly useful for debugging and logging the current state of the Lynx App DOM.
   * It forces a fresh `DOM.getDocument` snapshot from the CDP server and recursively walks the tree
   * to build a string containing tags and attributes (e.g., `<view id="main"><text>...</text></view>`).
   *
   * @returns A promise resolving to a string representing the serialized DOM content of the page.
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
