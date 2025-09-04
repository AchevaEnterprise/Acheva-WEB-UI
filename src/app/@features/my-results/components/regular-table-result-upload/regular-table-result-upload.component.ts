import { Component, computed, inject, input, output } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { StatusBadgeComponent } from '../../../../@shared/components/status-badge/status-badge.component';
import { IStudentGrade } from '../../../courses/models/student-grade.model';

@Component({
  selector: 'app-regular-table-result-upload',
  imports: [
    PaginatorComponent,
    MatTableModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    StatusBadgeComponent,
    EmptyStateComponent,
  ],
  templateUrl: './regular-table-result-upload.component.html',
  styleUrl: './regular-table-result-upload.component.scss',
  exportAs: 'regularTableResultUploadRef',
})
export class RegularTableResultUploadComponent {
  private readonly fb = inject(FormBuilder);

  students = input<any>();
  tableUpdateEvent = output<Partial<IStudentGrade>[]>();

  form!: FormGroup;

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
