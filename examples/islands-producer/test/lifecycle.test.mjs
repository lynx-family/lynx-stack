import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Repository tests run on Node 22+.
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const xml = readFileSync(
  new URL('../xml/greeting.lynxml', import.meta.url),
  'utf8',
);
const source = xml.match(/<script thread="main">([\s\S]*?)<\/script>/)[1];

test('remote greeting instances update and dispose only their own native children', () => {
  let id = 0;
  const node = text => ({ id: ++id, text, children: [] });
  const page = node();
  const firstContainer = node();
  const secondContainer = node();
  const listeners = new Set();
  const commands = [];
  let removals = 0;
  const context = {
    module: { exports: {} },
    lynx: {
      getJSContext: () => ({
        addEventListener: (_name, callback) => listeners.add(callback),
        removeEventListener: (_name, callback) => listeners.delete(callback),
        dispatchEvent: event => commands.push(event.data),
      }),
    },
    __GetPageElement: () => page,
    __QuerySelector: (_page, selector) =>
      selector === '#first' ? firstContainer : secondContainer,
    __GetElementUniqueID: element => element.id,
    __CreateView: () => node(),
    __CreateText: () => node(),
    __CreateRawText: text => node(text),
    __SetClasses: (element, className) => element.className = className,
    __SetAttribute: (element, name, value) => element[name] = value,
    __AppendElement: (parent, child) => parent.children.push(child),
    __RemoveElement(parent, child) {
      assert.equal(arguments.length, 2);
      assert.ok(parent.children.includes(child));
      parent.children.splice(parent.children.indexOf(child), 1);
      removals++;
    },
    __FlushElementTree: () => undefined,
  };
  runInNewContext(source, context);
  const first = context.module.exports.create();
  const second = context.module.exports.create();
  first.render('#first', { title: 'First' });
  second.render('#second', { title: 'Second' });
  first.setBackgroundReady();
  second.setBackgroundReady();
  first.update({ title: 'Updated' });
  const current = commands[commands.length - 1];
  for (const callback of listeners) {
    callback({
      data: { ...current, message: 'Updated result' },
    });
  }
  const firstCard = firstContainer.children[0];
  const secondCard = secondContainer.children[0];
  assert.equal(firstCard.children[0].children[0].text, 'Updated');
  assert.equal(firstCard.children[1].children[0].text, 'Updated result');
  assert.equal(secondCard.children[0].children[0].text, 'Second');
  first.dispose();
  first.dispose();
  assert.equal(firstContainer.children.length, 0);
  assert.equal(secondContainer.children[0], secondCard);
  assert.equal(listeners.size, 1);
  second.dispose();
  assert.equal(listeners.size, 0);
  assert.equal(removals, 2);
});
