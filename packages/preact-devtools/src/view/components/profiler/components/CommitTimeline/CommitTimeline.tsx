import { h, RefObject } from 'preact';
import { useState, useCallback, useRef, useEffect } from 'preact/hooks';
import { getGradient } from '../../data/gradient';
import { useResize } from '../../../utils';
import { Icon } from '../../../icons';

function calcSize(
  container: RefObject<HTMLDivElement | null>,
  inner: RefObject<HTMLDivElement | null>,
  pane: RefObject<HTMLDivElement | null>,
  paneContainer: RefObject<HTMLDivElement | null>,
  count: number,
  selected: number,
) {
  if (
    container.current
    && inner.current
    && paneContainer.current
    && pane.current
  ) {
    if (count > 0) {
      const org = paneContainer.current.style.width;
      paneContainer.current.style.width = '0';

      const style = window.getComputedStyle(pane.current.firstElementChild!);
      const min = +style.getPropertyValue('min-width').replace('px', '');
      const max = +style.getPropertyValue('max-width').replace('px', '');

      const sibling = pane.current.firstElementChild!
        ? pane.current.firstElementChild!.nextElementSibling!
        : null;
      const gap = sibling
        ? +window
          .getComputedStyle(sibling)
          .getPropertyValue('margin-left')
          .replace('px', '')
        : 0;

      const full = container.current.offsetWidth;
      const ui = inner.current.offsetWidth;
      const available = full - ui - 1; // -1 to prevent layout glitch in chrome

      const itemWidth = Math.max(
        min,
        Math.min(Math.floor(available - (count - 1) * gap) / count, max),
      );
      const paneWidth = itemWidth * count + (count - 1) * gap;
      const viewport = available > paneWidth ? paneWidth : available;

      const selOffset = itemWidth * (selected + 1) + selected * gap;
      const offset = selOffset > viewport
        ? Math.min(
          viewport - selOffset - (selected < count - 1 ? itemWidth / 2 : 0),
          paneWidth - viewport,
          // eslint-disable-next-line no-mixed-spaces-and-tabs
        )
        : 0;

      paneContainer.current.style.width = org;

      return {
        item: itemWidth,
        pane: paneWidth,
        viewport,
        offset,
      };
    }
  }

  return { viewport: 0, pane: 0, item: 0, offset: 0 };
}

export interface CommitTimelineProps {
  selected: number;
  items: { percent: number; index: number }[];
  onChange: (i: number) => void;
}

export function CommitTimeline(props: CommitTimelineProps) {
  const { items, onChange, selected } = props;

  const [viewportWidth, setViewportWidth] = useState(0);
  const [paneWidth, setPaneWidth] = useState(0);
  const [offset, setOffset] = useState(0);

  const container = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const paneContainerRef = useRef<HTMLDivElement>(null);

  const selectedItemIndex = items.findIndex(item => item.index === selected);

  useEffect(() => {
    if (pane.current) {
      const active = pane.current.querySelector('[data-selected="true"]');
      // JSDOM doesn't support scrollIntoView
      if (active && active.scrollIntoView) active.scrollIntoView();
    }
  }, [selectedItemIndex]);

  useResize(
    () => {
      const sizes = calcSize(
        container,
        inner,
        pane,
        paneContainerRef,
        items.length,
        selectedItemIndex,
      );
      setPaneWidth(sizes.pane);
      setViewportWidth(sizes.viewport);
      setOffset(sizes.offset);
    },
    [pane, container, paneContainerRef, inner, items.length, selectedItemIndex],
    true,
  );

  const onPrev = useCallback(() => {
    const next = selectedItemIndex - 1;
    const nextWrapped = next < 0 ? items.length - 1 : next;

    onChange(items[nextWrapped].index);
  }, [selectedItemIndex]);

  const onNext = useCallback(() => {
    const next = selectedItemIndex + 1;
    const nextWrapped = next > items.length - 1 ? 0 : next;
    onChange(items[nextWrapped].index);
  }, [selectedItemIndex]);

  if (items.length === 0) {
    // Useful just for layout purposes
    return <div class='commit-timeline'></div>;
  }

  const selectedCount = '' + (selectedItemIndex + 1);
  const itemsCountLen = ('' + items.length).length;
  const leading = selectedCount.padStart(itemsCountLen, '0');

  return (
    <div class='commit-timeline' ref={container}>
      <div class='commit-timeline-inner' ref={inner}>
        <div class='commit-timeline-legend'>
          <span class='commit-timeline-hidden'>
            {leading.slice(0, itemsCountLen - selectedCount.length)}
          </span>
          <span data-testid='commit-page-info'>
            {selectedItemIndex + 1} / {items.length}
          </span>
        </div>
        <button
          disabled={items.length <= 1}
          onClick={onPrev}
          class='commit-time-line-nav-btn'
          data-testid='prev-commit'
        >
          <Icon icon='arrow-back' />
        </button>
        <div
          class='commit-timeline-item-container'
          ref={paneContainerRef}
          style={`width: ${viewportWidth}px`}
        >
          <div
            class='commit-timeline-items'
            ref={pane}
            style={`width: ${paneWidth}px; transform: translate3d(${offset}px, 0, 0);`}
          >
            {items.map(x => {
              return (
                <CommitItem
                  key={x.index}
                  onClick={() => onChange(x.index)}
                  selected={x.index === selected}
                  percent={x.percent}
                />
              );
            })}
          </div>
        </div>
        <button
          disabled={items.length <= 1}
          onClick={onNext}
          class='commit-time-line-nav-btn'
          data-testid='next-commit'
        >
          <Icon icon='arrow-forward' />
        </button>
      </div>
    </div>
  );
}

export interface CommitItem {
  percent: number;
  onClick: () => void;
  selected?: boolean;
}

export function CommitItem(props: CommitItem) {
  const { percent } = props;
  const top = Math.max(20, Math.min(86, 100 - percent));
  const color = getGradient(100, percent);

  return (
    <div
      data-testid='commit-item'
      class='commit-timeline-item'
      data-selected={props.selected}
      data-weight={color}
      onClick={props.onClick}
    >
      <div class='commit-timeline-item-inner' style={`top: ${top}%`} />
    </div>
  );
}
