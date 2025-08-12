import { SelectionModel } from '@angular/cdk/collections';
import { Component, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { STUDENT_GRADES } from '../../../../@core/constant/student-grade-mock';
import { SearchSelectComponent } from '../../../../@shared/components/forms/search-select/search-select.component';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { IStudentGrade } from '../../../courses/models/student-grade.model';

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
})
export class ReferenceTableResultUploadComponent {
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
  dataSource = signal<Partial<IStudentGrade>[]>(STUDENT_GRADES);
  selection = new SelectionModel<Partial<IStudentGrade>>(true, []);

  form = new FormGroup({
    regNo: new FormControl(''),
  });

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
