import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, finalize, Subject } from 'rxjs';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { SearchSelectComponent } from '../../../../@shared/components/forms/search-select/search-select.component';
import { StatusBadgeComponent } from '../../../../@shared/components/status-badge/status-badge.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { IStudentGrade } from '../../../courses/models/student-grade.model';
import { StudentService } from '../../../students/services/student.service';

@Component({
  selector: 'app-reference-table-result-upload',
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    MatCheckboxModule,
    StatusBadgeComponent,
    EmptyStateComponent,
    MatMenuModule,
    SvgComponent,
    SearchSelectComponent,
  ],
  templateUrl: './reference-table-result-upload.component.html',
  styleUrl: './reference-table-result-upload.component.scss',
  exportAs: 'referenceTableResultUploadRef',
})
export class ReferenceTableResultUploadComponent {
  private readonly authService = inject(AuthenticationService);
  private readonly studentService = inject(StudentService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  students = input<Partial<IStudentGrade>[]>([]);
  uploadResultEvent = output<Partial<IStudentGrade>>();

  readonly displayedColumns = [
    'registrationNumber',
    'fullName',
    'test',
    'lab',
    'exam',
    'total',
    'grade',
    'status',
    'action',
  ];

  form = this.fb.group({
    rows: this.fb.array<FormGroup>([]),
  });

  private readonly inputSubject = new Subject<{
    index: number;
    control?: string;
  }>();
  readonly completedRows = new Set<number>();
  private readonly lastEmittedRows = new Map<number, Partial<IStudentGrade>>();

  filterdStudentRegNumber = signal<
    { label: string; value: { registrationNumber: string; fullName: string } }[]
  >([]);
  searchingStudent = signal<boolean>(false);

  constructor() {
    effect(() => {
      const list = this.students();
      if (list?.length) this.initializeFormRows(list);
    });

    this.inputSubject
      .pipe(debounceTime(800), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ index }) => this.handleRowInput(index));
  }

  get rows(): FormArray<FormGroup> {
    return this.form.get('rows') as FormArray<FormGroup>;
  }

  private initializeFormRows(students: Partial<IStudentGrade>[]): void {
    this.completedRows.clear();
    this.rows.clear();

    for (const student of students) {
      this.rows.push(this.buildStudentRow(student));
    }

    this.rows.markAsPristine();
  }

  private buildStudentRow(student: Partial<IStudentGrade>): FormGroup {
    const numberValidator = [
      Validators.required,
      Validators.min(0),
      Validators.max(100),
    ];

    return this.fb.group({
      registrationNumber: [student.registrationNumber, Validators.required],
      fullName: [student.fullName, Validators.required],
      test: [student.test, numberValidator],
      lab: [student.lab, numberValidator],
      exam: [student.exam, numberValidator],
      total: [student.total, numberValidator],
      grade: [student.grade],
      status: [student.status],
    });
  }

  onControlInput(index: number, controlName: string): void {
    const row = this.rows.at(index);

    const ctrl = row.get(controlName);
    if (!ctrl) return;

    if (ctrl.invalid && (ctrl.dirty || ctrl.touched)) {
      ctrl.reset();
      ctrl.markAsTouched();
      ctrl.markAsDirty();
      ctrl.updateValueAndValidity();
      return;
    }

    this.inputSubject.next({ index, control: controlName });
  }

  handleRowInput(index: number): void {
    const row = this.rows.at(index);
    const controls = ['test', 'lab', 'exam'] as const;

    for (const name of controls) {
      const ctrl = row.get(name);
      if (ctrl && ctrl.invalid && ctrl.touched) {
        ctrl.reset();
        return;
      }
    }

    const { test, lab, exam } = row.value as IStudentGrade;
    const total = (test ?? 0) + (lab ?? 0) + (exam ?? 0);

    if (total > 100) {
      for (const name of controls) {
        row.get(name)?.reset();
      }
      row.get('total')?.reset();
      return;
    }

    row.get('total')?.setValue(total);

    if (row.valid) {
      const prevValue = this.lastEmittedRows.get(index);
      const currentValue = row.value as IStudentGrade;

      const hasChanged =
        !prevValue ||
        JSON.stringify(prevValue) !== JSON.stringify(currentValue);

      if (hasChanged) {
        this.uploadResultEvent.emit(currentValue);
        this.lastEmittedRows.set(index, currentValue);
        this.completedRows.add(index);
      }

      row.markAsPristine();
      row.updateValueAndValidity();
    }
  }

  clearEntry(index: number): void {
    const row = this.rows.at(index);

    const controls = ['test', 'lab', 'exam', 'total', 'grade', 'status'];
    for (const ctrl of controls) {
      const control = row.get(ctrl);
      if (control) {
        control.reset();
        control.markAsPristine();
        control.updateValueAndValidity();
      }
    }

    this.completedRows.delete(index);
  }

  searchStudentsByRegNo(regNo: string) {
    this.searchingStudent.set(true);

    const schoolId = this.authService.activeAccount()?.school;
    this.studentService
      .getStudentByRegNo(regNo, schoolId!)
      .pipe(finalize(() => this.searchingStudent.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            const { registrationNumber, fullName } = resp.data;

            const studentMap = {
              label: registrationNumber,
              value: { registrationNumber, fullName },
            };
            this.filterdStudentRegNumber.set([studentMap]);
          }
        },
      });
  }

  onSelect(value: unknown, index: number) {
    const row = this.rows.at(index);

    const { fullName } = value as {
      registrationNumber: string;
      fullName: string;
    };
    row.get('fullName')?.setValue(fullName);
  }
}
