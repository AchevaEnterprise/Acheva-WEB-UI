import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MENU } from '../constant/menu';
import { ToastService } from '../utility/toast.service';
import { AuthenticationService } from '../../@features/auth/service/auth.service';

/**
 * Keeps a section's URL as closed as its sidebar entry.
 *
 * The menu hid HOD settings, Students, Registration, Transfers and Dues from
 * the roles that do not hold them, but the routes were open: a lecturer
 * typing `/user-settings/hod/lecturer-management` got the Head's staff list
 * with live Assign / Hand over / deactivate controls that then failed on
 * click. The answer comes from `MENU.accessRole`, so the guard and the
 * sidebar cannot disagree about who may enter.
 */
export const menuAccessGuard: CanActivateFn = (route) => {
  const authService = inject(AuthenticationService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const entry = MENU.find((item) => item.route === route.routeConfig?.path);
  // On a fresh load (deep link, refresh) this runs before LayoutComponent
  // has restored the account from storage — restore it here, idempotently.
  if (!authService.activeAccount()) authService.loadInitialSession();
  const role = authService.activeAccount()?.role;

  if (!entry || (role && entry.accessRole.includes(role))) return true;

  toast.showNotification(
    'warning',
    'Not available',
    `${entry.label} is not part of your role, so we took you to your dashboard.`
  );
  return router.createUrlTree(['/dashboard']);
};
