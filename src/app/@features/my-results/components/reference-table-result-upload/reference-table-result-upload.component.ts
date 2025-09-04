import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';
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
export class ReferenceTableResultUploadComponent {
  private readonly studentService = inject(StudentService);
  private readonly fb = inject(FormBuilder);

  students = input<any>();
  tableUpdateEvent = output<Partial<IStudentGrade>[]>();

  form!: FormGroup;
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

  dataSource = computed<Partial<IStudentGrade>[]>(() => {
    const students = this.students() as Partial<IStudentGrade>[];

    if (students) {
      this.form = this.fb.group({
        rows: this.fb.array(students.map((student) => this.createRow(student))),
      });
      return students;
    }

    return [];
  });

  searchStudent(value: string) {
    this.searchingStudents.set(true);
    this.studentService
      .getStudentByRegNo(value)
      .pipe(finalize(() => this.searchingStudents.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.studentList.set(
              resp.data?.map((student: any) => ({
                label: student.fullName as string,
                value: student.registrationNumber as string,
              }))
            );
          }
        },
      });
  }

  get rows() {
    return this.form.get('rows') as FormArray;
  }

  createRow(student: Partial<IStudentGrade>): FormGroup {
    return this.fb.group({
      registrationNumber: new FormControl(student.registrationNumber),
      fullName: new FormControl(student.fullName),
      test: new FormControl(student.test),
      lab: new FormControl(student.lab),
      exam: new FormControl(student.exam),
      grade: new FormControl(student.grade),
      status: new FormControl(student.status),
    });
  }

  saveRow(index: number) {
    const row = this.rows.at(index).value as Partial<IStudentGrade>;
    console.warn('Saving row data:', row);
  }
}
