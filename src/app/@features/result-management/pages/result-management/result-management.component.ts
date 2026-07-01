import { NgClass } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin, Observable, switchMap, throwError } from 'rxjs';
import { RoleAccessDirective } from '../../../../@core/directives/role-access.directive';
import { IPaginator } from '../../../../@core/models/paginator.model';
import { ResultManagementDashboardTab } from '../../../../@core/models/school.model';
import { ToastService } from '../../../../@core/utility/toast.service';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { CommentComponent } from '../../../../@shared/components/forms/comment/comment.component';
import { RejectReasonComponent } from '../../../../@shared/components/reject-reason/reject-reason.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { ResendToCourseCoordinatorComponent } from '../../components/resend-to-course-coordinator/resend-to-course-coordinator.component';
import { ResendToDeanComponent } from '../../components/resend-to-dean/resend-to-dean.component';
import {
  FileTableFilter,
  ResultManagementFileTableComponent,
} from '../../components/result-management-file-table/result-management-file-table.component';
import { ResultManagementFolderTableComponent } from '../../components/result-management-folder-table/result-management-folder-table.component';
import { ResultStatusTrackingComponent } from '../../components/result-status-tracking/result-status-tracking.component';
import {
  IGroupedResult,
  IResult,
  IResultQuery,
  ISendSelectedResult,
} from '../../models/results.model';
import { ResultsService } from '../../services/results.service';
import { isInternalCohort } from '../../utils/workflow';

