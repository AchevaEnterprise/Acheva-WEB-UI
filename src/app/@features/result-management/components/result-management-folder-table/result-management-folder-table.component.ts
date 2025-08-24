import { SelectionModel } from '@angular/cdk/collections';
import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ICourse } from '../../../courses/models/course.model';

@Component({
  selector: 'app-result-management-folder-table',
  imports: [
    SvgComponent,
    DatePipe,
    MatTableModule,
    PaginatorComponent,
    MatCheckboxModule,
    MatSelectModule,
    MatFormFieldModule,
    MatMenuModule,
    MatDividerModule,
    MatIconModule,
  ],
  templateUrl: './result-management-folder-table.component.html',
  styleUrl: './result-management-folder-table.component.scss',
})
export class ResultManagementFolderTableComponent {
  private readonly router = inject(Router);
  expand = input<boolean>(false);
  folderView = signal<boolean>(true);

  expandedElement!: ICourse | null;

  folderDisplayedColumns: string[] = ['courseCode', 'courseTitle', 'semester'];
  columnsToDisplayWithExpand: string[] = [...this.folderDisplayedColumns];
  folderDataSource = signal<ICourse[]>([]);

  fileDisplayedColumns: string[] = [
    'courseCode',
    'courseTitle',
    'semester',
    'department',
    'faculty',
  ];
  fileDataSource = signal<ICourse[]>([]);
  selection = new SelectionModel<ICourse>(true, []);

  constructor() {
    effect(() => {
      if (this.expand()) {
        // this.folderDisplayedColumns.push('department', 'faculty', 'actions');
        this.fileDisplayedColumns.push(
          'lecturer',
          'createdAt',
          'updatedAt',
          'actions'
        );
      } else {
        // this.folderDisplayedColumns = this.folderDisplayedColumns.filter(
        //   (col) => !['department', 'faculty', 'actions'].includes(col)
        // );
        this.fileDisplayedColumns = this.fileDisplayedColumns.filter(
          (col) =>
            !['lecturer', 'createdAt', 'updatedAt', 'actions'].includes(col)
        );
      }
    });
  }

  /** Checks whether an element is expanded. */
  isExpanded(element: ICourse) {
    return this.expandedElement === element;
  }

  /** Toggles the expanded state of an element. */
  toggle(element: ICourse) {
    this.expandedElement = this.isExpanded(element) ? null : element;
  }

  openResultFolder(result: any) {
    this.folderView.set(false);
  }

  viewResultDetails(result: ICourse) {
    this.router.navigate(['my-result/upload-result']);
  }
}
