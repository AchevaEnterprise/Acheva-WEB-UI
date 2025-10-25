import { SelectionModel } from '@angular/cdk/collections';
import { DatePipe, NgClass } from '@angular/common';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';

import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ICourse } from '../../../courses/models/course.model';
import { IResult } from '../../models/results.model';
import { SchoolsService } from '../../../../@core/services/schools.service';
import { IDepartment, IFaculty } from '../../../../@core/models/school.model';

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
  standalone: true,
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
  
  // Cache for departments and faculties
  private readonly schoolsService = inject(SchoolsService);
  private departmentCache = new Map<string, IDepartment>();
  private facultyCache = new Map<string, IFaculty>();

  folderDisplayedColumns: string[] = ['select', 'courseCode', 'courseTitle', 'department', 'faculty', 'resultCount'];
  fileDisplayedColumns: string[] = ['courseCode', 'courseTitle', 'session', 'department', 'faculty', 'upload'];

  constructor() {
    effect(() => {
      if (this.results().length > 0) {
        this.preloadDepartmentAndFacultyData();
      }
      this.processResultsIntoFolders();
    });
  }

  private processResultsIntoFolders() {
    const results = this.results();
    if (!results || results.length === 0) {
      this.folderDataSource.set([]);
      return;
    }

    const folderMap = new Map<string, CourseFolder>();
    
    results.forEach((result: IResult) => {
      const courseCode = result.course?.courseCode || 'UNKNOWN';
      const courseTitle = result.course?.courseTitle || 'Unknown Course';
      
      if (!folderMap.has(courseCode)) {
        folderMap.set(courseCode, {
          courseCode,
          courseTitle,
          department: this.getDepartmentName(result.department),
          faculty: this.getFacultyName(result),
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

  onSingleClick(folder: CourseFolder, event: Event) {
    event.stopPropagation();
    this.folderSelection.toggle(folder);
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

  onDoubleClick(folder: CourseFolder, event: Event) {
    event.stopPropagation();
    this.selectedFolderForDetails = folder;
    this.showDetailedView.set(true);
  }

  backToFolderView() {
    this.showDetailedView.set(false);
    this.selectedFolderForDetails = null;
    this.showCourseAnalytics.set(false);
    this.selectedResultForAnalytics = null;
  }

  viewResultDetails(result: IResult) {
    this.viewResultEvent.emit(result as any);
  }

  backFromAnalytics() {
    this.showCourseAnalytics.set(false);
    this.selectedResultForAnalytics = null;
  }

  isExpanded(folder: CourseFolder): boolean {
    return this.expandedFolder === folder;
  }

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

  getFacultyName(element: IResult): string {
    const faculty = element.faculty;
    
    // If faculty is an object with name property
    if (typeof faculty === 'object' && faculty && (faculty as any).name) {
      return (faculty as any).name;
    }
    
    // If faculty is a string (ObjectId), check cache first
    if (typeof faculty === 'string') {
      const cachedFaculty = this.facultyCache.get(faculty);
      if (cachedFaculty) {
        return cachedFaculty.name;
      }
    }
    
    // Try to get faculty from department if available
    const department = element.department;
    if (typeof department === 'object' && department && (department as any).faculty) {
      const deptFaculty = (department as any).faculty;
      if (typeof deptFaculty === 'object' && deptFaculty.name) {
        return deptFaculty.name;
      }
    }
    
    return 'Unknown Faculty';
  }
  getDepartmentName(department: any): string {
    if (!department) return 'Unknown Department';
    
    if (typeof department === 'object' && department.name) {
      return department.name;
    }
    
    if (typeof department === 'string') {
      const cachedDepartment = this.departmentCache.get(department);
      if (cachedDepartment) {
        return cachedDepartment.name;
      }
    }
    
    return 'Unknown Department';
  }

  private preloadDepartmentAndFacultyData(): void {
    const results = this.results();
    const departmentIds = new Set<string>();
    const facultyIds = new Set<string>();
    
    results.forEach(result => {
      if (typeof result.department === 'string' && 
          result.department.match(/^[a-f0-9]{24}$/i) && 
          !this.departmentCache.has(result.department)) {
        departmentIds.add(result.department);
      }
      if (typeof result.faculty === 'string' && 
          result.faculty.match(/^[a-f0-9]{24}$/i) && 
          !this.facultyCache.has(result.faculty)) {
        facultyIds.add(result.faculty);
      }
    });
    
    const departmentRequests = Array.from(departmentIds).map(id => 
      this.schoolsService.getDepartment(id)
    );
    const facultyRequests = Array.from(facultyIds).map(id => 
      this.schoolsService.getFaculty(id)
    );
    
    if (departmentRequests.length > 0) {
      forkJoin(departmentRequests).subscribe({
        next: (responses) => {
          responses.forEach((response, index) => {
            if (response.status && response.data) {
              const departmentId = Array.from(departmentIds)[index];
              this.departmentCache.set(departmentId, response.data as any);
            }
          });
          this.processResultsIntoFolders();
        },
        error: (error) => {
          console.error('Error preloading departments:', error);
        }
      });
    }
    
    if (facultyRequests.length > 0) {
      forkJoin(facultyRequests).subscribe({
        next: (responses) => {
          responses.forEach((response, index) => {
            if (response.status && response.data) {
              const facultyId = Array.from(facultyIds)[index];
              this.facultyCache.set(facultyId, response.data as any);
            }
          });
          this.processResultsIntoFolders();
        },
        error: (error) => {
          console.error('Error preloading faculties:', error);
        }
      });
    }
  }
}