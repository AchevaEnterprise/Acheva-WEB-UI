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
import { finalize, forkJoin } from 'rxjs';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ICourse } from '../../../courses/models/course.model';
import { IResult } from '../../models/results.model';
import { ResultsService } from '../../services/results.service';
import { SchoolsService } from '../../../../@core/services/schools.service';
import { IDepartment, IFaculty } from '../../../../@core/models/school.model';

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
  private readonly schoolsService = inject(SchoolsService);

  isloadingResults = signal(false);
  
  // Cache for departments and faculties
  private departmentCache = new Map<string, IDepartment>();
  private facultyCache = new Map<string, IFaculty>();

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
        this.preloadDepartmentAndFacultyData();
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
            this.preloadDepartmentAndFacultyData();
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

  /** Handles single click - toggle selection */
  onSingleClick(element: IResult, event: Event) {
    event.stopPropagation();
    this.selection.toggle(element);
  }

  /** Handles double click - review result */
  onDoubleClick(element: IResult, event: Event) {
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
  // getCourseCode(element: IResult): string {
  //   console.log('getCourseCode called with element:', element);
  //   console.log('element.course:', element.course);
  //   console.log('element.course?.courseCode:', element.course?.courseCode);
    
  //   const courseCode = element.course?.courseCode || this.generateCourseCode(element._id || '');
  //   console.log('Final courseCode returned:', courseCode);
    
  //   return courseCode;
  // }

  // private generateCourseCode(id: string): string {
  //   const codes = ['MATH101', 'PHY201', 'CSC301', 'ENG102', 'CHM203'];
  //   const index = id ? parseInt(id.slice(-1), 16) % codes.length : 0;
  //   return codes[index] || 'MATH101';
  // }

  getLecturerName(element: IResult): string {
    return element.lecturer || 
           element.uploadedBy || 
           (typeof element.createdBy === 'object' ? element.createdBy?.fullName : element.createdBy) || 
           'Unknown Lecturer';
  }

  // getDepartmentName(element: IResult): string {
  //   const department = element.department;
    
  //   // If department is an object with name property
  //   if (typeof department === 'object' && department && (department as any).name) {
  //     return (department as any).name;
  //   }
    
  //   // If department is a string (ObjectId), check cache first
  //   if (typeof department === 'string') {
  //     const cachedDepartment = this.departmentCache.get(department);
  //     if (cachedDepartment) {
  //       return cachedDepartment.name;
  //     }
      
      // Hardcoded fallback mapping
  //     const departmentMap: { [key: string]: string } = {
  //       '68ac815a7a30dc0ea703d56d': 'Accounting',
  //       '68ac815a7a30dc0ea703d56e': 'Business Administration',
  //       '68ac815a7a30dc0ea703d56f': 'Economics',
  //       '68ac815a7a30dc0ea703d570': 'Finance',
  //       '68ac815a7a30dc0ea703d571': 'Marketing',
  //       '68ac815a7a30dc0ea703d572': 'Computer Science',
  //       '68ac815a7a30dc0ea703d573': 'Mathematics',
  //       '68ac815a7a30dc0ea703d574': 'Physics',
  //       '68ac815a7a30dc0ea703d575': 'Chemistry',
  //       '68ac815a7a30dc0ea703d576': 'Biology',
  //       '68ac815a7a30dc0ea703d577': 'English',
  //       '68ac815a7a30dc0ea703d578': 'History',
  //       '68ac815a7a30dc0ea703d579': 'Political Science',
  //       '68ac815a7a30dc0ea703d580': 'Sociology'
  //     };
      
  //     const mappedName = departmentMap[department];
  //     return mappedName || 'Unknown Department';
  //   }
    
  //   return 'Unknown Department';
  // }

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
      
      // Hardcoded fallback mapping
      const facultyMap: { [key: string]: string } = {
        '68ac80d77a30dc0ea703d55e': 'School of Physical',
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
      case 'UNVERIFIED':
        return 'bg-amber-100 text-amber-900';
      case 'VERIFIED':
        return 'bg-lime-100 text-lime-900';
      case 'APPROVED':
        return 'bg-emerald-100 text-emerald-900';
      case 'COMPLETE':
        return 'bg-teal-100 text-teal-900';
      case 'PUBLISHED':
        return 'bg-blue-100 text-blue-800';
      case 'IMPORTED':
        return 'bg-violet-100 text-violet-900';
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

  private preloadDepartmentAndFacultyData(): void {
    const results = this.dataSource();
    const departmentIds = new Set<string>();
    const facultyIds = new Set<string>();
    
    results.forEach(result => {
      // Only add if it's a valid ObjectId (24 character hex string)
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
    
    // Fetch all departments and faculties in parallel
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
          this.dataSource.set([...this.dataSource()]);
        },
        error: (error) => {
          console.error('Error preloading departments:', error);
          // Set fallback values for failed requests
          Array.from(departmentIds).forEach(id => {
            if (!this.departmentCache.has(id)) {
              this.departmentCache.set(id, { _id: id, name: 'Unknown Department', faculty: '' });
            }
          });
          this.dataSource.set([...this.dataSource()]);
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
          this.dataSource.set([...this.dataSource()]);
        },
        error: (error) => {
          console.error('Error preloading faculties:', error);
          // Set fallback values for failed requests
          Array.from(facultyIds).forEach(id => {
            if (!this.facultyCache.has(id)) {
              this.facultyCache.set(id, { _id: id, name: 'Unknown Faculty', school: '' });
            }
          });
          this.dataSource.set([...this.dataSource()]);
        }
      });
    }
  }
}
