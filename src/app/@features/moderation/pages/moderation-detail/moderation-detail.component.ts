import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { IAPIResponse } from '../../../../@core/models/api-response.model';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { RoleEnum } from '../../../auth/model/auth.model';
import { ICourse } from '../../../courses/models/course.model';
import { IStudent } from '../../../students/models/student.model';
import { IDepartment } from '../../../../@core/models/school.model';
import { AssignModeratorDialogComponent } from '../../components/assign-moderator-dialog/assign-moderator-dialog.component';
import { ModeratorScoreFormComponent } from '../../components/moderator-score-form/moderator-score-form.component';
import { ModerationCommentsComponent } from '../../components/moderation-comments/moderation-comments.component';
import { ModerationTimelineComponent } from '../../components/moderation-timeline/moderation-timeline.component';
import { RejectModerationDialogComponent } from '../../components/reject-moderation-dialog/reject-moderation-dialog.component';
import {
  IAssignModeratorPayload,
  IRejectPayload,
  IResultModeration,
  ISubmitOutcomePayload,
  ModerationStatus,
} from '../../models/moderation.model';
import { ModerationInboxBadgeService } from '../../services/moderation-inbox-badge.service';
import { ModerationService } from '../../services/moderation.service';
import {
  ModerationStatusPipe,
  ModerationStatusVariantPipe,
} from '../../pipes/moderation-status.pipe';
import {
  IModerationAction,
  ModerationActionKind,
  getAvailableActions,
  isAssignedModerator,
  isCross,
  isMyTurn,
  refId,
} from '../../utils/moderation-workflow';

/**
 * Moderation detail / action page.
 *
 * The page is presentation-only: every state mutation goes through
 * `ModerationService` and the available actions come from
 * `getAvailableActions()` so the buttons stay aligned with the backend rules
 * by construction.
 */
