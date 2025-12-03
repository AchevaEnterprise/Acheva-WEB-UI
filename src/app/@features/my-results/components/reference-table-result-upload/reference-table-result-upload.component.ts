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
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, finalize, Subject } from 'rxjs';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { SearchSelectComponent } from '../../../../@shared/components/forms/search-select/search-select.component';
import { StatusBadgeComponent } from '../../../../@shared/components/status-badge/status-badge.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { IStudentGrade } from '../../../students/models/student.model';
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

  private readonly route = inject(ActivatedRoute);
  private readonly userRole = this.authService.activeAccount()
    ?.role as RoleEnum;

  students = input<Partial<IStudentGrade>[]>([]);
  refreshTable = input<boolean>(false);
  uploadResultEvent = output<Partial<IStudentGrade>>();

  readonly status: string = this.route.snapshot.queryParamMap.get('status')!;

  dataSource = signal<FormGroup[]>([]);
  readonly displayedColumns = [
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

  private readonly inputSubject = new Subject<{
    index: number;
    control?: string;
  }>();
  readonly completedRows = new Set<number>();

  filterdStudentRegNumber = signal<
    { label: string; value: { registrationNumber: string; fullName: string } }[]
  >([]);
  searchingStudent = signal<boolean>(false);

  constructor() {
    effect(() => {
      const students = this.students();
      const refresh = this.refreshTable();

      if (refresh) {
        this.initializeFormRows(students);
      } else if (students?.length > 0 && this.rows.length === 0) {
        console.warn('Initializing rows for the first time');
        this.initializeFormRows(students);
      }
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

    const sortedStudents = [...students].sort((a, b) =>
      (a.fullName ?? '').localeCompare(b.fullName ?? '')
    );

    for (const stu of sortedStudents) {
      this.rows.push(this.buildStudentRow(stu));
    }

    this.rows.markAsPristine();

    // Update the table datasource so Material detects changes
    this.dataSource.set([...this.rows.controls]);
  }

  private buildStudentRow(student: Partial<IStudentGrade>): FormGroup {
    const numberValidator = [
      Validators.required,
      Validators.min(0),
      Validators.max(100),
    ];

    // disabled when user is not a lecturer or a course-cordinator
    // and when staus is not draft, if there is a status
    const isDisabled =
      ![RoleEnum.COURSE_COORDINATOR, RoleEnum.LECTURER].includes(
        this.userRole
      ) && this.status !== 'DRAFT';

    const createNumberControl = (value: number | undefined) =>
      new FormControl({ value, disabled: isDisabled }, numberValidator);

    return this.fb.group({
      registrationNumber: [student.registrationNumber, Validators.required],
      fullName: [student.fullName, Validators.required],

      test: createNumberControl(student.test),
      lab: createNumberControl(student.lab),
      exam: createNumberControl(student.exam),

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

    const { test, lab, exam } = row.getRawValue() as IStudentGrade;
    const total = (test ?? 0) + (lab ?? 0) + (exam ?? 0);

    if (total > 100) {
      for (const name of controls) row.get(name)?.reset();
      row.get('total')?.reset();
      return;
    }

    row.get('total')?.setValue(total);

    if (row.valid) {
      // Grade
      if (total >= 70) row.get('grade')?.setValue('A');
      else if (total >= 60) row.get('grade')?.setValue('B');
      else if (total >= 50) row.get('grade')?.setValue('C');
      else if (total >= 45) row.get('grade')?.setValue('D');
      else if (total >= 40) row.get('grade')?.setValue('E');
      else row.get('grade')?.setValue('F');

      // Status
      if (total <= 30) row.get('status')?.setValue('FAIL');
      else row.get('status')?.setValue('PASS');

      this.completedRows.add(index);
      this.uploadResultEvent.emit(row.getRawValue());
    }
  }

  searchStudentsByRegNo(regNo: string) {
    this.searchingStudent.set(true);

    this.studentService
      .getStudentByRegNo(regNo)
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
