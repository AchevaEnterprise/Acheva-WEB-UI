import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import {
  ADVISORY_TEXT,
  IImportPreview,
  IImportResolutions,
  IImportRowVerdict,
  ImportAdvisory,
} from '../../models/import-preview.model';

export interface IImportPreviewDialogData {
  readonly preview: IImportPreview;
  readonly fileName: string;
}

export interface IImportPreviewResult {
  readonly proceed: boolean;
  /** Sent straight to the import; the server applies them before classifying. */
  readonly resolutions: IImportResolutions;
}

/** One clash: the rows sharing a registration number, and the pick. */
interface DuplicateGroup {
  readonly registrationNumber: string;
  readonly nameOnRecord: string | null;
  readonly rows: readonly IImportRowVerdict[];
}

/**
 * The check a lecturer sees before any score is written.
 *
 * It exists because the alternative is finding out days later, at Send, that
 * a number was mistyped — by which point the lecturer no longer has the
 * scripts on the desk in front of them.
 *
 * Three kinds of row, and they are deliberately not presented alike:
 *
 *  - **Refused** (another department, no number at all). Nothing to decide;
 *    the row cannot be recorded here and the modal says where it belongs.
 *  - **A decision** (a name that does not match, a number appearing twice).
 *    The import stays disabled until every one is answered.
 *  - **Information** (reference, unregistered). The app already knows what
 *    these are; the lecturer is told, not asked.
 */
