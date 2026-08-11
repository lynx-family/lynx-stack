// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '@testing-library/jest-dom';

import { batch, computed, signal, useComputed, useSignal } from '@lynx-js/react-signals';
import { expect, it, vi } from 'vitest';

import { act, fireEvent, render } from '../index.jsx';

it('rerenders when signals read during render change', () => {
  const firstName = signal('Lynx');
  const lastName = signal('Stack');
  const fullName = computed(() => `${firstName.value} ${lastName.value}`);
  const renderSpy = vi.fn();

  function Greeting() {
    renderSpy();
    return <text data-testid='name'>{fullName.value}</text>;
  }

  const { getByTestId } = render(<Greeting />);

  expect(getByTestId('name')).toHaveTextContent('Lynx Stack');
  expect(renderSpy).toHaveBeenCalledTimes(1);

  act(() => {
    batch(() => {
      firstName.value = 'React';
      lastName.value = 'Lynx';
    });
  });

  expect(getByTestId('name')).toHaveTextContent('React Lynx');
  expect(renderSpy).toHaveBeenCalledTimes(2);
});

it('supports component-local signals and computed values', () => {
  function Counter() {
    const count = useSignal(1);
    const doubled = useComputed(() => count.value * 2);

    return (
      <view>
        <text data-testid='count'>{count.value}</text>
        <text data-testid='doubled'>{doubled.value}</text>
        <view
          data-testid='increment'
          bindtap={() => {
            count.value++;
          }}
        />
      </view>
    );
  }

  const { getByTestId } = render(<Counter />);

  expect(getByTestId('count')).toHaveTextContent('1');
  expect(getByTestId('doubled')).toHaveTextContent('2');

  fireEvent.tap(getByTestId('increment'));

  expect(getByTestId('count')).toHaveTextContent('2');
  expect(getByTestId('doubled')).toHaveTextContent('4');
});

it('updates conditional UI structure when a signal changes', () => {
  const expanded = signal(false);

  function Card() {
    return (
      <view data-testid='card'>
        {expanded.value
          ? (
            <view data-testid='details'>
              <text>Details</text>
              <text>Signals can change structure</text>
            </view>
          )
          : <text data-testid='summary'>Summary</text>}
      </view>
    );
  }

  const { container } = render(<Card />);

  expect(container).toMatchInlineSnapshot(`
    <page>
      <view
        data-testid="card"
      >
        <text
          data-testid="summary"
        >
          Summary
        </text>
      </view>
    </page>
  `);

  act(() => {
    expanded.value = true;
  });

  expect(container).toMatchInlineSnapshot(`
    <page>
      <view
        data-testid="card"
      >
        <view
          data-testid="details"
        >
          <text>
            Details
          </text>
          <text>
            Signals can change structure
          </text>
        </view>
      </view>
    </page>
  `);
});

it('updates keyed UI structure when a signal changes a collection', () => {
  const items = signal([
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
  ]);

  function ItemList() {
    return (
      <view data-testid='list'>
        {items.value.map(item => (
          <text key={item.id} data-testid={`item-${item.id}`}>
            {item.label}
          </text>
        ))}
      </view>
    );
  }

  const { container } = render(<ItemList />);

  expect(container).toMatchInlineSnapshot(`
    <page>
      <view
        data-testid="list"
      >
        <text
          data-testid="item-a"
        >
          Alpha
        </text>
        <text
          data-testid="item-b"
        >
          Beta
        </text>
      </view>
    </page>
  `);

  act(() => {
    items.value = [
      { id: 'c', label: 'Gamma' },
      { id: 'a', label: 'Alpha' },
    ];
  });

  expect(container).toMatchInlineSnapshot(`
    <page>
      <view
        data-testid="list"
      >
        <text
          data-testid="item-c"
        >
          Gamma
        </text>
        <text
          data-testid="item-a"
        >
          Alpha
        </text>
      </view>
    </page>
  `);
});
