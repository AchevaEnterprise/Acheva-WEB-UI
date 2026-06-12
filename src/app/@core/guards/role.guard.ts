import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ToastService } from '../utility/toast.service';
import { AuthenticationService } from '../../@features/auth/service/auth.service';
import { RoleEnum } from '../../@features/auth/model/auth.model';

export const lecturerOnlyGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthenticationService);
  const toast = inject(ToastService);
  const router = inject(Router);

  const account = authService.activeAccount();

  if (!account) {
    router.navigate(['/auth/login']);
    return false;
  }

  // Only LECTURER role can access this route
  if (account.role === RoleEnum.LECTURER) {
    return true;
  }

  router.navigate(['/dashboard']);
  toast.showNotification(
    'error',
    'Access Denied',
    'Only lecturers can moderate results. You do not have permission to access this section.'
  );
  return false;
};
