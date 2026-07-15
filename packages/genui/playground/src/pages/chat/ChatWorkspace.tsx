// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  CSSProperties,
  ComponentProps,
  ReactNode,
  Ref,
  UIEventHandler,
} from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import { ConversationListPanel } from '../../components/ConversationListPanel.js';
import { CopyToast } from '../../components/CopyToast.js';
import { MobileTabBar } from '../../components/MobileTabBar.js';
import type { MobilePaneTab } from '../../components/MobileTabBar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { PanelResizeHandle } from '../../components/PanelResizeHandle.js';
import { PreviewPanel } from '../../components/PreviewPanel.js';

import './ChatPage.css';

export type ChatWorkspaceConversationProps = ComponentProps<
  typeof ConversationListPanel
>;

export type ChatWorkspacePreviewProps =
  & Omit<
    ComponentProps<typeof PreviewPanel>,
    'className' | 'style'
  >
  & {
    className?: string;
  };

export type ChatWorkspaceResizeHandleProps = Pick<
  ComponentProps<typeof PanelResizeHandle>,
  'ariaLabel' | 'onPointerDown' | 'title'
>;

export interface ChatWorkspaceHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  topContent?: ReactNode;
}

export interface ChatWorkspaceDeleteConfirmation {
  open: boolean;
  conversationTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface ChatWorkspaceProps {
  pageRef: Ref<HTMLDivElement>;
  pageClassName?: string;
  isPanelResizing: boolean;
  isCompactLayout: boolean;
  activeMobileTab: MobilePaneTab;
  onMobileTabChange: (tab: MobilePaneTab) => void;
  mobileEditLabel?: string;
  copyToast: ComponentProps<typeof CopyToast>['toast'];
  deleteConfirmation: ChatWorkspaceDeleteConfirmation;
  conversation: ChatWorkspaceConversationProps;
  header: ChatWorkspaceHeaderProps;
  messagesRef?: Ref<HTMLDivElement>;
  onMessagesScroll?: UIEventHandler<HTMLDivElement>;
  messages: ReactNode;
  composer: ReactNode;
  chatPanelStyle?: CSSProperties;
  previewPanelStyle?: CSSProperties;
  resizeHandle: ChatWorkspaceResizeHandleProps;
  preview: ChatWorkspacePreviewProps;
}

function joinClassNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ');
}

export function ChatWorkspace(props: ChatWorkspaceProps) {
  const {
    activeMobileTab,
    chatPanelStyle,
    composer,
    conversation,
    copyToast,
    deleteConfirmation,
    header,
    isCompactLayout,
    isPanelResizing,
    messages,
    messagesRef,
    mobileEditLabel = 'Chat',
    onMessagesScroll,
    onMobileTabChange,
    pageClassName,
    pageRef,
    preview,
    previewPanelStyle,
    resizeHandle,
  } = props;
  const {
    children: previewContent,
    className: previewClassName,
    ...previewPanelProps
  } = preview;

  return (
    <div
      ref={pageRef}
      className={joinClassNames(
        'chatPage',
        pageClassName,
        isPanelResizing && 'resizing',
      )}
      data-active-tab={activeMobileTab}
    >
      <CopyToast toast={copyToast} />
      <ConfirmDialog
        open={deleteConfirmation.open}
        title='Delete conversation?'
        description={`"${deleteConfirmation.conversationTitle}" will be removed from this browser. This cannot be undone.`}
        confirmLabel='Delete'
        cancelLabel='Keep'
        tone='danger'
        onCancel={deleteConfirmation.onCancel}
        onConfirm={deleteConfirmation.onConfirm}
      />

      <div className='chatPageBody'>
        <ConversationListPanel {...conversation} />

        <div className='chatPanel' style={chatPanelStyle}>
          <PageHeader
            className='chatHeader'
            titleClassName='chatHeaderTitle'
            descriptionClassName='chatHeaderSub'
            title={header.title}
            description={header.description}
            topContent={header.topContent}
          />

          <div
            className='chatMessages'
            ref={messagesRef}
            onScroll={onMessagesScroll}
          >
            {messages}
          </div>

          <div className='chatInputArea'>{composer}</div>
        </div>

        <PanelResizeHandle
          {...resizeHandle}
          isActive={isPanelResizing}
          isCompactLayout={isCompactLayout}
        />

        <PreviewPanel
          {...previewPanelProps}
          className={joinClassNames('previewPanel', previewClassName)}
          style={previewPanelStyle}
        >
          {previewContent}
        </PreviewPanel>
      </div>

      <MobileTabBar
        activeTab={activeMobileTab}
        onChange={onMobileTabChange}
        editLabel={mobileEditLabel}
      />
    </div>
  );
}
