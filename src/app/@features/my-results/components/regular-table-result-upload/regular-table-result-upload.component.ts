import { Component, input, output, effect, untracked } from '@angular/core';
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
    MatCheckboxModule,
    StatusBadgeComponent,
    EmptyStateComponent,
  ],
  templateUrl: './regular-table-result-upload.component.html',
  styleUrl: './regular-table-result-upload.component.scss',
  exportAs: 'regularTableResultUploadRef',
})
export class RegularTableResultUploadComponent {
  students = input<any>();
  tableUpdateEvent = output<Partial<IStudentGrade>[]>();

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

  private studentsData: Partial<IStudentGrade>[] = [];

  constructor() {
    // Watch for input changes without causing re-renders
    effect(() => {
      const students = this.students();

      untracked(() => {
        if (students) {
          this.studentsData = students;
        }
      });
    });
  }

  dataSource() {
    return this.studentsData;
  }

  updateField(element: any, field: string, event: Event) {
    const input = event.target as HTMLInputElement;
    // If input is empty, set to '-'. If input is a number (including 0), keep as number string.
    const value = input.value.trim();
    if (value === '' || value === '-') {
      element[field] = '-';
    } else if (!isNaN(Number(value))) {
      element[field] = value;
    } else {
      element[field] = '-';
    }
    // Don't trigger any updates to prevent focus loss
  }

  onInputBlur() {
    // Only emit when user leaves the input
    this.tableUpdateEvent.emit(this.studentsData);
  }
}
