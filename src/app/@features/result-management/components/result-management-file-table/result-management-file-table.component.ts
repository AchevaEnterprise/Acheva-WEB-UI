import { SelectionModel } from '@angular/cdk/collections';
import { DatePipe, NgClass } from '@angular/common';
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
import { IResult } from '../../models/results.model';
import { ResultsService } from '../../services/results.service';

@Component({
  selector: 'app-result-management-file-table',
  imports: [
    SvgComponent,
    DatePipe,
    NgClass,
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
  results = input<IResult[]>([]);
  viewResultEvent = output<ICourse>();

  displayedColumns: string[] = [
    'select',
    'courseCode',
    'courseTitle',
    'semester',
    'department',
    'faculty',
  ];
  dataSource = signal<IResult[]>([]);
  selection = new SelectionModel<IResult>(true, []);
  
  expandedElement!: IResult | null;
  
  expandedDisplayedColumns: string[] = [
    'courseCode',
    'courseTitle', 
    'semester',
    'department',
    'faculty',
    'lecturer',
    'createdAt',
    'updatedAt',
    'actions'
  ];

  constructor() {
    effect(() => {
      // Reset displayed columns to base columns
      this.displayedColumns = [
        'select',
        'courseCode',
        'courseTitle',
        'semester',
        'department',
        'faculty',
      ];
      
      if (this.expand()) {
        this.displayedColumns.push(
          'lecturer',
          'createdAt',
          'updatedAt',
          'actions'
        );
      }

      // Use results from input if provided, otherwise fetch from API
      if (this.results().length > 0) {
        this.dataSource.set(this.results());
      } else if (this.status()) {
        this.getResults();
      }
    });
  }

  ngOnInit(): void {
    // Only fetch results if not provided via input
    if (this.results().length === 0 && this.status()) {
      this.getResults();
    }
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

  viewResult(course: IResult) {
    this.viewResultEvent.emit(course as any);
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
  checkboxLabel(row?: IResult): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${(row as any).courseCode + 1}`;
  }

  /** Checks whether an element is expanded. */
  isExpanded(element: IResult) {
    return this.expandedElement === element;
  }

  /** Handles single click - navigate to result upload */
  onRowClick(element: IResult, event: Event) {
    event.stopPropagation();
    this.viewResult(element);
  }

  /** Toggles the expanded state of an element on double click. */
  toggle(element: IResult, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.expandedElement = this.isExpanded(element) ? null : element;
  }

  /** Helper methods for data display */
  getLecturerName(element: IResult): string {
    return element.lecturer || 
           element.uploadedBy || 
           (typeof element.createdBy === 'object' ? element.createdBy?.fullName : element.createdBy) || 
           'Unknown Lecturer';
  }

  getDepartmentName(element: IResult): string {
    return element.department?.name || 
           (element as any).department || 
           'Unknown Department';
  }

  getFacultyName(element: IResult): string {
    return element.faculty || 
           element.department?.faculty?.name || 
           element.school?.name || 
           (element as any).faculty ||
           'Unknown Faculty';
  }

  getUploadedBy(element: IResult): string {
    return element.uploadedBy || 
           (typeof element.createdBy === 'object' ? element.createdBy?.fullName : element.createdBy) ||
           'Unknown User';
  }

  getFormattedDate(date: any, format: string = 'MMM d, yyyy h:mm a'): string {
    if (!date) return 'Not Available';
    
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return 'Invalid Date';
      
      const datePipe = new DatePipe('en-US');
      return datePipe.transform(dateObj, format) || 'Not Available';
    } catch (error) {
      return 'Invalid Date';
    }
  }

  getTimeSinceUpdate(date: any): string {
    if (!date) return '';
    
    try {
      const dateObj = new Date(date);
      const now = new Date();
      const diffMs = now.getTime() - dateObj.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 60) {
        return `${diffMins} minutes ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hours ago`;
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return '';
      }
    } catch (error) {
      return '';
    }
  }

  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'DRAFT':
        return 'bg-orange-100 text-orange-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'VERIFIED':
        return 'bg-green-100 text-green-800';
      case 'PUBLISHED':
        return 'bg-blue-100 text-blue-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  makeComment(element: IResult): void {
    // Placeholder for comment functionality
    console.log('Making comment for result:', element._id);
    // This would typically open a comment dialog or navigate to comment section
  }
}
