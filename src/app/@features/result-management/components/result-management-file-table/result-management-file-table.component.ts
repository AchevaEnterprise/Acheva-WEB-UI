import { SelectionModel } from '@angular/cdk/collections';
import { DatePipe } from '@angular/common';
import {
  Component,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ICourse } from '../../../courses/models/course.model';
import { ResultsService } from '../../services/results.service';

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
    EmptyStateComponent,
    LoaderComponent,
  ],
  templateUrl: './result-management-file-table.component.html',
  styleUrl: './result-management-file-table.component.scss',
})
export class ResultManagementFileTableComponent implements OnInit {
  private readonly resultService = inject(ResultsService);

  isloadingResults = signal(false);

  expand = input<boolean>(false);
  status = input<string>();
  viewResultEvent = output<ICourse>();

  displayedColumns: string[] = [
    'select',
    'courseCode',
    'courseTitle',
    'semester',
    'department',
    'faculty',
  ];
  dataSource = signal<ICourse[]>([]);
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

      if (this.status()) this.getResults();
    });
  }

  ngOnInit(): void {
    this.getResults();
  }

  getResults() {
    this.isloadingResults.set(true);
    this.resultService
      .getResults({
        status: this.status()!,
      })
      .pipe(finalize(() => this.isloadingResults.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.dataSource.set(resp.data.result);
          }
        },
      });
  }

  viewResult(course: ICourse) {
    this.viewResultEvent.emit(course);
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
