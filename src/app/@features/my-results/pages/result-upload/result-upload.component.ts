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
import { UploadResultDialogComponent } from '../../../../@shared/components/upload-result-dialog/upload-result-dialog.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { ResultsService } from '../../../result-management/services/results.service';
import { StudentService } from '../../../students/services/student.service';
import { AnalyticsChartComponent } from '../../components/analytics-chart/analytics-chart.component';
import { ReferenceTableResultUploadComponent } from '../../components/reference-table-result-upload/reference-table-result-upload.component';
import { RegularTableResultUploadComponent } from '../../components/regular-table-result-upload/regular-table-result-upload.component';

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
    RegularTableResultUploadComponent,
    ReferenceTableResultUploadComponent,
  ],
  templateUrl: './result-upload.component.html',
  styleUrl: './result-upload.component.scss',
})
export class ResultUploadComponent implements OnInit {
  // private readonly utilityService = inject(UtilityService);
  private readonly resultsService = inject(ResultsService);
  private readonly studentService = inject(StudentService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly resultId = this.route.snapshot.queryParamMap.get('resultId');

  regularTableResultUploadRef = viewChild<RegularTableResultUploadComponent>(
    'regularTableResultUploadRef'
  );
  referenceTableResultUploadRef =
    viewChild<ReferenceTableResultUploadComponent>(
      'referenceTableResultUploadRef'
    );

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
  activeSegment = signal<ISegmentSwitcher>(this.segments()[0]);

  analyticsChartData = signal<number[]>([]);
  totalStudent = signal<number | null>(null);
  totalStudentPass = signal<number | null>(null);
  totalStudentFail = signal<number | null>(null);

  courseForm = new FormGroup({
    course: new FormControl({ value: '', disabled: true }),
    session: new FormControl({ value: '', disabled: true }),
    level: new FormControl({ value: '', disabled: true }),
    category: new FormControl('regular'),
  });

  uploadingResult = signal<boolean>(false);

  ngOnInit(): void {
    this.categoryListener();
    if (this.resultId) {
      this.getResult();
      this.getResultEntries();
    }
  }

  getStudentsInDepartmentAndLevel(departmentId: string, level: string) {
    this.studentService
      .getStudentsInDepartmentAndLevel(departmentId, level)
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            console.warn('Students: ', resp.data);
          }
        },
      });
  }

  getResult() {
    this.resultsService.getResult(this.resultId!).subscribe({
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
            analytics['A'],
            analytics['B'],
            analytics['C'],
            analytics['D'],
            analytics['E'],
            analytics['F'],
          ];

          this.analyticsChartData.set(analyticsData);
          this.totalStudent.set(analytics['total']);
          this.totalStudentPass.set(analytics['totalPass']);
          this.totalStudentFail.set(analytics['totalFail']);

          this.getStudentsInDepartmentAndLevel(department._id, level);
        }
      },
    });
  }

  getResultEntries() {
    this.resultsService
      .getResultEntries(this.resultId!, {
        category: this.activeSegment().value,
        fullName: '', // or provide a value if needed
        limit: '50', // or any appropriate number
      })
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            console.warn('Result Entries: ', resp.data.result);
          }
        },
      });
  }

  categoryListener() {
    this.courseForm.get('category')?.valueChanges.subscribe({
      next: (value) => {
        this.switchSegment(value as ISegmentSwitcher['value']);
      },
    });
  }

  switchSegment(switchValue: ISegmentSwitcher['value']) {
    this.activeSegment.update(
      () =>
        this.segments().find(
          (segment: ISegmentSwitcher) => segment.value === switchValue
        )!
    );

    switch (switchValue) {
      case 'REGULAR': {
        this.courseForm.get('category')?.patchValue('regular');
        break;
      }
      case 'REFERENCE': {
        this.courseForm.get('category')?.patchValue('reference');
        break;
      }
      case 'UNREGISTERED': {
        this.courseForm.get('category')?.patchValue('unregistered');
        break;
      }
    }
  }

  uploadResult() {
    this.dialog
      .open(UploadResultDialogComponent, {
        width: '600px',
      })
      .afterClosed()
      .subscribe({
        next: (file: File | null) => {
          if (file) this.confirmResultUpload(file);
        },
      });
  }

  confirmResultUpload(resultFile: File) {
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
              'Result file uploaded failed',
              resp.message || 'Failed to upload result file'
            );
            return;
          }

          this.toast.showNotification(
            'success',
            'Result file uploaded',
            'Your result file has been uploaded successfully'
          );

          this.getResult();
        },
      });
  }

  saveChanges() {
    switch (this.activeSegment().value) {
      case 'REGULAR': {
        console.warn(
          'Regular Table Data: ',
          this.regularTableResultUploadRef()?.dataSource()
        );
        break;
      }
      case 'REFERENCE': {
        console.warn(
          'Reference Table Data: ',
          this.referenceTableResultUploadRef()?.dataSource()
        );
        break;
      }
      case 'UNREGISTERED': {
        console.warn(
          'Unregistered Table Data: ',
          this.referenceTableResultUploadRef()?.dataSource()
        );
        break;
      }
    }

    this.resultsService.sendResult(this.resultId!, 'dcd').subscribe({
      next: (resp) => {
        if (!resp.status) {
          this.toast.showNotification(
            'error',
            'Result Sent Failed',
            resp.message || 'Failed to send result to the student'
          );
          return;
        }

        this.toast.showNotification(
          'success',
          'Result Sent Successfully',
          'Result has been sent successfully'
        );

        this.router.navigate(['my-results']);
      },
    });
  }

  reject() {}

  approve() {}
}
