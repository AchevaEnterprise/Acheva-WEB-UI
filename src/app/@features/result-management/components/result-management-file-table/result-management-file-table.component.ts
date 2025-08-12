import { SelectionModel } from '@angular/cdk/collections';
import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { COURSES } from '../../../../@core/constant/course-mock';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ICourse } from '../../../courses/models/course.model';

@Component({
  selector: 'app-result-management-file-table',
  imports: [
    SvgComponent,
    DatePipe,
    MatTableModule,
    PaginatorComponent,
    MatCheckboxModule,
    MatSelectModule,
    MatFormFieldModule,
    MatMenuModule,
  ],
  templateUrl: './result-management-file-table.component.html',
  styleUrl: './result-management-file-table.component.scss',
})
export class ResultManagementFileTableComponent {
  private readonly router = inject(Router);

  expand = input<boolean>(false);

  displayedColumns: string[] = [
    'select',
    'courseCode',
    'courseTitle',
    'semester',
    'department',
    'faculty',
  ];
  dataSource = signal<ICourse[]>(COURSES);
  selection = new SelectionModel<ICourse>(true, []);

  constructor() {
    effect(() => {
      if (this.expand()) {
        this.displayedColumns.push(
          'lecturer',
          'createdAt',
          'updatedAt',
          'actions'
        );
      } else {
        this.displayedColumns = this.displayedColumns.filter(
          (col) =>
            !['lecturer', 'createdAt', 'updatedAt', 'actions'].includes(col)
        );
      }
    });
  }

  viewResultDetails(course: ICourse) {
    this.router.navigate(['my-result/upload-result']);
  }

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
  checkboxLabel(row?: ICourse): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.courseCode + 1}`;
  }
}
