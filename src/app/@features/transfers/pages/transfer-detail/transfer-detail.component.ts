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
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { finalize } from 'rxjs';

import { ToastService } from '../../../../@core/utility/toast.service';
import { BackButtonComponent } from '../../../../@shared/components/back-button/back-button.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { RejectReasonComponent } from '../../../../@shared/components/reject-reason/reject-reason.component';
import { SkeletonComponent } from '../../../../@shared/components/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../../../@shared/components/status-badge/status-badge.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { IDepartmentTransfer } from '../../models/transfer.model';
import { TransfersService } from '../../services/transfers.service';
import {
  getTransferActions,
  nameOf,
  transferStatusLabel,
  transferStatusTone,
} from '../../utils/transfer-status';

/**
 * One transfer request, from either side.
 *
 * The receiving Head reads the letter and the attached record and decides;
 * the advisor who raised it watches, and can still withdraw it or send a
 * returned one back. Which buttons appear comes from `getTransferActions`,
 * which derives them from `currentHandler` exactly as the server does — so
 * no button is offered that the API would refuse.
 */
@Component({
  selector: 'app-transfer-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    TitleCasePipe,
    BackButtonComponent,
    ButtonComponent,
    SkeletonComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './transfer-detail.component.html',
  styleUrl: './transfer-detail.component.scss',
})
export class TransferDetailComponent implements OnInit {
  private readonly transfersService = inject(TransfersService);
  private readonly authService = inject(AuthenticationService);
  private readonly toastService = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly transfer = signal<IDepartmentTransfer | null>(null);

  readonly statusLabel = transferStatusLabel;
  readonly statusTone = transferStatusTone;
  readonly nameOf = nameOf;

  private readonly me = computed(() =>
    String(this.authService.activeAccount()?.id ?? '')
  );

  readonly actions = computed(() => {
    const transfer = this.transfer();
    if (!transfer) {
      return {
        canEdit: false,
        canSubmit: false,
        canCancel: false,
        canDecide: false,
      };
    }
    return getTransferActions(transfer, this.me());
  });

  /**
   * The letter is rich text the advisor wrote, so it has to be rendered as
   * HTML. `bypassSecurityTrustHtml` is safe here only because the body is
   * produced by Quill's own whitelist on the way in and is written by a
   * member of staff, not by a student or the public.
   */
  readonly letterHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.transfer()?.letterBody ?? '')
  );

  /** Grades grouped by session, as a record is read. */
  readonly sessions = computed(() => {
    const entries = this.transfer()?.snapshot?.entries ?? [];
    const groups = new Map<string, typeof entries>();
    for (const entry of entries) {
      const list = groups.get(entry.session) ?? [];
      list.push(entry);
      groups.set(entry.session, list);
    }
    return [...groups]
      .map(([session, rows]) => ({ session, rows }))
      .sort((a, b) => a.session.localeCompare(b.session));
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/transfers']);
      return;
    }
    this.load(id);
  }

  private load(id: string): void {
    this.loading.set(true);
    this.transfersService
      .findOne(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (resp) => this.transfer.set(resp.data),
        error: (err) => {
          this.toastService.showNotification(
            'error',
            'Could not open this request',
            err?.status === 404
              ? 'It does not exist, or it is not yours to see.'
              : (err?.error?.message ?? 'Please try again.')
          );
          void this.router.navigate(['/transfers']);
        },
      });
  }

  departmentName(value: unknown): string {
    if (!value || typeof value === 'string') return '—';
    return (value as { name?: string }).name ?? '—';
  }

  approve(): void {
    const transfer = this.transfer();
    if (!transfer || this.busy()) return;

    const dialog = this.dialog.open(ConfirmationComponent, {
      width: '440px',
      data: {
        message: `Accept ${transfer.snapshot.fullName} into your department?`,
        // Said plainly, because this is the irreversible bit.
        subTitle:
          `They move to ${transfer.toLevel} level immediately, with their ` +
          `record. A transfer cannot be reversed — correcting one means ` +
          `raising a new transfer in the other direction.`,
      },
    });

    dialog
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.busy.set(true);
        this.transfersService
          .approve(transfer._id)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => this.busy.set(false))
          )
          .subscribe({
            next: (resp) => {
              this.transfer.set(resp.data);
              this.toastService.showNotification(
                'success',
                'Transfer approved',
                `${transfer.snapshot.fullName} is now in your department.`
              );
            },
            error: (err) =>
              this.toastService.showNotification(
                'error',
                'Could not approve it',
                err?.error?.message ?? 'Please try again.'
              ),
          });
      });
  }

  reject(): void {
    const transfer = this.transfer();
    if (!transfer || this.busy()) return;

    const dialog = this.dialog.open(RejectReasonComponent, {
      width: '480px',
      // The shared dialog's `data` names a result id; a transfer id is what
      // this flow has, and the field is only carried for context.
      data: { resultId: transfer._id },
    });

    dialog
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((reason?: string) => {
        if (!reason?.trim()) return;
        this.busy.set(true);
        this.transfersService
          .reject(transfer._id, reason.trim())
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => this.busy.set(false))
          )
          .subscribe({
            next: (resp) => {
              this.transfer.set(resp.data);
              this.toastService.showNotification(
                'success',
                'Returned to the advisor',
                'They have been notified with your reason.'
              );
            },
            error: (err) =>
              this.toastService.showNotification(
                'error',
                'Could not return it',
                err?.error?.message ?? 'Please try again.'
              ),
          });
      });
  }

  submit(): void {
    const transfer = this.transfer();
    if (!transfer || this.busy()) return;

    this.busy.set(true);
    this.transfersService
      .submit(transfer._id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false))
      )
      .subscribe({
        next: (resp) => {
          this.transfer.set(resp.data);
          this.toastService.showNotification(
            'success',
            'Sent to the receiving Head',
            'You will be notified when they decide.'
          );
        },
        error: (err) =>
          this.toastService.showNotification(
            'error',
            'Could not send it',
            err?.error?.message ?? 'Please try again.'
          ),
      });
  }

  withdraw(): void {
    const transfer = this.transfer();
    if (!transfer || this.busy()) return;

    this.busy.set(true);
    this.transfersService
      .cancel(transfer._id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false))
      )
      .subscribe({
        next: (resp) => {
          this.transfer.set(resp.data);
          this.toastService.showNotification(
            'success',
            'Request withdrawn',
            'The student can be transferred again later.'
          );
        },
        error: (err) =>
          this.toastService.showNotification(
            'error',
            'Could not withdraw it',
            err?.error?.message ?? 'Please try again.'
          ),
      });
  }
}
