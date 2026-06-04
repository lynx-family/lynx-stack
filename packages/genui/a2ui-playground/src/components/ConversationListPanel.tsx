// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useRef, useState } from 'react';

import { Button } from './Button.js';
import { MessageSquarePlus, Pencil, Share2, Trash2 } from './Icon.js';
import type { ConversationMeta } from '../storage/types.js';

interface ConversationListPanelProps {
  conversations: ConversationMeta[];
  activeId: string | null;
  disabled?: boolean;
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
    conversations,
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

  const beginEdit = (conversation: ConversationMeta) => {
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
          variant='secondary'
          size='lg'
          fullWidth
          responsiveIconOnly
          iconBefore={MessageSquarePlus}
          disabled={disabled}
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
                    disabled={disabled}
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
                  disabled={disabled || editing}
                  title='Copy share link'
                  aria-label='Share conversation'
                  onClick={() => onShare(conversation.id)}
                />
                <Button
                  variant='ghost'
                  size='sm'
                  iconOnly
                  iconBefore={Pencil}
                  disabled={disabled || editing}
                  title='Rename'
                  aria-label='Rename conversation'
                  onClick={() => beginEdit(conversation)}
                />
                <Button
                  variant='danger'
                  size='sm'
                  iconOnly
                  iconBefore={Trash2}
                  disabled={disabled || conversations.length <= 1}
                  title='Delete'
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
