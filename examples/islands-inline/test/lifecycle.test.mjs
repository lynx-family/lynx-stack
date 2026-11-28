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
    addEventListener: (name, fn) => {
      if (!own.has(name)) own.set(name, new Set());
      own.get(name).add(fn);
    },
    removeEventListener: (name, fn) => {
      const callbacks = own.get(name);
      callbacks?.delete(fn);
      if (callbacks?.size === 0) own.delete(name);
    },
    dispatchEvent: send,
  };
}

function createHost(
  {
    deferBackground = false,
    standalone = false,
    hasPage = true,
  } = {},
) {
  let id = 0;
  const node = (tag, text) => ({ id: ++id, tag, text, children: [] });
  const page = node('page');
  let currentPage = hasPage ? page : null;
  let pagesCreated = 0;
  let nativeFlushes = 0;
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
      for (const callback of backgroundListeners.get(event.type) ?? []) {
        callback(event);
      }
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
    __lynxIsland: standalone ? undefined : true,
    lynx: {
      getJSContext: () => background,
      getEngine: () => endpoint(listeners, () => undefined),
    },
    __GetPageElement: () => currentPage,
    __CreatePage: () => {
      pagesCreated++;
      currentPage = page;
      return page;
    },
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
    __FlushElementTree() {
      nativeFlushes++;
    },
  };
  runInNewContext(source, context);
  assert.equal(listeners.has('__RenderPage'), standalone);
  const xml = context.module.exports.create();
  if (!deferBackground && !standalone) {
    xml.setBackgroundReady();
  }
  return {
    xml,
    create: context.module.exports.create,
    other,
    container,
    listeners,
    timers,
    mainListeners,
    commands,
    page,
    pagesCreated: () => pagesCreated,
    nativeFlushes: () => nativeFlushes,
    startBackground,
    destroy() {
      for (const callback of [...listeners.get('__DestroyLifetime') ?? []]) {
        callback();
      }
    },
    renderStandalone(data) {
      for (const callback of listeners.get('__RenderPage') ?? []) {
        callback({ data: [data] });
      }
    },
    updateStandalone(data) {
      for (const callback of listeners.get('__UpdatePage') ?? []) {
        callback({ data: [data] });
      }
    },
    runTasks() {
      const work = [...timers.values()];
      timers.clear();
      for (const task of work) task();
    },
    deliverResults() {
      for (const reply of replies.splice(0)) {
        for (const callback of mainListeners.get(reply.type) ?? []) {
          callback(reply);
        }
      }
    },
  };
}

const initial = { title: 'Initial', description: 'First snapshot' };
const next = { title: 'Updated', description: 'Second snapshot' };

test('first-screen render skips only its own flush; updates, replies and disposal still commit', () => {
  const host = createHost();
  host.xml.render('#xml-content', initial, { flush: false });
  assert.equal(host.nativeFlushes(), 0);
  host.xml.update({ ...initial });
  assert.equal(
    host.nativeFlushes(),
    0,
    'equal visible text does not dirty native nodes',
  );
  host.xml.update(next);
  assert.equal(host.nativeFlushes(), 1);
  host.xml.update({ ...next, values: [1, 2, 3] });
  assert.equal(
    host.nativeFlushes(),
    1,
    'background-only data does not dirty native nodes',
  );
  host.runTasks();
  host.deliverResults();
  const afterReply = host.nativeFlushes();
  assert.equal(afterReply, 2, 'asynchronous changed result commits');
  host.xml.dispose();
  assert.equal(host.nativeFlushes(), afterReply + 1);
  host.xml.render('#xml-content', initial);
  assert.equal(
    host.nativeFlushes(),
    afterReply + 2,
    'later render restores the default flush',
  );
});

