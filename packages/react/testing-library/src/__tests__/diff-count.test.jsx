import '@testing-library/jest-dom';
import { test, expect, beforeAll, beforeEach } from 'vitest';
import { Component } from 'preact';
import { useState } from 'preact/hooks';
import { render, fireEvent } from '..';
import { initDiffCountHook, resetDiffCounts, getDiffCounts } from '../../../runtime/lib/debug/profileHooks.js';

beforeAll(() => {
  initDiffCountHook();
});

beforeEach(() => {
  resetDiffCounts();
});

// Deterministic summary for inline snapshots: sort by count desc, then name asc.
function summary() {
  const { total, byType } = getDiffCounts();
  const sorted = Object.entries(byType).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  return {
    total,
    byType: Object.fromEntries(sorted),
  };
}

// ---- Building blocks that each produce a `ReactLynx::diff::Xxx` frame ----

function Leaf({ label }) {
  return <text>{label}</text>;
}

function Badge({ count }) {
  return (
    <view>
      <text>#{count}</text>
    </view>
  );
}

function Row({ index, children }) {
  // Multi-child ⇒ transform emits `$0`, `$1`, … slot props
  return (
    <view>
      <text>row-{index}</text>
      <Badge count={index} />
      <view>{children}</view>
    </view>
  );
}

function Card({ title, footer, children }) {
  return (
    <view>
      <view>
        <text>{title}</text>
      </view>
      <view>{children}</view>
      <view>{footer}</view>
    </view>
  );
}

function Section({ title, items }) {
  return (
    <view>
      <text>{title}</text>
      {items.map((item, i) => (
        <Row key={item.id} index={i}>
          <Leaf label={item.label} />
          <Badge count={item.id} />
        </Row>
      ))}
    </view>
  );
}

class Panel extends Component {
  render() {
    return (
      <view>
        <text>{this.props.header}</text>
        <view>{this.props.children}</view>
      </view>
    );
  }
}

function Grid({ rows, cols }) {
  const items = [];
  for (let r = 0; r < rows; r++) {
    const cells = [];
    for (let c = 0; c < cols; c++) {
      cells.push(
        <Badge key={`${r}-${c}`} count={r * cols + c} />,
      );
    }
    items.push(
      <Row key={r} index={r}>
        {cells}
      </Row>,
    );
  }
  return <view>{items}</view>;
}

// Deep nesting: Panel→view→Card×N→Section→Row×M→Leaf+Badge, plus a Grid
function ComplexApp({ sections = 4, rowsPerSection = 6 }) {
  const sectionList = [];
  for (let s = 0; s < sections; s++) {
    const items = [];
    for (let i = 0; i < rowsPerSection; i++) {
      items.push({ id: s * rowsPerSection + i, label: `item-${s}-${i}` });
    }
    sectionList.push(
      <Card
        key={s}
        title={`section ${s}`}
        footer={<Leaf label={`footer-${s}`} />}
      >
        <Section title={`title-${s}`} items={items} />
      </Card>,
    );
  }
  return (
    <Panel header='Complex App'>
      <view>{sectionList}</view>
      <Grid rows={3} cols={5} />
    </Panel>
  );
}

test('baseline: ComplexApp (sections=4, rowsPerSection=6)', () => {
  render(<ComplexApp sections={4} rowsPerSection={6} />);
  expect(summary()).toMatchInlineSnapshot(`
    {
      "byType": {
        "Badge": 66,
        "Card": 4,
        "ComplexApp": 1,
        "Fragment": 1,
        "Grid": 1,
        "Leaf": 28,
        "Panel": 1,
        "Row": 27,
        "Section": 4,
      },
      "total": 133,
    }
  `);
});

test('baseline: tiny tree — <Leaf/>', () => {
  render(<Leaf label='solo' />);
  expect(summary()).toMatchInlineSnapshot(`
    {
      "byType": {
        "Fragment": 1,
        "Leaf": 1,
      },
      "total": 2,
    }
  `);
});

