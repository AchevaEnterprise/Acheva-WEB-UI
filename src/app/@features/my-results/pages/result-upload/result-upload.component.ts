import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { IDepartment } from '../../../../@core/models/school.model';
import { ToastService } from '../../../../@core/utility/toast.service';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';

import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { IStudentGrade } from '../../../courses/models/student-grade.model';
import { ResultsService } from '../../../result-management/services/results.service';
import { StudentService } from '../../../students/services/student.service';
import { AnalyticsChartComponent } from '../../components/analytics-chart/analytics-chart.component';
import { ReferenceTableResultUploadComponent } from '../../components/reference-table-result-upload/reference-table-result-upload.component';
import { DeleteConfirmationDialogComponent } from '../../components/app-delete-confirmation-dialog/app-delete-confirmation-dialog.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
type SegmentValue = 'REGULAR' | 'REFERENCE' | 'UNREGISTERED';

@Component({
  selector: 'app-result-upload',
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    CardComponent,
    SegmentSwitcherComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatMenuModule,
    AnalyticsChartComponent,
    MatDividerModule,
    ButtonComponent,
    MatRadioModule,
    SearchInputComponent,
    MatDialogModule,
    ReferenceTableResultUploadComponent,
  ],
  templateUrl: './result-upload.component.html',
  styleUrl: './result-upload.component.scss',
})
export class ResultUploadComponent implements OnInit {
  // Utility to map all grade fields from 0/undefined/'' to '-'
  private mapStudentFieldsToDash(
    student: Partial<IStudentGrade>
  ): Partial<IStudentGrade> {
    const fields = ['test', 'lab', 'exam', 'total', 'grade', 'status'];
    const mapped: any = { ...student };
    for (const field of fields) {
      if (mapped[field] === undefined || mapped[field] === '') {
        mapped[field] = '-';
      }
    }
    return mapped;
  }

