import { DatePipe, TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SkeletonTableComponent } from '../../../../@shared/components/skeleton/skeleton-table.component';
import { UploadDialogComponent } from '../../../../@shared/components/upload-dialog/upload-dialog.component';
import {
  ICourseRegistration,
  IElectiveReview,
  IRegistrationStudent,
  RegistrationStatus,
} from '../../models/registration.model';
import { RegistrationService } from '../../services/registration.service';

const SEMESTERS = ['1ST SEMESTER', '2ND SEMESTER'] as const;

/**
 * Course Advisor cohort registration page: run auto-registration for a
 * (session, semester), see every student's load + status, drill into one
 * student to resolve carry-overs / approve overloads.
 */
@Component({
  selector: 'app-registrations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe,
    DatePipe,
    ReactiveFormsModule,
    ButtonComponent,
    SkeletonTableComponent,
    EmptyStateComponent,
    MatTableModule,
  ],
  templateUrl: './registrations.component.html',
  styleUrl: './registrations.component.scss',
})
export class RegistrationsComponent implements OnInit {
  private readonly registrationService = inject(RegistrationService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly semesters = SEMESTERS;
  readonly displayedColumns = ['sn', 'regNo', 'name', 'units', 'status'];

  sessionCtrl = new FormControl<string>('2026/2027', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{4}\/\d{4}$/)],
  });
  semester = signal<string>(SEMESTERS[0]);

  loading = signal(false);
  registrations = signal<ICourseRegistration[]>([]);
  /** Pending elective outcomes (fail / C-or-lower) awaiting the CA's call. */
  reviews = signal<IElectiveReview[]>([]);
  /** Decisions already made — kept visible so a mis-click can be undone. */
  recentDecisions = signal<IElectiveReview[]>([]);
  deciding = signal(false);

  readonly counts = computed(() => {
    const list = this.registrations();
    return {
      active: list.filter((r) => r.status === RegistrationStatus.ACTIVE).length,
      pending: list.filter(
        (r) => r.status === RegistrationStatus.PENDING_CA_APPROVAL
      ).length,
      attention: list.filter(
        (r) => r.status === RegistrationStatus.NEEDS_ATTENTION
      ).length,
    };
  });

  ngOnInit(): void {
    // Inherit the admin-controlled active session/semester; fall back to the
    // local defaults when the school has not configured one yet.
    this.registrationService.schoolSettings().subscribe({
      next: (resp) => {
        if (resp.data) {
          this.sessionCtrl.setValue(resp.data.activeSession);
          this.semester.set(resp.data.activeSemester);
        }
        this.load();
      },
      error: () => this.load(),
    });
    this.loadReviews();
  }

  loadReviews(): void {
    this.registrationService.reviews().subscribe({
      next: (resp) => this.reviews.set(resp.data ?? []),
      error: () => {
        /* non-CA roles simply have no queue */
      },
    });
    this.registrationService.recentlyDecidedReviews().subscribe({
      next: (resp) => this.recentDecisions.set(resp.data ?? []),
      error: () => {
        /* non-CA roles simply have no queue */
      },
    });
  }

  reviewStudent(review: IElectiveReview): IRegistrationStudent | null {
    return typeof review.student === 'object' ? review.student : null;
  }

  /**
   * A registration mismatch (the student sat something they were not
   * registered for) is approved or rejected — never keep/unregister. Nothing
   * is applied until the CA decides; the score is held out of GPA meanwhile.
   */
  isMismatch(review: IElectiveReview): boolean {
    return (
      review.kind === 'ELECTIVE_MISMATCH' ||
      review.kind === 'UNREGISTERED_WRITE' ||
      review.kind === 'DROPPED_WRITE'
    );
  }

  /** What the CA is being asked to decide, in their own words. */
  mismatchPrompt(review: IElectiveReview): string {
    switch (review.kind) {
      case 'ELECTIVE_MISMATCH':
        return `Wrote ${review.courseCode}, registered for ${
          review.relatedCourseCode ?? 'another course'
        }`;
      case 'UNREGISTERED_WRITE':
        return `Wrote ${review.courseCode} without registering for it`;
      case 'DROPPED_WRITE':
        return `Wrote ${review.courseCode}, which was dropped from their registration`;
      default:
        return '';
    }
  }

  mismatchApproveLabel(review: IElectiveReview): string {
    switch (review.kind) {
      case 'ELECTIVE_MISMATCH':
        return 'Approve swap';
      case 'DROPPED_WRITE':
        return 'Reinstate';
      default:
        return 'Register';
    }
  }

  decideMismatch(
    review: IElectiveReview,
    decision: 'APPROVE' | 'REJECT'
  ): void {
    const approving = decision === 'APPROVE';
    const ref = this.dialog.open(ConfirmationComponent, {
      data: {
        message: approving
          ? `${this.mismatchApproveLabel(review)} ${review.courseCode}?`
          : `Reject ${review.courseCode}?`,
        subTitle: approving
          ? this.approveSubtitle(review)
          : 'The course will not be added to their registration and the ' +
            'published score will be voided — it counts for nothing. ' +
            'Reversible from Recently decided. Fully audited.',
      },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.deciding.set(true);
      this.registrationService
        .decideReview(review._id, decision)
        .pipe(finalize(() => this.deciding.set(false)))
        .subscribe({
          next: () => {
            this.toast.showNotification(
              'success',
              approving ? 'Registration updated' : 'Course rejected',
              approving
                ? `${review.courseCode} is registered and the score now counts.`
                : `${review.courseCode} was rejected and its score voided.`
            );
            this.loadReviews();
            this.load();
          },
          error: (err: { error?: { message?: string } }) =>
            this.toast.showNotification(
              'error',
              'Decision failed',
              err?.error?.message ?? 'Could not apply the decision.'
            ),
        });
    });
  }

  private approveSubtitle(review: IElectiveReview): string {
    const tail =
      ' The held score will start counting toward their CGPA. Fully audited.';
    if (review.kind === 'ELECTIVE_MISMATCH') {
      return (
        `${review.relatedCourseCode ?? 'The registered course'} will be ` +
        `dropped and ${review.courseCode} registered in its place.${tail}`
      );
    }
    if (review.kind === 'DROPPED_WRITE') {
      return `${review.courseCode} will be put back on their registration.${tail}`;
    }
    return `${review.courseCode} will be added to their registration.${tail}`;
  }

  decidedByName(review: IElectiveReview): string {
    const by = review.decidedBy;
    return by && typeof by === 'object' ? `${by.firstname} ${by.lastname}` : '';
  }

  /**
   * Undo a decision. An UNREGISTER reversal un-voids the published entry, so
   * the grade starts counting toward CGPA again — spelled out in the dialog
   * rather than left as a silent side effect.
   */
  undoDecision(review: IElectiveReview): void {
    const wasUnregistered = review.status === 'UNREGISTERED';
    const ref = this.dialog.open(ConfirmationComponent, {
      data: {
        message: `Undo the decision on ${review.courseCode}?`,
        subTitle: wasUnregistered
          ? 'The course is re-registered and the published score is un-voided ' +
            '— it counts toward CGPA and carry-overs again. Returns to your ' +
            'pending queue. Fully audited.'
          : 'The review returns to your pending queue so you can decide again. ' +
            'Fully audited.',
      },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.deciding.set(true);
      this.registrationService
        .revertReview(review._id)
        .pipe(finalize(() => this.deciding.set(false)))
        .subscribe({
          next: () => {
            this.toast.showNotification(
              'success',
              'Decision undone',
              `${review.courseCode} is back in your pending queue.`
            );
            this.loadReviews();
            this.load();
          },
          error: (err: { error?: { message?: string } }) =>
            this.toast.showNotification(
              'error',
              'Undo failed',
              err?.error?.message ?? 'Could not undo the decision.'
            ),
        });
    });
  }

  decide(review: IElectiveReview, decision: 'KEEP' | 'UNREGISTER'): void {
    const ref = this.dialog.open(ConfirmationComponent, {
      data: {
        message:
          decision === 'KEEP'
            ? `Keep ${review.courseCode} (${review.grade}) on the record?`
            : `Unregister ${review.courseCode}?`,
        subTitle:
          decision === 'KEEP'
            ? 'The grade stands and counts toward the CGPA.'
            : 'The registration line is dropped and the published score is ' +
              'voided — it stops counting toward CGPA and carry-overs. Fully audited.',
      },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.deciding.set(true);
      this.registrationService
        .decideReview(review._id, decision)
        .pipe(finalize(() => this.deciding.set(false)))
        .subscribe({
          next: () => {
            this.toast.showNotification(
              'success',
              decision === 'KEEP' ? 'Grade kept' : 'Course unregistered',
              decision === 'KEEP'
                ? `${review.courseCode} stays on the student's record.`
                : `${review.courseCode} was unregistered and the entry voided.`
            );
            this.loadReviews();
            this.load();
          },
          error: (err: { error?: { message?: string } }) =>
            this.toast.showNotification(
              'error',
              'Decision failed',
              err?.error?.message ?? 'Could not apply the decision.'
            ),
        });
    });
  }

  setSemester(semester: string): void {
    if (this.semester() === semester) return;
    this.semester.set(semester);
    this.load();
  }

  load(): void {
    if (this.sessionCtrl.invalid) return;
    this.loading.set(true);
    this.registrationService
      .list({ session: this.sessionCtrl.value, semester: this.semester() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => this.registrations.set(resp.data ?? []),
        error: () =>
          this.toast.showNotification(
            'error',
            'Load failed',
            'Could not load registrations.'
          ),
      });
  }

  importCurriculum(): void {
    this.dialog
      .open(UploadDialogComponent, {
        width: '600px',
        data: {
          title: 'Import Curriculum',
          description:
            'Upload the curriculum spreadsheet (.xlsx). Columns: department, ' +
            'owningDepartment, level, semester, courseCode, courseTitle, ' +
            'units, type, electiveGroup, groupMinRequired.',
        },
      })
      .afterClosed()
      .subscribe((file: File | undefined) => {
        if (!file) return;
        this.registrationService.importCurriculum(file).subscribe({
          next: (resp) => {
            const r = resp.data;
            const issues = r.rowErrors.length + r.blockIssues.length;
            this.toast.showNotification(
              issues ? 'warning' : 'success',
              'Curriculum imported',
              `${r.entriesCreated} created, ${r.entriesUpdated} updated, ` +
                `${r.coursesCreated} new courses` +
                (issues ? ` — ${issues} issue(s), check the console` : '')
            );
            if (issues) {
              console.warn('Curriculum import issues', {
                rowErrors: r.rowErrors,
                blockIssues: r.blockIssues,
              });
            }
          },
          error: (err: { error?: { message?: string } }) =>
            this.toast.showNotification(
              'error',
              'Import failed',
              err?.error?.message ?? 'Could not import the curriculum.'
            ),
        });
      });
  }

  downloadTemplate(): void {
    window.open(this.registrationService.templateUrl, '_blank');
  }

  openDetail(registration: ICourseRegistration): void {
    void this.router.navigate(['/registration', registration._id]);
  }

  studentOf(registration: ICourseRegistration): IRegistrationStudent | null {
    return typeof registration.student === 'object'
      ? registration.student
      : null;
  }

  siwesUnits(registration: ICourseRegistration): number {
    return registration.totalUnits - registration.nonSiwesUnits;
  }

  statusLabel(status: RegistrationStatus): string {
    switch (status) {
      case RegistrationStatus.ACTIVE:
        return 'Registered';
      case RegistrationStatus.PENDING_CA_APPROVAL:
        return 'Awaiting your approval';
      case RegistrationStatus.NEEDS_ATTENTION:
        return 'Needs attention';
    }
  }

  trackById(_index: number, registration: ICourseRegistration): string {
    return registration._id;
  }
}
