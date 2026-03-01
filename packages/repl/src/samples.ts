// UI Tree
import uiTreeCreatingElements from './examples/ui-tree-creating-elements/main-thread.js?raw';
import uiTreeTreeMutations from './examples/ui-tree-tree-mutations/main-thread.js?raw';
import uiTreeTreeTraversal from './examples/ui-tree-tree-traversal/main-thread.js?raw';

// Styling
import stylingInlineStyles from './examples/styling-inline-styles/main-thread.js?raw';
import stylingCssClassesMain from './examples/styling-css-classes-and-scoping/main-thread.js?raw';
import stylingCssClassesCss from './examples/styling-css-classes-and-scoping/index.css?raw';

// Interactivity
import interactivityEventMain from './examples/interactivity-event-handling/main-thread.js?raw';
import interactivityEventBg from './examples/interactivity-event-handling/background.js?raw';
import interactivitySelectorQuery from './examples/interactivity-selector-query/main-thread.js?raw';

// Attributes & Data
import attributesSetAndGet from './examples/attributes-set-and-get/main-thread.js?raw';
import attributesDataset from './examples/attributes-dataset/main-thread.js?raw';

// Threading
import threadingCrossThreadMain from './examples/threading-cross-thread/main-thread.js?raw';
import threadingCrossThreadBg from './examples/threading-cross-thread/background.js?raw';

// Lifecycle & Scheduling
import lifecycleRenderMain from './examples/lifecycle-render/main-thread.js?raw';
import lifecycleRenderBg from './examples/lifecycle-render/background.js?raw';
import lifecycleRaf from './examples/lifecycle-raf/main-thread.js?raw';
import lifecycleEvents from './examples/lifecycle-events/main-thread.js?raw';

// List Virtualization
import listVirtualization from './examples/list-virtualization/main-thread.js?raw';

// Demos
import demoCounterMain from './examples/demo-background-counter/main-thread.js?raw';
import demoCounterBg from './examples/demo-background-counter/background.js?raw';
import demoDataListMain from './examples/demo-data-driven-list/main-thread.js?raw';
import demoDataListBg from './examples/demo-data-driven-list/background.js?raw';

export interface Sample {
  name: string;
  mainThread: string;
  background: string;
  css: string;
  /** Optional category label shown in the dropdown */
  category?: string;
  /** Set to true to hide this example from the dropdown */
  hidden?: boolean;
}

// ---------------------------------------------------------------------------
// Configuration:
//   - Array order = dropdown order
//   - Set hidden: true to hide an example from the UI
//   - category groups examples visually in the dropdown via <optgroup>
// ---------------------------------------------------------------------------

export const samples: Sample[] = [
  // ── Demos ───────────────────────────────────────────────────────────────
  {
    name: 'Background-Driven Counter',
    category: 'Demos',
    mainThread: demoCounterMain,
    background: demoCounterBg,
    css: '',
  },
  {
    name: 'Data-Driven List',
    category: 'Demos',
    mainThread: demoDataListMain,
    background: demoDataListBg,
    css: '',
  },

  // ── UI Tree ─────────────────────────────────────────────────────────────
  {
    name: 'Creating Elements',
    category: 'UI Tree',
    mainThread: uiTreeCreatingElements,
    background: '',
    css: '',
  },
  {
    name: 'Tree Mutations',
    category: 'UI Tree',
    mainThread: uiTreeTreeMutations,
    background: '',
    css: '',
  },
  {
    name: 'Tree Traversal',
    category: 'UI Tree',
    mainThread: uiTreeTreeTraversal,
    background: '',
    css: '',
  },

  // ── Styling ─────────────────────────────────────────────────────────────
  {
    name: 'Inline Styles',
    category: 'Styling',
    mainThread: stylingInlineStyles,
    background: '',
    css: '',
  },
  {
    name: 'CSS Classes & Scoping',
    category: 'Styling',
    mainThread: stylingCssClassesMain,
    background: '',
    css: stylingCssClassesCss,
  },

  // ── Interactivity ───────────────────────────────────────────────────────
  {
    name: 'Event Handling',
    category: 'Interactivity',
    mainThread: interactivityEventMain,
    background: interactivityEventBg,
    css: '',
  },
  {
    name: 'SelectorQuery & Measurement',
    category: 'Interactivity',
    mainThread: interactivitySelectorQuery,
    background: '',
    css: '',
  },

  // ── Attributes & Data ──────────────────────────────────────────────────
  {
    name: 'SetAttribute & GetAttribute',
    category: 'Attributes & Data',
    mainThread: attributesSetAndGet,
    background: '',
    css: '',
  },
  {
    name: 'Dataset',
    category: 'Attributes & Data',
    mainThread: attributesDataset,
    background: '',
    css: '',
  },

  // ── Threading ───────────────────────────────────────────────────────────
  {
    name: 'Cross-Thread Communication',
    category: 'Threading',
    mainThread: threadingCrossThreadMain,
    background: threadingCrossThreadBg,
    css: '',
  },

  // ── Lifecycle & Scheduling ─────────────────────────────────────────────
  {
    name: 'renderPage & updatePage',
    category: 'Lifecycle',
    mainThread: lifecycleRenderMain,
    background: lifecycleRenderBg,
    css: '',
  },
  {
    name: 'requestAnimationFrame',
    category: 'Lifecycle',
    mainThread: lifecycleRaf,
    background: '',
    css: '',
  },
  {
    name: 'OnLifecycleEvent',
    category: 'Lifecycle',
    mainThread: lifecycleEvents,
    background: '',
    css: '',
  },

  // ── List Virtualization ────────────────────────────────────────────────
  {
    name: 'Virtualized List',
    category: 'List',
    mainThread: listVirtualization,
    background: '',
    css: '',
  },
];