test('render flush option also applies when updating an existing container', () => {
  const host = createHost();
  host.xml.render('#xml-content', initial);
  host.xml.render('#xml-content', next, { flush: false });
  assert.equal(host.nativeFlushes(), 1);
  assert.equal(
    host.container.children[0].children[1].children[0].text,
    next.title,
  );
  host.xml.render('#xml-content', initial, { flush: true });
  assert.equal(host.nativeFlushes(), 2);
});

test('direct renderer and standalone entry retain their own native commits', () => {
  const direct = createHost();
  direct.xml.render('#xml-content', initial);
  assert.equal(direct.nativeFlushes(), 1);
  direct.xml.update(next);
  assert.equal(direct.nativeFlushes(), 2);
  direct.xml.dispose();
  assert.equal(direct.nativeFlushes(), 3);
  const standalone = createHost({ standalone: true });
  standalone.renderStandalone();
  assert.equal(
    standalone.nativeFlushes(),
    0,
    'native owns the initial page flush',
  );
});

test('frame standalone entry consumes initial and updated host data', () => {
  const host = createHost({ standalone: true });
  host.renderStandalone(initial);
  const card = host.page.children.at(-1);
  assert.equal(card.children[1].children[0].text, initial.title);
  host.updateStandalone(next);
  assert.equal(card.children[1].children[0].text, next.title);
  assert.equal(host.nativeFlushes(), 1);
  host.destroy();
  assert.equal(host.listeners.has('__RenderPage'), false);
  assert.equal(host.listeners.has('__UpdatePage'), false);
});
test('hosted rendering requires a container and an existing host Page', () => {
  const host = createHost({ hasPage: false });
  assert.throws(
    () => host.xml.render(undefined, initial),
    /selector is required/,
  );
  assert.throws(
    () => host.xml.render('#xml-content', initial),
    /host Page must exist/,
  );
  assert.equal(host.pagesCreated(), 0);
  assert.equal(host.container.children.length, 0);
  assert.equal(host.listeners.size, 0);
  assert.equal(host.mainListeners.size, 0);
});

test('the optional standalone entry creates its own Page when absent', () => {
  const host = createHost({ standalone: true, hasPage: false });
  host.renderStandalone();
  host.renderStandalone();
  assert.equal(host.pagesCreated(), 1);
  assert.equal(
    host.page.children.filter(child => child.className === 'XmlCard').length,
    1,
  );
  assert.equal(host.container.children.length, 0);
  host.destroy();
});

test('render and update retain node identity; repeated render updates without duplicating', () => {
  const { xml, container, listeners } = createHost();
  assert.equal(listeners.has('__RenderPage'), false);
  xml.render('#xml-content', initial);
  const card = container.children[0];
  const title = card.children[1].children[0];
  xml.update(next);
  assert.equal(container.children[0], card);
  assert.equal(card.children[1].children[0], title);
  assert.equal(title.text, next.title);
  xml.render('#xml-content', initial);
  assert.equal(container.children.length, 1);
  assert.equal(title.text, initial.title);
});

test('invalid transitions and data leave the rendered card intact', () => {
  const { xml, container } = createHost();
  assert.throws(() => xml.update(next), /Render/);
  assert.throws(() => xml.render('#missing', initial), /not found/);
  xml.render('#xml-content', initial);
  const card = container.children[0];
  assert.throws(() => xml.render('#other', initial), /Dispose/);
  assert.throws(() => xml.update({ title: 'Incomplete' }), /requires string/);
  assert.equal(container.children[0], card);
  assert.equal(card.children[1].children[0].text, initial.title);
});

test('dispose is idempotent, releases its listener, and supports rerender and page teardown', () => {
  const { xml, container, listeners, destroy } = createHost();
  xml.dispose();
  xml.render('#xml-content', initial);
  assert.equal(listeners.size, 1);
  xml.dispose();
  xml.dispose();
  assert.equal(container.children.length, 0);
  assert.equal(listeners.size, 0);
  assert.throws(() => xml.update(next), /Render/);
  xml.render('#xml-content', next);
  assert.equal(container.children.length, 1);
  destroy();
  assert.equal(container.children.length, 0);
  assert.equal(listeners.size, 0);
});

