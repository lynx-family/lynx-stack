import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Repository tests run on Node 22+.
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const document = readFileSync(
  new URL('../xml/card.lynxml', import.meta.url),
  'utf8',
);
const source = document.match(/<script thread="main">([\s\S]*?)<\/script>/)[1];
const backgroundSource =
  document.match(/<script thread="background">([\s\S]*?)<\/script>/)[1];

function endpoint(own, send) {
  return {
    addEventListener: (name, fn) => own.set(name, fn),
    removeEventListener: (name, fn) => {
      if (own.get(name) === fn) own.delete(name);
    },
    dispatchEvent: send,
  };
}

function createHost({ deferBackground = false, standalone = false } = {}) {
  let id = 0;
  const node = (tag, text) => ({ id: ++id, tag, text, children: [] });
  const page = node('page');
  const container = node('view');
  container.selector = '#xml-content';
  const other = node('view');
  other.selector = '#other';
  page.children.push(container, other);
  const listeners = new Map();
  const query = (root, selector) => {
    for (const child of root.children) {
      if (child.selector === selector || `.${child.className}` === selector) {
        return child;
      }
      const found = query(child, selector);
      if (found) return found;
    }
    return null;
  };
  const mainListeners = new Map();
  const backgroundListeners = new Map();
  const timers = new Map();
  const replies = [];
  const commands = [];
  let timerId = 0;
  const background = endpoint(
    mainListeners,
    event => {
      if (event.type === 'XmlCard:command') commands.push(event.data);
      backgroundListeners.get(event.type)?.(event);
    },
  );
  const mainThread = endpoint(
    backgroundListeners,
    event => replies.push(event),
  );
  const startBackground = () =>
    runInNewContext(backgroundSource, {
      lynx: { getCoreContext: () => mainThread },
      setTimeout: fn => {
        const id = ++timerId;
        timers.set(id, fn);
        return id;
      },
      clearTimeout: id => timers.delete(id),
    });
  if (!deferBackground) startBackground();
  const context = {
    module: { exports: {} },
    __lynxParcel: standalone ? undefined : true,
    lynx: {
      getJSContext: () => background,
      getEngine: () => ({
        addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: (name, fn) => {
          if (listeners.get(name) === fn) listeners.delete(name);
        },
      }),
    },
    __GetPageElement: () => page,
    __GetElementUniqueID: element => element.id,
    __QuerySelector: query,
    __CreateView: () => node('view'),
    __CreateText: () => node('text'),
    __CreateRawText: text => node('raw-text', text),
    __SetClasses: (element, value) => {
      element.className = value;
    },
    __SetAttribute: (element, name, value) => {
      element[name] = value;
    },
    __AppendElement: (parent, child) => {
      parent.children.push(child);
    },
    __RemoveElement: (parent, child) => {
      const index = parent.children.indexOf(child);
      assert.notEqual(index, -1);
      parent.children.splice(index, 1);
    },
    __FlushElementTree() {/* Rendering is checked separately on a device. */},
  };
  runInNewContext(source, context);
  assert.equal(listeners.has('__RenderPage'), standalone);
  if (!deferBackground && !standalone) {
    context.module.exports.setBackgroundReady();
  }
  return {
    xml: context.module.exports,
    container,
    listeners,
    timers,
    mainListeners,
    commands,
    startBackground,
    runTasks() {
      const work = [...timers.values()];
      timers.clear();
      for (const task of work) task();
    },
    deliverResults() {
      for (const reply of replies.splice(0)) {
        mainListeners.get(reply.type)?.(reply);
      }
    },
  };
}

const initial = { title: 'Initial', description: 'First snapshot' };
const next = { title: 'Updated', description: 'Second snapshot' };

test('mount and update retain node identity; repeated mount updates without duplicating', () => {
  const { xml, container, listeners } = createHost();
  assert.equal(listeners.has('__RenderPage'), false);
  xml.mount('#xml-content', initial);
  const card = container.children[0];
  const title = card.children[1].children[0];
  xml.update(next);
  assert.equal(container.children[0], card);
  assert.equal(card.children[1].children[0], title);
  assert.equal(title.text, next.title);
  xml.mount('#xml-content', initial);
  assert.equal(container.children.length, 1);
  assert.equal(title.text, initial.title);
});

test('invalid transitions and data leave the mounted card intact', () => {
  const { xml, container } = createHost();
  assert.throws(() => xml.update(next), /Mount/);
  assert.throws(() => xml.mount('#missing', initial), /not found/);
  xml.mount('#xml-content', initial);
  const card = container.children[0];
  assert.throws(() => xml.mount('#other', initial), /Unmount/);
  assert.throws(() => xml.update({ title: 'Incomplete' }), /requires string/);
  assert.equal(container.children[0], card);
  assert.equal(card.children[1].children[0].text, initial.title);
});

