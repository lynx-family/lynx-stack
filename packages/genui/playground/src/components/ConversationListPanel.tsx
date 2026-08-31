// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useRef, useState } from 'react';

import { Button } from './Button.js';
import { MessageSquarePlus, Pencil, Share2, Trash2 } from './Icon.js';

export interface ConversationListItemViewModel {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  previewText?: string;
}

export interface ConversationListActions {
  create: boolean;
  switch: boolean;
  share: boolean;
  rename: boolean;
  remove: boolean;
}

const DEFAULT_ACTIONS: ConversationListActions = {
  create: true,
  switch: true,
  share: true,
  rename: true,
  remove: true,
};

interface ConversationListPanelProps {
  conversations: ConversationListItemViewModel[];
  activeId: string | null;
  disabled?: boolean;
  actions?: ConversationListActions;
  createButtonId?: string;
  isPersistent: boolean;
  onCreate: () => void;
  onSwitch: (id: string) => void;
  onShare: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}

function formatTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function ConversationListPanel(props: ConversationListPanelProps) {
  const {
    activeId,
    actions = DEFAULT_ACTIONS,
    conversations,
    createButtonId,
    disabled = false,
    onCreate,
    onRemove,
    onRename,
    onShare,
    onSwitch,
  } = props;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const cancelRenameRef = useRef(false);

  const beginEdit = (conversation: ConversationListItemViewModel) => {
    cancelRenameRef.current = false;
    setEditingId(conversation.id);
    setDraftTitle(conversation.title);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const title = draftTitle.trim();
    if (title) onRename(editingId, title);
    setEditingId(null);
    setDraftTitle('');
  };

  const handleBlur = () => {
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      return;
    }
    commitEdit();
    cancelRenameRef.current = false;
  };

  return (
    <aside className='conversationPanel'>
      <div className='conversationPanelHeader'>
        <Button
          id={createButtonId}
          variant='secondary'
          size='lg'
          fullWidth
          responsiveIconOnly
          iconBefore={MessageSquarePlus}
          disabled={disabled || !actions.create}
          aria-label='New Chat'
          onClick={onCreate}
        >
          New Chat
        </Button>
      </div>

      <div className='conversationList'>
        {conversations.map((conversation) => {
          const active = conversation.id === activeId;
          const editing = conversation.id === editingId;
          return (
            <div
              key={conversation.id}
              data-id={conversation.id}
              className={active
                ? 'conversationListItem conversationListItem-active'
                : 'conversationListItem'}
            >
              {editing
                ? (
                  <div className='conversationListItemMain'>
                    <input
                      className='conversationRenameInput'
                      value={draftTitle}
                      autoFocus
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          cancelRenameRef.current = true;
                          commitEdit();
                        }
                        if (e.key === 'Escape') {
                          cancelRenameRef.current = true;
                          setEditingId(null);
                        }
                      }}
                      onBlur={handleBlur}
                    />
                  </div>
                )
                : (
                  <button
                    type='button'
                    className='conversationListItemMain'
                    disabled={disabled || !actions.switch}
                    onClick={() => onSwitch(conversation.id)}
                  >
                    <>
                      <span className='conversationListItemTitle'>
                        {conversation.title}
                      </span>
                      <span className='conversationListItemMeta'>
                        {formatTime(conversation.updatedAt)}
                        {conversation.messageCount > 0
                          ? ` · ${conversation.messageCount}`
                          : ''}
                      </span>
                      {conversation.previewText
                        ? (
                          <span className='conversationListItemPreview'>
                            {conversation.previewText}
                          </span>
                        )
                        : null}
                    </>
                  </button>
                )}
              <div className='conversationListItemActions'>
                <Button
                  variant='ghost'
                  size='sm'
                  iconOnly
                  iconBefore={Share2}
                  disabled={disabled || editing || !actions.share}
                  title={actions.share
                    ? 'Copy conversation link'
                    : 'Sharing is unavailable in local Agent mode'}
                  aria-label='Share conversation'
                  onClick={() => onShare(conversation.id)}
                />
                <Button
                  variant='ghost'
                  size='sm'
                  iconOnly
                  iconBefore={Pencil}
                  disabled={disabled || editing || !actions.rename}
                  title='Rename'
                  aria-label='Rename conversation'
                  onClick={() => beginEdit(conversation)}
                />
                <Button
                  variant='danger'
                  size='sm'
                  iconOnly
                  iconBefore={Trash2}
                  disabled={disabled || conversations.length <= 1
                    || !actions.remove}
                  title={actions.remove
                    ? 'Delete'
                    : 'Deleting is unavailable in local Agent mode'}
                  aria-label='Delete conversation'
                  onClick={() => onRemove(conversation.id)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
