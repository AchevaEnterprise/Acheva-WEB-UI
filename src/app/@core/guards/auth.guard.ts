import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { ToastService } from '../utility/toast.service';
import { AuthenticationService } from '../../@features/auth/service/auth.service';

/**
 * Lets a signed-in user into the shell; sends everyone else to the login
 * page, carrying where they were going so sign-in can take them back.
 *
 * It RETURNS a UrlTree rather than calling `router.navigate` and returning
 * false. It is a `canMatch` guard on the `''` route, which matches every
 * URL — so navigating to `/login` from inside it ran this guard again, which
 * navigated again, forever, in microtasks. The tab froze solid on any deep
 * link opened while signed out, and on every page once a session expired.
 */
export const authGuard: CanMatchFn = () => {
  const authService = inject(AuthenticationService);
  const toast = inject(ToastService);
  const router = inject(Router);

  if (authService.isAuthenticated) return true;

  const target = router.getCurrentNavigation()?.extractedUrl.toString() ?? '';
  const redirect = target && target !== '/' ? target : undefined;

  if (redirect) {
    toast.showNotification(
      'warning',
      'Please sign in',
      'Sign in to continue to that page.'
    );
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: redirect ? { redirect } : {},
  });
};
