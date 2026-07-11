import { DatePipe, TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SkeletonComponent } from '../../../../@shared/components/skeleton/skeleton.component';
import {
  ICourseRegistration,
  ICurriculumEntry,
  IOutstandingCarryOver,
  IRegistrationEntry,
  IRegistrationStudent,
  IStudentCgpa,
  RegistrationEntryStatus,
  RegistrationEntryType,
  RegistrationStatus,
} from '../../models/registration.model';
import { RegistrationService } from '../../services/registration.service';

interface IAddCandidate {
  courseId: string;
  label: string;
  kind: 'CURRICULUM' | 'CARRYOVER';
}

/**
 * One student's registration: load meter, entries with drop controls,
 * unplaced carry-overs with the engine's suggestions, add-course panel,
 * overload approval, CGPA context and the full decision trace.
 */
@Component({
  selector: 'app-registration-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    TitleCasePipe,
    ReactiveFormsModule,
    ButtonComponent,
    SkeletonComponent,
  ],
  templateUrl: './registration-detail.component.html',
  styleUrl: './registration-detail.component.scss',
})
export class RegistrationDetailComponent implements OnInit {
  private readonly registrationService = inject(RegistrationService);
  private readonly authService = inject(AuthenticationService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly RegistrationStatus = RegistrationStatus;
  readonly EntryStatus = RegistrationEntryStatus;

  loading = signal(true);
  acting = signal(false);
  registration = signal<ICourseRegistration | null>(null);
  cgpa = signal<IStudentCgpa | null>(null);
  ledger = signal<IOutstandingCarryOver[]>([]);
  curriculum = signal<ICurriculumEntry[]>([]);
  showTrace = signal(false);

  addCtrl = new FormControl<string>('');

  readonly student = computed<IRegistrationStudent | null>(() => {
    const reg = this.registration();
    return reg && typeof reg.student === 'object' ? reg.student : null;
  });

  readonly activeEntries = computed(() =>
    (this.registration()?.entries ?? []).filter(
      (e) => e.status === RegistrationEntryStatus.REGISTERED
    )
  );

  readonly droppedEntries = computed(() =>
    (this.registration()?.entries ?? []).filter(
      (e) => e.status === RegistrationEntryStatus.DROPPED
    )
  );

  readonly siwesUnits = computed(() => {
    const reg = this.registration();
    return reg ? reg.totalUnits - reg.nonSiwesUnits : 0;
  });

  /** Non-SIWES cap for the meter: 24, or 27 when 400L+. */
  readonly unitCap = computed(() => {
    const level = Number(this.registration()?.level ?? 0);
    return level >= 400 ? 27 : 24;
  });

  readonly addCandidates = computed<IAddCandidate[]>(() => {
    const reg = this.registration();
    if (!reg) return [];
    const registered = new Set(
      this.activeEntries().map((e) => String(e.course))
    );
    const fromCurriculum: IAddCandidate[] = this.curriculum()
      .filter((c) => !registered.has(c.course._id))
      .map((c) => ({
        courseId: c.course._id,
        label: `${c.course.courseCode} · ${c.units}u · ${c.courseType}${c.electiveGroup ? ` (${c.electiveGroup})` : ''}`,
        kind: 'CURRICULUM',
      }));
    const fromLedger: IAddCandidate[] = this.ledger()
      .filter(
        (c) => !registered.has(c.courseId) && c.courseSemester === reg.semester
      )
      .map((c) => ({
        courseId: c.courseId,
        label: `${c.courseCode} · ${c.units}u · CARRY-OVER (failed ${c.failedInSession})`,
        kind: 'CARRYOVER',
      }));
    return [...fromLedger, ...fromCurriculum];
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.fetch(id);
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.registrationService
      .findOne(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          this.registration.set(resp.data);
          this.loadContext(resp.data);
        },
        error: () =>
          this.toast.showNotification(
            'error',
            'Not found',
            'Could not load this registration.'
          ),
      });
  }

