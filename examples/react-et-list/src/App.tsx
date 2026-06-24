import { useCallback, useRef, useState } from '@lynx-js/react';

import './App.css';

type Scenario = 'basic' | 'single-render' | 'recreate';

interface ListCaseItem {
  id: string;
  title: string;
  meta: string;
  tone: 'warm' | 'cool' | 'mint' | 'rose';
}

const SCENARIOS: Array<{ id: Scenario; label: string }> = [
  { id: 'basic', label: 'Basic' },
  { id: 'single-render', label: 'Single Render' },
  { id: 'recreate', label: 'Recreate' },
];

const basicItemCount = 24;
const initialBasicItems = Array.from(
  { length: basicItemCount },
  (_, index) => createBasicItem(index),
);

const singleRenderInitialItems: ListCaseItem[] = [
  createLetterItem('A', 'warm'),
  createLetterItem('B', 'cool'),
  createLetterItem('C', 'mint'),
  createLetterItem('D', 'rose'),
  createLetterItem('E', 'warm'),
];

const singleRenderNextItems: ListCaseItem[] = [
  createLetterItem('X', 'rose'),
  createLetterItem('C', 'mint'),
  createLetterItem('A', 'warm'),
  createLetterItem('E', 'cool'),
  createLetterItem('Y', 'mint'),
];

function createBasicItem(index: number): ListCaseItem {
  const tones: ListCaseItem['tone'][] = ['warm', 'cool', 'mint', 'rose'];
  const tone = tones[index % tones.length] ?? 'warm';
  return {
    id: `basic-${index}`,
    title: `Item ${index}`,
    meta: `key=basic-${index} reuse=basic-row`,
    tone,
  };
}

function createLetterItem(
  letter: string,
  tone: ListCaseItem['tone'],
): ListCaseItem {
  return {
    id: `letter-${letter}`,
    title: letter,
    meta: `key=${letter}`,
    tone,
  };
}

function createRecreateItems(version: number): ListCaseItem[] {
  return Array.from({ length: 8 }, (_, index) => ({
    id: `holder-${version}-${index}`,
    title: `Holder ${version} / Item ${index}`,
    meta: `key=v${version}-${index} reuse=holder-${version}`,
    tone: index % 2 === 0 ? 'mint' : 'cool',
  }));
}

function Action({
  label,
  onTap,
}: {
  label: string;
  onTap: () => void;
}) {
  return (
    <view className='Action' bindtap={onTap}>
      <text className='ActionText'>{label}</text>
    </view>
  );
}

function ScenarioTabs({
  current,
  onChange,
}: {
  current: Scenario;
  onChange: (scenario: Scenario) => void;
}) {
  const selectScenario = useCallback((scenario: Scenario) => {
    'background-only';
    onChange(scenario);
  }, [onChange]);

  return (
    <view className='Tabs'>
      {SCENARIOS.map((scenario) => (
        <view
          key={scenario.id}
          className={current === scenario.id ? 'Tab TabActive' : 'Tab'}
          bindtap={() => selectScenario(scenario.id)}
        >
          <text className='TabText'>{scenario.label}</text>
        </view>
      ))}
    </view>
  );
}

function ListRow({
  item,
  index,
  reuseIdentifier,
  onTap,
  bindFirstRef,
}: {
  item: ListCaseItem;
  index: number;
  reuseIdentifier: string;
  onTap: (item: ListCaseItem) => void;
  bindFirstRef?: (node: unknown) => void;
}) {
  return (
    <list-item
      item-key={item.id}
      key={item.id}
      reuse-identifier={reuseIdentifier}
      className={`FeedItem FeedItem-${item.tone}`}
      bindtap={() => onTap(item)}
    >
      <view
        className='ItemBody'
        {...(index === 0 && bindFirstRef ? { ref: bindFirstRef } : {})}
      >
        <text className='ItemTitle'>{item.title}</text>
        <text className='ItemMeta'>{item.meta} index={index}</text>
      </view>
    </list-item>
  );
}

function BasicScenario() {
  const [items, setItems] = useState(initialBasicItems);
  const [selected, setSelected] = useState('none');
  const [firstItemRefStatus, setFirstItemRefStatus] = useState('pending');
  const [nextBasicIndex, setNextBasicIndex] = useState(basicItemCount);
  const firstItemRef = useRef<unknown>(null);

  const bindFirstItemRef = useCallback((node: unknown) => {
    'background-only';
    firstItemRef.current = node;
    setFirstItemRefStatus(node ? 'attached' : 'detached');
  }, []);

  const handleItemTap = useCallback((item: ListCaseItem) => {
    'background-only';
    setSelected(item.id);
  }, []);

  const moveLastToFront = useCallback(() => {
    'background-only';
    setItems(prevItems => {
      const last = prevItems[prevItems.length - 1];
      if (last === undefined) {
        return prevItems;
      }
      return [last, ...prevItems.slice(0, -1)];
    });
  }, []);

  const removeFirst = useCallback(() => {
    'background-only';
    setItems(prevItems => prevItems.slice(1));
  }, []);

  const appendItem = useCallback(() => {
    'background-only';
    setItems(prevItems => [...prevItems, createBasicItem(nextBasicIndex)]);
    setNextBasicIndex(prevIndex => prevIndex + 1);
  }, [nextBasicIndex]);

  const resetItems = useCallback(() => {
    'background-only';
    setItems(initialBasicItems);
    setSelected('none');
    setFirstItemRefStatus('pending');
    setNextBasicIndex(basicItemCount);
  }, []);

  return (
    <view className='Scenario'>
      <view className='Header'>
        <text className='Title'>ET List Basic</text>
        <text className='Status'>selected: {selected}</text>
        <text className='Status'>first item ref: {firstItemRefStatus}</text>
        <text className='Status'>count: {items.length}</text>
      </view>

      <view className='Actions'>
        <Action label='Move Last To Front' onTap={moveLastToFront} />
        <Action label='Remove First' onTap={removeFirst} />
        <Action label='Append' onTap={appendItem} />
        <Action label='Reset' onTap={resetItems} />
      </view>

      <list list-type='single' className='Feed'>
        {items.map((item, index) => (
          <ListRow
            key={item.id}
            item={item}
            index={index}
            reuseIdentifier='basic-row'
            onTap={handleItemTap}
            bindFirstRef={bindFirstItemRef}
          />
        ))}
      </list>
    </view>
  );
}

