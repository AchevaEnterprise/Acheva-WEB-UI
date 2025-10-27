import { NgClass } from '@angular/common';
import { Component, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { ISegmentSwitcher, SegmentSwitcherComponent } from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { IStudentGrade } from '../../../courses/models/student-grade.model';
import { AnalyticsChartComponent } from '../../components/analytics-chart/analytics-chart.component';
import { ReferenceTableResultUploadComponent } from '../../components/reference-table-result-upload/reference-table-result-upload.component';
import { IResult } from '../../../result-management/models/results.model';
import { ResultsService } from '../../../result-management/services/results.service';
import { ResultStatusTrackingComponent } from '../../../result-management/components/result-status-tracking/result-status-tracking.component';
import { CommentComponent } from '../../../result-management/components/comment/comment.component';
import { SchoolsService } from '../../../../@core/services/schools.service';

type SegmentValue = 'REGULAR' | 'REFERENCE' | 'UNREGISTERED';

@Component({
  selector: 'app-course-coordinator-results',
  imports: [
    SvgComponent,
    NgClass,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    AnalyticsChartComponent,
    SegmentSwitcherComponent,
    ButtonComponent,
    SearchInputComponent,
    ReferenceTableResultUploadComponent,
    CardComponent,
    ResultStatusTrackingComponent,
    CommentComponent,
  ],
  templateUrl: './course-coordinator-results.component.html',
  styleUrl: './course-coordinator-results.component.scss',
})
export class CourseCoordinatorResultsComponent {
  private readonly resultsService = inject(ResultsService);
  private readonly schoolsService = inject(SchoolsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  
  // Get result data from query params
  readonly resultId = this.route.snapshot.queryParamMap.get('resultId');
  
  courseCode = signal<string>('');
  courseTitle = signal<string>('');
  departmentName = signal<string>('');
  results = signal<IResult[]>([]);

  // Same structure as Result Upload component
  segments = signal<ISegmentSwitcher[]>([
    { label: 'Regular', value: 'REGULAR', accessRole: [RoleEnum.COURSE_COORDINATOR] },
    { label: 'Reference', value: 'REFERENCE', accessRole: [RoleEnum.COURSE_COORDINATOR] },
    { label: 'Unregistered', value: 'UNREGISTERED', accessRole: [RoleEnum.COURSE_COORDINATOR] },
  ]);

  activeSegment = signal<ISegmentSwitcher>({
    label: 'Regular',
    value: 'REGULAR',
    accessRole: [RoleEnum.COURSE_COORDINATOR],
  });

  analyticsChartData = signal<number[]>([0, 0, 0, 0, 0, 0]);
  totalStudent = signal<number>(0);
  totalStudentPass = signal<number>(0);
  totalStudentFail = signal<number>(0);
  averageGrade = signal<number>(0);
  loadingData = signal<boolean>(false);

  students = signal<Record<SegmentValue, Partial<IStudentGrade>[]>>({
    REGULAR: [],
    REFERENCE: [],
    UNREGISTERED: [],
  });

  // View child references
  regularTableResultUploadRef = viewChild<ReferenceTableResultUploadComponent>('regularTableResultUploadRef');
  referenceTableResultUploadRef = viewChild<ReferenceTableResultUploadComponent>('referenceTableResultUploadRef');
  unregisteredTableResultUploadRef = viewChild<ReferenceTableResultUploadComponent>('unregisteredTableResultUploadRef');

  constructor() {
    if (!this.resultId) {
      this.router.navigate(['/result-management']);
      return;
    }

    this.loadAllSegmentData();
    this.loadCourseDetails();
  }

  private loadAllSegmentData() {
    console.log(`CourseCoordinatorResults initializing with resultId: ${this.resultId}`);
    
    // Load data for all segments to ensure course coordinator sees complete data
    const segments: SegmentValue[] = ['REGULAR', 'REFERENCE', 'UNREGISTERED'];
    
    // Try localStorage first, then API
    segments.forEach(segment => {
      this.loadSegmentDataFromLocalStorage(segment);
      this.loadSegmentData(segment);
    });
  }

  private loadSegmentData(segment: SegmentValue) {
    if (!this.resultId) return;
    
    this.loadingData.set(true);
    
    this.resultsService.getResultEntries(this.resultId, { category: segment })
      .pipe(finalize(() => this.loadingData.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status && resp.data) {
            const { entries, studentsWithoutEntries } = resp.data;
            
            // Process all entries directly - they should contain the actual grades
            const processedEntries = (entries || []).map((student: any) => ({
              ...student,
              test: student.test ?? '-',
              lab: student.lab ?? '-', 
              exam: student.exam ?? '-',
              total: student.total ?? '-',
              grade: student.grade ?? '-',
              status: student.status ?? '-',
            }));

            // Process students without entries
            const processedStudentsWithoutEntries = (studentsWithoutEntries || []).map((student: any) => ({
              _id: student._id,
              student: student._id,
              fullName: student.fullName,
              registrationNumber: student.registrationNumber,
              test: '-',
              lab: '-',
              exam: '-', 
              total: '-',
              grade: '-',
              status: '-',
              result: this.resultId,
              category: segment,
            }));

            // Combine all arrays
            const combinedResults = [
              ...processedEntries,
              ...processedStudentsWithoutEntries,
            ];

            // Check if we have actual grade data, if not try localStorage
            const hasGradeData = combinedResults.some(student => 
              student.grade && student.grade !== '-' && student.grade !== ''
            );
            
            if (!hasGradeData && combinedResults.length > 0) {
              // API returned students but no grades, try to merge with localStorage data
              this.mergeWithLocalStorageGrades(segment, combinedResults);
            } else {
              // Update students data for this segment
              this.students.update((current) => ({
                ...current,
                [segment]: combinedResults,
              }));
            }

            // Always update analytics after data is loaded
            setTimeout(() => {
              this.updateAnalyticsForSegment(segment);
            }, 100);
          }
        },
        error: (error) => {
          this.loadSegmentDataFromLocalStorage(segment);
        },
      });
  }

  refreshData() {
    this.loadAllSegmentData();
    this.loadCourseDetails();
  }

  private loadCourseDetails() {
    if (!this.resultId) return;

    this.resultsService.getResult(this.resultId).subscribe({
      next: (resp) => {
        if (resp.status && resp.data) {
          const { course, department } = resp.data;
          
          this.courseTitle.set(course?.courseTitle || 'Unknown Course');
          this.courseCode.set(this.extractCourseCode(course?.courseTitle || ''));
          
          // Handle department - it could be an object with name or just an ID string
          if (department && typeof department === 'object' && department.name) {
            this.departmentName.set(department.name);
          } else if (department && typeof department === 'string') {
            // If it's just an ID, try to map it first, then fetch if needed
            const mappedName = this.mapDepartmentId(department);
            if (mappedName !== 'Unknown Department') {
              this.departmentName.set(mappedName);
            } else {
              this.fetchDepartmentName(department);
            }
          } else {
            this.departmentName.set('Unknown Department');
          }
        }
      },
      error: (error) => {
        this.loadCourseDetailsFromLocalStorage();
      },
    });
  }

  private fetchDepartmentName(departmentId: string) {
    // First try to map known department IDs
    const departmentName = this.mapDepartmentId(departmentId);
    if (departmentName !== 'Unknown Department') {
      this.departmentName.set(departmentName);
      return;
    }

    // If not found in mapping, try API call
    this.schoolsService.getDepartment(departmentId).subscribe({
      next: (resp) => {
        if (resp.status && resp.data) {
          const name = (resp.data as any).name || 'Unknown Department';
          this.departmentName.set(name);
        } else {
          this.departmentName.set('Unknown Department');
        }
      },
      error: (error) => {
        this.departmentName.set('Unknown Department');
      },
    });
  }

  private mapDepartmentId(departmentId: string): string {
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
    
    return departmentMap[departmentId] || 'Unknown Department';
  }

  private extractCourseCode(courseTitle: string): string {
    const codePatterns = [
      /^([A-Z]{2,4}\s*\d{3})/i,
      /^([A-Z]{2,4}-\d{3})/i,
      /^([A-Z]{2,4}\d{3})/i,
      /\b([A-Z]{2,4}\s*\d{3})\b/i,
    ];

    for (const pattern of codePatterns) {
      const match = courseTitle.match(pattern);
      if (match) {
        return match[1].replace(/\s+/g, ' ').trim();
      }
    }

    const words = courseTitle.trim().split(/\s+/);
    return words.length > 0 ? words[0] : 'UNKNOWN';
  }



  switchSegment(incoming: ISegmentSwitcher | string): void {
    let switchValue: SegmentValue;

    if (typeof incoming === 'string') {
      switchValue = incoming as SegmentValue;
    } else {
      switchValue = incoming.value as SegmentValue;
    }

    const targetSegment = this.segments().find(
      (segment) => segment.value === switchValue
    );

    if (targetSegment) {
      this.activeSegment.set(targetSegment);
      // Update analytics for the new segment immediately
      this.updateAnalyticsForSegment(switchValue);
      // Also reload data to ensure it's fresh
      this.loadSegmentData(switchValue);
    }
  }

  private updateAnalyticsForSegment(segment: SegmentValue) {
    // Get students for the specified segment
    const segmentStudents = this.students()[segment] || [];
    console.log('Current students for analytics:', segmentStudents);
    
    // Calculate analytics from actual student data
    const analytics = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    let totalPass = 0;
    let totalFail = 0;

    // Count students with valid grades
    const studentsWithGrades = segmentStudents.filter((student) => {
      return (
        student.grade !== undefined &&
        student.grade !== '-' &&
        student.grade !== '' &&
        student.grade !== null
      );
    });

    studentsWithGrades.forEach((student) => {
      if (student.grade) {
        const grade = student.grade.toString().toUpperCase();
        if (analytics.hasOwnProperty(grade)) {
          analytics[grade as keyof typeof analytics]++;
          if (['A', 'B', 'C', 'D', 'E'].includes(grade)) {
            totalPass++;
          } else if (grade === 'F') {
            totalFail++;
          }
        }
      }
    });

    const analyticsData = [
      analytics.A,
      analytics.B,
      analytics.C,
      analytics.D,
      analytics.E,
      analytics.F,
    ];

    const realTimeAnalytics = {
      segment,
      totalStudents: segmentStudents.length,
      studentsWithGrades: studentsWithGrades.length,
      totalPass,
      totalFail,
      analytics,
      analyticsData
    };
    
    console.log('Real-time analytics updated:', realTimeAnalytics);

    this.analyticsChartData.set(analyticsData);
    this.totalStudent.set(segmentStudents.length);
    this.totalStudentPass.set(totalPass);
    this.totalStudentFail.set(totalFail);

    // Calculate average grade
    const totalGrades = analyticsData.reduce((sum, count) => sum + count, 0);
    if (totalGrades > 0) {
      const weightedSum = analyticsData.reduce((sum, count, index) => {
        const gradePoints = [4, 3, 2, 1, 0, 0][index];
        return sum + (count * gradePoints);
      }, 0);
      this.averageGrade.set(Math.round((weightedSum / totalGrades) * 100 / 4));
    } else {
      this.averageGrade.set(0);
    }
  }

  goBack() {
    this.router.navigate(['/result-management']);
  }

  getDisplayStudents() {
    const activeSegmentValue = this.activeSegment().value as SegmentValue;
    return this.students()[activeSegmentValue] || [];
  }

  getStudentsForSegment(segment: SegmentValue) {
    return this.students()[segment] || [];
  }

  getGradeClass(grade: string): string {
    const gradeClasses: Record<string, string> = {
      A: 'bg-green-100 text-green-800',
      B: 'bg-blue-100 text-blue-800', 
      C: 'bg-yellow-100 text-yellow-800',
      D: 'bg-orange-100 text-orange-800',
      E: 'bg-orange-200 text-orange-900',
      F: 'bg-red-100 text-red-800',
      '-': 'bg-gray-100 text-gray-500',
    };
    return gradeClasses[grade] || 'bg-gray-100 text-gray-800';
  }

  getStatusClass(status: string): string {
    const statusClasses: Record<string, string> = {
      Pass: 'bg-green-100 text-green-800',
      Fail: 'bg-red-100 text-red-800', 
      PASS: 'bg-green-100 text-green-800',
      FAIL: 'bg-red-100 text-red-800',
      PENDING: 'bg-gray-100 text-gray-800',
    };
    return statusClasses[status] || 'bg-gray-100 text-gray-800';
  }

  private loadCourseDetailsFromLocalStorage() {
    const resultManagementList = JSON.parse(localStorage.getItem('result_management_list') || '[]');
    const resultDraftsList = JSON.parse(localStorage.getItem('result_drafts_list') || '[]');
    
    const localResult = [...resultManagementList, ...resultDraftsList]
      .find((item: any) => item.resultId === this.resultId);
    
    if (localResult) {
      this.courseTitle.set(localResult.courseTitle || 'Unknown Course');
      this.courseCode.set(localResult.courseCode || this.extractCourseCode(localResult.courseTitle || ''));
      this.departmentName.set(localResult.department || 'Unknown Department');
    } else {
      this.courseTitle.set('Unknown Course');
      this.courseCode.set('UNKNOWN');
      this.departmentName.set('Unknown Department');
    }
  }

  private loadSegmentDataFromLocalStorage(segment: SegmentValue) {
    console.log(`Attempting to load draft for key: result_draft_${this.resultId}_${segment}`);
    
    // Primary key format used by result upload component
    const draftKey = `result_draft_${this.resultId}_${segment}`;
    const storedDraft = localStorage.getItem(draftKey);
    
    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft);
        console.log('Draft found:', draft);
        
        if (draft && draft.students && Array.isArray(draft.students)) {
          console.log(`Draft students count: ${draft.students.length}`);
          console.log('Current students for analytics:', draft.students);
          
          this.students.update((current) => ({
            ...current,
            [segment]: draft.students,
          }));
          
          // Always update analytics after loading from localStorage
          setTimeout(() => {
            this.updateAnalyticsForSegment(segment);
            console.log(`Analytics updated after loading ${segment} - students count: ${draft.students.length}`);
          }, 50);
          
          console.log(`Successfully loaded ${draft.students.length} students from draft: ${draft.timestamp}`);
          return;
        }
      } catch (error) {
        console.error('Error parsing draft data:', error);
      }
    }
    
    // Fallback: Try other possible keys
    const possibleKeys = [
      `student_data_${this.resultId}_${segment}`,
      `result_${this.resultId}_${segment}_students`,
      `students_${this.resultId}_${segment}`,
      `${this.resultId}_${segment}`
    ];
    
    let studentData: any[] = [];
    
    for (const key of possibleKeys) {
      const storedData = localStorage.getItem(key);
      if (storedData) {
        try {
          studentData = JSON.parse(storedData);
          if (Array.isArray(studentData) && studentData.length > 0) {
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }
    
    // If no specific student data found, try to get from result drafts
    if (studentData.length === 0) {
      const resultDraftsList = JSON.parse(localStorage.getItem('result_drafts_list') || '[]');
      const resultManagementList = JSON.parse(localStorage.getItem('result_management_list') || '[]');
      
      const allResults = [...resultDraftsList, ...resultManagementList];
      const matchingResult = allResults.find((item: any) => item.resultId === this.resultId);
      
      if (matchingResult && matchingResult.students) {
        studentData = matchingResult.students.filter((s: any) => 
          !s.category || s.category === segment || segment === 'REGULAR'
        );
      }
    }
    
    this.students.update((current) => ({
      ...current,
      [segment]: studentData,
    }));
    
    // Always update analytics after loading data
    setTimeout(() => {
      this.updateAnalyticsForSegment(segment);
    }, 50);
  }

  // CRITICAL FIX: Save changes method for Course Coordinator
  saveChanges(): void {
    const activeSegmentValue = this.activeSegment().value as SegmentValue;
    let tableRef: ReferenceTableResultUploadComponent | undefined;
    
    // Get the appropriate table reference
    switch (activeSegmentValue) {
      case 'REGULAR':
        tableRef = this.regularTableResultUploadRef();
        break;
      case 'REFERENCE':
        tableRef = this.referenceTableResultUploadRef();
        break;
      case 'UNREGISTERED':
        tableRef = this.unregisteredTableResultUploadRef();
        break;
    }
    
    if (tableRef) {
      // Trigger manual save on the active table
      tableRef.manualSave();
      console.log(`Saved changes for ${activeSegmentValue} segment`);
      
      // Also update the local students signal with current data
      const currentData = tableRef.getAllCurrentData();
      this.students.update((current) => ({
        ...current,
        [activeSegmentValue]: currentData,
      }));
      
      // Update analytics
      this.updateAnalyticsForSegment(activeSegmentValue);
    }
  }

  private mergeWithLocalStorageGrades(segment: SegmentValue, apiStudents: any[]) {
    // Primary key format used by result upload component
    const draftKey = `result_draft_${this.resultId}_${segment}`;
    const storedDraft = localStorage.getItem(draftKey);
    
    let localStudents: any[] = [];
    
    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft);
        if (draft && draft.students && Array.isArray(draft.students)) {
          localStudents = draft.students;
        }
      } catch (error) {
        console.error('Error parsing draft data:', error);
      }
    }
    
    // Fallback: Try other possible keys
    if (localStudents.length === 0) {
      const possibleKeys = [
        `student_data_${this.resultId}_${segment}`,
        `result_${this.resultId}_${segment}_students`,
        `students_${this.resultId}_${segment}`,
        `${this.resultId}_${segment}`
      ];
      
      for (const key of possibleKeys) {
        const storedData = localStorage.getItem(key);
        if (storedData) {
          try {
            const data = JSON.parse(storedData);
            if (Array.isArray(data) && data.length > 0) {
              localStudents = data;
              break;
            }
          } catch (error) {
            continue;
          }
        }
      }
    }
    
    // If no specific data found, try result drafts
    if (localStudents.length === 0) {
      const resultDraftsList = JSON.parse(localStorage.getItem('result_drafts_list') || '[]');
      const resultManagementList = JSON.parse(localStorage.getItem('result_management_list') || '[]');
      
      const allResults = [...resultDraftsList, ...resultManagementList];
      const matchingResult = allResults.find((item: any) => item.resultId === this.resultId);
      
      if (matchingResult && matchingResult.students) {
        localStudents = matchingResult.students;
      }
    }
    
    // Merge API student info with localStorage grades
    const mergedStudents = apiStudents.map(apiStudent => {
      const localStudent = localStudents.find(ls => 
        ls._id === apiStudent._id || 
        ls.student === apiStudent._id ||
        ls.registrationNumber === apiStudent.registrationNumber
      );
      
      if (localStudent) {
        return {
          ...apiStudent,
          test: localStudent.test ?? apiStudent.test,
          lab: localStudent.lab ?? apiStudent.lab,
          exam: localStudent.exam ?? apiStudent.exam,
          total: localStudent.total ?? apiStudent.total,
          grade: localStudent.grade ?? apiStudent.grade,
          status: localStudent.status ?? apiStudent.status,
        };
      }
      
      return apiStudent;
    });
    
    this.students.update((current) => ({
      ...current,
      [segment]: mergedStudents,
    }));
  }
}