test('baseline: Section with 10 rows', () => {
  const items = [];
  for (let i = 0; i < 10; i++) items.push({ id: i, label: `i-${i}` });
  render(<Section title='mid' items={items} />);
  expect(summary()).toMatchInlineSnapshot(`
    {
      "byType": {
        "Badge": 20,
        "Fragment": 1,
        "Leaf": 10,
        "Row": 10,
        "Section": 1,
      },
      "total": 42,
    }
  `);
});

test('baseline: Counter mount + one update', () => {
  function Counter() {
    const [n, setN] = useState(0);
    return (
      <view>
        <text bindtap={() => setN(n + 1)}>count: {n}</text>
        <Badge count={n} />
        {Array.from({ length: 5 }).map((_, i) => <Leaf key={i} label={`child-${i}-${n}`} />)}
      </view>
    );
  }

  const { container } = render(<Counter />);
  expect(summary()).toMatchInlineSnapshot(`
    {
      "byType": {
        "Badge": 1,
        "Counter": 1,
        "Fragment": 1,
        "Leaf": 5,
      },
      "total": 8,
    }
  `);

  // DELTA for one setState (tap handler). In this test env the update is
  // queued async on the BTS thread, so the synchronous delta is 0 — we
  // still pin it to catch any future behavior change.
  resetDiffCounts();
  fireEvent.tap(container.firstChild);
  expect(summary()).toMatchInlineSnapshot(`
    {
      "byType": {},
      "total": 0,
    }
  `);
});

test('baseline: total diff count scales ~linearly with tree size', () => {
  const cases = [
    { sections: 1, rowsPerSection: 4 },
    { sections: 2, rowsPerSection: 4 },
    { sections: 4, rowsPerSection: 4 },
    { sections: 4, rowsPerSection: 8 },
    { sections: 8, rowsPerSection: 8 },
  ];
  const rows = [];
  for (const c of cases) {
    resetDiffCounts();
    render(<ComplexApp {...c} />);
    const s = summary();
    rows.push({
      sections: c.sections,
      rowsPerSection: c.rowsPerSection,
      total: s.total,
      byType: s.byType,
    });
  }
  expect(rows).toMatchInlineSnapshot(`
    [
      {
        "byType": {
          "Badge": 26,
          "Card": 1,
          "ComplexApp": 1,
          "Fragment": 1,
          "Grid": 1,
          "Leaf": 5,
          "Panel": 1,
          "Row": 7,
          "Section": 1,
        },
        "rowsPerSection": 4,
        "sections": 1,
        "total": 44,
      },
      {
        "byType": {
          "Badge": 34,
          "Card": 2,
          "ComplexApp": 1,
          "Fragment": 1,
          "Grid": 1,
          "Leaf": 10,
          "Panel": 1,
          "Row": 11,
          "Section": 2,
        },
        "rowsPerSection": 4,
        "sections": 2,
        "total": 63,
      },
      {
        "byType": {
          "Badge": 50,
          "Card": 4,
          "ComplexApp": 1,
          "Fragment": 1,
          "Grid": 1,
          "Leaf": 20,
          "Panel": 1,
          "Row": 19,
          "Section": 4,
        },
        "rowsPerSection": 4,
        "sections": 4,
        "total": 101,
      },
      {
        "byType": {
          "Badge": 82,
          "Card": 4,
          "ComplexApp": 1,
          "Fragment": 1,
          "Grid": 1,
          "Leaf": 36,
          "Panel": 1,
          "Row": 35,
          "Section": 4,
        },
        "rowsPerSection": 8,
        "sections": 4,
        "total": 165,
      },
      {
        "byType": {
          "Badge": 146,
          "Card": 8,
          "ComplexApp": 1,
          "Fragment": 1,
          "Grid": 1,
          "Leaf": 72,
          "Panel": 1,
          "Row": 67,
          "Section": 8,
        },
        "rowsPerSection": 8,
        "sections": 8,
        "total": 305,
      },
    ]
  `);
});