@Component({
  selector: 'app-moderation-detail',
  standalone: true,
  imports: [
    DatePipe,
    TitleCasePipe,
    ButtonComponent,
    LoaderComponent,
    ModerationCommentsComponent,
    ModerationTimelineComponent,
    ModeratorScoreFormComponent,
    ModerationStatusPipe,
    ModerationStatusVariantPipe,
  ],
  templateUrl: './moderation-detail.component.html',
  styleUrl: './moderation-detail.component.scss',
})
export class ModerationDetailComponent implements OnInit {
  private readonly moderationService = inject(ModerationService);
  private readonly authService = inject(AuthenticationService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly moderationInboxBadge = inject(ModerationInboxBadgeService);

  loading = signal<boolean>(true);
  acting = signal<boolean>(false);
  moderation = signal<IResultModeration | null>(null);
  /** Toggled to `true` after every successful action so the comments panel reloads. */
  refreshComments = signal<boolean>(false);

  myUserId = this.authService.activeAccount()?.id ?? '';
  myRole: RoleEnum =
    this.authService.activeAccount()?.role ?? RoleEnum.LECTURER;
  myDeptId = refId(this.authService.activeAccount()?.department);

  actions = computed<IModerationAction[]>(() => {
    const mod = this.moderation();
    if (!mod) return [];
    return getAvailableActions(mod, {
      userId: this.myUserId,
      role: this.myRole,
      departmentId: this.myDeptId,
    });
  });

  isMyTurn = computed(() => {
    const mod = this.moderation();
    return mod ? isMyTurn(mod, this.myUserId) : false;
  });

  isAssignedModerator = computed(() => {
    const mod = this.moderation();
    return mod ? isAssignedModerator(mod, this.myUserId) : false;
  });

  showScoreForm = computed(() => {
    const mod = this.moderation();
    if (!mod) return false;
    return (
      mod.status === ModerationStatus.PENDING_MODERATION &&
      this.isAssignedModerator() &&
      this.isMyTurn()
    );
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.toast.showNotification(
        'error',
        'Missing id',
        'Could not open moderation — no id provided in the URL.'
      );
      this.loading.set(false);
      return;
    }
    this.fetch(id);
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.moderationService
      .findOne(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) this.moderation.set(resp.data);
        },
        error: () => {
          this.toast.showNotification(
            'error',
            'Not found',
            'Could not load this moderation request.'
          );
        },
      });
  }

  goBack(): void {
    void this.router.navigate(['/moderation']);
  }

  // ── Action dispatch ───────────────────────────────────────────────────────

  runAction(action: IModerationAction): void {
    const mod = this.moderation();
    if (!mod) return;

    switch (action.flow) {
      case 'confirm':
        this.runConfirm(action, mod);
        return;
      case 'reject':
        this.runReject(action, mod);
        return;
      case 'assign-moderator':
        this.runAssign(action, mod);
        return;
      case 'score':
        // Inline form on the page — clicking the button just scrolls there.
        this.scrollToScoreForm();
        return;
    }
  }

  /** Score form emits its payload directly. */
  submitScore(payload: ISubmitOutcomePayload): void {
    const mod = this.moderation();
    if (!mod) return;
    this.execute(this.moderationService.moderatorSubmit(mod._id, payload));
  }

  // ── Confirm-style actions ─────────────────────────────────────────────────

  private runConfirm(action: IModerationAction, mod: IResultModeration): void {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      data: {
        message: action.label + '?',
        subTitle: action.description,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      const call = this.callForConfirmKind(action.kind, mod);
      if (call) this.execute(call);
    });
  }

  private callForConfirmKind(
    kind: ModerationActionKind,
    mod: IResultModeration
  ): Observable<IAPIResponse<IResultModeration>> | null {
    switch (kind) {
      case 'submit':
        return this.moderationService.submit(mod._id);
      case 'cancel':
        return this.moderationService.cancel(mod._id);
      case 'publish':
        return this.moderationService.publish(mod._id);
      case 'homeHodApproveCross':
        return this.moderationService.homeHodApproveCross(mod._id);
      case 'homeHodForwardToCa':
        return this.moderationService.homeHodForwardToCa(mod._id);
      case 'offeringHodForwardAfterDean':
        return this.moderationService.offeringHodForwardAfterDean(mod._id);
      case 'hodForwardToDean':
        return this.moderationService.hodForwardToDean(mod._id);
      case 'deanApprove':
        return this.moderationService.deanApprove(mod._id);
      default:
        return null;
    }
  }

  // ── Reject flow ───────────────────────────────────────────────────────────

  private runReject(action: IModerationAction, mod: IResultModeration): void {
    const dialogRef = this.dialog.open(RejectModerationDialogComponent, {
      data: {
        title: action.label,
        description: action.description,
        confirmLabel: action.label,
      },
    });

    dialogRef.afterClosed().subscribe((payload: IRejectPayload | null) => {
      if (!payload) return;
      const call = this.rejectCallForKind(action.kind, mod, payload);
      if (call) this.execute(call);
    });
  }

  private rejectCallForKind(
    kind: ModerationActionKind,
    mod: IResultModeration,
    body: IRejectPayload
  ): Observable<IAPIResponse<IResultModeration>> | null {
    switch (kind) {
      case 'homeHodReject':
        return this.moderationService.homeHodReject(mod._id, body);
      case 'offeringHodReject':
        return this.moderationService.offeringHodReject(mod._id, body);
      case 'deanReject':
        return this.moderationService.deanReject(mod._id, body);
      default:
        return null;
    }
  }

  // ── Assign moderator flow ─────────────────────────────────────────────────

  private runAssign(action: IModerationAction, mod: IResultModeration): void {
    const departmentId = this.assignmentDepartmentId(action.kind, mod);
    if (!departmentId) {
      this.toast.showNotification(
        'error',
        'Could not open picker',
        'Department information is missing for this moderation.'
      );
      return;
    }

    const dialogRef = this.dialog.open(AssignModeratorDialogComponent, {
      data: {
        title: action.label,
        subtitle: this.courseSummary(mod) + ' · ' + this.studentSummary(mod),
        departmentId,
      },
      width: '32rem',
    });

    dialogRef
      .afterClosed()
      .subscribe((payload: IAssignModeratorPayload | null) => {
        if (!payload) return;
        const call =
          action.kind === 'homeHodApproveInternal'
            ? this.moderationService.homeHodApproveInternal(mod._id, payload)
            : this.moderationService.offeringHodApprove(mod._id, payload);
        this.execute(call);
      });
  }

  /**
   * Internal approval picks from the home dept; cross approval picks from the
   * offering (course-owning) dept. Falls back to the moderation's homeDept
   * for safety so the dialog never opens with an empty list.
   */
  private assignmentDepartmentId(
    kind: ModerationActionKind,
    mod: IResultModeration
  ): string {
    if (kind === 'homeHodApproveInternal') return refId(mod.homeDepartment);
    if (kind === 'offeringHodApprove') return refId(mod.offeringDepartment);
    return refId(mod.homeDepartment);
  }

  // ── Network helper ────────────────────────────────────────────────────────

  private execute(call: Observable<IAPIResponse<IResultModeration>>): void {
    this.acting.set(true);
    call.pipe(finalize(() => this.acting.set(false))).subscribe({
      next: (resp) => {
        if (!resp.status) return;
        this.moderation.set(resp.data);
        this.moderationInboxBadge.refresh();
        this.refreshComments.update((v) => !v);
        this.toast.showNotification(
          'success',
          'Action completed',
          'Moderation has been updated.'
        );
      },
      error: (err: { error?: { message?: string } }) => {
        this.toast.showNotification(
          'error',
          'Action failed',
          err?.error?.message ??
            'Could not complete the action. Please try again.'
        );
      },
    });
  }

  // ── Display helpers (kept tight so the template stays declarative) ────────

  scopeLabel(mod: IResultModeration): string {
    return isCross(mod) ? 'Cross-department' : 'Internal';
  }

  courseSummary(mod: IResultModeration): string {
    if (typeof mod.course === 'string') return '—';
    const c = mod.course as ICourse;
    return [c.courseCode, c.courseTitle].filter(Boolean).join(' · ');
  }

  studentSummary(mod: IResultModeration): string {
    if (typeof mod.student === 'string') return '—';
    const s = mod.student as IStudent;
    return s.fullName ?? s.registrationNumber ?? '—';
  }

  studentRegNo(mod: IResultModeration): string {
    if (typeof mod.student === 'string') return '';
    return (mod.student as IStudent).registrationNumber ?? '';
  }

  homeDeptName(mod: IResultModeration): string {
    return this.deptName(mod.homeDepartment);
  }

  offeringDeptName(mod: IResultModeration): string {
    return this.deptName(mod.offeringDepartment);
  }

  private deptName(
    ref: string | IDepartment | { name?: string } | null | undefined
  ): string {
    if (!ref) return '—';
    if (typeof ref === 'string') return '—';
    return (ref as IDepartment).name ?? '—';
  }

  currentHandlerName(mod: IResultModeration): string {
    if (!mod.currentHandler) return '—';
    if (typeof mod.currentHandler === 'string') return '—';
    const h = mod.currentHandler;
    return `${h.firstname ?? ''} ${h.lastname ?? ''}`.trim() || '—';
  }

  assignedModeratorName(mod: IResultModeration): string {
    if (!mod.assignedModerator) return '—';
    if (typeof mod.assignedModerator === 'string') return '—';
    const m = mod.assignedModerator;
    return `${m.firstname ?? ''} ${m.lastname ?? ''}`.trim() || '—';
  }

  trackAction(_index: number, action: IModerationAction): string {
    return action.kind;
  }

  trackHistory(index: number): number {
    return index;
  }

  private scrollToScoreForm(): void {
    const el = document.getElementById('moderation-score-form');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
