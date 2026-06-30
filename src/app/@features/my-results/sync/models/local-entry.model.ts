/**
 * Local-first score entry model.
 *
 * A row's RAW INPUTS (test/lab/exam) are the authoritative local data the moment
 * a lecturer types them — they live durably in IndexedDB before any network call.
 * The DERIVED values (total/grade/status) are computed locally only for instant
 * display and are replaced by the server's authoritative values once the row
 * syncs (the backend is the single source of truth for derived values).
 */

/**
 * - `local`   — saved durably on the device but incomplete, so not yet sent.
 * - `dirty`   — complete and queued to sync.
 * - `syncing` — currently being sent.
 * - `synced`  — confirmed and computed by the server.
 * - `error`   — a sync attempt failed; will retry.
 */
export type SyncStatus = 'local' | 'dirty' | 'syncing' | 'synced' | 'error';

export type ResultCategory = 'REGULAR' | 'REFERENCE' | 'UNREGISTERED';

export interface ILocalResultEntry {
  /** Composite primary key — `${resultId}:${registrationNumber}` (stable, never positional). */
  key: string;
  resultId: string;
  category: ResultCategory;
  registrationNumber: string;
  fullName: string;

  // Raw inputs — the local source of truth until synced.
  test: number | null;
  lab: number | null;
  exam: number | null;

  // Derived — optimistic locally, overwritten by the server on sync.
  total: number | null;
  grade: string | null;
  status: string | null;

  syncStatus: SyncStatus;
  syncError?: string | null;

  /** The server entry's `_id`, captured on first sync — needed to delete it. */
  serverId?: string | null;
  /** Set when a previously-synced row was cleared and must be deleted server-side. */
  pendingDelete?: boolean;

  /** Local logical version, bumped on every edit; used to detect mid-sync edits. */
  updatedAt: number;
}

/** Minimal shape we read back from the server's bulk-entry response. */
export interface IServerResultEntry {
  _id: string;
  registrationNumber: string;
  total: number;
  grade: string;
  status: string;
}
