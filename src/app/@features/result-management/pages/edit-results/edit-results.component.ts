import { Component, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { RoleAccessDirective } from '../../../../@core/directives/role-access.directive';
import { ToastService } from '../../../../@core/utility/toast.service';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { RejectReasonComponent } from '../../../../@shared/components/reject-reason/reject-reason.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { IStudentGrade } from '../../../courses/models/student-grade.model';
import { AnalyticsChartComponent } from '../../../my-results/components/analytics-chart/analytics-chart.component';
import { RegularTableResultUploadComponent } from '../../../my-results/components/regular-table-result-upload/regular-table-result-upload.component';
import {
  ICreateResultEntry,
  IResult,
  SegmentValue,
} from '../../models/results.model';
import { ResultsService } from '../../services/results.service';

@Component({
  selector: 'app-edit-results',
  imports: [
    RegularTableResultUploadComponent,
    SearchInputComponent,
    SegmentSwitcherComponent,
    AnalyticsChartComponent,
    MatDividerModule,
    MatTooltipModule,
    CardComponent,
    ButtonComponent,
    RoleAccessDirective,
  ],
  templateUrl: './edit-results.component.html',
  styleUrl: './edit-results.component.scss',
})
export class EditResultsComponent implements OnInit {
  private readonly resultsService = inject(ResultsService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly resultId: string =
    this.route.snapshot.queryParamMap.get('resultId')!;

  results = signal<IResult[]>([]);
  analyticsChartData = signal<number[]>([0, 0, 0, 0, 0, 0]);
  totalStudent = signal<number>(0);
  totalStudentPass = signal<number>(0);
  totalStudentFail = signal<number>(0);

  loadingResult = signal<boolean>(false);
  uploadingResult = signal<boolean>(false);

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

  students = signal<Record<SegmentValue, Partial<IStudentGrade>[]>>({
    REGULAR: [],
    REFERENCE: [],
    UNREGISTERED: [],
  });

  RoleEnum = RoleEnum;

  ngOnInit(): void {
    this.getResultEntries();
  }

  getResultEntries() {
    this.loadingResult.set(true);

    this.resultsService
      .getResultEntries(this.resultId, {
        category: this.activeSegment().value,
      })
      .pipe(finalize(() => this.loadingResult.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            const resultEntries = resp.data;

            const {
              analytics,
              totalPass,
              totalFail,
              entries,
              studentsWithoutEntries,
            } = resultEntries as {
              analytics: Record<string, number>;
              total: number;
              totalPass: number;
              totalFail: number;
              entries: Partial<IStudentGrade>[];
              studentsWithoutEntries?: Partial<IStudentGrade>[];
            };

            const analyticsData = [
              analytics['A'] || 0,
              analytics['B'] || 0,
              analytics['C'] || 0,
              analytics['D'] || 0,
              analytics['E'] || 0,
              analytics['F'] || 0,
            ];

            const studentResultEntries = [
              ...entries,
              ...(studentsWithoutEntries ?? []),
            ];

            this.analyticsChartData.set(analyticsData);
            this.totalStudent.set(studentResultEntries.length);
            this.totalStudentPass.set(totalPass || 0);
            this.totalStudentFail.set(totalFail || 0);

            // Set student's result entries
            const activeCategory = this.activeSegment().value as SegmentValue;
            this.students.update((students) => {
              students[activeCategory] = studentResultEntries;
              return students;
            });
          }
        },
      });
  }

  switchSegment(value: ISegmentSwitcher['value']): void {
    const selectedSegment: ISegmentSwitcher = this.segments()?.find(
      (segment: ISegmentSwitcher) => segment.value === value
    )!;
    this.activeSegment.set(selectedSegment);
    this.getResultEntries();
  }

  uploadResult(result: Partial<IStudentGrade>) {
    this.uploadingResult.set(true);

    const { registrationNumber, fullName, test, lab, exam, total } = result!;
    const resultEntry: ICreateResultEntry = {
      registrationNumber: registrationNumber!,
      fullName: fullName!,
      test: test!,
      lab: lab!,
      exam: exam!,
      total: total!,
      result: this.resultId,
    };

    this.resultsService
      .createResultEntry(resultEntry)
      .pipe(finalize(() => this.uploadingResult.set(false)))
      .subscribe({
        next: (resp) => {
          if (!resp.status)
            this.toast.showNotification('error', 'Upload Error', resp.message);
        },
      });
  }

  saveChanges() {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '600px',
      data: {
        message:
          'Are you sure you want to save these changes?  if you save these changes, You can now send to the course coordinator.',
        subTitle: 'Kindly confirm this action',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) this.router.navigate(['/result-management']);
    });
  }

  confirmApproval() {
    const message = `You're about to send this vetted result to the Dean. This action is irreversible. Are you sure you want to continue?`;

    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: message,
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.approve();
        },
      });
  }

  approve() {
    this.resultsService
      .approveOrRejectResult(this.resultId, 'APPROVED')
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Result Approved',
              `Result submission has been approved`
            );
          }
        },
      });
  }

  confirmReject() {
    this.dialog
      .open(RejectReasonComponent, {
        width: '600px',
      })
      .afterClosed()
      .subscribe({
        next: (comment: string) => {
          if (comment) this.reject(comment);
        },
      });
  }

  reject(reason: string) {
    this.resultsService
      .approveOrRejectResult(this.resultId, 'REJECTED', reason)
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Result Rejected',
              `Result submission has been rejected`
            );
          }
        },
      });
  }
}
