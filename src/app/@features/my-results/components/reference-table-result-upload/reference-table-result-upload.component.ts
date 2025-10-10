import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  OnInit,
  OnDestroy,
  effect,
  ChangeDetectorRef,
  untracked,
  Signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageEvent } from '@angular/material/paginator';
import { finalize, Subject, takeUntil } from 'rxjs';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { IPaginator } from '../../../../@core/models/paginator.model';
import { IStudentGrade } from '../../../courses/models/student-grade.model';
import { StudentService } from '../../../students/services/student.service';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-reference-table-result-upload',
  imports: [
    PaginatorComponent,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    EmptyStateComponent,
  ],
  templateUrl: './reference-table-result-upload.component.html',
  styleUrl: './reference-table-result-upload.component.scss',
  exportAs: 'referenceTableResultUploadRef',
})
export class ReferenceTableResultUploadComponent implements OnInit, OnDestroy {
  // Injected services
  private readonly studentService = inject(StudentService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  // Input/Output properties

  paginationEvent = output<PageEvent>();

  students = input<Partial<IStudentGrade & { _id: string }>[]>([]);
  tableUpdateEvent = output<Partial<IStudentGrade & { _id: string }>[]>();
  selectedRows = output<Partial<IStudentGrade & { _id: string }>[]>();

  // Row selection signal
  selectedIndices = signal<Set<number>>(new Set<number>());

  // Form and signals
  form: FormGroup;
  searchingStudents = signal(false);
  studentList = signal<{ label: string; value: string }[]>([]);

  // Pagination signals
  currentPage = signal(0);
  pageSize = signal(10);
  totalStudents = signal(0);

  // Signal to track FormArray changes - this is the key fix
  private formArrayVersion = signal(0);

  // Configuration
  readonly pageSizeOptions = [5, 10, 25, 50, 100];
  readonly displayedColumns = [
    'select',
    'registrationNumber',
    'fullName',
    'test',
    'lab',
    'exam',
    'total',
    'grade',
    'status',
  ];

  constructor() {
    this.form = this.fb.group({
      rows: this.fb.array([]),
    });

    // Fixed effect with proper change detection
    effect(() => {
      const students = this.students();

      // Use untracked to prevent infinite loops
      untracked(() => {
        if (students && students.length >= 0) {
          // Allow empty arrays
          this.totalStudents.set(students.length);
          this.updateFormWithStudents(students);
          // Reset pagination and selection when data changes
          this.currentPage.set(0);
          this.selectedIndices.set(new Set<number>());
        }
      });
    });
  }

  ngOnInit(): void {
    // Add debouncing to prevent excessive emissions
    this.form.valueChanges
      .pipe(
        takeUntil(this.destroy$)
        // Add a small delay to prevent rapid-fire emissions
      )
      .subscribe((value) => {
        console.log(
          'Form value changed, emitting:',
          value.rows?.length || 0,
          'rows'
        );
        this.tableUpdateEvent.emit(value.rows as Partial<IStudentGrade>[]);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Fixed computed properties that react to FormArray changes
  paginationData = computed<IPaginator>(() => ({
    page: this.currentPage(),
    pageSize: this.pageSize(),
    total: this.totalStudents(),
  }));

  dataSource = computed(() => {
    // Include formArrayVersion to make this reactive to FormArray changes
    this.formArrayVersion();

    const startIndex = this.currentPage() * this.pageSize();
    const endIndex = startIndex + this.pageSize();
    const controls = this.rows.controls;

    return controls.slice(startIndex, endIndex).map((control) => {
      const value = control.value as Partial<IStudentGrade>;
      return value;
    });
  });

  paginatedRows: Signal<AbstractControl[]> = computed(() => {
    // Include formArrayVersion to make this reactive to FormArray changes
    this.formArrayVersion();

    const startIndex = this.currentPage() * this.pageSize();
    const endIndex = startIndex + this.pageSize();
    const controls = this.rows.controls.slice(startIndex, endIndex);

    return controls;
  });

  get rows(): FormArray {
    const formArray = this.form.get('rows') as FormArray;
    return formArray;
  }

  private updateFormWithStudents(
    students: Partial<IStudentGrade & { _id: string }>[]
  ): void {
    console.log('Updating form with students:', students.length, students);

    // Clear the FormArray completely
    while (this.rows.length !== 0) {
      this.rows.removeAt(0);
    }

    // Add new students
    students.forEach((student, index) => {
      this.rows.push(this.createRow(student));
    });

    // Increment version to trigger computed updates - this is crucial
    this.formArrayVersion.update((v) => v + 1);

    console.log('Form updated with', this.rows.length, 'rows');

    // Force change detection
    this.form.markAsDirty();
    this.form.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  // Form management
  createRow(student: Partial<IStudentGrade & { _id: string }>): FormGroup {
    const row = this.fb.group({
      _id: [student._id || ''], // Add ID field to track entries
      registrationNumber: [
        student.registrationNumber || '',
        Validators.required,
      ],
      fullName: [student.fullName || '', Validators.required],
      test: [student.test ?? '', [Validators.min(0), Validators.max(30)]],
      lab: [student.lab ?? '', [Validators.min(0), Validators.max(30)]],
      exam: [student.exam ?? '', [Validators.min(0), Validators.max(70)]],
      total: [{ value: '', disabled: true }],
      grade: [student.grade || '-'],
      status: [student.status || 'PENDING'],
    });

    ['test', 'lab', 'exam'].forEach((field) => {
      row
        .get(field)
        ?.valueChanges.pipe(takeUntil(this.destroy$))
        .subscribe(() => this.calculateTotalAndGrade(row));
    });

    this.calculateTotalAndGrade(row);
    return row;
  }

  private calculateTotalAndGrade(row: FormGroup): void {
    const test = Number(row.get('test')?.value) || 0;
    const lab = Number(row.get('lab')?.value) || 0;
    const exam = Number(row.get('exam')?.value) || 0;
    const total = test + lab + exam;

    row.get('total')?.setValue(total, { emitEvent: false });

    const { grade, status } = this.getGradeAndStatus(total);
    row.get('grade')?.setValue(grade, { emitEvent: false });
    row.get('status')?.setValue(status, { emitEvent: false });
  }

  private getGradeAndStatus(total: number): { grade: string; status: string } {
    if (total >= 70) return { grade: 'A', status: 'PASS' };
    if (total >= 60) return { grade: 'B', status: 'PASS' };
    if (total >= 50) return { grade: 'C', status: 'PASS' };
    if (total >= 45) return { grade: 'D', status: 'PASS' };
    if (total >= 40) return { grade: 'E', status: 'PASS' };
    return { grade: 'F', status: 'FAIL' };
  }

  // For row selection - updated to use formArrayVersion
  toggleRowSelection(index: number): void {
    const actualIndex = this.currentPage() * this.pageSize() + index;
    const updated = new Set(this.selectedIndices());
    if (updated.has(actualIndex)) {
      updated.delete(actualIndex);
    } else {
      updated.add(actualIndex);
    }
    this.selectedIndices.set(updated);
    this.emitSelectedRows();
  }

  toggleSelectAll(checked: boolean): void {
    const startIndex = this.currentPage() * this.pageSize();
    const endIndex = Math.min(startIndex + this.pageSize(), this.rows.length);
    const updated = new Set(this.selectedIndices());

    for (let i = startIndex; i < endIndex; i++) {
      if (checked) {
        updated.add(i);
      } else {
        updated.delete(i);
      }
    }

    this.selectedIndices.set(updated);
    this.emitSelectedRows();
  }

  isRowSelected(index: number): boolean {
    const actualIndex = this.currentPage() * this.pageSize() + index;
    return this.selectedIndices().has(actualIndex);
  }

  isAllSelected(): boolean {
    const startIndex = this.currentPage() * this.pageSize();
    const endIndex = Math.min(startIndex + this.pageSize(), this.rows.length);

    if (endIndex <= startIndex) return false;

    for (let i = startIndex; i < endIndex; i++) {
      if (!this.selectedIndices().has(i)) return false;
    }
    return true;
  }

  emitSelectedRows(): void {
    const selected = Array.from(this.selectedIndices())
      .map(
        (i) =>
          this.rows.at(i)?.value as Partial<IStudentGrade & { _id: string }>
      )
      .filter((v): v is Partial<IStudentGrade & { _id: string }> => !!v)
      .filter((student) => student._id); // Only emit students with IDs (existing entries)

    this.selectedRows.emit(selected);
  }

  clearSelections(): void {
    this.selectedIndices.set(new Set<number>());
    this.selectedRows.emit([]);
  }

  // Student management - updated to trigger version increment
  addStudent(registrationNumber: string | Event): void {
    const regNumber =
      typeof registrationNumber === 'string' ? registrationNumber : '';
    if (!regNumber) return;

    // Check if student already exists
    const exists = this.rows.controls.some(
      (control) => control.get('registrationNumber')?.value === regNumber
    );
    if (exists) {
      return;
    }

    const studentData = this.studentList().find(
      (student) => student.value === regNumber
    );
    if (studentData) {
      const newStudent: Partial<IStudentGrade & { _id: string }> = {
        // Note: _id is undefined for new students - they get IDs after being saved
        registrationNumber: studentData.value,
        fullName: studentData.label.split(' (')[0],
        test: '',
        lab: '',
        exam: '',
        grade: '-',
        status: 'PENDING',
      };

      this.rows.push(this.createRow(newStudent));
      this.totalStudents.set(this.rows.length);

      // Increment version to trigger computed updates
      this.formArrayVersion.update((v) => v + 1);

      // Navigate to page with new student
      const newStudentIndex = this.rows.length - 1;
      const targetPage = Math.floor(newStudentIndex / this.pageSize());
      this.currentPage.set(targetPage);

      this.cdr.detectChanges();
    }
  }

  removeStudent(index: number): void {
    const actualIndex = this.currentPage() * this.pageSize() + index;
    if (actualIndex >= 0 && actualIndex < this.rows.length) {
      this.rows.removeAt(actualIndex);
      this.totalStudents.set(this.rows.length);

      // Increment version to trigger computed updates
      this.formArrayVersion.update((v) => v + 1);

      // Adjust current page if needed
      const maxPage = Math.max(0, this.getTotalPages() - 1);
      if (this.currentPage() > maxPage) {
        this.currentPage.set(maxPage);
      }

      this.cdr.detectChanges();
    }
  }

  // Pagination methods
  onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.paginationEvent.emit(event);
  }

  getTotalPages(): number {
    return Math.ceil(this.totalStudents() / this.pageSize());
  }

  // Helper methods for template - improved error handling
  getFormControl(index: number, controlName: string): FormControl {
    const paginatedRows = this.paginatedRows();

    if (index < 0 || index >= paginatedRows.length) {
      return new FormControl('');
    }

    const control = paginatedRows[index]?.get(controlName) as FormControl;

    if (!control) {
      return new FormControl('');
    }

    return control;
  }

  getControlValue(index: number, controlName: string): any {
    const paginatedRows = this.paginatedRows();

    if (index < 0 || index >= paginatedRows.length) {
      return '';
    }

    return paginatedRows[index]?.get(controlName)?.value ?? '';
  }

  hasControlError(
    index: number,
    controlName: string,
    errorType: string
  ): boolean {
    const paginatedRows = this.paginatedRows();

    if (index < 0 || index >= paginatedRows.length) {
      return false;
    }

    return paginatedRows[index]?.get(controlName)?.errors?.[errorType] ?? false;
  }

  // Student search functionality
  searchStudent(query: string): void {
    if (!query || query.trim().length < 2) {
      this.studentList.set([]);
      return;
    }

    this.searchingStudents.set(true);
    this.studentService
      .getStudentByRegNo(query.trim())
      .pipe(
        finalize(() => this.searchingStudents.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (resp) => {
          if (resp.status && resp.data) {
            const students = Array.isArray(resp.data) ? resp.data : [resp.data];
            this.studentList.set(
              students.map((student: any) => ({
                label: `${student.fullName} (${student.registrationNumber})`,
                value: student.registrationNumber as string,
              }))
            );
          } else {
            this.studentList.set([]);
          }
        },
        error: (error) => {
          console.error('Error searching students:', error);
          this.studentList.set([]);
        },
      });
  }

  // Styling methods
  getGradeClass(grade: string): string {
    const gradeClasses: Record<string, string> = {
      A: 'bg-green-100 text-green-800',
      B: 'bg-blue-100 text-blue-800',
      C: 'bg-yellow-100 text-yellow-800',
      D: 'bg-orange-100 text-orange-800',
      E: 'bg-orange-200 text-orange-900',
      F: 'bg-red-100 text-red-800',
      '-': 'bg-gray-100 text-gray-500',
    };
    return gradeClasses[grade] || 'bg-gray-100 text-gray-800';
  }

  getStatusClass(status: string): string {
    const statusClasses: Record<string, string> = {
      PASS: 'bg-green-100 text-green-800',
      FAIL: 'bg-red-100 text-red-800',
      PENDING: 'bg-gray-100 text-gray-800',
    };
    return statusClasses[status] || 'bg-gray-100 text-gray-800';
  }

  // Public API methods
  getCurrentDataSource(): Partial<IStudentGrade & { _id: string }>[] {
    return this.form.value.rows || [];
  }

  getSelectedStudentsWithIds(): Partial<IStudentGrade & { _id: string }>[] {
    return Array.from(this.selectedIndices())
      .map(
        (i) =>
          this.rows.at(i)?.value as Partial<IStudentGrade & { _id: string }>
      )
      .filter(
        (v): v is Partial<IStudentGrade & { _id: string }> => !!v && !!v._id
      );
  }

  hasSelectableDeletableRows(): boolean {
    const selectedWithIds = this.getSelectedStudentsWithIds();
    return selectedWithIds.length > 0;
  }

  getDeletableSelectionCount(): number {
    return this.getSelectedStudentsWithIds().length;
  }

  canRowBeDeleted(index: number): boolean {
    const paginatedRows = this.paginatedRows();
    if (index < 0 || index >= paginatedRows.length) {
      return false;
    }
    const id = (paginatedRows[index]?.get('_id') as FormControl<string | null>)
      ?.value;
    return !!id;
  }

  getRowId(index: number): string | undefined {
    const paginatedRows = this.paginatedRows();
    if (index < 0 || index >= paginatedRows.length) {
      return undefined;
    }
    return (paginatedRows[index]?.get('_id') as FormControl)?.value;
  }

  validateAllRows(): boolean {
    return this.form.valid;
  }

  saveAllRows(): void {
    if (this.form.valid) {
      this.tableUpdateEvent.emit(this.form.value.rows);
    }
  }
}
