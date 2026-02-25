import type { LynxView } from './LynxView.js';

const idToElementNode = new WeakMap<LynxView, WeakRef<ElementNode>[]>();

export class ElementNode {
  static fromId(id: number, lynxView: LynxView): ElementNode {
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

  constructor(public readonly nodeId: number, private _lynxView: LynxView) {}

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

    // Wait briefly to simulate actual human tap duration
    await new Promise(resolve => setTimeout(resolve, 50));

    await this._lynxView._channel.send('Input.emulateTouchFromMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      timestamp: timestamp + 50,
    });
  }

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
