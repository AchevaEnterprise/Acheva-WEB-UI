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
    const value = input.value.trim();
    element[field] = value === '' ? '-' : value;
    
    // Calculate total when any field changes
    this.calculateTotal(element);
  }

  private calculateTotal(element: any) {
    const test = element.test !== '-' && element.test !== '' && !isNaN(Number(element.test)) ? Number(element.test) : 0;
    const lab = element.lab !== '-' && element.lab !== '' && !isNaN(Number(element.lab)) ? Number(element.lab) : 0;
    const exam = element.exam !== '-' && element.exam !== '' && !isNaN(Number(element.exam)) ? Number(element.exam) : 0;
    
    // Check if any field has valid numeric input
    const hasValidInput = (element.test !== '-' && element.test !== '' && !isNaN(Number(element.test))) ||
                          (element.lab !== '-' && element.lab !== '' && !isNaN(Number(element.lab))) ||
                          (element.exam !== '-' && element.exam !== '' && !isNaN(Number(element.exam)));
    
    element.total = hasValidInput ? test + lab + exam : '-';
  }

  onInputBlur() {
    // Only emit when user leaves the input
    this.tableUpdateEvent.emit(this.studentsData);
  }
}
