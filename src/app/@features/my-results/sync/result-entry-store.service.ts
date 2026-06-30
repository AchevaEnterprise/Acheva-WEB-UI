import { Injectable } from '@angular/core';
import { DBSchema, IDBPDatabase, openDB } from 'idb';

import { ILocalResultEntry } from './models/local-entry.model';

const DB_NAME = 'acheva-results';
const DB_VERSION = 1;
const STORE = 'entries';

interface AchevaResultsDB extends DBSchema {
  entries: {
    key: string;
    value: ILocalResultEntry;
    indexes: { byResult: string };
  };
}

/**
 * Durable local store for in-progress score entries (the "save to disk" layer).
 * Backed by IndexedDB so a row survives reloads, crashes, and power loss before
 * it has ever reached the server.
 */
@Injectable({ providedIn: 'root' })
export class ResultEntryStore {
  private dbPromise: Promise<IDBPDatabase<AchevaResultsDB>> | null = null;

  static buildKey(resultId: string, registrationNumber: string): string {
    return `${resultId}:${registrationNumber}`;
  }

  private getDb(): Promise<IDBPDatabase<AchevaResultsDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<AchevaResultsDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: 'key' });
            store.createIndex('byResult', 'resultId');
          }
        },
      });
    }
    return this.dbPromise;
  }

  async put(entry: ILocalResultEntry): Promise<void> {
    const db = await this.getDb();
    await db.put(STORE, entry);
  }

  async bulkPut(entries: ILocalResultEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const db = await this.getDb();
    const tx = db.transaction(STORE, 'readwrite');
    await Promise.all([...entries.map((e) => tx.store.put(e)), tx.done]);
  }

  async get(key: string): Promise<ILocalResultEntry | undefined> {
    const db = await this.getDb();
    return db.get(STORE, key);
  }

  async getByResult(resultId: string): Promise<ILocalResultEntry[]> {
    const db = await this.getDb();
    return db.getAllFromIndex(STORE, 'byResult', resultId);
  }

  /** Rows that still need to reach the server (never-sent or failed). */
  async getPendingByResult(resultId: string): Promise<ILocalResultEntry[]> {
    const all = await this.getByResult(resultId);
    return all.filter(
      (e) => e.syncStatus === 'dirty' || e.syncStatus === 'error'
    );
  }

  async delete(key: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(STORE, key);
  }
}
