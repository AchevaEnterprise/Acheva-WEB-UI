/**
 * Mirrors `acheva-nestjs/src/dues/`. Amounts are KOBO everywhere on the wire —
 * see `utils/naira.ts` for the only place that converts.
 */

export type DuesStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'INACTIVE';

export interface IDuesInstalment {
  readonly position: number;
  /** Kobo. */
  readonly amount: number;
  readonly dueDate: string;
  readonly note: string | null;
}

export interface IDuesConfig {
  readonly id: string;
  readonly session: string;
  readonly title: string;
  readonly description: string | null;
  /** Kobo. Always equals the sum of the instalments. */
  readonly totalAmount: number;
  readonly instalments: readonly IDuesInstalment[];
  readonly status: DuesStatus;
  readonly publishedAt: string | null;
  /**
   * Whether any student has paid against this plan. Set by the collection
   * side; this app only reads it, to explain why the money fields are locked.
   */
  readonly collectionStarted: boolean;
  readonly closedAt: string | null;
  readonly updatedAt: string | null;
}

/** Why the amounts may or may not be edited, decided server-side. */
export interface IDuesEditability {
  readonly amounts: boolean;
  readonly reason: string | null;
}

export interface IDuesPage {
  readonly session: string;
  readonly config: IDuesConfig | null;
  readonly editable: IDuesEditability;
}

/**
 * The save payload.
 *
 * Field names follow the merged `Dues` entity on the server — `name` and
 * `amount`, not `title`/`totalAmount`. The READ shape still exposes `title`
 * and `totalAmount` (the service maps them), so only this one direction has
 * to know the difference.
 */
export interface IUpsertDues {
  readonly name: string;
  readonly description?: string;
  /** KOBO. */
  readonly amount: number;
  readonly instalments: readonly {
    readonly amount: number;
    readonly dueDate: string;
    readonly note?: string;
  }[];
}
