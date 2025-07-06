import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NotificationService } from '../utility/notification.service';
import { AuthenticationService } from '../../@features/auth/service/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthenticationService);
  const notification = inject(NotificationService);
  const router = inject(Router);

  const isAuthenticated = authService.isAuthenticated;

  if (isAuthenticated) return true;
  else {
    router.navigate(['/login'], {
      queryParams: { redirect: state.url },
    });
    notification.showNotification(
      'warning',
      'Unauthorized',
      'You are unauthorized'
    );
    return false;
  }
};
