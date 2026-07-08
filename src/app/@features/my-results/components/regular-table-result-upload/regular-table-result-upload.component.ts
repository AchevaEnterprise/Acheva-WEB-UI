import { TitleCasePipe } from '@angular/common';
import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute } from '@angular/router';

import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../../../@shared/components/status-badge/status-badge.component';
import { IStudentGrade } from '../../../students/models/student.model';
import {
  ILocalResultEntry,
  SyncStatus,
} from '../../sync/models/local-entry.model';
import { ResultEntryStore } from '../../sync/result-entry-store.service';
import { ResultSyncService } from '../../sync/result-sync.service';

type GradeColumn = 'test' | 'lab' | 'exam';

@Component({
  selector: 'app-regular-table-result-upload',
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    StatusBadgeComponent,
    EmptyStateComponent,
  ],
  templateUrl: './regular-table-result-upload.component.html',
  styleUrl: './regular-table-result-upload.component.scss',
  exportAs: 'regularTableResultUploadRef',
  providers: [TitleCasePipe],
})
export class RegularTableResultUploadComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly titlecasePipe = inject(TitleCasePipe);
  private readonly host = inject(ElementRef);
  private readonly store = inject(ResultEntryStore);
  private readonly sync = inject(ResultSyncService);

  students = input<Partial<IStudentGrade>[]>([]);
  searchValue = input<string | null>(null);
  refreshTable = input<boolean>(false);
  /** The result these entries belong to — enables local-first persistence. */
  resultId = input<string>('');
  /** When true the grade inputs render as read-only text (no editing). */
  readonly = input<boolean>(false);

  /**
   * Registration gating (Slice 4): when non-null, rows whose student is NOT
   * in this list are disabled and sorted to the bottom until the lecturer
   * explicitly enables them. `null` = no registration data → no gating.
   */
  registeredRegNos = input<string[] | null>(null);

  /** Kept for back-compat with the parent's "unsaved changes" guard. */
  hasChangesEvent = output<boolean>();

  /** Lecturer enabled an unregistered student's row — parent audits + notifies CA. */
  overrideEvent = output<{ registrationNumber: string; fullName: string }>();

  /** Rows the lecturer has explicitly enabled despite being unregistered. */
  private readonly overridden = signal<ReadonlySet<string>>(new Set());

  /** Bumped when hydration rewrites row values so the display recomputes. */
  private readonly displayRefresh = signal(0);

  allRows = signal<FormGroup[]>([]);
  dataSource = signal<FormGroup[]>([]);

  readonly status: string = this.route.snapshot.queryParamMap.get('status')!;
  readonly displayedColumns = [
    'sn',
    'registrationNumber',
    'fullName',
    'test',
    'lab',
    'exam',
    'total',
    'grade',
    'status',
  ];

  form = this.fb.group({
    rows: this.fb.array<FormGroup>([]),
  });

  private readonly GRADE_COLUMNS: readonly GradeColumn[] = [
    'test',
    'lab',
    'exam',
  ];

  /** Last value a score cell held before the current keystroke, for clean undo. */
  private readonly lastAccepted = new Map<AbstractControl, number | null>();

  constructor() {
    // Build rows when students arrive, then hydrate from the durable store.
    effect(() => {
      const students = this.students();
      const refresh = this.refreshTable();

      if (refresh) {
        this.initializeFormRows(students);
        void this.hydrateAndActivate();
      } else if (students?.length > 0 && this.rows.length === 0) {
        this.initializeFormRows(students);
        void this.hydrateAndActivate();
      }
    });

    // Registration gating: flag + disable unregistered rows. Touches form
    // controls only (never signals) so it cannot loop; readonly/non-DRAFT
    // tables keep their existing behaviour untouched.
    effect(() => {
      const regNos = this.registeredRegNos();
      const overridden = this.overridden();
      const rows = this.allRows();
      if (rows.length === 0 || !regNos) return;

      const baseEditable =
        !this.readonly() && (!this.status || this.status === 'DRAFT');

      const registered = new Set(regNos);
      for (const row of rows) {
        const regNo = String(row.getRawValue().registrationNumber ?? '');
        const gated = !registered.has(regNo) && !overridden.has(regNo);
        row.patchValue({ unregistered: gated }, { emitEvent: false });
        if (!baseEditable) continue;
        for (const column of this.GRADE_COLUMNS) {
          const ctrl = row.get(column);
          if (!ctrl) continue;
          if (gated && ctrl.enabled) ctrl.disable({ emitEvent: false });
          if (!gated && ctrl.disabled) ctrl.enable({ emitEvent: false });
        }
      }
    });

    // Display: search filter + registered-first ordering (gated rows sink to
    // the bottom when registration data exists).
    effect(() => {
      this.displayRefresh(); // re-run after hydration rewrites
      const term = (this.searchValue() ?? '').trim().toLowerCase();
      const regNos = this.registeredRegNos();
      const overridden = this.overridden();
      const rows = this.allRows();

      const filtered = !term
        ? rows
        : rows.filter((row) => {
            const { registrationNumber, fullName } =
              row.getRawValue() as Partial<IStudentGrade>;
            return (
              registrationNumber?.toLowerCase().includes(term) ||
              fullName?.toLowerCase().includes(term)
            );
          });

      if (!regNos) {
        this.dataSource.set(filtered);
        return;
      }

      const registered = new Set(regNos);
      const gatedRank = (row: FormGroup): number => {
        const regNo = String(row.getRawValue().registrationNumber ?? '');
        return registered.has(regNo) || overridden.has(regNo) ? 0 : 1;
      };
      this.dataSource.set(
        [...filtered].sort((a, b) => {
          const rankDiff = gatedRank(a) - gatedRank(b);
          if (rankDiff !== 0) return rankDiff;
          return String(a.getRawValue().fullName ?? '').localeCompare(
            String(b.getRawValue().fullName ?? '')
          );
        })
      );
    });
  }

  get rows(): FormArray<FormGroup> {
    return this.form.get('rows') as FormArray<FormGroup>;
  }

  private initializeFormRows(students: Partial<IStudentGrade>[]): void {
    this.rows.clear({ emitEvent: false });

    const sorted = [...students].sort((a, b) =>
      (a.fullName ?? '').localeCompare(b.fullName ?? '')
    );

    sorted
      .map((stu) => this.buildStudentRow(stu))
      .forEach((row) => this.rows.push(row, { emitEvent: false }));

    this.rows.markAsPristine();
    this.allRows.set([...this.rows.controls]);
    this.dataSource.set([...this.rows.controls]);
  }

  private buildStudentRow(student: Partial<IStudentGrade>): FormGroup {
    const numberValidator = [
      Validators.required,
      Validators.min(0),
      Validators.max(100),
    ];

    // Read-only when the parent says so (e.g. a lecturer's result already sent
    // to the Course Coordinator) or when the result has moved past DRAFT.
    const isDisabled =
      this.readonly() || (!!this.status && this.status !== 'DRAFT');

    const createNumberControl = (
      value: number | null | undefined,
      required = true
    ) =>
      new FormControl(
        { value: value ?? null, disabled: isDisabled },
        required ? numberValidator : [Validators.min(0), Validators.max(100)]
      );

    return this.fb.group({
      registrationNumber: [student.registrationNumber, Validators.required],
      fullName: [
        this.titlecasePipe.transform(student.fullName),
        Validators.required,
      ],

      test: createNumberControl(student.test),
      // LAB is optional — most courses have no lab component (FUTO 2026-07).
      lab: createNumberControl(student.lab, false),
      exam: createNumberControl(student.exam),

      total: [student.total, numberValidator],
      grade: [student.grade],
      status: [student.status],
      isEdited: [student.isEdited || false],
      moderated: [student.moderated || false],
      unregistered: [false],
    });
  }

  /**
   * Lecturer override: the student wrote the exam without being registered —
   * enable their row for score entry. Audited upstream (CA notified).
   */
  enableUnregisteredRow(index: number): void {
    const row = this.dataSource()[index];
    if (!row) return;
    const { registrationNumber, fullName } = row.getRawValue() as {
      registrationNumber?: string;
      fullName?: string;
    };
    if (!registrationNumber) return;
    this.overridden.update((current) => {
      const next = new Set(current);
      next.add(String(registrationNumber));
      return next;
    });
    this.overrideEvent.emit({
      registrationNumber: String(registrationNumber),
      fullName: String(fullName ?? ''),
    });
  }

  /** Remember a cell's value when focused, so we can cleanly undo a bad keystroke. */
  onScoreFocus(index: number, controlName: string): void {
    const ctrl = this.dataSource()[index]?.get(controlName);
    if (ctrl) this.lastAccepted.set(ctrl, ctrl.value as number | null);
  }

  onControlInput(index: number, controlName: string): void {
    // Operate on the DISPLAYED row, not a positional FormArray index — this is
    // what keeps editing correct while a search filter is active.
    const row = this.dataSource()[index];
    if (!row) return;

    const ctrl = row.get(controlName);
    if (!ctrl) return;

    const value = ctrl.value as number | null;

    // Undo ONLY the offending keystroke — revert THIS cell to its last accepted
    // value and leave the other scores untouched (no data loss).
    const revert = (): void => {
      ctrl.setValue(this.lastAccepted.get(ctrl) ?? null, { emitEvent: false });
      ctrl.markAsTouched();
      ctrl.markAsDirty();
    };

    // A single score outside 0–100.
    if (value !== null && (value < 0 || value > 100)) {
      revert();
      this.handleRowInput(index);
      return;
    }

    // The new keystroke pushes the row total over 100.
    const { test, lab, exam } = row.getRawValue() as Partial<IStudentGrade>;
    if ((test ?? 0) + (lab ?? 0) + (exam ?? 0) > 100) {
      revert();
      this.handleRowInput(index);
      return;
    }

    // Accepted — this is now the value we'd revert to next time.
    this.lastAccepted.set(ctrl, value);
    this.handleRowInput(index);
  }

  handleRowInput(index: number): void {
    const row = this.dataSource()[index];
    if (!row) return;

    const { test, lab, exam } = row.getRawValue() as Partial<IStudentGrade>;

    const isEmpty = (value: number | null | undefined): boolean =>
      value === null || value === undefined;
    const allEmpty = isEmpty(test) && isEmpty(lab) && isEmpty(exam);

    const total = (test ?? 0) + (lab ?? 0) + (exam ?? 0);

    // onControlInput already prevents committing a >100 sum, so just bail
    // defensively — never wipe the row's other scores.
    if (total > 100) return;

    row.get('total')?.setValue(allEmpty ? null : total);

    if (row.valid) {
      if (total >= 70) row.get('grade')?.setValue('A');
      else if (total >= 60) row.get('grade')?.setValue('B');
      else if (total >= 50) row.get('grade')?.setValue('C');
      else if (total >= 45) row.get('grade')?.setValue('D');
      else if (total >= 40) row.get('grade')?.setValue('E');
      else row.get('grade')?.setValue('F');

      row.get('status')?.setValue(total >= 40 ? 'PASS' : 'FAIL');
      this.hasChangesEvent.emit(true);
    } else {
      // Incomplete row — drop stale grade/status so the display stays honest.
      row.get('grade')?.setValue(null);
      row.get('status')?.setValue(null);
    }

    this.persistRow(row);
  }

  /**
   * Durably save the row to IndexedDB (the "save to disk") and queue a
   * background sync. A complete, valid row is `dirty` (eligible to sync); an
   * incomplete row is `local` — still durable, but not sent until finished.
   */
  private persistRow(row: FormGroup): void {
    const rid = this.resultId();
    if (!rid) return;

    const raw = row.getRawValue() as Partial<IStudentGrade>;
    const reg = raw.registrationNumber;
    if (!reg) return;

    const syncStatus: SyncStatus = row.valid ? 'dirty' : 'local';
    const entry: ILocalResultEntry = {
      key: ResultEntryStore.buildKey(rid, reg),
      resultId: rid,
      category: 'REGULAR',
      registrationNumber: reg,
      fullName: raw.fullName ?? '',
      test: raw.test ?? null,
      lab: raw.lab ?? null,
      exam: raw.exam ?? null,
      total: raw.total ?? null,
      grade: raw.grade ?? null,
      status: raw.status ?? null,
      syncStatus,
      updatedAt: Date.now(),
    };

    void this.sync.saveLocal(entry);
  }

  /**
   * On load, merge the durable store with the freshly-fetched server data:
   * unsynced local edits win; otherwise the server snapshot seeds a baseline.
   * Then bind the sync engine to this result so any leftovers drain.
   */
  private async hydrateAndActivate(): Promise<void> {
    const rid = this.resultId();
    if (!rid) return;

    const locals = await this.store.getByResult(rid);
    const byReg = new Map(locals.map((l) => [l.registrationNumber, l]));
    const toSeed: ILocalResultEntry[] = [];

    for (const row of this.rows.controls) {
      const raw = row.getRawValue() as Partial<IStudentGrade>;
      const reg = raw.registrationNumber;
      if (!reg) continue;

      const local = byReg.get(reg);

      if (local && local.syncStatus !== 'synced') {
        // Unsynced local edits win over the server snapshot.
        row.patchValue(
          {
            test: local.test,
            lab: local.lab,
            exam: local.exam,
            total: local.total,
            grade: local.grade,
            status: local.status,
          },
          { emitEvent: false }
        );
      } else if (!local && raw.total !== null && raw.total !== undefined) {
        // Seed a synced baseline from server-provided scores.
        toSeed.push({
          key: ResultEntryStore.buildKey(rid, reg),
          resultId: rid,
          category: 'REGULAR',
          registrationNumber: reg,
          fullName: raw.fullName ?? '',
          test: raw.test ?? null,
          lab: raw.lab ?? null,
          exam: raw.exam ?? null,
          total: raw.total ?? null,
          grade: raw.grade ?? null,
          status: raw.status ?? null,
          serverId: raw._id ?? null,
          syncStatus: 'synced',
          updatedAt: Date.now(),
        });
      }
    }

    if (toSeed.length) await this.store.bulkPut(toSeed);
    // Recompute the displayed rows through the display effect so search and
    // registration ordering are preserved (never overwrite dataSource raw).
    this.displayRefresh.update((v) => v + 1);
    this.sync.setActiveResult(rid);
  }

  /**
   * Spreadsheet-style keyboard navigation across the grade inputs so lecturers
   * can move between cells without a mouse. Arrow keys move in all four
   * directions (left/right wrap into the adjacent row); Enter moves down. The
   * native number-spinner increment and implicit form submit are suppressed.
   */
  onGradeKeydown(
    event: KeyboardEvent,
    rowIndex: number,
    column: GradeColumn
  ): void {
    const navKeys = [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Enter',
    ];
    if (!navKeys.includes(event.key)) return;

    event.preventDefault();

    const colIndex = this.GRADE_COLUMNS.indexOf(column);
    let targetRow = rowIndex;
    let targetCol = colIndex;

    switch (event.key) {
      case 'ArrowUp':
        targetRow = rowIndex - 1;
        break;
      case 'ArrowDown':
      case 'Enter':
        targetRow = rowIndex + 1;
        break;
      case 'ArrowLeft':
        targetCol = colIndex - 1;
        if (targetCol < 0) {
          targetCol = this.GRADE_COLUMNS.length - 1;
          targetRow = rowIndex - 1;
        }
        break;
      case 'ArrowRight':
        targetCol = colIndex + 1;
        if (targetCol > this.GRADE_COLUMNS.length - 1) {
          targetCol = 0;
          targetRow = rowIndex + 1;
        }
        break;
    }

    this.focusGradeCell(targetRow, this.GRADE_COLUMNS[targetCol]);
  }

  private focusGradeCell(rowIndex: number, column: GradeColumn): void {
    if (rowIndex < 0 || rowIndex >= this.dataSource().length) return;

    const input = this.host.nativeElement.querySelector(
      `input[data-row="${rowIndex}"][data-col="${column}"]`
    ) as HTMLInputElement | null;
    if (!input) return;

    input.focus();
    input.select();
  }
}
