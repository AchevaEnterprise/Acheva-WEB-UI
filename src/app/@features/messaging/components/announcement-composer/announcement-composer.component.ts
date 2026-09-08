import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialogRef } from '@angular/material/dialog';

import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { ToastService } from '../../../../@core/utility/toast.service';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { RoleEnum } from '../../../auth/model/auth.model';
import { RecipientClass } from '../../models/messaging.model';
import { MessagingService } from '../../services/messaging.service';

interface AudienceOption {
  readonly value: RecipientClass;
  readonly label: string;
  readonly detail: string;
}

/**
 * Write an announcement.
 *
 * The audience the author may choose is derived from the office they hold, and
 * it is derived AGAIN on the server — this list only decides what to render.
 * A Head who edited the request to say FACULTY would still be answered with
 * their own department, because the server never takes the scope from the
 * client.
 */
@Component({
  selector: 'app-announcement-composer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  templateUrl: './announcement-composer.component.html',
  styleUrl: './announcement-composer.component.scss',
})
export class AnnouncementComposerComponent {
  private readonly dialogRef =
    inject<MatDialogRef<AnnouncementComposerComponent, boolean>>(MatDialogRef);
  private readonly messaging = inject(MessagingService);
  private readonly auth = inject(AuthenticationService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly subject = signal('');
  readonly body = signal('');
  readonly recipientClass = signal<RecipientClass>('STAFF');
  readonly sending = signal(false);

  private readonly role = computed(() => this.auth.activeAccount()?.role);

  /** Where this person's announcements reach — fixed by their office. */
  readonly scopeLabel = computed(() => {
    switch (this.role()) {
      case RoleEnum.DEAN:
        return 'your faculty';
      case RoleEnum.HOD:
        return 'your department';
      default:
        return 'your cohort';
    }
  });

  /**
   * A Course Advisor addresses students only — they hold no authority over
   * staff, so offering them a "staff" option would be offering something the
   * server will refuse.
   */
  readonly options = computed<AudienceOption[]>(() => {
    if (this.role() === RoleEnum.COURSE_ADVISOR) {
      return [
        {
          value: 'STUDENTS',
          label: 'My students',
          detail: 'Everyone in the cohort you advise',
        },
      ];
    }

    const where = this.scopeLabel();
    return [
      {
        value: 'STAFF',
        label: 'Staff only',
        detail: `Every member of staff in ${where}`,
      },
      {
        value: 'STUDENTS',
        label: 'Students only',
        detail: `Every student in ${where}`,
      },
      {
        value: 'EVERYONE',
        label: 'Everyone',
        detail: `All staff and all students in ${where}`,
      },
    ];
  });

  readonly canSend = computed(
    () =>
      this.subject().trim().length > 0 &&
      this.body().trim().length > 0 &&
      !this.sending()
  );

  constructor() {
    // A Course Advisor has exactly one audience; preselect it rather than
    // making them choose from a list of one.
    if (this.role() === RoleEnum.COURSE_ADVISOR) {
      this.recipientClass.set('STUDENTS');
    }
  }

  send(): void {
    if (!this.canSend()) return;
    this.sending.set(true);

    this.messaging
      .announce({
        recipientClass: this.recipientClass(),
        subject: this.subject().trim(),
        body: this.body().trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          const count = resp.data?.recipients ?? 0;
          this.toast.showNotification(
            'success',
            'Announcement sent',
            `Delivered to ${count} ${count === 1 ? 'person' : 'people'}.`
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.sending.set(false);
          this.toast.showNotification(
            'error',
            'Not sent',
            err?.error?.message ??
              'That announcement could not be sent. Please try again.'
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
