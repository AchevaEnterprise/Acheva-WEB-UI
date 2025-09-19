import {
  Component,
  inject,
  OnInit,
  signal,
  viewChild,
  ChangeDetectorRef,
} from '@angular/core';
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
import { UploadResultDialogComponent } from '../../../../@shared/components/upload-result-dialog/upload-result-dialog.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { IStudentGrade } from '../../../courses/models/student-grade.model';
import { ResultsService } from '../../../result-management/services/results.service';
import { StudentService } from '../../../students/services/student.service';
import { AnalyticsChartComponent } from '../../components/analytics-chart/analytics-chart.component';
import { ReferenceTableResultUploadComponent } from '../../components/reference-table-result-upload/reference-table-result-upload.component';
import { DeleteConfirmationDialogComponent } from '../../components/app-delete-confirmation-dialog/app-delete-confirmation-dialog.component';

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
  // ========================================
  // DEPENDENCY INJECTION
  // ========================================
  private readonly resultsService = inject(ResultsService);
  private readonly studentService = inject(StudentService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  deletingEntries = signal<boolean>(false);
  selectedStudentsWithIds = signal<Partial<IStudentGrade & { _id: string }>[]>(
    []
  );

  // ========================================
  // COMPONENT PROPERTIES
  // ========================================
  private readonly resultId = this.route.snapshot.queryParamMap.get('resultId');

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

  analyticsChartData = signal<number[]>([]);
  totalStudent = signal<number | null>(null);
  totalStudentPass = signal<number | null>(null);
  totalStudentFail = signal<number | null>(null);

  uploadingResult = signal<boolean>(false);
  selectedStudents = signal<Partial<IStudentGrade>[]>([]);

  // Updated students signal with proper initialization
  students = signal<Record<SegmentValue, Partial<IStudentGrade>[]>>({
    REGULAR: [],
    REFERENCE: [],
    UNREGISTERED: [],
  });

  // Track loading state for data fetching
  loadingData = signal<boolean>(false);

  // ========================================
  // FORMS
  // ========================================
  courseForm = new FormGroup({
    course: new FormControl({ value: '', disabled: true }),
    session: new FormControl({ value: '', disabled: true }),
    level: new FormControl({ value: '', disabled: true }),
    category: new FormControl('regular'),
  });

  constructor() {}

  // ========================================
  // LIFECYCLE HOOKS
  // ========================================
  ngOnInit(): void {
    this.categoryListener();
    if (this.resultId) {
      this.getResult();
      this.getResultEntries();
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
    this.loadingData.set(true);

    this.resultsService
      .getResult(this.resultId!)
      .pipe(finalize(() => this.loadingData.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            const { analytics, course, session, level, department } =
              resp.data as {
                course: { courseTitle: string };
                session: string;
                level: string;
                analytics: Record<string, number>;
                department: IDepartment;
              };

            this.courseForm.patchValue({
              course: course.courseTitle,
              session: session,
              level: level,
            });

            const analyticsData = [
              analytics['A'] || 0,
              analytics['B'] || 0,
              analytics['C'] || 0,
              analytics['D'] || 0,
              analytics['E'] || 0,
              analytics['F'] || 0,
            ];

            this.analyticsChartData.set(analyticsData);
            this.totalStudent.set(analytics['total'] || 0);
            this.totalStudentPass.set(analytics['totalPass'] || 0);
            this.totalStudentFail.set(analytics['totalFail'] || 0);

            this.getStudentsInDepartmentAndLevel(department._id, level);
          }
        },
        error: (error) => {
          console.error('Error fetching result:', error);
          this.toast.showNotification(
            'error',
            'Data Load Error',
            'Failed to load result data'
          );
        },
      });
  }

  getResultEntries() {
    this.loadingData.set(true);

    this.resultsService
      .getResultEntries(this.resultId!, {
        category: this.activeSegment().value,
      })
      .pipe(finalize(() => this.loadingData.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            const { analytics, total, totalPass, totalFail, result } =
              resp.data as {
                analytics: Record<string, number>;
                total: number;
                totalPass: number;
                totalFail: number;
                result: Partial<IStudentGrade>[];
              };
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

            // Update the students signal with the current segment data
            const currentStudents = this.students();
            const segmentKey = this.activeSegment().value as SegmentValue;

            // Always update the data, even if it's the same reference
            this.students.set({
              ...currentStudents,
              [segmentKey]: result || [],
            });

            // Force change detection to ensure UI updates
            this.cdr.detectChanges();
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
    const targetSegment = this.segments().find(
      (segment) => segment.value === switchValue
    );

    if (targetSegment) {
      this.activeSegment.set(targetSegment);
    }

    // Update form control to match the segment (without emitting to prevent loops)
    const formValue = this.mapSegmentToFormValue(switchValue);
    if (formValue) {
      this.courseForm
        .get('category')
        ?.patchValue(formValue, { emitEvent: false });
    }

    // Always refresh data when switching segments
    if (this.resultId) {
      this.getResultEntries();
    }
  }

  private mapSegmentToFormValue(segment: SegmentValue): string {
    const mapping: Record<SegmentValue, string> = {
      REGULAR: 'regular',
      REFERENCE: 'reference',
      UNREGISTERED: 'unregistered',
    };
    return mapping[segment];
  }

  // ========================================
  // FILE UPLOAD METHODS
  // ========================================
  uploadResult() {
    this.dialog
      .open(UploadResultDialogComponent, {
        width: '600px',
      })
      .afterClosed()
      .subscribe({
        next: (file: File | null) => {
          if (file) this.submitUpload(file);
        },
      });
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
        next: (resp) => {
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
        },
        error: (error) => {
          this.toast.showNotification(
            'error',
            'Upload Error',
            'An error occurred while uploading the file'
          );
          console.error('Upload error:', error);
        },
      });
  }

  // Helper method to get current segment data
  getCurrentSegmentData(): Partial<IStudentGrade>[] {
    const currentSegmentValue = this.activeSegment().value;

    if (!this.isValidSegmentValue(currentSegmentValue)) {
      console.warn(
        'Invalid segment value in getCurrentSegmentData:',
        currentSegmentValue
      );
      return [];
    }

    const currentSegment = currentSegmentValue as SegmentValue;
    return this.students()[currentSegment] || [];
  }

  // ========================================
  // ACTION METHODS
  // ========================================
  saveChanges() {
    let tableData: Partial<IStudentGrade>[] = [];

    // Safely get the current segment value
    const currentSegmentValue = this.activeSegment().value;

    // Type guard to ensure we have a valid SegmentValue
    if (!this.isValidSegmentValue(currentSegmentValue)) {
      console.error('Invalid segment value:', currentSegmentValue);
      this.toast.showNotification(
        'error',
        'Invalid State',
        'Invalid segment state detected. Please refresh the page.'
      );
      return;
    }

    const currentSegment = currentSegmentValue as SegmentValue;

    // Get the current segment's data from the students signal
    const currentSegmentData = this.students()[currentSegment];

    if (!currentSegmentData || currentSegmentData.length === 0) {
      this.toast.showNotification(
        'warning',
        'No Data',
        'No data available to save'
      );
      return;
    }

    // Get data from appropriate component reference
    switch (currentSegment) {
      case 'REGULAR': {
        // TODO: Implement when regular table component is ready
        tableData = currentSegmentData;
        break;
      }
      case 'REFERENCE': {
        const componentData =
          this.referenceTableResultUploadRef()?.getCurrentDataSource();
        tableData = componentData || currentSegmentData;
        break;
      }
      case 'UNREGISTERED': {
        const componentData =
          this.unregisteredTableResultUploadRef()?.getCurrentDataSource();
        tableData = componentData || currentSegmentData;
        break;
      }
    }

    // Validate data before saving
    if (!this.validateTableData(tableData)) {
      this.toast.showNotification(
        'error',
        'Validation Error',
        'Please ensure all required fields are filled and valid'
      );
      return;
    }

    // TODO: Replace 'dcd' with actual data or remove this call if not needed
    this.resultsService.sendResult(this.resultId!, 'dcd').subscribe({
      next: (resp) => {
        if (!resp.status) {
          this.toast.showNotification(
            'error',
            'Result Send Failed',
            resp.message || 'Failed to send result to the student'
          );
          return;
        }

        this.toast.showNotification(
          'success',
          'Result Sent Successfully',
          'Result has been sent successfully'
        );

        this.router.navigate(['/my-results']);
      },
      error: (error) => {
        this.toast.showNotification(
          'error',
          'Send Error',
          'An error occurred while sending the result'
        );
        console.error('Send result error:', error);
      },
    });
  }

  reject() {
    // TODO: Implement reject functionality
    console.warn('Rejecting result for segment:', this.activeSegment().value);
  }

  approve() {
    // TODO: Implement approve functionality
    console.warn('Approving result for segment:', this.activeSegment().value);
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
          next: (resp) => {
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

            // Clear selections
            this.clearSelections();

            // Refresh data
            this.refreshCurrentSegmentData();
          },
          error: (error) => {
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

  // ========================================
  // HELPER METHODS FOR DELETE FUNCTIONALITY
  // ========================================

  private clearSelections(): void {
    // Clear selections in the current active table component
    const currentSegment = this.activeSegment().value as SegmentValue;

    switch (currentSegment) {
      case 'REFERENCE':
        this.referenceTableResultUploadRef()?.clearSelections();
        break;
      case 'UNREGISTERED':
        this.unregisteredTableResultUploadRef()?.clearSelections();
        break;
      // Add case for REGULAR when implemented
    }

    // Clear parent selections
    this.selectedStudentsWithIds.set([]);
  }

  private refreshCurrentSegmentData(): void {
    // Refresh the current segment data after successful deletion
    if (this.resultId) {
      this.getResultEntries();
    }
  }

  // ========================================
  // UPDATED TABLE DATA MANAGEMENT
  // ========================================

  // Update the existing method to handle entries with IDs
  onSelectedRowsChange(
    selectedRows: Partial<IStudentGrade & { _id: string }>[]
  ) {
    this.selectedStudentsWithIds.set(selectedRows);
    // Keep the old signal for backward compatibility if needed
    this.selectedStudents.set(selectedRows);
  }

  // Helper method to check if delete button should be enabled
  canDeleteEntries(): boolean {
    return this.selectedStudentsWithIds().length > 0 && !this.deletingEntries();
  }

  // Helper method to get delete button text
  getDeleteButtonText(): string {
    const selectedCount = this.selectedStudentsWithIds().length;
    if (selectedCount === 0) return 'Delete File';
    if (selectedCount === 1) return 'Delete Entry';
    return `Delete ${selectedCount} Entries`;
  }

  // ========================================
  // UTILITY AND HELPER METHODS
  // ========================================
  private isValidSegmentValue(value: any): value is SegmentValue {
    return ['REGULAR', 'REFERENCE', 'UNREGISTERED'].includes(value);
  }

  private validateTableData(data: Partial<IStudentGrade>[]): boolean {
    if (!data || data.length === 0) {
      console.warn('Validation failed: No data provided');
      return false;
    }

    const isValid = data.every((student, index) => {
      const hasRequiredFields = !!(
        student.registrationNumber &&
        student.fullName &&
        student.test !== undefined &&
        student.lab !== undefined &&
        student.exam !== undefined &&
        student.grade &&
        student.status
      );

      if (!hasRequiredFields) {
        console.warn(
          `Validation failed for student at index ${index}:`,
          student
        );
      }

      return hasRequiredFields;
    });

    return isValid;
  }

  // Helper method to check if data is loading
  isLoadingData(): boolean {
    return this.loadingData();
  }

  // Helper method to check if current segment has data
  hasDataForCurrentSegment(): boolean {
    const currentSegmentData = this.getCurrentSegmentData();
    return currentSegmentData.length > 0;
  }
}
