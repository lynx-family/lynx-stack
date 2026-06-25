// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

import type {
  ConversationMeta,
  DataModelSnapshot,
  MetaRecord,
  PersistedMessage,
} from './types.js';

interface A2UIPlaygroundDB extends DBSchema {
  conversations: {
    key: string;
    value: ConversationMeta;
    indexes: {
      by_updatedAt: number;
    };
  };
  messages: {
    key: [string, number];
    value: PersistedMessage;
    indexes: {
      by_conversation: string;
    };
  };
  snapshots: {
    key: string;
    value: DataModelSnapshot;
  };
  meta: {
    key: string;
    value: MetaRecord;
  };
}

const DB_NAME = 'a2ui-playground';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<A2UIPlaygroundDB>> | null = null;

function closeCurrentConnection() {
  const current = dbPromise;
  dbPromise = null;
  void current?.then((db) => {
    db.close();
  }).catch(() => {
    // The original open failed; there is no live connection to release.
  });
}

export function getDB(): Promise<IDBPDatabase<A2UIPlaygroundDB>> {
  dbPromise ??= openDB<A2UIPlaygroundDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const conversations = db.createObjectStore('conversations', {
          keyPath: 'id',
        });
        conversations.createIndex('by_updatedAt', 'updatedAt');

        const messages = db.createObjectStore('messages', {
          keyPath: ['conversationId', 'seq'],
        });
        messages.createIndex('by_conversation', 'conversationId');

        db.createObjectStore('snapshots', { keyPath: 'conversationId' });
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    },
    blocked() {
      console.warn('[a2ui] IndexedDB upgrade blocked by another tab');
    },
    blocking() {
      closeCurrentConnection();
    },
  });

  return dbPromise;
}