  // Utility to map an array of students
  private mapStudentsArrayToDash(
    students: Partial<IStudentGrade>[]
  ): Partial<IStudentGrade>[] {
    return students.map((s) => this.mapStudentFieldsToDash(s));
  }
  // ========================================
  // DEPENDENCY INJECTION
  // ========================================
  private readonly resultsService = inject(ResultsService);
  private readonly studentService = inject(StudentService);
  private readonly authService = inject(AuthenticationService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  deletingEntries = signal<boolean>(false);
  selectedStudentsWithIds = signal<Partial<IStudentGrade & { _id: string }>[]>(
    []
  );

  // ========================================
  // COMPONENT PROPERTIES
  // ========================================
  readonly resultId = this.route.snapshot.queryParamMap.get('resultId');

  // Separate view child references for each segment
  referenceTableResultUploadRef =
    viewChild<ReferenceTableResultUploadComponent>(
      'referenceTableResultUploadRef'
    );

  unregisteredTableResultUploadRef =
    viewChild<ReferenceTableResultUploadComponent>(
      'unregisteredTableResultUploadRef'
    );

  // ========================================
  // SIGNALS AND REACTIVE STATE
  // ========================================
  segments = signal<ISegmentSwitcher[]>([
    {
      label: 'Regular',
      value: 'REGULAR',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Reference',
      value: 'REFERENCE',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Unregistered',
      value: 'UNREGISTERED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
  ]);

  activeSegment = signal<ISegmentSwitcher>({
    label: 'Regular',
    value: 'REGULAR',
    accessRole: [
      RoleEnum.DEAN,
      RoleEnum.HOD,
      RoleEnum.COURSE_ADVISOR,
      RoleEnum.COURSE_COORDINATOR,
      RoleEnum.LECTURER,
    ],
  });

  analyticsChartData = signal<number[]>([0, 0, 0, 0, 0, 0]);
  totalStudent = signal<number>(0);
  totalStudentPass = signal<number>(0);
  totalStudentFail = signal<number>(0);

  uploadingResult = signal<boolean>(false);
  selectedStudents = signal<Partial<IStudentGrade>[]>([]);

  // Updated students signal with proper initialization
  students = signal<Record<SegmentValue, Partial<IStudentGrade>[]>>({
    REGULAR: [],
    REFERENCE: [],
    UNREGISTERED: [],
  });
  // Save button state

  // Helper to create a blank student row with dashes
  createBlankStudent(): Partial<IStudentGrade> {
    // Always return mapped blank student
    return this.mapStudentFieldsToDash({
      registrationNumber: '',
      fullName: '',
      test: '-',
      lab: '-',
      exam: '-',
      total: '-',
      grade: '-',
      status: '-',
    });
  }

  // Track loading state for data fetching
  loadingData = signal<boolean>(false);

  // Auto-save and draft management
  private autoSaveTimer: any = null;
  private debouncedUpdateTimer: any = null;
  isDraftMode = signal<boolean>(false);
  hasUnsavedChanges = signal<boolean>(false);

  // Save button state
  canSaveChanges = signal<boolean>(false);

  // ========================================
  // FORMS
  // ========================================
  courseForm = new FormGroup({
    course: new FormControl({ value: '', disabled: true }),
    session: new FormControl({ value: '', disabled: true }),
    level: new FormControl({ value: '', disabled: true }),
    category: new FormControl('regular'),
  });

  // canSaveChanges(): boolean {
  //   // Only allow save if there are unsaved changes
  //   return !!this.hasUnsavedChanges && this.hasUnsavedChanges();
  // }

  constructor() { }

  // Helper method to extract course code from course title
  private extractCourseCode(courseTitle: string): string {
    // Look for patterns like "CSC 101", "ENG-201", "MATH101", etc.
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

    // If no pattern matches, return first few words or fallback
    const words = courseTitle.trim().split(/\s+/);
    return words.length > 0 ? words[0] : 'UNKNOWN';
  }

  // Helper method to extract units from course title
  private extractUnitsFromCourse(courseTitle: string): number {
    // Look for patterns like "3 units", "(3)", "3U", etc.
    const unitPatterns = [
      /\b(\d+)\s*units?\b/i,
      /\((\d+)\)/,
      /\b(\d+)U\b/i,
      /\b(\d+)\s*credit/i,
    ];

    for (const pattern of unitPatterns) {
      const match = courseTitle.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    // Default to 3 units if not found
    return 3;
  }

  // ========================================
  // LIFECYCLE HOOKS
  // ========================================
  ngOnInit(): void {
    console.log(
      'ResultUpload component initializing with resultId:',
      this.resultId
    );

    this.categoryListener();

    if (!this.resultId) {
      console.error('No resultId found in query parameters');
      this.toast.showNotification(
        'error',
        'Missing Data',
        'Result ID is required'
      );
      return;
    }

    try {
      // Always try to load data, don't let getResult errors block initialization
      this.getResult();

      // Try to load from draft first, then from API
      if (!this.loadFromDraft()) {
        this.getResultEntries();
      }

      // Force analytics update after all data loading attempts
      setTimeout(() => {
        this.updateAnalyticsRealTime();
        console.log('Analytics updated after init - students count:', this.students()[this.activeSegment().value as SegmentValue]?.length || 0);
      }, 200);
    } catch (error) {
      console.error('Error during component initialization:', error);
      // Still try to load result entries even if initialization has issues
      this.getResultEntries();
      // Still update analytics even if there are errors
      this.updateAnalyticsRealTime();
    }
  }

  ngOnDestroy(): void {
    // Auto-save before leaving if there are unsaved changes
    if (this.hasUnsavedChanges()) {
      this.saveToDraft();
    }
  }

  // ========================================
  // DATA FETCHING METHODS
  // ========================================
  getStudentsInDepartmentAndLevel(departmentId: string, level: string) {
    this.studentService
      .getStudentsInDepartmentAndLevel(departmentId, level)
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            console.warn('Students in department and level:', resp.data);
            // Data will be handled by getResultEntries()
          }
        },
        error: (error) => {
          console.error(
            'Error fetching students by department and level:',
            error
          );
        },
      });
  }

  getResult() {
    console.log('Getting result for ID:', this.resultId);
    this.loadingData.set(true);

    if (!this.resultId) {
      console.error('No resultId available for getResult');
      this.loadingData.set(false);
      return;
    }

    this.resultsService
      .getResult(this.resultId!)
      .pipe(
        finalize(() => {
          console.log('getResult finalized');
          this.loadingData.set(false);
        })
      )
      .subscribe({
        next: (resp) => {
          console.log('getResult response:', resp);
          if (resp.status && resp.data) {
            const { analytics, course, session, level } = resp.data as {
              course: { courseTitle: string; courseCode: string };
              session: string;
              level: string;
              analytics: Record<string, number>;
              department: IDepartment;
            };

            // Use courseCode if available, otherwise extract from courseTitle
            const displayCourseCode = course?.courseCode || this.extractCourseCode(course?.courseTitle || '');
            
            this.courseForm.patchValue({
              course: `${displayCourseCode} - ${course?.courseTitle || 'Unknown Course'}`,
              session: session || 'Unknown Session',
              level: level || 'Unknown Level',
            });

            const analyticsData = [
              analytics?.['A'] || 0,
              analytics?.['B'] || 0,
              analytics?.['C'] || 0,
              analytics?.['D'] || 0,
              analytics?.['E'] || 0,
              analytics?.['F'] || 0,
            ];

            this.analyticsChartData.set(analyticsData);
            this.totalStudent.set(analytics?.['total'] || 0);
            this.totalStudentPass.set(analytics?.['totalPass'] || 0);
            this.totalStudentFail.set(analytics?.['totalFail'] || 0);

            console.log('Result data loaded successfully');
          } else {
            console.error('getResult failed - status false or no data:', resp);
            // Don't show error toast if just missing data, continue with defaults
            console.log('Continuing with default values');
          }
        },
        error: (error) => {
          console.error('Error fetching result - full error:', error);
          console.error('Error status:', error.status);
          console.error('Error message:', error.message);
          // Don't show error toast, just log and continue
          console.log('Continuing despite getResult error');
        },
      });
  }

  getResultEntries() {
    console.log(
      'Getting result entries for:',
      this.resultId,
      'category:',
      this.activeSegment().value
    );
    this.loadingData.set(true);

    this.resultsService
      .getResultEntries(this.resultId!, {
        category: this.activeSegment().value,
      })
      .pipe(
        finalize(() => {
          console.log('getResultEntries finalized');
          this.loadingData.set(false);
        })
      )
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            const {
              analytics,
              total,
              totalPass,
              totalFail,
              entries,
              studentsWithoutEntries,
            } = resp.data as {
              analytics: Record<string, number>;
              total: number;
              totalPass: number;
              totalFail: number;
              entries: Partial<IStudentGrade>[];
              studentsWithoutEntries: Array<{
                _id: string;
                fullName: string;
                registrationNumber: string;
              }>;
            };

            const analyticsData = [
              analytics['A'] || 0,
              analytics['B'] || 0,
              analytics['C'] || 0,
              analytics['D'] || 0,
              analytics['E'] || 0,
              analytics['F'] || 0,
            ];

            // Calculate total students including those without grades
            const totalStudentsCount =
              (entries?.length || 0) + (studentsWithoutEntries?.length || 0);

            this.analyticsChartData.set(analyticsData);
            this.totalStudent.set(totalStudentsCount);
            this.totalStudentPass.set(totalPass || 0);
            this.totalStudentFail.set(totalFail || 0);

            console.log('Full API Response:', resp.data);
            console.log('Raw entries from API:', entries);
            console.log(
              'Raw studentsWithoutEntries from API:',
              studentsWithoutEntries
            );
            // Map all grade fields to dash before updating state
            const mappedEntries = this.mapStudentsArrayToDash(entries || []);
            const mappedStudentsWithoutEntries = this.mapStudentsArrayToDash(
              studentsWithoutEntries || []
            );
            console.log('Mapped entries for UI:', mappedEntries);
            console.log(
              'Mapped studentsWithoutEntries for UI:',
              mappedStudentsWithoutEntries
            );
            console.log('Analytics from getResultEntries:', {
              total,
              totalPass,
              totalFail,
              analytics,
              entriesCount: mappedEntries.length,
              studentsWithoutEntriesCount: mappedStudentsWithoutEntries.length,
              calculatedTotal: totalStudentsCount,
            });
            const segmentKey = this.activeSegment().value as SegmentValue;

            // Filter entries to separate students with actual results from those without
            const studentsWithActualResults: Partial<IStudentGrade>[] = [];
            const studentsWithoutActualResults: Partial<IStudentGrade>[] = [];

            (entries || []).forEach((student, index) => {
              console.log(`Processing entry ${index}:`, student);

              // Treat 0 as a valid input; only show dash if all are empty/null/undefined
              const hasActualResults = [
                student.test,
                student.lab,
                student.exam,
                student.total,
              ].some(
                (v) =>
                  v !== undefined && v !== null && v !== '' && !isNaN(Number(v))
              );

              console.log(
                `Entry ${index} has actual results:`,
                hasActualResults,
                {
                  test: student.test,
                  lab: student.lab,
                  exam: student.exam,
                  total: student.total,
                }
              );

              if (hasActualResults) {
                studentsWithActualResults.push(student);
              } else {
                studentsWithoutActualResults.push(student);
              }
            });

            console.log(
              'Students with actual results:',
              studentsWithActualResults.length
            );
            console.log(
              'Students without actual results:',
              studentsWithoutActualResults.length
            );

            // Process students with actual results
            const processedEntries = studentsWithActualResults.map(
              (student) => ({
                ...student,
                test: student.test ?? '-',
                lab: student.lab ?? '-',
                exam: student.exam ?? '-',
                total: student.total ?? '-',
                grade: student.grade ?? '-',
                status: student.status ?? '-',
              })
            );

            // Process students from entries who don't have actual results (show dashes)
            const processedStudentsFromEntries =
              studentsWithoutActualResults.map((student) => ({
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
                category: this.activeSegment().value,
              }));

            // Process students without entries (show ID, name and registration number with dashes for grades)
            const processedStudentsWithoutEntries = (
              studentsWithoutEntries || []
            ).map((student) => ({
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
              category: this.activeSegment().value,
            }));

            // Combine all arrays
            const combinedResults = [
              ...processedEntries,
              ...processedStudentsFromEntries,
              ...processedStudentsWithoutEntries,
            ];

            console.log('Final combined results breakdown:', {
              processedEntries: processedEntries.length,
              processedStudentsFromEntries: processedStudentsFromEntries.length,
              processedStudentsWithoutEntries:
                processedStudentsWithoutEntries.length,
              totalCombined: combinedResults.length,
            });

            if (combinedResults.length === 1) {
              console.warn(
                'WARNING: Only 1 result found. This might indicate a data processing issue.'
              );
              console.log('Single result details:', combinedResults[0]);
            }

            // Set loading flag to prevent table emissions during data loading
            this.isLoadingData = true;

            // Use update to preserve other segment data
            this.students.update((current) => ({
              ...current,
              [segmentKey]: this.mapStudentsArrayToDash(combinedResults),
            }));

            // Clear loading flag after data is set
            this.isLoadingData = false;

            // Force immediate analytics update
            setTimeout(() => {
              this.updateAnalyticsRealTime();
            }, 0);

            console.log(
              'Students data updated for segment:',
              segmentKey,
              'Total students:',
              combinedResults.length
            );
            console.log('Combined results breakdown:', {
              processedEntries: processedEntries.length,
              processedStudentsFromEntries: processedStudentsFromEntries.length,
              processedStudentsWithoutEntries:
                processedStudentsWithoutEntries.length,
              combinedTotal: combinedResults.length,
            });
            console.log(
              'Sample combined results:',
              combinedResults.slice(0, 3)
            );
          }
        },
        error: (error) => {
          console.error('Error fetching result entries:', error);
          this.toast.showNotification(
            'error',
            'Data Load Error',
            'Failed to load student result entries'
          );
        },
      });
  }

  // ========================================
  // SEGMENT SWITCHING METHODS
  // ========================================
  categoryListener() {
    this.courseForm.get('category')?.valueChanges.subscribe({
      next: (value) => {
        // Map form control values to SegmentValue
        const mappedValue = this.mapFormValueToSegment(value!);
        if (mappedValue) {
          this.performSwitch(mappedValue);
        }
      },
    });
  }

  private mapFormValueToSegment(formValue: string): SegmentValue | null {
    const mapping: Record<string, SegmentValue> = {
      regular: 'REGULAR',
      reference: 'REFERENCE',
      unregistered: 'UNREGISTERED',
    };
    return mapping[formValue] || null;
  }

  switchSegment(incoming: ISegmentSwitcher | string): void {
    let switchValue: SegmentValue;

    if (typeof incoming === 'string') {
      switchValue = incoming as SegmentValue;
    } else {
      switchValue = incoming.value as SegmentValue;
    }
    this.performSwitch(switchValue);
  }

  performSwitch(switchValue: SegmentValue) {
    console.log('=== SEGMENT SWITCH START ===');
    console.log(
      'Switching from',
      this.activeSegment().value,
      'to',
      switchValue
    );

    // Always save current segment data as draft before switching (to preserve all data)
    const currentSegment = this.activeSegment().value as SegmentValue;
    const currentStudents = this.students()[currentSegment] || [];

    console.log(
      'Current segment students before switch:',
      currentStudents.length
    );
    console.log('Current students data:', currentStudents.slice(0, 2)); // Show first 2 for debugging

    if (currentStudents.length > 0) {
      console.log(
        'Saving current segment data before switch:',
        currentStudents.length,
        'students'
      );
      this.saveToDraft();
    }

    const targetSegment = this.segments().find(
      (segment) => segment.value === switchValue
    );

    if (targetSegment) {
      this.activeSegment.set(targetSegment);
      console.log('Active segment updated to:', switchValue);
    }

    // Update form control to match the segment (without emitting to prevent loops)
    const formValue = this.mapSegmentToFormValue(switchValue);
    if (formValue) {
      this.courseForm
        .get('category')
        ?.patchValue(formValue, { emitEvent: false });
    }

    // Check what data exists for the new segment
    const newSegmentStudents = this.students()[switchValue] || [];
    console.log(
      'New segment existing data:',
      newSegmentStudents.length,
      'students'
    );

    // Try to load from draft first, then from API
    console.log('Loading data for new segment:', switchValue);
    if (!this.loadFromDraft()) {
      console.log('No draft found, loading from API');
      this.getResultEntries();
    } else {
      // If draft was loaded, ensure analytics are updated immediately
      setTimeout(() => {
        this.updateAnalyticsRealTime();
      }, 0);
    }
    console.log('=== SEGMENT SWITCH END ===');
  }

  private mapSegmentToFormValue(segmentValue: SegmentValue): string | null {
    const mapping: Record<SegmentValue, string> = {
      REGULAR: 'regular',
      REFERENCE: 'reference',
      UNREGISTERED: 'unregistered',
    };
    return mapping[segmentValue] || null;
  }

  // ========================================
  // SAVE CHANGES METHOD
  // ========================================
  saveChanges() {
    if (!this.canSaveChanges()) {
      this.toast.showNotification(
        'warning',
        'Incomplete Data',
        'Please fill in all necessary rows in the table before saving'
      );
      return;
    }

    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '600px',
      data: {
        message: 'Are you sure you want to save these changes?  if you save these changes, You can now send to the course coordinator.',
        subTitle: 'Kindly confirm this action'
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.performSaveAndNavigate();
      }
    });
  }

  private performSaveAndNavigate() {
    const currentSegment = this.activeSegment().value as SegmentValue;
    const currentStudents = this.students()[currentSegment] || [];

    console.log('performSaveAndNavigate - Current students data:', currentStudents.slice(0, 2));
    console.log('performSaveAndNavigate - Total students:', currentStudents.length);

    // Filter only students with actual data changes
    const updatedEntries = currentStudents
      .filter((student) => {
        const hasScores =
          student.test !== '-' || student.lab !== '-' || student.exam !== '-';
        return hasScores && student._id;
      })
      .map((student) => ({
        _id: student._id,
        test: student.test === '-' ? 0 : Number(student.test),
        lab: student.lab === '-' ? 0 : Number(student.lab),
        exam: student.exam === '-' ? 0 : Number(student.exam),
        total: student.total === '-' ? 0 : Number(student.total),
      }));

    console.log('performSaveAndNavigate - Updated entries:', updatedEntries.length);

    if (updatedEntries.length === 0) {
      this.toast.showNotification(
        'warning',
        'No Changes',
        'No changes to save'
      );
      return;
    }

    // Force update analytics to ensure all data is current
    this.updateAnalyticsRealTime();
    
    // Force table components to emit their current data
    this.forceTableDataEmission();
    
    // Small delay to ensure all data is captured
    setTimeout(() => {
      // Transfer to Result Management with current data
      this.transferToResultManagement();
    }, 100);

    this.resultsService
      .updateResultEntriesWithAnalytics(this.resultId!, updatedEntries)
      .subscribe({
        next: (resp: any) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Success',
              'Changes saved successfully and moved to Results Management'
            );
            // Navigate to result management
            this.router.navigate(['/result-management']);
          } else {
            console.warn('Save changes response status false:', resp);
            this.toast.showNotification(
              'error',
              'Error',
              resp.message || 'Failed to save changes'
            );
          }
        },
        error: (error: any) => {
          console.error('Error saving changes:', error);
          this.toast.showNotification(
            'error',
            'Error',
            'Failed to save changes'
          );
        },
      });
  }

  private updateAnalyticsFromResponse(data: any) {
    if (!data) {
      console.warn('Analytics response data is null or undefined');
      return;
    }

    if (data.analytics) {
      const analyticsData = [
        data.analytics['A'] || 0,
        data.analytics['B'] || 0,
        data.analytics['C'] || 0,
        data.analytics['D'] || 0,
        data.analytics['E'] || 0,
        data.analytics['F'] || 0,
      ];
      this.analyticsChartData.set(analyticsData);
    }

    if (data.total !== undefined) this.totalStudent.set(data.total);
    if (data.totalPass !== undefined) this.totalStudentPass.set(data.totalPass);
    if (data.totalFail !== undefined) this.totalStudentFail.set(data.totalFail);
  }

  // ========================================
  // ANALYTICS METHODS
  // ========================================
  getAnalytics() {
    this.resultsService.getResultAnalytics(this.resultId!).subscribe({
      next: (resp: any) => {
        if (resp.status && resp.data) {
          const { total, totalPass, totalFail, analytics } = resp.data;

          // Update analytics chart data
          const analyticsData = [
            analytics['A'] || 0,
            analytics['B'] || 0,
            analytics['C'] || 0,
            analytics['D'] || 0,
            analytics['E'] || 0,
            analytics['F'] || 0,
          ];

          this.analyticsChartData.set(analyticsData);
          this.totalStudent.set(total || 0);
          this.totalStudentPass.set(totalPass || 0);
          this.totalStudentFail.set(totalFail || 0);
        }
      },
      error: (error: any) => {
        console.error('Error fetching analytics:', error);
      },
    });
  }

  // ========================================
  // REAL-TIME ANALYTICS UPDATE
  // ========================================
  updateAnalyticsRealTime() {
    const currentSegment = this.activeSegment().value as SegmentValue;
    const currentStudents = this.students()[currentSegment] || [];

    console.log('Current students for analytics:', currentStudents);

    const analytics = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    let totalPass = 0;
    let totalFail = 0;

    // Count students with valid grades for grade distribution
    const studentsWithGrades = currentStudents.filter((student) => {
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

    this.analyticsChartData.set(analyticsData);
    // Show total students immediately, not just those with grades
    this.totalStudent.set(currentStudents.length);
    this.totalStudentPass.set(totalPass);
    this.totalStudentFail.set(totalFail);

    // Update save button state
    this.updateSaveButtonState();

    console.log('Real-time analytics updated:', {
      segment: currentSegment,
      totalStudents: currentStudents.length,
      studentsWithGrades: studentsWithGrades.length,
      totalPass,
      totalFail,
      analytics,
      analyticsData,
    });
  }

  onDataChange() {
    this.updateAnalyticsRealTime();
  }

  onStudentDataUpdate() {
    setTimeout(() => {
      this.updateAnalyticsRealTime();
    }, 100);
  }

  // ========================================
  // AUTO-SAVE AND DRAFT FUNCTIONALITY
  // ========================================
  private isUpdatingData = false;
  private isLoadingData = false;

  onTableDataChanged(updatedData: Partial<IStudentGrade>[]) {
    // Prevent infinite loops and ignore changes during data loading
    if (this.isUpdatingData || this.isLoadingData || this.loadingData()) {
      console.log(
        'Skipping table data change - updating:',
        this.isUpdatingData,
        'loading:',
        this.isLoadingData || this.loadingData()
      );
      return;
    }

    console.log(
      'Table data changed - received:',
      updatedData?.length || 0,
      'items'
    );

    const currentSegment = this.activeSegment().value as SegmentValue;

    // Mark as having unsaved changes immediately
    this.hasUnsavedChanges.set(true);

    // Clear existing debounced update timer
    if (this.debouncedUpdateTimer) {
      clearTimeout(this.debouncedUpdateTimer);
    }

    // Debounce the data update to prevent focus loss during typing
    // Always map updatedData to dash before updating
    const mappedData = this.mapStudentsArrayToDash(updatedData);
    this.debouncedUpdateTimer = setTimeout(() => {
      this.performDebouncedUpdate(mappedData, currentSegment);
    }, 1500); // Wait 1.5 seconds after user stops typing
  }

  private performDebouncedUpdate(
    updatedData: Partial<IStudentGrade>[],
    currentSegment: SegmentValue
  ) {
    console.log('Performing debounced update for segment:', currentSegment);

    this.isUpdatingData = true;

    // Update students data
    this.students.update((current) => {
      const updated = {
        ...current,
        [currentSegment]: updatedData,
      };
      console.log(
        'Students updated - new count for',
        currentSegment,
        ':',
        updated[currentSegment]?.length
      );
      return updated;
    });

    // Use setTimeout to break the execution cycle
    setTimeout(() => {
      this.updateAnalyticsRealTime();
      this.scheduleAutoSave();
      this.isUpdatingData = false;
    }, 60);
  }

  private scheduleAutoSave() {
    // Clear existing timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // Schedule auto-save after 1 minute of inactivity
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveChanges();
    }, 60);
  }

  private autoSaveChanges() {
    if (!this.hasUnsavedChanges()) return;

    const currentSegment = this.activeSegment().value as SegmentValue;
    const currentStudents = this.students()[currentSegment] || [];

    // Filter students with actual changes
    const changedEntries = currentStudents
      .filter((student) => {
        const hasScores =
          student.test !== '-' || student.lab !== '-' || student.exam !== '-';
        return hasScores && student._id;
      })
      .map((student) => ({
        _id: student._id,
        test: student.test === '-' ? 0 : Number(student.test),
        lab: student.lab === '-' ? 0 : Number(student.lab),
        exam: student.exam === '-' ? 0 : Number(student.exam),
        total: student.total === '-' ? 0 : Number(student.total),
        grade: student.grade === '-' ? null : student.grade,
        status: student.status === '-' ? null : student.status,
      }));

    if (changedEntries.length === 0) return;

    // Save as draft first
    this.saveToDraft(changedEntries);

    // Auto-save to backend
    this.resultsService
      .updateResultEntriesWithAnalytics(this.resultId!, changedEntries)
      .subscribe({
        next: (resp: any) => {
          if (resp.status) {
            this.hasUnsavedChanges.set(false);
            if (resp.data) {
              this.updateAnalyticsFromResponse(resp.data);
            }
            console.log('Auto-saved successfully');
          } else {
            console.warn('Auto-save response status false:', resp);
          }
        },
        error: (error: any) => {
          console.error('Auto-save failed:', error);
          // Keep as draft if auto-save fails
          this.isDraftMode.set(true);
        },
      });
  }

  private saveToDraft(entries?: any[]) {
    const draftKey = `result_draft_${this.resultId}_${this.activeSegment().value}`;
    const currentSegment = this.activeSegment().value as SegmentValue;
    const currentStudents = this.students()[currentSegment] || [];

    console.log(
      'Attempting to save draft for segment:',
      currentSegment,
      'Students count:',
      currentStudents.length
    );

    if (currentStudents.length === 0) {
      console.log('No students to save, skipping draft save');
      return;
    }

    // Calculate completion percentage
    const studentsWithGrades = currentStudents.filter(
      (s) =>
        (s.test !== undefined && s.test !== '-' && s.test !== '') ||
        (s.lab !== undefined && s.lab !== '-' && s.lab !== '') ||
        (s.exam !== undefined && s.exam !== '-' && s.exam !== '')
    );

    const completionPercentage =
      currentStudents.length > 0
        ? Math.round((studentsWithGrades.length / currentStudents.length) * 100)
        : 0;

    // Get course details from form
    const courseDetails = {
      courseTitle: this.courseForm.get('course')?.value || 'Unknown Course',
      session: this.courseForm.get('session')?.value || 'Unknown Session',
      level: this.courseForm.get('level')?.value || 'Unknown Level',
      units: this.extractUnitsFromCourse(
        this.courseForm.get('course')?.value || ''
      ),
    };

    const draftData = {
      resultId: this.resultId,
      segment: this.activeSegment().value,
      entries: entries || studentsWithGrades,
      timestamp: new Date().toISOString(),
      students: currentStudents,
      // Enhanced draft metadata
      courseDetails,
      totalStudents: currentStudents.length,
      studentsWithGrades: studentsWithGrades.length,
      completionPercentage,
      isDraft: true,
    };

    try {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
      this.isDraftMode.set(true);

      // Also save to main drafts list with enhanced data
      this.addToMainDraftsList(draftData);

      console.log(
        'Draft saved successfully:',
        draftKey,
        'with',
        currentStudents.length,
        'students'
      );
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }

  private addToMainDraftsList(draftData: any) {
    const draftsKey = 'result_drafts_list';
    const existingDrafts = JSON.parse(localStorage.getItem(draftsKey) || '[]');

    const draftInfo = {
      resultId: this.resultId,
      timestamp: new Date().toISOString(),
      segments: [this.activeSegment().value],
      // Enhanced draft info
      courseDetails: draftData.courseDetails,
      totalStudents: draftData.totalStudents,
      studentsWithGrades: draftData.studentsWithGrades,
      completionPercentage: draftData.completionPercentage,
      isDraft: true
    };

    // Check if draft already exists
    const existingIndex = existingDrafts.findIndex(
      (d: any) => d.resultId === this.resultId
    );

    if (existingIndex >= 0) {
      // Update existing draft with aggregated data from all segments
      const existing = existingDrafts[existingIndex];
      const updatedSegments = [...new Set([...existing.segments, this.activeSegment().value])];

      // Calculate total completion across all segments
      let totalStudentsAllSegments = existing.totalStudents || 0;
      let totalWithGradesAllSegments = existing.studentsWithGrades || 0;

      // If this is a new segment, add to totals
      if (!existing.segments.includes(this.activeSegment().value)) {
        totalStudentsAllSegments += draftData.totalStudents;
        totalWithGradesAllSegments += draftData.studentsWithGrades;
      } else {
        // Update existing segment data
        const segmentData = existing.segmentData?.[this.activeSegment().value];
        totalStudentsAllSegments = totalStudentsAllSegments - (segmentData?.totalStudents || 0) + draftData.totalStudents;
        totalWithGradesAllSegments = totalWithGradesAllSegments - (segmentData?.studentsWithGrades || 0) + draftData.studentsWithGrades;
      }

      const updatedDraft = {
        ...existing,
        timestamp: draftInfo.timestamp,
        segments: updatedSegments,
        courseDetails: draftData.courseDetails,
        totalStudents: totalStudentsAllSegments,
        studentsWithGrades: totalWithGradesAllSegments,
        completionPercentage: totalStudentsAllSegments > 0 ? Math.round((totalWithGradesAllSegments / totalStudentsAllSegments) * 100) : 0,
        segmentData: {
          ...existing.segmentData,
          [this.activeSegment().value]: {
            totalStudents: draftData.totalStudents,
            studentsWithGrades: draftData.studentsWithGrades,
            completionPercentage: draftData.completionPercentage
          }
        }
      };
      // Remove old draft and insert updated at the top
      existingDrafts.splice(existingIndex, 1);
      existingDrafts.unshift(updatedDraft);
    } else {
      // Add new draft at the top
      existingDrafts.unshift({
        ...draftInfo,
        segmentData: {
          [this.activeSegment().value]: {
            totalStudents: draftData.totalStudents,
            studentsWithGrades: draftData.studentsWithGrades,
            completionPercentage: draftData.completionPercentage
          }
        }
      });
    }

    localStorage.setItem(draftsKey, JSON.stringify(existingDrafts));
    console.log('Main drafts list updated:', existingDrafts);
  }

  private loadFromDraft() {
    const draftKey = `result_draft_${this.resultId}_${this.activeSegment().value}`;
    const draftData = localStorage.getItem(draftKey);

    console.log('Attempting to load draft for key:', draftKey);

    if (draftData) {
      try {
        const draft = JSON.parse(draftData);

        console.log('Draft found:', draft);
        console.log('Draft students count:', draft.students?.length || 0);

        // Only load draft if it has meaningful data
        if (draft.students && draft.students.length > 0) {
          // Set loading flag to prevent table emissions during draft loading
          this.isLoadingData = true;

          // Restore students data, mapping all grade fields to dash
          this.students.update((current) => ({
            ...current,
            [this.activeSegment().value as SegmentValue]:
              this.mapStudentsArrayToDash(draft.students),
          }));

          this.isDraftMode.set(true);
          this.hasUnsavedChanges.set(true);

          // Clear loading flag before analytics update
          this.isLoadingData = false;

          // Force immediate analytics update - call multiple times to ensure it works
          this.updateAnalyticsRealTime();
          setTimeout(() => {
            this.updateAnalyticsRealTime();
          }, 0);
          setTimeout(() => {
            this.updateAnalyticsRealTime();
          }, 2000);

          console.log(
            'Successfully loaded',
            draft.students.length,
            'students from draft:',
            draft.timestamp
          );
          return true;
        } else {
          console.log(
            'Draft exists but has no students data, loading from API instead'
          );
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    } else {
      console.log('No draft found for key:', draftKey);
    }

    return false;
  }

  clearDraft() {
    const draftKey = `result_draft_${this.resultId}_${this.activeSegment().value}`;
    localStorage.removeItem(draftKey);
    this.isDraftMode.set(false);
    this.hasUnsavedChanges.set(false);
  }
  private transferToResultManagement() {
    const currentUser = this.authService.activeAccount();
    const allSegments: SegmentValue[] = ['REGULAR', 'REFERENCE', 'UNREGISTERED'];
    
    // Force save current segment data first to ensure all changes are captured
    this.saveToDraft();
    
    // Collect ALL student data from segments that have any data
    const completedSegments: any = {};
    allSegments.forEach(segment => {
      const segmentStudents = this.students()[segment] || [];
      if (segmentStudents.length > 0) {
        // Include ALL students in the segment, preserving their actual grades
        completedSegments[segment] = segmentStudents;
        console.log(`Transferring ${segment} segment with ${segmentStudents.length} students:`, segmentStudents.slice(0, 2));
      }
    });
    
    console.log('Transferring segments to Result Management:', completedSegments);

    const courseValue = this.courseForm.get('course')?.value || 'Unknown Course';
    // Extract course title and code from the combined format "CODE - TITLE"
    const [courseCode, ...titleParts] = courseValue.split(' - ');
    const courseTitle = titleParts.join(' - ') || courseValue;
    
    const completeResultData: any = {
      resultId: this.resultId,
      courseDetails: {
        courseTitle: courseTitle,
        courseCode: courseCode || this.extractCourseCode(courseValue),
        session: this.courseForm.get('session')?.value || 'Unknown Session',
        level: this.courseForm.get('level')?.value || 'Unknown Level',
        units: this.extractUnitsFromCourse(courseValue),
      },
      analytics: {
        chartData: this.analyticsChartData(),
        totalStudent: this.totalStudent(),
        totalStudentPass: this.totalStudentPass(),
        totalStudentFail: this.totalStudentFail(),
      },
      segments: completedSegments,
      timestamp: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      status: 'DRAFT',
      lecturer: currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : 'Unknown Lecturer',
      department: currentUser?.department || 'Computer Science',
      faculty: currentUser?.faculty || 'Faculty of Engineering',
      semester: '1st Semester',
      uploadedBy: currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : 'Unknown User'
    };

    // Save to result management storage
    const resultManagementKey = `result_management_${this.resultId}`;
    localStorage.setItem(resultManagementKey, JSON.stringify(completeResultData));

    // COMPLETE CLEANUP - Remove from my-results drafts FIRST
    this.clearAllDraftsForResult();

    // Clean up result management list - remove any incomplete entries
    const resultManagementList = JSON.parse(localStorage.getItem('result_management_list') || '[]');
    const cleanedList = resultManagementList.filter((r: any) => 
      r.resultId !== this.resultId
    );

    // Add only the completed result
    const resultInfo = {
      resultId: this.resultId,
      courseTitle: completeResultData.courseDetails.courseTitle,
      courseCode: completeResultData.courseDetails.courseCode,
      session: completeResultData.courseDetails.session,
      level: completeResultData.courseDetails.level,
      timestamp: completeResultData.timestamp,
      lastModified: completeResultData.lastModified,
      status: 'DRAFT',
      lecturer: completeResultData.lecturer,
      department: completeResultData.department,
      faculty: completeResultData.faculty,
      semester: completeResultData.semester,
      uploadedBy: completeResultData.uploadedBy,
      hasCompleteData: true,
      totalStudents: this.totalStudent(),
      studentsWithGrades: Object.values(completedSegments).flat().filter((s: any) => 
        (s.test !== '-' && s.test !== '' && s.test !== undefined) ||
        (s.lab !== '-' && s.lab !== '' && s.lab !== undefined) ||
        (s.exam !== '-' && s.exam !== '' && s.exam !== undefined)
      ).length,
      completionPercentage: 100
    };

    cleanedList.unshift(resultInfo);
    localStorage.setItem('result_management_list', JSON.stringify(cleanedList));
    
    console.log('Result transferred to Results Management and removed from My Results drafts');
  }

  private clearAllDraftsForResult() {
    const allSegments: SegmentValue[] = ['REGULAR', 'REFERENCE', 'UNREGISTERED'];
    
    console.log('CLEARING ALL DRAFTS FOR RESULT:', this.resultId);
    
    // Remove all segment drafts
    allSegments.forEach(segment => {
      const draftKey = `result_draft_${this.resultId}_${segment}`;
      localStorage.removeItem(draftKey);
      console.log('Removed draft key:', draftKey);
    });

    // Remove from my-results draft list completely
    const draftsListData = localStorage.getItem('result_drafts_list');
    if (draftsListData) {
      const draftsList = JSON.parse(draftsListData);
      const originalLength = draftsList.length;
      const updatedList = draftsList.filter((d: any) => d.resultId !== this.resultId);
      localStorage.setItem('result_drafts_list', JSON.stringify(updatedList));
      console.log(`Removed from drafts list: ${originalLength} -> ${updatedList.length}`);
    }

    // Clear any other draft-related keys
    localStorage.removeItem(`course_form_${this.resultId}`);
    localStorage.removeItem(`result_${this.resultId}`);
    
    // Force refresh My Results by dispatching event
    window.dispatchEvent(new CustomEvent('draftsCleared', {
      detail: { resultId: this.resultId }
    }));
    
    console.log('All drafts cleared for result:', this.resultId);
  }

  // Method to check if there are drafts for this result
  hasDrafts(): boolean {
    const segments: SegmentValue[] = ['REGULAR', 'REFERENCE', 'UNREGISTERED'];
    return segments.some((segment) => {
      const draftKey = `result_draft_${this.resultId}_${segment}`;
      return localStorage.getItem(draftKey) !== null;
    });
  }

  // Method to manually trigger analytics update
  triggerAnalyticsUpdate() {
    this.updateAnalyticsRealTime();
  }

  // Check if all necessary rows are filled
  private updateSaveButtonState() {
    const currentSegment = this.activeSegment().value as SegmentValue;
    const currentStudents = this.students()[currentSegment] || [];

    if (currentStudents.length === 0) {
      this.canSaveChanges.set(false);
      return;
    }

    // Check if all students have at least one score filled
    const allRowsFilled = currentStudents.every((student) => {
      const hasTest = student.test !== undefined && student.test !== '-' && student.test !== '';
      const hasLab = student.lab !== undefined && student.lab !== '-' && student.lab !== '';
      const hasExam = student.exam !== undefined && student.exam !== '-' && student.exam !== '';

      // At least one score must be filled
      return hasTest || hasLab || hasExam;
    });

    this.canSaveChanges.set(allRowsFilled);
  }

  // Force save current state as draft
  saveCurrentAsDraft() {
    if (this.hasUnsavedChanges()) {
      this.saveToDraft();
      this.toast.showNotification(
        'success',
        'Draft Saved',
        'Your changes have been saved as draft'
      );
    }
  }

  // Manual force save draft for testing
  forceSaveDraft() {
    this.hasUnsavedChanges.set(true);
    this.saveToDraft();
    this.toast.showNotification(
      'success',
      'Draft Saved',
      'Draft manually saved for testing'
    );
  }

  // ========================================
  // BULK OPERATIONS
  // ========================================
  createBulkEntries(entries: any[]) {
    this.resultsService.createMultipleResultEntries(entries).subscribe({
      next: (resp: any) => {
        if (resp.status) {
          this.toast.showNotification(
            'success',
            'Success',
            'Bulk entries created successfully'
          );
          this.getResultEntries();
          this.updateAnalyticsRealTime();
          this.clearDraft();
        }
      },
      error: (error: any) => {
        console.error('Error creating bulk entries:', error);
        this.toast.showNotification(
          'error',
          'Error',
          'Failed to create bulk entries'
        );
      },
    });
  }

  // Create single entry for individual grid input
  createSingleEntry(entry: any) {
    if (!entry.registrationNumber || !entry.fullName) {
      this.toast.showNotification(
        'error',
        'Missing Data',
        'Registration number and full name are required'
      );
      return;
    }

    const entryData = {
      registrationNumber: entry.registrationNumber,
      fullName: entry.fullName,
      test: entry.test === '-' ? 0 : Number(entry.test),
      lab: entry.lab === '-' ? 0 : Number(entry.lab),
      exam: entry.exam === '-' ? 0 : Number(entry.exam),
      total: entry.total === '-' ? 0 : Number(entry.total),
      result: this.resultId!,
    };

    this.resultsService.createSingleResultEntry(entryData).subscribe({
      next: (resp: any) => {
        if (resp.status) {
          this.toast.showNotification(
            'success',
            'Success',
            'Entry created successfully'
          );
          this.getResultEntries();
          this.updateAnalyticsRealTime();
        }
      },
      error: (error: any) => {
        console.error('Error creating entry:', error);
        this.toast.showNotification('error', 'Error', 'Failed to create entry');
      },
    });
  }

  saveBulkChanges() {
    const currentSegment = this.activeSegment().value as SegmentValue;
    const currentStudents = this.students()[currentSegment] || [];

    // Separate new entries from existing entries
    const newEntries = currentStudents
      .filter((student) => {
        const test = (student as any)?.test ?? '-';
        const lab = (student as any)?.lab ?? '-';
        const exam = (student as any)?.exam ?? '-';
        const hasScores = test !== '-' || lab !== '-' || exam !== '-';
        return (
          hasScores &&
          !(student as any)?._id &&
          (student as any)?.registrationNumber &&
          (student as any)?.fullName
        ); // No _id means new entry
      })
      .map((student) => ({
        registrationNumber: (student as any)?.registrationNumber!,
        fullName: (student as any)?.fullName!,
        test:
          ((student as any)?.test ?? '-') === '-'
            ? 0
            : Number((student as any)?.test),
        lab:
          ((student as any)?.lab ?? '-') === '-'
            ? 0
            : Number((student as any)?.lab),
        exam:
          ((student as any)?.exam ?? '-') === '-'
            ? 0
            : Number((student as any)?.exam),
        total:
          ((student as any)?.total ?? '-') === '-'
            ? 0
            : Number((student as any)?.total),
        result: this.resultId!,
      }));

    const existingEntries = currentStudents
      .filter((student) => {
        const test = (student as any)?.test ?? '-';
        const lab = (student as any)?.lab ?? '-';
        const exam = (student as any)?.exam ?? '-';
        const hasScores = test !== '-' || lab !== '-' || exam !== '-';
        return hasScores && (student as any)?._id; // Has _id means existing entry
      })
      .map((student) => ({
        _id: (student as any)?._id,
        test:
          ((student as any)?.test ?? '-') === '-'
            ? 0
            : Number((student as any)?.test),
        lab:
          ((student as any)?.lab ?? '-') === '-'
            ? 0
            : Number((student as any)?.lab),
        exam:
          ((student as any)?.exam ?? '-') === '-'
            ? 0
            : Number((student as any)?.exam),
        total:
          ((student as any)?.total ?? '-') === '-'
            ? 0
            : Number((student as any)?.total),
      }));

    if (newEntries.length === 0 && existingEntries.length === 0) {
      this.toast.showNotification(
        'warning',
        'No Changes',
        'No changes to save'
      );
      return;
    }

    // Create new entries first
    if (newEntries.length > 0) {
      this.resultsService.createMultipleResultEntries(newEntries).subscribe({
        next: (resp: any) => {
          if (resp.status) {
            // Then update existing entries if any
            if (existingEntries.length > 0) {
              this.updateExistingEntries(existingEntries);
            } else {
              this.toast.showNotification(
                'success',
                'Success',
                'New entries created successfully'
              );
              this.getResultEntries();
              this.updateAnalyticsRealTime();
              this.clearDraft();
            }
          }
        },
        error: (error: any) => {
          console.error('Error creating new entries:', error);
          this.toast.showNotification(
            'error',
            'Error',
            'Failed to create new entries'
          );
        },
      });
    } else if (existingEntries.length > 0) {
      this.updateExistingEntries(existingEntries);
    }
  }

  private updateExistingEntries(entries: any[]) {
    this.resultsService.updateBulkResultEntries(entries).subscribe({
      next: (resp: any) => {
        if (resp.status) {
          this.toast.showNotification(
            'success',
            'Success',
            'Changes saved successfully'
          );
          this.getResultEntries();
          this.updateAnalyticsRealTime();
          this.clearDraft();
        }
      },
      error: (error: any) => {
        console.error('Error updating entries:', error);
        this.toast.showNotification(
          'error',
          'Error',
          'Failed to update entries'
        );
      },
    });
  }

  // ========================================
  // FILE UPLOAD METHODS
  // ========================================
  uploadResult() {
    // Upload functionality temporarily disabled
    this.toast.showNotification(
      'warning',
      'Upload Feature',
      'File upload feature is currently unavailable'
    );
  }

  submitUpload(resultFile: File) {
    this.uploadingResult.set(true);

    this.resultsService
      .uploadResultFile(this.resultId!, resultFile)
      .pipe(
        finalize(() => {
          this.uploadingResult.set(false);
        })
      )
      .subscribe({
        next: (resp: any) => {
          if (!resp.status) {
            this.toast.showNotification(
              'error',
              'Result file upload failed',
              resp.message || 'Failed to upload result file'
            );
            return;
          }

          this.toast.showNotification(
            'success',
            'Result file uploaded',
            'Your result file has been uploaded successfully'
          );

          // Refresh all data after successful upload
          this.getResult();
          this.getResultEntries();
          // Update analytics immediately
          setTimeout(() => this.updateAnalyticsRealTime(), 500);
        },
        error: (error: any) => {
          this.toast.showNotification(
            'error',
            'Upload Error',
            'An error occurred while uploading the file'
          );
          console.error('Upload error:', error);
        },
      });
  }

  // ========================================
  // DELETE FUNCTIONALITY
  // ========================================
  deleteFile() {
    const selectedStudents = this.selectedStudentsWithIds();

    if (selectedStudents.length === 0) {
      this.toast.showNotification(
        'warning',
        'No Selection',
        'Please select at least one student entry to delete'
      );
      return;
    }

    // Extract entry IDs from selected students
    const entryIds = selectedStudents
      .filter((student) => student._id) // Only include students with IDs
      .map((student) => student._id!);

    if (entryIds.length === 0) {
      this.toast.showNotification(
        'error',
        'Invalid Selection',
        'Selected entries do not have valid IDs for deletion'
      );
      return;
    }

    // Prepare dialog data
    const dialogData = {
      title:
        entryIds.length === 1 ? 'Delete Result Entry' : `Delete Result Entries`,
      message:
        entryIds.length === 1
          ? "Are you sure you want to delete this result entry? This action cannot be undone and will permanently remove the student's grade data."
          : `Are you sure you want to delete the selected result entries? This action cannot be undone and will permanently remove the students' grade data.`,
      confirmText: entryIds.length === 1 ? 'Delete Entry' : `Delete Entries`,
      cancelText: 'Cancel',
      isDangerous: true,
      count: entryIds.length,
    };

    // Show confirmation dialog
    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '700px',
      disableClose: true,
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) {
        return;
      }

      this.deletingEntries.set(true);

      // Call appropriate service method based on selection count
      const deleteOperation =
        entryIds.length === 1
          ? this.resultsService.deleteResultEntry(entryIds[0])
          : this.resultsService.deleteBulkResultEntries(entryIds);

      deleteOperation
        .pipe(
          finalize(() => {
            this.deletingEntries.set(false);
          })
        )
        .subscribe({
          next: (resp: any) => {
            if (!resp.status) {
              this.toast.showNotification(
                'error',
                'Delete Failed',
                resp.message || 'Failed to delete result entries'
              );
              return;
            }

            const successMessage =
              entryIds.length === 1
                ? 'Result entry deleted successfully'
                : `${entryIds.length} result entries deleted successfully`;

            this.toast.showNotification(
              'success',
              'Delete Successful',
              successMessage
            );

            // Clear selections and refresh data
            this.clearSelections();
            this.getResultEntries();
          },
          error: (error: any) => {
            console.error('Delete error:', error);
            this.toast.showNotification(
              'error',
              'Delete Error',
              'An error occurred while deleting the entries'
            );
          },
        });
    });
  }

  private clearSelections(): void {
    const currentSegment = this.activeSegment().value as SegmentValue;

    switch (currentSegment) {
      case 'REFERENCE':
        this.referenceTableResultUploadRef()?.clearSelections();
        break;
      case 'UNREGISTERED':
        this.unregisteredTableResultUploadRef()?.clearSelections();
        break;
    }

    this.selectedStudentsWithIds.set([]);
  }

  // ========================================
  // TABLE DATA MANAGEMENT
  // ========================================
  onSelectedRowsChange(
    selectedRows: Partial<IStudentGrade & { _id: string }>[]
  ) {
    this.selectedStudentsWithIds.set(selectedRows);
    this.selectedStudents.set(selectedRows);
  }

  canDeleteEntries(): boolean {
    return this.selectedStudentsWithIds().length > 0 && !this.deletingEntries();
  }

  getDeleteButtonText(): string {
    const selectedCount = this.selectedStudentsWithIds().length;
    if (selectedCount === 0) return 'Delete File';
    if (selectedCount === 1) return 'Delete Entry';
    return `Delete ${selectedCount} Entries`;
  }
  

  // Force capture current students data
  private forceTableDataEmission() {
    const currentSegment = this.activeSegment().value as SegmentValue;
    const currentStudents = this.students()[currentSegment] || [];
    
    console.log('Force capturing current students data for segment:', currentSegment);
    console.log('Current students count:', currentStudents.length);
    
    if (currentStudents.length > 0) {
      // Force update the students data to ensure it's current
      this.students.update((current) => ({
        ...current,
        [currentSegment]: [...currentStudents]
      }));
    }
  }

  // Student search functionality
  onStudentSearch(searchTerm: string) {
  // const currentSegment = this.activeSegment().value as SegmentValue;
  
  // // Get original data (backup the first time)
  // if (this.originalStudentsData()[currentSegment].length === 0) {
  //   this.originalStudentsData.update((current) => ({
  //     ...current,
  //     [currentSegment]: [...this.students()[currentSegment]],
  //   }));
  // }
  
  // const allStudents = this.originalStudentsData()[currentSegment] || [];
  
  // if (!searchTerm.trim()) {
  //   // Restore original data when search is cleared
  //   this.students.update((current) => ({
  //     ...current,
  //     [currentSegment]: [...allStudents],
  //   }));
  //   return;
  // }
  
  // const filtered = allStudents.filter(student => 
  //   student.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //   student.registrationNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  // );
  
  // this.students.update((current) => ({
  //   ...current,
  //   [currentSegment]: filtered,
  // }));
}
}
