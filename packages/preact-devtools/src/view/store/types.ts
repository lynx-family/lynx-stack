import { Signal } from '@preact/signals';
import { InspectData } from '../../adapter/adapter/adapter';
import { createSearchStore } from './search';
import { createFilterStore } from './filter';
import { createSelectionStore } from './selection';
import { Collapser } from './collapser';
import { EmitFn, DevtoolEvents } from '../../adapter/hook';
import { ProfilerState } from '../components/profiler/data/commits';
import { PropData } from '../components/sidebar/inspect/parseProps';
import { ParsedStats } from '../../adapter/shared/stats';

export type ID = number;

export enum DevNodeType {
  /**
   * Groups are virtual nodes inserted by the devtools
   * to make certain operations easier. They are not
   * created by Preact.
   */
  Group,
  Element,
  ClassComponent,
  FunctionComponent,
  ForwardRef,
  Memo,
  Suspense,
  Context,
  Consumer,
  Portal,
}

export interface DevNode {
  id: ID;
  type: DevNodeType;
  name: string;
  key: string | null;
  owner: ID;
  parent: ID;
  children: ID[];
  /** Higher Order Component wrappers */
  hocs: string[] | null;

  // Display (Elements + Profiler)
  depth: number;

  // Raw absolute timing data.
  startTime: number;
  endTime: number;
}

export type Theme = 'auto' | 'light' | 'dark';
export enum Panel {
  ELEMENTS = 'ELEMENTS',
  PROFILER = 'PROFILER',
  SETTINGS = 'SETTINGS',
  STATISTICS = 'STATISTICS',
}

export type Tree = Map<ID, DevNode>;

export interface Store {
  supports: {
    hooks: Signal<boolean>;
  };
  stats: {
    isRecording: Signal<boolean>;
    data: Signal<ParsedStats | null>;
  };
  debugMode: Signal<boolean>;
  activePanel: Signal<Panel>;
  notify: EmitFn;
  profiler: ProfilerState;
  isPicking: Signal<boolean>;
  inspectData: Signal<InspectData | null>;
  roots: Signal<ID[]>;
  nodes: Signal<Tree>;
  nodeList: Signal<ID[]>;
  theme: Signal<Theme>;
  search: ReturnType<typeof createSearchStore>;
  filter: ReturnType<typeof createFilterStore>;
  selection: ReturnType<typeof createSelectionStore>;
  collapser: Collapser<ID>;
  sidebar: {
    props: {
      uncollapsed: Signal<string[]>;
      items: Signal<PropData[]>;
    };
    state: {
      uncollapsed: Signal<string[]>;
      items: Signal<PropData[]>;
    };
    signals: {
      uncollapsed: Signal<string[]>;
      items: Signal<PropData[]>;
    };
    context: {
      uncollapsed: Signal<string[]>;
      items: Signal<PropData[]>;
    };
    hooks: {
      uncollapsed: Signal<string[]>;
      items: Signal<PropData[]>;
    };
  };
  clear(): void;
  emit: EmitFn;
  subscribe(fn: Listener): () => void;
}

export type Listener = <K extends keyof DevtoolEvents>(
  name: K,
  data: DevtoolEvents[K],
) => void;
