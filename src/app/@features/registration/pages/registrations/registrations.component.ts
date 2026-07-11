import { TitleCasePipe } from '@angular/common';
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
  running = signal(false);
  registrations = signal<ICourseRegistration[]>([]);
  /** Pending elective outcomes (fail / C-or-lower) awaiting the CA's call. */
  reviews = signal<IElectiveReview[]>([]);
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
  }

  reviewStudent(review: IElectiveReview): IRegistrationStudent | null {
    return typeof review.student === 'object' ? review.student : null;
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

  runRegistration(): void {
    if (this.sessionCtrl.invalid) {
      this.toast.showNotification(
        'warning',
        'Invalid session',
        'Enter a session like 2026/2027.'
      );
      return;
    }
    const ref = this.dialog.open(ConfirmationComponent, {
      data: {
        message: 'Run auto-registration?',
        subTitle:
          `Every student in your cohort without a registration for ` +
          `${this.sessionCtrl.value} · ${this.semester().toLowerCase()} will ` +
          `be registered automatically. Existing registrations are untouched.`,
      },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.running.set(true);
      this.registrationService
        .run(this.sessionCtrl.value, this.semester())
        .pipe(finalize(() => this.running.set(false)))
        .subscribe({
          next: (resp) => {
            const r = resp.data;
            this.toast.showNotification(
              'success',
              'Auto-registration complete',
              `${r.registered} registered · ${r.pendingApproval} awaiting ` +
                `your approval · ${r.needsAttention} need attention · ` +
                `${r.skippedExisting} already registered`
            );
            this.load();
          },
          error: (err: { error?: { message?: string } }) => {
            this.toast.showNotification(
              'error',
              'Run failed',
              err?.error?.message ?? 'Could not run auto-registration.'
            );
          },
        });
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
