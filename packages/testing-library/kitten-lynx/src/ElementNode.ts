import type { KittenLynxView } from './KittenLynxView.js';

const idToElementNode = new WeakMap<KittenLynxView, WeakRef<ElementNode>[]>();

/**
 * Represents a DOM element in a Lynx page.
 *
 * Wraps a CDP `nodeId` and provides methods for inspecting attributes,
 * computed styles, and simulating user interactions like taps.
 */
export class ElementNode {
  /**
   * Retrieves or creates an `ElementNode` instance corresponding to a specific Lynx DOM node ID.
   *
   * **Agent Caching Strategy:**
   * Nodes are aggressively cached per `KittenLynxView` instance using `WeakRef`.
   * This means if an Agent queries the same DOM node twice before garbage collection,
   * it returns the same `ElementNode` reference, reducing memory overhead during extensive DOM crawling.
   *
   * @param id - The numeric CDP node ID to wrap.
   * @param lynxView - The `KittenLynxView` instance this node belongs to.
   * @returns An `ElementNode` bound to the provided node ID and view.
   */
  static fromId(id: number, lynxView: KittenLynxView): ElementNode {
    const currentViewMap = idToElementNode.get(lynxView);
    if (currentViewMap) {
      const couldBeElementNode = currentViewMap[id]?.deref();
      if (couldBeElementNode) return couldBeElementNode;
    }

    const node = new ElementNode(id, lynxView);
    const ref = new WeakRef(node);

    if (currentViewMap) {
      currentViewMap[id] = ref;
    } else {
      const newMap: WeakRef<ElementNode>[] = [];
      newMap[id] = ref;
      idToElementNode.set(lynxView, newMap);
    }
    return node;
  }

  /**
   * Initializes a new `ElementNode` instance to represent a Lynx Component or Tag.
   *
   * **Note for Agents:**
   * Similar to `KittenLynxView`, you should rarely call this directly.
   * Rely on `KittenLynxView.locator()` or `ElementNode.fromId()` for instantiations.
   *
   * @param nodeId - The unique CDP numeric ID denoting this element in the Lynx renderer.
   * @param _lynxView - The parent `KittenLynxView` instance used to dispatch subsequent CDP queries.
   */
  constructor(
    public readonly nodeId: number,
    private _lynxView: KittenLynxView,
  ) {}

  /**
   * Simulates a native user tap (touch press followed by touch release) directly on the center of this element.
   *
   * **Internal Mechanics (For Agents):**
   * This is not a simulated DOM event (like `element.click()` in Web). It is a highly accurate native-layer
   * gesture dispatch:
   * 1. Fetches the exact boundary coordinates via `DOM.getBoxModel`.
   * 2. Calculates the absolute center `(x, y)` of the content box.
   * 3. Dispatches an `Input.emulateTouchFromMouseEvent` (`'mousePressed'`) over the ADB bridge.
   * 4. Waits 50ms, then dispatches the corresponding `'mouseReleased'`.
   *
   * **Crucial:** Ensure the element is visible on the screen before calling this, or the coordinate calculation might fail or hit nothing.
   *
   * @throws Error if the layout box model cannot be computed natively.
   */
  async tap(): Promise<void> {
    const { model } = await this._lynxView._channel.send('DOM.getBoxModel', {
      nodeId: this.nodeId,
    });

    // Calculate center coordinates
    let x = 0, y = 0;
    // Content box is usually defined by 8 coordinates [x1,y1, x2,y2, x3,y3, x4,y4]
    // Top-left and bottom-right average gives center
    if (model.content && model.content.length === 8) {
      x = (model.content[0]! + model.content[4]!) / 2;
      y = (model.content[1]! + model.content[5]!) / 2;
    } else {
      throw new Error(
        `Could not determine coordinates for node ${this.nodeId}`,
      );
    }

    const timestamp = Date.now();
    await this._lynxView._channel.send('Input.emulateTouchFromMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      timestamp,
    });

    await this._lynxView._channel.send('Input.emulateTouchFromMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      timestamp: timestamp + 50,
    });
  }

  /**
   * Retrieves the string value of a specified attribute on this element.
   *
   * **Agent Quirk / Gotcha:**
   * In Lynx, standard web `id="foo"` attributes are actually stored as `idSelector="foo"` internally.
   * This library provides a seamless shim: if you query `getAttribute('id')`, it automatically
   * queries `idSelector` instead. No manual handling of `idSelector` is required on your part.
   *
   * @param name - The name of the attribute to fetch.
   * @returns A promise resolving to the string value of the attribute, or `null` if the attribute does not exist.
   */
  async getAttribute(name: string): Promise<string | null> {
    if (name === 'id') {
      name = 'idSelector';
    }
    const ret = await this._lynxView._channel.send('DOM.getAttributes', {
      nodeId: this.nodeId,
    });
    const attributes: Record<string, string> = {};
    for (let ii = 0; ii < ret.attributes.length - 1; ii += 2) {
      const attrName = ret.attributes[ii]!;
      const value = ret.attributes[ii + 1]!;
      attributes[attrName] = value;
    }
    return attributes[name] ?? null;
  }

  /**
   * Fetches all actively computed CSS properties for this specific element.
   *
   * **Agent Usage:**
   * This relies on `CSS.getComputedStyleForNode`. It returns the fully resolved style values
   * post-layout calculation (e.g., resolving `100%` into absolute `px` values).
   * It is highly recommended to use this for visual assertions (e.g., verifying a box is indeed `display: none`
   * or has a specific `background-color`).
   *
   * @returns A promise resolving to a native JS `Map`, where keys are CSS property names and values are their computed string expressions.
   */
  async computedStyleMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const ret = await this._lynxView._channel.send(
      'CSS.getComputedStyleForNode',
      {
        nodeId: this.nodeId,
      },
    );
    for (const style of ret.computedStyle) {
      map.set(style.name, style.value);
    }
    return map;
  }
}