@Component({
  selector: 'app-import-preview-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, SvgComponent],
  templateUrl: './import-preview-dialog.component.html',
  styleUrl: './import-preview-dialog.component.scss',
})
export class ImportPreviewDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<ImportPreviewDialogComponent, IImportPreviewResult>>(
      MatDialogRef
    );
  private readonly data = inject<IImportPreviewDialogData>(MAT_DIALOG_DATA);

  readonly preview = this.data.preview;
  readonly fileName = this.data.fileName;

  /** Rows the lecturer has ticked as "the number is right". */
  private readonly confirmed = signal<ReadonlySet<number>>(new Set());
  /** Corrected numbers, keyed by row. */
  private readonly corrections = signal<ReadonlyMap<number, string>>(new Map());
  /** For each clash, the row the lecturer kept. */
  private readonly picks = signal<ReadonlyMap<string, number>>(new Map());

  // ── The three groups ──────────────────────────────────────────────────────

  /** On the class list, but the name reads like someone else. */
  readonly mismatches = computed(() =>
    this.preview.rows.filter((row) => row.needsConfirmation)
  );

  /** One number, several rows. Grouped so the choice can be put properly. */
  readonly duplicateGroups = computed<DuplicateGroup[]>(() => {
    const groups = new Map<string, IImportRowVerdict[]>();
    for (const row of this.preview.rows) {
      if (row.problem !== 'DUPLICATE_IN_FILE') continue;
      groups.set(row.registrationNumber, [
        ...(groups.get(row.registrationNumber) ?? []),
        row,
      ]);
    }
    return [...groups.entries()].map(([registrationNumber, rows]) => ({
      registrationNumber,
      nameOnRecord: rows[0]?.nameOnRecord ?? null,
      rows,
    }));
  });

  /** Cannot be recorded here at all, and no tick will change that. */
  readonly refused = computed(() =>
    this.preview.rows.filter(
      (row) =>
        row.problem === 'DIFFERENT_DEPARTMENT' ||
        row.problem === 'MISSING_REGISTRATION_NUMBER' ||
        row.problem === 'NOT_YOUR_STUDENT' ||
        row.problem === 'NOT_ON_YOUR_LIST'
    )
  );

  readonly referenceRows = computed(() =>
    this.preview.rows.filter((row) => row.category === 'REFERENCE')
  );

  readonly unregisteredRows = computed(() =>
    this.preview.rows.filter((row) => row.category === 'UNREGISTERED')
  );

  readonly isBackfill = this.preview.isBackfill;

  advisoriesFor(row: IImportRowVerdict): readonly ImportAdvisory[] {
    return this.preview.advisories?.[row.rowNumber] ?? [];
  }

  advisoryText(advisory: ImportAdvisory): string {
    return ADVISORY_TEXT[advisory];
  }

  /** Rows carrying anything worth a second look before they are recorded. */
  readonly flagged = computed(() =>
    this.preview.rows.filter(
      (row) => row.problem === null && this.advisoriesFor(row).length > 0
    )
  );

  // ── Decisions ─────────────────────────────────────────────────────────────

  isResolved(row: IImportRowVerdict): boolean {
    return (
      this.confirmed().has(row.rowNumber) ||
      this.corrections().has(row.rowNumber)
    );
  }

  correctionFor(row: IImportRowVerdict): string {
    return this.corrections().get(row.rowNumber) ?? '';
  }

  /**
   * Whose number the lecturer just typed, checked against the class list the
   * preview returned. Answered locally so a correction feels immediate; the
   * server still classifies for real when the import runs.
   */
  matchForCorrection(row: IImportRowVerdict): string | null {
    const typed = normalise(this.corrections().get(row.rowNumber) ?? '');
    if (!typed) return null;
    const member = this.preview.classList.find(
      (student) => normalise(student.registrationNumber) === typed
    );
    return member ? member.fullName : null;
  }

  confirm(row: IImportRowVerdict): void {
    this.confirmed.update((set) => new Set(set).add(row.rowNumber));
    this.corrections.update((map) => {
      const next = new Map(map);
      next.delete(row.rowNumber);
      return next;
    });
  }

  correct(row: IImportRowVerdict, value: string): void {
    this.corrections.update((map) => new Map(map).set(row.rowNumber, value));
    this.confirmed.update((set) => {
      const next = new Set(set);
      next.delete(row.rowNumber);
      return next;
    });
  }

  pick(registrationNumber: string, rowNumber: number): void {
    this.picks.update((map) => new Map(map).set(registrationNumber, rowNumber));
  }

  pickedRow(registrationNumber: string): number | null {
    return this.picks().get(registrationNumber) ?? null;
  }

  // ── Gate ──────────────────────────────────────────────────────────────────

  readonly outstanding = computed(
    () =>
      this.mismatches().filter((row) => !this.isResolved(row)).length +
      this.duplicateGroups().filter(
        (group) => this.pickedRow(group.registrationNumber) === null
      ).length
  );

  readonly canImport = computed(() => this.outstanding() === 0);

  /**
   * How many rows will actually be recorded — every row, less those refused
   * outright, less the losing side of each clash.
   *
   * Stated on the button because a count that does not reconcile with the file
   * is how a lost score goes unnoticed.
   */
  readonly willImport = computed(() => {
    const duplicateRows = this.duplicateGroups().reduce(
      (total, group) => total + group.rows.length,
      0
    );
    const keptFromClashes = this.duplicateGroups().filter(
      (group) => this.pickedRow(group.registrationNumber) !== null
    ).length;
    return (
      this.preview.totalRows -
      this.refused().length -
      duplicateRows +
      keptFromClashes
    );
  });

  proceed(): void {
    if (!this.canImport()) return;

    // Corrections are keyed by row so the server can apply them BEFORE it
    // classifies — a fixed number must be judged on its merits, not on what
    // the file originally said.
    const corrections: Record<number, string> = {};
    for (const [rowNumber, value] of this.corrections()) {
      const trimmed = value.trim();
      if (trimmed) corrections[rowNumber] = trimmed;
    }

    this.dialogRef.close({
      proceed: true,
      resolutions: {
        corrections,
        chosenRows: [...this.picks().values()],
      },
    });
  }

  cancel(): void {
    this.dialogRef.close({ proceed: false, resolutions: {} });
  }

  /** Scores as the sheet shows them, for telling two clashing rows apart. */
  scoreLine(row: IImportRowVerdict): string {
    const s = row.scores;
    if (!s) return '';
    const part = (label: string, value: number | null) =>
      value === null ? null : `${label} ${value}`;
    return [
      part('Test', s.test),
      part('Lab', s.lab),
      part('Exam', s.exam),
      part('Total', s.total),
    ]
      .filter(Boolean)
      .join(' · ');
  }
}

function normalise(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