test('unmount is idempotent, releases its listener, and supports remount and page teardown', () => {
  const { xml, container, listeners } = createHost();
  xml.unmount();
  xml.mount('#xml-content', initial);
  assert.equal(listeners.size, 1);
  xml.unmount();
  xml.unmount();
  assert.equal(container.children.length, 0);
  assert.equal(listeners.size, 0);
  assert.throws(() => xml.update(next), /Mount/);
  xml.mount('#xml-content', next);
  assert.equal(container.children.length, 1);
  listeners.get('__DestroyLifetime')();
  assert.equal(container.children.length, 0);
  assert.equal(listeners.size, 0);
});

test('background analysis returns data through the bridge and cancels superseded work', () => {
  const host = createHost();
  host.xml.mount('#xml-content', initial);
  host.xml.update({ ...next, values: [100] });
  host.xml.update({ ...next, values: [8, 3, 21, 5, 13, 2] });
  assert.equal(host.timers.size, 1);
  host.runTasks();
  host.deliverResults();
  const card = host.container.children[0];
  assert.equal(card.children[1].children[0].text, 'Analyzed 6 values');
  assert.equal(
    card.children[2].children[0].text,
    'Sum 52; mean 8.67; median 6.5. Run 1.',
  );
});

test('unmount cancels background tasks; late replies cannot mutate a new mount', () => {
  const host = createHost();
  host.xml.mount('#xml-content', initial);
  host.xml.update({ ...next, values: [1, 2] });
  host.runTasks(); // Reply is now in transit.
  host.xml.unmount();
  assert.equal(host.mainListeners.size, 0);
  host.xml.mount('#xml-content', initial);
  host.deliverResults();
  assert.equal(
    host.container.children[0].children[1].children[0].text,
    initial.title,
  );
  host.xml.update({ ...next, values: [3, 4] });
  host.xml.unmount();
  assert.equal(host.timers.size, 0);
});

test('background validation errors return renderable error data', () => {
  const host = createHost();
  host.xml.mount('#xml-content', initial);
  host.xml.update({ ...next, values: [1, 'bad'] });
  host.runTasks();
  host.deliverResults();
  assert.equal(
    host.container.children[0].children[1].children[0].text,
    'Analysis failed',
  );
});

test('pending background coalesces snapshots and initializes once with latest data', () => {
  const host = createHost({ deferBackground: true });
  host.xml.mount('#xml-content', initial);
  const card = host.container.children[0];
  host.xml.update({ ...next, values: [100] });
  const data = { ...next, values: [2, 4] };
  host.xml.update(data);
  data.values.push(1000); // Buffered data must be a snapshot, not a caller reference.
  assert.equal(card.children[1].children[0].text, next.title);
  assert.equal(host.commands.length, 0);
  host.startBackground();
  host.xml.setBackgroundReady();
  host.xml.setBackgroundReady();
  assert.equal(host.commands.length, 1);
  assert.equal(host.commands[0].kind, 'mount');
  assert.equal(host.commands[0].revision, 3);
  assert.deepEqual(Array.from(host.commands[0].data.values), [2, 4]);
  host.runTasks();
  host.deliverResults();
  assert.equal(host.container.children[0], card);
  assert.equal(
    card.children[2].children[0].text,
    'Sum 6; mean 3.00; median 3. Run 1.',
  );
});

test('unmount before ready discards pending data; remount initializes only the current card', () => {
  const host = createHost({ deferBackground: true });
  host.xml.mount('#xml-content', { ...initial, values: [99] });
  host.xml.unmount();
  host.startBackground();
  host.xml.setBackgroundReady();
  assert.equal(host.commands.length, 0);
  assert.equal(host.timers.size, 0);
  assert.equal(host.mainListeners.size, 0);
  host.xml.mount('#xml-content', { ...next, values: [3] });
  assert.equal(host.commands.length, 1);
  assert.equal(host.commands[0].instanceId, host.container.children[0].id);
});

test('remount while preparing replaces the old instance and pending snapshot', () => {
  const host = createHost({ deferBackground: true });
  host.xml.mount('#xml-content', initial);
  const oldId = host.container.children[0].id;
  host.xml.unmount();
  host.xml.mount('#xml-content', next);
  host.startBackground();
  host.xml.setBackgroundReady();
  assert.equal(host.commands.length, 1);
  assert.notEqual(host.commands[0].instanceId, oldId);
  assert.equal(host.commands[0].data.title, next.title);
});

for (const deferBackground of [false, true]) {
  test(`standalone renders before readiness with background deferred=${deferBackground}`, () => {
    const host = createHost({ standalone: true, deferBackground });
    host.listeners.get('__RenderPage')();
    // Standalone card is attached to Page rather than the host container.
    assert.equal(host.commands.length, 0);
    if (deferBackground) host.startBackground();
    host.deliverResults();
    assert.equal(host.commands.length, 1);
    assert.equal(host.commands[0].kind, 'mount');
    host.listeners.get('__DestroyLifetime')();
    assert.equal(host.mainListeners.size, 0);
    assert.equal(host.timers.size, 0);
  });
}
