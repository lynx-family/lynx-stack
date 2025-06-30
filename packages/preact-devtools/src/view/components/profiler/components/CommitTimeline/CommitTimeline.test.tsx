import { h, ComponentChild } from 'preact';
import { expect } from 'chai';
import { CommitTimeline } from './CommitTimeline';
import { fireEvent, render } from '@testing-library/preact';
import * as sinon from 'sinon';

export function renderTest(ui: ComponentChild) {
  const res = render(ui);
  return {
    ...res,
    e2e: (name: string) =>
      res.container.querySelector(`[data-testid="${name}"]`),
    $: (sel: string) => res.container.querySelector(sel),
    $$: (sel: string) => res.container.querySelectorAll(sel),
  };
}

const noop = () => null;

function makeCommits(arr: number[]) {
  return arr.map((a, index) => ({ percent: a, index }));
}

describe('CommitTimeline', () => {
  it('should render 4 items', () => {
    const { $$ } = renderTest(
      <CommitTimeline
        onChange={noop}
        selected={0}
        items={makeCommits([20, 80, 10, 10])}
      />,
    );
    expect($$('[data-testid="commit-item"]').length).to.equal(4);
  });

  it('should wrap around if selection === 0', () => {
    const spy = sinon.spy();
    const { $ } = renderTest(
      <CommitTimeline
        onChange={spy}
        selected={0}
        items={makeCommits([20, 80, 10, 10])}
      />,
    );

    const btn = $('[data-testid=\'prev-commit\']')!;
    fireEvent.click(btn);
    expect(spy.args[0][0]).to.equal(3);
  });

  it('should wrap around if selection === items.length', () => {
    const spy = sinon.spy();
    const { $ } = renderTest(
      <CommitTimeline
        onChange={spy}
        selected={3}
        items={makeCommits([20, 80, 10, 10])}
      />,
    );

    const btn = $('[data-testid=\'next-commit\']')!;
    fireEvent.click(btn);

    expect(spy.args[0][0]).to.equal(0);
  });
});