  private loadContext(reg: ICourseRegistration): void {
    const studentId =
      typeof reg.student === 'object' ? reg.student._id : reg.student;
    this.registrationService.cgpa(studentId).subscribe({
      next: (resp) => this.cgpa.set(resp.data),
    });
    this.registrationService.carryOvers(studentId).subscribe({
      next: (resp) => this.ledger.set(resp.data ?? []),
    });
    const departmentId = this.authService.activeAccount()?.department?._id;
    if (departmentId) {
      this.registrationService
        .curriculum(departmentId, reg.level, reg.semester)
        .subscribe({ next: (resp) => this.curriculum.set(resp.data ?? []) });
    }
  }

  goBack(): void {
    void this.router.navigate(['/registration']);
  }

  resetRegistration(): void {
    const reg = this.registration();
    if (!reg) return;
    const ref = this.dialog.open(ConfirmationComponent, {
      data: {
        message: 'Reset this registration?',
        subTitle:
          'It is deleted and regenerated from scratch the next time you run ' +
          'auto-registration. Manual edits on it are lost.',
      },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.acting.set(true);
      this.registrationService
        .reset(reg._id)
        .pipe(finalize(() => this.acting.set(false)))
        .subscribe({
          next: () => {
            this.toast.showNotification(
              'success',
              'Registration reset',
              'Run auto-registration again to regenerate it.'
            );
            void this.router.navigate(['/registration']);
          },
          error: (err: { error?: { message?: string } }) =>
            this.toast.showNotification(
              'error',
              'Reset failed',
              err?.error?.message ?? 'Could not reset this registration.'
            ),
        });
    });
  }

  approveOverload(): void {
    const reg = this.registration();
    if (!reg) return;
    const ref = this.dialog.open(ConfirmationComponent, {
      data: {
        message: 'Approve this overload?',
        subTitle:
          `${reg.nonSiwesUnits} units exceeds the normal 24-unit cap. ` +
          `Approving effects the registration as proposed.`,
      },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.mutate(this.registrationService.approveOverload(reg._id));
    });
  }

  dropEntry(entry: IRegistrationEntry): void {
    const reg = this.registration();
    if (!reg) return;
    const ref = this.dialog.open(ConfirmationComponent, {
      data: {
        message: `Drop ${entry.courseCode}?`,
        subTitle:
          entry.type === RegistrationEntryType.COMPULSORY
            ? 'This is a COMPULSORY course — dropping defers it to a future session.'
            : 'The course is removed from this registration (kept in the audit trail).',
      },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.mutate(
        this.registrationService.editEntries(reg._id, {
          drop: [{ courseId: String(entry.course) }],
        })
      );
    });
  }

  addSelected(): void {
    const reg = this.registration();
    const courseId = this.addCtrl.value;
    if (!reg || !courseId) return;
    this.mutate(
      this.registrationService.editEntries(reg._id, {
        add: [{ courseId }],
      })
    );
    this.addCtrl.setValue('');
  }

  private mutate(
    call: ReturnType<RegistrationService['approveOverload']>
  ): void {
    this.acting.set(true);
    call.pipe(finalize(() => this.acting.set(false))).subscribe({
      next: (resp) => {
        this.registration.set(resp.data);
        this.toast.showNotification(
          'success',
          'Updated',
          'Registration updated.'
        );
      },
      error: (err: { error?: { message?: string } }) =>
        this.toast.showNotification(
          'error',
          'Action failed',
          err?.error?.message ?? 'Could not update the registration.'
        ),
    });
  }

  entryTypeClass(type: RegistrationEntryType): string {
    return `reg-type reg-type--${type.toLowerCase()}`;
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

  toggleTrace(): void {
    this.showTrace.update((v) => !v);
  }

  trackEntry(_index: number, entry: IRegistrationEntry): string {
    return entry._id;
  }

  trackIndex(index: number): number {
    return index;
  }
}