@Component({
  selector: 'app-result-management',
  standalone: true,
  imports: [
    NgClass,
    SegmentSwitcherComponent,
    ButtonComponent,
    ResultStatusTrackingComponent,
    CommentComponent,
    MatTooltipModule,
    CardComponent,
    ResultManagementFolderTableComponent,
    ResultManagementFileTableComponent,
    RoleAccessDirective,
    MatMenuModule,
  ],
  templateUrl: './result-management.component.html',
  styleUrl: './result-management.component.scss',
})
export class ResultManagementComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly resultService = inject(ResultsService);
  private readonly authService = inject(AuthenticationService);
  private readonly toast = inject(ToastService);

  currentRole = signal<RoleEnum>(this.authService.activeAccount()?.role!);

  fileTableRef = viewChild<ResultManagementFileTableComponent>('fileTableRef');
  folderTableRef =
    viewChild<ResultManagementFolderTableComponent>('folderTableRef');

  result = signal<IResult | null>(null);
  results = signal<IResult[]>([]);
  groupedResults = signal<IGroupedResult[]>([]);

  pagination = signal<IPaginator>({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  loadingResults = signal<boolean>(false);
  sendingToCC = signal<boolean>(false);
  sendingToCA = signal<boolean>(false);
  resending = signal<boolean>(false);
  publishing = signal<boolean>(false);
  deleting = signal<boolean>(false);
  refreshComments = signal<boolean>(false);
  /** HOD → Dean: approve + forward (PENDING first pass). */
  approvingToDean = signal<boolean>(false);
  /** HOD → CC: reject + route back for rework (PENDING first pass). */
  rejectingToCC = signal<boolean>(false);
  /** Dean → HOD: approve + forward back to HOD for the second pass. */
  approvingToHOD = signal<boolean>(false);
  /** Dean → HOD: reject + route back to the HOD who sent it up. */
  rejectingToHOD = signal<boolean>(false);

  segments = signal<ISegmentSwitcher[]>([
    {
      label: 'Drafts',
      value: 'DRAFT',
      accessRole: [RoleEnum.LECTURER, RoleEnum.COURSE_COORDINATOR],
    },
    {
      label: 'Pending',
      value: 'PENDING',
      accessRole: [
        RoleEnum.HOD,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Unverified',
      value: 'UNVERIFIED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    // Course Advisor only enters the workflow at COMPLETE — the HOD → CA
    // handoff always lands results in COMPLETE (internal cohort directly,
    // external cohort via the offering-dept HOD). CA is therefore deliberately
    // absent from DRAFT / PENDING / UNVERIFIED / VERIFIED / APPROVED.
    {
      label: 'Verified',
      value: 'VERIFIED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Approved',
      value: 'APPROVED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Complete',
      value: 'COMPLETE',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Published',
      value: 'PUBLISHED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Imported',
      value: 'IMPORTED',
      accessRole: [RoleEnum.DEAN, RoleEnum.HOD, RoleEnum.COURSE_ADVISOR],
    },
  ]);
  activeSegment = signal<ISegmentSwitcher>(this.resolveInitialSegment());
  segmentCardLabel = signal<string>('Access your recent drafts from here');
  segmentCardIconSrc = signal<string>('icons/general/draft-icon.svg');

  collapseView = signal<boolean>(false);

  /**
   * The Course Coordinator's DRAFT tab shows a folder of grouped courses, not a
   * single result — so there is nothing to track or comment on at this level.
   * The status-tracking / comment side panel only makes sense once a folder is
   * opened (the view-results page), where an individual result can be highlighted.
   */
  isCoordinatorDraftFolderView = computed(
    () =>
      this.currentRole() === RoleEnum.COURSE_COORDINATOR &&
      this.activeSegment().value === 'DRAFT'
  );

  RoleEnum = RoleEnum;

  private readonly resultManagementRouteTabs =
    new Set<ResultManagementDashboardTab>([
      'DRAFT',
      'PENDING',
      'UNVERIFIED',
      'VERIFIED',
      'APPROVED',
      'COMPLETE',
      'PUBLISHED',
      'IMPORTED',
    ]);

  ngOnInit(): void {
    const tabFromQuery = this.route.snapshot.queryParamMap.get('tab');
    const appliedQueryTab = this.applyTabFromRouteQuery(tabFromQuery);

    if (appliedQueryTab) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    if (this.currentRole() === RoleEnum.COURSE_COORDINATOR) {
      if (this.activeSegment().value === 'DRAFT') {
        this.getGroupedResults();
      } else {
        this.getResults();
      }
    } else {
      if (!appliedQueryTab) {
        this.applySegmentChrome(this.activeSegment().value);
      }
      this.getResults();
    }
  }

  /**
   * Dashboard cards link here with `?tab=PENDING` (etc.). Applies the segment
   * when the current role is allowed to see that tab.
   */
  private applyTabFromRouteQuery(raw: string | null): boolean {
    if (!raw?.trim()) return false;
    const key = raw.trim().toUpperCase() as ResultManagementDashboardTab;
    if (!this.resultManagementRouteTabs.has(key)) return false;

    const role = this.currentRole();
    const segment = this.segments().find(
      (s) => s.value === key && s.accessRole?.includes(role)
    );
    if (!segment) return false;

    this.activeSegment.set(segment);
    this.applySegmentChrome(key);
    return true;
  }

  /**
   * Landing tab per role, mirroring where each role first acts in the chain:
   *   Lecturer / CC → DRAFT   HOD → PENDING   DEAN → UNVERIFIED
   *   CA            → COMPLETE (CA never sees earlier stages post-refactor)
   * Falls back to the first accessible segment if the ideal one is hidden.
   */
  private resolveInitialSegment(): ISegmentSwitcher {
    const role = this.currentRole();
    const preferredByRole: Partial<
      Record<RoleEnum, ISegmentSwitcher['value']>
    > = {
      [RoleEnum.HOD]: 'PENDING',
      [RoleEnum.DEAN]: 'UNVERIFIED',
      [RoleEnum.COURSE_ADVISOR]: 'COMPLETE',
      [RoleEnum.LECTURER]: 'DRAFT',
      [RoleEnum.COURSE_COORDINATOR]: 'DRAFT',
    };
    const preferred = preferredByRole[role];
    const segments = this.segments();
    return (
      segments.find(
        (s) => s.value === preferred && s.accessRole?.includes(role)
      ) ??
      segments.find((s) => s.accessRole?.includes(role)) ??
      segments[0]
    );
  }

  get resultIsSelected() {
    return (this.fileTableRef()?.selection?.selected?.length ?? 0) > 0;
  }

  get resultIsHighlighted() {
    return this.fileTableRef()?.activeRow() !== null;
  }

  getResults(params?: Partial<IResultQuery>) {
    this.loadingResults.set(true);

    this.resultService
      .getResults({
        status: this.activeSegment().value,
        ...params,
      })
      .pipe(finalize(() => this.loadingResults.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            const { page, limit, total, result } = resp.data;

            this.pagination.update((prev: IPaginator) => {
              prev.page = page;
              prev.pageSize = limit;
              prev.total = total;

              return prev;
            });
            this.results.set(result);

            // Reset result selections if there is
            if (!this.fileTableRef()?.selection.isEmpty())
              this.fileTableRef()?.selection.clear();
          }
        },
      });
  }

  getGroupedResults() {
    this.loadingResults.set(true);

    this.resultService
      .getGroupResults()
      .pipe(finalize(() => this.loadingResults.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.groupedResults.set(resp.data.data);
          }
        },
      });
  }

  toggleView() {
    this.collapseView.update((prev) => !prev);
  }

  switchSegment(switchValue: ISegmentSwitcher['value']) {
    this.activeSegment.update(
      () =>
        this.segments().find(
          (segment: ISegmentSwitcher) => segment.value === switchValue
        )!
    );

    this.applySegmentChrome(switchValue);
    this.getResults();
  }

  /** Card subtitle + icon for the active status tab (also used on first load). */
  private applySegmentChrome(switchValue: ISegmentSwitcher['value']) {
    switch (switchValue) {
      case 'DRAFT': {
        this.segmentCardLabel.set('Access your recent drafts from here');
        this.segmentCardIconSrc.set('icons/general/draft-icon.svg');
        break;
      }
      case 'PENDING': {
        this.segmentCardLabel.set('Access your pending results from here');
        this.segmentCardIconSrc.set('icons/general/pending-icon.svg');
        break;
      }
      case 'UNVERIFIED': {
        this.segmentCardLabel.set('Access your unverified results from here');
        this.segmentCardIconSrc.set('icons/general/unverified-icon.svg');
        break;
      }
      case 'VERIFIED': {
        this.segmentCardLabel.set('Access your verified results from here');
        this.segmentCardIconSrc.set('icons/general/verified-icon.svg');
        break;
      }
      case 'APPROVED': {
        this.segmentCardLabel.set('Access approved results from here');
        this.segmentCardIconSrc.set('icons/general/verified-icon.svg');
        break;
      }
      case 'COMPLETE': {
        this.segmentCardLabel.set('Access complete results from here');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
      case 'PUBLISHED': {
        this.segmentCardLabel.set('Access your published results from here');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
      case 'IMPORTED': {
        this.segmentCardLabel.set('Access imported results from here');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
    }
  }

  confirmSendResult(role: RoleEnum[]) {
    // const
  }

  confirmSendToCC() {
    const selectedResults: IResult[] = this.fileTableRef()?.selection.selected!;

    if (!selectedResults || selectedResults.length < 1) {
      this.toast.showNotification(
        'error',
        'No Result(s) Selected',
        'You have not selected any result(s) to be sent'
      );
      return;
    }

    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: `You're about to send ${selectedResults.length} results to the Course Coordinator. This action is irreversible, Are you sure you want to continue?`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.sendToCC(selectedResults);
        },
      });
  }

  private sendToCC(selectedResults: IResult[]) {
    this.sendingToCC.set(true);

    const payload: ISendSelectedResult[] = selectedResults.map((result) => ({
      resultId: result._id,
      recipient: result.roles.COURSE_COORDINATOR,
    }));

    this.resultService
      .sendSelectedResult(payload, RoleEnum.COURSE_COORDINATOR)
      .pipe(finalize(() => this.sendingToCC.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            const { failedCount, sentCount, failed } = resp.data as {
              failedCount: number;
              sentCount: number;
              failed: unknown[];
            };
            const totalCount = failedCount + sentCount;

            if (failedCount > 0) {
              this.toast.showNotification(
                'error',
                'Some Results Failed',
                `${failedCount} of ${totalCount} results failed to be sent, ${(failed[0] as { error: string }).error}`
              );
            } else {
              this.toast.showNotification(
                'success',
                'Result Sent',
                'Result has been sent to the Course Cordinator'
              );

              this.getResults();
              selectedResults.forEach((result) => {
                this.fileTableRef()!.selection.deselect(result);
              });
            }
          }
        },
      });
  }

  /**
   * HOD: second pass after the Dean (VERIFIED) or offering-dept hop (APPROVED).
   * Must call `approve` before `send` so the backend bumps status:
   *   internal cohort VERIFIED  → COMPLETE → CA
   *   external cohort VERIFIED → APPROVED → students' dept HOD
   *   offering HOD    APPROVED → COMPLETE → CA
   */
  confirmHodForwardAfterDean() {
    const selectedResults = this.fileTableRef()?.selection.selected;
    if (!this.ensureSelection(selectedResults)) return;

    const tab = this.activeSegment().value;
    if (tab !== 'VERIFIED' && tab !== 'APPROVED') return;

    if (!this.validateHodForwardRecipients(selectedResults, tab)) return;

    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: this.hodForwardConfirmationCopy(selectedResults, tab),
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (!confirmed) return;
          if (tab === 'APPROVED') {
            this.executeHodOfferingDeptApproveAndSendToCA(selectedResults);
          } else {
            this.executeCourseDeptHodSecondPass(selectedResults);
          }
        },
      });
  }

  /**
   * Tooltip for the HOD "Approve" button on the VERIFIED / APPROVED tabs.
   * The button label is deliberately generic — the tooltip (and the
   * confirmation dialog in `hodForwardConfirmationCopy`) disclose the real
   * recipient(s) based on the selection and current tab.
   */
  hodVerifiedForwardTooltip(): string {
    const selected = this.fileTableRef()?.selection.selected ?? [];
    const tab = this.activeSegment().value;

    if (tab === 'APPROVED') {
      return 'Approve and send to the Course Advisor (result moves to Complete)';
    }

    if (!selected.length) {
      return 'Approve and forward the selected result(s) to the next approver';
    }

    const hasInternal = selected.some((r) => isInternalCohort(r));
    const hasExternal = selected.some((r) => !isInternalCohort(r));

    if (hasInternal && hasExternal) {
      return 'Approves and forwards: internal cohorts to the Course Advisor; external cohorts to the students’ department HOD';
    }
    if (hasExternal) {
      return 'Approve and send to the Head of Department for the students’ home department';
    }
    return 'Approve and send to the Course Advisor (result moves to Complete)';
  }

  private validateHodForwardRecipients(
    selected: IResult[],
    tab: 'VERIFIED' | 'APPROVED'
  ): boolean {
    if (tab === 'APPROVED') {
      const missing = selected.filter((r) => !r.roles.COURSE_ADVISOR);
      if (missing.length) {
        this.toast.showNotification(
          'error',
          'Missing Course Advisor',
          'One or more results do not have a Course Advisor assigned.'
        );
        return false;
      }
      return true;
    }

    const internal = selected.filter((r) => isInternalCohort(r));
    const external = selected.filter((r) => !isInternalCohort(r));

    if (internal.some((r) => !r.roles.COURSE_ADVISOR)) {
      this.toast.showNotification(
        'error',
        'Missing Course Advisor',
        'One or more internal-cohort results do not have a Course Advisor assigned.'
      );
      return false;
    }
    if (external.some((r) => !r.roles.HOD_OFFERING_DEPT)) {
      this.toast.showNotification(
        'error',
        'Missing HOD',
        'One or more external-cohort results do not have a students’ department HOD assigned.'
      );
      return false;
    }
    return true;
  }

  private hodForwardConfirmationCopy(
    selected: IResult[],
    tab: 'VERIFIED' | 'APPROVED'
  ): string {
    const n = selected.length;
    if (tab === 'APPROVED') {
      return `You're about to approve and send ${n} result(s) to the Course Advisor for publication. This action is irreversible. Continue?`;
    }
    const internal = selected.filter((r) => isInternalCohort(r));
    const external = selected.filter((r) => !isInternalCohort(r));
    if (internal.length && external.length) {
      return `You're about to approve and forward ${n} result(s): internal cohort(s) go to the Course Advisor (Complete); external cohort(s) go to the students’ department HOD (Approved). This action is irreversible. Continue?`;
    }
    if (external.length) {
      return `You're about to approve and send ${n} result(s) to the students’ department Head of Department. This action is irreversible. Continue?`;
    }
    return `You're about to approve and send ${n} result(s) to the Course Advisor. The result will move to Complete. This action is irreversible. Continue?`;
  }

  private executeCourseDeptHodSecondPass(selected: IResult[]) {
    const internal = selected.filter((r) => isInternalCohort(r));
    const external = selected.filter((r) => !isInternalCohort(r));
    const batches: Observable<{ status: boolean }>[] = [];
    if (internal.length) {
      batches.push(
        this.buildApproveThenSend$(
          internal,
          (r) => r.roles.COURSE_ADVISOR ?? '',
          RoleEnum.COURSE_ADVISOR
        )
      );
    }
    if (external.length) {
      batches.push(
        this.buildApproveThenSend$(
          external,
          (r) => r.roles.HOD_OFFERING_DEPT ?? '',
          RoleEnum.HOD
        )
      );
    }
    if (!batches.length) return;

    this.sendingToCA.set(true);
    forkJoin(batches)
      .pipe(finalize(() => this.sendingToCA.set(false)))
      .subscribe({
        next: (responses: { status: boolean }[]) => {
          if (responses.every((r) => r.status)) {
            this.toast.showNotification(
              'success',
              'Result Sent',
              'Selected result(s) have been approved and forwarded'
            );
            this.getResults();
            selected.forEach((r) => this.fileTableRef()!.selection.deselect(r));
          }
        },
        error: (error: { error?: { message?: string } }) => {
          this.toast.showNotification(
            'error',
            'Error Occured',
            error?.error?.message ?? 'Unable to complete approval and send'
          );
        },
      });
  }

  private executeHodOfferingDeptApproveAndSendToCA(selected: IResult[]) {
    this.sendingToCA.set(true);
    this.buildApproveThenSend$(
      selected,
      (r) => r.roles.COURSE_ADVISOR ?? '',
      RoleEnum.COURSE_ADVISOR
    )
      .pipe(finalize(() => this.sendingToCA.set(false)))
      .subscribe({
        next: (resp: { status: boolean }) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Result Sent',
              'Result has been sent to the Course Advisor'
            );
            this.getResults();
            selected.forEach((r) => this.fileTableRef()!.selection.deselect(r));
          }
        },
        error: (error: { error?: { message?: string } }) => {
          this.toast.showNotification(
            'error',
            'Error Occured',
            error?.error?.message ??
              'Unable to send result to the Course Advisor'
          );
        },
      });
  }

  /**
   * One batch: parallel PATCH approve on every row, then one POST selected send.
   * Matches the HOD→Dean / Dean→HOD pattern used elsewhere in this feature.
   */
  private buildApproveThenSend$(
    results: IResult[],
    getRecipient: (r: IResult) => string,
    sendRole: RoleEnum
  ): Observable<{ status: boolean }> {
    const approveReq$ = results.map((result) =>
      this.resultService.approveResult(result._id)
    );
    const payload: ISendSelectedResult[] = results.map((result) => ({
      resultId: result._id,
      recipient: getRecipient(result),
    }));
    return forkJoin(approveReq$).pipe(
      switchMap((resp) =>
        resp.every((res) => res.status)
          ? this.resultService.sendSelectedResult(payload, sendRole)
          : throwError(() => new Error('Failed to approve result'))
      )
    );
  }

  // -----------------------------------------------------------------------
  // Workflow handoff actions
  //
  // Each button on this page (Approve-to-Dean, Reject-to-CC, Approve-to-HOD,
  // Reject-to-HOD, …) is a thin configuration over one of two shared engines
  // below: {@link runApprovalHandoff} and {@link runRejectionHandoff}. This
  // keeps new handoffs declarative — adding a role only needs a new signal
  // and a new `confirm*` one-liner, not another 80-line copy of the same
  // approve/reject → send pipeline.
  // -----------------------------------------------------------------------

  /** HOD → Dean: approve (PENDING → UNVERIFIED) and forward to the Dean. */
  confirmApproveToDean() {
    this.runApprovalHandoff({
      loadingSignal: this.approvingToDean,
      recipientRole: RoleEnum.DEAN,
      recipientLabel: 'Dean',
      getRecipient: (result) => result.roles.DEAN ?? '',
    });
  }

  /** HOD → CC: reject and route back to the Course Coordinator. */
  confirmRejectToCC() {
    this.runRejectionHandoff({
      loadingSignal: this.rejectingToCC,
      recipientRole: RoleEnum.COURSE_COORDINATOR,
      recipientLabel: 'Course Coordinator',
      getRecipient: (result) => result.roles.COURSE_COORDINATOR ?? '',
    });
  }

  /** Dean → HOD: approve (UNVERIFIED → VERIFIED) and forward back to HOD. */
  confirmApproveToHOD() {
    this.runApprovalHandoff({
      loadingSignal: this.approvingToHOD,
      recipientRole: RoleEnum.HOD,
      recipientLabel: 'Head of Department',
      getRecipient: (result) => result.roles.HOD_COURSE_DEPT ?? '',
    });
  }

  /** Dean → HOD: reject and return to the HOD who sent it up for rework. */
  confirmRejectToHOD() {
    this.runRejectionHandoff({
      loadingSignal: this.rejectingToHOD,
      recipientRole: RoleEnum.HOD,
      recipientLabel: 'Head of Department',
      getRecipient: (result) => result.roles.HOD_COURSE_DEPT ?? '',
    });
  }

  confirmPublishResult() {
    const selectedResults = this.fileTableRef()?.selection.selected;

    if (!selectedResults || selectedResults.length < 1) {
      this.toast.showNotification(
        'error',
        'No Result(s) Selected',
        'You have not selected any result(s) to be published'
      );
      return;
    }

    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: `You're about to publish ${selectedResults.length} results. This action is irreversible, Are you sure you want to continue?`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.publishResult(selectedResults);
        },
      });
  }

  publishResult(selectedResults: IResult[]) {
    this.publishing.set(true);

    const publishResultRequests$ = selectedResults?.map((result: IResult) =>
      this.resultService.publishResult(result._id)
    );

    forkJoin(publishResultRequests$)
      .pipe(finalize(() => this.publishing.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp) {
            this.toast.showNotification(
              'success',
              'Result Published',
              'Result has been published successfully'
            );

            this.getResults();
            // Unselect selected result
            selectedResults.forEach((result) => {
              this.fileTableRef()!.selection.deselect(result);
            });
          }
        },
      });
  }

  importResult() {
    this.router.navigate(['/courses/details'], {
      queryParams: {
        new: true,
      },
    });
  }

  confirmResendToCC() {
    const selectedResults: IResult[] = this.fileTableRef()?.selection.selected!;

    if (!selectedResults || selectedResults.length < 1) {
      this.toast.showNotification(
        'error',
        'No Result(s) Selected',
        'You have not selected any result(s) to be sent'
      );
      return;
    }

    this.dialog
      .open(ResendToCourseCoordinatorComponent, {
        width: '600px',
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.sendToCC(selectedResults);
        },
      });
  }

  confirmResendToDean() {
    const selectedResults: IResult[] = this.fileTableRef()?.selection.selected!;

    if (!selectedResults || selectedResults.length < 1) {
      this.toast.showNotification(
        'error',
        'No Result(s) Selected',
        'You have not selected any result(s) to be sent'
      );
      return;
    }

    this.dialog
      .open(ResendToDeanComponent, {
        width: '600px',
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.resendToDean(selectedResults);
        },
      });
  }

  resendToDean(selectedResults: IResult[]) {
    this.resending.set(true);

    const payload: ISendSelectedResult[] = selectedResults.map((result) => ({
      resultId: result._id,
      recipient: result.roles.DEAN ?? '',
    }));

    this.resultService
      .sendSelectedResult(payload, RoleEnum.DEAN)
      .pipe(finalize(() => this.resending.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Result Sent',
              'Result has been re-sent to the Dean'
            );

            this.getResults();
            // Unselect selected result
            selectedResults.forEach((result) => {
              this.fileTableRef()!.selection.deselect(result);
            });
          }
        },
      });
  }

  viewResult(result: IResult) {
    const { _id, status } = result;

    this.router.navigate(['edit-results'], {
      relativeTo: this.route,
      queryParams: { resultId: _id, status },
    });
  }

  trackResult(result: IResult | null) {
    this.result.set(result);
  }

  filter(filter: FileTableFilter) {
    this.getResults(filter);
  }

  deleteResults() {
    const selectedResults: IResult[] = this.fileTableRef()?.selection.selected!;
    const resultCount = selectedResults.length;

    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: `You are about to delete ${resultCount} result(s)?`,
          subTitle: 'Kindly confirm this action',
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirm: boolean) => {
          if (confirm) {
            this.deleting.set(true);

            const deleteRequests = selectedResults?.map((result: IResult) =>
              this.resultService.deleteResult(result._id)
            );

            forkJoin(deleteRequests)
              .pipe(finalize(() => this.deleting.set(false)))
              .subscribe({
                next: () => {
                  this.toast.showNotification(
                    'success',
                    `${resultCount} Result(s) Deleted`,
                    'Results deleted successfully'
                  );

                  this.getResults();
                },
              });
          }
        },
      });
  }

  viewFolder(result: IGroupedResult) {
    const { course, session } = result;

    this.router.navigate(['view-results'], {
      relativeTo: this.route,
      queryParams: {
        courseId: course,
        status: this.activeSegment().value,
        session,
      },
    });
  }

  sendComment(record: { resultId: string; comment: string }) {
    this.refreshComments.set(false);

    const { resultId, comment } = record;
    this.resultService.sendResultComment(resultId, comment).subscribe({
      next: (resp) => {
        if (resp.status)
          this.toast.showNotification(
            'success',
            'Comment Submitted',
            'Comment has been submitted for this result'
          );

        this.refreshComments.set(true);
      },
    });
  }

  // -----------------------------------------------------------------------
  // Shared workflow-handoff engines
  // -----------------------------------------------------------------------

  /**
   * Validates that at least one row is selected; if not, shows a toast and
   * returns false. Narrows the type so call-sites can safely use the array.
   */
  private ensureSelection(
    selected: IResult[] | undefined
  ): selected is IResult[] {
    if (!selected || selected.length < 1) {
      this.toast.showNotification(
        'error',
        'No Result(s) Selected',
        'You have not selected any result(s) to be sent'
      );
      return false;
    }
    return true;
  }

  /**
   * Generic approval handoff: confirm → bulk approve → bulk send. Role-specific
   * callers supply a {@link HandoffConfig} describing which loading signal to
   * flip, where the result is going, and how to derive the recipient id.
   */
  private runApprovalHandoff(config: HandoffConfig) {
    const selectedResults = this.fileTableRef()?.selection.selected;
    if (!this.ensureSelection(selectedResults)) return;

    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: `You're about to send ${selectedResults.length} result(s) to the ${config.recipientLabel}. This action is irreversible, Are you sure you want to continue?`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.approveAndSend(selectedResults, config);
        },
      });
  }

  /**
   * Generic rejection handoff: capture reason → bulk reject → bulk send.
   */
  private runRejectionHandoff(config: HandoffConfig) {
    const selectedResults = this.fileTableRef()?.selection.selected;
    if (!this.ensureSelection(selectedResults)) return;

    this.dialog
      .open(RejectReasonComponent, {
        width: '600px',
        data: { resultId: selectedResults[0]._id },
      })
      .afterClosed()
      .subscribe({
        next: (comment: string) => {
          if (comment) this.rejectAndSend(selectedResults, comment, config);
        },
      });
  }

  private approveAndSend(selectedResults: IResult[], config: HandoffConfig) {
    config.loadingSignal.set(true);

    const approveBulkReq = selectedResults.map((result) =>
      this.resultService.approveResult(result._id)
    );
    const payload: ISendSelectedResult[] = selectedResults.map((result) => ({
      resultId: result._id,
      recipient: config.getRecipient(result),
    }));

    forkJoin(approveBulkReq)
      .pipe(
        switchMap((resp) =>
          resp.every((res) => res.status)
            ? this.resultService.sendSelectedResult(
                payload,
                config.recipientRole
              )
            : throwError(() => new Error('Failed to approve result'))
        ),
        finalize(() => config.loadingSignal.set(false))
      )
      .subscribe({
        next: (resp) =>
          this.handleHandoffSuccess(resp, selectedResults, config),
        error: (error) => this.handleHandoffError(error, config),
      });
  }

  private rejectAndSend(
    selectedResults: IResult[],
    comment: string,
    config: HandoffConfig
  ) {
    config.loadingSignal.set(true);

    const rejectBulkReq = selectedResults.map((result) =>
      this.resultService.rejectResult(result._id, comment)
    );
    const payload: ISendSelectedResult[] = selectedResults.map((result) => ({
      resultId: result._id,
      recipient: config.getRecipient(result),
    }));

    forkJoin(rejectBulkReq)
      .pipe(
        switchMap((resp) =>
          resp.every((res) => res.status)
            ? this.resultService.sendSelectedResult(
                payload,
                config.recipientRole
              )
            : throwError(() => new Error('Failed to reject result'))
        ),
        finalize(() => config.loadingSignal.set(false))
      )
      .subscribe({
        next: (resp) =>
          this.handleHandoffSuccess(resp, selectedResults, config),
        error: (error) => this.handleHandoffError(error, config),
      });
  }

  private handleHandoffSuccess(
    resp: { status: boolean },
    selectedResults: IResult[],
    config: HandoffConfig
  ) {
    if (!resp.status) return;

    this.toast.showNotification(
      'success',
      'Result Sent',
      `Result has been sent to the ${config.recipientLabel}`
    );
    this.getResults();
    selectedResults.forEach((result) => {
      this.fileTableRef()!.selection.deselect(result);
    });
  }

  private handleHandoffError(
    error: { error?: { message?: string } },
    config: HandoffConfig
  ) {
    this.toast.showNotification(
      'error',
      'Error Occured',
      error?.error?.message ??
        `Unable to send result to the ${config.recipientLabel}`
    );
  }
}

/**
 * Description of a single workflow handoff. Callers declare *what* should
 * happen (where the result goes, which spinner to flip) and the generic
 * engines own *how* the network orchestration is performed.
 */
interface HandoffConfig {
  /** Spinner bound to the triggering button. */
  loadingSignal: WritableSignal<boolean>;
  /** Role passed to `/results/selected?role=…` so the backend fans it out. */
  recipientRole: RoleEnum;
  /** Human-friendly label used in confirmation / toast copy. */
  recipientLabel: string;
  /** Extracts the recipient id (a lecturer id) from the result. */
  getRecipient: (result: IResult) => string;
}
