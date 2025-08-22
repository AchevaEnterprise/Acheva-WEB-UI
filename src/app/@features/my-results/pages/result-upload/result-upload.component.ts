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
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../@core/utility/notification.service';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { UploadResultDialogComponent } from '../../../../@shared/components/upload-result-dialog/upload-result-dialog.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AnalyticsChartComponent } from '../../../courses/components/analytics-chart/analytics-chart.component';
import { ResultsService } from '../../../result-management/services/results.service';
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
  private readonly notificationService = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  // private readonly router = inject(Router);
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
      value: 'regular',
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
      value: 'reference',
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
      value: 'unregistered',
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
    if (this.resultId) this.getResult();
  }

  getResult() {
    this.resultsService.getResult(this.resultId!).subscribe({
      next: (resp) => {
        if (resp.status) {
          const { analytics, course, session, level } = resp.data as {
            course: { courseTitle: string };
            session: string;
            level: string;
            analytics: Record<string, number>;
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

    console.warn('Updated: active', this.activeSegment());

    switch (switchValue) {
      case 'regular': {
        this.courseForm.get('category')?.setValue('regular');
        break;
      }
      case 'reference': {
        this.courseForm.get('category')?.setValue('reference');
        break;
      }
      case 'unregistered': {
        this.courseForm.get('category')?.setValue('unregistered');
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
        next: async (file: File | null) => {
          if (file) {
            console.warn('Uploaded File: ', file);
            // const resultEntry =  await this.utilityService.convertExcelToJson(file);
            // console.warn('Converted Result Entry: ', resultEntry);
            this.confirmResultUpload(file);
          }
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
          if (resp.status) {
            this.notificationService.showNotification(
              'success',
              'Result file uploaded',
              'Your result file has been uploaded successfully'
            );
          } else {
            this.notificationService.showNotification(
              'error',
              'Result file uploaded failed',
              resp.message || 'Failed to upload result file'
            );
          }
        },
      });
  }

  saveChanges() {
    console.warn(
      'Table Data: ',
      this.regularTableResultUploadRef()?.dataSource()
    );

    // this.resultsService.createResult();
    // this.router.navigate(['my-results']);
  }

  reject() {}

  approve() {}
}
