import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ToastService } from '../utility/toast.service';
import { AuthenticationService } from '../../@features/auth/service/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthenticationService);
  const toast = inject(ToastService);
  const router = inject(Router);

  const isAuthenticated = authService.isAuthenticated;

  if (isAuthenticated) return true;
  else {
    router.navigate(['/login'], {
      queryParams: { redirect: state.url },
    });
    toast.showNotification('warning', 'Unauthorized', 'You are unauthorized');
    return false;
  }
};