function SingleRenderScenario() {
  const [items, setItems] = useState(singleRenderInitialItems);
  const [phase, setPhase] = useState('initial');
  const [selected, setSelected] = useState('none');

  const handleItemTap = useCallback((item: ListCaseItem) => {
    'background-only';
    setSelected(item.id);
  }, []);

  const applyUpdate = useCallback(() => {
    'background-only';
    setItems(singleRenderNextItems);
    setPhase('updated');
    setSelected('none');
  }, []);

  const resetUpdate = useCallback(() => {
    'background-only';
    setItems(singleRenderInitialItems);
    setPhase('initial');
    setSelected('none');
  }, []);

  return (
    <view className='Scenario'>
      <view className='Header'>
        <text className='Title'>ET List Single Render</text>
        <text className='Status'>
          order: {items.map(item => item.title).join(', ')}
        </text>
        <text className='Status'>phase: {phase}</text>
        <text className='Status'>selected: {selected}</text>
      </view>

      <view className='Actions'>
        <Action label='Apply X,C,A,E,Y' onTap={applyUpdate} />
        <Action label='Reset A,B,C,D,E' onTap={resetUpdate} />
      </view>

      <list list-type='single' className='Feed CompactFeed'>
        {items.map((item, index) => (
          <ListRow
            key={item.id}
            item={item}
            index={index}
            reuseIdentifier='single-render-row'
            onTap={handleItemTap}
          />
        ))}
      </list>
    </view>
  );
}

function RecreateScenario() {
  const [visible, setVisible] = useState(true);
  const [holderVersion, setHolderVersion] = useState(1);
  const [selected, setSelected] = useState('none');
  const [firstItemRefStatus, setFirstItemRefStatus] = useState('pending');
  const firstItemRef = useRef<unknown>(null);

  const items = createRecreateItems(holderVersion);

  const bindFirstItemRef = useCallback((node: unknown) => {
    'background-only';
    firstItemRef.current = node;
    setFirstItemRefStatus(
      node ? `attached:v${holderVersion}` : `detached:v${holderVersion}`,
    );
  }, [holderVersion]);

  const handleItemTap = useCallback((item: ListCaseItem) => {
    'background-only';
    setSelected(item.id);
  }, []);

  const hideList = useCallback(() => {
    'background-only';
    setVisible(false);
    setSelected('none');
    setFirstItemRefStatus('detached');
  }, []);

  const recreateList = useCallback(() => {
    'background-only';
    setHolderVersion(prevVersion => prevVersion + 1);
    setVisible(true);
    setSelected('none');
    setFirstItemRefStatus('pending');
  }, []);

  return (
    <view className='Scenario'>
      <view className='Header'>
        <text className='Title'>ET List Recreate</text>
        <text className='Status'>holder: {holderVersion}</text>
        <text className='Status'>selected: {selected}</text>
        <text className='Status'>first item ref: {firstItemRefStatus}</text>
      </view>

      <view className='Actions'>
        <Action label='Unmount List' onTap={hideList} />
        <Action label='Recreate List' onTap={recreateList} />
      </view>

      {visible
        ? (
          <list list-type='single' className='Feed CompactFeed'>
            {items.map((item, index) => (
              <ListRow
                key={item.id}
                item={item}
                index={index}
                reuseIdentifier={`holder-${holderVersion}`}
                onTap={handleItemTap}
                bindFirstRef={bindFirstItemRef}
              />
            ))}
          </list>
        )
        : (
          <view className='EmptyState'>
            <text className='EmptyText'>list unmounted</text>
          </view>
        )}
    </view>
  );
}

export function App() {
  const [scenario, setScenario] = useState<Scenario>('basic');

  const selectScenario = useCallback((nextScenario: Scenario) => {
    'background-only';
    setScenario(nextScenario);
  }, []);

  return (
    <view className='Page'>
      <view className='Shell'>
        <text className='AppTitle'>ET List E2E Examples</text>
        <ScenarioTabs current={scenario} onChange={selectScenario} />
        {scenario === 'basic' ? <BasicScenario /> : null}
        {scenario === 'single-render' ? <SingleRenderScenario /> : null}
        {scenario === 'recreate' ? <RecreateScenario /> : null}
      </view>
    </view>
  );
}
