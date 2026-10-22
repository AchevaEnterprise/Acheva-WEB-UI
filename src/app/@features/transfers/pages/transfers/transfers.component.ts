import { DatePipe, TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { ToastService } from '../../../../@core/utility/toast.service';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { SkeletonTableComponent } from '../../../../@shared/components/skeleton/skeleton-table.component';
import { StatusBadgeComponent } from '../../../../@shared/components/status-badge/status-badge.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { IDepartmentTransfer } from '../../models/transfer.model';
import { TransfersService } from '../../services/transfers.service';
import {
  getTransferActions,
  idOf,
  nameOf,
  transferStatusLabel,
  transferStatusTone,
} from '../../utils/transfer-status';

/**
 * Department transfers — one page for both sides of the flow.
 *
 * A Course Advisor and a Head of Department see the same list, split by whose
 * turn it is rather than by role. That is deliberate: the advisor who sent a
 * letter needs to watch it, and it is by definition on somebody else's desk
 * while they do. Two separate screens would mean a letter disappearing the
 * moment it was sent.
 */
@Component({
  selector: 'app-transfers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    TitleCasePipe,
    ButtonComponent,
    EmptyStateComponent,
    SkeletonTableComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './transfers.component.html',
  styleUrl: './transfers.component.scss',
})
export class TransfersComponent implements OnInit {
  private readonly transfersService = inject(TransfersService);
  private readonly authService = inject(AuthenticationService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly transfers = signal<IDepartmentTransfer[]>([]);

  private readonly me = computed(() =>
    String(this.authService.activeAccount()?.id ?? '')
  );

  /** Awaiting MY decision — the queue, first because it is work owed. */
  readonly onMyDesk = computed(() =>
    this.transfers().filter(
      (transfer) => getTransferActions(transfer, this.me()).canDecide
    )
  );

  /** Drafts and returned letters I still have to act on. */
  readonly myDrafts = computed(() =>
    this.transfers().filter(
      (transfer) => getTransferActions(transfer, this.me()).canSubmit
    )
  );

  /** Everything else I am party to — sent, approved, withdrawn. */
  readonly settled = computed(() => {
    const active = new Set([
      ...this.onMyDesk().map((transfer) => transfer._id),
      ...this.myDrafts().map((transfer) => transfer._id),
    ]);
    return this.transfers().filter((transfer) => !active.has(transfer._id));
  });

  readonly statusLabel = transferStatusLabel;
  readonly statusTone = transferStatusTone;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.transfersService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.transfers.set(resp.data ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.toastService.showNotification(
            'error',
            'Could not load transfers',
            err?.error?.message ?? 'Please try again.'
          );
        },
      });
  }

  studentName(transfer: IDepartmentTransfer): string {
    // The snapshot, not the live student: after a completed transfer the
    // live record no longer says which department they came from, and this
    // row is a record of the move.
    return transfer.snapshot?.fullName ?? '';
  }

  regNo(transfer: IDepartmentTransfer): string {
    return transfer.snapshot?.registrationNumber ?? '';
  }

  departmentName(value: unknown): string {
    if (!value || typeof value === 'string') return '—';
    return (value as { name?: string }).name ?? '—';
  }

  advisorName(transfer: IDepartmentTransfer): string {
    return nameOf(transfer.submittedBy) || '—';
  }

  open(transfer: IDepartmentTransfer): void {
    void this.router.navigate(['/transfers', transfer._id]);
  }

  compose(): void {
    void this.router.navigate(['/transfers/new']);
  }

  /** Only a Course Advisor raises a transfer, so only they get the button. */
  readonly canCompose = computed(() => {
    const account = this.authService.activeAccount();
    const roles = [account?.role, ...(account?.otherRoles ?? [])];
    return roles.includes(RoleEnum.COURSE_ADVISOR);
  });

  readonly idOf = idOf;
}
