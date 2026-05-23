import { computed, inject, Injectable, signal } from '@angular/core';
import { take } from 'rxjs';
import { MENU } from '../../../@core/constant/menu';
import { AuthenticationService } from '../../auth/service/auth.service';
import { ModerationService } from './moderation.service';

const MODERATION_MENU_ROUTE = 'moderation';

/**
 * Tracks how many moderation requests are waiting on the signed-in lecturer
 * (`pendingForMe` on the API — same filter as the "My turn" tab).
 *
 * Used by the sidebar badge; call {@link refresh} after workflow mutations so
 * the count stays accurate without waiting for navigation.
 */
@Injectable({
  providedIn: 'root',
})
export class ModerationInboxBadgeService {
  private readonly moderationService = inject(ModerationService);
  private readonly auth = inject(AuthenticationService);

  readonly pendingCount = signal(0);

  readonly pendingLabel = computed(() => {
    const n = this.pendingCount();
    if (n <= 0) return '';
    return n > 99 ? '99+' : String(n);
  });

  refresh(): void {
    if (!this.canSeeModerationMenu()) {
      this.pendingCount.set(0);
      return;
    }

    this.moderationService
      .list({ pendingForMe: true, page: 1, limit: 1 })
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          if (resp.status && resp.data) {
            this.pendingCount.set(resp.data.total ?? 0);
          } else {
            this.pendingCount.set(0);
          }
        },
        error: () => this.pendingCount.set(0),
      });
  }

  private canSeeModerationMenu(): boolean {
    const role = this.auth.activeAccount()?.role;
    if (!role) return false;
    const item = MENU.find((m) => m.route === MODERATION_MENU_ROUTE);
    return item?.accessRole.includes(role) ?? false;
  }
}
