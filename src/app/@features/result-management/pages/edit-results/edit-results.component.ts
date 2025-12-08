import { Component, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { RoleAccessDirective } from '../../../../@core/directives/role-access.directive';
import { ToastService } from '../../../../@core/utility/toast.service';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { RejectReasonComponent } from '../../../../@shared/components/reject-reason/reject-reason.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { AnalyticsChartComponent } from '../../../my-results/components/analytics-chart/analytics-chart.component';
import { RegularTableResultUploadComponent } from '../../../my-results/components/regular-table-result-upload/regular-table-result-upload.component';
import { IStudentGrade } from '../../../students/models/student.model';
import {
  ICreateResultEntry,
  IResult,
  SegmentValue,
} from '../../models/results.model';
import { ResultsService } from '../../services/results.service';
import { BackButtonComponent } from '../../../../@shared/components/back-button/back-button.component';

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
    LoaderComponent,
    BackButtonComponent,
  ],
  templateUrl: './edit-results.component.html',
  styleUrl: './edit-results.component.scss',
})
export class EditResultsComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly resultsService = inject(ResultsService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly resultId: string =
    this.route.snapshot.queryParamMap.get('resultId')!;
  readonly status: string = this.route.snapshot.queryParamMap.get('status')!;

  results = signal<IResult[]>([]);
  analyticsChartData = signal<number[]>([0, 0, 0, 0, 0, 0]);
  totalStudent = signal<number>(0);
  totalStudentPass = signal<number>(0);
  totalStudentFail = signal<number>(0);

  loadingResult = signal<boolean>(false);
  uploadingResult = signal<boolean>(false);
  approvingResult = signal<boolean>(false);
  rejectingResult = signal<boolean>(false);

  userRole = this.authService.activeAccount()?.role;

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

  result = signal<IResult | null>(null);
  students = signal<Record<SegmentValue, Partial<IStudentGrade>[]>>({
    REGULAR: [],
    REFERENCE: [],
    UNREGISTERED: [],
  });

  RoleEnum = RoleEnum;

  ngOnInit(): void {
    this.getResultAndEntries();
  }

  getResultAndEntries() {
    this.loadingResult.set(true);

    const result$ = this.resultsService.getResult(this.resultId);
    const resultEntries$ = this.resultsService.getResultEntries(this.resultId, {
      category: this.activeSegment().value,
    });

    forkJoin([result$, resultEntries$])
      .pipe(finalize(() => this.loadingResult.set(false)))
      .subscribe({
        next: ([result, resultEntries]) => {
          if (result.status) this.result.set(result.data);
          if (resultEntries.status)
            this.setResultEntriesDetails(resultEntries.data);
        },
      });
  }

  setResultEntriesDetails(resultEntries: unknown) {
    const { analytics, totalPass, totalFail, entries, studentsWithoutEntries } =
      resultEntries as {
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

  switchSegment(value: ISegmentSwitcher['value']): void {
    const selectedSegment: ISegmentSwitcher = this.segments()?.find(
      (segment: ISegmentSwitcher) => segment.value === value
    )!;
    this.activeSegment.set(selectedSegment);
    this.getResultAndEntries();
  }

  uploadResult(result: Partial<IStudentGrade>) {
    this.uploadingResult.set(true);

    const { registrationNumber, fullName, test, lab, exam, total } = result;
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
          if (!resp.status) {
            this.toast.showNotification('error', 'Upload Error', resp.message);
            return;
          }

          this.getResultAndEntries();
        },
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
    this.approvingResult.set(true);
    const { roles } = this.result() as IResult;
    const user = this.authService.activeAccount()!;

    const approveRequest$ = this.resultsService.approveOrRejectResult(
      this.resultId,
      'APPROVED'
    );
    const sendResultRequest$ = this.resultsService.sendResult(
      this.resultId,
      user.role === RoleEnum.HOD ? roles.DEAN : roles.HOD,
      user.role === RoleEnum.HOD ? RoleEnum.DEAN : RoleEnum.HOD
    );

    forkJoin([approveRequest$, sendResultRequest$])
      .pipe(finalize(() => this.approvingResult.set(false)))
      .subscribe({
        next: ([approvalResp, sentResultResp]) => {
          if (approvalResp.status && sentResultResp.status) {
            this.toast.showNotification(
              'success',
              'Result Approved & Sent',
              `Result has been sent and approved successfully`
            );

            this.router.navigate(['/result-management']);
          }
        },
        error: (error) => {
          this.toast.showNotification(
            'error',
            'Error Occured',
            error.error.message
          );
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
    this.rejectingResult.set(true);
    const { roles } = this.result() as IResult;
    const user = this.authService.activeAccount()!;

    const rejectRequest$ = this.resultsService.approveOrRejectResult(
      this.resultId,
      'REJECTED',
      reason
    );

    // If HOD rejects goes to Course Coordinator if Dean rejects it goes to HOD
    const sendToCCRequest$ = this.resultsService.sendResult(
      this.resultId,
      user.role === RoleEnum.HOD ? roles.COURSE_COORDINATOR : roles.HOD,
      user.role === RoleEnum.HOD ? RoleEnum.COURSE_COORDINATOR : RoleEnum.HOD
    );

    forkJoin([rejectRequest$, sendToCCRequest$])
      .pipe(finalize(() => this.rejectingResult.set(false)))
      .subscribe({
        next: ([rejectResp, sentResultResp]) => {
          if (rejectResp.status && sentResultResp.status) {
            this.toast.showNotification(
              'success',
              'Result Rejected',
              `Result has been sent and rejected successfully`
            );

            this.router.navigate(['/result-management']);
          }
        },
        error: (error) => {
          this.toast.showNotification(
            'error',
            'Error Occured',
            error.error.message
          );
        },
      });
  }
}