test('background analysis returns data through the bridge and cancels superseded work', () => {
  const host = createHost();
  host.xml.render('#xml-content', initial);
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

test('dispose cancels background tasks; late replies cannot mutate a new render', () => {
  const host = createHost();
  host.xml.render('#xml-content', initial);
  host.xml.update({ ...next, values: [1, 2] });
  host.runTasks(); // Reply is now in transit.
  host.xml.dispose();
  assert.equal(host.mainListeners.size, 0);
  host.xml.render('#xml-content', initial);
  host.deliverResults();
  assert.equal(
    host.container.children[0].children[1].children[0].text,
    initial.title,
  );
  host.xml.update({ ...next, values: [3, 4] });
  host.xml.dispose();
  assert.equal(host.timers.size, 0);
});

test('background validation errors return renderable error data', () => {
  const host = createHost();
  host.xml.render('#xml-content', initial);
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
  host.xml.render('#xml-content', initial);
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
  assert.equal(host.commands[0].kind, 'render');
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

test('dispose before ready discards pending data; rerender initializes only the current card', () => {
  const host = createHost({ deferBackground: true });
  host.xml.render('#xml-content', { ...initial, values: [99] });
  host.xml.dispose();
  host.startBackground();
  host.xml.setBackgroundReady();
  assert.equal(host.commands.length, 0);
  assert.equal(host.timers.size, 0);
  assert.equal(host.mainListeners.size, 0);
  host.xml.render('#xml-content', { ...next, values: [3] });
  assert.equal(host.commands.length, 1);
  assert.equal(host.commands[0].instanceId, host.container.children[0].id);
});

test('rerender while preparing replaces the old instance and pending snapshot', () => {
  const host = createHost({ deferBackground: true });
  host.xml.render('#xml-content', initial);
  const oldId = host.container.children[0].id;
  host.xml.dispose();
  host.xml.render('#xml-content', next);
  host.startBackground();
  host.xml.setBackgroundReady();
  assert.equal(host.commands.length, 1);
  assert.notEqual(host.commands[0].instanceId, oldId);
  assert.equal(host.commands[0].data.title, next.title);
});

for (const deferBackground of [false, true]) {
  test(`standalone renders before readiness with background deferred=${deferBackground}`, () => {
    const host = createHost({ standalone: true, deferBackground });
    host.renderStandalone();
    // Standalone card is attached to Page rather than the host container.
    assert.equal(host.commands.length, 0);
    if (deferBackground) host.startBackground();
    host.deliverResults();
    assert.equal(host.commands.length, 1);
    assert.equal(host.commands[0].kind, 'render');
    host.destroy();
    assert.equal(host.mainListeners.size, 0);
    assert.equal(host.timers.size, 0);
  });
}

test('one XML module renders independent containers and cleans up each session', () => {
  const host = createHost();
  const first = host.xml;
  const second = host.create();
  second.setBackgroundReady();
  first.render('#xml-content', initial);
  second.render('#other', next);
  first.update({ ...initial, values: [1, 3] });
  second.update({ ...next, values: [5, 7] });
  assert.equal(host.timers.size, 2);
  host.runTasks();
  host.deliverResults();
  assert.match(
    host.container.children[0].children[2].children[0].text,
    /Sum 4/,
  );
  assert.match(host.other.children[0].children[2].children[0].text, /Sum 12/);
  first.dispose();
  assert.equal(host.container.children.length, 0);
  second.update({ ...next, values: [9] });
  host.runTasks();
  host.deliverResults();
  assert.match(host.other.children[0].children[2].children[0].text, /Sum 9/);
  host.destroy();
  assert.equal(host.other.children.length, 0);
  assert.equal(host.mainListeners.size, 0);
  assert.equal(host.timers.size, 0);
});
