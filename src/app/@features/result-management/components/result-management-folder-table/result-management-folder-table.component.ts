import { SelectionModel } from '@angular/cdk/collections';
import { DatePipe, NgClass } from '@angular/common';
import { Component, effect, input, output, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ICourse } from '../../../courses/models/course.model';
import { IResult } from '../../models/results.model';


interface CourseFolder {
  courseCode: string;
  courseTitle: string;
  department: string;
  faculty: string;
  semester: string;
  resultCount: number;
  results: IResult[];
}

@Component({
  selector: 'app-result-management-folder-table',
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
    MatDividerModule,
    MatIconModule,
    EmptyStateComponent,
    LoaderComponent,

  ],
  templateUrl: './result-management-folder-table.component.html',
  styleUrl: './result-management-folder-table.component.scss',
})
export class ResultManagementFolderTableComponent {
  expand = input<boolean>(false);
  results = input<IResult[]>([]);
  status = input<string>();
  viewResultEvent = output<ICourse>();

  folderDataSource = signal<CourseFolder[]>([]);
  expandedFolder: CourseFolder | null = null;
  showDetailedView = signal<boolean>(false);
  selectedFolderForDetails: CourseFolder | null = null;
  showCourseAnalytics = signal<boolean>(false);
  selectedResultForAnalytics: IResult | null = null;
  selection = new SelectionModel<IResult>(true, []);
  folderSelection = new SelectionModel<CourseFolder>(true, []);
  isloadingResults = signal(false);

  folderDisplayedColumns: string[] = ['select', 'courseCode', 'courseTitle', 'department', 'faculty', 'resultCount'];
  fileDisplayedColumns: string[] = ['courseCode', 'courseTitle', 'session', 'department', 'faculty', 'upload'];

  constructor() {
    effect(() => {
      this.processResultsIntoFolders();
    });
  }

  private processResultsIntoFolders() {
    const results = this.results();
    if (!results || results.length === 0) {
      this.folderDataSource.set([]);
      return;
    }

    // Group results by course code
    const folderMap = new Map<string, CourseFolder>();
    
    results.forEach(result => {
      const courseCode = result.course?.courseCode || 'UNKNOWN';
      const courseTitle = result.course?.courseTitle || 'Unknown Course';
      
      if (!folderMap.has(courseCode)) {
        folderMap.set(courseCode, {
          courseCode,
          courseTitle,
          department: this.getDepartmentName(result.department),
          faculty: this.getFacultyName(result.faculty),
          semester: result.semester || '1st Semester',
          resultCount: 0,
          results: []
        });
      }
      
      const folder = folderMap.get(courseCode)!;
      folder.results.push(result);
      folder.resultCount = folder.results.length;
    });

    this.folderDataSource.set(Array.from(folderMap.values()));
  }

  /** Single click - toggle selection */
  onSingleClick(folder: CourseFolder, event: Event) {
    event.stopPropagation();
    this.folderSelection.toggle(folder);
    // Also update the main selection with all results from selected folders
    this.updateMainSelection();
  }

  updateMainSelection() {
    this.selection.clear();
    this.folderSelection.selected.forEach(folder => {
      folder.results.forEach(result => {
        this.selection.select(result);
      });
    });
  }

  /** Double click - switch to detailed results view */
  onDoubleClick(folder: CourseFolder, event: Event) {
    event.stopPropagation();
    this.selectedFolderForDetails = folder;
    this.showDetailedView.set(true);
  }

  /** Go back to folder view */
  backToFolderView() {
    this.showDetailedView.set(false);
    this.selectedFolderForDetails = null;
    this.showCourseAnalytics.set(false);
    this.selectedResultForAnalytics = null;
  }

  /** Click on individual result - navigate to standalone course coordinator results view */
  viewResultDetails(result: IResult) {
    // Navigate to standalone course coordinator results view
    this.viewResultEvent.emit(result as any);
  }

  /** Go back from course analytics to detailed view */
  backFromAnalytics() {
    this.showCourseAnalytics.set(false);
    this.selectedResultForAnalytics = null;
  }

  /** Check if folder is expanded */
  isExpanded(folder: CourseFolder): boolean {
    return this.expandedFolder === folder;
  }

  /** Selection methods */
  isAllSelected() {
    const numSelected = this.folderSelection.selected.length;
    const numRows = this.folderDataSource().length;
    return numSelected === numRows;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.folderSelection.clear();
      this.selection.clear();
      return;
    }
    this.folderSelection.select(...this.folderDataSource());
    this.updateMainSelection();
  }

  checkboxLabel(row?: CourseFolder): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.folderSelection.isSelected(row) ? 'deselect' : 'select'} row ${row.courseCode}`;
  }

  isFolderSelected(folder: CourseFolder): boolean {
    return this.folderSelection.isSelected(folder);
  }

  /** Helper methods */
  getFormattedDate(date: any, format: string = 'MMM d, yyyy'): string {
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

  getLecturerName(result: IResult): string {
    return result.lecturer || 
           result.uploadedBy || 
           (typeof result.createdBy === 'object' ? result.createdBy?.fullName : result.createdBy) || 
           'Unknown Lecturer';
  }



  getFacultyName(faculty: any): string {
    if (!faculty) return 'Unknown Faculty';
    
    // If faculty is an object with name property
    if (typeof faculty === 'object' && faculty.name) {
      return faculty.name;
    }
    
    // If faculty is a string (ObjectId), map known IDs
    if (typeof faculty === 'string') {
      const facultyMap: { [key: string]: string } = {
        '68ac80d77a30dc0ea703d55e': 'Management Sciences',
        '68ac80d77a30dc0ea703d55f': 'Engineering',
        '68ac80d77a30dc0ea703d560': 'Sciences',
        '68ac80d77a30dc0ea703d561': 'Arts',
        '68ac80d77a30dc0ea703d562': 'Social Sciences',
        '68ac80d77a30dc0ea703d563': 'Education',
        '68ac80d77a30dc0ea703d564': 'Law',
        '68ac80d77a30dc0ea703d565': 'Medicine'
      };
      
      return facultyMap[faculty] || faculty.substring(0, 8) + '...';
    }
    
    return 'Unknown Faculty';
  }

  getDepartmentName(department: any): string {
    if (!department) return 'Unknown Department';
    
    // If department is an object with name property
    if (typeof department === 'object' && department.name) {
      return department.name;
    }
    
    // If department is a string (ObjectId), map known IDs
    if (typeof department === 'string') {
      const departmentMap: { [key: string]: string } = {
        '68ac815a7a30dc0ea703d56d': 'Accounting',
        '68ac815a7a30dc0ea703d56e': 'Business Administration', 
        '68ac815a7a30dc0ea703d56f': 'Economics',
        '68ac815a7a30dc0ea703d570': 'Finance',
        '68ac815a7a30dc0ea703d571': 'Marketing',
        '68ac815a7a30dc0ea703d572': 'Computer Science',
        '68ac815a7a30dc0ea703d573': 'Mathematics',
        '68ac815a7a30dc0ea703d574': 'Physics',
        '68ac815a7a30dc0ea703d575': 'Chemistry',
        '68ac815a7a30dc0ea703d576': 'Biology',
        '68ac815a7a30dc0ea703d577': 'English',
        '68ac815a7a30dc0ea703d578': 'History',
        '68ac815a7a30dc0ea703d579': 'Political Science',
        '68ac815a7a30dc0ea703d580': 'Sociology'
      };
      
      return departmentMap[department] || department.substring(0, 8) + '...';
    }
    
    return 'Unknown Department';
  }
}
