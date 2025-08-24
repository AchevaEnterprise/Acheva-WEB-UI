import { SelectionModel } from '@angular/cdk/collections';
import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
    FormsModule,
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
    'select',
    'regNo',
    'name',
    'test',
    'lab',
    'exam',
    'total',
    'finalGrade',
    'status',
  ];
  dataSource = computed<Partial<IStudentGrade>[]>(() => {
    const students = this.students() as Partial<IStudentGrade>[];
    return students ?? [];
  });
  selection = new SelectionModel<Partial<IStudentGrade>>(true, []);

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource().length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }

    this.selection.select(...this.dataSource());
  }

  /** The label for the checkbox on the passed row */
  checkboxLabel(row?: IStudentGrade): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.name + 1}`;
  }
}
