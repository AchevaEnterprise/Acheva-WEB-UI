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
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { finalize, Subject, takeUntil } from 'rxjs';
import { SearchSelectComponent } from '../../../../@shared/components/forms/search-select/search-select.component';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { IStudentGrade } from '../../../courses/models/student-grade.model';
import { StudentService } from '../../../students/services/student.service';

@Component({
  selector: 'app-reference-table-result-upload',
  imports: [
    PaginatorComponent,
    MatTableModule,
    FormsModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    SearchSelectComponent,
  ],
  templateUrl: './reference-table-result-upload.component.html',
  styleUrl: './reference-table-result-upload.component.scss',
  exportAs: 'referenceTableResultUploadRef',
})
export class ReferenceTableResultUploadComponent implements OnInit, OnDestroy {
  private readonly studentService = inject(StudentService);
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  students = input<Partial<IStudentGrade>[]>([]);
  tableUpdateEvent = output<Partial<IStudentGrade>[]>();

  form: FormGroup;
  searchingStudents = signal(false);
  studentList = signal<{ label: string; value: string }[]>([]);

  displayedColumns: string[] = [
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
    // Initialize form with empty FormArray
    this.form = this.fb.group({
      rows: this.fb.array([]),
    });

    // Effect to watch for changes in students input and update form accordingly
    effect(() => {
      const students = this.students();
      if (students && students.length > 0) {
        this.updateFormWithStudents(students);
      } else {
        // Clear form if no students
        this.clearForm();
      }
    });
  }

  ngOnInit(): void {
    // Subscribe to form changes to emit updates
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
      this.tableUpdateEvent.emit(value.rows as Partial<IStudentGrade>[]);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Computed property for data source
  dataSource = computed<Partial<IStudentGrade>[]>(() => {
    return this.students() || [];
  });

  private updateFormWithStudents(students: Partial<IStudentGrade>[]): void {
    const rowsArray = this.rows;

    // Clear existing rows
    while (rowsArray.length !== 0) {
      rowsArray.removeAt(0);
    }

    // Add new rows for each student
    students.forEach((student) => {
      rowsArray.push(this.createRow(student));
    });
  }

  private clearForm(): void {
    const rowsArray = this.rows;
    while (rowsArray.length !== 0) {
      rowsArray.removeAt(0);
    }
  }

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

  get rows(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  createRow(student: Partial<IStudentGrade>): FormGroup {
    const row = this.fb.group({
      registrationNumber: new FormControl(student.registrationNumber || '', [
        Validators.required,
      ]),
      fullName: new FormControl(student.fullName || '', [Validators.required]),
      test: new FormControl(student.test || 0, [
        Validators.min(0),
        Validators.max(30),
      ]),
      lab: new FormControl(student.lab || 0, [
        Validators.min(0),
        Validators.max(30),
      ]),
      exam: new FormControl(student.exam || 0, [
        Validators.min(0),
        Validators.max(70),
      ]),
      total: new FormControl({ value: 0, disabled: true }), // Auto-calculated
      grade: new FormControl(student.grade || ''),
      status: new FormControl(student.status || 'PENDING'),
    });

    // Subscribe to changes in test, lab, exam to auto-calculate total and grade
    row
      .get('test')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.calculateTotalAndGrade(row);
      });

    row
      .get('lab')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.calculateTotalAndGrade(row);
      });

    row
      .get('exam')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.calculateTotalAndGrade(row);
      });

    // Initial calculation
    this.calculateTotalAndGrade(row);

    return row;
  }

  private calculateTotalAndGrade(row: FormGroup): void {
    const test = Number(row.get('test')?.value) || 0;
    const lab = Number(row.get('lab')?.value) || 0;
    const exam = Number(row.get('exam')?.value) || 0;

    const total = test + lab + exam;
    row.get('total')?.setValue(total, { emitEvent: false });

    // Calculate grade based on total
    let grade = 'F';
    let status = 'FAIL';

    if (total >= 70) {
      grade = 'A';
      status = 'PASS';
    } else if (total >= 60) {
      grade = 'B';
      status = 'PASS';
    } else if (total >= 50) {
      grade = 'C';
      status = 'PASS';
    } else if (total >= 45) {
      grade = 'D';
      status = 'PASS';
    } else if (total >= 40) {
      grade = 'E';
      status = 'PASS';
    } else {
      grade = 'F';
      status = 'FAIL';
    }

    row.get('grade')?.setValue(grade, { emitEvent: false });
    row.get('status')?.setValue(status, { emitEvent: false });
  }

  addStudent(registrationNumber: string): void {
    // Check if student already exists
    const existingStudent = this.rows.controls.find(
      (control) =>
        control.get('registrationNumber')?.value === registrationNumber
    );

    if (existingStudent) {
      console.warn('Student already exists in the table');
      return;
    }

    // Find student from the search results
    const studentData = this.studentList().find(
      (student) => student.value === registrationNumber
    );

    if (studentData) {
      const newStudent: Partial<IStudentGrade> = {
        registrationNumber: studentData.value,
        fullName: studentData.label.split(' (')[0], // Extract name without reg number
        test: '0',
        lab: '0',
        exam: '0',
        grade: 'F',
        status: 'PENDING',
      };

      this.rows.push(this.createRow(newStudent));
    }
  }

  removeStudent(index: number): void {
    if (index >= 0 && index < this.rows.length) {
      this.rows.removeAt(index);
    }
  }

  saveRow(index: number): void {
    const row = this.rows.at(index);
    if (row.valid) {
      const rowData = row.value as Partial<IStudentGrade>;
      console.warn('Saving row data:', rowData);

      // Emit the updated data
      this.tableUpdateEvent.emit(this.form.value.rows);
    } else {
      console.warn('Row is invalid:', row.errors);
    }
  }

  saveAllRows(): void {
    if (this.form.valid) {
      const allData = this.form.value.rows as Partial<IStudentGrade>[];
      console.warn('Saving all rows:', allData);
      this.tableUpdateEvent.emit(allData);
    } else {
      console.warn('Form is invalid');
    }
  }

  // Public method to get current data source for parent component
  getCurrentDataSource(): Partial<IStudentGrade>[] {
    return this.form.value.rows || [];
  }

  // Method to validate all rows
  validateAllRows(): boolean {
    return this.form.valid;
  }

  // Method to get form errors
  getFormErrors(): any {
    const errors: any = {};
    this.rows.controls.forEach((row, index) => {
      if (row.invalid) {
        errors[index] = row.errors;
      }
    });
    return errors;
  }
}
