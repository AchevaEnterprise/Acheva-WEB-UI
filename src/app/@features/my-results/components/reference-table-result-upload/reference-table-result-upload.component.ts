import { TitleCasePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { catchError, EMPTY, finalize } from 'rxjs';

import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchSelectComponent } from '../../../../@shared/components/forms/search-select/search-select.component';
import { StatusBadgeComponent } from '../../../../@shared/components/status-badge/status-badge.component';
import { IStudentGrade } from '../../../students/models/student.model';
import {
  ILocalResultEntry,
  SyncStatus,
} from '../../sync/models/local-entry.model';
import { ResultEntryStore } from '../../sync/result-entry-store.service';
import { ResultSyncService } from '../../sync/result-sync.service';
import { ResultsService } from '../../../result-management/services/results.service';
import { ToastService } from '../../../../@core/utility/toast.service';

type GradeColumn = 'test' | 'lab' | 'exam';

@Component({
  selector: 'app-reference-table-result-upload',
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    StatusBadgeComponent,
    SearchSelectComponent,
    ButtonComponent,
    TitleCasePipe,
  ],
  templateUrl: './reference-table-result-upload.component.html',
  styleUrl: './reference-table-result-upload.component.scss',
  exportAs: 'referenceTableResultUploadRef',
  providers: [TitleCasePipe],
})
export class ReferenceTableResultUploadComponent {
  private readonly titlecasePipe = inject(TitleCasePipe);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject(ElementRef);
  private readonly store = inject(ResultEntryStore);
  private readonly sync = inject(ResultSyncService);
  private readonly resultsService = inject(ResultsService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  students = input<Partial<IStudentGrade>[]>([]);
  searchValue = input<string | null>(null);
  refreshTable = input<boolean>(false);
  /** The result these entries belong to — enables local-first persistence. */
  resultId = input<string>('');
  /** When true the grade inputs render as read-only text (no editing). */
  readonly = input<boolean>(false);

  /**
   * How the course is assessed. On a PRACTICAL_ONLY course the test and exam
   * columns stay visible but are disabled — the template already renders a
   * disabled control as plain text — and the practical carries the whole mark.
   */
  assessmentShape = input<'THEORY' | 'PRACTICAL_ONLY'>('THEORY');

  /** Kept for back-compat with the parent's "unsaved changes" guard. */
  hasChangesEvent = output<boolean>();

  allRows = signal<FormGroup[]>([]);
  dataSource = signal<FormGroup[]>([]);

  filterdStudentRegNumber = signal<
    { label: string; value: { registrationNumber: string; fullName: string } }[]
  >([]);
  searchingStudent = signal<boolean>(false);
  /** Why the last typed number was refused — shown under the table. */
  referenceNotice = signal<string | null>(null);

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

  /** Have we already built rows from a non-empty server set? */
  private initialisedFromData = false;

  /** Last value a score cell held before the current keystroke, for clean undo. */
  private readonly lastAccepted = new Map<AbstractControl, number | null>();

  constructor() {
    effect(() => {
      const students = this.students();
      const refresh = this.refreshTable();

      if (refresh) {
        // Excel upload replaced the set — rebuild from it.
        this.initialisedFromData = students.length > 0;
        this.initializeFormRows(students);
        void this.hydrateAndActivate();
      } else if (students.length > 0 && !this.initialisedFromData) {
        // First real server data arrived (replaces any placeholder blanks).
        this.initialisedFromData = true;
        this.initializeFormRows(students);
        void this.hydrateAndActivate();
      } else if (students.length === 0 && this.rows.length === 0) {
        // Empty category — show blank rows for manual entry.
        this.initializeFormRows(students);
        void this.hydrateAndActivate();
      }
    });

    effect(() => {
      const term = (this.searchValue() ?? '').trim().toLowerCase();
      const rows = this.allRows();

      if (!term) {
        this.dataSource.set(rows);
        return;
      }

      this.dataSource.set(
        rows.filter((row) => {
          const { registrationNumber, fullName } =
            row.getRawValue() as Partial<IStudentGrade>;
          return (
            registrationNumber?.toLowerCase().includes(term) ||
            fullName?.toLowerCase().includes(term)
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

    for (const stu of sorted) this.rows.push(this.buildStudentRow(stu));

    this.rows.markAsPristine();
    this.allRows.set([...this.rows.controls]);
    this.dataSource.set([...this.rows.controls]);

    // Provide blank rows for manual reference entry when none exist.
    if (this.allRows().length < 1 && !this.readonly()) {
      for (let i = 0; i < 10; i++) this.addRow();
    }
  }

  addRow(): void {
    this.rows.push(this.buildStudentRow());
    this.allRows.set([...this.rows.controls]);
    this.dataSource.set([...this.rows.controls]);
  }

  removeRow(index: number): void {
    const row = this.dataSource()[index];
    if (!row) return;

    // If the row was ever persisted/synced, queue its deletion too.
    this.deleteRowData(row);

    const arrIndex = this.rows.controls.indexOf(row);
    if (arrIndex >= 0) this.rows.removeAt(arrIndex);
    this.allRows.set([...this.rows.controls]);
    this.dataSource.set([...this.rows.controls]);
  }

  private buildStudentRow(student?: Partial<IStudentGrade>): FormGroup {
    const numberValidator = [
      Validators.required,
      Validators.min(0),
      Validators.max(100),
    ];

    const isDisabled =
      this.readonly() || (!!this.status && this.status !== 'DRAFT');

    const practicalOnly = this.assessmentShape() === 'PRACTICAL_ONLY';

    const createNumberControl = (
      value: number | null | undefined,
      disabled = isDisabled
    ) => new FormControl({ value: value ?? null, disabled }, numberValidator);

    return this.fb.group({
      registrationNumber: [student?.registrationNumber, Validators.required],
      fullName: [
        this.titlecasePipe.transform(student?.fullName),
        Validators.required,
      ],

      // Disabled, not removed, on a practical-only course: the lecturer keeps
      // the familiar layout and can see the course simply has no test or exam.
      test: createNumberControl(student?.test, isDisabled || practicalOnly),
      lab: createNumberControl(student?.lab),
      exam: createNumberControl(student?.exam, isDisabled || practicalOnly),

      total: [student?.total, numberValidator],
      grade: [student?.grade],
      status: [student?.status],
      isEdited: [student?.isEdited || false],
    });
  }

  /** Remember a cell's value when focused, so we can cleanly undo a bad keystroke. */
  onScoreFocus(index: number, controlName: string): void {
    const ctrl = this.dataSource()[index]?.get(controlName);
    if (ctrl) this.lastAccepted.set(ctrl, ctrl.value as number | null);
  }

  onControlInput(index: number, controlName: string): void {
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

    if (value !== null && (value < 0 || value > 100)) {
      revert();
      this.handleRowInput(index);
      return;
    }

    const { test, lab, exam } = row.getRawValue() as Partial<IStudentGrade>;
    if ((test ?? 0) + (lab ?? 0) + (exam ?? 0) > 100) {
      revert();
      this.handleRowInput(index);
      return;
    }

    this.lastAccepted.set(ctrl, value);
    this.handleRowInput(index);
  }

  handleRowInput(index: number): void {
    const row = this.dataSource()[index];
    if (!row) return;

    const { test, lab, exam } = row.getRawValue() as Partial<IStudentGrade>;

    const isEmpty = (value: number | null | undefined): boolean =>
      value === null || value === undefined;
    const allEmpty =
      this.assessmentShape() === 'PRACTICAL_ONLY'
        ? isEmpty(lab)
        : isEmpty(test) && isEmpty(lab) && isEmpty(exam);

    // A practical-only course's total IS its practical score — never a sum
    // that quietly folds in a disabled test or exam.
    const total =
      this.assessmentShape() === 'PRACTICAL_ONLY'
        ? (lab ?? 0)
        : (test ?? 0) + (lab ?? 0) + (exam ?? 0);

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
      row.get('grade')?.setValue(null);
      row.get('status')?.setValue(null);
    }

    this.persistRow(row);
  }

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
      category: 'REFERENCE',
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

  /** Clearing-to-empty deletes the server entry (if any) and drops it locally. */
  private deleteRowData(row: FormGroup): void {
    const rid = this.resultId();
    const reg = (row.getRawValue() as Partial<IStudentGrade>)
      .registrationNumber;
    if (!rid || !reg) return;

    void this.sync.saveLocal({
      key: ResultEntryStore.buildKey(rid, reg),
      resultId: rid,
      category: 'REFERENCE',
      registrationNumber: reg,
      fullName: '',
      test: null,
      lab: null,
      exam: null,
      total: null,
      grade: null,
      status: null,
      syncStatus: 'dirty',
      updatedAt: Date.now(),
    });
  }

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
        toSeed.push({
          key: ResultEntryStore.buildKey(rid, reg),
          resultId: rid,
          category: 'REFERENCE',
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
    this.dataSource.set([...this.rows.controls]);
    this.sync.setActiveResult(rid);
  }

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

  /**
   * Reference rows are the ONLY place a lecturer types a registration number —
   * regular rows are prefilled from the department roster. So this asks the
   * result-scoped endpoint, not the school-wide student lookup: a reference
   * student must come from the same department as the cohort.
   *
   * A number that belongs to someone else is not silently dropped from the
   * suggestions. It is explained, naming the student and their real
   * department, because "no match" on a number the lecturer can see on a paper
   * script in front of them just sends them hunting for a typo that is not
   * there.
   */
  searchStudentsByRegNo(regNo: string): void {
    const resultId = this.resultId();
    if (!resultId) return;

    this.searchingStudent.set(true);
    this.referenceNotice.set(null);

    this.resultsService
      .checkReferenceCandidate(resultId, regNo)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.searchingStudent.set(false)),
        catchError(() => {
          this.filterdStudentRegNumber.set([]);
          return EMPTY;
        })
      )
      .subscribe((resp) => {
        const candidate = resp.data;

        if (candidate.eligible && candidate.student) {
          this.referenceNotice.set(null);
          this.filterdStudentRegNumber.set([
            {
              label: candidate.student.registrationNumber,
              value: {
                registrationNumber: candidate.student.registrationNumber,
                fullName: candidate.student.fullName,
              },
            },
          ]);
          return;
        }

        this.filterdStudentRegNumber.set([]);
        this.referenceNotice.set(candidate.message);
        this.toast.showNotification(
          'warning',
          candidate.reason === 'DIFFERENT_DEPARTMENT'
            ? 'Different department'
            : 'Cannot add as reference',
          candidate.message
        );
      });
  }

  onSelect(value: unknown, index: number): void {
    const row = this.dataSource()[index];
    if (!row) return;

    const { fullName, registrationNumber } = value as {
      registrationNumber: string;
      fullName: string;
    };

    row.get('registrationNumber')?.setValue(registrationNumber);
    row.get('fullName')?.setValue(fullName);

    // Persist now so a student picked after scores were typed is captured.
    this.persistRow(row);
  }
}
