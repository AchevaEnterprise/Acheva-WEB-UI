import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import { IAPIResponse } from '../../../../@core/models/api-response.model';
import { IDepartment } from '../../../../@core/models/school.model';
import { ToastService } from '../../../../@core/utility/toast.service';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { ICourse } from '../../../courses/models/course.model';
import { ResultsService } from '../../../result-management/services/results.service';
import { IStudent } from '../../../students/models/student.model';
import { ModerationCommentsComponent } from '../../components/moderation-comments/moderation-comments.component';
import { ModerationTimelineComponent } from '../../components/moderation-timeline/moderation-timeline.component';
import { ModeratorScoreFormComponent } from '../../components/moderator-score-form/moderator-score-form.component';
import { RejectModerationDialogComponent } from '../../components/reject-moderation-dialog/reject-moderation-dialog.component';
import {
  IRejectPayload,
  IResultModeration,
  ISubmitOutcomePayload,
  ModerationStatus,
} from '../../models/moderation.model';
import {
  ModerationStatusPipe,
  ModerationStatusVariantPipe,
} from '../../pipes/moderation-status.pipe';
import { ModerationInboxBadgeService } from '../../services/moderation-inbox-badge.service';
import { ModerationService } from '../../services/moderation.service';
import {
  IModerationAction,
  ModerationActionKind,
  getAvailableActions,
  isCross,
  isMyTurn,
  refId,
} from '../../utils/moderation-workflow';
import { normalizeSessionGroups } from '../../utils/session-results';

/** One session-worth of the student's published history (accordion row). */
interface IHistorySession {
  session: string;
  entries: Array<{
    courseCode: string;
    courseTitle: string;
    level: string;
    test: number;
    lab: number;
    exam: number;
    total: number;
    grade: string;
    status: string;
    moderated?: boolean;
    isTarget: boolean;
  }>;
}

/**
 * Moderation detail / action page.
 *
 * Presentation-only: every state mutation goes through `ModerationService`
 * and the available actions come from `getAvailableActions()` so the buttons
 * stay aligned with the backend rules by construction.
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
  private readonly resultsService = inject(ResultsService);
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

  /** The student's full published history, grouped by session (for HOD/Dean review). */
  historySessions = signal<IHistorySession[]>([]);
  historyLoading = signal<boolean>(false);
  /** Which session accordions are open (session string keys). */
  openSessions = signal<Set<string>>(new Set());

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

  /** The moderate panel shows when the action list contains `hodModerate`. */
  showScoreForm = computed(() =>
    this.actions().some((a) => a.kind === 'hodModerate')
  );

  /** Dean review: side-by-side old vs new with a MODERATED tag. */
  isDeanStage = computed(
    () => this.moderation()?.status === ModerationStatus.PENDING_DEAN
  );

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
          if (resp.status) {
            this.moderation.set(resp.data);
            this.loadHistory(resp.data);
          }
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

  /**
   * The student's published results from first year to date — the evidence
   * the HODs and Dean use to judge eligibility. The failing course under
   * moderation is highlighted.
   */
  private loadHistory(mod: IResultModeration): void {
    const studentId = refId(mod.student);
    if (!studentId) return;

    this.historyLoading.set(true);
    this.resultsService
      .getStudentResultsBySessions(studentId)
      .pipe(finalize(() => this.historyLoading.set(false)))
      .subscribe({
        next: (resp) => {
          const targetCourseId = refId(mod.course);

          // Merge same-session groups (one session can span level groups).
          const bySession = new Map<string, IHistorySession>();
          for (const group of normalizeSessionGroups(resp.data)) {
            const bucket = bySession.get(group.session) ?? {
              session: group.session,
              entries: [],
            };
            bucket.entries.push(
              ...group.entries.map((e) => ({
                courseCode: String(e['courseCode'] ?? ''),
                courseTitle: String(e['courseTitle'] ?? ''),
                level: group.level,
                test: Number(e['test'] ?? 0),
                lab: Number(e['lab'] ?? 0),
                exam: Number(e['exam'] ?? 0),
                total: Number(e['total'] ?? 0),
                grade: String(e['grade'] ?? ''),
                status: String(e['status'] ?? ''),
                moderated: Boolean(e['moderated']),
                isTarget: String(e['courseId']) === targetCourseId,
              }))
            );
            bySession.set(group.session, bucket);
          }
          const sessions = [...bySession.values()].sort((a, b) =>
            a.session.localeCompare(b.session)
          );

          this.historySessions.set(sessions);
          // Open the session containing the course under moderation.
          const target = sessions.find((s) =>
            s.entries.some((e) => e.isTarget)
          );
          if (target) this.openSessions.set(new Set([target.session]));
        },
      });
  }

  toggleSession(session: string): void {
    this.openSessions.update((current) => {
      const next = new Set(current);
      if (next.has(session)) next.delete(session);
      else next.add(session);
      return next;
    });
  }

  isSessionOpen(session: string): boolean {
    return this.openSessions().has(session);
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
      case 'score':
        // Inline panel on the page — clicking the button just scrolls there.
        this.scrollToScoreForm();
        return;
      case 'navigate':
        this.openDraftEditor(mod);
        return;
    }
  }

  /** Draft editing happens on the letter page, in edit mode. */
  private openDraftEditor(mod: IResultModeration): void {
    const regNo =
      typeof mod.student === 'object'
        ? ((mod.student as IStudent).registrationNumber ?? '')
        : '';
    const courseId = refId(mod.course);
    if (!regNo || !courseId) {
      this.toast.showNotification(
        'error',
        'Cannot edit',
        'Missing student or course details on this draft.'
      );
      return;
    }
    void this.router.navigate(['/students', regNo, 'moderate', courseId], {
      queryParams: { moderationId: mod._id },
    });
  }

  /** Moderation panel emits its payload directly. */
  submitScore(payload: ISubmitOutcomePayload): void {
    const mod = this.moderation();
    if (!mod) return;
    this.execute(this.moderationService.hodModerate(mod._id, payload));
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

  trackAction(_index: number, action: IModerationAction): string {
    return action.kind;
  }

  trackHistory(index: number): number {
    return index;
  }

  trackSession(_index: number, session: IHistorySession): string {
    return session.session;
  }

  private scrollToScoreForm(): void {
    const el = document.getElementById('moderation-score-form');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
