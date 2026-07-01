import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ICreateResultEntry } from '../../result-management/models/results.model';
import { ResultsService } from '../../result-management/services/results.service';
import {
  ILocalResultEntry,
  IServerResultEntry,
} from './models/local-entry.model';
import { ResultEntryStore } from './result-entry-store.service';

/** Durability already happened on edit; this debounce only batches the network. */
const BATCH_DEBOUNCE_MS = 1200;
const INITIAL_RETRY_MS = 2000;
const MAX_RETRY_MS = 30000;

/**
 * Background sync engine (the "sync to cloud" layer). Drains locally-saved rows
 * to the server, retries with backoff, pauses while offline and resumes when the
 * connection returns. The server's response is written back as the authoritative
 * total/grade/status, so a synced row is also a server-validated row. Rows that
 * were cleared after being synced are deleted on the server.
 */
@Injectable({ providedIn: 'root' })
export class ResultSyncService {
  private readonly store = inject(ResultEntryStore);
  private readonly resultsService = inject(ResultsService);

  readonly online = signal<boolean>(navigator.onLine);
  readonly pendingCount = signal<number>(0);
  readonly failedCount = signal<number>(0);
  readonly syncing = signal<boolean>(false);
  /** Bumped whenever any row's stored status changes, so views can refresh. */
  readonly lastChange = signal<number>(0);

  private activeResultId: string | null = null;
  private inFlight = false;
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = INITIAL_RETRY_MS;

  constructor() {
    window.addEventListener('online', () => {
      this.online.set(true);
      void this.flush();
    });
    window.addEventListener('offline', () => this.online.set(false));
  }

  /** Bind the engine to the result being edited and drain any leftovers. */
  setActiveResult(resultId: string): void {
    this.activeResultId = resultId;
    void this.refreshCounts();
    void this.flush();
  }

  /**
   * Persist one edited row locally (durable) then schedule a background sync.
   * A row cleared to all-empty is either deleted server-side (if it was synced)
   * or simply dropped locally (if it never reached the server).
   */
  async saveLocal(entry: ILocalResultEntry): Promise<void> {
    const existing = await this.store.get(entry.key);
    const serverId = existing?.serverId ?? entry.serverId ?? null;

    const allEmpty =
      entry.test === null && entry.lab === null && entry.exam === null;

    if (allEmpty) {
      if (serverId) {
        await this.store.put({
          ...entry,
          serverId,
          total: null,
          grade: null,
          status: null,
          pendingDelete: true,
          syncStatus: 'dirty',
        });
      } else {
        await this.store.delete(entry.key);
      }
    } else {
      await this.store.put({ ...entry, serverId, pendingDelete: false });
    }

    await this.refreshCounts();
    this.scheduleFlush();
  }

  retryNow(): void {
    this.retryDelay = INITIAL_RETRY_MS;
    void this.flush();
  }

  private scheduleFlush(): void {
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = setTimeout(() => void this.flush(), BATCH_DEBOUNCE_MS);
  }

  private scheduleRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_MS);
      void this.flush();
    }, this.retryDelay);
  }

  private async flush(): Promise<void> {
    if (!this.activeResultId || this.inFlight || !navigator.onLine) return;

    const pending = await this.store.getPendingByResult(this.activeResultId);
    if (pending.length === 0) {
      this.syncing.set(false);
      return;
    }

    this.inFlight = true;
    this.syncing.set(true);

    const deletes = pending.filter((e) => e.pendingDelete);
    const upserts = pending.filter((e) => !e.pendingDelete);

    let hadError = false;
    hadError = (await this.processDeletes(deletes)) || hadError;
    hadError = (await this.processUpserts(upserts)) || hadError;

    this.inFlight = false;
    await this.refreshCounts();

    if (hadError) {
      this.scheduleRetry();
    } else {
      this.retryDelay = INITIAL_RETRY_MS;
      const remaining = await this.store.getPendingByResult(
        this.activeResultId
      );
      if (remaining.length > 0) void this.flush(); // edited during round-trip
    }
  }

  private async processDeletes(deletes: ILocalResultEntry[]): Promise<boolean> {
    let hadError = false;
    for (const e of deletes) {
      if (!e.serverId) {
        await this.store.delete(e.key);
        continue;
      }
      try {
        await firstValueFrom(this.resultsService.deleteResultEntry(e.serverId));
        // If it was re-edited during the delete, keep the fresh edit.
        const current = await this.store.get(e.key);
        if (current && current.updatedAt === e.updatedAt) {
          await this.store.delete(e.key);
        }
      } catch {
        await this.store.put({
          ...e,
          syncStatus: 'error',
          syncError: 'Delete not synced — will retry',
        });
        hadError = true;
      }
    }
    return hadError;
  }

  private async processUpserts(upserts: ILocalResultEntry[]): Promise<boolean> {
    if (upserts.length === 0) return false;

    // Snapshot versions so we never mark a row synced if it was edited mid-flight.
    const snapshot = new Map(upserts.map((e) => [e.key, e.updatedAt]));
    await this.store.bulkPut(
      upserts.map((e) => ({ ...e, syncStatus: 'syncing' as const }))
    );
    await this.refreshCounts();

    const payload: ICreateResultEntry[] = upserts.map((e) => ({
      registrationNumber: e.registrationNumber,
      fullName: e.fullName,
      test: e.test ?? 0,
      lab: e.lab ?? 0,
      exam: e.exam ?? 0,
      total: e.total ?? 0,
      result: e.resultId,
      category: e.category,
    }));

    try {
      const resp = await firstValueFrom(
        this.resultsService.createBulkResultEntries(payload)
      );
      const serverEntries = (resp.data as IServerResultEntry[]) ?? [];
      const byReg = new Map(
        serverEntries.map((s) => [s.registrationNumber, s])
      );

      await this.store.bulkPut(
        await this.reconcile(upserts, snapshot, (current) => {
          const srv = byReg.get(current.registrationNumber);
          return {
            ...current,
            serverId: srv?._id ?? current.serverId ?? null,
            total: srv?.total ?? current.total,
            grade: srv?.grade ?? current.grade,
            status: srv?.status ?? current.status,
            syncStatus: 'synced',
            syncError: null,
          };
        })
      );
      return false;
    } catch {
      await this.store.bulkPut(
        await this.reconcile(upserts, snapshot, (current) => ({
          ...current,
          syncStatus: 'error',
          syncError: 'Not synced yet — will retry automatically',
        }))
      );
      return true;
    }
  }

  /**
   * Apply a resolution to each row, EXCEPT rows that changed while syncing —
   * those revert to `dirty` so the fresh edit is re-sent and never lost.
   */
  private async reconcile(
    pending: ILocalResultEntry[],
    snapshot: Map<string, number>,
    resolve: (current: ILocalResultEntry) => ILocalResultEntry
  ): Promise<ILocalResultEntry[]> {
    const updates: ILocalResultEntry[] = [];
    for (const e of pending) {
      const current = await this.store.get(e.key);
      if (!current) continue;
      if (current.updatedAt !== snapshot.get(e.key)) {
        updates.push({ ...current, syncStatus: 'dirty' });
      } else {
        updates.push(resolve(current));
      }
    }
    return updates;
  }

  private async refreshCounts(): Promise<void> {
    if (!this.activeResultId) return;
    const all = await this.store.getByResult(this.activeResultId);
    this.pendingCount.set(
      all.filter((e) => e.syncStatus === 'dirty' || e.syncStatus === 'syncing')
        .length
    );
    this.failedCount.set(all.filter((e) => e.syncStatus === 'error').length);
    this.lastChange.update((v) => v + 1);
  }
}
