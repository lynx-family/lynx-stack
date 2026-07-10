// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror';

import type { PreviewPanelSource } from '../../components/PreviewPanel.js';
import type { Protocol } from '../../utils/protocol.js';

/** Shared contracts for the protocol-specific demos page sources. */
export interface DemoPageScenario {
  id: string;
  title: string;
  badge?: string;
}

export interface DemoEditorView<
  TScenario extends DemoPageScenario,
> {
  id: string;
  label: string;
  title: string;
  editable: boolean;
  getValue: (args: {
    editorValue: string;
    scenario?: TScenario;
  }) => string;
}

export interface DemoCommit<
  TPreviewInput,
  TChunk,
  TMeta,
> {
  previewInput: TPreviewInput;
  playbackChunks: TChunk[];
  meta: TMeta;
}

export type DemoCommitResult<
  TPreviewInput,
  TChunk,
  TMeta,
> =
  | { error: string }
  | { value: DemoCommit<TPreviewInput, TChunk, TMeta> };

export interface DemosPageSource<
  TScenario extends DemoPageScenario,
  TPreviewInput,
  TChunk,
  TMeta,
> {
  scenarios: readonly TScenario[];
  findScenario: (id?: string) => TScenario | undefined;
  getEditorValue: (scenario: TScenario) => string;
  createScenarioPreviewInput: (scenario: TScenario) => TPreviewInput;
  commit: (args: {
    editorValue: string;
    editorEdited: boolean;
    scenario?: TScenario;
  }) => DemoCommitResult<TPreviewInput, TChunk, TMeta>;
  shouldPreparePreview?: (
    commit: DemoCommit<TPreviewInput, TChunk, TMeta>,
  ) => boolean;
  preparePreviewInput?: (
    commit: DemoCommit<TPreviewInput, TChunk, TMeta>,
  ) => Promise<TPreviewInput>;
  createPreviewSource: (args: {
    input: TPreviewInput;
    isPlaybackActive: boolean;
    protocol: Protocol;
    theme: 'light' | 'dark';
  }) => PreviewPanelSource;
  formatPlaybackChunk: (chunk: TChunk) => string;
  emptyEditorValue: string;
  emptyPlaybackError: string;
  resetPlaybackOnFill?: boolean;
  editor: {
    title: string;
    badge?: string;
    toolbarClassName?: string;
    titleClassName?: string;
    titleTextClassName?: string;
    actionsClassName?: string;
    editorClassName?: string;
    iconOnlyActions?: boolean;
    renderPendingLabel?: string;
    extensions?: ReactCodeMirrorProps['extensions'];
    basicSetup: ReactCodeMirrorProps['basicSetup'];
    views?: readonly DemoEditorView<TScenario>[];
    defaultView?: string;
    splitterAriaLabel: string;
    panelResizeAriaLabel: string;
    emptyPreviewTitle: string;
  };
}
